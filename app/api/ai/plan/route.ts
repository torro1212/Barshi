import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance } from '@/lib/db/server'
import { anthropic, MODELS, isAIConfigured } from '@/lib/ai/client'
import { SYSTEM_PLAN } from '@/lib/ai/prompts/system-plan'
import { isLocalMode } from '@/lib/local-mode'
import type { CreationIntent, BuildPlan } from '@/types'

export async function POST(req: NextRequest) {
  if (!isLocalMode()) {
    const supabase = await createServerClientInstance()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAIConfigured()) {
    return NextResponse.json(
      { error: 'AI not configured. Add ANTHROPIC_API_KEY or GOOGLE_AI_API_KEY to .env.local' },
      { status: 500 }
    )
  }

  const body = await req.json() as CreationIntent & { refinePlan?: BuildPlan; instruction?: string }

  // Refinement mode: the user saw the concept sketch and asked for a change.
  // Feed the current plan + their instruction and return an updated plan.
  const userContent = body.refinePlan
    ? [
        'Here is the current build plan (JSON):',
        JSON.stringify(body.refinePlan),
        '',
        `The creator wants this change: ${body.instruction ?? ''}`,
        '',
        'Return the FULL updated plan as JSON in the same format. Keep everything the creator did not ask to change. Keep the same language.',
      ].join('\n')
    : [
        body.prompt && `Build: ${body.prompt}`,
        body.type && `Type: ${body.type}`,
        body.forWho && `For: ${body.forWho}`,
        body.mustInclude && `Must include: ${body.mustInclude}`,
        body.style && `Style: ${body.style}`,
      ]
        .filter(Boolean)
        .join('\n')

  try {
    const response = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 1024,
      system: [{ type: 'text', text: SYSTEM_PLAN, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userContent }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const plan: BuildPlan = JSON.parse(text)
    return NextResponse.json(plan)
  } catch (err) {
    console.error('[POST /api/ai/plan]', err)
    return NextResponse.json({ error: 'Plan generation failed' }, { status: 500 })
  }
}
