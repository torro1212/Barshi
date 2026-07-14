import { cn } from '@/lib/utils'
import { TYPE_META } from '@/components/ui/TypeIcon'
import type { CoverConfig, ProjectType } from '@/types'

interface CoverCardProps {
  cover: CoverConfig
  type: ProjectType
  title: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function CoverCard({ cover, type, title, className, size = 'md' }: CoverCardProps) {
  const { Icon, accent: typeAccent } = TYPE_META[type] ?? TYPE_META.game
  // Prefer the cover's stored accent, fall back to the type accent
  const accent = cover.accentColor || typeAccent

  const sizeClasses = {
    sm: 'aspect-[4/3]',
    md: 'aspect-[4/3]',
    lg: 'aspect-video',
  }

  const iconBox = { sm: 44, md: 58, lg: 84 }[size]
  const titleSize = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }[size]

  return (
    <div
      className={cn(
        'group/cover relative w-full rounded-[var(--radius-lg)] overflow-hidden flex flex-col items-center justify-center select-none',
        sizeClasses[size],
        className,
      )}
      style={{ background: `linear-gradient(145deg, ${cover.gradientFrom} 0%, ${cover.gradientTo} 100%)` }}
    >
      {/* Noise texture for depth */}
      <div
        className="absolute inset-0 opacity-[0.15] mix-blend-overlay"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          backgroundSize: '100px 100px',
        }}
      />

      {/* Pattern */}
      {cover.patternType === 'dots' && (
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: `radial-gradient(${accent} 1.5px, transparent 1.5px)`, backgroundSize: '18px 18px' }}
        />
      )}
      {cover.patternType === 'grid' && (
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
            backgroundSize: '22px 22px',
          }}
        />
      )}

      {/* Radial glow from bottom */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 100%, ${accent}55 0%, transparent 65%)` }} />
      {/* Top vignette */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 50%, rgba(0,0,0,0.25) 100%)' }} />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-2.5 px-3">
        <span className="relative inline-flex items-center justify-center">
          {/* Rotating conic halo behind the icon */}
          <span
            className="absolute inset-[-30%] rounded-full opacity-60 blur-md animate-pulse-glow"
            style={{ background: `conic-gradient(from 0deg, ${accent}00, ${accent}aa, ${accent}00)` }}
          />
          <span
            className="relative inline-flex items-center justify-center rounded-2xl border backdrop-blur-sm transition-transform duration-300 group-hover/cover:scale-110"
            style={{
              width: iconBox,
              height: iconBox,
              background: `linear-gradient(135deg, ${accent}3a 0%, ${accent}12 100%)`,
              borderColor: `${accent}55`,
              boxShadow: `0 0 24px ${accent}66, inset 0 1px 0 ${accent}33`,
            }}
          >
            <Icon size={iconBox * 0.48} color={accent} strokeWidth={2.2} style={{ filter: `drop-shadow(0 0 8px ${accent}aa)` }} />
          </span>
        </span>
        <span
          className={cn('font-bold text-center leading-tight px-2', titleSize)}
          style={{ color: accent, textShadow: `0 0 20px ${accent}66, 0 1px 3px rgba(0,0,0,0.5)` }}
        >
          {title}
        </span>
      </div>
    </div>
  )
}
