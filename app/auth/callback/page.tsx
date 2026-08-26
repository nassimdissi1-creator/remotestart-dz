'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

const FALLBACK_RETURN_PATH = '/#talents'

function safeReturnPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return FALLBACK_RETURN_PATH
  }
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

      // Support both Supabase PKCE links and token-hash confirmation links.
      // token_hash verification is important when the confirmation email is
      // opened on a different device from the one used for registration.
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

      if (redirected.current) return
      redirected.current = true

      const returnPath = safeReturnPath(data.session.user.user_metadata?.auth_return_path)
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
              Return to RemoteStart-DZ
            </a>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Your email has been confirmed. Redirecting you back to RemoteStart-DZ…</p>
        )}
      </div>
    </main>
  )
}
