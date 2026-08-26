'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, ShieldCheck, Star } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

type Method = 'redotpay' | 'baridimob'

type Props = { customerEmail: string; talentId?: string }

export function Monetization({ customerEmail, talentId }: Props) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [reference, setReference] = useState('')
  const [method, setMethod] = useState<Method | null>(null)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [baridi, setBaridi] = useState<{ ccp: string | null; rip: string | null; accountName: string | null } | null>(null)
  const [transactionHash, setTransactionHash] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)

  async function startPayment(paymentMethod: Method) {
    setLoading(true)
    setMessage('')
    setReference('')
    setMethod(paymentMethod)
    setPaymentUrl(null)
    setWalletAddress(null)
    setBaridi(null)
    setTransactionHash('')
    setReceipt(null)

    try {
      const supabase = getSupabaseBrowserClient()
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) throw new Error('Please sign in before starting a Talent Pro payment.')

      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          product: 'talent_pro',
          payment_method: paymentMethod,
          customer_email: customerEmail,
          customer_id: talentId,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Payment could not be started.')

      setReference(data.reference)
      setPaymentUrl(data.paymentUrl || null)
      setWalletAddress(data.walletAddress || null)
      setBaridi(data.baridimob || null)
      setMessage(
        paymentMethod === 'redotpay'
          ? 'أكمل الدفع بقيمة $29 عبر RedotPay، ثم أرسل Transaction Hash أو إيصال الدفع أدناه.'
          : 'حوّل 8000 DZD عبر BaridiMob، ثم أرسل إيصال التحويل أدناه.',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر بدء الدفع.')
    } finally {
      setLoading(false)
    }
  }

  async function submitProof() {
    if (!reference || !method || (!transactionHash.trim() && !receipt)) return
    setLoading(true)

    const form = new FormData()
    form.append('reference', reference)
    form.append('payment_method', method)
    if (transactionHash.trim()) form.append('transaction_hash', transactionHash.trim())
    if (receipt) form.append('receipt', receipt)

    try {
      const response = await fetch('/api/payments/submit-proof', { method: 'POST', body: form })
      const data = await response.json()
      setMessage(
        response.ok
          ? 'تم إرسال إثبات الدفع. الحالة الآن قيد التحقق وسيتم تفعيل Talent Pro Plus بعد اعتماد المعاملة.'
          : data.error || 'تعذر إرسال إثبات الدفع.',
      )
    } catch {
      setMessage('تعذر الاتصال بالخادم. حاول مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }

  const copy = async (value: string) => navigator.clipboard?.writeText(value)

  return (
    <section id="upgrade" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <div className="mb-10 text-center">
        <p className="text-xs font-bold uppercase tracking-[.25em] text-[#d8b56b]">Talent monetization</p>
        <h2 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">Upgrade to Talent Pro Plus</h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-400">
          29 USD عبر RedotPay أو 8000 DZD عبر BaridiMob. يتضمن الاشتراك 5 AI CV Reviews لكل فترة اشتراك.
        </p>
      </div>

      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[.035] p-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[#d8b56b]">
            <span className="rounded-xl bg-[#d8b56b]/10 p-3"><Star className="h-5 w-5" /></span>
            <h3 className="text-xl font-bold text-white">Talent Pro Plus</h3>
          </div>
          <span className="font-display text-3xl font-black text-white">$29</span>
        </div>

        <ul className="my-7 grid gap-3 sm:grid-cols-2">
          {['شارة Pro مميزة', 'ظهور أعلى في نتائج المواهب', 'Featured لمدة 30 يومًا', '5 AI CV Reviews لكل فترة اشتراك', 'التفعيل بعد اعتماد الدفع', 'دعم أولوية'].map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
              <Check className="h-4 w-4 text-[#d8b56b]" />{item}
            </li>
          ))}
        </ul>

        <div className="grid gap-2 sm:grid-cols-2">
          <button disabled={loading} onClick={() => startPayment('redotpay')} className="rounded-xl bg-[#d8b56b] px-4 py-3 text-sm font-bold text-[#071426]">
            {loading && method === 'redotpay' ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'الدفع عبر RedotPay · $29'}
          </button>
          <button disabled={loading} onClick={() => startPayment('baridimob')} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white">
            {loading && method === 'baridimob' ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'الدفع عبر BaridiMob · 8000 DZD'}
          </button>
        </div>
      </div>

      {reference && method && (
        <div className="mt-6 rounded-2xl border border-[#d8b56b]/20 bg-white/[.035] p-6">
          <p className="text-sm font-bold text-white">رقم الطلب: <span className="text-[#d8b56b]">{reference}</span></p>

          {method === 'redotpay' && (
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {paymentUrl && <a href={paymentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#d8b56b] px-5 py-3 font-bold text-[#071426]">فتح رابط RedotPay <ExternalLink className="h-4 w-4" /></a>}
              {walletAddress && <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="mb-2 text-xs text-slate-500">عنوان المحفظة</p><div className="flex items-center gap-2 break-all text-white"><span className="flex-1">{walletAddress}</span><button onClick={() => copy(walletAddress)} className="rounded-lg p-2 hover:bg-white/10" aria-label="نسخ عنوان المحفظة"><Copy className="h-4 w-4" /></button></div></div>}
            </div>
          )}

          {method === 'baridimob' && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              <p className="font-bold text-white">بيانات التحويل — 8000 DZD</p>
              {baridi?.accountName && <p className="mt-2">الاسم: {baridi.accountName}</p>}
              {baridi?.ccp && <p className="mt-1 flex gap-2">CCP: <span className="text-white">{baridi.ccp}</span><button onClick={() => copy(baridi.ccp!)} aria-label="نسخ CCP"><Copy className="h-4 w-4" /></button></p>}
              {baridi?.rip && <p className="mt-1 flex gap-2">RIP: <span className="text-white">{baridi.rip}</span><button onClick={() => copy(baridi.rip!)} aria-label="نسخ RIP"><Copy className="h-4 w-4" /></button></p>}
              <p className="mt-3 text-xs text-slate-500">بعد التحويل، ارفع الإيصال أدناه.</p>
            </div>
          )}

          <div className="mt-4 grid gap-3">
            <input value={transactionHash} onChange={(e) => setTransactionHash(e.target.value)} placeholder="Transaction Hash / Reference (اختياري إذا سترفع إيصالًا)" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600" />
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} className="text-sm text-slate-400" />
            <button onClick={submitProof} disabled={(!transactionHash.trim() && !receipt) || loading} className="rounded-xl bg-[#d8b56b] px-5 py-3 text-sm font-bold text-[#071426]">{loading ? 'جارٍ الإرسال...' : 'إرسال إثبات الدفع'}</button>
          </div>
        </div>
      )}

      {message && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/[.035] p-4 text-sm text-slate-300">{message}</p>}

      <div className="mx-auto mt-4 flex max-w-3xl items-center gap-2 text-[11px] text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5" /> لا يتم تفعيل الميزات قبل اعتماد إثبات الدفع.
      </div>
    </section>
  )
}
