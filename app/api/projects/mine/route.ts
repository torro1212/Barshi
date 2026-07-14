import { NextResponse } from 'next/server'
import { createServerClientInstance } from '@/lib/db/server'
import { isLocalMode, LOCAL_USER_ID } from '@/lib/local-mode'
import { localStore } from '@/lib/local-store'

/** GET /api/projects/mine — returns all projects owned by the current user */
export async function GET() {
  if (isLocalMode()) {
    const projects = localStore
      .list()
      .filter((p) => p.creator_id === LOCAL_USER_ID && p.visibility !== 'removed')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((p) => ({
        ...p,
        creator: { id: LOCAL_USER_ID, username: 'you', avatar_url: null },
      }))
    return NextResponse.json(projects)
  }

  const supabase = await createServerClientInstance()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      creator:profiles!creator_id (
        id, username, avatar_url
      )
    `)
    .eq('creator_id', user.id)
    .neq('visibility', 'removed')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
