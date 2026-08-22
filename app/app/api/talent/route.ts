import { NextResponse } from 'next/server'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://ooskmzbwolukflnxfhzg.supabase.co'

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable__oHvQA9VpoE9rQ6pTDbG0A_CCNlS3tg'

const PIPEDREAM_WEBHOOK_URL =
  process.env.PIPEDREAM_WEBHOOK_URL

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function parseSkills(value: unknown) {
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
      url.hostname.toLowerCase().endsWith('linkedin.com')
    )
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const fullName = String(body.full_name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const skills = parseSkills(body.skills)
    const linkedin = String(body.linkedin ?? '').trim()

    if (fullName.length < 2 || fullName.length > 120) {
      return NextResponse.json(
        { error: 'Invalid full name' },
        { status: 400 }
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email' },
        { status: 400 }
      )
    }

    if (skills.length === 0) {
      return NextResponse.json(
        { error: 'At least one skill is required' },
        { status: 400 }
      )
    }

    if (!isValidLinkedIn(linkedin)) {
      return NextResponse.json(
        { error: 'Invalid LinkedIn URL' },
        { status: 400 }
      )
    }

    const talent = {
      id: crypto.randomUUID(),
      full_name: fullName,
      email,
      skills,
      linkedin_url: linkedin || null,
    }

    /*
     * STEP 1
     * Save the talent to Supabase.
     */

    const supabaseResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/talents`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(talent),
        cache: 'no-store',
      }
    )

    const supabaseData =
      await supabaseResponse.json().catch(() => null)

    if (!supabaseResponse.ok) {
      const message = String(
        supabaseData?.message ??
        supabaseData?.hint ??
        ''
      )

      if (
        supabaseResponse.status === 409 ||
        /duplicate|unique/i.test(message)
      ) {
        return NextResponse.json(
          { error: 'This email is already registered.' },
          { status: 409 }
        )
      }

      console.error(
        'Supabase talents INSERT failed:',
        supabaseResponse.status,
        supabaseData
      )

      return NextResponse.json(
        { error: 'Could not save talent profile.' },
        { status: 502 }
      )
    }

    const insertedTalent = Array.isArray(supabaseData)
      ? supabaseData[0]
      : supabaseData

    /*
     * STEP 2
     * ONLY after Supabase succeeds,
     * trigger Pipedream.
     */

    if (!PIPEDREAM_WEBHOOK_URL) {
      console.error(
        'PIPEDREAM_WEBHOOK_URL is not configured.'
      )

      return NextResponse.json(
        {
          success: true,
          webhookDelivered: false,
        },
        { status: 201 }
      )
    }

    try {
      const webhookResponse = await fetch(
        PIPEDREAM_WEBHOOK_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: 'talent_signup',
            source: 'remotestart-dz',
            talent: insertedTalent,
          }),
          cache: 'no-store',
        }
      )

      if (!webhookResponse.ok) {
        console.error(
          'Pipedream webhook failed:',
          webhookResponse.status
        )

        return NextResponse.json(
          {
            success: true,
            webhookDelivered: false,
          },
          { status: 201 }
        )
      }

      return NextResponse.json(
        {
          success: true,
          webhookDelivered: true,
        },
        { status: 201 }
      )
    } catch (error) {
      /*
       * Supabase already succeeded.
       * Therefore do NOT tell the user that signup failed.
       */

      console.error(
        'Pipedream webhook request failed:',
        error
      )

      return NextResponse.json(
        {
          success: true,
          webhookDelivered: false,
        },
        { status: 201 }
      )
    }
  } catch (error) {
    console.error('Talent API error:', error)

    return NextResponse.json(
      {
        error: 'Unexpected server error',
      },
      { status: 500 }
    )
  }
}
