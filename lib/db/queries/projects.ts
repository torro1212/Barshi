import { createServerClientInstance } from '@/lib/db/server'
import { isLocalMode, LOCAL_USER_ID } from '@/lib/local-mode'
import { localStore, type LocalProject } from '@/lib/local-store'
import type { ProjectType, ProjectWithCreator } from '@/types'

function localToProjectWithCreator(p: LocalProject): ProjectWithCreator {
  return {
    ...p,
    bundle_path: null,
    creator: { id: LOCAL_USER_ID, username: 'you', avatar_url: null },
  } as unknown as ProjectWithCreator
}

const CREATOR_SELECT = `
  *,
  creator:profiles!creator_id (
    id, username, avatar_url
  )
` as const

/** Fetch public projects for the discover feed */
export async function getPublicProjects(opts?: {
  type?: ProjectType
  q?: string
  sort?: 'new' | 'popular'
  limit?: number
  offset?: number
}): Promise<ProjectWithCreator[]> {
  if (isLocalMode()) return []

  const supabase = await createServerClientInstance()
  const limit = opts?.limit ?? 24
  const offset = opts?.offset ?? 0

  let query = supabase
    .from('projects')
    .select(CREATOR_SELECT)
    .eq('visibility', 'public')

  if (opts?.type) query = query.eq('type', opts.type)
  if (opts?.q) {
    // Escape LIKE wildcards in user input so they match literally
    const escaped = opts.q.replace(/[%_\\]/g, (c) => `\\${c}`)
    query = query.ilike('title', `%${escaped}%`)
  }

  query = opts?.sort === 'popular'
    ? query.order('like_count', { ascending: false }).order('play_count', { ascending: false })
    : query.order('published_at', { ascending: false })

  const { data, error } = await query.range(offset, offset + limit - 1)
  if (error) throw error
  return (data as unknown as ProjectWithCreator[]) ?? []
}

/** Fetch a single project by ID with creator joined */
export async function getProjectById(id: string): Promise<ProjectWithCreator | null> {
  if (isLocalMode()) {
    const p = localStore.get(id)
    return p ? localToProjectWithCreator(p) : null
  }

  const supabase = await createServerClientInstance()
  const { data, error } = await supabase
    .from('projects')
    .select(CREATOR_SELECT)
    .eq('id', id)
    .single()

  if (error) return null
  return data as unknown as ProjectWithCreator
}

/** Fetch projects by a specific creator */
export async function getProjectsByCreator(creatorId: string, includePrivate = false): Promise<ProjectWithCreator[]> {
  const supabase = await createServerClientInstance()
  let query = supabase
    .from('projects')
    .select(CREATOR_SELECT)
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })

  if (!includePrivate) query = query.eq('visibility', 'public')

  const { data, error } = await query
  if (error) throw error
  return (data as unknown as ProjectWithCreator[]) ?? []
}

/** Search projects by title */
export async function searchProjects(query: string, limit = 20): Promise<ProjectWithCreator[]> {
  const supabase = await createServerClientInstance()
  const { data, error } = await supabase
    .from('projects')
    .select(CREATOR_SELECT)
    .eq('visibility', 'public')
    .ilike('title', `%${query}%`)
    .order('like_count', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data as unknown as ProjectWithCreator[]) ?? []
}

/** Fetch related projects (same type, not same project) */
export async function getRelatedProjects(projectId: string, type: ProjectType, limit = 4): Promise<ProjectWithCreator[]> {
  if (isLocalMode()) return []

  const supabase = await createServerClientInstance()
  const { data, error } = await supabase
    .from('projects')
    .select(CREATOR_SELECT)
    .eq('visibility', 'public')
    .eq('type', type)
    .neq('id', projectId)
    .order('like_count', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data as unknown as ProjectWithCreator[]) ?? []
}

/** Get IDs of projects liked by a user */
export async function getLikedProjectIds(userId: string, projectIds: string[]): Promise<Set<string>> {
  const supabase = await createServerClientInstance()
  const { data } = await supabase
    .from('likes')
    .select('project_id')
    .eq('user_id', userId)
    .in('project_id', projectIds)

  return new Set((data ?? []).map((r) => r.project_id))
}
