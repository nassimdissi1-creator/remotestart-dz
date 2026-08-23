import { NextResponse } from 'next/server'
import { PRICING } from '@/lib/monetization'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const REDOTPAY_PERSONAL_PAYMENT_URL = process.env.REDOTPAY_PERSONAL_PAYMENT_URL
const REDOTPAY_WALLET_ADDRESS = process.env.REDOTPAY_WALLET_ADDRESS
const BARIDIMOB_CCP = process.env.BARIDIMOB_CCP
const BARIDIMOB_RIP = process.env.BARIDIMOB_RIP
const BARIDIMOB_ACCOUNT_NAME = process.env.BARIDIMOB_ACCOUNT_NAME
const PIPEDREAM_WEBHOOK_URL = 'https://eo5hriix8pk8n2d.m.pipedream.net'

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
  try {
    const response = await fetch(PIPEDREAM_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'RemoteStart-DZ',
        event: 'employer_job_submission',
        submitted_at: new Date().toISOString(),
        company: {
          name: data.companyName,
          email: data.contactEmail,
        },
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
      console.error('Pipedream webhook failed:', response.status, await response.text().catch(() => ''))
    }
  } catch (error) {
    console.error('Pipedream webhook error:', error)
  }
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 500 })
    const body = await request.json()
    const companyName = String(body.company_name ?? '').trim(), jobTitle = String(body.job_title ?? '').trim(), salary = String(body.salary ?? '').trim(), description = String(body.description ?? '').trim(), contactEmail = String(body.contact_email ?? '').trim().toLowerCase()
    const plan = body.plan === 'featured' ? 'featured' : 'standard'
    const paymentMethod = body.payment_method === 'baridimob' ? 'baridimob' : 'redotpay'
    if (companyName.length < 2 || jobTitle.length < 2 || description.length < 20 || !/^\S+@\S+\.\S+$/.test(contactEmail)) return NextResponse.json({ error: 'Please provide valid job and contact details.' }, { status: 400 })

    const product = plan === 'featured' ? 'job_featured' : 'job_standard', price = PRICING[product].amount
    const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' }
    const reference = `RSDZ-${product.toUpperCase()}-${crypto.randomUUID()}`
    const jobResponse = await fetch(`${SUPABASE_URL}/rest/v1/job_opportunities`, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ company_name: companyName, job_title: jobTitle, salary: salary || null, description, contact_email: contactEmail, plan, price_usd: price }) })
    if (!jobResponse.ok) return NextResponse.json({ error: 'Could not create job draft.' }, { status: 502 })
    const job = (await jobResponse.json())[0]
    const orderResponse = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders`, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ reference, customer_type: 'employer', customer_email: contactEmail, product_code: product, amount_usd: price, payment_method: paymentMethod, metadata: { job_id: job.id } }) })
    if (!orderResponse.ok) return NextResponse.json({ error: 'Job created but payment order could not be created.' }, { status: 502 })
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

    if (paymentMethod === 'baridimob') return NextResponse.json({ success: true, jobId: job.id, orderId: order.id, reference, amount: price, paymentMethod, requiresProof: true, baridimob: { ccp: BARIDIMOB_CCP || null, rip: BARIDIMOB_RIP || null, accountName: BARIDIMOB_ACCOUNT_NAME || null } }, { status: 201 })
    if (!REDOTPAY_PERSONAL_PAYMENT_URL && !REDOTPAY_WALLET_ADDRESS) return NextResponse.json({ error: 'Personal RedotPay payment link or wallet address is not configured.', jobId: job.id, reference }, { status: 503 })
    let paymentUrl: string | null = null
    if (REDOTPAY_PERSONAL_PAYMENT_URL) { const url = new URL(REDOTPAY_PERSONAL_PAYMENT_URL); url.searchParams.set('reference', reference); url.searchParams.set('email', contactEmail); url.searchParams.set('amount', String(price)); paymentUrl = url.toString() }
    return NextResponse.json({ success: true, jobId: job.id, orderId: order.id, reference, amount: price, paymentMethod, paymentUrl, walletAddress: REDOTPAY_WALLET_ADDRESS || null, requiresProof: true }, { status: 201 })
  } catch (error) { console.error('Job creation error:', error); return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 }) }
}
