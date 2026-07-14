import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance, createServiceClient } from '@/lib/db/server'
import { isLocalMode } from '@/lib/local-mode'

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params

  if (isLocalMode()) {
    // No persistent social graph in local mode — pretend the like toggled on.
    return NextResponse.json({ liked: true })
  }

  const supabase = await createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Check if already liked
  const { data: existing } = await service
    .from('likes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('project_id', id)
    .single()

  if (existing) {
    // Unlike
    await service.from('likes').delete().eq('user_id', user.id).eq('project_id', id)
    await service.rpc('decrement_like_count', { project_id: id })
    return NextResponse.json({ liked: false })
  }

  // Like — insert row
  await service.from('likes').insert({ user_id: user.id, project_id: id })
  await service.rpc('increment_like_count', { project_id: id })

  // Notify creator (don't notify if user liked their own project)
  const { data: project } = await service
    .from('projects')
    .select('creator_id, title')
    .eq('id', id)
    .single()

  if (project && project.creator_id !== user.id) {
    await service.from('notifications').insert({
      user_id: project.creator_id,
      type: 'like',
      data: { project_id: id, title: project.title, liker_id: user.id },
    })
  }

  return NextResponse.json({ liked: true })
}
