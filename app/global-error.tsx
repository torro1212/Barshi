'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#06060f', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 56 }}>🛠️</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Oops — something broke</h1>
          <p style={{ color: '#9ca3af', maxWidth: 360, margin: 0, lineHeight: 1.5 }}>
            Don&apos;t worry, your projects are safe. Let&apos;s try that again.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 8, background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
