import { NextResponse } from 'next/server'
import crypto from 'node:crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET

function verifySignature(rawBody: string, signature: string | null) {
  if (!WEBHOOK_SECRET || !signature) return false
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

function headers() {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  if (!verifySignature(rawBody, request.headers.get('x-payment-signature'))) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  if (!SUPABASE_URL || !SERVICE_KEY) return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 500 })

  try {
    const body = JSON.parse(rawBody)
    const reference = String(body.reference ?? '').trim()
    const providerPaymentId = body.provider_payment_id ? String(body.provider_payment_id) : null
    const status = body.status === 'paid' ? 'paid' : null
    if (!reference || !status) return NextResponse.json({ error: 'reference and paid status are required.' }, { status: 400 })

    const lookup = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?reference=eq.${encodeURIComponent(reference)}&select=*`, { headers: headers(), cache: 'no-store' })
    if (!lookup.ok) return NextResponse.json({ error: 'Could not find payment order.' }, { status: 502 })
    const orders = await lookup.json()
    const order = orders[0]
    if (!order) return NextResponse.json({ error: 'Payment order not found.' }, { status: 404 })
    if (order.status === 'paid') return NextResponse.json({ success: true, status: 'paid', idempotent: true })

    const now = new Date().toISOString()
    const paid = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?id=eq.${encodeURIComponent(order.id)}`, { method: 'PATCH', headers: { ...headers(), Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'paid', provider_payment_id: providerPaymentId, paid_at: now, verified_at: now, verified_by: 'webhook' }), cache: 'no-store' })
    if (!paid.ok) return NextResponse.json({ error: 'Could not mark payment paid.' }, { status: 502 })

    const metadata = order.metadata && typeof order.metadata === 'object' ? order.metadata : {}
    const product = String(order.product_code)
    if (order.customer_type === 'talent' && order.customer_id) {
      const patch: Record<string, unknown> = {}
      if (product === 'talent_pro') { patch.is_pro = true; patch.featured_until = new Date(Date.now() + 30 * 86400000).toISOString() }
      if (product === 'ai_cv_review') {
        const currentResponse = await fetch(`${SUPABASE_URL}/rest/v1/talents?id=eq.${encodeURIComponent(order.customer_id)}&select=ai_cv_reviews_remaining`, { headers: headers(), cache: 'no-store' })
        const current = Number((await currentResponse.json())[0]?.ai_cv_reviews_remaining ?? 0)
        patch.ai_cv_reviews_remaining = current + 1
      }
      if (Object.keys(patch).length) await fetch(`${SUPABASE_URL}/rest/v1/talents?id=eq.${encodeURIComponent(order.customer_id)}`, { method: 'PATCH', headers: { ...headers(), Prefer: 'return=minimal' }, body: JSON.stringify(patch), cache: 'no-store' })
    }
    if (order.customer_type === 'employer' && metadata.job_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/job_opportunities?id=eq.${encodeURIComponent(String(metadata.job_id))}`, { method: 'PATCH', headers: { ...headers(), Prefer: 'return=minimal' }, body: JSON.stringify({ payment_status: 'paid', published: true, featured: product === 'job_featured', published_at: now, expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), payment_order_id: order.id }), cache: 'no-store' })
    }
    return NextResponse.json({ success: true, status: 'paid' })
  } catch (error) {
    console.error('Payment webhook error:', error)
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 })
  }
}
