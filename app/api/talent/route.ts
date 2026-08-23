import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PIPEDREAM_WEBHOOK_URL = process.env.PIPEDREAM_WEBHOOK_URL

function isValidEmail(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) }
function parseSkills(value: unknown): string[] { return String(value ?? '').split(',').map((skill) => skill.trim()).filter(Boolean).slice(0, 30) }
function isValidLinkedIn(value: string) {
  if (!value) return true
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && (url.hostname.toLowerCase() === 'linkedin.com' || url.hostname.toLowerCase().endsWith('.linkedin.com')) } catch { return false }
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Supabase server configuration is incomplete.' }, { status: 500 })
    const body = await request.json()
    const fullName = String(body.full_name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const skills = parseSkills(body.skills)
    const linkedin = String(body.linkedin_url ?? body.linkedin ?? '').trim()
    if (fullName.length < 2 || fullName.length > 120) return NextResponse.json({ error: 'Invalid full name' }, { status: 400 })
    if (!isValidEmail(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    if (!skills.length) return NextResponse.json({ error: 'At least one skill is required' }, { status: 400 })
    if (!isValidLinkedIn(linkedin)) return NextResponse.json({ error: 'Invalid LinkedIn URL' }, { status: 400 })

    const talent = { full_name: fullName, email, skills, linkedin_url: linkedin || null }
    const supabaseResponse = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/talents`, {
      method: 'POST', headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(talent), cache: 'no-store',
    })
    const text = await supabaseResponse.text()
    let data: any = null; try { data = text ? JSON.parse(text) : null } catch { data = text }
    if (!supabaseResponse.ok) {
      const errorInfo = { status: supabaseResponse.status, code: data?.code ?? null, message: data?.message ?? String(data ?? ''), details: data?.details ?? null, hint: data?.hint ?? null }
      console.error('Supabase talents INSERT failed:', errorInfo)
      if (supabaseResponse.status === 409 || /duplicate|unique/i.test(errorInfo.message)) return NextResponse.json({ error: 'This email is already registered.', ...errorInfo }, { status: 409 })
      return NextResponse.json({ error: 'Supabase insert failed.', ...errorInfo }, { status: 502 })
    }

    const insertedTalent = Array.isArray(data) ? data[0] : data
    const talentId = insertedTalent?.id ?? null
    let webhookDelivered = false
    if (PIPEDREAM_WEBHOOK_URL) {
      try {
        const webhookResponse = await fetch(PIPEDREAM_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'talent_signup', source: 'remotestart-dz', talent: insertedTalent }), cache: 'no-store' })
        webhookDelivered = webhookResponse.ok
        if (!webhookResponse.ok) console.error('Pipedream webhook failed:', webhookResponse.status)
      } catch (error) { console.error('Pipedream webhook request failed:', error) }
    }
    return NextResponse.json({ success: true, talentId, webhookDelivered }, { status: 201 })
  } catch (error) {
    console.error('Talent API error:', error)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
