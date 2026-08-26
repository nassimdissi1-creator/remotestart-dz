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

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Telegram configuration is incomplete.' }, { status: 500 })
  }

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  const requestOrigin = new URL(request.url).origin
  const siteUrl = configuredSiteUrl || requestOrigin
  const webhookUrl = `${siteUrl}/api/payments/telegram/webhook`

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
