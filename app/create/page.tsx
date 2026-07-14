'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Lock } from 'lucide-react'
import { IntentForm } from '@/components/creation/IntentForm'
import { BuildPlanDisplay } from '@/components/creation/BuildPlanDisplay'
import { GenerationProgress } from '@/components/creation/GenerationProgress'
import { AppShell } from '@/components/nav/AppShell'
import { useIsAuthenticated } from '@/hooks/useUser'
import { useUserStore } from '@/stores/userStore'
import { useBuilderStore } from '@/stores/builderStore'
import { track, EVENTS } from '@/lib/posthog'
import type { BuildPlan, CreationIntent, ProjectType } from '@/types'

type Phase = 'intent' | 'plan' | 'generating'

export default function CreatePage() {
  const router = useRouter()
  const isAuth = useIsAuthenticated()
  const isLoading = useUserStore((s) => s.isLoading)
  const setBuilderPlan = useBuilderStore((s) => s.setBuildPlan)
  const resetBuilder = useBuilderStore((s) => s.reset)
  const [phase, setPhase] = useState<Phase>('intent')
  const [intent, setIntent] = useState<CreationIntent | null>(null)
  const [buildPlan, setBuildPlan] = useState<BuildPlan | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Read the preselected type from the URL once (client-side lazy init) so we
  // don't need a set-state effect or a Suspense boundary for useSearchParams.
  const [preselectedType] = useState<ProjectType | null>(() => {
    if (typeof window === 'undefined') return null
    return (new URLSearchParams(window.location.search).get('type') as ProjectType | null) ?? null
  })

  async function handleIntentSubmit(data: CreationIntent) {
    setError(null)
    setIntent(data)
    setPhase('plan')
    track(EVENTS.INTENT_SUBMITTED, { type: data.type ?? 'unspecified' })
    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.status === 401) {
        setPhase('intent')
        router.push('/login')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Plan generation failed')
      }
      const plan: BuildPlan = await res.json()
      setBuildPlan(plan)
    } catch (err) {
      setPhase('intent')
      const msg = err instanceof Error ? err.message : "Something went wrong. Check your connection and try again."
      setError(msg)
    }
  }

  async function handlePlanApprove(plan: BuildPlan) {
    setBuildPlan(plan)
    setPhase('generating')
    track(EVENTS.PLAN_APPROVED, { type: plan.type })

    const createRes = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, intent }),
    })

    if (createRes.status === 401) {
      router.push('/login')
      return
    }

    if (!createRes.ok) {
      setPhase('plan')
      setError("Couldn't start building. Try again!")
      return
    }

    const { id } = await createRes.json()
    // Hand off to builder store so /build/[id] can pick up the plan and generate
    resetBuilder()
    setBuilderPlan(plan)
    router.push(`/build/${id}?generate=1`)
  }

  // Show loading spinner while auth state is being determined
  if (isLoading) {
    return (
      <AppShell>
        <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-brand)] border-t-transparent animate-spin" />
        </div>
      </AppShell>
    )
  }

  // Not logged in — show sign-in gate
  if (!isAuth) {
    return (
      <AppShell>
        <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center p-4 text-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-brand)]/15 flex items-center justify-center">
            <Lock size={28} className="text-[var(--color-brand-light)]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>
              Sign in to start building
            </h1>
            <p className="text-[var(--color-text-muted)] text-sm max-w-xs mx-auto">
              Create a free account to build games, websites, tools, and stories with AI.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 cursor-pointer select-none active:scale-[0.96] bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)] h-11 text-sm rounded-[var(--radius-md)] px-6 glow-sm"
            >
              <Sparkles size={16} />
              Create free account
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 cursor-pointer select-none active:scale-[0.96] bg-[var(--color-surface-3)] text-[var(--color-text)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] h-11 text-sm rounded-[var(--radius-md)] px-6"
            >
              Sign in
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-4">
          {error && (
            <div className="rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 px-4 py-3 text-sm text-[var(--color-danger)] text-center">
              {error}
            </div>
          )}

          {phase === 'intent' && (
            <IntentForm onSubmit={handleIntentSubmit} initialType={preselectedType} />
          )}
          {phase === 'plan' && (
            <BuildPlanDisplay
              plan={buildPlan}
              onApprove={handlePlanApprove}
              onBack={() => { setPhase('intent'); setBuildPlan(null); setError(null) }}
            />
          )}
          {phase === 'generating' && buildPlan && (
            <GenerationProgress plan={buildPlan} />
          )}
        </div>
      </div>
    </AppShell>
  )
}
