import { NextResponse } from 'next/server'
import { answerTelegramCallback, editTelegramMessage, getTelegramConfig } from '@/lib/telegram-payments'
import { fulfillPayment, rejectPayment } from '@/lib/payment-fulfillment'

export async function POST(request: Request) {
  const { webhookSecret } = getTelegramConfig()
  const incomingSecret = request.headers.get('x-telegram-bot-api-secret-token')

  if (!webhookSecret || incomingSecret !== webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const update = await request.json()
    const callback = update?.callback_query
    if (!callback?.data?.startsWith('pay:')) return NextResponse.json({ ok: true })

    const [, action, reference] = String(callback.data).split(':')
    if (!reference || !['approve', 'reject'].includes(action)) return NextResponse.json({ ok: true })

    const verifiedBy = callback.from?.username ? `telegram:${callback.from.username}` : `telegram:${callback.from?.id ?? 'admin'}`

    if (action === 'approve') {
      await fulfillPayment(reference, verifiedBy)
      await answerTelegramCallback(callback.id, 'Payment approved and access unlocked.')
    } else {
      await rejectPayment(reference, verifiedBy)
      await answerTelegramCallback(callback.id, 'Payment rejected.')
    }

    if (callback.message?.chat?.id && callback.message?.message_id) {
      const actionText = action === 'approve' ? '✅ APPROVED' : '❌ REJECTED'
      await editTelegramMessage(callback.message.chat.id, callback.message.message_id, `${callback.message.text || 'RemoteStart-DZ payment'}\n\n${actionText} by ${verifiedBy}`)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram payment approval failed:', error)
    return NextResponse.json({ error: 'Approval failed.' }, { status: 500 })
  }
}
