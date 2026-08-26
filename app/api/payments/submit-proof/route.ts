import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { sendPaymentApprovalNotification } from '@/lib/telegram-payments'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'payment-receipts'

function headers() {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Payment server configuration is incomplete.' }, { status: 500 })
    }

    const form = await request.formData()
    const reference = String(form.get('reference') ?? '').trim()
    const transactionHash = String(form.get('transaction_hash') ?? '').trim()
    const paymentMethod = String(form.get('payment_method') ?? '').trim()
    const file = form.get('receipt')

    if (!reference || !['redotpay', 'baridimob'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Reference and valid payment method are required.' }, { status: 400 })
    }
    if (!transactionHash && !(file instanceof File)) {
      return NextResponse.json({ error: 'Submit a transaction hash or payment receipt.' }, { status: 400 })
    }
    if (file instanceof File) {
      if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Receipt must be smaller than 8MB.' }, { status: 400 })
      if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
        return NextResponse.json({ error: 'Receipt must be JPG, PNG, WEBP or PDF.' }, { status: 400 })
      }
    }

    const orderResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/payment_orders?reference=eq.${encodeURIComponent(reference)}&select=id,reference,customer_type,customer_id,customer_email,product_code,amount_usd,payment_method,status,transaction_hash,receipt_path,metadata`,
      { headers: headers(), cache: 'no-store' },
    )

    if (!orderResponse.ok) return NextResponse.json({ error: 'Could not load payment order.' }, { status: 502 })

    const orders = await orderResponse.json()
    const order = orders?.[0]
    if (!order) return NextResponse.json({ error: 'Payment order not found.' }, { status: 404 })

    if (order.payment_method !== paymentMethod) {
      return NextResponse.json({ error: 'Payment method does not match the payment order.' }, { status: 400 })
    }

    if (order.status === 'paid') {
      return NextResponse.json({ success: true, status: 'paid', alreadyPaid: true }, { status: 200 })
    }

    if (!['pending', 'pending_verification'].includes(order.status)) {
      return NextResponse.json({ error: `Payment order cannot accept proof in status: ${order.status}.` }, { status: 409 })
    }

    let receiptPath: string | null = order.receipt_path || null
    if (file instanceof File) {
      receiptPath = `${new Date().getUTCFullYear()}/${reference}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${receiptPath}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': file.type,
          'x-upsert': 'false',
        },
        body: await file.arrayBuffer(),
      })
      if (!upload.ok) return NextResponse.json({ error: 'Could not upload payment receipt.' }, { status: 502 })
    }

    const now = new Date().toISOString()
    const update = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?reference=eq.${encodeURIComponent(reference)}`, {
      method: 'PATCH',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify({
        transaction_hash: transactionHash || order.transaction_hash || null,
        receipt_path: receiptPath,
        proof_submitted_at: now,
        status: 'pending_verification',
        updated_at: now,
      }),
      cache: 'no-store',
    })

    if (!update.ok) {
      console.error('Payment proof update failed:', update.status, await update.text())
      return NextResponse.json({ error: 'Proof uploaded but order update failed.' }, { status: 502 })
    }

    const metadata = order.metadata && typeof order.metadata === 'object' ? order.metadata : {}
    const isLocalTalentPayment = order.product_code === 'talent_pro' && order.payment_method === 'baridimob'
    const notificationAmount = isLocalTalentPayment
      ? Number(metadata.local_amount || 8000)
      : Number(order.amount_usd)

    // Telegram is sent only after the order is successfully marked
    // pending_verification, and the amount comes from the server-side order.
    const telegramNotified = await sendPaymentApprovalNotification({
      reference: order.reference,
      product: order.product_code,
      amount: notificationAmount,
      paymentMethod: order.payment_method,
      customerEmail: order.customer_email,
      transactionHash: transactionHash || order.transaction_hash || null,
      receiptPath,
    })

    if (!telegramNotified) {
      console.error('Payment proof saved but Telegram approval notification was not delivered:', reference)
    }

    return NextResponse.json(
      { success: true, status: 'pending_verification', telegramNotified },
      { status: telegramNotified ? 201 : 202 },
    )
  } catch (error) {
    console.error('Payment proof error:', error)
    return NextResponse.json({ error: 'Unexpected payment proof error.' }, { status: 500 })
  }
}
