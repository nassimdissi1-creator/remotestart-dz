import { sendPaymentApprovalNotification } from '@/lib/telegram-payments'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function headers() {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' }
}

async function patch(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}${path}`, { method: 'PATCH', headers: { ...headers(), Prefer: 'return=minimal' }, body: JSON.stringify(body), cache: 'no-store' })
  if (!response.ok) throw new Error(`Supabase update failed: ${response.status} ${await response.text()}`)
}

async function activateTalentProFromPayment(order: any) {
  if (!order?.id) throw new Error('Talent Pro payment has no payment_order id')
  if (order.customer_type !== 'talent') throw new Error('Talent Pro payment has an invalid customer type')
  if (!order.customer_id) throw new Error('Talent Pro payment has no customer_id')

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/activate_talent_pro_from_payment`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      p_payment_order_id: order.id,
      p_provider_payment_id: order.provider_payment_id || order.transaction_hash || null,
      p_paid_at: new Date().toISOString(),
    }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Talent Pro activation failed: ${response.status} ${await response.text()}`)
  const result = await response.json()
  return Array.isArray(result) ? result[0] : result
}

export async function fulfillPayment(reference: string, verifiedBy = 'telegram-admin', providerPaymentId: string | null = null) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase configuration is incomplete')
  const cleanReference = String(reference || '').trim()
  if (!cleanReference) throw new Error('Payment reference is required')

  const orderResponse = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?reference=eq.${encodeURIComponent(cleanReference)}&select=*`, { headers: headers(), cache: 'no-store' })
  if (!orderResponse.ok) throw new Error(`Could not load payment order: ${orderResponse.status}`)
  const orders = await orderResponse.json()
  const order = orders?.[0]
  if (!order) throw new Error('Payment order not found')

  if (order.status === 'paid' && order.product_code === 'talent_pro') {
    const talentProActivation = await activateTalentProFromPayment(order)
    await patch(`/rest/v1/payment_orders?reference=eq.${encodeURIComponent(cleanReference)}`, {
      verified_by: verifiedBy,
      ...(providerPaymentId ? { provider_payment_id: providerPaymentId } : {}),
    })
    return { alreadyPaid: Boolean(talentProActivation?.idempotent), order, talentProActivation }
  }

  if (order.status === 'paid') return { alreadyPaid: true, order, talentProActivation: null }

  if (providerPaymentId) {
    await patch(`/rest/v1/payment_orders?reference=eq.${encodeURIComponent(cleanReference)}`, { provider_payment_id: providerPaymentId })
    order.provider_payment_id = providerPaymentId
  }

  const metadata = order.metadata && typeof order.metadata === 'object' ? order.metadata : {}
  const jobId = metadata.job_id || metadata.jobId
  let talentProActivation: any = null

  if (order.product_code === 'talent_pro') {
    talentProActivation = await activateTalentProFromPayment(order)
    await patch(`/rest/v1/payment_orders?reference=eq.${encodeURIComponent(cleanReference)}`, {
      verified_by: verifiedBy,
      ...(providerPaymentId ? { provider_payment_id: providerPaymentId } : {}),
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

  if (order.product_code !== 'talent_pro') {
    const now = new Date().toISOString()
    await patch(`/rest/v1/payment_orders?reference=eq.${encodeURIComponent(cleanReference)}`, {
      status: 'paid',
      paid_at: now,
      verified_at: now,
      verified_by: verifiedBy,
      ...(providerPaymentId ? { provider_payment_id: providerPaymentId } : {}),
    })
  }

  return { alreadyPaid: false, order, talentProActivation }
}

export async function rejectPayment(reference: string, verifiedBy = 'telegram-admin') {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase configuration is incomplete')
  const cleanReference = String(reference || '').trim()
  if (!cleanReference) throw new Error('Payment reference is required')
  await patch(`/rest/v1/payment_orders?reference=eq.${encodeURIComponent(cleanReference)}`, {
    status: 'rejected',
    verified_at: new Date().toISOString(),
    verified_by: verifiedBy,
  })
  return { reference: cleanReference }
}

async function getPaymentReferenceById(paymentOrderId: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase configuration is incomplete')
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/payment_orders?id=eq.${encodeURIComponent(paymentOrderId)}&select=reference`,
    { headers: headers(), cache: 'no-store' },
  )
  if (!response.ok) throw new Error(`Could not load payment order by id: ${response.status}`)
  const rows = await response.json()
  const reference = rows?.[0]?.reference
  if (!reference) throw new Error('Payment order not found')
  return String(reference)
}

export async function fulfillPaymentById(paymentOrderId: string, verifiedBy = 'telegram-admin') {
  const reference = await getPaymentReferenceById(paymentOrderId)
  return fulfillPayment(reference, verifiedBy)
}

export async function rejectPaymentById(paymentOrderId: string, verifiedBy = 'telegram-admin') {
  const reference = await getPaymentReferenceById(paymentOrderId)
  return rejectPayment(reference, verifiedBy)
}

export async function notifyPendingPayment(order: any) {
  const metadata = order.metadata && typeof order.metadata === 'object' ? order.metadata : {}
  const isLocalTalentPayment = order.product_code === 'talent_pro' && order.payment_method === 'baridimob'
  return sendPaymentApprovalNotification({
    reference: order.reference,
    paymentOrderId: order.id,
    product: order.product_code,
    amount: isLocalTalentPayment ? Number(metadata.local_amount || 8000) : Number(order.amount_usd),
    paymentMethod: order.payment_method,
    customerEmail: order.customer_email,
    transactionHash: order.transaction_hash,
    receiptPath: order.receipt_path,
  })
}
