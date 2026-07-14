import { NextResponse } from 'next/server'
import { createServerClientInstance, createServiceClient } from '@/lib/db/server'
import { SANDBOX_CSP } from '@/lib/ai/sanitize'
import { isLocalMode } from '@/lib/local-mode'
import { localStore } from '@/lib/local-store'

/** Strict headers for serving user-generated HTML: no network egress, no
 *  frames escaping, scripts limited to inline + the Kaboom CDN allow-list.
 *  Applies when someone opens the URL directly (the iframe sandbox already
 *  isolates embedded playback). */
const BUNDLE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': SANDBOX_CSP,
} as const

/** GET /api/projects/:id/html — serves the raw HTML bundle for iframe embedding.
 *  Works in both local mode (reads in-memory store) and production (reads Supabase Storage). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (isLocalMode()) {
    const project = localStore.get(id)
    if (!project) return new NextResponse('Not found', { status: 404 })
    return new NextResponse(project.html || '<!DOCTYPE html><html><body></body></html>', {
      headers: BUNDLE_HEADERS,
    })
  }

  const supabase = await createServerClientInstance()
  const { data } = await supabase
    .from('projects')
    .select('bundle_path,visibility,creator_id')
    .eq('id', id)
    .single()

  if (!data) return new NextResponse('Not found', { status: 404 })

  // Public projects are viewable by anyone; private ones only by their creator
  if (data.visibility !== 'public') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== data.creator_id) {
      return new NextResponse('Not found', { status: 404 })
    }
  }

  if (!data.bundle_path) return new NextResponse('Not built yet', { status: 404 })

  const service = createServiceClient()
  const { data: file } = await service.storage.from('projects').download(data.bundle_path)
  if (!file) return new NextResponse('Not found', { status: 404 })

  const html = await file.text()
  return new NextResponse(html, { headers: BUNDLE_HEADERS })
}
