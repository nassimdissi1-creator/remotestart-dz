'use client'

import { useState, type FormEvent } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { joinWaitlist } from '@/lib/waitlist'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (status === 'loading') return

    setStatus('loading')
    setErrorMsg('')

    const result = await joinWaitlist(email)

    if (result.ok) {
      setStatus('success')
      setEmail('')
      return
    }

    setStatus('error')
    if (result.reason === 'invalid') {
      setErrorMsg('يرجى إدخال بريد إلكتروني صحيح.')
    } else if (result.reason === 'duplicate') {
      setErrorMsg('هذا البريد مسجّل بالفعل في قائمة الانتظار.')
    } else {
      setErrorMsg('حدث خطأ ما، يرجى المحاولة مرة أخرى.')
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
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="text-balance font-display text-xl font-bold text-foreground">
          شكراً لك! تم تسجيلك بنجاح
        </p>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          سنخبرك فور إطلاق المنصة لتكون من أوائل المستفيدين.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Mail
            className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor="email" className="sr-only">
            البريد الإلكتروني
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (status === 'error') setStatus('idle')
            }}
            placeholder="أدخل بريدك الإلكتروني"
            className="h-14 w-full rounded-xl border border-input bg-secondary pr-12 pl-4 text-base text-foreground placeholder:text-muted-foreground focus:border-accent-green focus:outline-none focus:ring-2 focus:ring-accent-green/40"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'loading'}
          className="group inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-accent-green px-7 text-base font-bold text-accent-green-foreground transition-colors hover:bg-accent-green/90 focus:outline-none focus:ring-2 focus:ring-accent-green/50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              جارٍ التسجيل...
            </>
          ) : (
            <>
              انضم لقائمة الانتظار
              <ArrowLeft
                className="h-5 w-5 transition-transform group-hover:-translate-x-1"
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </div>

      {status === 'error' && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {errorMsg}
        </p>
      )}

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        نحترم خصوصيتك — لن نشارك بريدك مع أي جهة ولن نرسل رسائل مزعجة.
      </p>
    </form>
  )
}
