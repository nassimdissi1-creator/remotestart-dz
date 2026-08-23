'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, ShieldCheck, Sparkles, Star } from 'lucide-react'

type Product = 'talent_pro' | 'ai_cv_review'
type Method = 'redotpay' | 'baridimob'

type Props = { customerEmail: string; talentId?: string }

export function Monetization({ customerEmail, talentId }: Props) {
  const [loading, setLoading] = useState<Product | null>(null)
  const [message, setMessage] = useState('')
  const [reference, setReference] = useState('')
  const [method, setMethod] = useState<Method | null>(null)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [baridi, setBaridi] = useState<{ ccp: string | null; rip: string | null; accountName: string | null } | null>(null)
  const [transactionHash, setTransactionHash] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)

  async function startPayment(product: Product, paymentMethod: Method) {
    setLoading(product); setMessage(''); setReference(''); setMethod(paymentMethod); setPaymentUrl(null); setWalletAddress(null); setBaridi(null); setTransactionHash(''); setReceipt(null)
    try {
      const response = await fetch('/api/payments/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product, payment_method: paymentMethod, customer_email: customerEmail, customer_id: talentId }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Payment could not be started.')
      setReference(data.reference); setPaymentUrl(data.paymentUrl || null); setWalletAddress(data.walletAddress || null); setBaridi(data.baridimob || null)
      setMessage(paymentMethod === 'redotpay' ? 'أكمل التحويل إلى حساب RedotPay الشخصي، ثم أرسل Transaction Hash أو إيصال الدفع أدناه.' : 'حوّل المبلغ عبر BaridiMob، ثم أرسل إيصال التحويل أدناه.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر بدء الدفع.') } finally { setLoading(null) }
  }

  async function submitProof() {
    if (!reference || !method || (!transactionHash.trim() && !receipt)) return
    setLoading('talent_pro')
    const form = new FormData(); form.append('reference', reference); form.append('payment_method', method)
    if (transactionHash.trim()) form.append('transaction_hash', transactionHash.trim()); if (receipt) form.append('receipt', receipt)
    try {
      const response = await fetch('/api/payments/submit-proof', { method: 'POST', body: form }); const data = await response.json()
      setMessage(response.ok ? 'تم إرسال إثبات الدفع. الحالة الآن قيد التحقق وسيتم التفعيل بعد اعتماد المعاملة.' : (data.error || 'تعذر إرسال إثبات الدفع.'))
    } catch { setMessage('تعذر الاتصال بالخادم. حاول مرة أخرى.') } finally { setLoading(null) }
  }

  const copy = async (value: string) => navigator.clipboard?.writeText(value)
  return <section id="upgrade" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
    <div className="mb-10 text-center"><p className="text-xs font-bold uppercase tracking-[.25em] text-[#d8b56b]">Talent monetization</p><h2 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">Upgrade your career profile</h2><p className="mx-auto mt-3 max-w-2xl text-slate-400">دفع مباشر عبر RedotPay أو BaridiMob بدون API Keys أو Webhooks للدفع الشخصي.</p></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Pro / Featured Profile" price="$29" icon={<Star className="h-5 w-5" />} items={['شارة Pro مميزة', 'ظهور أعلى في نتائج المواهب', 'Featured لمدة 30 يومًا', 'التفعيل بعد اعتماد الدفع']}><div className="grid gap-2 sm:grid-cols-2"><button disabled={!!loading} onClick={() => startPayment('talent_pro', 'redotpay')} className="rounded-xl bg-[#d8b56b] px-4 py-3 text-sm font-bold text-[#071426]">{loading === 'talent_pro' ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'الدفع عبر RedotPay'}</button><button disabled={!!loading} onClick={() => startPayment('talent_pro', 'baridimob')} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white">الدفع عبر BaridiMob</button></div></Card>
      <Card title="AI CV Review" price="$12" icon={<Sparkles className="h-5 w-5" />} items={['مراجعة CV بالذكاء الاصطناعي', 'ملاحظات عملية قابلة للتنفيذ', 'رصيد مراجعة يُضاف بعد اعتماد الدفع', 'إثبات دفع بسيط وآمن']}><div className="grid gap-2 sm:grid-cols-2"><button disabled={!!loading} onClick={() => startPayment('ai_cv_review', 'redotpay')} className="flex items-center justify-center gap-2 rounded-xl bg-[#d8b56b] px-4 py-3 text-sm font-bold text-[#071426]">{loading === 'ai_cv_review' ? <Loader2 className="h-5 w-5 animate-spin" /> : <>الدفع عبر RedotPay <ExternalLink className="h-4 w-4" /></>}</button><button disabled={!!loading} onClick={() => startPayment('ai_cv_review', 'baridimob')} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white">BaridiMob</button></div></Card>
    </div>
    {reference && method && <div className="mt-6 rounded-2xl border border-[#d8b56b]/20 bg-white/[.035] p-6"><p className="text-sm font-bold text-white">رقم الطلب: <span className="text-[#d8b56b]">{reference}</span></p>
      {method === 'redotpay' && <div className="mt-4 space-y-3 text-sm text-slate-300">{paymentUrl && <a href={paymentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#d8b56b] px-5 py-3 font-bold text-[#071426]">فتح رابط RedotPay <ExternalLink className="h-4 w-4" /></a>}{walletAddress && <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="mb-2 text-xs text-slate-500">عنوان المحفظة</p><div className="flex items-center gap-2 break-all text-white"><span className="flex-1">{walletAddress}</span><button onClick={() => copy(walletAddress)} className="rounded-lg p-2 hover:bg-white/10" aria-label="نسخ عنوان المحفظة"><Copy className="h-4 w-4" /></button></div></div>}</div>}
      {method === 'baridimob' && <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300"><p className="font-bold text-white">بيانات التحويل</p>{baridi?.accountName && <p className="mt-2">الاسم: {baridi.accountName}</p>}{baridi?.ccp && <p className="mt-1 flex gap-2">CCP: <span className="text-white">{baridi.ccp}</span><button onClick={() => copy(baridi.ccp!)} aria-label="نسخ CCP"><Copy className="h-4 w-4" /></button></p>}{baridi?.rip && <p className="mt-1 flex gap-2">RIP: <span className="text-white">{baridi.rip}</span><button onClick={() => copy(baridi.rip!)} aria-label="نسخ RIP"><Copy className="h-4 w-4" /></button></p>}<p className="mt-3 text-xs text-slate-500">بعد التحويل، ارفع الإيصال أدناه.</p></div>}
      <div className="mt-4 grid gap-3"><input value={transactionHash} onChange={(e) => setTransactionHash(e.target.value)} placeholder="Transaction Hash / Reference (اختياري إذا سترفع إيصالًا)" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600" /><input type="file" accept="image/*,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} className="text-sm text-slate-400" /><button onClick={submitProof} disabled={(!transactionHash.trim() && !receipt) || !!loading} className="rounded-xl bg-[#d8b56b] px-5 py-3 text-sm font-bold text-[#071426]">{loading ? 'جارٍ الإرسال...' : 'إرسال إثبات الدفع'}</button></div>
    </div>}
    {message && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/[.035] p-4 text-sm text-slate-300">{message}</p>}
  </section>
}

function Card({ title, price, icon, items, children }: { title: string; price: string; icon: React.ReactNode; items: string[]; children: React.ReactNode }) { return <div className="rounded-3xl border border-white/10 bg-white/[.035] p-7"><div className="flex items-center justify-between"><div className="flex items-center gap-3 text-[#d8b56b]"><span className="rounded-xl bg-[#d8b56b]/10 p-3">{icon}</span><h3 className="text-xl font-bold text-white">{title}</h3></div><span className="font-display text-3xl font-black text-white">{price}</span></div><ul className="my-7 space-y-3">{items.map((item) => <li key={item} className="flex items-center gap-2 text-sm text-slate-300"><Check className="h-4 w-4 text-[#d8b56b]" />{item}</li>)}</ul>{children}<div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5" /> لا يتم تفعيل الميزات قبل اعتماد إثبات الدفع</div></div> }
