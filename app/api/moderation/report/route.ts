import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance, createServiceClient } from '@/lib/db/server'
import { sendModerationAlert } from '@/lib/email/client'
import type { ReportReason } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, reason } = await req.json() as {
    projectId: string
    reason: ReportReason
  }

  const { error } = await supabase.from('reports').insert({
    project_id: projectId,
    reporter_id: user.id,
    reason,
  })

  if (error) return NextResponse.json({ error: 'Failed to submit' }, { status: 500 })

  // Alert the moderation team (no-op unless email + alert address are configured).
  // Fire-and-forget so the reporter's request isn't held up by email latency.
  const service = createServiceClient()
  service
    .from('projects')
    .select('title')
    .eq('id', projectId)
    .single()
    .then(({ data }) => {
      void sendModerationAlert({
        projectId,
        projectTitle: data?.title ?? '(unknown project)',
        reason,
      })
    })

  return NextResponse.json({ ok: true })
}
