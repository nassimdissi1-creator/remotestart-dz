import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { PRICING } from '@/lib/monetization'
import { createRedotPayOrder, redotPayConfigured } from '@/lib/redotpay'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BARIDIMOB_CCP = process.env.BARIDIMOB_CCP
const BARIDIMOB_RIP = process.env.BARIDIMOB_RIP
const BARIDIMOB_ACCOUNT_NAME = process.env.BARIDIMOB_ACCOUNT_NAME
const PIPEDREAM_WEBHOOK_URL = process.env.PIPEDREAM_EMPLOYER_WEBHOOK_URL || ''

function supabaseHeaders() {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase service role is not configured')
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

async function sendEmployerSubmissionToPipedream(data: {
  companyName: string
  contactEmail: string
  jobTitle: string
  salary: string
  description: string
  plan: string
  paymentMethod: string
  jobId: string
  orderId: string
  reference: string
  amount: number
}) {
  if (!PIPEDREAM_WEBHOOK_URL) return

  try {
    const response = await fetch(PIPEDREAM_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'RemoteStart-DZ',
        event: 'employer_job_submission',
        submitted_at: new Date().toISOString(),
        company: { name: data.companyName, email: data.contactEmail },
        job: {
          title: data.jobTitle,
          salary: data.salary || null,
          description: data.description,
          plan: data.plan,
        },
        payment: {
          method: data.paymentMethod,
          amount_usd: data.amount,
          reference: data.reference,
          job_id: data.jobId,
          order_id: data.orderId,
        },
      }),
    })

    if (!response.ok) {
      console.error('Pipedream webhook failed:', response.status)
    }
  } catch (error) {
    console.error('Pipedream webhook error:', error)
  }
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 500 })
    }

    const body = await request.json()
    const companyName = String(body.company_name ?? '').trim()
    const jobTitle = String(body.job_title ?? '').trim()
    const salary = String(body.salary ?? '').trim()
    const description = String(body.description ?? '').trim()
    const contactEmail = String(body.contact_email ?? '').trim().toLowerCase()
    const plan = body.plan === 'featured' ? 'featured' : 'standard'
    const paymentMethod = body.payment_method === 'baridimob' ? 'baridimob' : 'redotpay'

    if (
      companyName.length < 2 ||
      jobTitle.length < 2 ||
      description.length < 20 ||
      !/^\S+@\S+\.\S+$/.test(contactEmail)
    ) {
      return NextResponse.json({ error: 'Please provide valid job and contact details.' }, { status: 400 })
    }

    const product = plan === 'featured' ? 'job_featured' : 'job_standard'
    const price = PRICING[product].amount
    const headers = supabaseHeaders()
    const reference = `RSDZ-${product.toUpperCase()}-${crypto.randomUUID()}`

    const jobResponse = await fetch(`${SUPABASE_URL}/rest/v1/job_opportunities`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        company_name: companyName,
        job_title: jobTitle,
        salary: salary || null,
        description,
        contact_email: contactEmail,
        plan,
        price_usd: price,
      }),
    })

    if (!jobResponse.ok) {
      return NextResponse.json({ error: 'Could not create job draft.' }, { status: 502 })
    }

    const job = (await jobResponse.json())[0]

    const orderResponse = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        reference,
        customer_type: 'employer',
        customer_email: contactEmail,
        product_code: product,
        amount_usd: price,
        payment_method: paymentMethod,
        metadata: { job_id: job.id, plan, currency: 'USD' },
      }),
    })

    if (!orderResponse.ok) {
      return NextResponse.json({ error: 'Job created but payment order could not be created.' }, { status: 502 })
    }

    const order = (await orderResponse.json())[0]

    await sendEmployerSubmissionToPipedream({
      companyName,
      contactEmail,
      jobTitle,
      salary,
      description,
      plan,
      paymentMethod,
      jobId: job.id,
      orderId: order.id,
      reference,
      amount: price,
    })

    if (paymentMethod === 'baridimob') {
      return NextResponse.json({
        success: true,
        jobId: job.id,
        orderId: order.id,
        reference,
        amount: price,
        currency: 'USD',
        paymentMethod,
        requiresProof: true,
        baridimob: {
          ccp: BARIDIMOB_CCP || null,
          rip: BARIDIMOB_RIP || null,
          accountName: BARIDIMOB_ACCOUNT_NAME || null,
        },
      }, { status: 201 })
    }

    if (!redotPayConfigured()) {
      return NextResponse.json({
        error: 'RedotPay Connect is not configured on the server.',
        jobId: job.id,
        orderId: order.id,
        reference,
      }, { status: 503 })
    }

    const redotOrder = await createRedotPayOrder({
      reference,
      customerId: job.id,
      amount: price,
      description: `${PRICING[product].name} — RemoteStart-DZ`,
      goodsName: PRICING[product].name,
      redirectUrl: `${new URL(request.url).origin}/?payment=complete&reference=${encodeURIComponent(reference)}`,
    })

    await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?id=eq.${encodeURIComponent(order.id)}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        metadata: {
          job_id: job.id,
          plan,
          currency: 'USD',
          redotpay_order_sn: redotOrder.orderSn || null,
        },
      }),
    })

    return NextResponse.json({
      success: true,
      jobId: job.id,
      orderId: order.id,
      reference,
      amount: price,
      currency: 'USD',
      paymentMethod,
      paymentUrl: redotOrder.webUrl || redotOrder.h5Url || null,
      redotpayOrderSn: redotOrder.orderSn || null,
      requiresProof: false,
    }, { status: 201 })
  } catch (error) {
    console.error('Job creation error:', error)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
