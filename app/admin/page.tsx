'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function AdminHomePage() {
  const [secret, setSecret] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/admin/payments', { cache: 'no-store' }).then((response) => {
      if (response.ok) setLoggedIn(true)
    })
  }, [])

  async function login() {
    setMessage('')
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(data.error || 'Login failed.')
      return
    }
    setSecret('')
    setLoggedIn(true)
  }

  return (
    <main className="min-h-screen bg-[#071426] px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[.25em] text-[#d8b56b]">RemoteStart-DZ Admin</p>
        <h1 className="mt-2 text-3xl font-black">Admin control center</h1>
        <p className="mt-3 text-slate-400">
          Protected administration tools for payment verification and the admin-only Talent Pro test path.
        </p>

        {!loggedIn ? (
          <div className="mt-8 max-w-md rounded-2xl border border-white/10 bg-white/[.04] p-6">
            <label className="text-sm text-slate-300">Admin secret</label>
            <input
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && login()}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
            />
            <button onClick={login} className="mt-4 w-full rounded-xl bg-[#d8b56b] px-4 py-3 font-bold text-[#071426]">
              Sign in as Admin
            </button>
            {message && <p className="mt-3 text-sm text-red-300">{message}</p>}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link href="/admin/test-payment" className="rounded-2xl border border-white/10 bg-white/[.04] p-6 transition hover:bg-white/[.07]">
              <p className="text-xs font-bold uppercase tracking-widest text-[#d8b56b]">Safe test</p>
              <h2 className="mt-2 text-xl font-bold">Talent Pro test payment</h2>
              <p className="mt-2 text-sm text-slate-400">Create an admin-only test order without contacting RedotPay or BaridiMob.</p>
            </Link>
            <Link href="/admin/payments" className="rounded-2xl border border-white/10 bg-white/[.04] p-6 transition hover:bg-white/[.07]">
              <p className="text-xs font-bold uppercase tracking-widest text-[#d8b56b]">Payments</p>
              <h2 className="mt-2 text-xl font-bold">Payment verification</h2>
              <p className="mt-2 text-sm text-slate-400">Review pending payment orders and use the canonical approval path.</p>
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
