const stats = [
  { value: '+$3,000', label: 'متوسط الرواتب الشهرية' },
  { value: '+50', label: 'شركة عالمية شريكة' },
  { value: '+1,200', label: 'كفاءة جزائرية مسجّلة' },
  { value: '%94', label: 'نسبة رضا المستخدمين' },
]

export function Stats() {
  return (
    <section className="border-y border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden px-6 py-10 sm:gap-8 lg:grid-cols-4 lg:py-12">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center gap-1.5 text-center"
          >
            <span className="font-display text-3xl font-black text-accent-gold sm:text-4xl">
              {stat.value}
            </span>
            <span className="text-sm leading-relaxed text-muted-foreground">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
