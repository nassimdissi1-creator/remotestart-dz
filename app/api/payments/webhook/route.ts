import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { fulfillPayment } from '@/lib/payment-fulfillment'
import { PRICING } from '@/lib/monetization'
import { redotPayAmountMatches, redotPayProviderPaymentId, redotPaySuccess, verifyRedotPayWebhook } from '@/lib/redotpay'

export const runtime = 'nodejs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || ''

function timingSafeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a, 'utf8')
  const bBuffer = Buffer.from(b, 'utf8')
  if (aBuffer.length !== bBuffer.length) return false
  return crypto.timingSafeEqual(aBuffer, bBuffer)
}

function internalWebhookAuthorized(request: NextRequest) {
  const supplied = request.headers.get('x-webhook-secret') || ''
  return Boolean(WEBHOOK_SECRET) && timingSafeEqual(supplied, WEBHOOK_SECRET)
}

async function loadPaymentOrder(reference: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase configuration is incomplete')
  const response = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?reference=eq.${encodeURIComponent(reference)}&select=*`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Could not load payment order: ${response.status}`)
  const rows = await response.json()
  return rows?.[0] || null
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    let payload: Record<string, unknown>

    try {
      const parsed = JSON.parse(rawBody)
      if (!parsed || typeof parsed !== 'object') throw new Error('invalid')
      payload = parsed as Record<string, unknown>
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid webhook payload.' }, { status: 400 })
    }

    const redotPaySignature = request.headers.get('x-r-signature')
    const isRedotPay = Boolean(redotPaySignature)

    if (isRedotPay) {
      const verified = verifyRedotPayWebhook({
        rawBody,
        signature: redotPaySignature,
        timestamp: request.headers.get('x-r-ts'),
        keyVersion: request.headers.get('x-r-key-version'),
      })

      if (!verified) {
        return NextResponse.json({ success: false, error: 'Invalid RedotPay signature.' }, { status: 401 })
      }

      const reference =
        typeof payload.outerOrderSn === 'string'
          ? payload.outerOrderSn.trim()
          : typeof payload.outerOrder === 'string'
            ? payload.outerOrder.trim()
            : ''

      if (!reference || reference.length > 200) {
        return NextResponse.json({ success: false, error: 'Missing RedotPay order reference.' }, { status: 400 })
      }

      const order = await loadPaymentOrder(reference)
      if (!order) return NextResponse.json({ success: false, error: 'Payment order not found.' }, { status: 404 })

      // Never trust the amount/product coming from the browser or the callback alone.
      // The expected amount is derived from our own immutable product code.
      const expected = PRICING[order.product_code as keyof typeof PRICING]
      if (!expected || order.customer_type !== expected.customerType) {
        return NextResponse.json({ success: false, error: 'Invalid payment product.' }, { status: 400 })
      }

      if (String(payload.orderCurrency || '').toUpperCase() !== 'USD') {
        return NextResponse.json({ success: false, error: 'Invalid payment currency.' }, { status: 400 })
      }

      if (!redotPayAmountMatches(payload.orderAmount, expected.amount)) {
        return NextResponse.json({ success: false, error: 'Payment amount mismatch.' }, { status: 400 })
      }

      if (!redotPaySuccess(payload.orderStatus)) {
        return NextResponse.json({ success: true, processed: false, reference, message: 'Payment is not successful.' })
      }

      const providerPaymentId = redotPayProviderPaymentId(payload)
      const result = await fulfillPayment(reference, 'redotpay-webhook', providerPaymentId)

      return NextResponse.json({
        success: true,
        processed: !result.alreadyPaid,
        alreadyPaid: Boolean(result.alreadyPaid),
        reference,
        providerPaymentId,
        productCode: result.order?.product_code || null,
      })
    }

    // Preserve the existing authenticated internal webhook path for
    // BaridiMob/Telegram/admin workflows. It is not used as RedotPay auth.
    if (!internalWebhookAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
    }

    const reference =
      typeof payload.reference === 'string'
        ? payload.reference.trim()
        : typeof payload.order_reference === 'string'
          ? payload.order_reference.trim()
          : typeof payload.order_id === 'string'
            ? payload.order_id.trim()
            : ''

    if (!reference || reference.length > 200) {
      return NextResponse.json({ success: false, error: 'Missing or invalid payment reference.' }, { status: 400 })
    }

    const status = typeof payload.status === 'string' ? payload.status.toLowerCase().trim() : ''
    if (!new Set(['success', 'completed', 'paid', 'approved']).has(status)) {
      return NextResponse.json({ success: true, processed: false, reference, message: 'Payment status is not successful.' })
    }

    const providerPaymentId = typeof payload.transaction_id === 'string' ? payload.transaction_id.trim() : null
    const result = await fulfillPayment(reference, 'payment-webhook', providerPaymentId)

    return NextResponse.json({ success: true, processed: !result.alreadyPaid, alreadyPaid: Boolean(result.alreadyPaid), reference, productCode: result.order?.product_code || null })
  } catch (error) {
    console.error('Payment webhook error:', error)
    return NextResponse.json({ success: false, error: 'Webhook processing failed.' }, { status: 500 })
  }
}
