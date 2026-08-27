import { NextResponse } from 'next/server'

const ADMIN_SECRET = process.env.ADMIN_DASHBOARD_SECRET
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

function authorized(request: Request) {
  return Boolean(
    ADMIN_SECRET &&
      request.headers
        .get('cookie')
        ?.split(';')
        .some((item) => item.trim() === `rsdz_admin=${ADMIN_SECRET}`),
  )
}

async function setupWebhook(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Telegram configuration is incomplete.' }, { status: 500 })
  }

  // Always bind Telegram to the exact origin used to invoke this protected
  // endpoint. This prevents a stale NEXT_PUBLIC_SITE_URL from leaving the bot
  // pointed at an old Vercel deployment.
  const requestOrigin = new URL(request.url).origin
  const webhookUrl = `${requestOrigin}/api/payments/telegram/webhook`

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['callback_query'],
      drop_pending_updates: false,
    }),
    cache: 'no-store',
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok || !result?.ok) {
    console.error('Telegram webhook setup failed:', result)
    return NextResponse.json({ error: 'Telegram webhook setup failed.' }, { status: 502 })
  }

  return NextResponse.json({ success: true, webhookUrl })
}

export async function GET(request: Request) {
  return setupWebhook(request)
}

export async function POST(request: Request) {
  return setupWebhook(request)
}
