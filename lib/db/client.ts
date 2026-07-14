import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

/**
 * Browser-side Supabase client (for Client Components only).
 * Falls back to a placeholder URL at build time when env vars are absent —
 * the placeholder is never used for real requests since client components
 * only execute in the browser where NEXT_PUBLIC_* vars are always present.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
  )
}
