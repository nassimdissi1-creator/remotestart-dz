import { ArrowLeft, BriefcaseBusiness, CheckCircle2, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { Hero } from '@/components/hero'
import { Features } from '@/components/features'
import { EmployerJobForm } from '@/components/employer-job-form'

const stats = [
  { value: '100%', label: 'Remote-first' },
  { value: '24/7', label: 'Global opportunities' },
  { value: 'Pro', label: 'Featured talent' },
  { value: 'AI', label: 'Career intelligence' },
]

export default function Page() {
  return <div className="min-h-screen overflow-hidden bg-[#071426]"><div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_75%_10%,rgba(216,181,107,.12),transparent_28%),radial-gradient(circle_at_10%_35%,rgba(39,91,151,.18),transparent_30%)]" />
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8"><a href="#top" className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d8b56b] text-xl font-black text-[#071426]">R</span><span className="font-display text-lg font-extrabold text-white">RemoteStart<span className="text-[#d8b56b]">-DZ</span></span></a><nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex"><a href="#talents" className="hover:text-white">Talents</a><a href="#employers" className="hover:text-white">Employers</a></nav><a href="#join" className="rounded-full border border-white/10 bg-white/[.04] px-5 py-2.5 text-sm font-semibold text-white">انضم الآن</a></header>
    <main id="top"><Hero /><section aria-label="RemoteStart-DZ stats" className="mx-auto max-w-7xl px-6 lg:px-8"><div className="grid overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] sm:grid-cols-2 lg:grid-cols-4">{stats.map(s => <div key={s.label} className="border-b border-white/10 p-6 text-center lg:border-b-0 lg:border-l"><div className="font-display text-2xl font-extrabold text-[#d8b56b]">{s.value}</div><div className="mt-1 text-xs text-slate-400">{s.label}</div></div>)}</div></section><Features />
      <section id="talents" className="mx-auto max-w-7xl px-6 py-20 lg:px-8"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div><p className="text-xs font-bold uppercase tracking-[.25em] text-[#d8b56b]">For talent</p><h2 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-5xl">Turn your profile into a career asset.</h2><p className="mt-5 leading-8 text-slate-400">سجّل ملفك مجانًا، ثم اختر Pro لزيادة الظهور أو AI CV Review لتحسين فرصك في الحصول على مقابلات عالمية.</p><div className="mt-7 space-y-3 text-sm text-slate-300"><div className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-[#d8b56b]" /> تفعيل الميزات تلقائيًا بعد الدفع</div><div className="flex gap-2"><ShieldCheck className="h-5 w-5 text-[#d8b56b]" /> الدفع يُتحقق منه عبر webhook آمن</div><div className="flex gap-2"><Sparkles className="h-5 w-5 text-[#d8b56b]" /> أدوات مدفوعة موجهة للنتيجة</div></div></div><div id="join" className="rounded-3xl border border-[#d8b56b]/20 bg-white/[.035] p-7"><h3 className="mb-2 text-xl font-bold text-white">Build your talent profile</h3><p className="mb-6 text-sm text-slate-500">ابدأ مجانًا، ثم قم بالترقية عندما تكون جاهزًا.</p><div id="signup" /></div></div></section>
      <EmployerJobForm />
      <section className="mx-auto max-w-7xl px-6 pb-24 lg:px-8"><div className="rounded-[2rem] border border-[#d8b56b]/20 bg-gradient-to-br from-[#102744] to-[#0a1a31] p-10 text-center"><BriefcaseBusiness className="mx-auto h-8 w-8 text-[#d8b56b]" /><h2 className="mt-4 font-display text-3xl font-extrabold text-white">Hire without the hiring friction.</h2><p className="mx-auto mt-3 max-w-2xl text-slate-400">وظائف مدفوعة، نشر تلقائي، وظهور أمام مواهب RemoteStart-DZ العالمية.</p><a href="#employers" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#d8b56b] px-6 py-3 font-bold text-[#071426]">Post a job <ArrowLeft className="h-4 w-4" /></a></div></section>
    </main><footer className="border-t border-white/10"><div className="mx-auto flex max-w-7xl justify-between px-6 py-8 text-sm text-slate-500 lg:px-8"><p>© {new Date().getFullYear()} RemoteStart-DZ.</p><p className="hidden sm:block">Built for Algerian talent with a global ambition.</p></div></footer>
  </div>
}
