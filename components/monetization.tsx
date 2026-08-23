'use client'

import { useState } from 'react'
import { Check, ExternalLink, FileCheck2, Loader2, ShieldCheck, Sparkles, Star } from 'lucide-react'

type Product = 'talent_pro' | 'ai_cv_review'

type Props = { customerEmail: string; talentId?: string }

export function Monetization({ customerEmail, talentId }: Props) {
  const [loading, setLoading] = useState<Product | null>(null)
  const [message, setMessage] = useState('')
  const [receiptReference, setReceiptReference] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)

  async function startPayment(product: Product, method: 'redotpay' | 'baridimob') {
    setLoading(product)
    setMessage('')
    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, payment_method: method, customer_email: customerEmail, customer_id: talentId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Payment could not be started.')
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
      else {
        setReceiptReference(data.reference)
        setMessage(`تم إنشاء الطلب ${data.reference}. أرسل إيصال الدفع أدناه.`)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر بدء الدفع.')
    } finally {
      setLoading(null)
    }
  }

  async function uploadReceipt() {
    if (!receipt || !receiptReference) return
    setLoading('talent_pro')
    const form = new FormData()
    form.append('reference', receiptReference)
    form.append('receipt', receipt)
    try {
      const response = await fetch('/api/payments/baridimob/receipt', { method: 'POST', body: form })
      const data = await response.json()
      setMessage(response.ok ? 'تم استلام الإيصال. سيُحدّث الطلب تلقائيًا عند التحقق.' : (data.error || 'تعذر رفع الإيصال.'))
    } finally { setLoading(null) }
  }

  return (
    <section id="upgrade" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <div className="mb-10 text-center">
        <p className="text-xs font-bold uppercase tracking-[.25em] text-[#d8b56b]">Talent monetization</p>
        <h2 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">Upgrade your career profile</h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-400">ميزات مدفوعة بسيطة، مع دفع آمن وتفعيل تلقائي عند تأكيد المعاملة.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Pro / Featured Profile" price="$29" icon={<Star className="h-5 w-5" />} items={['شارة Pro مميزة', 'ظهور أعلى في نتائج المواهب', 'Featured لمدة 30 يومًا', 'تفعيل تلقائي بعد الدفع']}>
          <div className="grid gap-2 sm:grid-cols-2">
            <button disabled={!!loading} onClick={() => startPayment('talent_pro', 'redotpay')} className="rounded-xl bg-[#d8b56b] px-4 py-3 text-sm font-bold text-[#071426]">{loading === 'talent_pro' ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'الدفع بـ RedotPay'}</button>
            <button disabled={!!loading} onClick={() => startPayment('talent_pro', 'baridimob')} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white">BaridiMob</button>
          </div>
        </Card>
        <Card title="AI CV Review" price="$12" icon={<Sparkles className="h-5 w-5" />} items={['مراجعة CV بالذكاء الاصطناعي', 'ملاحظات عملية قابلة للتنفيذ', 'رصيد مراجعة يُضاف تلقائيًا', 'لا حاجة لتدخل إداري']}>
          <button disabled={!!loading} onClick={() => startPayment('ai_cv_review', 'redotpay')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d8b56b] px-4 py-3 text-sm font-bold text-[#071426]">{loading === 'ai_cv_review' ? <Loader2 className="h-5 w-5 animate-spin" /> : <>الدفع بـ RedotPay <ExternalLink className="h-4 w-4" /></>}</button>
        </Card>
      </div>
      {receiptReference && <div className="mt-6 rounded-2xl border border-[#d8b56b]/20 bg-white/[.035] p-6"><p className="text-sm font-bold text-white">BaridiMob — reference: {receiptReference}</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input type="file" accept="image/*,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} className="text-sm text-slate-400" /><button onClick={uploadReceipt} disabled={!receipt || !!loading} className="rounded-xl bg-[#d8b56b] px-5 py-3 text-sm font-bold text-[#071426]">رفع الإيصال</button></div></div>}
      {message && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/[.035] p-4 text-sm text-slate-300">{message}</p>}
    </section>
  )
}

function Card({ title, price, icon, items, children }: { title: string; price: string; icon: React.ReactNode; items: string[]; children: React.ReactNode }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[.035] p-7"><div className="flex items-center justify-between"><div className="flex items-center gap-3 text-[#d8b56b]"><span className="rounded-xl bg-[#d8b56b]/10 p-3">{icon}</span><h3 className="text-xl font-bold text-white">{title}</h3></div><span className="font-display text-3xl font-black text-white">{price}</span></div><ul className="my-7 space-y-3">{items.map((item) => <li key={item} className="flex items-center gap-2 text-sm text-slate-300"><Check className="h-4 w-4 text-[#d8b56b]" />{item}</li>)}</ul>{children}<div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5" /> الدفع والتفعيل مؤمّنان عبر الخادم</div></div>
}
