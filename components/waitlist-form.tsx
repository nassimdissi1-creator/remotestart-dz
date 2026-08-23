'use client'

import { useState, type FormEvent } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, User, Mail, Sparkles, Link2 } from 'lucide-react'

type Status = 'idle' | 'loading' | 'success' | 'error'

type ApiError = {
  error?: string
  code?: string | null
  message?: string | null
}

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

    const payload = {
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      skills: skills.trim(),
      linkedin_url: linkedin.trim(),
    }

    if (payload.full_name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) || !payload.skills) {
      setStatus('error')
      setErrorMsg('يرجى إدخال الاسم والبريد الإلكتروني والمهارات بشكل صحيح.')
      return
    }

    try {
      const response = await fetch('/api/talent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = (await response.json().catch(() => null)) as ApiError | null

      if (response.ok) {
        setStatus('success')
        setFullName('')
        setEmail('')
        setSkills('')
        setLinkedin('')
        return
      }

      console.error('Talent signup API error:', {
        status: response.status,
        code: data?.code,
        message: data?.message,
        error: data?.error,
      })

      setStatus('error')
      if (response.status === 409) {
        setErrorMsg('هذا البريد الإلكتروني مسجّل بالفعل.')
      } else if (data?.code || data?.message) {
        setErrorMsg(`خطأ قاعدة البيانات (${data.code ?? response.status}): ${data.message ?? data.error ?? 'Unknown error'}`)
      } else {
        setErrorMsg(data?.error || 'تعذر إكمال التسجيل. حاول مرة أخرى.')
      }
    } catch (error) {
      console.error('Talent signup network error:', error)
      setStatus('error')
      setErrorMsg('تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى.')
    }
  }

  if (status === 'success') {
    return (
      <div role="status" aria-live="polite" className="rounded-2xl border border-[#d8b56b]/25 bg-[#d8b56b]/10 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#d8b56b] text-[#071426]"><CheckCircle2 className="h-7 w-7" /></div>
        <p className="mt-5 font-display text-xl font-bold text-white">تم تسجيلك بنجاح 🎉</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-300">ملفك أصبح ضمن قائمة المواهب. سنخبرك عند توفر الفرص المناسبة.</p>
      </div>
    )
  }

  const fieldClass = 'h-13 w-full rounded-xl border border-white/10 bg-[#071426]/70 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#d8b56b]/60 focus:ring-2 focus:ring-[#d8b56b]/15'

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم الكامل" htmlFor="full-name" icon={<User className="h-4 w-4" />}>
          <input id="full-name" name="full_name" type="text" autoComplete="name" required minLength={2} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="محمد بن علي" className={fieldClass} />
        </Field>
        <Field label="البريد الإلكتروني" htmlFor="email" icon={<Mail className="h-4 w-4" />}>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={fieldClass} />
        </Field>
      </div>

      <Field label="أهم مهاراتك" htmlFor="skills" icon={<Sparkles className="h-4 w-4" />} hint="افصل المهارات بفاصلة">
        <input id="skills" name="skills" type="text" required value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Marketing, Customer Support, Shopify" className={fieldClass} />
      </Field>

      <Field label="LinkedIn" htmlFor="linkedin" icon={<Link2 className="h-4 w-4" />} hint="اختياري">
        <input id="linkedin" name="linkedin_url" type="url" inputMode="url" autoComplete="url" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/your-profile" className={fieldClass} />
      </Field>

      {status === 'error' && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{errorMsg}</p>}

      <button type="submit" disabled={status === 'loading'} className="group flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#d8b56b] px-6 text-sm font-extrabold text-[#071426] transition hover:-translate-y-0.5 hover:bg-[#e4c47f] focus:outline-none focus:ring-2 focus:ring-[#d8b56b]/50 disabled:cursor-not-allowed disabled:opacity-70">
        {status === 'loading' ? <><Loader2 className="h-5 w-5 animate-spin" /> جارٍ حفظ ملفك...</> : <>انضم إلى قائمة المواهب <ArrowLeft className="h-5 w-5 transition group-hover:-translate-x-1" /></>}
      </button>
      <p className="text-center text-[11px] leading-5 text-slate-500">بياناتك تُستخدم فقط للتواصل بشأن فرص RemoteStart-DZ. لن نبيع بياناتك.</p>
    </form>
  )
}

function Field({ label, htmlFor, icon, hint, children }: { label: string; htmlFor: string; icon: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-300"><span className="text-[#d8b56b]">{icon}</span><label htmlFor={htmlFor}>{label}</label>{hint && <span className="font-normal text-slate-600">({hint})</span>}</div>
      {children}
    </div>
  )
}
