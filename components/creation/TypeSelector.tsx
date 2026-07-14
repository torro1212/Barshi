'use client'

import { cn } from '@/lib/utils'
import type { ProjectType } from '@/types'

const TYPES: { value: ProjectType; label: string; icon: string; desc: string }[] = [
  { value: 'game',    icon: '🎮', label: 'Game',    desc: 'Jump, shoot, solve puzzles...' },
  { value: 'website', icon: '🌐', label: 'Website', desc: 'Fan page, store, your own site...' },
  { value: 'story',   icon: '📖', label: 'Story',   desc: 'Choose your path, read & decide...' },
  { value: 'tool',    icon: '🔧', label: 'Tool',    desc: 'Quiz, tracker, calculator...' },
  { value: 'world',   icon: '🌍', label: 'World',   desc: 'Explore a place, sandbox...' },
]

interface TypeSelectorProps {
  value: ProjectType | null
  onChange: (type: ProjectType) => void
}

export function TypeSelector({ value, onChange }: TypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {TYPES.map(({ value: type, icon, label, desc }) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={cn(
            'flex flex-col items-center gap-1.5 p-3 rounded-[var(--radius-lg)] border text-center transition-all',
            value === type
              ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-text)]'
              : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:border-[var(--color-border-light)] hover:text-[var(--color-text)]'
          )}
        >
          <span className="text-2xl">{icon}</span>
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs opacity-70">{desc}</span>
        </button>
      ))}
    </div>
  )
}
