'use client'

import { Sparkles, Code2, Check } from 'lucide-react'
import { useBuilderStore } from '@/stores/builderStore'

/** Rough target size of a generated project, used only to render a progress
 *  bar that feels alive. Real completion is signalled by the stream ending. */
const TARGET_CHARS = 9000

const CHECKLIST = [
  'Warming up the AI',
  'Designing the structure',
  'Writing the code',
  'Adding interactions',
  'Styling everything',
  'Almost ready',
]

/** Full-panel overlay shown in the builder while the first generation streams.
 *  Gives a live sense of progress: rotating status, a code-written meter fed by
 *  real streamed bytes, and a scrolling faux-code shimmer. */
export function BuildOverlay() {
  const { progressMessage, genChars, meta } = useBuilderStore()

  const pct = Math.min(98, Math.round((genChars / TARGET_CHARS) * 100))
  const linesWritten = Math.max(0, Math.round(genChars / 42)) // ~42 chars/line

  // Which checklist item is active, inferred from the current status text
  const activeStep = Math.max(0, CHECKLIST.findIndex((c) => progressMessage.startsWith(c)))

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[var(--color-surface-3)] rounded-[var(--radius-lg)] overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full blur-[110px] opacity-30 animate-pulse-glow"
          style={{ background: 'radial-gradient(circle, #8b5cf6 0%, #3b82f6 45%, transparent 70%)' }} />
      </div>

      <div className="relative w-full max-w-sm flex flex-col items-center text-center gap-6">
        {/* Icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-[var(--color-brand)]/15 border border-[var(--color-brand)]/30 flex items-center justify-center animate-float">
            <Code2 size={34} className="text-[var(--color-brand-light)]" />
          </div>
          <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-[var(--color-brand)] flex items-center justify-center animate-pulse-glow">
            <Sparkles size={14} className="text-white" />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1">
          <h2 className="text-lg font-black" style={{ fontFamily: 'var(--font-display)' }}>
            Building your {meta?.type ?? 'project'}
          </h2>
          <p key={progressMessage} className="text-sm text-[var(--color-brand-light)] animate-rise">
            {progressMessage || 'Getting started…'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full space-y-2">
          <div className="h-2 w-full rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{
                width: `${Math.max(6, pct)}%`,
                background: 'linear-gradient(90deg, #8b5cf6, #60a5fa, #22d3ee)',
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-[var(--color-text-dim)] font-mono">
            <span>{linesWritten > 0 ? `${linesWritten} lines written` : 'thinking…'}</span>
            <span>{pct}%</span>
          </div>
        </div>

        {/* Checklist */}
        <div className="w-full space-y-1.5 text-left">
          {CHECKLIST.map((label, i) => {
            const done = i < activeStep
            const active = i === activeStep
            return (
              <div key={label} className={`flex items-center gap-2.5 text-xs transition-opacity ${done || active ? 'opacity-100' : 'opacity-40'}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                  done ? 'bg-[var(--color-success)]' : active ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-surface)]'
                }`}>
                  {done
                    ? <Check size={10} className="text-white" />
                    : active
                      ? <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      : null}
                </span>
                <span className={done ? 'text-[var(--color-text-muted)] line-through' : active ? 'text-[var(--color-text)] font-semibold' : 'text-[var(--color-text-dim)]'}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
