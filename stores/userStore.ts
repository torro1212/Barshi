// Apply Object.is polyfill for Safari before creating store
if (typeof Object.is !== 'function') {
  Object.is = function (x, y) {
    if (x === y) {
      return x !== 0 || 1 / x === 1 / (y as number)
    } else {
      return x !== x && y !== y
    }
  }
}

import { create } from 'zustand'
import type { Profile } from '@/types'

interface UserState {
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean

  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  clearUser: () => void
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  isLoading: true,
  isAuthenticated: false,

  setProfile: (profile) =>
    set({ profile, isAuthenticated: profile !== null, isLoading: false }),

  setLoading: (isLoading) => set({ isLoading }),

  clearUser: () =>
    set({ profile: null, isAuthenticated: false, isLoading: false }),
}))
