/**
 * Server + edge runtime instrumentation.
 * Initializes Sentry only when SENTRY_DSN is configured — otherwise a no-op,
 * so local dev and unconfigured deploys run without any error-tracking setup.
 */
import * as Sentry from '@sentry/nextjs'

export async function register() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === 'production',
  })
}

export const onRequestError = Sentry.captureRequestError
