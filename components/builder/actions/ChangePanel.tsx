'use client'

import { useState, useEffect } from 'react'
import { Send, X, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useBuilderStore } from '@/stores/builderStore'

const QUICK = [
  'Make it darker', 'Make it bigger', 'Make it faster',
  'Add more color', 'Make it simpler', 'Add more detail',
]

interface ChangePanelProps {
  onApply: (request: string) => Promise<void>
}

/** Turn a seed like `Change the "Boss Battle!" screen: ` into a short label
 *  ("Boss Battle!" screen) to show in the locked target chip. */
function seedToLabel(seed: string): string {
  if (/^TARGET ELEMENT/i.test(seed)) {
    const m = seed.match(/CSS path:\s*([^)]+)\)/i)
    const path = m?.[1]?.trim() ?? ''
    const last = path.split('>').pop()?.trim().replace(/:nth-of-type\(\d+\)/g, '') ?? 'element'
    return `Selected: ${last}`
  }
  if (/^Change the style/i.test(seed)) return 'Style'
  const m = seed.match(/"([^"]+)"\s*(screen)?/i)
  if (m) return m[2] ? `${m[1]} screen` : m[1]
  return seed.replace(/^Change (the )?/i, '').replace(/:\s*$/, '')
}

export function ChangePanel({ onApply }: ChangePanelProps) {
  const { isProcessing, actionSeed, setActionSeed } = useBuilderStore()
  // The locked target (from a Project Map click). Non-editable prefix that only
  // changes when another map item is clicked.
  const [context, setContext] = useState(actionSeed)
  const [request, setRequest] = useState('')

  useEffect(() => {
    if (actionSeed) {
      setContext(actionSeed)
      setRequest('')
      setActionSeed('')
    }
  }, [actionSeed, setActionSeed])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!request.trim() || isProcessing) return
    // Combine the locked target with the user's description
    const full = context ? `${context}${request.trim()}` : request.trim()
    await onApply(full)
    setRequest('')
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm mb-1">Change something ✏️</h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          {context ? 'Tell AI how to change this part' : 'Tell AI what to change — anything goes!'}
        </p>
      </div>

      {/* Locked target chip — only changes when another Map item is clicked */}
      {context && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/30 px-3 py-2">
          <Target size={13} className="text-[var(--color-brand-light)] flex-shrink-0" />
          <span className="text-xs font-semibold text-[var(--color-brand-light)] truncate flex-1">
            {seedToLabel(context)}
          </span>
          <button
            type="button"
            onClick={() => setContext('')}
            aria-label="Clear target"
            className="text-[var(--color-text-dim)] hover:text-[var(--color-text)] flex-shrink-0"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          placeholder={context ? 'e.g. make it bigger and add glowing edges' : "Make the background blue, change the button to say 'Go!', make the text bigger…"}
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          className="min-h-20 resize-none"
        />
        <Button type="submit" size="sm" className="w-full gap-1.5" loading={isProcessing} disabled={!request.trim()}>
          <Send size={14} />
          Make the change
        </Button>
      </form>

      <div>
        <p className="text-xs text-[var(--color-text-dim)] mb-2">Quick ideas:</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setRequest(q)}
              disabled={isProcessing}
              className="text-xs px-2.5 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
