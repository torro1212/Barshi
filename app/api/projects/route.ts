import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance } from '@/lib/db/server'
import { generateCoverConfig } from '@/lib/cover'
import { isLocalMode, LOCAL_USER_ID } from '@/lib/local-mode'
import { localStore } from '@/lib/local-store'
import type { BuildPlan, CreationIntent } from '@/types'

/** POST /api/projects — create a new project record before generation */
export async function POST(req: NextRequest) {
  const { plan }: { plan: BuildPlan; intent: CreationIntent } = await req.json()
  const cover = generateCoverConfig(plan.type)

  if (isLocalMode()) {
    const project = localStore.create({ creator_id: LOCAL_USER_ID, plan, cover })
    return NextResponse.json({ id: project.id })
  }

  const supabase = await createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .insert({
      creator_id: user.id,
      title: plan.title,
      description: plan.summary,
      type: plan.type,
      meta_json: {
        type: plan.type,
        screens: plan.screens,
        components: plan.components,
        theme: { primaryColor: cover.accentColor, mood: plan.theme },
        usesKaboom: plan.usesKaboom,
      },
      cover_config: cover,
      visibility: 'private',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[POST /api/projects]', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
