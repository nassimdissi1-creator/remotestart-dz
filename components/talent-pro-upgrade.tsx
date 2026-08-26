'use client'

import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

type PaymentMethod = 'redotpay' | 'baridimob'

type PaymentDetails = {
  reference: string
  amount: number
  currency: string
  paymentMethod: PaymentMethod
  paymentUrl?: string | null
  walletAddress?: string | null
  baridimob?: {
    ccp: string | null
    rip: string | null
    accountName: string | null
  }
}

type Props = {
  onPaymentSubmitted?: () => void
}

export function TalentProUpgrade({ onPaymentSubmitted }: Props) {
  const supabase = getSupabaseBrowserClient()
  const [method, setMethod] = useState<PaymentMethod>('redotpay')
  const [details, setDetails] = useState<PaymentDetails | null>(null)
  const [transactionHash, setTransactionHash] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [submittingProof, setSubmittingProof] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function createOrder(selectedMethod: PaymentMethod) {
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) throw new Error('Your session has expired. Please sign in again.')

      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          product: 'talent_pro',
          payment_method: selectedMethod,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Could not create the payment order.')

      setDetails(data as PaymentDetails)
      setMethod(selectedMethod)

      if (selectedMethod === 'redotpay' && data?.paymentUrl) {
        window.open(data.paymentUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : 'Could not create the payment order.')
    } finally {
      setLoading(false)
    }
  }

  async function submitProof() {
    if (!details) return
    if (!transactionHash.trim() && !receipt) {
      setError('Please enter the transaction reference/hash or upload a payment receipt.')
      return
    }

    setSubmittingProof(true)
    setMessage('')
    setError('')

    try {
      const form = new FormData()
      form.set('reference', details.reference)
      form.set('payment_method', details.paymentMethod)
      if (transactionHash.trim()) form.set('transaction_hash', transactionHash.trim())
      if (receipt) form.set('receipt', receipt)

      const response = await fetch('/api/payments/submit-proof', {
        method: 'POST',
        body: form,
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) throw new Error(data?.error || 'Could not submit payment proof.')

      setMessage('Payment proof received. Your order is now pending admin verification. You will be upgraded after approval.')
      setTransactionHash('')
      setReceipt(null)
      setDetails(null)
      onPaymentSubmitted?.()
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit payment proof.')
    } finally {
      setSubmittingProof(false)
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-[#d8b56b]/30 bg-gradient-to-br from-[#d8b56b]/10 to-white/[.035] p-6 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d8b56b]">Upgrade</p>
          <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">Talent Pro Plus</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            8,000 DZD with BaridiMob or $29 USD with RedotPay. Includes 5 AI CV Reviews every month, unlimited applications, profile visibility and priority support.
          </p>
        </div>
        <div className="rounded-2xl border border-[#d8b56b]/20 bg-[#071426]/60 px-5 py-4 text-center">
          <div className="text-2xl font-black text-[#d8b56b]">8,000 DZD</div>
          <div className="mt-1 text-xs text-slate-500">monthly · local price</div>
        </div>
      </div>

      {!details ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void createOrder('redotpay')}
            className="rounded-2xl border border-white/10 bg-white/[.045] px-5 py-4 text-left transition hover:border-[#d8b56b]/50 hover:bg-white/[.07] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="block text-sm font-bold">Pay with RedotPay</span>
            <span className="mt-1 block text-xs text-slate-500">$29 USD · card/wallet transfer · admin verification</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void createOrder('baridimob')}
            className="rounded-2xl border border-white/10 bg-white/[.045] px-5 py-4 text-left transition hover:border-[#d8b56b]/50 hover:bg-white/[.07] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="block text-sm font-bold">Pay with BaridiMob</span>
            <span className="mt-1 block text-xs text-slate-500">8,000 DZD · local payment · receipt verification</span>
          </button>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-white/10 bg-[#071426]/70 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Payment reference</p>
              <p className="mt-1 break-all font-mono text-sm text-[#d8b56b]">{details.reference}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xl font-black">{details.amount.toLocaleString()} {details.currency}</p>
              <p className="text-xs capitalize text-slate-500">{details.paymentMethod}</p>
            </div>
          </div>

          {details.paymentMethod === 'redotpay' ? (
            <div className="mt-5 space-y-3 text-sm text-slate-300">
              {details.paymentUrl && (
                <button type="button" onClick={() => window.open(details.paymentUrl || '', '_blank', 'noopener,noreferrer')} className="w-full rounded-xl bg-[#d8b56b] px-4 py-3 font-bold text-[#071426]">
                  Open RedotPay payment link
                </button>
              )}
              {details.walletAddress && (
                <div className="rounded-xl border border-white/10 p-3">
                  <p className="text-xs text-slate-500">RedotPay wallet address</p>
                  <p className="mt-1 break-all font-mono text-xs">{details.walletAddress}</p>
                </div>
              )}
              <p className="text-xs leading-5 text-slate-500">After paying, enter the transaction reference/hash below. You can also attach a receipt if available.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-slate-500">CCP</p><p className="mt-1 font-mono text-sm">{details.baridimob?.ccp || 'Not configured'}</p></div>
              <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-slate-500">RIP</p><p className="mt-1 font-mono text-sm">{details.baridimob?.rip || 'Not configured'}</p></div>
              <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-slate-500">Account name</p><p className="mt-1 text-sm">{details.baridimob?.accountName || 'Not configured'}</p></div>
            </div>
          )}

          <div className="mt-5 grid gap-3">
            <input
              value={transactionHash}
              onChange={(event) => setTransactionHash(event.target.value)}
              placeholder="Transaction reference / hash (optional if receipt is uploaded)"
              className="w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#d8b56b]/60"
            />
            <label className="rounded-xl border border-dashed border-white/15 bg-white/[.025] px-4 py-3 text-sm text-slate-400">
              <span className="block text-xs text-slate-500">Payment receipt (optional if transaction hash is provided)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setReceipt(event.target.files?.[0] || null)} className="mt-2 block w-full text-xs" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" disabled={submittingProof} onClick={() => void submitProof()} className="rounded-xl bg-[#d8b56b] px-4 py-3 text-sm font-bold text-[#071426] disabled:opacity-50">
                {submittingProof ? 'Submitting…' : 'Submit payment proof'}
              </button>
              <button type="button" disabled={submittingProof} onClick={() => setDetails(null)} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {message && <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-300">{message}</p>}
      {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-300">{error}</p>}
    </section>
  )
}
