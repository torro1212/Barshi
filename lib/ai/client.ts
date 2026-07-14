import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * AI provider — picks Anthropic if ANTHROPIC_API_KEY is set, otherwise Gemini
 * (Google AI Studio, free tier) if GOOGLE_AI_API_KEY is set.
 *
 * Exposes an Anthropic-compatible surface: `anthropic.messages.create(...)` works
 * the same way regardless of which provider is actually in use. The Gemini
 * adapter emulates Anthropic's response shape for both streaming and
 * non-streaming calls, so call sites never need to know which one is active.
 */

type Provider = 'anthropic' | 'openai' | 'google'

/** OpenAI-compatible free providers (Groq by default, or OpenRouter). Reads the
 *  first key it finds. Groq is the default because it's free, fast, and needs
 *  no credit card. Point AI_BASE_URL at any OpenAI-compatible endpoint. */
export function getOpenAIConfig(): { key: string; base: string; isOpenRouter: boolean } | null {
  const key = process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
  if (!key) return null
  const isOpenRouter = !!process.env.OPENROUTER_API_KEY && !process.env.GROQ_API_KEY
  const base =
    process.env.AI_BASE_URL ||
    (isOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.groq.com/openai/v1')
  return { key, base, isOpenRouter }
}

export function getProvider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (getOpenAIConfig()) return 'openai'
  if (process.env.GOOGLE_AI_API_KEY) return 'google'
  throw new Error('No AI provider configured. Set GROQ_API_KEY (free) — or ANTHROPIC_API_KEY / GOOGLE_AI_API_KEY — in .env.local')
}

export function isAIConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || getOpenAIConfig() || process.env.GOOGLE_AI_API_KEY)
}

/** Model IDs — different per provider but selected by the same logical name. */
const GEMINI_MODELS = {
  generate: process.env.GEMINI_MODEL_GENERATE || 'gemini-2.5-pro',
  fast: process.env.GEMINI_MODEL_FAST || 'gemini-2.5-flash',
} as const

const ANTHROPIC_MODELS = {
  generate: 'claude-sonnet-4-6',
  fast: 'claude-haiku-4-5-20251001',
} as const

/** Groq defaults: a strong free coder for generation, a fast light model for
 *  small tasks. Override with AI_MODEL_GENERATE / AI_MODEL_FAST (needed if you
 *  switch to OpenRouter, whose IDs look like "qwen/qwen3-coder:free"). */
const OPENAI_MODELS = {
  generate: process.env.AI_MODEL_GENERATE || 'openai/gpt-oss-120b',
  fast: process.env.AI_MODEL_FAST || 'llama-3.1-8b-instant',
} as const

export const MODELS: { generate: string; fast: string } = (() => {
  try {
    const p = getProvider()
    if (p === 'anthropic') return ANTHROPIC_MODELS
    if (p === 'openai') return OPENAI_MODELS
    return GEMINI_MODELS
  } catch {
    return ANTHROPIC_MODELS
  }
})()

// ─────────────────────────────────────────────────────────────────────────
// Anthropic-compatible types used by the emulator
// ─────────────────────────────────────────────────────────────────────────

interface AnthropicTextBlock {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
}

interface AnthropicUserMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicTextBlock[]
}

interface AnthropicCreateParams {
  model: string
  max_tokens: number
  stream?: boolean
  system?: string | AnthropicTextBlock[]
  messages: AnthropicUserMessage[]
}

interface AnthropicNonStreamResponse {
  content: Array<{ type: 'text'; text: string }>
}

type AnthropicStreamEvent =
  | { type: 'content_block_delta'; delta: { type: 'text_delta'; text: string } }
  | { type: 'message_stop' }

// ─────────────────────────────────────────────────────────────────────────
// Provider clients (lazy singletons)
// ─────────────────────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null
function anthropicClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  }
  return _anthropic
}

let _google: GoogleGenerativeAI | null = null
function googleClient(): GoogleGenerativeAI {
  if (!_google) {
    _google = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
  }
  return _google
}

// ─────────────────────────────────────────────────────────────────────────
// Gemini adapter — emulates Anthropic's messages.create API
// ─────────────────────────────────────────────────────────────────────────

function flattenSystem(system?: string | AnthropicTextBlock[]): string {
  if (!system) return ''
  if (typeof system === 'string') return system
  return system.map((b) => b.text).join('\n\n')
}

function flattenMessages(messages: AnthropicUserMessage[]): string {
  return messages
    .map((m) => {
      const content = typeof m.content === 'string' ? m.content : m.content.map((b) => b.text).join('\n')
      return content
    })
    .join('\n\n')
}

function stripJsonFence(text: string): string {
  // Gemini sometimes ignores "no markdown" instructions and wraps JSON in ```json ... ```
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return fenced ? fenced[1].trim() : trimmed
}

async function geminiNonStream(params: AnthropicCreateParams): Promise<AnthropicNonStreamResponse> {
  const modelName = params.model.startsWith('gemini-') ? params.model : GEMINI_MODELS.fast
  const systemText = flattenSystem(params.system)
  // Heuristic: if the system prompt asks for JSON, use Gemini's JSON response mode
  const wantsJSON = /only.*valid json|output.*json|json.*output/i.test(systemText)

  // Gemini 2.5 Pro ONLY runs in thinking mode — budget 0 is rejected (400).
  // Flash otherwise burns its whole budget on hidden reasoning and returns an
  // empty body, so we disable thinking there. So: Pro gets a real budget, Flash gets 0.
  const isPro = modelName.includes('pro')

  const model = googleClient().getGenerativeModel({
    model: modelName,
    systemInstruction: systemText || undefined,
    generationConfig: {
      maxOutputTokens: params.max_tokens,
      thinkingConfig: { thinkingBudget: isPro ? 2048 : 0 },
      ...(wantsJSON ? { responseMimeType: 'application/json' } : {}),
    } as Record<string, unknown>,
  })

  const result = await model.generateContent(flattenMessages(params.messages))
  const raw = result.response.text()
  if (!raw) {
    console.error('[gemini] empty response', {
      model: modelName,
      finishReason: result.response.candidates?.[0]?.finishReason,
      safety: result.response.candidates?.[0]?.safetyRatings,
      promptFeedback: result.response.promptFeedback,
    })
  }
  const text = wantsJSON ? raw.trim() : stripJsonFence(raw)
  return { content: [{ type: 'text', text }] }
}

async function* geminiStream(params: AnthropicCreateParams): AsyncGenerator<AnthropicStreamEvent> {
  const modelName = params.model.startsWith('gemini-') ? params.model : GEMINI_MODELS.generate
  // Streaming jobs are the heavy creative ones (full project generation / edits).
  // Pro handles these and benefits from a real thinking budget — without it, the
  // generated games tend to mis-use Kaboom APIs and crash silently.
  const isPro = modelName.includes('pro')
  const model = googleClient().getGenerativeModel({
    model: modelName,
    systemInstruction: flattenSystem(params.system) || undefined,
    generationConfig: {
      maxOutputTokens: params.max_tokens,
      thinkingConfig: { thinkingBudget: isPro ? 4096 : 0 },
    } as Record<string, unknown>,
  })

  const result = await model.generateContentStream(flattenMessages(params.messages))

  for await (const chunk of result.stream) {
    const text = chunk.text()
    if (text) {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text } }
    }
  }
  yield { type: 'message_stop' }
}

// ─────────────────────────────────────────────────────────────────────────
// OpenAI-compatible adapter (Groq / OpenRouter) — emulates messages.create
// ─────────────────────────────────────────────────────────────────────────

function openaiModel(params: AnthropicCreateParams): string {
  // Anthropic/Gemini model names never apply here — always use our OpenAI models.
  return params.stream ? OPENAI_MODELS.generate : OPENAI_MODELS.fast
}

function openaiBody(params: AnthropicCreateParams, stream: boolean) {
  const messages: { role: string; content: string }[] = []
  const sys = flattenSystem(params.system)
  if (sys) messages.push({ role: 'system', content: sys })
  messages.push({ role: 'user', content: flattenMessages(params.messages) })
  return {
    model: openaiModel(params),
    messages,
    max_tokens: params.max_tokens,
    temperature: 0.7,
    stream,
  }
}

function openaiHeaders(): Record<string, string> {
  const cfg = getOpenAIConfig()!
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.key}`,
  }
  // OpenRouter asks for these attribution headers (optional but recommended).
  if (cfg.isOpenRouter) {
    h['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || 'https://barshi.app'
    h['X-Title'] = 'Barshi'
  }
  return h
}

async function openaiNonStream(params: AnthropicCreateParams): Promise<AnthropicNonStreamResponse> {
  const cfg = getOpenAIConfig()!
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: 'POST',
    headers: openaiHeaders(),
    body: JSON.stringify(openaiBody(params, false)),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`OpenAI-compatible API error ${res.status}: ${detail.slice(0, 300)}`)
  }
  const json = await res.json()
  const raw: string = json.choices?.[0]?.message?.content ?? ''
  return { content: [{ type: 'text', text: stripJsonFence(raw) }] }
}

async function* openaiStream(params: AnthropicCreateParams): AsyncGenerator<AnthropicStreamEvent> {
  const cfg = getOpenAIConfig()!
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: 'POST',
    headers: openaiHeaders(),
    body: JSON.stringify(openaiBody(params, true)),
  })
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '')
    throw new Error(`OpenAI-compatible API error ${res.status}: ${detail.slice(0, 300)}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') { yield { type: 'message_stop' }; return }
      try {
        const json = JSON.parse(payload)
        const text: string = json.choices?.[0]?.delta?.content ?? ''
        if (text) yield { type: 'content_block_delta', delta: { type: 'text_delta', text } }
      } catch { /* keep-alive or partial frame */ }
    }
  }
  yield { type: 'message_stop' }
}

// ─────────────────────────────────────────────────────────────────────────
// Unified client — routes to Anthropic / OpenAI-compatible / Gemini by key
// ─────────────────────────────────────────────────────────────────────────

interface MessagesCreate {
  (params: AnthropicCreateParams & { stream: true }): AsyncGenerator<AnthropicStreamEvent>
  (params: AnthropicCreateParams & { stream?: false }): Promise<AnthropicNonStreamResponse>
}

const messagesCreate: MessagesCreate = ((params: AnthropicCreateParams) => {
  const provider = getProvider()

  if (provider === 'anthropic') {
    return anthropicClient().messages.create(params as never) as never
  }

  if (provider === 'openai') {
    return params.stream ? openaiStream(params) : openaiNonStream(params)
  }

  const mapped: AnthropicCreateParams = {
    ...params,
    model: params.model.startsWith('gemini-')
      ? params.model
      : params.stream
        ? GEMINI_MODELS.generate
        : GEMINI_MODELS.fast,
  }

  return params.stream ? geminiStream(mapped) : geminiNonStream(mapped)
}) as MessagesCreate

export const anthropic = {
  messages: { create: messagesCreate },
}

// Keep for backwards compatibility
export function getAnthropicClient(): Anthropic {
  return anthropicClient()
}
