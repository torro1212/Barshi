import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance } from '@/lib/db/server'
import { anthropic, MODELS } from '@/lib/ai/client'
import { SYSTEM_SMARTER } from '@/lib/ai/prompts/system-smarter'
import { sanitizeHTML } from '@/lib/ai/sanitize'
import { checkEditLimit } from '@/lib/rate-limit'
import { isLocalMode } from '@/lib/local-mode'

export const maxDuration = 60

/** POST /api/ai/smarter — "Level Up" upgrade using the heavy model (Sonnet) */
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

  const { html, request, meta } = await req.json() as {
    html: string
    request: string
    meta?: Record<string, unknown>
  }

  // Truncate HTML to stay within token limits
  const MAX_HTML = 16000
  const truncatedHTML = html.length > MAX_HTML
    ? html.slice(0, MAX_HTML) + '\n<!-- [truncated] -->'
    : html

  const userContent = `CURRENT HTML:\n${truncatedHTML}\n\nUPGRADE REQUEST:\n${request}${
    meta ? `\n\nMETADATA:\n${JSON.stringify(meta)}` : ''
  }`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`))

      let fullHTML = ''

      try {
        const response = await anthropic.messages.create({
          model: MODELS.generate,
          max_tokens: 32768,
          stream: true,
          system: [{ type: 'text', text: SYSTEM_SMARTER, cache_control: { type: 'ephemeral' } }],
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

        const { html: cleanHTML } = sanitizeHTML(fullHTML)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, html: cleanHTML })}\n\n`)
        )
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Upgrade failed' })}\n\n`)
        )
        console.error('[smarter]', err)
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
