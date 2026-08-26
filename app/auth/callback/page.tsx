'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

const FALLBACK_RETURN_PATH = '/#talents'

function safeReturnPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/')) return FALLBACK_RETURN_PATH
  return value
}

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)
  const redirected = useRef(false)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const redirectWithSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        setError(sessionError.message)
        return
      }

      const returnPath = safeReturnPath(data.session?.user?.user_metadata?.auth_return_path)
      if (data.session && !redirected.current) {
        redirected.current = true
        window.location.replace(returnPath)
      }
    }

    void redirectWithSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !redirected.current) {
        redirected.current = true
        const returnPath = safeReturnPath(session.user.user_metadata?.auth_return_path)
        window.location.replace(returnPath)
      }
    })

    return () => subscription.unsubscribe()
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
