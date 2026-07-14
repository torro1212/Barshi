import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendEmail, sendModerationAlert } from './client'

describe('email client — graceful no-op without configuration', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('sendEmail returns false when RESEND_API_KEY is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const ok = await sendEmail({ to: 'a@b.com', subject: 'x', html: '<p>x</p>' })
    expect(ok).toBe(false)
  })

  it('sendModerationAlert returns false when no alert address is set', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('MODERATION_ALERT_EMAIL', '')
    const ok = await sendModerationAlert({ projectId: 'p1', projectTitle: 'Test', reason: 'spam' })
    expect(ok).toBe(false)
  })

  it('sendModerationAlert returns false when addressed but email is unconfigured', async () => {
    // Alert address present but no Resend key → still a no-op (no throw, no send)
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('MODERATION_ALERT_EMAIL', 'mods@barshi.app')
    const ok = await sendModerationAlert({ projectId: 'p1', projectTitle: 'Test', reason: 'spam' })
    expect(ok).toBe(false)
  })
})
