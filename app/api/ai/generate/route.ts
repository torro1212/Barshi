import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance, createServiceClient } from '@/lib/db/server'
import { anthropic, MODELS } from '@/lib/ai/client'
import { SYSTEM_GENERATE } from '@/lib/ai/prompts/system-generate'
import { sanitizeHTML } from '@/lib/ai/sanitize'
import { checkGenerateLimit } from '@/lib/rate-limit'
import { generateCoverConfig } from '@/lib/cover'
import { isLocalMode, LOCAL_USER_ID } from '@/lib/local-mode'
import { localStore } from '@/lib/local-store'
import type { BuildPlan } from '@/types'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const local = isLocalMode()

  let userId: string
  if (local) {
    userId = LOCAL_USER_ID
  } else {
    const supabase = await createServerClientInstance()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id

    // Rate limit (Supabase/Upstash mode only)
    const limit = await checkGenerateLimit(userId)
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.message }, { status: 429 })
    }
  }

  const { projectId, plan }: { projectId: string; plan: BuildPlan } = await req.json()

  // Ownership check — the caller must own the project it's writing into.
  if (local) {
    const project = localStore.get(projectId)
    if (!project || project.creator_id !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  } else {
    const service = createServiceClient()
    const { data: project } = await service
      .from('projects')
      .select('creator_id')
      .eq('id', projectId)
      .single()
    if (!project || project.creator_id !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  const userContent = `
Build Plan:
${JSON.stringify(plan, null, 2)}

Generate the complete HTML file now.`.trim()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`))
      const done = () => controller.enqueue(encoder.encode('data: [DONE]\n\n'))

      let fullHTML = ''

      try {
        const response = await anthropic.messages.create({
          model: MODELS.generate,
          // Generous budget: Gemini counts hidden "thinking" tokens against
          // maxOutputTokens, and a truncated file is a broken game.
          max_tokens: 32768,
          stream: true,
          system: [{ type: 'text', text: SYSTEM_GENERATE, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: userContent }],
        })

        for await (const event of response) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            fullHTML += event.delta.text
            send(event.delta.text)
          }
        }

        // Truncation guard — a file that doesn't close </html> was cut off
        // mid-script and will throw "Unexpected end of input" in the browser.
        if (!/<\/html>\s*$/i.test(fullHTML.trim())) {
          console.warn('[generate] output truncated (no closing </html>), len=', fullHTML.length)
        }

        const { html: cleanHTML } = sanitizeHTML(fullHTML)
        const cover = generateCoverConfig(plan.type)
        const meta = {
          type: plan.type,
          screens: plan.screens,
          components: plan.components,
          theme: { primaryColor: cover.accentColor, mood: plan.theme },
          usesKaboom: plan.usesKaboom,
        }

        if (local) {
          localStore.update(projectId, {
            html: cleanHTML,
            meta_json: meta,
            cover_config: cover,
          })
        } else {
          const service = createServiceClient()
          const path = `projects/${projectId}/index.html`
          await service.storage
            .from('projects')
            .upload(path, cleanHTML, {
              contentType: 'text/html',
              upsert: true,
            })

          await service
            .from('projects')
            .update({
              bundle_path: path,
              cover_config: cover,
              meta_json: meta,
            })
            .eq('id', projectId)
        }

        done()
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Generation failed' })}\n\n`)
        )
        console.error('[generate]', err)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
