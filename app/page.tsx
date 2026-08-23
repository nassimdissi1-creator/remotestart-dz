import { ArrowLeft, CheckCircle2, Globe2, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { Hero } from '@/components/hero'
import { Features } from '@/components/features'

const stats = [
  { value: '100%', label: 'Remote-first' },
  { value: '24/7', label: 'Global opportunities' },
  { value: '1 profile', label: 'Built for your career' },
  { value: 'AI', label: 'Smart matching' },
]

export default function Page() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#071426]">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_75%_10%,rgba(216,181,107,.12),transparent_28%),radial-gradient(circle_at_10%_35%,rgba(39,91,151,.18),transparent_30%)]" />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <a href="#top" className="flex items-center gap-3" aria-label="RemoteStart-DZ home">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d8b56b]/40 bg-[#d8b56b] text-xl font-black text-[#071426] shadow-[0_0_30px_rgba(216,181,107,.16)]">R</span>
          <span className="font-display text-lg font-extrabold tracking-tight text-white">RemoteStart<span className="text-[#d8b56b]">-DZ</span></span>
        </a>
        <a href="#join" className="rounded-full border border-white/10 bg-white/[.04] px-5 py-2.5 text-sm font-semibold text-white transition hover:border-[#d8b56b]/40 hover:bg-[#d8b56b]/10">انضم الآن</a>
      </header>

      <main id="top">
        <Hero />

        <section aria-label="RemoteStart-DZ stats" className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="border-b border-white/10 p-6 text-center last:border-0 sm:border-l lg:border-b-0">
                <div className="font-display text-2xl font-extrabold text-[#d8b56b]">{stat.value}</div>
                <div className="mt-1 text-xs font-medium text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <Features />

        <section id="join" className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
          <div className="relative overflow-hidden rounded-[2rem] border border-[#d8b56b]/20 bg-gradient-to-br from-[#102744] to-[#0a1a31] p-8 text-center sm:p-12 lg:p-16">
            <div aria-hidden className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#d8b56b]/10 blur-3xl" />
            <div className="relative mx-auto max-w-3xl">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d8b56b]/30 bg-[#d8b56b]/10 text-[#d8b56b]"><Sparkles className="h-5 w-5" /></div>
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl">Your next opportunity can be global.</h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">أنشئ ملفك المهني الآن، وكن من أوائل المواهب التي تحصل على فرص RemoteStart-DZ.</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#d8b56b]" /> ملف احترافي</span>
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#d8b56b]" /> فرص موثوقة</span>
                <span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-[#d8b56b]" /> شبكة عالمية</span>
              </div>
              <a href="#signup" className="mt-9 inline-flex items-center gap-2 rounded-xl bg-[#d8b56b] px-7 py-4 font-bold text-[#071426] shadow-[0_10px_40px_rgba(216,181,107,.18)] transition hover:-translate-y-0.5 hover:bg-[#e4c47f]">ابدأ ملفك الآن <ArrowLeft className="h-5 w-5" /></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© {new Date().getFullYear()} RemoteStart-DZ. All rights reserved.</p>
          <p>Built for Algerian talent with a global ambition.</p>
        </div>
      </footer>
    </div>
  )
}
