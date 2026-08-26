import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { notifyPendingPayment } from '@/lib/payment-fulfillment'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_SECRET = process.env.ADMIN_DASHBOARD_SECRET

function authorized(request: Request) {
  return Boolean(
    ADMIN_SECRET &&
      request.headers
        .get('cookie')
        ?.split(';')
        .some((item) => item.trim() === `rsdz_admin=${ADMIN_SECRET}`),
  )
}

function headers() {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 500 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const talentId = String(body.talent_id || '').trim()

    if (!talentId) {
      return NextResponse.json({ error: 'talent_id is required.' }, { status: 400 })
    }

    // Admin-only test flow. The database requires amount_usd > 0, so the test
    // order uses a nominal positive value. It never contacts RedotPay or
    // BaridiMob, and test metadata marks it as non-production money.
    const talentResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/talents?id=eq.${encodeURIComponent(talentId)}&select=id,email`,
      { headers: headers(), cache: 'no-store' },
    )

    if (!talentResponse.ok) {
      return NextResponse.json({ error: 'Could not verify talent account.' }, { status: 502 })
    }

    const talents = await talentResponse.json()
    const talent = talents?.[0]
    if (!talent?.id || !talent?.email) {
      return NextResponse.json({ error: 'Talent account not found.' }, { status: 404 })
    }

    const reference = `RSDZ-TEST-TALENT_PRO-${crypto.randomUUID()}`
    const now = new Date().toISOString()

    const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=representation' },
      body: JSON.stringify({
        reference,
        customer_type: 'talent',
        customer_id: talent.id,
        customer_email: String(talent.email).trim().toLowerCase(),
        product_code: 'talent_pro',
        amount_usd: 0.01,
        currency: 'USD',
        payment_method: 'redotpay',
        status: 'pending_verification',
        metadata: {
          test_payment: true,
          test_label: 'ADMIN_TELEGRAM_TALENT_PRO',
          created_by: 'admin-test-flow',
          created_at: now,
        },
      }),
      cache: 'no-store',
    })

    if (!insertResponse.ok) {
      const details = await insertResponse.text()
      console.error('Test payment order creation failed:', details)
      return NextResponse.json({ error: 'Could not create test payment order.' }, { status: 502 })
    }

    const rows = await insertResponse.json()
    const order = rows?.[0]
    if (!order?.id) {
      return NextResponse.json({ error: 'Test payment order was created but could not be loaded.' }, { status: 502 })
    }

    const notificationSent = await notifyPendingPayment({
      ...order,
      product_code: 'talent_pro [TEST]',
    })

    return NextResponse.json(
      {
        success: true,
        test: true,
        reference,
        paymentOrderId: order.id,
        talentId: talent.id,
        talentEmail: talent.email,
        notificationSent,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Admin test payment creation failed:', error)
    return NextResponse.json({ error: 'Unexpected test payment error.' }, { status: 500 })
  }
}
