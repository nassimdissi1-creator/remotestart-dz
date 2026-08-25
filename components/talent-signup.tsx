'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type PendingProfile = {
  full_name: string
  skills: string
  linkedin_url: string
}

type AuthSession = {
  access_token?: string
  refresh_token?: string
  user?: {
    id?: string
    email?: string
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const PENDING_PROFILE_KEY = 'remotestart_pending_talent_profile'

async function authRequest(path: string, body: Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase Auth is not configured.')
  }

  const response = await fetch(
    `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/${path}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.msg ||
        data?.message ||
        data?.error_description ||
        'Authentication request failed.',
    )
  }

  return data as AuthSession
}

async function createTalentProfile(
  accessToken: string,
  profile: PendingProfile,
) {
  const response = await fetch('/api/talent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(profile),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.error || 'Could not create your talent profile.',
    )
  }

  return data
}

export function TalentSignup() {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [skills, setSkills] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const pendingProfile = useMemo<PendingProfile>(
    () => ({
      full_name: fullName,
      skills,
      linkedin_url: linkedinUrl,
    }),
    [fullName, skills, linkedinUrl],
  )

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')

    if (!hash) return

    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')

    if (!accessToken) return

    const pending = sessionStorage.getItem(PENDING_PROFILE_KEY)

    if (!pending) return

    try {
      const profile = JSON.parse(pending) as PendingProfile

      setLoading(true)
      setMessage('Email confirmed. Creating your profile…')

      void createTalentProfile(accessToken, profile)
        .then(() => {
          sessionStorage.removeItem(PENDING_PROFILE_KEY)
          setFullName(profile.full_name)
          setSkills(profile.skills)
          setLinkedinUrl(profile.linkedin_url)
          setMessage('Your RemoteStart-DZ talent profile is ready.')
        })
        .catch((profileError: unknown) => {
          setError(
            profileError instanceof Error
              ? profileError.message
              : 'Could not create your profile.',
          )
        })
        .finally(() => setLoading(false))
    } finally {
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}${window.location.search}`,
      )
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      if (password.length < 8) {
        throw new Error('Use a password with at least 8 characters.')
      }

      if (mode === 'signup') {
        if (fullName.trim().length < 2) {
          throw new Error('Please enter your full name.')
        }

        if (!skills.trim()) {
          throw new Error('Please enter at least one skill.')
        }

        const profile = {
          full_name: fullName.trim(),
          skills: skills.trim(),
          linkedin_url: linkedinUrl.trim(),
        }

        sessionStorage.setItem(
          PENDING_PROFILE_KEY,
          JSON.stringify(profile),
        )

        const data = await authRequest('signup', {
          email: email.trim().toLowerCase(),
          password,
          options: {
            email_redirect_to: window.location.origin,
          },
        })

        if (data.access_token) {
          await createTalentProfile(data.access_token, profile)
          sessionStorage.removeItem(PENDING_PROFILE_KEY)
          setMessage('Account created and talent profile saved.')
          return
        }

        setMessage(
          'Account created. Please confirm your email, then return here and sign in to finish your profile.',
        )
        setMode('signin')
        return
      }

      const data = await authRequest('token?grant_type=password', {
        email: email.trim().toLowerCase(),
        password,
      })

      if (!data.access_token) {
        throw new Error(
          'Authentication succeeded but no access token was returned.',
        )
      }

      const stored = sessionStorage.getItem(PENDING_PROFILE_KEY)
      const profile = stored
        ? (JSON.parse(stored) as PendingProfile)
        : pendingProfile

      await createTalentProfile(data.access_token, profile)
      sessionStorage.removeItem(PENDING_PROFILE_KEY)
      setMessage('Signed in. Your talent profile is ready.')
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
          onClick={() => {
            setMode('signup')
            setMessage('')
            setError('')
          }}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'signup' ? 'bg-[#d8b56b] text-[#071426]' : 'text-slate-400'}`}
        >
          Create account
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signin')
            setMessage('')
            setError('')
          }}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'signin' ? 'bg-[#d8b56b] text-[#071426]' : 'text-slate-400'}`}
        >
          Sign in
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
              : 'Sign in & finish profile'}
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
