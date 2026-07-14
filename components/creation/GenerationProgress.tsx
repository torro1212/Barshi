'use client'

import { useEffect, useState } from 'react'
import type { BuildPlan } from '@/types'

const STEPS: Record<string, string[]> = {
  game:    ['Building your world…', 'Creating screens…', 'Adding player & enemies…', 'Setting up the rules…', 'Styling everything…', 'Almost ready…'],
  website: ['Designing your pages…', 'Building the layout…', 'Adding buttons & links…', 'Styling your site…', 'Connecting the flow…', 'Almost ready…'],
  story:   ['Writing your world…', 'Creating scenes…', 'Adding choices…', 'Building the endings…', 'Setting the mood…', 'Almost ready…'],
  tool:    ['Building the interface…', 'Setting up inputs…', 'Connecting logic…', 'Adding interactions…', 'Styling it…', 'Almost ready…'],
  default: ['Building your project…', 'Creating components…', 'Adding interactions…', 'Setting up the flow…', 'Styling everything…', 'Almost ready…'],
}

interface GenerationProgressProps {
  plan: BuildPlan
}

export function GenerationProgress({ plan }: GenerationProgressProps) {
  const steps = STEPS[plan.type] ?? STEPS.default
  const [stepIdx, setStepIdx] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIdx((i) => (i < steps.length - 1 ? i + 1 : i))
    }, 2200)
    return () => clearInterval(timer)
  }, [steps.length])

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-16 text-center">
      {/* Animated orb */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-[var(--color-brand)]/20 animate-ping absolute inset-0" />
        <div className="w-20 h-20 rounded-full bg-[var(--color-brand)]/10 flex items-center justify-center relative">
          <div className="w-10 h-10 rounded-full bg-[var(--color-brand)] animate-pulse" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold">{plan.title}</h2>
        <p
          key={stepIdx}
          className="text-[var(--color-text-muted)] text-sm animate-in fade-in duration-500"
        >
          {steps[stepIdx]}
        </p>
      </div>

      {/* Step dots */}
      <div className="flex gap-1.5">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i <= stepIdx
                ? 'bg-[var(--color-brand)] w-4'
                : 'bg-[var(--color-border)] w-1.5'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
