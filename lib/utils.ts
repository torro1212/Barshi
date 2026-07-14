import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format large numbers: 1200 → "1.2k" */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

/** Generate a random gradient config for CSS covers */
export function randomCoverConfig() {
  const gradients = [
    { from: '#1a1a2e', to: '#16213e', accent: '#6c47ff' },
    { from: '#0d1117', to: '#161b22', accent: '#f97316' },
    { from: '#0f0c29', to: '#302b63', accent: '#ec4899' },
    { from: '#0a192f', to: '#112240', accent: '#3b82f6' },
    { from: '#1a0533', to: '#2d1b69', accent: '#a855f7' },
    { from: '#064e3b', to: '#065f46', accent: '#10b981' },
  ]
  const icons: Record<string, string> = {
    game: '🎮', website: '🌐', tool: '🔧', story: '📖',
    interface: '🖥️', simulation: '⚡', world: '🌍',
  }
  const grad = gradients[Math.floor(Math.random() * gradients.length)]
  return { ...grad, patternType: 'dots' as const, icons }
}

/** Truncate text to maxLen with ellipsis */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '…'
}

/** Compact relative time: "just now", "5m", "3h", "2d", "4w" */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo`
  return `${Math.floor(d / 365)}y`
}

/** Sleep utility for dev/testing */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
