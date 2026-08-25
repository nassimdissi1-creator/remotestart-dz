import Image from 'next/image'
import { ArrowLeft, CheckCircle2, Globe2, Sparkles } from 'lucide-react'
import { TalentSignup } from '@/components/talent-signup'

export function Hero() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 pb-20 pt-10 lg:px-8 lg:pb-28 lg:pt-16">
      <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <div className="flex flex-col items-start" dir="rtl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#d8b56b]/25 bg-[#d8b56b]/10 px-4 py-2 text-xs font-bold text-[#e4c47f]">
            <Sparkles className="h-4 w-4" />
            منصة الجيل الجديد للعمل عن بعد
          </div>

          <h1 className="max-w-3xl font-display text-4xl font-black leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-[4.35rem]">
            ابنِ مسيرتك المهنية العالمية <span className="text-[#d8b56b]">من الجزائر.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-9 text-slate-300 sm:text-xl">
            RemoteStart-DZ تربط المواهب الجزائرية بالفرص العالمية الموثوقة، مع تجربة احترافية مصممة لتساعدك على الوصول إلى العمل الذي تستحقه.
          </p>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#d8b56b]" /> شركات موثوقة</span>
            <span className="inline-flex items-center gap-2"><Globe2 className="h-4 w-4 text-[#d8b56b]" /> فرص عالمية</span>
          </div>

          <div id="signup" className="mt-10 w-full max-w-xl scroll-mt-8" dir="ltr">
            <div className="rounded-2xl border border-[#d8b56b]/20 bg-white/[.045] p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-6">
              <div className="mb-6 text-center">
                <p className="text-xs font-bold uppercase tracking-[.25em] text-[#d8b56b]">For talent</p>
                <h2 className="mt-3 font-display text-2xl font-extrabold text-white sm:text-3xl">
                  Your global career starts here.
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Create your account or sign in to manage your RemoteStart-DZ talent profile.
                </p>
              </div>
              <TalentSignup />
            </div>
          </div>

          <a href="#why" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-[#d8b56b]">
            اكتشف كيف تعمل المنصة <ArrowLeft className="h-4 w-4" />
          </a>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none" dir="ltr">
          <div aria-hidden className="absolute -inset-5 rounded-[2rem] bg-[#d8b56b]/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c1e38] p-2 shadow-2xl shadow-black/40">
            <div className="relative overflow-hidden rounded-[1.5rem]">
              <Image
                src="/hero-remote.png"
                alt="Professional working remotely with a laptop"
                width={1024}
                height={1024}
                priority
                className="aspect-[4/5] w-full object-cover"
              />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-[#071426]/85 p-4 backdrop-blur-xl sm:inset-x-6 sm:bottom-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#d8b56b]">GLOBAL CAREER SIGNAL</p>
                    <p className="mt-1 text-sm font-bold text-white">Ready for your next remote role</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d8b56b] text-[#071426]"><Globe2 className="h-5 w-5" /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
