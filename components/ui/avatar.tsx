import { cn } from '@/lib/utils'

interface AvatarProps {
  src?: string | null
  username: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_CLASSES = {
  sm:  'h-7 w-7 text-[10px]',
  md:  'h-9 w-9 text-sm',
  lg:  'h-12 w-12 text-base',
  xl:  'h-16 w-16 text-xl',
}

const GRADIENT_PAIRS: [string, string][] = [
  ['#8b5cf6', '#3b82f6'],
  ['#f97316', '#ec4899'],
  ['#ec4899', '#8b5cf6'],
  ['#3b82f6', '#06b6d4'],
  ['#a855f7', '#8b5cf6'],
  ['#10b981', '#3b82f6'],
  ['#f59e0b', '#f97316'],
  ['#ef4444', '#ec4899'],
]

function getUserGradient(username: string): [string, string] {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return GRADIENT_PAIRS[Math.abs(hash) % GRADIENT_PAIRS.length]
}

export function Avatar({ src, username, size = 'md', className }: AvatarProps) {
  const initial = (username[0] || '?').toUpperCase()
  const [from, to] = getUserGradient(username)

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-black overflow-hidden flex-shrink-0',
        SIZE_CLASSES[size],
        className
      )}
      style={src ? undefined : { background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={username} className="w-full h-full object-cover" />
      ) : (
        <span className="text-white drop-shadow-sm">{initial}</span>
      )}
    </div>
  )
}
