'use client'

import { useEffect, useState } from 'react'

export default function AdminTestPaymentPage() {
  const [secret, setSecret] = useState('')
  const [talentId, setTalentId] = useState('b425bb34-1391-4393-a691-4c85b70c89a2')
  const [loggedIn, setLoggedIn] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

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
    setMessage('Admin session active.')
  }

  async function createTestPayment() {
    setBusy(true)
    setMessage('')
    const response = await fetch('/api/admin/payments/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ talent_id: talentId.trim() }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(data.error || 'Test payment creation failed.')
    } else {
      setMessage(
        data.notificationSent
          ? `TEST payment created: ${data.reference}. Telegram notification sent. Open Telegram and press Approve.`
          : `TEST payment created: ${data.reference}, but Telegram notification was not sent. Check Telegram environment variables.`,
      )
    }
    setBusy(false)
  }

  return (
    <main className="min-h-screen bg-[#071426] px-6 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[.25em] text-[#d8b56b]">RemoteStart-DZ Admin</p>
        <h1 className="mt-2 text-3xl font-black">Talent Pro test payment</h1>
        <p className="mt-3 text-slate-400">
          Creates a zero-value, admin-only payment order. It never contacts RedotPay or BaridiMob and cannot be used by normal users.
        </p>

        {!loggedIn ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.04] p-6">
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
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.04] p-6">
            <label className="text-sm text-slate-300">Talent ID to test</label>
            <input
              value={talentId}
              onChange={(event) => setTalentId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm outline-none"
            />
            <button
              disabled={busy || !talentId.trim()}
              onClick={createTestPayment}
              className="mt-4 w-full rounded-xl bg-[#d8b56b] px-4 py-3 font-bold text-[#071426] disabled:opacity-50"
            >
              {busy ? 'Creating test payment…' : 'Create TEST Talent Pro Payment'}
            </button>
            <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">
              This is a test-only path. The created order uses amount 0 and <code>metadata.test_payment = true</code>. Approval still runs the real Talent Pro fulfillment path.
            </div>
          </div>
        )}

        {message && <p className="mt-5 rounded-xl border border-white/10 bg-white/[.04] p-4 text-sm text-slate-200">{message}</p>}
      </div>
    </main>
  )
}
