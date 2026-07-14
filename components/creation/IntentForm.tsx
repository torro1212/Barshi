'use client'

import { useState } from 'react'
import { Sparkles, ChevronDown, Wand2 } from 'lucide-react'
import { TypeSelector } from './TypeSelector'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import type { CreationIntent, ProjectType } from '@/types'

const EXAMPLE_PROMPTS = [
  '🧟 zombie survival game with 3 levels',
  '👟 sneaker store website',
  '👻 spooky haunted house story',
  '✅ daily habit tracker tool',
  '🚀 space shooter with a boss fight',
  '🏠 escape room puzzle game',
]

interface IntentFormProps {
  onSubmit: (intent: CreationIntent) => void
  initialType?: ProjectType | null
}

export function IntentForm({ onSubmit, initialType }: IntentFormProps) {
  const [prompt, setPrompt] = useState('')
  const [type, setType] = useState<ProjectType | null>(initialType ?? null)
  const [showDetails, setShowDetails] = useState(false)
  const [forWho, setForWho] = useState('')
  const [mustInclude, setMustInclude] = useState('')
  const [style, setStyle] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim()) return
    onSubmit({ prompt: prompt.trim(), type: type ?? undefined, forWho, mustInclude, style })
  }

  function applyExample(ex: string) {
    // strip emoji prefix
    const clean = ex.replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u, '')
    setPrompt(`Build ${clean}`)
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/20 text-[var(--color-brand-light)] text-xs font-semibold mb-1">
          <Wand2 size={11} />
          AI Builder
        </div>
        <h1 className="text-3xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          What do you want to build?
        </h1>
        <p className="text-[var(--color-text-muted)] text-sm">
          Describe your idea and AI will bring it to life
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Main prompt */}
        <div className="relative">
          <Textarea
            placeholder="Build a zombie survival game with 3 levels, health bar, and a final boss..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-32 text-base pr-4"
          />
          {prompt && (
            <div className="absolute bottom-3 right-3 text-xs text-[var(--color-text-dim)]">
              {prompt.length} chars
            </div>
          )}
        </div>

        {/* Example prompts */}
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-text-dim)] font-medium uppercase tracking-wider pl-1">Try an example</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => applyExample(ex)}
                className="text-xs px-3 py-2 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-brand)]/50 hover:text-[var(--color-brand-light)] hover:bg-[var(--color-brand)]/5 transition-all bg-[var(--color-surface-3)]"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Type selector */}
        <TypeSelector value={type} onChange={setType} />

        {/* Optional details toggle */}
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] bg-[var(--color-surface-2)]"
        >
          <ChevronDown
            size={15}
            className={`transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}
          />
          {showDetails ? 'Hide extra options' : '✨ Add more details (optional)'}
        </button>

        {showDetails && (
          <div className="space-y-4 pl-4 border-l-2 border-[var(--color-brand)]/20">
            <Input
              label="Who is it for?"
              placeholder="kids who like scary games, sneaker fans..."
              value={forWho}
              onChange={(e) => setForWho(e.target.value)}
            />
            <Input
              label="Must include"
              placeholder="3 levels, a boss, health bar..."
              value={mustInclude}
              onChange={(e) => setMustInclude(e.target.value)}
            />
            <Input
              label="Style / vibe"
              placeholder="dark neon, bright and fun, futuristic..."
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            />
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full gap-2 glow-sm"
          disabled={!prompt.trim()}
        >
          <Sparkles size={18} />
          Build this with AI
        </Button>
      </form>
    </div>
  )
}
