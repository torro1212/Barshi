import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance } from '@/lib/db/server'
import { anthropic, MODELS } from '@/lib/ai/client'
import { SYSTEM_EDIT } from '@/lib/ai/prompts/system-edit'
import { sanitizeHTML } from '@/lib/ai/sanitize'
import { checkEditLimit } from '@/lib/rate-limit'
import { isLocalMode } from '@/lib/local-mode'

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

  const { html, request, meta } = await req.json() as {
    html: string
    request: string
    meta?: Record<string, unknown>
  }

  // Keep the WHOLE file — truncating mid-document made the model return a
  // half-a-site with all the JavaScript missing ("nothing works"). The model
  // context easily fits a full project; only guard against pathological sizes.
  const MAX_HTML = 90000
  const truncatedHTML = html.length > MAX_HTML
    ? html.slice(0, MAX_HTML) + '\n<!-- [truncated] -->'
    : html

  const userContent = `CURRENT HTML:\n${truncatedHTML}\n\nEDIT REQUEST:\n${request}${
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
          model: MODELS.fast,
          max_tokens: 16384,
          stream: true,
          system: [{ type: 'text', text: SYSTEM_EDIT, cache_control: { type: 'ephemeral' } }],
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

        // Reject a truncated/incomplete result instead of overwriting the
        // user's working project with a broken half-file.
        const looksComplete = /<\/html>\s*$/i.test(fullHTML.trim()) && /<body/i.test(fullHTML)
        if (!looksComplete) {
          console.warn('[edit] incomplete output, len=', fullHTML.length)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'That change came out incomplete — your project is unchanged. Try again or reword it.' })}\n\n`)
          )
          return
        }

        const { html: cleanHTML } = sanitizeHTML(fullHTML)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, html: cleanHTML })}\n\n`)
        )
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Edit failed' })}\n\n`)
        )
        console.error('[edit]', err)
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
