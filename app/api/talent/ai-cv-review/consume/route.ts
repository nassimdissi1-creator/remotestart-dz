import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length).trim()
  return token || null
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 500 })
    }

    const accessToken = getBearerToken(request)
    if (!accessToken) {
      return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })
    }

    const userResponse = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    if (!userResponse.ok) {
      return NextResponse.json({ error: 'Invalid or expired authentication session.' }, { status: 401 })
    }

    const user = await userResponse.json()
    if (!user?.id) {
      return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })
    }

    // Use the user's JWT so auth.uid() is available inside the SECURITY DEFINER
    // function. The database function remains the authoritative entitlement gate.
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/consume_ai_cv_review`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ p_talent_id: user.id }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const message = await response.text()
      if (message.includes('ai_cv_review_limit_reached')) {
        return NextResponse.json({ error: 'Monthly AI CV Review limit reached.' }, { status: 403 })
      }
      if (message.includes('talent_pro_subscription_inactive')) {
        return NextResponse.json({ error: 'An active Talent Pro Plus subscription is required.' }, { status: 403 })
      }
      if (message.includes('unauthenticated_or_forbidden')) {
        return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Could not consume AI CV Review.' }, { status: 502 })
    }

    const result = await response.json()
    return NextResponse.json(Array.isArray(result) ? result[0] : result, { status: 200 })
  } catch (error) {
    console.error('AI CV Review allowance error:', error)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
