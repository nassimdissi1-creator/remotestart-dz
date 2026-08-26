const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

export function getTelegramConfig() {
  return {
    botToken: TELEGRAM_BOT_TOKEN,
    chatId: TELEGRAM_CHAT_ID,
    webhookSecret: TELEGRAM_WEBHOOK_SECRET,
  }
}

export async function sendPaymentApprovalNotification(input: {
  reference: string
  product: string
  amount: number
  currency?: string
  paymentMethod: string
  customerEmail: string
  transactionHash?: string | null
  receiptPath?: string | null
}) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('Telegram payment notifications are not configured.')
    return false
  }

  const proof = input.transactionHash
    ? `TX: ${input.transactionHash}`
    : input.receiptPath
      ? `Receipt: ${input.receiptPath}`
      : 'Proof submitted'

  const currency = input.currency || 'USD'
  const text = [
    '🔔 RemoteStart-DZ — Payment verification',
    '',
    `Product: ${input.product}`,
    `Amount: ${input.amount.toLocaleString()} ${currency}`,
    `Method: ${input.paymentMethod}`,
    `Email: ${input.customerEmail}`,
    `Reference: ${input.reference}`,
    proof,
    '',
    'Choose an action below:',
  ].join('\n')

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Approve', callback_data: `pay:approve:${input.reference}` },
          { text: '❌ Reject', callback_data: `pay:reject:${input.reference}` },
        ]],
      },
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    console.error('Telegram notification failed:', response.status, await response.text())
    return false
  }
  return true
}

export async function answerTelegramCallback(callbackQueryId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
    cache: 'no-store',
  })
}

export async function editTelegramMessage(chatId: number | string, messageId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text }),
    cache: 'no-store',
  })
}