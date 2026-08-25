'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

type Mode = 'signin' | 'signup'

type ProfileForm = {
  full_name: string
  skills: string
  linkedin_url: string
}

export function TalentSignup() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  const [mode, setMode] = useState<Mode>('signup')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [skills, setSkills] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function switchMode(nextMode: Mode) {
    setMode(nextMode)
    setMessage('')
    setError('')
    setPassword('')
  }

  async function createTalentProfile(
    accessToken: string,
    userId: string,
    profile: ProfileForm,
  ) {
    const response = await fetch('/api/talent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        // The API derives the authoritative identity from the JWT.
        // userId is included only as an explicit consistency check.
        id: userId,
        ...profile,
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(data?.error || 'Could not create your talent profile.')
    }

    return data
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const normalizedEmail = email.trim().toLowerCase()

      if (!normalizedEmail) {
        throw new Error('Please enter your email address.')
      }

      if (password.length < 8) {
        throw new Error('Use a password with at least 8 characters.')
      }

      if (mode === 'signin') {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          })

        if (signInError) throw signInError

        if (!data.user || !data.session) {
          throw new Error('Sign in succeeded but no active session was returned.')
        }

        // Sign In deliberately does NOT INSERT into public.talents.
        router.push('/dashboard')
        router.refresh()
        return
      }

      if (fullName.trim().length < 2) {
        throw new Error('Please enter your full name.')
      }

      if (!skills.trim()) {
        throw new Error('Please enter at least one skill.')
      }

      if (linkedinUrl.trim()) {
        try {
          const linkedin = new URL(linkedinUrl.trim())
          const hostname = linkedin.hostname.toLowerCase()
          if (
            !['http:', 'https:'].includes(linkedin.protocol) ||
            (hostname !== 'linkedin.com' && !hostname.endsWith('.linkedin.com'))
          ) {
            throw new Error('Please enter a valid LinkedIn URL.')
          }
        } catch {
          throw new Error('Please enter a valid LinkedIn URL.')
        }
      }

      const profile: ProfileForm = {
        full_name: fullName.trim(),
        skills: skills.trim(),
        linkedin_url: linkedinUrl.trim(),
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (signUpError) throw signUpError

      if (!data.user) {
        throw new Error('Account creation did not return a user.')
      }

      // The secure profile insert is allowed only after we have the
      // authenticated user's real auth.users ID and session JWT.
      if (!data.session) {
        setMessage(
          'Account created. Please confirm your email, then sign in to continue.',
        )
        setMode('signin')
        return
      }

      await createTalentProfile(
        data.session.access_token,
        data.user.id,
        profile,
      )

      setMessage('Account created successfully. Redirecting…')
      router.push('/dashboard')
      router.refresh()
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2 rounded-xl border border-white/10 bg-black/10 p-1">
        <button
          type="button"
          onClick={() => switchMode('signin')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            mode === 'signin'
              ? 'bg-[#d8b56b] text-[#071426]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => switchMode('signup')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            mode === 'signup'
              ? 'bg-[#d8b56b] text-[#071426]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <input
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Full name"
            autoComplete="name"
            className="w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#d8b56b]/60"
          />
        )}

        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          autoComplete="email"
          className="w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#d8b56b]/60"
        />

        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password (8+ characters)"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className="w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#d8b56b]/60"
        />

        {mode === 'signup' && (
          <>
            <input
              required
              value={skills}
              onChange={(event) => setSkills(event.target.value)}
              placeholder="Skills — e.g. React, Node.js, Python"
              className="w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#d8b56b]/60"
            />

            <input
              value={linkedinUrl}
              onChange={(event) => setLinkedinUrl(event.target.value)}
              placeholder="LinkedIn URL (optional)"
              inputMode="url"
              autoComplete="url"
              className="w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#d8b56b]/60"
            />
          </>
        )}

        <button
          disabled={loading}
          type="submit"
          className="w-full rounded-xl bg-[#d8b56b] px-5 py-3 font-bold text-[#071426] transition hover:bg-[#e5c783] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? 'Please wait…'
            : mode === 'signup'
              ? 'Create my free profile'
              : 'Sign In'}
        </button>
      </form>

      {message && (
        <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-300">
          {message}
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
