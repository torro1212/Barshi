'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useBuilderStore, selectProjectType } from '@/stores/builderStore'

const SUGGESTIONS: Record<string, string[]> = {
  game:    ['Add more challenge', 'Make a clearer goal', 'Make it more fun', 'Make enemies trickier', 'Add a power-up'],
  website: ['Make it look cleaner', 'Add a big action button', 'Make it easier to use', 'Add cool animations', 'Make it pop more'],
  story:   ['Add more suspense', 'Make choices more exciting', 'Add a surprise twist', 'Make the mood stronger'],
  tool:    ['Make it easier to use', 'Add helpful messages', 'Make the layout clearer', 'Check for mistakes'],
  default: ['Make it better', 'Add more detail', 'Improve the look', 'Make it more fun'],
}

interface SmarterPanelProps {
  onApply: (request: string) => Promise<void>
}

export function SmarterPanel({ onApply }: SmarterPanelProps) {
  const { isProcessing } = useBuilderStore()
  const type = useBuilderStore(selectProjectType)
  const [request, setRequest] = useState('')
  const suggestions = SUGGESTIONS[type] ?? SUGGESTIONS.default

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!request.trim() || isProcessing) return
    await onApply(request.trim())
    setRequest('')
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm mb-1">Level Up ✨</h3>
        <p className="text-xs text-[var(--color-text-muted)]">Tell AI what to make better</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          placeholder="Make the game harder, add more enemies, make the colors brighter..."
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          className="min-h-20 resize-none"
        />
        <Button type="submit" size="sm" className="w-full gap-1.5" loading={isProcessing} disabled={!request.trim()}>
          <Sparkles size={14} />
          Make it better
        </Button>
      </form>

      <div>
        <p className="text-xs text-[var(--color-text-dim)] mb-2">Try these:</p>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={isProcessing}
              onClick={() => setRequest(s)}
              className="text-xs px-2.5 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
