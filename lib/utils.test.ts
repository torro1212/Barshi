import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatCount, truncate, timeAgo, cn } from './utils'

describe('formatCount', () => {
  it('returns raw numbers below 1000', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(999)).toBe('999')
  })
  it('formats thousands with k', () => {
    expect(formatCount(1000)).toBe('1.0k')
    expect(formatCount(1200)).toBe('1.2k')
    expect(formatCount(15000)).toBe('15.0k')
  })
  it('formats millions with m', () => {
    expect(formatCount(1_000_000)).toBe('1.0m')
    expect(formatCount(2_500_000)).toBe('2.5m')
  })
})

describe('truncate', () => {
  it('leaves short strings untouched', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })
  it('truncates and appends an ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hell…')
  })
})

describe('cn', () => {
  it('merges and dedupes tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-sm', false && 'hidden', 'font-bold')).toBe('text-sm font-bold')
  })
})

describe('timeAgo', () => {
  afterEach(() => vi.useRealTimers())

  function at(base: string, offsetMs: number): string {
    return new Date(new Date(base).getTime() - offsetMs).toISOString()
  }

  it('formats a range of deltas', () => {
    const now = '2026-01-01T00:00:00.000Z'
    vi.useFakeTimers()
    vi.setSystemTime(new Date(now))

    expect(timeAgo(at(now, 5_000))).toBe('just now')
    expect(timeAgo(at(now, 90_000))).toBe('1m')
    expect(timeAgo(at(now, 2 * 3600_000))).toBe('2h')
    expect(timeAgo(at(now, 3 * 86_400_000))).toBe('3d')
    expect(timeAgo(at(now, 14 * 86_400_000))).toBe('2w')
  })

  it('returns empty string for invalid input', () => {
    expect(timeAgo('not-a-date')).toBe('')
  })
})
