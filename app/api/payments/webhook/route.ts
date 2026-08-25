import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { fulfillPayment } from '@/lib/payment-fulfillment'

export const runtime = 'nodejs'

function getWebhookSecret() {
  return process.env.PAYMENT_WEBHOOK_SECRET || ''
}

function timingSafeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a, 'utf8')
  const bBuffer = Buffer.from(b, 'utf8')

  if (aBuffer.length !== bBuffer.length) return false

  return crypto.timingSafeEqual(aBuffer, bBuffer)
}

function successfulPaymentStatus(value: unknown) {
  if (typeof value !== 'string') return false

  return new Set([
    'success',
    'completed',
    'paid',
    'approved',
  ]).has(value.toLowerCase().trim())
}

export async function POST(request: NextRequest) {
  try {
    const configuredSecret = getWebhookSecret()

    if (!configuredSecret) {
      console.error('PAYMENT_WEBHOOK_SECRET is not configured')

      return NextResponse.json(
        { success: false, error: 'Webhook is not configured.' },
        { status: 503 },
      )
    }

    const suppliedSecret =
      request.headers.get('x-webhook-secret') || ''

    if (!timingSafeEqual(suppliedSecret, configuredSecret)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized.' },
        { status: 401 },
      )
    }

    const body = await request.json()

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid webhook payload.' },
        { status: 400 },
      )
    }

    const payload = body as Record<string, unknown>

    const reference =
      typeof payload.reference === 'string'
        ? payload.reference.trim()
        : typeof payload.order_reference === 'string'
          ? payload.order_reference.trim()
          : typeof payload.order_id === 'string'
            ? payload.order_id.trim()
            : ''

    if (!reference || reference.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid payment reference.' },
        { status: 400 },
      )
    }

    if (!successfulPaymentStatus(payload.status)) {
      return NextResponse.json({
        success: true,
        processed: false,
        message: 'Payment status is not successful.',
        reference,
      })
    }

    // One fulfillment engine is shared by RedotPay, BaridiMob,
    // Telegram approval and provider webhooks. The database RPC
    // makes Talent Pro activation idempotent, so replaying this exact
    // webhook cannot extend the subscription a second time.
    const result = await fulfillPayment(
      reference,
      'payment-webhook',
    )

    return NextResponse.json({
      success: true,
      processed: true,
      reference,
      alreadyPaid: Boolean(result.alreadyPaid),
      productCode: result.order?.product_code || null,
      talentProActivation:
        result.talentProActivation || null,
    })
  } catch (error) {
    console.error('Payment webhook error:', error)

    // Do not expose internal Supabase/database errors to an external
    // payment provider. The provider can safely retry the webhook.
    return NextResponse.json(
      {
        success: false,
        error: 'Webhook processing failed.',
      },
      { status: 500 },
    )
  }
}
