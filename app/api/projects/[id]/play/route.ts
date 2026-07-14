import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/server'
import { isLocalMode } from '@/lib/local-mode'
import { localStore } from '@/lib/local-store'

/** POST /api/projects/:id/play — increment play count (no auth required) */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (isLocalMode()) {
    const p = localStore.get(id)
    if (p) localStore.update(id, { play_count: p.play_count + 1 })
    return NextResponse.json({ ok: true })
  }

  const supabase = createServiceClient()
  await supabase.rpc('increment_play_count', { project_id: id })

  return NextResponse.json({ ok: true })
}
