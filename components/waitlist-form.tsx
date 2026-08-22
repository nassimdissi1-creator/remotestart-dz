'use client'

import { useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  User,
  Mail,
  Code2,
} from 'lucide-react'
import { joinWaitlist } from '@/lib/waitlist'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function WaitlistForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [skills, setSkills] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (status === 'loading') return

    setStatus('loading')
    setErrorMsg('')

    const result = await joinWaitlist({
      fullName,
      email,
      skills,
      linkedin,
    })

    if (result.ok) {
      setStatus('success')
      setFullName('')
      setEmail('')
      setSkills('')
      setLinkedin('')
      return
    }

    setStatus('error')

    if (result.reason === 'invalid') {
      setErrorMsg(
        'يرجى التأكد من إدخال جميع البيانات المطلوبة بشكل صحيح.'
      )
    } else if (result.reason === 'duplicate') {
      setErrorMsg('هذا البريد الإلكتروني مسجّل بالفعل.')
    } else {
      setErrorMsg(
        'حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.'
      )
    }
  }

  if (status === 'success') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-4 rounded-2xl border border-accent-green/30 bg-accent-green/10 p-8 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-green text-accent-green-foreground">
          <CheckCircle2
            className="h-8 w-8"
            aria-hidden="true"
          />
        </div>

        <p className="font-display text-xl font-bold text-foreground">
          تم تسجيلك بنجاح 🎉
        </p>

        <p className="max-w-md leading-relaxed text-muted-foreground">
          شكراً لانضمامك إلى RemoteStart-DZ.
          سنخبرك عند توفر فرص العمل العالمية المناسبة لك.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full space-y-4"
      noValidate
    >
      {/* Full Name */}
      <div className="relative">
        <label
          htmlFor="full-name"
          className="mb-2 block text-sm font-medium text-foreground"
        >
          الاسم الكامل
        </label>

        <User
          className="pointer-events-none absolute right-4 top-[42px] h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />

        <input
          id="full-name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="مثال: Nassim Dissi"
          className="h-13 w-full rounded-xl border border-input bg-secondary pr-12 pl-4 text-base text-foreground placeholder:text-muted-foreground focus:border-accent-green focus:outline-none focus:ring-2 focus:ring-accent-green/40"
        />
      </div>

      {/* Email */}
      <div className="relative">
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-medium text-foreground"
        >
          البريد الإلكتروني
        </label>

        <Mail
          className="pointer-events-none absolute right-4 top-[42px] h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />

        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-13 w-full rounded-xl border border-input bg-secondary pr-12 pl-4 text-base text-foreground placeholder:text-muted-foreground focus:border-accent-green focus:outline-none focus:ring-2 focus:ring-accent-green/40"
        />
      </div>

      {/* Skills */}
      <div className="relative">
        <label
          htmlFor="skills"
          className="mb-2 block text-sm font-medium text-foreground"
        >
          المهارات
        </label>

        <Code2
          className="pointer-events-none absolute right-4 top-[42px] h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />

        <input
          id="skills"
          type="text"
          required
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="مثال: Customer Support, Shopify, Marketing"
          className="h-13 w-full rounded-xl border border-input bg-secondary pr-12 pl-4 text-base text-foreground placeholder:text-muted-foreground focus:border-accent-green focus:outline-none focus:ring-2 focus:ring-accent-green/40"
        />

        <p className="mt-1.5 text-xs text-muted-foreground">
          افصل بين المهارات بفاصلة
        </p>
      </div>

      {/* LinkedIn */}
      <div className="relative">
        <label
          htmlFor="linkedin"
          className="mb-2 block text-sm font-medium text-foreground"
        >
          LinkedIn
          <span className="mr-1 text-xs text-muted-foreground">
            (اختياري)
          </span>
        </label>

        <Code2
          className="pointer-events-none absolute right-4 top-[42px] h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />

        <input
          id="linkedin"
          type="url"
          inputMode="url"
          autoComplete="url"
          value={linkedin}
          onChange={(e) => setLinkedin(e.target.value)}
          placeholder="https://linkedin.com/in/yourname"
          className="h-13 w-full rounded-xl border border-input bg-secondary pr-12 pl-4 text-base text-foreground placeholder:text-muted-foreground focus:border-accent-green focus:outline-none focus:ring-2 focus:ring-accent-green/40"
        />
      </div>

      {/* Error */}
      {status === 'error' && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {errorMsg}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'loading'}
        className="group inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent-green px-7 text-base font-bold text-accent-green-foreground transition-colors hover:bg-accent-green/90 focus:outline-none focus:ring-2 focus:ring-accent-green/50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === 'loading' ? (
          <>
            <Loader2
              className="h-5 w-5 animate-spin"
              aria-hidden="true"
            />
            جارٍ التسجيل...
          </>
        ) : (
          <>
            انضم إلى RemoteStart-DZ
            <ArrowLeft
              className="h-5 w-5 transition-transform group-hover:-translate-x-1"
              aria-hidden="true"
            />
          </>
        )}
      </button>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        نحترم خصوصيتك. لن نشارك بياناتك مع جهات غير مصرح بها.
      </p>
    </form>
  )
}
