import { NextResponse } from 'next/server'
import { notifyPendingPayment } from '@/lib/payment-fulfillment'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function headers() {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' }
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Payment server configuration is incomplete.' }, { status: 500 })
    const body = await request.json()
    const reference = String(body.reference ?? '').trim()
    const transactionHash = String(body.transaction_hash ?? '').trim()
    if (!reference || transactionHash.length < 6 || transactionHash.length > 512) return NextResponse.json({ error: 'Reference and a valid transaction hash are required.' }, { status: 400 })

    const response = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?reference=eq.${encodeURIComponent(reference)}`, {
      method: 'PATCH', headers: { ...headers(), Prefer: 'return=representation' },
      body: JSON.stringify({ transaction_hash: transactionHash, status: 'pending_verification', proof_submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      cache: 'no-store',
    })
    if (!response.ok) return NextResponse.json({ error: 'Could not save transaction proof.' }, { status: 502 })

    const rows = await response.json()
    const order = rows?.[0]
    if (!order) return NextResponse.json({ error: 'Payment order not found.' }, { status: 404 })
    await notifyPendingPayment(order)

    return NextResponse.json({ success: true, status: 'pending_verification', notifiedAdmin: true }, { status: 200 })
  } catch (error) {
    console.error('RedotPay proof error:', error)
    return NextResponse.json({ error: 'Unexpected proof submission error.' }, { status: 500 })
  }
}
