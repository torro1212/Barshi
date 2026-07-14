'use client'

import { Monitor, Cpu, Zap, Pencil } from 'lucide-react'
import type { ProjectMeta } from '@/types'

interface SystemMapProps {
  meta: ProjectMeta | null
  /** Called when a map item is clicked — (seed for the Change panel, raw label to locate) */
  onItemClick?: (seed: string, rawLabel: string) => void
}

export function SystemMap({ meta, onItemClick }: SystemMapProps) {
  if (!meta) {
    return (
      <div className="p-4 text-center text-xs text-[var(--color-text-dim)]">
        Generate a project to see its structure
      </div>
    )
  }

  return (
    <div className="p-3 space-y-4 overflow-y-auto h-full">
      <p className="text-xs font-semibold text-[var(--color-text-dim)] uppercase tracking-wider">
        Project Map
      </p>

      {/* Screens */}
      {meta.screens.length > 0 && (
        <Section
          icon={<Monitor size={13} />}
          title="Screens"
          items={meta.screens}
          onItemClick={onItemClick ? (item) => onItemClick(`Change the "${item}" screen: `, item) : undefined}
        />
      )}

      {/* Components */}
      {meta.components.length > 0 && (
        <Section
          icon={<Cpu size={13} />}
          title="Features"
          items={meta.components}
          onItemClick={onItemClick ? (item) => onItemClick(`Change the "${item}": `, item) : undefined}
        />
      )}

      {/* Theme */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-[var(--color-text-dim)] uppercase tracking-wider flex items-center gap-1.5">
          <Zap size={13} />
          Style
        </p>
        <button
          type="button"
          onClick={onItemClick ? () => onItemClick(`Change the style (currently "${meta.theme.mood}"): `, meta.theme.mood) : undefined}
          className="group flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-light)] transition-colors pl-4 py-0.5 text-left w-full"
        >
          <span className="truncate">{meta.theme.mood}</span>
          <Pencil size={10} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </button>
      </div>

      {onItemClick && (
        <p className="text-[10px] text-[var(--color-text-dim)] leading-relaxed pt-1 border-t border-[var(--color-border)]">
          Tap anything above to change it with AI
        </p>
      )}
    </div>
  )
}

function Section({
  icon,
  title,
  items,
  onItemClick,
}: {
  icon: React.ReactNode
  title: string
  items: string[]
  onItemClick?: (item: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-[var(--color-text-dim)] uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {title}
      </p>
      <ul className="space-y-0.5 pl-2.5">
        {items.map((item) => (
          <li key={item}>
            <button
              type="button"
              onClick={onItemClick ? () => onItemClick(item) : undefined}
              className="group flex items-center gap-1.5 w-full text-left text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-light)] hover:bg-[var(--color-brand)]/8 rounded-[6px] px-1.5 py-1 transition-colors"
            >
              <span className="truncate">{item}</span>
              <Pencil size={10} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
