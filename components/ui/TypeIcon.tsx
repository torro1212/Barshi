import {
  Gamepad2, Globe, Wrench, BookOpen, MonitorSmartphone, Atom, Orbit,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectType } from '@/types'

/** One distinct lucide icon + accent per project type — replaces plain emojis. */
export const TYPE_META: Record<ProjectType, { Icon: LucideIcon; accent: string; label: string }> = {
  game:       { Icon: Gamepad2,          accent: '#fb923c', label: 'Game' },
  website:    { Icon: Globe,             accent: '#60a5fa', label: 'Website' },
  tool:       { Icon: Wrench,            accent: '#c084fc', label: 'Tool' },
  story:      { Icon: BookOpen,          accent: '#f472b6', label: 'Story' },
  interface:  { Icon: MonitorSmartphone, accent: '#67e8f9', label: 'Interface' },
  simulation: { Icon: Atom,              accent: '#facc15', label: 'Simulation' },
  world:      { Icon: Orbit,             accent: '#34d399', label: 'World' },
}

interface TypeIconProps {
  type: ProjectType
  size?: number
  className?: string
}

/** Bare icon for a project type. */
export function TypeIcon({ type, size = 16, className }: TypeIconProps) {
  const { Icon } = TYPE_META[type] ?? TYPE_META.game
  return <Icon size={size} className={className} />
}

interface TypeIconBadgeProps {
  type: ProjectType
  /** pixel size of the rounded badge */
  size?: number
  className?: string
  /** add a soft glow ring in the type accent */
  glow?: boolean
}

/** A rounded gradient badge containing the type icon — the modern replacement
 *  for the emoji tiles used across covers and cards. */
export function TypeIconBadge({ type, size = 44, className, glow = true }: TypeIconBadgeProps) {
  const { Icon, accent } = TYPE_META[type] ?? TYPE_META.game
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-2xl border', className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${accent}33 0%, ${accent}14 100%)`,
        borderColor: `${accent}44`,
        boxShadow: glow ? `0 0 22px ${accent}44, inset 0 1px 0 ${accent}22` : undefined,
      }}
    >
      <Icon size={size * 0.5} color={accent} strokeWidth={2.2} />
    </span>
  )
}
