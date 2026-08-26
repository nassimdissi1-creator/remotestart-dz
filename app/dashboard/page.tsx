'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

type Talent = {
  id: string
  full_name: string | null
  email: string | null
  skills: string[] | null
  linkedin_url: string | null
  is_pro: boolean | null
  featured_until: string | null
  ai_cv_reviews_remaining: number | null
  ai_cv_reviews_period_start: string | null
  ai_cv_reviews_period_end: string | null
}

type Subscription = {
  id: string
  plan_id: string
  status: string
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  provider: string | null
  created_at: string
}

type Plan = {
  id: string
  code: string
  name: string
  price_amount: number | string
  currency: string
  billing_interval: string
  ai_cv_reviews_per_month: number | null
}

type PaymentOrder = {
  reference: string
  product_code: string
  amount_usd: number | string
  payment_method: string
  status: string
  currency: string | null
  created_at: string
  paid_at: string | null
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatMoney(amount: number | string, currency: string) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return `${amount} ${currency}`
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value) + ` ${currency}`
}

function humanProduct(code: string) {
  if (code === 'talent_pro') return 'Talent Pro Plus'
  if (code === 'job_standard') return 'Standard Job Post'
  if (code === 'job_featured') return 'Featured Job Post'
  return code.replaceAll('_', ' ')
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [email, setEmail] = useState<string | null>(null)
  const [talent, setTalent] = useState<Talent | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [talentProPlan, setTalentProPlan] = useState<Plan | null>(null)
  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setError(null)

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData.session) {
      router.replace('/#talents')
      return
    }

    const user = sessionData.session.user
    setEmail(user.email ?? null)

    const [talentResult, subscriptionResult, planResult, ordersResult] = await Promise.all([
      supabase
        .from('talents')
        .select(
          'id,full_name,email,skills,linkedin_url,is_pro,featured_until,ai_cv_reviews_remaining,ai_cv_reviews_period_start,ai_cv_reviews_period_end',
        )
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('talent_subscriptions')
        .select(
          'id,plan_id,status,current_period_start,current_period_end,cancel_at_period_end,provider,created_at',
        )
        .eq('talent_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('billing_plans')
        .select('id,code,name,price_amount,currency,billing_interval,ai_cv_reviews_per_month')
        .eq('code', 'talent_pro')
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('payment_orders')
        .select('reference,product_code,amount_usd,payment_method,status,currency,created_at,paid_at')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const firstError =
      talentResult.error || subscriptionResult.error || planResult.error || ordersResult.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setTalent(talentResult.data as Talent | null)
    setSubscription(subscriptionResult.data as Subscription | null)
    setTalentProPlan(planResult.data as Plan | null)
    setOrders((ordersResult.data ?? []) as PaymentOrder[])
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    void loadDashboard()

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/#talents')
        return
      }
      setEmail(session.user.email ?? null)
      void loadDashboard()
    })

    return () => {
      authSubscription.unsubscribe()
    }
  }, [loadDashboard, router, supabase])

  async function refresh() {
    setRefreshing(true)
    await loadDashboard()
    setRefreshing(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/#talents')
    router.refresh()
  }

  const isPro = useMemo(() => {
    if (!talent || !subscription) return false
    if (subscription.status !== 'active' || !talent.is_pro) return false
    if (subscription.current_period_end) {
      return new Date(subscription.current_period_end).getTime() > Date.now()
    }
    return true
  }, [subscription, talent])

  const reviewLimit = Number(talentProPlan?.ai_cv_reviews_per_month ?? 5)
  const reviewRemaining = isPro
    ? Math.max(0, Math.min(reviewLimit, Number(talent?.ai_cv_reviews_remaining ?? 0)))
    : 0
  const reviewUsed = Math.max(0, reviewLimit - reviewRemaining)
  const reviewProgress = reviewLimit > 0 ? Math.min(100, (reviewRemaining / reviewLimit) * 100) : 0

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#071426] text-slate-300">
        Loading your dashboard…
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#071426] px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8b56b] font-black text-[#071426]">R</span>
              <span className="font-bold">RemoteStart-DZ</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">Talent Dashboard</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={signOut}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
            >
              Sign out
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
            Could not load your dashboard: {error}
          </div>
        )}

        {!talent ? (
          <section className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d8b56b]">Profile setup required</p>
            <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">Your account is signed in, but your talent profile is not initialized.</h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Signed in as <span className="text-slate-200">{email}</span>. Talent Pro payments must be attached to the same Supabase user ID as your talent profile, so we will not create or activate a payment against an unlinked profile.
            </p>
            <button
              type="button"
              onClick={() => router.push('/#talents')}
              className="mt-6 rounded-xl bg-[#d8b56b] px-5 py-3 text-sm font-bold text-[#071426] transition hover:brightness-110"
            >
              Complete talent profile
            </button>
          </section>
        ) : (
          <>
            <section className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
              <div className="rounded-3xl border border-white/10 bg-white/[.035] p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d8b56b]">Welcome back</p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h1 className="text-3xl font-extrabold">{talent.full_name || 'Your talent account'}</h1>
                    <p className="mt-2 text-slate-400">{talent.email || email}</p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${isPro ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/10 text-slate-300'}`}>
                    {isPro ? 'Talent Pro Plus · Active' : 'Talent Free'}
                  </span>
                </div>
              </div>

              <div className="rounded-3xl border border-[#d8b56b]/20 bg-[#d8b56b]/5 p-6">
                <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d8b56b]">Plan</p>
                <p className="mt-3 text-xl font-bold">{isPro ? 'Talent Pro Plus' : 'Talent Free'}</p>
                {isPro && subscription?.current_period_end ? (
                  <p className="mt-2 text-sm text-slate-400">Active until {formatDate(subscription.current_period_end)}</p>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">Upgrade to unlock premium features.</p>
                )}
              </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[.035] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d8b56b]">AI CV Review</p>
                    <h2 className="mt-2 text-2xl font-extrabold">{reviewRemaining} / {reviewLimit}</h2>
                    <p className="mt-1 text-sm text-slate-400">Reviews remaining in your current Talent Pro period.</p>
                  </div>
                  <span className="rounded-xl bg-[#d8b56b]/10 px-3 py-2 text-xs font-bold text-[#d8b56b]">Included</span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#d8b56b] transition-all" style={{ width: `${reviewProgress}%` }} />
                </div>
                <div className="mt-3 flex justify-between text-xs text-slate-500">
                  <span>{reviewUsed} used</span>
                  <span>{reviewLimit} monthly limit</span>
                </div>
                <p className="mt-5 text-sm text-slate-400">
                  AI CV Review is included in Talent Pro Plus. There is no separate AI CV Review purchase.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[.035] p-6">
                <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d8b56b]">Subscription</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Status</span><span className="font-semibold">{subscription?.status || 'Free'}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Provider</span><span className="font-semibold">{subscription?.provider || '—'}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Period start</span><span>{formatDate(subscription?.current_period_start ?? null)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Period end</span><span>{formatDate(subscription?.current_period_end ?? null)}</span></div>
                  {subscription?.cancel_at_period_end && <p className="rounded-xl bg-amber-300/10 p-3 text-amber-200">Cancellation is scheduled for the end of this period.</p>}
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-white/10 bg-white/[.035] p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d8b56b]">Recent payments</p>
                  <h2 className="mt-2 text-xl font-bold">Payment history</h2>
                </div>
                {isPro && talentProPlan && <p className="text-sm text-slate-400">Talent Pro Plus: {formatMoney(talentProPlan.price_amount, talentProPlan.currency)} / {talentProPlan.billing_interval}</p>}
              </div>

              {orders.length === 0 ? (
                <p className="mt-5 rounded-2xl border border-white/10 p-4 text-sm text-slate-400">No payment orders yet.</p>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="pb-3 pr-4">Product</th>
                        <th className="pb-3 pr-4">Amount</th>
                        <th className="pb-3 pr-4">Method</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {orders.map((order) => (
                        <tr key={order.reference}>
                          <td className="py-3 pr-4 font-medium">{humanProduct(order.product_code)}</td>
                          <td className="py-3 pr-4">{formatMoney(order.amount_usd, order.currency || 'USD')}</td>
                          <td className="py-3 pr-4 capitalize">{order.payment_method}</td>
                          <td className="py-3 pr-4 capitalize">{order.status.replaceAll('_', ' ')}</td>
                          <td className="py-3">{formatDate(order.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
