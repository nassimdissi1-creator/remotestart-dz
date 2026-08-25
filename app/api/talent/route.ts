import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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

    return (
      ['http:', 'https:'].includes(url.protocol) &&
      (url.hostname.toLowerCase() === 'linkedin.com' ||
        url.hostname.toLowerCase().endsWith('.linkedin.com'))
    )
  } catch {
    return false
  }
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || ''

  if (!authorization.startsWith('Bearer ')) return null

  const token = authorization.slice('Bearer '.length).trim()
  return token || null
}

async function getAuthenticatedUser(accessToken: string) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase Auth configuration is incomplete.')
  }

  const response = await fetch(
    `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`,
    {
      method: 'GET',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  )

  if (!response.ok) return null

  return response.json()
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return NextResponse.json(
        { error: 'Supabase configuration is incomplete.' },
        { status: 500 },
      )
    }

    const accessToken = getBearerToken(request)

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 },
      )
    }

    const user = await getAuthenticatedUser(accessToken)

    if (!user?.id || !user?.email) {
      return NextResponse.json(
        { error: 'Invalid or expired authentication session.' },
        { status: 401 },
      )
    }

    const body = await request.json()
    const fullName = String(body.full_name ?? '').trim()
    const email = String(user.email).trim().toLowerCase()
    const skills = parseSkills(body.skills)
    const linkedin = String(
      body.linkedin_url ?? body.linkedin ?? '',
    ).trim()

    if (fullName.length < 2 || fullName.length > 120) {
      return NextResponse.json(
        { error: 'Invalid full name.' },
        { status: 400 },
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid account email.' },
        { status: 400 },
      )
    }

    if (!skills.length) {
      return NextResponse.json(
        { error: 'At least one skill is required.' },
        { status: 400 },
      )
    }

    if (!isValidLinkedIn(linkedin)) {
      return NextResponse.json(
        { error: 'Invalid LinkedIn URL.' },
        { status: 400 },
      )
    }

    // IMPORTANT: id is always the verified Supabase Auth user ID.
    // The client cannot choose another user's ID, and billing columns
    // are intentionally omitted from this payload.
    const talent = {
      id: user.id,
      full_name: fullName,
      email,
      skills,
      linkedin_url: linkedin || null,
    }

    // Use the user's JWT, not service_role. This makes PostgreSQL RLS
    // evaluate auth.uid() = id and enforces the column grants from the patch.
    const supabaseResponse = await fetch(
      `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/talents`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(talent),
        cache: 'no-store',
      },
    )

    const text = await supabaseResponse.text()
    let data: any = null

    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    if (!supabaseResponse.ok) {
      const errorInfo = {
        status: supabaseResponse.status,
        code: data?.code ?? null,
        message: data?.message ?? String(data ?? ''),
        details: data?.details ?? null,
        hint: data?.hint ?? null,
      }

      console.error('Supabase authenticated talent INSERT failed:', errorInfo)

      if (
        supabaseResponse.status === 409 ||
        /duplicate|unique/i.test(errorInfo.message)
      ) {
        return NextResponse.json(
          { error: 'This talent profile already exists.' },
          { status: 409 },
        )
      }

      return NextResponse.json(
        { error: 'Could not create talent profile.' },
        { status: 502 },
      )
    }

    const insertedTalent = Array.isArray(data) ? data[0] : data
    const talentId = insertedTalent?.id ?? user.id

    let webhookDelivered = false

    if (PIPEDREAM_WEBHOOK_URL) {
      try {
        const webhookResponse = await fetch(PIPEDREAM_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'talent_signup',
            source: 'remotestart-dz',
            talent: insertedTalent,
          }),
          cache: 'no-store',
        })

        webhookDelivered = webhookResponse.ok

        if (!webhookResponse.ok) {
          console.error(
            'Pipedream webhook failed:',
            webhookResponse.status,
          )
        }
      } catch (error) {
        console.error('Pipedream webhook request failed:', error)
      }
    }

    return NextResponse.json(
      {
        success: true,
        talentId,
        webhookDelivered,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Talent API error:', error)

    return NextResponse.json(
      { error: 'Unexpected server error.' },
      { status: 500 },
    )
  }
}
