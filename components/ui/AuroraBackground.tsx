import { cn } from '@/lib/utils'

interface AuroraBackgroundProps {
  /** 'fixed' covers the viewport (page bg); 'absolute' fills the nearest positioned parent (section bg) */
  variant?: 'fixed' | 'absolute'
  /** Show the faint grid overlay */
  grid?: boolean
  className?: string
}

/**
 * Animated gradient "aurora" backdrop — two large blurred colour blobs drifting
 * on independent loops, over an optional grid and a static noise layer. Pure
 * CSS animation (GPU transforms), no JS, and disabled under prefers-reduced-motion.
 */
export function AuroraBackground({ variant = 'absolute', grid = true, className }: AuroraBackgroundProps) {
  return (
    <div
      aria-hidden
      className={cn(
        variant === 'fixed' ? 'fixed' : 'absolute',
        'inset-0 -z-10 overflow-hidden pointer-events-none',
        className,
      )}
    >
      {/* Blob 1 — violet */}
      <div
        className="absolute -top-1/3 left-1/4 w-[65vw] h-[65vw] max-w-[820px] max-h-[820px] rounded-full blur-[110px] opacity-40 animate-aurora"
        style={{ background: 'radial-gradient(circle, #8b5cf6 0%, #6d28d9 40%, transparent 70%)' }}
      />
      {/* Blob 2 — blue/cyan */}
      <div
        className="absolute top-1/4 -right-1/4 w-[60vw] h-[60vw] max-w-[760px] max-h-[760px] rounded-full blur-[120px] opacity-35 animate-aurora-2"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, #06b6d4 45%, transparent 72%)' }}
      />
      {/* Blob 3 — magenta accent, low */}
      <div
        className="absolute -bottom-1/4 left-1/3 w-[50vw] h-[50vw] max-w-[620px] max-h-[620px] rounded-full blur-[120px] opacity-25 animate-float"
        style={{ background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)' }}
      />

      {/* Faint grid */}
      {grid && (
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at 50% 30%, black 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 50% 30%, black 30%, transparent 80%)',
          }}
        />
      )}

      {/* Static film grain for texture */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          backgroundSize: '140px 140px',
        }}
      />
    </div>
  )
}
