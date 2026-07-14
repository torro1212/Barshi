/**
 * Shared reader for our AI Server-Sent-Events responses.
 *
 * All AI routes stream frames separated by `\n\n`, each a `data: <json|[DONE]>`
 * line. A single read() may contain partial frames, so we buffer until a frame
 * terminator. This one helper replaces the three near-identical parse loops that
 * previously lived in the build page and the builder edit/smarter flows.
 */

export interface SSEHandlers {
  /** A text delta arrived (accumulates into the returned full string too) */
  onChunk?: (text: string, soFar: string) => void
  /** The stream signalled completion; `html` is present when the route sent a final sanitized doc */
  onDone?: (html: string | null) => void
  /** The route reported an error frame */
  onError?: (message: string) => void
}

/** Consume an AI SSE Response, invoking handlers, and return the full text. */
export async function readAIStream(res: Response, handlers: SSEHandlers = {}): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)

      for (const line of frame.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') {
          handlers.onDone?.(null)
          continue
        }
        try {
          const parsed = JSON.parse(payload) as { chunk?: string; done?: boolean; html?: string; error?: string }
          if (parsed.chunk) {
            full += parsed.chunk
            handlers.onChunk?.(parsed.chunk, full)
          }
          if (parsed.done && parsed.html) handlers.onDone?.(parsed.html)
          if (parsed.error) handlers.onError?.(parsed.error)
        } catch {
          /* partial/malformed frame — ignore, more bytes coming */
        }
      }
    }
  }
  return full
}
