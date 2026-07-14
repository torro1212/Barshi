'use client'

import { useUserSync } from '@/hooks/useUser'

/** Client boundary that runs the Supabase ↔ Zustand auth sync once at app start */
export function UserProvider({ children }: { children: React.ReactNode }) {
  useUserSync()
  return <>{children}</>
}
