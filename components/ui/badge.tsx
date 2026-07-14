import { cn } from '@/lib/utils'
import { TYPE_META } from './TypeIcon'
import type { ProjectType } from '@/types'

interface TypeBadgeProps {
  type: ProjectType
  className?: string
  /** show the type's lucide icon before the label */
  showEmoji?: boolean
}

export function TypeBadge({ type, className, showEmoji = false }: TypeBadgeProps) {
  const { Icon, accent, label } = TYPE_META[type] ?? TYPE_META.game

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold', className)}
      style={{ background: `${accent}1f`, color: accent, border: `1px solid ${accent}40` }}
    >
      {showEmoji && <Icon size={11} strokeWidth={2.4} />}
      {label}
    </span>
  )
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'brand'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)] border-[var(--color-border)]',
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    danger:  'bg-red-500/10 text-red-400 border-red-500/20',
    brand:   'bg-[var(--color-brand)]/10 text-[var(--color-brand-light)] border-[var(--color-brand)]/20',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
