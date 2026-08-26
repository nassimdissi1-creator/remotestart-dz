import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { PRICING } from '@/lib/monetization'
import { createRedotPayOrder, redotPayConfigured } from '@/lib/redotpay'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BARIDIMOB_CCP = process.env.BARIDIMOB_CCP
const BARIDIMOB_RIP = process.env.BARIDIMOB_RIP
const BARIDIMOB_ACCOUNT_NAME = process.env.BARIDIMOB_ACCOUNT_NAME

function supabaseHeaders() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service role is not configured')
  }

  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

export async function POST(request: Request) {
  let createdOrderId: string | null = null
  let createdJobId: string | null = null

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration is incomplete.' },
        { status: 500 },
      )
    }

    const body = await request.json()

    const companyName = String(body.company_name ?? '').trim()
    const jobTitle = String(body.job_title ?? '').trim()
    const salary = String(body.salary ?? '').trim()
    const description = String(body.description ?? '').trim()
    const contactEmail = String(body.contact_email ?? '')
      .trim()
      .toLowerCase()

    const plan = body.plan === 'featured' ? 'featured' : 'standard'
    const paymentMethod =
      body.payment_method === 'baridimob' ? 'baridimob' : 'redotpay'

    if (
      companyName.length < 2 ||
      jobTitle.length < 2 ||
      description.length < 20 ||
      !/^\S+@\S+\.\S+$/.test(contactEmail)
    ) {
      return NextResponse.json(
        { error: 'Please provide valid job and contact details.' },
        { status: 400 },
      )
    }

    // Product and price are selected exclusively on the server.
    const product = plan === 'featured' ? 'job_featured' : 'job_standard'
    const price = PRICING[product].amount

    const headers = supabaseHeaders()
    const reference = `RSDZ-${product.toUpperCase()}-${crypto.randomUUID()}`

    /*
     * STEP 1:
     * Create the payment order first.
     *
     * This gives us a real payment_order.id that can be stored
     * directly in job_opportunities.payment_order_id.
     */
    const orderResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/payment_orders`,
      {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          reference,
          customer_type: 'employer',
          customer_email: contactEmail,
          product_code: product,
          amount_usd: price,
          payment_method: paymentMethod,
          metadata: {
            plan,
            currency: 'USD',
          },
        }),
        cache: 'no-store',
      },
    )

    if (!orderResponse.ok) {
      return NextResponse.json(
        { error: 'Could not create payment order.' },
        { status: 502 },
      )
    }

    const orders = await orderResponse.json()
    const order = orders?.[0]

    if (!order?.id) {
      throw new Error('Payment order was created without an id')
    }

    createdOrderId = order.id

    /*
     * STEP 2:
     * Create the job and establish the real database relationship.
     *
     * This is the important security fix:
     *
     * job_opportunities.payment_order_id
     *          ↓
     * payment_orders.id
     */
    const jobResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/job_opportunities`,
      {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          company_name: companyName,
          job_title: jobTitle,
          salary: salary || null,
          description,
          contact_email: contactEmail,
          plan,
          price_usd: price,
          payment_order_id: order.id,
        }),
        cache: 'no-store',
      },
    )

    if (!jobResponse.ok) {
      const jobError = await jobResponse.text()

      // Roll back the payment order because its job could not be created.
      await fetch(
        `${SUPABASE_URL}/rest/v1/payment_orders?id=eq.${encodeURIComponent(order.id)}`,
        {
          method: 'DELETE',
          headers,
          cache: 'no-store',
        },
      ).catch((rollbackError) => {
        console.error(
          'Payment order rollback failed:',
          rollbackError,
        )
      })

      return NextResponse.json(
        {
          error: 'Could not create job draft.',
          details: jobError,
        },
        { status: 502 },
      )
    }

    const jobs = await jobResponse.json()
    const job = jobs?.[0]

    if (!job?.id) {
      throw new Error('Job was created without an id')
    }

    createdJobId = job.id

    /*
     * STEP 3:
     * Keep job_id in metadata for compatibility with the current
     * payment flow.
     *
     * The database Foreign Key above is now the authoritative link.
     */
    const metadataResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/payment_orders?id=eq.${encodeURIComponent(order.id)}`,
      {
        method: 'PATCH',
        headers: {
          ...headers,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          metadata: {
            job_id: job.id,
            plan,
            currency: 'USD',
          },
        }),
        cache: 'no-store',
      },
    )

    if (!metadataResponse.ok) {
      const metadataError = await metadataResponse.text()

      /*
       * Roll back both records if we cannot complete the
       * payment/job initialization consistently.
       */
      await fetch(
        `${SUPABASE_URL}/rest/v1/job_opportunities?id=eq.${encodeURIComponent(job.id)}`,
        {
          method: 'DELETE',
          headers,
          cache: 'no-store',
        },
      ).catch((rollbackError) => {
        console.error(
          'Job rollback failed:',
          rollbackError,
        )
      })

      await fetch(
        `${SUPABASE_URL}/rest/v1/payment_orders?id=eq.${encodeURIComponent(order.id)}`,
        {
          method: 'DELETE',
          headers,
          cache: 'no-store',
        },
      ).catch((rollbackError) => {
        console.error(
          'Payment order rollback failed:',
          rollbackError,
        )
      })

      return NextResponse.json(
        {
          error: 'Could not finalize job payment setup.',
          details: metadataError,
        },
        { status: 502 },
      )
    }

    /*
     * STEP 4:
     * Only after the database relationship is established do we
     * create the external RedotPay order.
     */
    if (paymentMethod === 'baridimob') {
      return NextResponse.json(
        {
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
        },
        { status: 201 },
      )
    }

    if (!redotPayConfigured()) {
      return NextResponse.json(
        {
          error: 'RedotPay Connect is not configured on the server.',
          jobId: job.id,
          orderId: order.id,
          reference,
        },
        { status: 503 },
      )
    }

    const redotOrder = await createRedotPayOrder({
      reference,
      customerId: job.id,
      amount: price,
      description: `${PRICING[product].name} — RemoteStart-DZ`,
      goodsName: PRICING[product].name,
      redirectUrl: `${new URL(request.url).origin}/?payment=complete&reference=${encodeURIComponent(reference)}`,
    })

    /*
     * Store the external RedotPay order reference while preserving
     * the authoritative job/payment relationship.
     */
    const redotMetadataResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/payment_orders?id=eq.${encodeURIComponent(order.id)}`,
      {
        method: 'PATCH',
        headers: {
          ...headers,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          metadata: {
            job_id: job.id,
            plan,
            currency: 'USD',
            redotpay_order_sn: redotOrder.orderSn || null,
          },
        }),
        cache: 'no-store',
      },
    )

    if (!redotMetadataResponse.ok) {
      console.error(
        'Failed to store RedotPay order metadata:',
        await redotMetadataResponse.text(),
      )

      /*
       * Do not delete the payment/job records here because an external
       * RedotPay order may already exist. The authoritative relationship
       * between the payment order and job has already been established.
       */
      return NextResponse.json(
        {
          error:
            'Payment was initialized, but the RedotPay order metadata could not be saved.',
          jobId: job.id,
          orderId: order.id,
          reference,
        },
        { status: 502 },
      )
    }

    return NextResponse.json(
      {
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
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Job creation error:', error)

    /*
     * Best-effort rollback for failures that happen before an external
     * RedotPay order is created.
     */
    if (createdJobId) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/job_opportunities?id=eq.${encodeURIComponent(createdJobId)}`,
        {
          method: 'DELETE',
          headers: supabaseHeaders(),
          cache: 'no-store',
        },
      ).catch((rollbackError) => {
        console.error('Job rollback failed:', rollbackError)
      })
    }

    if (createdOrderId) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/payment_orders?id=eq.${encodeURIComponent(createdOrderId)}`,
        {
          method: 'DELETE',
          headers: supabaseHeaders(),
          cache: 'no-store',
        },
      ).catch((rollbackError) => {
        console.error(
          'Payment order rollback failed:',
          rollbackError,
        )
      })
    }

    return NextResponse.json(
      { error: 'Unexpected server error.' },
      { status: 500 },
    )
  }
}
