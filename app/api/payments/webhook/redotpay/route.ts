import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WEBHOOK_SECRET = process.env.REDOTPAY_WEBHOOK_SECRET

function verifySignature(rawBody: string, signature: string | null) {
  if (!WEBHOOK_SECRET) return false
  if (!signature) return false
  const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature.replace(/^sha256=/, ''))
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 500 })
    }

    const rawBody = await request.text()
    if (!verifySignature(rawBody, request.headers.get('x-webhook-signature'))) {
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const status = String(body.status ?? body.payment_status ?? '').toLowerCase()
    const reference = String(body.reference ?? body.metadata?.reference ?? body.order_id ?? '').trim()
    const providerPaymentId = String(body.payment_id ?? body.transaction_id ?? body.id ?? '').trim() || null

    if (!reference) return NextResponse.json({ error: 'Missing payment reference.' }, { status: 400 })
    if (!['paid', 'completed', 'success', 'succeeded'].includes(status)) return NextResponse.json({ received: true })

    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    const lookup = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?reference=eq.${encodeURIComponent(reference)}&select=*`, { headers, cache: 'no-store' })
    if (!lookup.ok) return NextResponse.json({ error: 'Payment order lookup failed.' }, { status: 502 })
    const orders = await lookup.json()
    const order = orders[0]
    if (!order) return NextResponse.json({ error: 'Payment order not found.' }, { status: 404 })

    const paidAt = new Date().toISOString()
    await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?id=eq.${encodeURIComponent(order.id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'paid', provider_payment_id: providerPaymentId, paid_at: paidAt, updated_at: paidAt }),
    })

    if (order.product_code === 'talent_pro' && order.customer_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/talents?id=eq.${encodeURIComponent(order.customer_id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_pro: true, featured_until: new Date(Date.now() + 30 * 86400000).toISOString() }),
      })
    }

    if (order.product_code === 'ai_cv_review' && order.customer_id) {
      const talentLookup = await fetch(`${SUPABASE_URL}/rest/v1/talents?id=eq.${encodeURIComponent(order.customer_id)}&select=ai_cv_reviews_remaining`, { headers, cache: 'no-store' })
      const talent = (await talentLookup.json())[0]
      const current = Number(talent?.ai_cv_reviews_remaining ?? 0)
      await fetch(`${SUPABASE_URL}/rest/v1/talents?id=eq.${encodeURIComponent(order.customer_id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ ai_cv_reviews_remaining: current + 1 }),
      })
    }

    if (order.product_code === 'job_standard' || order.product_code === 'job_featured') {
      const jobId = order.metadata?.job_id
      if (jobId) {
        await fetch(`${SUPABASE_URL}/rest/v1/job_opportunities?id=eq.${encodeURIComponent(jobId)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            payment_status: 'paid',
            published: true,
            featured: order.product_code === 'job_featured',
            payment_order_id: order.id,
            published_at: paidAt,
            updated_at: paidAt,
          }),
        })
      }
    }

    return NextResponse.json({ received: true, activated: true })
  } catch (error) {
    console.error('RedotPay webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }
}
