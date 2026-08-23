'use client'

import { useEffect, useState } from 'react'

interface Payment {
  id: string
  reference: string
  customer_email: string
  customer_type: string
  product_code: string
  amount_usd: number
  payment_method: string
  transaction_hash?: string | null
  receipt_path?: string | null
  proof_submitted_at?: string | null
  created_at: string
}

export default function AdminPaymentsPage() {
  const [secret, setSecret] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [payments, setPayments] = useState<Payment[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    const response = await fetch('/api/admin/payments', { cache: 'no-store' })
    if (response.ok) { setLoggedIn(true); setPayments((await response.json()).payments || []) }
    else setLoggedIn(false)
  }

  useEffect(() => { load() }, [])

  async function login() {
    setMessage('')
    const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret }) })
    if (!response.ok) { setMessage((await response.json()).error || 'Login failed.'); return }
    setSecret(''); setLoggedIn(true); await load()
  }

  async function decide(reference: string, decision: 'approve' | 'reject') {
    setBusy(reference); setMessage('')
    const response = await fetch('/api/admin/payments/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference, decision }) })
    const data = await response.json()
    if (!response.ok) setMessage(data.error || 'Action failed.')
    else { setMessage(decision === 'approve' ? 'Payment approved and feature activated.' : 'Payment rejected.'); await load() }
    setBusy(null)
  }

  return <main className="min-h-screen bg-[#071426] px-6 py-12 text-white">
    <div className="mx-auto max-w-5xl">
      <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[.25em] text-[#d8b56b]">RemoteStart-DZ Admin</p><h1 className="mt-2 text-3xl font-black">Payment verification</h1><p className="mt-2 text-slate-400">Approve verified direct-transfer payments with one click.</p></div>
      {!loggedIn ? <div className="max-w-md rounded-2xl border border-white/10 bg-white/[.04] p-6"><label className="text-sm text-slate-300">Admin secret</label><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" /><button onClick={login} className="mt-4 w-full rounded-xl bg-[#d8b56b] px-4 py-3 font-bold text-[#071426]">Sign in</button>{message && <p className="mt-3 text-sm text-red-300">{message}</p>}</div> : <div className="space-y-4">{payments.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[.04] p-8 text-center text-slate-400">No payments waiting for verification.</div>}{payments.map((payment) => <article key={payment.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs text-[#d8b56b]">{payment.product_code} · ${payment.amount_usd}</p><h2 className="mt-1 text-lg font-bold">{payment.customer_email}</h2><p className="mt-1 text-sm text-slate-400">{payment.payment_method} · {payment.reference}</p>{payment.transaction_hash && <p className="mt-3 break-all text-xs text-slate-300">TX: {payment.transaction_hash}</p>}{payment.receipt_path && <p className="mt-2 break-all text-xs text-slate-500">Receipt: {payment.receipt_path}</p>}</div><div className="flex gap-2"><button disabled={busy === payment.reference} onClick={() => decide(payment.reference, 'approve')} className="rounded-xl bg-[#d8b56b] px-5 py-3 text-sm font-bold text-[#071426]">Approve</button><button disabled={busy === payment.reference} onClick={() => decide(payment.reference, 'reject')} className="rounded-xl border border-red-400/20 bg-red-400/10 px-5 py-3 text-sm font-bold text-red-200">Reject</button></div></div></article>)}{message && <p className="rounded-xl border border-white/10 bg-white/[.04] p-4 text-sm text-slate-300">{message}</p>}</div>}
    </div>
  </main>
}
