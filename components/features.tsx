import { BadgeCheck, BrainCircuit, Globe2, ArrowUpRight } from 'lucide-react'

const features = [
  {
    icon: Globe2,
    eyebrow: 'GLOBAL ACCESS',
    title: 'فرص عالمية، من مكانك',
    description: 'اكتشف فرص العمل عن بعد من شركات ومجالات مختلفة حول العالم، بدون الحاجة لمغادرة الجزائر.',
  },
  {
    icon: BrainCircuit,
    eyebrow: 'SMART MATCHING',
    title: 'مطابقة أذكى لمهاراتك',
    description: 'نحوّل مهاراتك وخبرتك إلى ملف واضح يساعدك على الوصول إلى الفرص الأقرب لمسارك المهني.',
  },
  {
    icon: BadgeCheck,
    eyebrow: 'TRUST & QUALITY',
    title: 'تجربة مبنية على الثقة',
    description: 'نركز على الوضوح والاحتراف والتحقق حتى تبدأ بحثك عن العمل عن بعد بثقة أكبر.',
  },
]

export function Features() {
  return (
    <section id="why" className="mx-auto max-w-7xl scroll-mt-8 px-6 py-20 lg:px-8 lg:py-28">
      <div className="grid items-end gap-8 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="text-xs font-bold tracking-[.22em] text-[#d8b56b]">WHY REMOTESTART-DZ</p>
          <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">أكثر من قائمة وظائف.</h2>
        </div>
        <p className="max-w-2xl text-base leading-8 text-slate-400 lg:justify-self-end lg:text-lg">نبني تجربة احترافية تساعد المواهب الجزائرية على تقديم نفسها للعالم، واكتشاف فرص تناسب مهاراتها وطموحاتها.</p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {features.map((feature) => (
          <article key={feature.title} className="group rounded-2xl border border-white/10 bg-white/[.035] p-7 transition duration-300 hover:-translate-y-1 hover:border-[#d8b56b]/30 hover:bg-white/[.055]">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d8b56b]/20 bg-[#d8b56b]/10 text-[#d8b56b]">
                <feature.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <ArrowUpRight className="h-5 w-5 text-slate-600 transition group-hover:text-[#d8b56b]" />
            </div>
            <p className="mt-8 text-[10px] font-bold tracking-[.2em] text-[#d8b56b]">{feature.eyebrow}</p>
            <h3 className="mt-2 font-display text-xl font-bold text-white">{feature.title}</h3>
            <p className="mt-3 leading-7 text-slate-400">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
