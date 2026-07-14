import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance, createServiceClient } from '@/lib/db/server'
import { sanitizeHTML } from '@/lib/ai/sanitize'
import { isLocalMode } from '@/lib/local-mode'
import { localStore } from '@/lib/local-store'

interface Params { params: Promise<{ id: string }> }

/** GET /api/projects/[id] — get project + bundle HTML */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params

  if (isLocalMode()) {
    const project = localStore.get(id)
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(project)
  }

  const supabase = await createServerClientInstance()

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let html = ''
  if (data.bundle_path) {
    const service = createServiceClient()
    const { data: fileData } = await service.storage
      .from('projects')
      .download(data.bundle_path)
    if (fileData) html = await fileData.text()
  }

  return NextResponse.json({ ...data, html })
}

/** PUT /api/projects/[id] — save project HTML */
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { html, title, description } = await req.json()

  // Never trust client-supplied HTML — re-sanitize on every save.
  const cleanHTML = typeof html === 'string' ? sanitizeHTML(html).html : undefined

  if (isLocalMode()) {
    const patch: Record<string, unknown> = {}
    if (cleanHTML !== undefined) patch.html = cleanHTML
    if (title !== undefined) patch.title = title
    if (description !== undefined) patch.description = description
    const updated = localStore.update(id, patch)
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }

  const supabase = await createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase
    .from('projects')
    .select('creator_id, visibility')
    .eq('id', id)
    .single()

  if (!project || project.creator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  if (cleanHTML) {
    const path = `projects/${id}/index.html`
    await service.storage.from('projects').upload(path, cleanHTML, {
      contentType: 'text/html',
      upsert: true,
    })

    const update: { bundle_path: string; updated_at: string; visibility?: 'private' } = {
      bundle_path: path,
      updated_at: new Date().toISOString(),
    }
    // Changing the code of a published project takes it private again —
    // the pre-publish safety scan must run on the new content.
    if (project.visibility === 'public') update.visibility = 'private'

    await service.from('projects').update(update).eq('id', id)
  }

  if (title || description !== undefined) {
    await service.from('projects').update({ title, description }).eq('id', id)
  }

  return NextResponse.json({ ok: true })
}

/** DELETE /api/projects/[id] — permanently delete a project the caller owns */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params

  if (isLocalMode()) {
    const ok = localStore.delete(id)
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }

  const supabase = await createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase
    .from('projects')
    .select('creator_id, bundle_path')
    .eq('id', id)
    .single()

  if (!project || project.creator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  // Remove dependent rows first (no ON DELETE CASCADE in the schema),
  // then the stored HTML bundle, then the project row itself.
  await service.from('project_versions').delete().eq('project_id', id)
  await service.from('likes').delete().eq('project_id', id)
  await service.from('reports').delete().eq('project_id', id)
  // Detach any remixes so the self-referencing FK doesn't block the delete
  await service.from('projects').update({ remix_of: null }).eq('remix_of', id)
  if (project.bundle_path) {
    await service.storage.from('projects').remove([project.bundle_path])
  }
  const { error } = await service.from('projects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
