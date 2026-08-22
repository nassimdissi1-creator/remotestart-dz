import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
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
      (
        url.hostname.toLowerCase() === 'linkedin.com' ||
        url.hostname.toLowerCase().endsWith('.linkedin.com')
      )
    )
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Missing Supabase configuration')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const body = await request.json()

    const fullName = String(body.full_name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const skills = parseSkills(body.skills)
    const linkedin = String(body.linkedin ?? '').trim()

    // Required fields
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

    // LinkedIn is optional
    if (!isValidLinkedIn(linkedin)) {
      return NextResponse.json(
        { error: 'Invalid LinkedIn URL' },
        { status: 400 }
      )
    }

    /*
     * IMPORTANT:
     * Do not send id or created_at.
     * Supabase should generate them automatically.
     *
     * skills is sent as an array because the Supabase column
     * is text[].
     */
    const talent = {
      full_name: fullName,
      email,
      skills,
      linkedin_url: linkedin || null,
    }

    /*
     * STEP 1
     * Insert talent into Supabase.
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

    const supabaseText = await supabaseResponse.text()

    let supabaseData: unknown = null

    try {
      supabaseData = supabaseText
        ? JSON.parse(supabaseText)
        : null
    } catch {
      supabaseData = supabaseText
    }

    if (!supabaseResponse.ok) {
      const message =
        typeof supabaseData === 'object' && supabaseData
          ? String(
              (supabaseData as Record<string, unknown>).message ??
                (supabaseData as Record<string, unknown>).hint ??
                (supabaseData as Record<string, unknown>).details ??
                ''
            )
          : String(supabaseData ?? '')

      /*
       * Duplicate email
       */
      if (
        supabaseResponse.status === 409 ||
        /duplicate|unique/i.test(message)
      ) {
        return NextResponse.json(
          {
            error: 'This email is already registered.',
          },
          { status: 409 }
        )
      }

      /*
       * Return the actual Supabase error temporarily.
       * This makes debugging possible without Vercel logs.
       */
      console.error(
        'Supabase talents INSERT failed:',
        supabaseResponse.status,
        supabaseData
      )

      return NextResponse.json(
        {
          error: 'Supabase insert failed.',
          status: supabaseResponse.status,
          details: supabaseData,
        },
        { status: 502 }
      )
    }

    const insertedTalent = Array.isArray(supabaseData)
      ? supabaseData[0]
      : supabaseData

    /*
     * STEP 2
     * Trigger Pipedream ONLY after Supabase succeeds.
     */

    if (!PIPEDREAM_WEBHOOK_URL) {
      return NextResponse.json(
        {
          success: true,
          webhookDelivered: false,
          warning: 'PIPEDREAM_WEBHOOK_URL is not configured.',
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
      console.error(
        'Pipedream webhook request failed:',
        error
      )

      /*
       * Supabase succeeded.
       * Therefore signup remains successful.
       */
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
        error: 'Unexpected server error.',
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    )
  }
}
