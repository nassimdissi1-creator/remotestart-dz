'use client'

import { useState } from 'react'
import { BriefcaseBusiness, Check, Loader2, Sparkles } from 'lucide-react'

export function EmployerJobForm() {
  const [plan, setPlan] = useState<'standard' | 'featured'>('standard')
  const [form, setForm] = useState({ company_name: '', job_title: '', salary: '', description: '', contact_email: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const response = await fetch('/api/jobs/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, plan }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not create job.')
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر إنشاء الإعلان.') } finally { setLoading(false) }
  }

  const input = 'w-full rounded-xl border border-white/10 bg-[#071426]/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#d8b56b]/60'

  return <section id="employers" className="mx-auto max-w-7xl px-6 py-20 lg:px-8"><div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-start"><div><p className="text-xs font-bold uppercase tracking-[.25em] text-[#d8b56b]">For employers</p><h2 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">Publish your next remote role.</h2><p className="mt-4 leading-8 text-slate-400">أنشئ إعلان الوظيفة، ادفع إلكترونيًا، وبعد تأكيد الدفع يصبح الإعلان منشورًا تلقائيًا دون انتظار فريق إداري.</p><div className="mt-8 grid gap-3"><Plan selected={plan === 'standard'} onClick={() => setPlan('standard')} title="Standard Job Post" price="$199" items={['Live job listing', 'Global talent reach']} /><Plan selected={plan === 'featured'} onClick={() => setPlan('featured')} title="Featured Job Post" price="$299" items={['Top placement', 'Featured badge', 'Higher visibility']} /></div></div><form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/[.035] p-7 shadow-2xl"><div className="mb-6 flex items-center gap-3"><span className="rounded-xl bg-[#d8b56b]/10 p-3 text-[#d8b56b]"><BriefcaseBusiness className="h-5 w-5" /></span><div><h3 className="font-bold text-white">Job posting</h3><p className="text-xs text-slate-500">Payment activates publication automatically</p></div></div><div className="grid gap-4 sm:grid-cols-2"><input required className={input} placeholder="Company name" value={form.company_name} onChange={e => setForm({...form, company_name:e.target.value})} /><input required className={input} placeholder="Job title" value={form.job_title} onChange={e => setForm({...form, job_title:e.target.value})} /><input className={input} placeholder="Salary / range" value={form.salary} onChange={e => setForm({...form, salary:e.target.value})} /><input required type="email" className={input} placeholder="Contact email" value={form.contact_email} onChange={e => setForm({...form, contact_email:e.target.value})} /></div><textarea required minLength={20} rows={7} className={`${input} mt-4`} placeholder="Describe the role, responsibilities and requirements" value={form.description} onChange={e => setForm({...form, description:e.target.value})} />{error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<button disabled={loading} className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#d8b56b] font-extrabold text-[#071426]">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Continue to secure payment <Sparkles className="h-4 w-4" /></>}</button><p className="mt-3 text-center text-[11px] text-slate-500">Selected plan: {plan === 'featured' ? '$299 Featured' : '$199 Standard'}</p></form></div></section>
}

function Plan({ selected, onClick, title, price, items }: { selected: boolean; onClick: () => void; title: string; price: string; items: string[] }) {
  return <button type="button" onClick={onClick} className={`w-full rounded-2xl border p-4 text-left transition ${selected ? 'border-[#d8b56b]/60 bg-[#d8b56b]/10' : 'border-white/10 bg-white/[.03]'}`}><div className="flex items-center justify-between"><span className="font-bold text-white">{title}</span><span className="font-black text-[#d8b56b]">{price}</span></div><div className="mt-2 flex flex-wrap gap-3">{items.map(i => <span key={i} className="inline-flex items-center gap-1 text-xs text-slate-400"><Check className="h-3 w-3 text-[#d8b56b]" />{i}</span>)}</div></button>
}
