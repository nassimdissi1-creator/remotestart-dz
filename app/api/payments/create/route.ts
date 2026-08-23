import { NextResponse } from 'next/server'
import { PRICING, type PaymentMethod, type ProductCode } from '@/lib/monetization'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const checkoutLinks: Partial<Record<ProductCode, string | undefined>> = {
  talent_pro: process.env.REDOTPAY_TALENT_PRO_URL,
  ai_cv_review: process.env.REDOTPAY_AI_CV_REVIEW_URL,
  job_standard: process.env.REDOTPAY_JOB_STANDARD_URL,
  job_featured: process.env.REDOTPAY_JOB_FEATURED_URL,
}

function getSupabaseHeaders() {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

function buildReference(product: ProductCode) {
  return `RSDZ-${product.toUpperCase()}-${crypto.randomUUID()}`
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Payment server configuration is incomplete.' }, { status: 500 })
    }

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
    if (paymentMethod === 'baridimob' && product.startsWith('job_')) {
      return NextResponse.json({ error: 'BaridiMob is currently available for talent purchases only.' }, { status: 400 })
    }

    const reference = buildReference(product)
    const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders`, {
      method: 'POST',
      headers: { ...getSupabaseHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({
        reference,
        customer_type: plan.customerType,
        customer_id: customerId,
        customer_email: customerEmail,
        product_code: product,
        amount_usd: plan.amount,
        payment_method: paymentMethod,
        metadata,
      }),
      cache: 'no-store',
    })

    if (!insertResponse.ok) {
      const error = await insertResponse.text()
      console.error('Payment order creation failed:', error)
      return NextResponse.json({ error: 'Could not create payment order.' }, { status: 502 })
    }

    if (paymentMethod === 'baridimob') {
      return NextResponse.json({
        success: true,
        reference,
        amount: plan.amount,
        paymentMethod,
        requiresReceipt: true,
      }, { status: 201 })
    }

    const baseUrl = checkoutLinks[product]
    if (!baseUrl) {
      return NextResponse.json({
        error: 'RedotPay checkout is not configured for this product yet.',
        reference,
      }, { status: 503 })
    }

    const checkoutUrl = new URL(baseUrl)
    checkoutUrl.searchParams.set('reference', reference)
    checkoutUrl.searchParams.set('email', customerEmail)

    return NextResponse.json({
      success: true,
      reference,
      amount: plan.amount,
      paymentMethod,
      checkoutUrl: checkoutUrl.toString(),
    }, { status: 201 })
  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json({ error: 'Unexpected payment error.' }, { status: 500 })
  }
}
