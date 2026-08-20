// إعدادات الاتصال بقاعدة بيانات Supabase (المفتاح publishable آمن للاستخدام من جهة العميل)
const SUPABASE_REST_URL = 'https://ooskmzbwolukflnxfhzg.supabase.co/rest/v1'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable__oHvQA9VpoE9rQ6pTDbG0A_CCNlS3tg'

const TABLE = 'waitlist'
const EMAIL_COLUMN = 'Email'

export type JoinResult =
  | { ok: true }
  | { ok: false; reason: 'duplicate' | 'invalid' | 'error' }

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function joinWaitlist(email: string): Promise<JoinResult> {
  const trimmed = email.trim().toLowerCase()

  if (!isValidEmail(trimmed)) {
    return { ok: false, reason: 'invalid' }
  }

  try {
    const res = await fetch(`${SUPABASE_REST_URL}/${TABLE}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ [EMAIL_COLUMN]: trimmed }),
    })

    if (res.ok) {
      return { ok: true }
    }

    // 409 = تعارض (البريد مسجّل مسبقاً)
    if (res.status === 409) {
      return { ok: false, reason: 'duplicate' }
    }

    const message = await res.text()
    console.log('[v0] Supabase waitlist error:', res.status, message)

    if (message.includes('duplicate') || message.includes('unique')) {
      return { ok: false, reason: 'duplicate' }
    }

    return { ok: false, reason: 'error' }
  } catch (err) {
    console.log('[v0] Supabase waitlist request failed:', err)
    return { ok: false, reason: 'error' }
  }
}
