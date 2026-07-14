import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance, createServiceClient } from '@/lib/db/server'

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Fetch original project
  const { data: original, error } = await service
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('visibility', 'public')
    .single()

  if (error || !original) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Must be a UUID — projects.id is a uuid column
  const newId = randomUUID()

  // Copy HTML bundle to new path
  let bundlePath: string | null = null
  if (original.bundle_path) {
    const newPath = `projects/${newId}/index.html`
    const { error: copyError } = await service.storage
      .from('projects')
      .copy(original.bundle_path, newPath)
    if (!copyError) bundlePath = newPath
  }

  // Create remixed project
  const { data: remixed, error: insertError } = await service
    .from('projects')
    .insert({
      id: newId,
      creator_id: user.id,
      title: `${original.title} (remix)`,
      description: original.description,
      type: original.type,
      meta_json: original.meta_json,
      bundle_path: bundlePath,
      cover_config: original.cover_config,
      visibility: 'private',
      remix_of: id,
    })
    .select('id')
    .single()

  if (insertError || !remixed) {
    return NextResponse.json({ error: 'Failed to remix' }, { status: 500 })
  }

  // Atomic remix count increment
  await service.rpc('increment_remix_count', { project_id: id })

  // Notify original creator
  if (original.creator_id !== user.id) {
    await service.from('notifications').insert({
      user_id: original.creator_id,
      type: 'remix',
      data: { project_id: id, title: original.title, remixed_id: newId },
    })
  }

  return NextResponse.json({ id: remixed.id })
}
