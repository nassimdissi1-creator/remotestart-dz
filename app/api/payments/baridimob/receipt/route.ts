import { NextResponse } from 'next/server'
import { notifyPendingPayment } from '@/lib/payment-fulfillment'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'payment-receipts'

function supabaseHeaders() {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' }
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Payment server configuration is incomplete.' }, { status: 500 })

    const form = await request.formData()
    const reference = String(form.get('reference') ?? '').trim()
    const file = form.get('receipt')
    if (!reference || !(file instanceof File)) return NextResponse.json({ error: 'Reference and receipt are required.' }, { status: 400 })
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Receipt must be smaller than 8MB.' }, { status: 400 })
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) return NextResponse.json({ error: 'Receipt must be JPG, PNG, WEBP or PDF.' }, { status: 400 })

    const path = `${new Date().getUTCFullYear()}/${reference}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST', headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': file.type, 'x-upsert': 'false' }, body: await file.arrayBuffer(),
    })
    if (!upload.ok) return NextResponse.json({ error: 'Could not upload receipt.' }, { status: 502 })

    const update = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?reference=eq.${encodeURIComponent(reference)}`, {
      method: 'PATCH', headers: { ...supabaseHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ receipt_path: path, status: 'pending_verification', proof_submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    })
    if (!update.ok) return NextResponse.json({ error: 'Receipt uploaded but order update failed.' }, { status: 502 })

    const rows = await update.json()
    const order = rows?.[0]
    if (order) await notifyPendingPayment(order)

    return NextResponse.json({ success: true, status: 'pending_verification', notifiedAdmin: Boolean(order) }, { status: 201 })
  } catch (error) {
    console.error('BaridiMob receipt error:', error)
    return NextResponse.json({ error: 'Unexpected receipt error.' }, { status: 500 })
  }
}
