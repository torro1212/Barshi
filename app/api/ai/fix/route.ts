import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance } from '@/lib/db/server'
import { anthropic, MODELS } from '@/lib/ai/client'
import { SYSTEM_FIX } from '@/lib/ai/prompts/system-fix'
import { sanitizeHTML } from '@/lib/ai/sanitize'
import { checkEditLimit } from '@/lib/rate-limit'
import { isLocalMode } from '@/lib/local-mode'
import type { FixIssue } from '@/types'

export const maxDuration = 45

export async function POST(req: NextRequest) {
  if (!isLocalMode()) {
    const supabase = await createServerClientInstance()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = await checkEditLimit(user.id)
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.message }, { status: 429 })
    }
  }

  const { html } = await req.json() as { html: string }

  try {
    const response = await anthropic.messages.create({
      model: MODELS.generate,
      max_tokens: 4096,
      system: [{ type: 'text', text: SYSTEM_FIX, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: html.slice(0, 10000) }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
    const result = JSON.parse(text) as { issues: FixIssue[] }

    // Sanitize all fix HTMLs
    const issues = result.issues.map((issue) => ({
      ...issue,
      fix: sanitizeHTML(issue.fix).html,
    }))

    return NextResponse.json({ issues })
  } catch (err) {
    console.error('[fix]', err)
    return NextResponse.json({ issues: [] })
  }
}
