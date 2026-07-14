import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/server'
import { requireAdmin } from '@/lib/admin'
import { isLocalMode } from '@/lib/local-mode'

type Decision = 'remove' | 'dismiss'

/** POST /api/moderation/action — resolve a report (admin only)
 *  - remove:  take the project down (visibility='removed') + notify creator
 *  - dismiss: mark the report safe, leave the project up */
export async function POST(req: NextRequest) {
  if (isLocalMode()) return NextResponse.json({ ok: true })

  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { reportId, projectId, decision, reason } = await req.json() as {
    reportId: string
    projectId: string
    decision: Decision
    reason?: string
  }

  const service = createServiceClient()

  if (decision === 'dismiss') {
    await service.from('reports').update({ status: 'safe' }).eq('id', reportId)
    return NextResponse.json({ ok: true })
  }

  // decision === 'remove'
  const { data: project } = await service
    .from('projects')
    .select('creator_id, title')
    .eq('id', projectId)
    .single()

  await service.from('projects').update({ visibility: 'removed' }).eq('id', projectId)

  // Resolve every pending report against this project
  await service.from('reports').update({ status: 'actioned' }).eq('project_id', projectId).eq('status', 'pending')

  // Audit log
  await service.from('moderation_actions').insert({
    user_id: project?.creator_id ?? adminId,
    action_type: 'project_removed',
    reason: reason || 'Removed after report review',
    project_id: projectId,
  })

  // Notify the creator
  if (project?.creator_id) {
    await service.from('notifications').insert({
      user_id: project.creator_id,
      type: 'moderation',
      data: { project_id: projectId, title: project.title, action: 'removed' },
    })
  }

  return NextResponse.json({ ok: true })
}
