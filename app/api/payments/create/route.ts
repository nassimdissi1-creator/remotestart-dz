import { NextResponse } from 'next/server'
import { PRICING, type PaymentMethod, type ProductCode } from '@/lib/monetization'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const REDOTPAY_PERSONAL_PAYMENT_URL = process.env.REDOTPAY_PERSONAL_PAYMENT_URL
const REDOTPAY_WALLET_ADDRESS = process.env.REDOTPAY_WALLET_ADDRESS
const BARIDIMOB_CCP = process.env.BARIDIMOB_CCP
const BARIDIMOB_RIP = process.env.BARIDIMOB_RIP
const BARIDIMOB_ACCOUNT_NAME = process.env.BARIDIMOB_ACCOUNT_NAME

function getSupabaseHeaders() {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' }
}

function buildReference(product: ProductCode) {
  return `RSDZ-${product.toUpperCase()}-${crypto.randomUUID()}`
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Payment server configuration is incomplete.' }, { status: 500 })
    const body = await request.json()
    const product = body.product as ProductCode
    const paymentMethod = body.payment_method as PaymentMethod
    const customerEmail = String(body.customer_email ?? '').trim().toLowerCase()
    const customerId = body.customer_id ? String(body.customer_id) : null
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {}

    if (!product || !(product in PRICING)) return NextResponse.json({ error: 'Invalid product.' }, { status: 400 })
    if (!['redotpay', 'baridimob'].includes(paymentMethod)) return NextResponse.json({ error: 'Invalid payment method.' }, { status: 400 })
    if (!/^\S+@\S+\.\S+$/.test(customerEmail)) return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 })

    const plan = PRICING[product]
    const reference = buildReference(product)
    const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders`, {
      method: 'POST', headers: { ...getSupabaseHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ reference, customer_type: plan.customerType, customer_id: customerId, customer_email: customerEmail, product_code: product, amount_usd: plan.amount, payment_method: paymentMethod, metadata }), cache: 'no-store',
    })
    if (!insertResponse.ok) {
      console.error('Payment order creation failed:', await insertResponse.text())
      return NextResponse.json({ error: 'Could not create payment order.' }, { status: 502 })
    }

    if (paymentMethod === 'baridimob') {
      return NextResponse.json({ success: true, reference, amount: plan.amount, paymentMethod, requiresProof: true, baridimob: { ccp: BARIDIMOB_CCP || null, rip: BARIDIMOB_RIP || null, accountName: BARIDIMOB_ACCOUNT_NAME || null } }, { status: 201 })
    }

    if (!REDOTPAY_PERSONAL_PAYMENT_URL && !REDOTPAY_WALLET_ADDRESS) return NextResponse.json({ error: 'Personal RedotPay payment link or wallet address is not configured yet.', reference }, { status: 503 })
    let paymentUrl: string | null = null
    if (REDOTPAY_PERSONAL_PAYMENT_URL) {
      const url = new URL(REDOTPAY_PERSONAL_PAYMENT_URL)
      url.searchParams.set('reference', reference); url.searchParams.set('email', customerEmail); url.searchParams.set('amount', String(plan.amount))
      paymentUrl = url.toString()
    }
    return NextResponse.json({ success: true, reference, amount: plan.amount, paymentMethod, paymentUrl, walletAddress: REDOTPAY_WALLET_ADDRESS || null, requiresProof: true }, { status: 201 })
  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json({ error: 'Unexpected payment error.' }, { status: 500 })
  }
}
