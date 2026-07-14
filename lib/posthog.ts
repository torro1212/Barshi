'use client'

import posthog from 'posthog-js'

/** Initialize PostHog — call once in a client layout */
export function initPostHog() {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    capture_pageview: false, // Manual pageview tracking
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: true, // Mask all inputs for privacy (kids platform)
    },
  })
}

/** All tracked events in Barshi */
export const EVENTS = {
  // ── Creation funnel ──────────────────────────
  CREATE_STARTED:       'create_started',
  TYPE_SELECTED:        'type_selected',
  INTENT_SUBMITTED:     'intent_submitted',
  PLAN_APPROVED:        'plan_approved',
  GENERATION_STARTED:   'generation_started',
  GENERATION_COMPLETE:  'generation_complete',
  GENERATION_FAILED:    'generation_failed',
  FALLBACK_USED:        'fallback_template_used',

  // ── Builder ──────────────────────────────────
  EDIT_MADE:            'edit_made',        // action: 'add'|'change'|'fix'|'smarter'
  UNDO_USED:            'undo_used',
  VERSION_RESTORED:     'version_restored',

  // ── Publish funnel ───────────────────────────
  PUBLISH_STARTED:      'publish_started',
  SAFETY_BLOCKED:       'safety_blocked',
  PUBLISH_COMPLETE:     'publish_complete',

  // ── Community ────────────────────────────────
  PROJECT_PLAYED:       'project_played',
  LIKE_CLICKED:         'like_clicked',
  REMIX_CLICKED:        'remix_clicked',
  PROFILE_VIEWED:       'profile_viewed',
  SEARCH_USED:          'search_used',

  // ── Safety ───────────────────────────────────
  REPORT_SUBMITTED:     'report_submitted',

  // ── Auth ─────────────────────────────────────
  SIGNUP_STARTED:       'signup_started',
  SIGNUP_COMPLETE:      'signup_complete',
  LOGIN_COMPLETE:       'login_complete',
  RATE_LIMIT_HIT:       'rate_limit_hit',
} as const

export type BarshiEvent = (typeof EVENTS)[keyof typeof EVENTS]

/** Track an event with optional properties */
export function track(event: BarshiEvent, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  posthog.capture(event, properties)
}

/** Identify a logged-in user */
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  posthog.identify(userId, properties)
}

/** Reset identity on logout */
export function resetIdentity() {
  if (typeof window === 'undefined') return
  posthog.reset()
}

export default posthog
