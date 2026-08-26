import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function serviceHeaders() {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase service role is not configured')
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

async function authenticate(request: Request) {
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length).trim()
  if (!token || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) return null
  return response.json()
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_PUBLISHABLE_KEY) {
      return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 500 })
    }

    const user = await authenticate(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_ai_cv_review`, {
      method: 'POST',
      headers: serviceHeaders(),
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
      return NextResponse.json({ error: 'Could not consume AI CV Review.' }, { status: 502 })
    }

    const result = await response.json()
    return NextResponse.json(Array.isArray(result) ? result[0] : result, { status: 200 })
  } catch (error) {
    console.error('AI CV Review allowance error:', error)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
