import Image from 'next/image'
import { Sparkles } from 'lucide-react'
import { WaitlistForm } from '@/components/waitlist-form'

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* توهج خفيف في الخلفية */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,theme(colors.accent-green/0.14),transparent_45%)]"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:gap-8 lg:py-24">
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-green/30 bg-accent-green/10 px-4 py-1.5 text-sm font-medium text-accent-green">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            مطابقة الوظائف بالذكاء الاصطناعي
          </span>

          <h1 className="text-balance font-display text-4xl font-extrabold leading-tight text-foreground sm:text-5xl lg:text-6xl">
            اكتشف فرص عمل عالمية موثوقة وأنت في الجزائر
          </h1>

          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            سجّل الآن لتكون أول من يجرب تقنية المطابقة بالذكاء الاصطناعي للحصول
            على وظيفتك القادمة.
          </p>

          <div className="w-full max-w-xl">
            <WaitlistForm />
          </div>
        </div>

        <div className="relative">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-black/40">
            <Image
              src="/hero-remote.png"
              alt="محترف جزائري يعمل عن بعد من مكتبه المنزلي عبر الحاسوب المحمول"
              width={1024}
              height={1024}
              priority
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
