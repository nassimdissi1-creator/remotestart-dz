import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { PRICING, type PaymentMethod, type ProductCode } from '@/lib/monetization'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const REDOTPAY_PERSONAL_PAYMENT_URL = process.env.REDOTPAY_PERSONAL_PAYMENT_URL
const REDOTPAY_WALLET_ADDRESS = process.env.REDOTPAY_WALLET_ADDRESS
const BARIDIMOB_CCP = process.env.BARIDIMOB_CCP
const BARIDIMOB_RIP = process.env.BARIDIMOB_RIP
const BARIDIMOB_ACCOUNT_NAME = process.env.BARIDIMOB_ACCOUNT_NAME

function getSupabaseHeaders() {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' }
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return null
  return authorization.slice('Bearer '.length).trim() || null
}

async function getAuthenticatedUser(accessToken: string) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) throw new Error('Supabase Auth configuration is incomplete')
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
  if (!response.ok) return null
  return response.json()
}

async function getActiveBillingPlan(product: ProductCode) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/billing_plans?code=eq.${encodeURIComponent(product)}&is_active=eq.true&select=id,code,price_amount,currency,billing_interval,ai_cv_reviews_per_month&limit=1`, { headers: getSupabaseHeaders(), cache: 'no-store' })
  if (!response.ok) throw new Error(`Could not load billing plan: ${response.status}`)
  const rows = await response.json()
  const plan = rows?.[0]
  if (!plan?.id) throw new Error(`Active billing plan not found for ${product}`)
  return plan
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
    if (!product || !(product in PRICING)) return NextResponse.json({ error: 'Invalid product.' }, { status: 400 })
    if (!['redotpay', 'baridimob'].includes(paymentMethod)) return NextResponse.json({ error: 'Invalid payment method.' }, { status: 400 })

    const pricing = PRICING[product]
    const isTalentProduct = pricing.customerType === 'talent'
    const billingPlan = await getActiveBillingPlan(product)

    let customerId: string | null = null
    let customerEmail = String(body.customer_email ?? '').trim().toLowerCase()

    if (isTalentProduct) {
      const accessToken = getBearerToken(request)
      if (!accessToken) return NextResponse.json({ error: 'Authentication is required for talent purchases.' }, { status: 401 })
      const user = await getAuthenticatedUser(accessToken)
      if (!user?.id || !user?.email) return NextResponse.json({ error: 'Invalid or expired authentication session.' }, { status: 401 })
      customerId = user.id
      customerEmail = String(user.email).trim().toLowerCase()
    }

    if (!/^\S+@\S+\.\S+$/.test(customerEmail)) return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 })

    const reference = buildReference(product)
    const isLocalTalentPayment = product === 'talent_pro' && paymentMethod === 'baridimob'
    const displayAmount = isLocalTalentPayment ? pricing.baridimobAmount : pricing.amount
    const displayCurrency = isLocalTalentPayment ? pricing.baridimobCurrency : 'USD'
    const rawMetadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
    const metadata = {
      ...rawMetadata,
      billing_plan_id: billingPlan.id,
      ...(isTalentProduct ? { talent_id: customerId } : {}),
      ...(isLocalTalentPayment ? { local_amount: pricing.baridimobAmount, local_currency: pricing.baridimobCurrency } : {}),
    }

    const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders`, {
      method: 'POST',
      headers: { ...getSupabaseHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({
        reference,
        customer_type: pricing.customerType,
        customer_id: customerId,
        customer_email: customerEmail,
        product_code: product,
        plan_id: billingPlan.id,
        amount_usd: pricing.amount,
        payment_method: paymentMethod,
        currency: displayCurrency,
        metadata,
      }),
      cache: 'no-store',
    })

    if (!insertResponse.ok) {
      console.error('Payment order creation failed:', await insertResponse.text())
      return NextResponse.json({ error: 'Could not create payment order.' }, { status: 502 })
    }

    if (paymentMethod === 'baridimob') return NextResponse.json({ success: true, reference, amount: displayAmount, currency: displayCurrency, paymentMethod, requiresProof: true, baridimob: { ccp: BARIDIMOB_CCP || null, rip: BARIDIMOB_RIP || null, accountName: BARIDIMOB_ACCOUNT_NAME || null } }, { status: 201 })

    if (!REDOTPAY_PERSONAL_PAYMENT_URL && !REDOTPAY_WALLET_ADDRESS) return NextResponse.json({ error: 'Personal RedotPay payment link or wallet address is not configured yet.', reference }, { status: 503 })

    let paymentUrl: string | null = null
    if (REDOTPAY_PERSONAL_PAYMENT_URL) {
      const url = new URL(REDOTPAY_PERSONAL_PAYMENT_URL)
      url.searchParams.set('reference', reference)
      url.searchParams.set('email', customerEmail)
      url.searchParams.set('amount', String(pricing.amount))
      paymentUrl = url.toString()
    }

    return NextResponse.json({ success: true, reference, amount: pricing.amount, currency: 'USD', paymentMethod, paymentUrl, walletAddress: REDOTPAY_WALLET_ADDRESS || null, requiresProof: true }, { status: 201 })
  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json({ error: 'Unexpected payment error.' }, { status: 500 })
  }
}
