import { describe, it, expect, vi, afterEach } from 'vitest'
import { isAdminId } from './admin'

describe('isAdminId', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is false when no admins are configured', () => {
    vi.stubEnv('BARSHI_ADMIN_USER_IDS', '')
    expect(isAdminId('user-1')).toBe(false)
  })

  it('is false for null/undefined regardless of config', () => {
    vi.stubEnv('BARSHI_ADMIN_USER_IDS', 'user-1')
    expect(isAdminId(null)).toBe(false)
    expect(isAdminId(undefined)).toBe(false)
  })

  it('matches an id in a comma-separated list, ignoring whitespace', () => {
    vi.stubEnv('BARSHI_ADMIN_USER_IDS', ' user-1 , user-2,user-3 ')
    expect(isAdminId('user-1')).toBe(true)
    expect(isAdminId('user-2')).toBe(true)
    expect(isAdminId('user-3')).toBe(true)
  })

  it('does not match a non-admin id', () => {
    vi.stubEnv('BARSHI_ADMIN_USER_IDS', 'user-1,user-2')
    expect(isAdminId('user-999')).toBe(false)
  })

  it('does not treat empty entries as a wildcard match', () => {
    vi.stubEnv('BARSHI_ADMIN_USER_IDS', 'user-1,,user-2')
    expect(isAdminId('')).toBe(false)
  })
})
