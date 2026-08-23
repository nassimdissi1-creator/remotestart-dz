import { NextResponse } from 'next/server'
import { PRICING } from '@/lib/monetization'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 500 })
    const body = await request.json()
    const companyName = String(body.company_name ?? '').trim()
    const jobTitle = String(body.job_title ?? '').trim()
    const salary = String(body.salary ?? '').trim()
    const description = String(body.description ?? '').trim()
    const contactEmail = String(body.contact_email ?? '').trim().toLowerCase()
    const plan = body.plan === 'featured' ? 'featured' : 'standard'

    if (companyName.length < 2 || jobTitle.length < 2 || description.length < 20 || !/^\S+@\S+\.\S+$/.test(contactEmail)) {
      return NextResponse.json({ error: 'Please provide valid job and contact details.' }, { status: 400 })
    }

    const product = plan === 'featured' ? 'job_featured' : 'job_standard'
    const price = PRICING[product].amount
    const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' }
    const reference = `RSDZ-${product.toUpperCase()}-${crypto.randomUUID()}`

    const jobResponse = await fetch(`${SUPABASE_URL}/rest/v1/job_opportunities`, {
      method: 'POST', headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ company_name: companyName, job_title: jobTitle, salary: salary || null, description, contact_email: contactEmail, plan, price_usd: price }),
    })
    if (!jobResponse.ok) return NextResponse.json({ error: 'Could not create job draft.' }, { status: 502 })
    const job = (await jobResponse.json())[0]

    const orderResponse = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders`, {
      method: 'POST', headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ reference, customer_type: 'employer', customer_email: contactEmail, product_code: product, amount_usd: price, payment_method: 'redotpay', metadata: { job_id: job.id } }),
    })
    if (!orderResponse.ok) return NextResponse.json({ error: 'Job created but payment order could not be created.' }, { status: 502 })
    const order = (await orderResponse.json())[0]

    const baseUrl = plan === 'featured' ? process.env.REDOTPAY_JOB_FEATURED_URL : process.env.REDOTPAY_JOB_STANDARD_URL
    if (!baseUrl) return NextResponse.json({ error: 'RedotPay checkout is not configured.', jobId: job.id, reference }, { status: 503 })
    const checkoutUrl = new URL(baseUrl)
    checkoutUrl.searchParams.set('reference', reference)
    checkoutUrl.searchParams.set('email', contactEmail)

    return NextResponse.json({ success: true, jobId: job.id, orderId: order.id, reference, checkoutUrl: checkoutUrl.toString() }, { status: 201 })
  } catch (error) {
    console.error('Job creation error:', error)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
