import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const PIPEDREAM_WEBHOOK_URL = process.env.PIPEDREAM_WEBHOOK_URL

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function parseSkills(value: unknown): string[] {
  return String(value ?? '')
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 30)
}

function isValidLinkedIn(value: string) {
  if (!value) return true
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) &&
      (url.hostname.toLowerCase() === 'linkedin.com' || url.hostname.toLowerCase().endsWith('.linkedin.com'))
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Supabase configuration missing:', {
        hasUrl: Boolean(SUPABASE_URL),
        hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        hasPublishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      })
      return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 500 })
    }

    const body = await request.json()
    const fullName = String(body.full_name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const skills = parseSkills(body.skills)
    const linkedin = String(body.linkedin_url ?? body.linkedin ?? '').trim()

    if (fullName.length < 2 || fullName.length > 120) {
      return NextResponse.json({ error: 'Invalid full name' }, { status: 400 })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }
    if (skills.length === 0) {
      return NextResponse.json({ error: 'At least one skill is required' }, { status: 400 })
    }
    if (!isValidLinkedIn(linkedin)) {
      return NextResponse.json({ error: 'Invalid LinkedIn URL' }, { status: 400 })
    }

    // Exact Supabase talents schema: full_name:text, email:text, skills:text[], linkedin_url:text.
    const talent = {
      full_name: fullName,
      email,
      skills,
      linkedin_url: linkedin || null,
    }

    const supabaseResponse = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/talents`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(talent),
      cache: 'no-store',
    })

    const supabaseText = await supabaseResponse.text()
    let supabaseData: any = null
    try {
      supabaseData = supabaseText ? JSON.parse(supabaseText) : null
    } catch {
      supabaseData = supabaseText
    }

    if (!supabaseResponse.ok) {
      const errorInfo = {
        status: supabaseResponse.status,
        code: typeof supabaseData === 'object' && supabaseData ? supabaseData.code ?? null : null,
        message: typeof supabaseData === 'object' && supabaseData ? supabaseData.message ?? null : String(supabaseData ?? ''),
        details: typeof supabaseData === 'object' && supabaseData ? supabaseData.details ?? null : null,
        hint: typeof supabaseData === 'object' && supabaseData ? supabaseData.hint ?? null : null,
      }

      console.error('Supabase talents INSERT failed:', errorInfo)

      if (supabaseResponse.status === 409 || /duplicate|unique/i.test(errorInfo.message || '')) {
        return NextResponse.json({ error: 'This email is already registered.', ...errorInfo }, { status: 409 })
      }

      return NextResponse.json({ error: 'Supabase insert failed.', ...errorInfo }, { status: 502 })
    }

    const insertedTalent = Array.isArray(supabaseData) ? supabaseData[0] : supabaseData

    // The webhook is called only after the Supabase insert succeeds.
    if (!PIPEDREAM_WEBHOOK_URL) {
      console.warn('PIPEDREAM_WEBHOOK_URL is not configured; talent was saved successfully.')
      return NextResponse.json({ success: true, webhookDelivered: false }, { status: 201 })
    }

    try {
      const webhookResponse = await fetch(PIPEDREAM_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'talent_signup', source: 'remotestart-dz', talent: insertedTalent }),
        cache: 'no-store',
      })

      if (!webhookResponse.ok) console.error('Pipedream webhook failed:', webhookResponse.status)
      return NextResponse.json({ success: true, webhookDelivered: webhookResponse.ok }, { status: 201 })
    } catch (error) {
      console.error('Pipedream webhook request failed:', error)
      return NextResponse.json({ success: true, webhookDelivered: false }, { status: 201 })
    }
  } catch (error) {
    console.error('Talent API error:', error)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
