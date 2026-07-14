import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance, createServiceClient } from '@/lib/db/server'
import { scanContent } from '@/lib/safety/scanner'
import { isLocalMode, LOCAL_USER_ID } from '@/lib/local-mode'
import { localStore } from '@/lib/local-store'

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { title, description } = await req.json() as { title: string; description?: string }

  if (isLocalMode()) {
    const project = localStore.get(id)
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (project.creator_id !== LOCAL_USER_ID) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const scan = await scanContent({ title, description, html: project.html })
    if (scan.action === 'block') {
      return NextResponse.json(
        { error: "Something here isn't allowed. Try changing it.", reasons: scan.reasons },
        { status: 422 }
      )
    }

    localStore.update(id, {
      title,
      description: description ?? null,
      visibility: 'public',
      published_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, flagged: scan.action === 'flag' })
  }

  const supabase = await createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project || project.creator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let html = ''
  if (project.bundle_path) {
    const service = createServiceClient()
    const { data: fileData } = await service.storage.from('projects').download(project.bundle_path)
    if (fileData) html = await fileData.text()
  }

  const scan = await scanContent({ title, description, html })

  if (scan.action === 'block') {
    return NextResponse.json(
      { error: "Something here isn't allowed. Try changing it.", reasons: scan.reasons },
      { status: 422 }
    )
  }

  const service = createServiceClient()
  await service
    .from('projects')
    .update({
      title,
      description: description ?? null,
      visibility: 'public',
      published_at: new Date().toISOString(),
    })
    .eq('id', id)

  await service.from('notifications').insert({
    user_id: user.id,
    type: 'publish_success',
    data: { project_id: id, title },
  })

  return NextResponse.json({ ok: true, flagged: scan.action === 'flag' })
}
