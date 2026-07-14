/**
 * Local-mode detection.
 *
 * "Local mode" bypasses auth and stores projects in server memory, so it is
 * strictly a development convenience. It requires BOTH:
 *   1. An explicit opt-in (`BARSHI_LOCAL_MODE=true`) or a dev build with no
 *      real Supabase URL configured, AND
 *   2. Not running a production build — a missing env var in production must
 *      fail closed (real auth required), never silently disable auth.
 */

export const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000001'

function hasRealSupabaseURL(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return false
  if (url.includes('placeholder') || url.includes('your-project')) return false
  return true
}

export function isLocalMode(): boolean {
  // Explicit opt-in works in any environment — this is a deliberate operator
  // choice for self-hosting a personal, DB-less instance (e.g. behind Tailscale).
  // The NEXT_PUBLIC_ variant is inlined into the browser bundle so the client
  // and server agree; the bare var covers server-only contexts.
  if (
    process.env.BARSHI_LOCAL_MODE === 'true' ||
    process.env.NEXT_PUBLIC_BARSHI_LOCAL_MODE === 'true'
  ) {
    return true
  }
  // Without the explicit flag, production fails closed: a missing Supabase URL
  // must require real auth, never silently disable it.
  if (process.env.NODE_ENV === 'production') return false
  return !hasRealSupabaseURL()
}
