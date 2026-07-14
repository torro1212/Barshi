import { Resend } from 'resend'

/**
 * Transactional email via Resend.
 *
 * Barshi's audience is minors, so we deliberately send very few emails and
 * never to the kids' inboxes for marketing. The only wired use is operational:
 * alerting the moderation team when new reports come in. Everything is a no-op
 * unless RESEND_API_KEY is set, so local dev and unconfigured deploys are safe.
 */

let _resend: Resend | null = null
function client(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = process.env.EMAIL_FROM || 'Barshi <notifications@barshi.app>'

interface SendArgs {
  to: string | string[]
  subject: string
  html: string
}

/** Send an email. Returns false (without throwing) when email isn't configured. */
export async function sendEmail({ to, subject, html }: SendArgs): Promise<boolean> {
  const resend = client()
  if (!resend) return false
  try {
    await resend.emails.send({ from: FROM, to, subject, html })
    return true
  } catch (err) {
    console.error('[email] send failed', err)
    return false
  }
}

/** Wrap body content in Barshi's minimal branded shell */
function shell(title: string, body: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;background:#06060f;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#e5e7eb;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#111120;border:1px solid #23233a;border-radius:16px;overflow:hidden;">
    <div style="padding:20px 24px;border-bottom:1px solid #23233a;">
      <span style="font-size:20px;font-weight:800;background:linear-gradient(135deg,#8b5cf6,#3b82f6);-webkit-background-clip:text;background-clip:text;color:transparent;">barshi</span>
    </div>
    <div style="padding:24px;">
      <h1 style="font-size:18px;margin:0 0 12px;color:#fff;">${title}</h1>
      ${body}
    </div>
  </div>
</body></html>`
}

/** Notify the moderation team that a project was reported. */
export async function sendModerationAlert(args: {
  projectId: string
  projectTitle: string
  reason: string
}): Promise<boolean> {
  const to = (process.env.MODERATION_ALERT_EMAIL || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (to.length === 0) return false

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://barshi.app'
  const body = `
    <p style="margin:0 0 8px;color:#9ca3af;line-height:1.6;">A project was just reported and needs review.</p>
    <p style="margin:0 0 4px;"><strong style="color:#fff;">${args.projectTitle}</strong></p>
    <p style="margin:0 0 16px;color:#9ca3af;">Reason: ${args.reason}</p>
    <a href="${appUrl}/moderation" style="display:inline-block;background:#8b5cf6;color:#fff;text-decoration:none;padding:10px 20px;border-radius:10px;font-weight:600;">Open moderation queue</a>
    <p style="margin:16px 0 0;color:#6b7280;font-size:12px;">Project ID: ${args.projectId}</p>
  `
  return sendEmail({ to, subject: `New report: ${args.projectTitle}`, html: shell('Content reported', body) })
}
