'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Plus, Wand2, X, Sparkles, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TypeBadge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { ConceptSketch } from './ConceptSketch'
import type { BuildPlan } from '@/types'

interface BuildPlanDisplayProps {
  plan: BuildPlan | null
  onApprove: (plan: BuildPlan) => void
  onBack: () => void
}

export function BuildPlanDisplay({ plan, onApprove, onBack }: BuildPlanDisplayProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [draft, setDraft] = useState<BuildPlan | null>(plan)
  const [refineText, setRefineText] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)

  // Sync draft when a new plan arrives from the parent
  useEffect(() => {
    setDraft(plan)
  }, [plan])

  async function requestChanges() {
    if (!draft || !refineText.trim() || refining) return
    setRefining(true)
    setRefineError(null)
    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refinePlan: draft, instruction: refineText.trim() }),
      })
      if (!res.ok) throw new Error('refine failed')
      const updated: BuildPlan = await res.json()
      setDraft(updated)
      setRefineText('')
    } catch {
      setRefineError("Couldn't update the sketch — try rewording it.")
    } finally {
      setRefining(false)
    }
  }

  if (!plan || !draft) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Spinner size="lg" />
        <p className="text-[var(--color-text-muted)] text-sm">Planning your project, one sec…</p>
      </div>
    )
  }

  async function handleApprove() {
    if (!draft) return
    setIsApproving(true)
    await onApprove(draft)
  }

  function updateList(key: 'screens' | 'components' | 'rules', next: string[]) {
    setDraft((d) => (d ? { ...d, [key]: next } : d))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 hover:bg-[var(--color-surface-3)] rounded-[var(--radius-md)] transition-colors">
          <ArrowLeft size={16} className="text-[var(--color-text-muted)]" />
        </button>
        <h2 className="text-lg font-bold">Here&apos;s the idea 👇</h2>
      </div>

      {/* Visual concept sketch — updates live as the plan changes */}
      <ConceptSketch plan={draft} />

      {/* Ask AI to change the idea in natural language */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/8 p-3 space-y-2">
        <p className="text-xs font-semibold text-[var(--color-brand-light)] flex items-center gap-1.5">
          <Sparkles size={12} /> Want to change something before we build?
        </p>
        <div className="flex gap-2">
          <input
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); requestChanges() } }}
            placeholder="e.g. make it a 2-player game, add a jungle theme…"
            disabled={refining}
            className="flex-1 h-10 px-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] outline-none focus:border-[var(--color-brand)]/60 disabled:opacity-50"
          />
          <Button size="md" className="gap-1.5 flex-shrink-0" onClick={requestChanges} loading={refining} disabled={!refineText.trim()}>
            <Send size={14} />
            Update
          </Button>
        </div>
        {refineError && <p className="text-xs text-[var(--color-danger)]">{refineError}</p>}
      </div>

      <p className="text-xs text-[var(--color-text-dim)] pl-1">
        Or tap anything below to tweak it by hand — ✕ removes, ➕ adds.
      </p>

      {/* Plan summary — editable title + summary */}
      <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] border border-[var(--color-border)] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <InlineText
            value={draft.title}
            onChange={(v) => setDraft((d) => (d ? { ...d, title: v } : d))}
            placeholder="Give it a name"
            className="font-bold text-base flex-1"
          />
          <TypeBadge type={draft.type} />
        </div>
        <InlineText
          value={draft.summary}
          onChange={(v) => setDraft((d) => (d ? { ...d, summary: v } : d))}
          placeholder="One sentence about what it does"
          className="text-sm text-[var(--color-text-muted)]"
          multiline
        />
      </div>

      <EditableSection
        title="Screens"
        icon="🖥️"
        items={draft.screens}
        onChange={(next) => updateList('screens', next)}
        addLabel="Add a screen"
      />

      <EditableSection
        title="What's inside"
        icon="⚙️"
        items={draft.components}
        onChange={(next) => updateList('components', next)}
        addLabel="Add a feature"
      />

      <EditableSection
        title="How it works"
        icon="⚡"
        items={draft.rules}
        onChange={(next) => updateList('rules', next)}
        addLabel="Add a rule"
      />

      {/* Theme — editable */}
      <div className="flex items-center gap-2 text-sm">
        <span>🎨</span>
        <span className="text-[var(--color-text-muted)]">Style:</span>
        <InlineText
          value={draft.theme}
          onChange={(v) => setDraft((d) => (d ? { ...d, theme: v } : d))}
          placeholder="dark neon, bright…"
          className="text-[var(--color-text)] font-medium flex-1"
        />
      </div>

      <Button
        size="lg"
        className="w-full gap-2"
        onClick={handleApprove}
        loading={isApproving}
      >
        <Wand2 size={18} />
        Yes, build it! 🚀
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Editable section — list of items with inline edit / delete / add
// ─────────────────────────────────────────────────────────────────────────

interface EditableSectionProps {
  title: string
  icon: string
  items: string[]
  onChange: (next: string[]) => void
  addLabel: string
}

function EditableSection({ title, icon, items, onChange, addLabel }: EditableSectionProps) {
  const [newItemDraft, setNewItemDraft] = useState<string | null>(null)

  function updateAt(idx: number, value: string) {
    const next = [...items]
    next[idx] = value
    onChange(next)
  }

  function removeAt(idx: number) {
    onChange(items.filter((_, i) => i !== idx))
  }

  function commitNew() {
    if (!newItemDraft || !newItemDraft.trim()) {
      setNewItemDraft(null)
      return
    }
    onChange([...items, newItemDraft.trim()])
    setNewItemDraft(null)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
        <span>{icon}</span>{title}
      </p>

      <ul className="space-y-1">
        {items.map((item, idx) => (
          <EditableRow
            key={`${idx}-${item}`}
            value={item}
            onChange={(v) => updateAt(idx, v)}
            onRemove={() => removeAt(idx)}
          />
        ))}

        {newItemDraft !== null && (
          <li className="flex items-center gap-2 text-sm group">
            <Check size={13} className="text-[var(--color-brand)] flex-shrink-0" />
            <input
              autoFocus
              value={newItemDraft}
              onChange={(e) => setNewItemDraft(e.target.value)}
              onBlur={commitNew}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitNew() }
                if (e.key === 'Escape') setNewItemDraft(null)
              }}
              placeholder="Type and press Enter…"
              className="flex-1 bg-transparent border-b border-[var(--color-brand)] text-sm text-[var(--color-text)] outline-none py-0.5"
            />
          </li>
        )}
      </ul>

      <button
        type="button"
        onClick={() => setNewItemDraft('')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-brand-light)] hover:text-[var(--color-brand)] pl-5 py-1 transition-colors"
      >
        <Plus size={12} />
        {addLabel}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Editable row — click to edit, X to delete
// ─────────────────────────────────────────────────────────────────────────

function EditableRow({
  value,
  onChange,
  onRemove,
}: {
  value: string
  onChange: (next: string) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    const trimmed = draft.trim()
    if (!trimmed) {
      onRemove()
    } else if (trimmed !== value) {
      onChange(trimmed)
    }
    setEditing(false)
  }

  return (
    <li className="flex items-center gap-2 text-sm group">
      <Check size={13} className="text-[var(--color-brand)] flex-shrink-0" />

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { setDraft(value); setEditing(false) }
          }}
          className="flex-1 bg-transparent border-b border-[var(--color-brand)] text-sm text-[var(--color-text)] outline-none py-0.5"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex-1 text-left text-[var(--color-text)] hover:text-[var(--color-brand-light)] transition-colors py-0.5 cursor-text"
          title="Click to edit"
        >
          {value}
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-[var(--radius-sm)] text-[var(--color-text-dim)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-all"
        title="Remove"
        aria-label="Remove"
      >
        <X size={13} />
      </button>
    </li>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Inline editable text (title / summary / theme)
// ─────────────────────────────────────────────────────────────────────────

function InlineText({
  value,
  onChange,
  placeholder,
  className = '',
  multiline = false,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  className?: string
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => { setDraft(value) }, [value])

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onChange(trimmed)
    else setDraft(value)
    setEditing(false)
  }

  if (editing) {
    const common = {
      autoFocus: true,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit() }
      },
      placeholder,
      className: `${className} bg-transparent border-b border-[var(--color-brand)] outline-none resize-none w-full`,
    }
    return multiline ? <textarea rows={2} {...common} /> : <input {...common} />
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`${className} text-left hover:text-[var(--color-brand-light)] transition-colors cursor-text`}
      title="Click to edit"
    >
      {value || <span className="text-[var(--color-text-dim)] italic">{placeholder}</span>}
    </button>
  )
}
