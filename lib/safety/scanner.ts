import { anthropic, MODELS } from '@/lib/ai/client'
import { SYSTEM_SAFETY } from '@/lib/ai/prompts/system-safety'
import { extractVisibleText } from '@/lib/ai/sanitize'
import type { SafetyScanResult } from '@/types'

interface ScanInput {
  title: string
  description?: string
  html?: string
  username?: string
  bio?: string
}

export async function scanContent(input: ScanInput): Promise<SafetyScanResult> {
  const parts: string[] = []

  if (input.title)       parts.push(`TITLE: ${input.title}`)
  if (input.description) parts.push(`DESCRIPTION: ${input.description}`)
  if (input.username)    parts.push(`USERNAME: ${input.username}`)
  if (input.bio)         parts.push(`BIO: ${input.bio}`)
  if (input.html) {
    const text = extractVisibleText(input.html)
    parts.push(`VISIBLE TEXT: ${text}`)
  }

  try {
    const response = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 256,
      system: [
        {
          type: 'text',
          text: SYSTEM_SAFETY,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: parts.join('\n\n'),
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const result = JSON.parse(text.trim()) as SafetyScanResult
    return result
  } catch {
    // On error, default to flagging for human review (safe failure)
    return {
      safe: false,
      severity: 'low',
      reasons: ['Could not complete safety scan — flagged for review'],
      action: 'flag',
    }
  }
}
