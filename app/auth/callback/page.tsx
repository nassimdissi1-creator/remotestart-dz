'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

const FALLBACK_RETURN_PATH = '/dashboard'

function safeReturnPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return FALLBACK_RETURN_PATH
  }
  if (value.startsWith('/auth/callback')) return FALLBACK_RETURN_PATH
  return value
}

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)
  const redirected = useRef(false)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const finishAuth = async () => {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const tokenHash = url.searchParams.get('token_hash')
      const type = url.searchParams.get('type')
      const returnToFromQuery = url.searchParams.get('returnTo')

      // Support both Supabase PKCE links and token-hash confirmation links.
      // token_hash verification creates the session on the device that opens
      // the email, which is required when registration starts on another device.
      if (tokenHash) {
        const otpType = type === 'recovery' ? 'recovery' : type === 'email_change' ? 'email_change' : 'email'
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        })
        if (verifyError) {
          setError(verifyError.message)
          return
        }
      } else if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          setError(exchangeError.message)
          return
        }
      }

      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        setError(sessionError.message)
        return
      }

      if (!data.session) {
        setError('Email confirmation completed, but no active session was created. Please return to RemoteStart-DZ and sign in.')
        return
      }

      // The original signup form may have been submitted before a session
      // existed, so initialize the talent profile now using the verified
      // session and the metadata captured during signup.
      const user = data.session.user
      const metadata = user.user_metadata || {}
      const fullName = String(metadata.full_name || '').trim()
      const skills = String(metadata.skills || '').trim()
      const toolsAndTechnologies = String(metadata.tools_and_technologies || '').trim()
      const linkedinUrl = String(metadata.linkedin_url || '').trim()

      if (fullName.length >= 2 && skills) {
        try {
          const profileResponse = await fetch('/api/talent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({
              full_name: fullName,
              skills,
              tools_and_technologies: toolsAndTechnologies,
              linkedin_url: linkedinUrl,
            }),
          })

          // 409 means the profile already exists, which is safe/idempotent.
          if (!profileResponse.ok && profileResponse.status !== 409) {
            const profileData = await profileResponse.json().catch(() => null)
            throw new Error(profileData?.error || 'Your account was confirmed, but the talent profile could not be initialized.')
          }
        } catch (profileError: unknown) {
          setError(profileError instanceof Error ? profileError.message : 'Your account was confirmed, but the talent profile could not be initialized.')
          return
        }
      }

      if (redirected.current) return
      redirected.current = true

      // Prefer the exact return path carried by the confirmation URL. Fall
      // back to auth metadata for older confirmation emails, then dashboard.
      // The confirmation URL is generated from window.location.origin during
      // signup, so the browser remains on the same deployment (preview or
      // production) that the user originally used.
      const returnPath = safeReturnPath(returnToFromQuery || metadata.auth_return_path)
      window.location.replace(returnPath)
    }

    void finishAuth()
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#071426] px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.035] p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d8b56b] font-black text-[#071426]">R</div>
        <h1 className="mt-5 text-2xl font-extrabold">Confirming your account…</h1>
        {error ? (
          <>
            <p className="mt-3 text-sm text-red-300">{error}</p>
            <a href={FALLBACK_RETURN_PATH} className="mt-6 inline-flex rounded-xl bg-[#d8b56b] px-5 py-3 text-sm font-bold text-[#071426]">
              Open your dashboard
            </a>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Your email has been confirmed. Setting up your profile and returning you to the page where you registered…</p>
        )}
      </div>
    </main>
  )
}
