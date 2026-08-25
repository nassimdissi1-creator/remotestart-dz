'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!active) return

      if (error || !data.session) {
        router.replace('/#talents')
        return
      }

      setEmail(data.session.user.email ?? null)
      setLoading(false)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/#talents')
        return
      }

      setEmail(session.user.email ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [router, supabase])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/#talents')
    router.refresh()
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#071426] text-slate-300">
        Loading dashboard…
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#071426] px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8b56b] font-black text-[#071426]">
                R
              </span>
              <span className="font-bold">RemoteStart-DZ</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">Talent Dashboard</p>
          </div>

          <button
            type="button"
            onClick={signOut}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Sign out
          </button>
        </header>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[.035] p-8">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d8b56b]">
            Welcome
          </p>
          <h1 className="mt-3 text-3xl font-extrabold">
            Your talent account is active.
          </h1>
          <p className="mt-3 text-slate-400">
            {email}
          </p>
        </section>
      </div>
    </main>
  )
}
