import { NextResponse } from 'next/server'
import { answerTelegramCallback, editTelegramMessage, getTelegramConfig } from '@/lib/telegram-payments'
import {
  fulfillPayment,
  fulfillPaymentById,
  rejectPayment,
  rejectPaymentById,
} from '@/lib/payment-fulfillment'

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

    // Supported formats:
    //   approve:<reference> / reject:<reference>
    //   pay:approve:<reference> / pay:reject:<reference>
    //   pay:approve:id:<payment_order_uuid> / pay:reject:id:<payment_order_uuid>
    const parts = callbackData.split(':')
    let action = ''
    let targetType: 'reference' | 'id' = 'reference'
    let target = ''

    if (parts.length === 2 && ['approve', 'reject'].includes(parts[0])) {
      action = parts[0]
      target = parts[1]
    } else if (parts.length === 3 && parts[0] === 'pay' && ['approve', 'reject'].includes(parts[1])) {
      action = parts[1]
      target = parts[2]
    } else if (
      parts.length === 4 &&
      parts[0] === 'pay' &&
      ['approve', 'reject'].includes(parts[1]) &&
      parts[2] === 'id'
    ) {
      action = parts[1]
      targetType = 'id'
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
