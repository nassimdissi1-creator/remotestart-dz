import { Briefcase } from 'lucide-react'
import { Hero } from '@/components/hero'
import { Features } from '@/components/features'

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-green text-accent-green-foreground">
            <Briefcase className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="font-display text-lg font-extrabold text-foreground">
            RemoteStart<span className="text-accent-green">-DZ</span>
          </span>
        </div>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          قريباً — قائمة الانتظار مفتوحة الآن
        </span>
      </header>

      <main>
        <Hero />
        <Features />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} RemoteStart-DZ — كل الحقوق محفوظة.
          </p>
          <p>صُنع بشغف للكفاءات الجزائرية</p>
        </div>
      </footer>
    </div>
  )
}
