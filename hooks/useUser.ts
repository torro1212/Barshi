'use client'

// Apply Object.is polyfill for Safari before importing Zustand
if (typeof window !== 'undefined' && typeof Object.is !== 'function') {
  Object.is = function (x, y) {
    if (x === y) {
      return x !== 0 || 1 / x === 1 / (y as number)
    } else {
      return x !== x && y !== y
    }
  }
}

import { useEffect } from 'react'
import { createClient } from '@/lib/db/client'
import { isLocalMode, LOCAL_USER_ID } from '@/lib/local-mode'
import { useUserStore } from '@/stores/userStore'
import { identifyUser, resetIdentity } from '@/lib/posthog'
import type { Profile } from '@/types'

const LOCAL_PROFILE: Profile = {
  id: LOCAL_USER_ID,
  username: 'you',
  avatar_url: null,
  bio: null,
  account_status: 'active',
  restriction_until: null,
  created_at: new Date().toISOString(),
}

/**
 * Syncs the Supabase auth session with the Zustand user store.
 * Call this once in the root client layout.
 */
export function useUserSync() {
  const { setProfile, clearUser } = useUserStore()

  useEffect(() => {
    // Local mode — no Supabase configured. Auto-"login" with a mock profile
    // so the create → build flow works end-to-end for local testing.
    if (isLocalMode()) {
      setProfile(LOCAL_PROFILE)
      return
    }

    const supabase = createClient()

    // Safety timeout: if Supabase doesn't respond in 4s, treat as logged out
    const timeout = setTimeout(() => {
      clearUser()
    }, 4000)

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      clearTimeout(timeout)
      if (!user) {
        clearUser()
        resetIdentity()
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(profile)
      if (profile) identifyUser(profile.id, { username: profile.username })
    }).catch(() => {
      clearTimeout(timeout)
      clearUser()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) {
        clearUser()
        resetIdentity()
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      setProfile(profile)
      if (profile) identifyUser(profile.id, { username: profile.username })
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Get current user profile from the store */
export function useProfile() {
  return useUserStore((state) => state.profile)
}

/** Check if user is authenticated */
export function useIsAuthenticated() {
  return useUserStore((state) => state.isAuthenticated)
}
