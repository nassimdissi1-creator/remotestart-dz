import { NextResponse } from 'next/server'
import { fulfillPayment, rejectPayment } from '@/lib/payment-fulfillment'

const ADMIN_SECRET = process.env.ADMIN_DASHBOARD_SECRET

function authorized(request: Request) {
  return Boolean(
    ADMIN_SECRET &&
      request.headers
        .get('cookie')
        ?.split(';')
        .some((item) => item.trim() === `rsdz_admin=${ADMIN_SECRET}`),
  )
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const reference = String(body.reference ?? '').trim()
  const decision = body.decision === 'reject' ? 'reject' : 'approve'

  if (!reference) {
    return NextResponse.json({ error: 'Payment reference is required.' }, { status: 400 })
  }

  try {
    if (decision === 'reject') {
      const result = await rejectPayment(reference, 'admin')
      return NextResponse.json({ success: true, status: 'rejected', ...result })
    }

    // Never mark the order paid here directly. fulfillPayment is the single
    // canonical path that atomically activates Talent Pro or publishes a job.
    const result = await fulfillPayment(reference, 'admin')

    return NextResponse.json({
      success: true,
      status: 'paid',
      alreadyPaid: result.alreadyPaid,
      reference,
      productCode: result.order?.product_code || null,
      talentProActivation: result.talentProActivation || null,
    })
  } catch (error) {
    console.error('Admin payment decision failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not process payment decision.' },
      { status: 502 },
    )
  }
}
