import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const token = auth.slice(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: talent, error: talentError } = await supabase
      .from('talents')
      .select('id,is_pro,ai_cv_reviews_remaining,ai_cv_reviews_period_end')
      .eq('id', user.id)
      .single()
    if (talentError || !talent) return NextResponse.json({ error: 'Talent profile not found' }, { status: 404 })
    if (!talent.is_pro) return NextResponse.json({ error: 'Talent Pro Plus is required' }, { status: 403 })
    if (Number(talent.ai_cv_reviews_remaining ?? 0) <= 0) return NextResponse.json({ error: 'No AI CV reviews remaining this month' }, { status: 429 })

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'CV PDF is required' }, { status: 400 })
    if (file.type !== 'application/pdf') return NextResponse.json({ error: 'Only PDF CV files are supported' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'CV must be 5MB or smaller' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const pdfParseModule = await import('pdf-parse')
    const pdfParse = (pdfParseModule as any).default ?? pdfParseModule
    const parsed = await pdfParse(Buffer.from(arrayBuffer))
    const text = String(parsed?.text ?? '').trim()
    if (text.length < 100) return NextResponse.json({ error: 'Could not extract enough text from this CV' }, { status: 422 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'AI review service is not configured' }, { status: 503 })

    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.AI_CV_REVIEW_MODEL || 'gpt-5-mini',
        input: `Review this CV professionally for remote global employment. Return concise JSON with keys: overall_score (0-100), strengths (array), weaknesses (array), ats_issues (array), recommended_changes (array), summary (string). Do not invent facts.\n\nCV:\n${text.slice(0, 30000)}`,
        text: { format: { type: 'json_object' } },
      }),
    })
    if (!aiResponse.ok) return NextResponse.json({ error: 'AI CV review failed' }, { status: 502 })
    const aiData = await aiResponse.json()
    const outputText = aiData.output_text || aiData.output?.flatMap((x: any) => x.content || []).map((x: any) => x.text || '').join('') || '{}'
    let review: any
    try { review = JSON.parse(outputText) } catch { return NextResponse.json({ error: 'AI returned an invalid review' }, { status: 502 }) }

    const { data: consumed, error: consumeError } = await supabase.rpc('consume_ai_cv_review', { p_talent_id: user.id })
    if (consumeError || !consumed?.success) return NextResponse.json({ error: 'Review could not be consumed safely' }, { status: 409 })

    return NextResponse.json({ success: true, review, remaining: consumed.remaining })
  } catch (error) {
    console.error('AI CV review error', error)
    return NextResponse.json({ error: 'Unable to review CV' }, { status: 500 })
  }
}
