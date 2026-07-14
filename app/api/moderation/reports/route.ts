import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/server'
import { requireAdmin } from '@/lib/admin'
import { isLocalMode } from '@/lib/local-mode'

/** GET /api/moderation/reports — pending reports with their projects (admin only) */
export async function GET() {
  if (isLocalMode()) return NextResponse.json({ reports: [] })

  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const { data: reports } = await service
    .from('reports')
    .select('id, project_id, reason, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100)

  if (!reports || reports.length === 0) return NextResponse.json({ reports: [] })

  // Join the reported projects (service role bypasses RLS)
  const projectIds = [...new Set(reports.map((r) => r.project_id))]
  const { data: projects } = await service
    .from('projects')
    .select('id, title, type, visibility, creator_id, like_count, play_count')
    .in('id', projectIds)

  const projectMap = new Map((projects ?? []).map((p) => [p.id, p]))

  const enriched = reports.map((r) => ({
    ...r,
    project: projectMap.get(r.project_id) ?? null,
  }))

  return NextResponse.json({ reports: enriched })
}
