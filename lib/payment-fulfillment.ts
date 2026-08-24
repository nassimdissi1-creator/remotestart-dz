import { sendPaymentApprovalNotification } from '@/lib/telegram-payments'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function headers() {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

async function patch(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: 'PATCH',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Supabase update failed: ${response.status} ${await response.text()}`)
}

async function activateTalentPro(order: any, talentId: string, verifiedBy: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/activate_talent_pro`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      p_talent_id: talentId,
      p_reference: order.reference,
      p_provider: order.payment_method,
      p_provider_payment_id: order.provider_payment_id || order.transaction_hash || null,
      p_period_start: new Date().toISOString(),
      p_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      p_metadata: {
        fulfillment_source: verifiedBy,
        payment_method: order.payment_method,
      },
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Talent Pro activation failed: ${response.status} ${await response.text()}`)
  }

  const result = await response.json()
  return Array.isArray(result) ? result[0] : result
}

export async function fulfillPayment(reference: string, verifiedBy = 'telegram-admin') {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase configuration is incomplete')

  const orderResponse = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?reference=eq.${encodeURIComponent(reference)}&select=*`, {
    headers: headers(),
    cache: 'no-store',
  })
  if (!orderResponse.ok) throw new Error(`Could not load payment order: ${orderResponse.status}`)

  const orders = await orderResponse.json()
  const order = orders?.[0]
  if (!order) throw new Error('Payment order not found')
  if (order.status === 'paid') return { alreadyPaid: true, order }

  const metadata = order.metadata && typeof order.metadata === 'object' ? order.metadata : {}
  const talentId = metadata.talent_id || metadata.talentId || order.customer_id
  const jobId = metadata.job_id || metadata.jobId

  let talentProActivation: any = null

  if (order.product_code === 'talent_pro') {
    if (!talentId) throw new Error('Talent Pro payment has no talent_id')
    talentProActivation = await activateTalentPro(order, String(talentId), verifiedBy)
  }

  if (order.product_code === 'ai_cv_review' && talentId) {
    const talentResponse = await fetch(`${SUPABASE_URL}/rest/v1/talents?id=eq.${encodeURIComponent(String(talentId))}&select=ai_cv_reviews_remaining`, {
      headers: headers(),
      cache: 'no-store',
    })
    if (!talentResponse.ok) throw new Error(`Could not load talent AI review balance: ${talentResponse.status}`)

    const talentRows = await talentResponse.json()
    const current = Number(talentRows?.[0]?.ai_cv_reviews_remaining ?? 0)

    await patch(`/rest/v1/talents?id=eq.${encodeURIComponent(String(talentId))}`, {
      ai_cv_reviews_remaining: current + 1,
    })
  }

  if ((order.product_code === 'job_standard' || order.product_code === 'job_featured') && jobId) {
    await patch(`/rest/v1/job_opportunities?id=eq.${encodeURIComponent(String(jobId))}`, {
      payment_status: 'paid',
      published: true,
      featured: order.product_code === 'job_featured',
      published_at: new Date().toISOString(),
    })
  }

  // Talent Pro is already marked paid atomically by activate_talent_pro().
  // Other products keep the existing fulfillment path unchanged.
  if (order.product_code !== 'talent_pro') {
    await patch(`/rest/v1/payment_orders?reference=eq.${encodeURIComponent(reference)}`, {
      status: 'paid',
      paid_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      verified_by: verifiedBy,
    })
  }

  return {
    alreadyPaid: false,
    order,
    talentProActivation,
  }
}

export async function rejectPayment(reference: string, verifiedBy = 'telegram-admin') {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase configuration is incomplete')
  await patch(`/rest/v1/payment_orders?reference=eq.${encodeURIComponent(reference)}`, {
    status: 'rejected',
    verified_at: new Date().toISOString(),
    verified_by: verifiedBy,
  })
  return { reference }
}

export async function notifyPendingPayment(order: any) {
  return sendPaymentApprovalNotification({
    reference: order.reference,
    product: order.product_code,
    amount: Number(order.amount_usd),
    paymentMethod: order.payment_method,
    customerEmail: order.customer_email,
    transactionHash: order.transaction_hash,
    receiptPath: order.receipt_path,
  })
}
