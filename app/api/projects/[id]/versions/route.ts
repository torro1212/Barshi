import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance, createServiceClient } from '@/lib/db/server'
import { sanitizeHTML } from '@/lib/ai/sanitize'
import { isLocalMode } from '@/lib/local-mode'
import { localStore } from '@/lib/local-store'

interface Params { params: Promise<{ id: string }> }

/** Verify the caller owns the project (production). Returns the user id or null. */
async function ownerId(id: string): Promise<string | null> {
  const supabase = await createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('projects').select('creator_id').eq('id', id).single()
  return data && data.creator_id === user.id ? user.id : null
}

/** GET /api/projects/:id/versions — list saved version snapshots (metadata only) */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params

  if (isLocalMode()) {
    const versions = localStore.listVersions(id).map(({ version_num, created_at }) => ({ version_num, created_at }))
    return NextResponse.json({ versions })
  }

  if (!(await ownerId(id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const { data } = await service
    .from('project_versions')
    .select('version_num, created_at')
    .eq('project_id', id)
    .order('version_num', { ascending: false })

  return NextResponse.json({ versions: data ?? [] })
}

/** POST /api/projects/:id/versions — save the current HTML as a new snapshot */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { html } = await req.json() as { html?: string }
  if (!html) return NextResponse.json({ error: 'Nothing to snapshot' }, { status: 400 })

  if (isLocalMode()) {
    localStore.snapshot(id, html)
    return NextResponse.json({ ok: true })
  }

  if (!(await ownerId(id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  await service.rpc('snapshot_version', { p_project_id: id, p_html: html })
  return NextResponse.json({ ok: true })
}

/** PUT /api/projects/:id/versions — restore a version, returns its HTML */
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { version_num } = await req.json() as { version_num: number }

  if (isLocalMode()) {
    const version = localStore.getVersion(id, version_num)
    if (!version) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    localStore.update(id, { html: version.html })
    return NextResponse.json({ html: version.html })
  }

  const uid = await ownerId(id)
  if (!uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const { data: version } = await service
    .from('project_versions')
    .select('html')
    .eq('project_id', id)
    .eq('version_num', version_num)
    .single()

  if (!version?.html) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Re-sanitize on the way back in — snapshots predate any later sanitizer fixes.
  const cleanHTML = sanitizeHTML(version.html).html

  const path = `projects/${id}/index.html`
  await service.storage.from('projects').upload(path, cleanHTML, {
    contentType: 'text/html',
    upsert: true,
  })
  // Restoring old code re-triggers the publish gate: project goes private
  // until it's re-scanned and re-published.
  await service
    .from('projects')
    .update({ bundle_path: path, visibility: 'private', updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ html: cleanHTML })
}
