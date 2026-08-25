import crypto from 'node:crypto'

const REDOTPAY_APP_KEY = process.env.REDOTPAY_APP_KEY || ''
const REDOTPAY_PRIVATE_KEY = process.env.REDOTPAY_PRIVATE_KEY || ''
const REDOTPAY_KEY_VERSION = process.env.REDOTPAY_KEY_VERSION || '1'
const REDOTPAY_ENV = process.env.REDOTPAY_ENV === 'sandbox' ? 'sandbox' : 'production'
const REDOTPAY_API_BASE =
  process.env.REDOTPAY_API_BASE ||
  (REDOTPAY_ENV === 'sandbox'
    ? 'https://acquirersandbox.rp-2023app.com'
    : 'https://acquirer.redotpay.com')
const REDOTPAY_WEBHOOK_PUBLIC_KEY = process.env.REDOTPAY_WEBHOOK_PUBLIC_KEY || ''

export function redotPayConfigured() {
  return Boolean(REDOTPAY_APP_KEY && REDOTPAY_PRIVATE_KEY)
}

function compactJson(value: unknown) {
  return JSON.stringify(value)
}

function signRequest(httpMethod: string, httpUri: string, body: string) {
  if (!redotPayConfigured()) {
    throw new Error('RedotPay API credentials are not configured')
  }

  const timestamp = Date.now().toString()
  const stringToSign = `${httpMethod.toUpperCase()} ${httpUri}\n${REDOTPAY_APP_KEY}.${timestamp}.${body}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(stringToSign, 'utf8')

  return {
    timestamp,
    signature: signer.sign(REDOTPAY_PRIVATE_KEY).toString('base64'),
    keyVersion: REDOTPAY_KEY_VERSION,
  }
}

export async function createRedotPayOrder(input: {
  reference: string
  customerId: string
  amount: number
  description: string
  goodsName: string
  redirectUrl: string
}) {
  const path = '/openapi/v2/order/create'
  const bodyObject = {
    outerOrderSn: input.reference,
    outerUid: input.customerId,
    orderAmount: input.amount,
    orderCurrency: 'USD',
    timeExpire: Date.now() + 60 * 60 * 1000,
    env: 'WEB',
    orderDesc: input.description.slice(0, 126),
    goods: [
      {
        goodsName: input.goodsName,
        goodsAmount: input.amount,
        goodsCoin: 'USD',
      },
    ],
    redirectUrl: input.redirectUrl,
    merchantName: 'RemoteStart-DZ',
  }

  const body = compactJson(bodyObject)
  const signature = signRequest('POST', path, body)

  const response = await fetch(`${REDOTPAY_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-R-AK': REDOTPAY_APP_KEY,
      'X-R-Ts': signature.timestamp,
      'X-R-Key-Version': signature.keyVersion,
      'X-R-Signature': signature.signature,
    },
    body,
    cache: 'no-store',
  })

  const data = await response.json().catch(() => null)

  if (!response.ok || data?.code !== 'SUCCESS') {
    throw new Error(
      `RedotPay order creation failed: ${response.status} ${data?.msg || 'unknown error'}`,
    )
  }

  return data.data as {
    orderSn?: string
    outerOrderSn?: string
    webUrl?: string
    h5Url?: string
    appUrl?: string
  }
}

export function verifyRedotPayWebhook(input: {
  rawBody: string
  signature: string | null
  timestamp: string | null
  keyVersion: string | null
}) {
  if (!REDOTPAY_APP_KEY || !REDOTPAY_WEBHOOK_PUBLIC_KEY) return false
  if (!input.signature || !input.timestamp || !input.keyVersion) return false
  if (input.keyVersion !== '1') return false

  const timestampNumber = Number(input.timestamp)
  if (!Number.isFinite(timestampNumber)) return false

  // Reject stale callbacks to reduce replay risk. RedotPay itself signs
  // the callback, while our application also enforces a local freshness window.
  if (Math.abs(Date.now() - timestampNumber) > 5 * 60 * 1000) return false

  const stringToVerify = `${REDOTPAY_APP_KEY}.${input.timestamp}.${input.rawBody}`
  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(stringToVerify, 'utf8')

  try {
    return verifier.verify(
      REDOTPAY_WEBHOOK_PUBLIC_KEY,
      Buffer.from(input.signature, 'base64'),
    )
  } catch {
    return false
  }
}

export function redotPayAmountMatches(value: unknown, expected: number) {
  const amount = Number(value)
  return Number.isFinite(amount) && Math.abs(amount - expected) < 0.000001
}

export function redotPaySuccess(value: unknown) {
  return Number(value) === 2
}

export function redotPayProviderPaymentId(payload: Record<string, unknown>) {
  return typeof payload.txId === 'string' && payload.txId.trim()
    ? payload.txId.trim()
    : typeof payload.orderSn === 'string' && payload.orderSn.trim()
      ? payload.orderSn.trim()
      : null
}
