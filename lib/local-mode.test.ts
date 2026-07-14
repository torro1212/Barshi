import { describe, it, expect, vi, afterEach } from 'vitest'
import { isLocalMode } from './local-mode'

describe('isLocalMode', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('fails closed in production without the explicit flag', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('BARSHI_LOCAL_MODE', '')
    vi.stubEnv('NEXT_PUBLIC_BARSHI_LOCAL_MODE', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(isLocalMode()).toBe(false)
  })

  it('allows explicit opt-in even in production (self-hosted DB-less instance)', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('BARSHI_LOCAL_MODE', 'true')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(isLocalMode()).toBe(true)
  })

  it('is true when explicitly opted in outside production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('BARSHI_LOCAL_MODE', 'true')
    expect(isLocalMode()).toBe(true)
  })

  it('is true in development when no real Supabase URL is set', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('BARSHI_LOCAL_MODE', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(isLocalMode()).toBe(true)
  })

  it('treats placeholder URLs as not-real (local mode)', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('BARSHI_LOCAL_MODE', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://your-project.supabase.co')
    expect(isLocalMode()).toBe(true)
  })

  it('is false in development when a real Supabase URL is configured', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('BARSHI_LOCAL_MODE', '')
    vi.stubEnv('NEXT_PUBLIC_BARSHI_LOCAL_MODE', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abcdefgh.supabase.co')
    expect(isLocalMode()).toBe(false)
  })
})
