import { BadgeCheck, BrainCircuit, Globe2 } from 'lucide-react'

const features = [
  {
    icon: Globe2,
    title: 'فرص عالمية موثوقة',
    description:
      'وظائف عن بعد من شركات حقيقية ومُوثّقة حول العالم، مُتاحة لك مباشرة من الجزائر.',
  },
  {
    icon: BrainCircuit,
    title: 'مطابقة بالذكاء الاصطناعي',
    description:
      'خوارزمية ذكية تحلل مهاراتك وخبراتك لتربطك بالفرص الأنسب لك تلقائياً.',
  },
  {
    icon: BadgeCheck,
    title: 'مسار آمن وشفاف',
    description:
      'تحقّق من أصحاب العمل ووضوح تام في الشروط، لتعمل بثقة وراحة بال كاملة.',
  },
]

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <h2 className="text-balance font-display text-3xl font-bold text-foreground sm:text-4xl">
          لماذا RemoteStart-DZ؟
        </h2>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
          نبني الجسر بين الكفاءات الجزائرية وأفضل فرص العمل عن بعد عالمياً.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-border bg-card p-7 transition-colors hover:border-accent-green/40"
          >
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent-green/12 text-accent-green">
              <feature.icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mb-2 font-display text-xl font-bold text-foreground">
              {feature.title}
            </h3>
            <p className="leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
