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

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!SUPABASE_URL || !SERVICE_KEY) return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const reference = String(body.reference ?? '').trim()
  const decision = body.decision === 'reject' ? 'reject' : 'approve'
  if (!reference) return NextResponse.json({ error: 'Payment reference is required.' }, { status: 400 })

  const orderResponse = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?reference=eq.${encodeURIComponent(reference)}&select=*`, { headers: headers(), cache: 'no-store' })
  if (!orderResponse.ok) return NextResponse.json({ error: 'Could not load payment order.' }, { status: 502 })
  const orders = await orderResponse.json()
  const order = orders[0]
  if (!order) return NextResponse.json({ error: 'Payment order not found.' }, { status: 404 })
  if (order.status !== 'pending_verification') return NextResponse.json({ error: `Order is already ${order.status}.` }, { status: 409 })

  const now = new Date().toISOString()
  if (decision === 'reject') {
    const rejected = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?id=eq.${encodeURIComponent(order.id)}`, { method: 'PATCH', headers: { ...headers(), Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'rejected', verified_at: now, verified_by: 'admin' }), cache: 'no-store' })
    if (!rejected.ok) return NextResponse.json({ error: 'Could not reject payment.' }, { status: 502 })
    return NextResponse.json({ success: true, status: 'rejected' })
  }

  const paid = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?id=eq.${encodeURIComponent(order.id)}`, { method: 'PATCH', headers: { ...headers(), Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'paid', paid_at: now, verified_at: now, verified_by: 'admin' }), cache: 'no-store' })
  if (!paid.ok) return NextResponse.json({ error: 'Could not approve payment.' }, { status: 502 })

  const product = order.product_code as string
  const metadata = order.metadata && typeof order.metadata === 'object' ? order.metadata : {}

  if (order.customer_type === 'talent' && order.customer_id) {
    if (product === 'talent_pro') {
      const talent = await fetch(`${SUPABASE_URL}/rest/v1/talents?id=eq.${encodeURIComponent(order.customer_id)}`, { method: 'PATCH', headers: { ...headers(), Prefer: 'return=minimal' }, body: JSON.stringify({ is_pro: true, featured_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }), cache: 'no-store' })
      if (!talent.ok) return NextResponse.json({ error: 'Payment approved but talent activation failed.' }, { status: 502 })
    } else if (product === 'ai_cv_review') {
      const talentResponse = await fetch(`${SUPABASE_URL}/rest/v1/talents?id=eq.${encodeURIComponent(order.customer_id)}&select=ai_cv_reviews_remaining`, { headers: headers(), cache: 'no-store' })
      const talentRows = await talentResponse.json()
      const current = Number(talentRows[0]?.ai_cv_reviews_remaining ?? 0)
      const talent = await fetch(`${SUPABASE_URL}/rest/v1/talents?id=eq.${encodeURIComponent(order.customer_id)}`, { method: 'PATCH', headers: { ...headers(), Prefer: 'return=minimal' }, body: JSON.stringify({ ai_cv_reviews_remaining: current + 1 }), cache: 'no-store' })
      if (!talent.ok) return NextResponse.json({ error: 'Payment approved but CV review credit activation failed.' }, { status: 502 })
    }
  }

  if (order.customer_type === 'employer' && metadata.job_id) {
    const featured = product === 'job_featured'
    const job = await fetch(`${SUPABASE_URL}/rest/v1/job_opportunities?id=eq.${encodeURIComponent(String(metadata.job_id))}`, { method: 'PATCH', headers: { ...headers(), Prefer: 'return=minimal' }, body: JSON.stringify({ payment_status: 'paid', published: true, featured, published_at: now, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), payment_order_id: order.id }), cache: 'no-store' })
    if (!job.ok) return NextResponse.json({ error: 'Payment approved but job activation failed.' }, { status: 502 })
  }

  return NextResponse.json({ success: true, status: 'paid' })
}
