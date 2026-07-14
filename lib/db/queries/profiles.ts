import { createServerClientInstance } from '@/lib/db/server'
import type { Profile } from '@/types'

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const supabase = await createServerClientInstance()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (error) return null
  return data as Profile
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = await createServerClientInstance()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Profile
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const supabase = await createServerClientInstance()
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('username', username)

  return (count ?? 0) > 0
}
