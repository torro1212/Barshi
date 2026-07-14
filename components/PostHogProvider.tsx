'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { initPostHog } from '@/lib/posthog'
import posthog from 'posthog-js'

/** Tracks a manual pageview whenever the route changes */
function PageviewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
    const qs = searchParams.toString()
    posthog.capture('$pageview', { $current_url: window.location.origin + pathname + (qs ? `?${qs}` : '') })
  }, [pathname, searchParams])

  return null
}

/** Initializes PostHog once and tracks client-side pageviews.
 *  A no-op when NEXT_PUBLIC_POSTHOG_KEY is unset (local dev). */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog()
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  )
}
