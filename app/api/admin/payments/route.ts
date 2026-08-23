import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_SECRET = process.env.ADMIN_DASHBOARD_SECRET

function authorized(request: Request) {
  return Boolean(ADMIN_SECRET && request.headers.get('cookie')?.split(';').some((item) => item.trim() === `rsdz_admin=${ADMIN_SECRET}`))
}

function headers() {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' }
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!SUPABASE_URL || !SERVICE_KEY) return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 500 })
  const response = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?status=eq.pending_verification&order=created_at.desc&select=*`, { headers: headers(), cache: 'no-store' })
  if (!response.ok) return NextResponse.json({ error: 'Could not load pending payments.' }, { status: 502 })
  return NextResponse.json({ payments: await response.json() })
}
