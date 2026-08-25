'use client'

import { useState } from 'react'
import { BriefcaseBusiness, Check, Copy, ExternalLink, Loader2 } from 'lucide-react'

type Method = 'redotpay' | 'baridimob'
type Plan = 'standard' | 'future'

const PLANS = {
  standard: { title: 'Standard Job Post', price: '$399', code: 'standard_job_post' },
  future: { title: 'Future Job Post', price: '$499', code: 'future_job_post' },
} as const

export function EmployerJobForm() {
  const [plan, setPlan] = useState<Plan>('standard')
  const [method, setMethod] = useState<Method>('redotpay')
  const [form, setForm] = useState({ company_name: '', job_title: '', salary: '', description: '', contact_email: '' })
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [reference, setReference] = useState('')
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null), [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [baridi, setBaridi] = useState<{ ccp: string | null; rip: string | null; accountName: string | null } | null>(null)
  const [transactionHash, setTransactionHash] = useState(''), [receipt, setReceipt] = useState<File | null>(null), [submitted, setSubmitted] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const response = await fetch('/api/jobs/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, plan, payment_method: method }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not create job.')
      setReference(data.reference); setPaymentUrl(data.paymentUrl || null); setWalletAddress(data.walletAddress || null); setBaridi(data.baridimob || null)
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر إنشاء الإعلان.') } finally { setLoading(false) }
  }

  async function submitProof(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(''); const body = new FormData(); body.append('reference', reference); body.append('payment_method', method)
    if (transactionHash.trim()) body.append('transaction_hash', transactionHash.trim()); if (receipt) body.append('receipt', receipt)
    try { const response = await fetch('/api/payments/submit-proof', { method: 'POST', body }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not submit payment proof.'); setSubmitted(true) }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذر إرسال إثبات الدفع.') } finally { setLoading(false) }
  }

  const input = 'w-full rounded-xl border border-white/10 bg-[#071426]/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#d8b56b]/60'
  const copy = (value: string) => navigator.clipboard?.writeText(value)
  const selectedPlan = PLANS[plan]

  return <section id="employers" className="mx-auto max-w-7xl px-6 py-20 lg:px-8"><div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-start"><div><p className="text-xs font-bold uppercase tracking-[.25em] text-[#d8b56b]">For employers</p><h2 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">Publish your next remote role.</h2><p className="mt-4 leading-8 text-slate-400">أنشئ إعلان الوظيفة، اختر العرض المناسب، ادفع مباشرة عبر RedotPay أو BaridiMob، ثم أرسل إثبات الدفع. الإعلان يبقى غير منشور حتى الاعتماد.</p><div className="mt-8 grid gap-3"><Plan selected={plan === 'standard'} onClick={() => setPlan('standard')} title={PLANS.standard.title} price={PLANS.standard.price} items={['Live job listing', 'Global talent reach']} /><Plan selected={plan === 'future'} onClick={() => setPlan('future')} title={PLANS.future.title} price={PLANS.future.price} items={['Schedule for a future hiring need', 'Global talent reach', 'Priority placement']} /></div></div><form onSubmit={reference ? submitProof : submit} className="rounded-3xl border border-white/10 bg-white/[.035] p-7 shadow-2xl"><div className="mb-6 flex items-center gap-3"><span className="rounded-xl bg-[#d8b56b]/10 p-3 text-[#d8b56b]"><BriefcaseBusiness className="h-5 w-5" /></span><div><h3 className="font-bold text-white">Job posting</h3><p className="text-xs text-slate-500">Direct transfer • proof-based verification</p></div></div>{!reference ? <><div className="grid gap-4 sm:grid-cols-2"><input required className={input} placeholder="Company name" value={form.company_name} onChange={e => setForm({...form, company_name:e.target.value})} /><input required className={input} placeholder="Job title" value={form.job_title} onChange={e => setForm({...form, job_title:e.target.value})} /><input className={input} placeholder="Salary / range" value={form.salary} onChange={e => setForm({...form, salary:e.target.value})} /><input required type="email" className={input} placeholder="Contact email" value={form.contact_email} onChange={e => setForm({...form, contact_email:e.target.value})} /></div><textarea required minLength={20} rows={7} className={`${input} mt-4`} placeholder="Describe the role, responsibilities and requirements" value={form.description} onChange={e => setForm({...form, description:e.target.value})} /><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setMethod('redotpay')} className={`rounded-xl border px-4 py-3 text-sm font-bold ${method === 'redotpay' ? 'border-[#d8b56b]/60 bg-[#d8b56b]/10 text-white' : 'border-white/10 text-slate-400'}`}>RedotPay / Crypto</button><button type="button" onClick={() => setMethod('baridimob')} className={`rounded-xl border px-4 py-3 text-sm font-bold ${method === 'baridimob' ? 'border-[#d8b56b]/60 bg-[#d8b56b]/10 text-white' : 'border-white/10 text-slate-400'}`}>BaridiMob</button></div><button disabled={loading} className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#d8b56b] font-extrabold text-[#071426]">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create job & continue to payment'}</button><p className="mt-3 text-center text-[11px] text-slate-500">Selected: {selectedPlan.title} • {selectedPlan.price} • {method === 'redotpay' ? 'RedotPay' : 'BaridiMob'}</p></> : <div className="space-y-4 rounded-2xl border border-[#d8b56b]/20 bg-black/20 p-5"><p className="text-sm font-bold text-white">Order: <span className="text-[#d8b56b]">{reference}</span></p>{paymentUrl && <a href={paymentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#d8b56b] px-4 py-3 text-sm font-bold text-[#071426]">Open RedotPay payment link <ExternalLink className="h-4 w-4" /></a>}{walletAddress && <div className="rounded-xl border border-white/10 p-3 text-xs text-slate-300 break-all">Wallet: {walletAddress}<button type="button" onClick={() => copy(walletAddress)} className="ml-2 inline-flex rounded p-1 hover:bg-white/10"><Copy className="h-3.5 w-3.5" /></button></div>}{baridi && <div className="rounded-xl border border-white/10 p-4 text-sm text-slate-300">{baridi.accountName && <p>الاسم: {baridi.accountName}</p>}{baridi.ccp && <p className="mt-1">CCP: {baridi.ccp}</p>}{baridi.rip && <p className="mt-1">RIP: {baridi.rip}</p>}<p className="mt-2 text-xs text-slate-500">حوّل المبلغ ثم أرسل الإيصال.</p></div>}{!submitted ? <><input value={transactionHash} onChange={e => setTransactionHash(e.target.value)} placeholder="Transaction Hash / Reference" className={input} /><input type="file" accept="image/*,application/pdf" onChange={e => setReceipt(e.target.files?.[0] || null)} className="text-sm text-slate-400" /><button disabled={loading || (!transactionHash.trim() && !receipt)} className="w-full rounded-xl bg-[#d8b56b] px-4 py-3 text-sm font-bold text-[#071426]">{loading ? 'Submitting...' : 'Submit payment proof'}</button></> : <p className="rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200">Payment proof received. The job remains unpublished until payment is verified.</p>}</div>}{error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}</form></div></section>
}

function Plan({ selected, onClick, title, price, items }: { selected: boolean; onClick: () => void; title: string; price: string; items: string[] }) { return <button type="button" onClick={onClick} className={`w-full rounded-2xl border p-4 text-left transition ${selected ? 'border-[#d8b56b]/60 bg-[#d8b56b]/10' : 'border-white/10 bg-white/[.03]'}`}><div className="flex items-center justify-between"><span className="font-bold text-white">{title}</span><span className="font-black text-[#d8b56b]">{price}</span></div><div className="mt-2 flex flex-wrap gap-3">{items.map(i => <span key={i} className="inline-flex items-center gap-1 text-xs text-slate-400"><Check className="h-3 w-3 text-[#d8b56b]" />{i}</span>)}</div></button> }
