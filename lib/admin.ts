import { createServerClientInstance } from '@/lib/db/server'

/** Admin user IDs, from env (comma-separated Supabase user UUIDs). */
function adminIds(): string[] {
  return (process.env.BARSHI_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isAdminId(userId: string | null | undefined): boolean {
  if (!userId) return false
  return adminIds().includes(userId)
}

/** Returns the current user's id if they're an admin, otherwise null. */
export async function requireAdmin(): Promise<string | null> {
  const supabase = await createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminId(user.id)) return null
  return user.id
}
