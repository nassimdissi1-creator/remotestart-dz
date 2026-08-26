import { NextResponse } from 'next/server'
import { answerTelegramCallback, editTelegramMessage, getTelegramConfig } from '@/lib/telegram-payments'
import {
  fulfillPayment,
  fulfillPaymentById,
  rejectPayment,
  rejectPaymentById,
} from '@/lib/payment-fulfillment'

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: Request) {
  const { webhookSecret } = getTelegramConfig()
  const incomingSecret = request.headers.get('x-telegram-bot-api-secret-token')

  if (!webhookSecret || incomingSecret !== webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const update = await request.json()
    const callback = update?.callback_query
    const callbackData = typeof callback?.data === 'string' ? callback.data : ''

    // Supported callback formats:
    //   approve:<reference> / reject:<reference>
    //   approve:<payment_order_uuid> / reject:<payment_order_uuid>
    //   pay:approve:<reference> / pay:reject:<reference>
    //   pay:approve:<payment_order_uuid> / pay:reject:<payment_order_uuid>
    //   pay:approve:id:<payment_order_uuid> / pay:reject:id:<payment_order_uuid>
    //   pay:approve:ref:<reference> / pay:reject:ref:<reference>
    // The UUID compatibility forms are intentional: older Pipedream-generated
    // Telegram messages used the payment_order UUID directly in callback_data.
    const parts = callbackData.split(':')
    let action = ''
    let targetType: 'reference' | 'id' = 'reference'
    let target = ''

    if (parts.length === 2 && ['approve', 'reject'].includes(parts[0])) {
      action = parts[0]
      target = parts[1]
      if (isUuid(target)) targetType = 'id'
    } else if (parts.length === 3 && parts[0] === 'pay' && ['approve', 'reject'].includes(parts[1])) {
      action = parts[1]
      target = parts[2]
      if (isUuid(target)) targetType = 'id'
    } else if (
      parts.length === 4 &&
      parts[0] === 'pay' &&
      ['approve', 'reject'].includes(parts[1]) &&
      ['id', 'ref'].includes(parts[2])
    ) {
      action = parts[1]
      targetType = parts[2] === 'id' ? 'id' : 'reference'
      target = parts[3]
    } else {
      return NextResponse.json({ ok: true })
    }

    if (!target || target.length > 200) return NextResponse.json({ ok: true })

    const verifiedBy = callback.from?.username
      ? `telegram:${callback.from.username}`
      : `telegram:${callback.from?.id ?? 'admin'}`

    if (action === 'approve') {
      if (targetType === 'id') await fulfillPaymentById(target, verifiedBy)
      else await fulfillPayment(target, verifiedBy)
      await answerTelegramCallback(callback.id, 'Payment approved and access unlocked.')
    } else {
      if (targetType === 'id') await rejectPaymentById(target, verifiedBy)
      else await rejectPayment(target, verifiedBy)
      await answerTelegramCallback(callback.id, 'Payment rejected.')
    }

    if (callback.message?.chat?.id && callback.message?.message_id) {
      const actionText = action === 'approve' ? '✅ APPROVED' : '❌ REJECTED'
      await editTelegramMessage(
        callback.message.chat.id,
        callback.message.message_id,
        `${callback.message.text || 'RemoteStart-DZ payment'}\n\n${actionText} by ${verifiedBy}`,
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram payment approval failed:', error)
    return NextResponse.json({ error: 'Approval failed.' }, { status: 500 })
  }
}
