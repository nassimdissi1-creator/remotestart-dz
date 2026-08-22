export type TalentPayload = {
  fullName: string
  email: string
  skills: string
  linkedin?: string | null
}

export type JoinResult =
  | {
      ok: true
      webhookDelivered: boolean
    }
  | {
      ok: false
      reason: 'duplicate' | 'invalid' | 'error'
    }

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function joinWaitlist(
  payload: TalentPayload
): Promise<JoinResult> {
  const fullName = payload.fullName.trim()
  const email = payload.email.trim().toLowerCase()
  const skills = payload.skills.trim()

  // LinkedIn is completely optional.
  // Empty string, whitespace, or null becomes null.
  const linkedin =
    typeof payload.linkedin === 'string' && payload.linkedin.trim().length > 0
      ? payload.linkedin.trim()
      : null

  // Validate only the required fields.
  if (
    fullName.length < 2 ||
    !isValidEmail(email) ||
    skills.length === 0
  ) {
    return {
      ok: false,
      reason: 'invalid',
    }
  }

  // Prevent the form from staying on "جارٍ التسجيل..." forever.
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, 15000)

  try {
    const response = await fetch('/api/talent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        full_name: fullName,
        email,
        skills,
        linkedin,
      }),
      signal: controller.signal,
    })

    const data = await response.json().catch(() => null)

    if (response.ok) {
      return {
        ok: true,
        webhookDelivered: Boolean(data?.webhookDelivered),
      }
    }

    if (response.status === 409) {
      return {
        ok: false,
        reason: 'duplicate',
      }
    }

    if (response.status === 400) {
      return {
        ok: false,
        reason: 'invalid',
      }
    }

    console.error('Talent signup error:', {
      status: response.status,
      data,
    })

    return {
      ok: false,
      reason: 'error',
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('Talent signup request timed out.')
    } else {
      console.error('Talent signup request failed:', error)
    }

    return {
      ok: false,
      reason: 'error',
    }
  } finally {
    clearTimeout(timeout)
  }
}
