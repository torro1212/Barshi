'use client'

import { useState } from 'react'
import {
  Plus, Pencil, Wrench, Sparkles, Rocket,
  Undo2, Map, Eye, ChevronLeft, Loader2, History,
  MousePointerClick, Trash2, X, Move,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { LivePreview, type PickedElement, type MovedElement } from './LivePreview'
import { BuildOverlay } from './BuildOverlay'
import { SystemMap } from './SystemMap'
import { ChangePanel } from './actions/ChangePanel'
import { AddPanel } from './actions/AddPanel'
import { FixPanel } from './actions/FixPanel'
import { SmarterPanel } from './actions/SmarterPanel'
import { PublishModal } from './PublishModal'
import { VersionHistory } from './VersionHistory'
import { Button } from '@/components/ui/button'
import { sanitizeHTML } from '@/lib/ai/sanitize'
import { readAIStream } from '@/lib/ai/stream'
import { useBuilderStore } from '@/stores/builderStore'
import { useAutoSave } from '@/hooks/useAutoSave'
import type { FixIssue } from '@/types'

type ActionKey = 'add' | 'change' | 'fix' | 'smarter'
type MobileTab = 'preview' | 'map' | 'actions'

const ACTIONS: { key: ActionKey; icon: React.ReactNode; label: string }[] = [
  { key: 'add',     icon: <Plus size={16} />,     label: 'Add' },
  { key: 'change',  icon: <Pencil size={16} />,   label: 'Change' },
  { key: 'fix',     icon: <Wrench size={16} />,   label: 'Fix' },
  { key: 'smarter', icon: <Sparkles size={16} />, label: 'Level Up' },
]

export function BuilderLayout() {
  const store = useBuilderStore()
  const { html, meta, projectId, isProcessing, progressMessage, canUndo, pushHistory, setHTML, setProcessing, setActionSeed, undo } = store

  const [activeAction, setActiveAction] = useState<ActionKey | null>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>('preview')
  const [publishOpen, setPublishOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [pickMode, setPickMode] = useState(false)
  const [picked, setPicked] = useState<PickedElement | null>(null)
  const [moveView, setMoveView] = useState(false)
  const [dragSelector, setDragSelector] = useState<string | null>(null)
  const [locate, setLocate] = useState<{ text: string; nonce: number } | null>(null)
  const [showRevert, setShowRevert] = useState(false)

  /** Show the one-tap Revert bar after an AI change lands. */
  function markChanged() {
    setShowRevert(true)
  }
  function revertLastChange() {
    const h = undo()
    if (h) setHTML(h)
    setShowRevert(false)
  }

  /** Project Map click opens the Change panel pre-filled with that item, and
   *  flashes the matching element in the live preview so the user sees it. */
  function handleMapItemClick(seed: string, rawLabel: string) {
    if (isProcessing) return
    setActionSeed(seed)
    setActiveAction('change')
    if (rawLabel) setLocate({ text: rawLabel, nonce: Date.now() })
    // On mobile, show the preview briefly so the flash is visible, then Edit
    setMobileTab('preview')
    setTimeout(() => setMobileTab('actions'), 1400)
  }

  /** An element was clicked in point-and-edit mode → show the quick action sheet */
  function handlePick(el: PickedElement) {
    setPickMode(false)
    setMoveView(false)
    setPicked(el)
  }
  function closePicked() {
    setPicked(null)
    setMoveView(false)
  }

  /** A precise reference to the picked element the AI can match exactly. */
  function pickedTarget(el: PickedElement): string {
    return `TARGET ELEMENT (CSS path: ${el.selector}). Its exact current markup is:\n${el.outerHTML}\n`
  }

  /** Quick actions on the picked element */
  function pickedChange() {
    if (!picked) return
    // Seed the Change panel with the exact target so the AI can't mistake it
    setActionSeed(`${pickedTarget(picked)}\nChange ONLY this element as follows: `)
    setActiveAction('change')
    setMobileTab('actions')
    closePicked()
  }
  function pickedImprove() {
    if (!picked) return
    const el = picked
    closePicked()
    applyEdit(`${pickedTarget(el)}\nImprove ONLY this exact element — make it look nicer and more polished. Do NOT change, replace, or remove any other element on the page. Return the complete file.`)
  }
  function pickedRemove() {
    if (!picked) return
    const el = picked
    closePicked()
    applyEdit(`${pickedTarget(el)}\nDelete ONLY this exact element (and its own contents) from the HTML. Do NOT delete, replace, or alter its parent, its siblings, or any other element. Everything else must stay byte-for-byte identical. Return the complete file.`)
  }
  /** Move the picked element to a named position / order (AI-based, for reorders). */
  function pickedMove(where: string) {
    if (!picked) return
    const el = picked
    closePicked()
    applyEdit(`${pickedTarget(el)}\nMove ONLY this exact element ${where}. Reposition it using CSS/layout (e.g. flexbox alignment, order, margin, or absolute position) — do NOT change its content, and do NOT move, remove, or restyle any other element. Everything else must keep working and looking the same. Return the complete file.`)
  }

  /** Start free-drag: arm the element in the iframe so the user drags it. */
  function pickedStartDrag() {
    if (!picked) return
    setDragSelector(picked.selector)
    closePicked()
  }

  /** Drop handler — apply the exact position DIRECTLY in code (no AI, instant).
   *  Parses the current HTML, finds the dragged element by its selector, and
   *  pins it with position:fixed at the drop point (percent of viewport). */
  function handleMoved(m: MovedElement) {
    setDragSelector(null)
    if (typeof window === 'undefined' || !html) return
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const el = doc.querySelector(m.selector) as HTMLElement | null
      if (!el) { window.alert("Couldn't move that one — try again."); return }
      pushHistory()
      snapshotVersion(html)
      // Reparent to <body> so a transformed/positioned ancestor can't hijack the
      // fixed positioning — this makes the drop land exactly where the user let go.
      if (doc.body && el.parentElement !== doc.body) doc.body.appendChild(el)
      el.style.position = 'fixed'
      el.style.left = `${m.leftPct.toFixed(2)}%`
      el.style.top = `${m.topPct.toFixed(2)}%`
      el.style.transform = 'translate(-50%, -50%)'
      el.style.margin = '0'
      el.style.zIndex = '9999'
      const out = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML
      setHTML(sanitizeHTML(out).html)
      markChanged()
    } catch {
      window.alert("Couldn't move that one — try again.")
    }
  }

  /** Persist the current HTML as a restorable version snapshot (fire-and-forget) */
  function snapshotVersion(currentHtml: string) {
    if (!projectId || !currentHtml) return
    fetch(`/api/projects/${projectId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: currentHtml }),
    }).catch(() => null)
  }

  // Auto-save
  useAutoSave({
    data: html,
    projectId,
    enabled: !!projectId,
    delay: 30_000,
    onSave: async (id, currentHtml) => {
      await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: currentHtml }),
      })
    },
  })

  // Streaming edit helper - endpoint differs per action ("Level Up" uses the
  // heavier /api/ai/smarter model, everything else uses /api/ai/edit)
  async function applyEditWith(endpoint: string, request: string, message: string) {
    if (!html || isProcessing) return
    pushHistory()
    snapshotVersion(html)
    setProcessing(true, message)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, request, meta }),
      })

      // The route emits a final { done, html } with the sanitized doc; if that
      // frame is missing (e.g. dropped), fall back to sanitizing what we got.
      // On an explicit error frame, leave the project untouched.
      let applied = false
      let errored = false
      const raw = await readAIStream(res, {
        onDone: (finalHtml) => {
          if (finalHtml) { setHTML(finalHtml); applied = true }
        },
        onError: (msg) => {
          errored = true
          if (typeof window !== 'undefined') window.alert(msg)
        },
      })
      if (!applied && !errored && raw) { setHTML(sanitizeHTML(raw).html); applied = true }
      if (applied) markChanged()
    } catch (err) {
      console.error('[applyEdit]', err)
    } finally {
      setProcessing(false)
    }
  }

  const applyEdit = (request: string) =>
    applyEditWith('/api/ai/edit', request, 'Applying change…')

  const applySmarter = (request: string) =>
    applyEditWith('/api/ai/smarter', request, 'Leveling up…')

  async function analyzeIssues(): Promise<FixIssue[]> {
    if (!html) return []
    const res = await fetch('/api/ai/fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
    })
    const data = await res.json()
    return data.issues ?? []
  }

  function applyFix(fixedHtml: string) {
    pushHistory()
    snapshotVersion(html)
    setHTML(fixedHtml)
    markChanged()
  }

  function renderAction() {
    if (!activeAction) return null
    if (activeAction === 'add')     return <AddPanel onApply={applyEdit} />
    if (activeAction === 'change')  return <ChangePanel onApply={applyEdit} />
    if (activeAction === 'fix')     return <FixPanel onAnalyze={analyzeIssues} onApplyFix={applyFix} />
    if (activeAction === 'smarter') return <SmarterPanel onApply={applySmarter} />
    return null
  }

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden md:flex w-full h-[calc(100vh-56px)] overflow-hidden">
        {/* Left: System Map */}
        <div className="w-[200px] lg:w-[220px] flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-y-auto">
          <SystemMap meta={meta} onItemClick={handleMapItemClick} />
        </div>

        {/* Center: Live Preview */}
        <div className="flex-1 min-w-0 p-3 bg-[var(--color-surface)]">
          <div className="h-full relative">
            {/* Rich full-panel overlay during the first generation */}
            {isProcessing && !html && <BuildOverlay />}
            {/* Compact pill for edits (html already present) */}
            {isProcessing && html && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-full px-4 py-2 text-sm">
                <Loader2 size={14} className="animate-spin text-[var(--color-brand)]" />
                {progressMessage}
              </div>
            )}
            <LivePreview html={html} isLoading={false} pickMode={pickMode} onPick={handlePick} dragSelector={dragSelector} onMoved={handleMoved} onDragEnd={() => setDragSelector(null)} locate={locate} />
            {showRevert && !isProcessing && (
              <RevertBar onRevert={revertLastChange} onDismiss={() => setShowRevert(false)} canUndo={canUndo()} />
            )}
          </div>
        </div>

        {/* Right: Action Panel */}
        <div className="w-[280px] flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-col">
          {/* Toolbar */}
          <div className="p-3 border-b border-[var(--color-border)] space-y-2">
            <div className="grid grid-cols-4 gap-1">
              {ACTIONS.map(({ key, icon, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveAction(activeAction === key ? null : key)}
                  disabled={isProcessing}
                  className={`flex flex-col items-center gap-1 py-2 rounded-[var(--radius-md)] text-xs font-medium transition-colors disabled:opacity-50 ${
                    activeAction === key
                      ? 'bg-[var(--color-brand)] text-white'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {/* Point & edit toggle */}
            <button
              onClick={() => setPickMode((v) => !v)}
              disabled={!html || isProcessing}
              className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius-md)] text-xs font-semibold transition-colors disabled:opacity-40 ${
                pickMode
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]'
              }`}
            >
              <MousePointerClick size={14} />
              {pickMode ? 'Tap an element…' : 'Point & edit'}
            </button>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { const h = undo(); if (h) setHTML(h) }}
                disabled={!canUndo() || isProcessing}
                className="flex-1 gap-1"
              >
                <Undo2 size={13} /> Undo
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHistoryOpen(true)}
                disabled={!projectId || isProcessing}
                className="gap-1"
                title="Version history"
              >
                <History size={13} /> History
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setPublishOpen(true)}
                disabled={!html}
                className="flex-1 gap-1"
              >
                <Rocket size={13} /> Publish
              </Button>
            </div>
          </div>

          {/* Action content */}
          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              {activeAction ? (
                <motion.div
                  key={activeAction}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  {renderAction()}
                </motion.div>
              ) : (
                <div className="space-y-2 pt-1">
                  {[
                    { key: 'add',     icon: '➕', label: 'Add',      desc: 'Add new things to your project' },
                    { key: 'change',  icon: '✏️', label: 'Change',   desc: 'Change colors, text, anything' },
                    { key: 'fix',     icon: '🔧', label: 'Fix',      desc: 'Find and fix things that broke' },
                    { key: 'smarter', icon: '✨', label: 'Level Up', desc: 'Make your project even better' },
                  ].map(({ key, icon, label, desc }) => (
                    <button
                      key={key}
                      onClick={() => setActiveAction(key as ActionKey)}
                      disabled={isProcessing}
                      className="w-full flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-surface-4)] transition-all text-left disabled:opacity-50"
                    >
                      <span className="text-lg">{icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-[var(--color-text)]">{label}</p>
                        <p className="text-xs text-[var(--color-text-dim)]">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col h-[calc(100dvh-56px)]">
        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === 'preview' && (
            <div className="h-full p-2 relative">
              {isProcessing && !html && <BuildOverlay />}
              {isProcessing && html && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-full px-3 py-1.5 text-xs">
                  <Loader2 size={12} className="animate-spin text-[var(--color-brand)]" />
                  {progressMessage}
                </div>
              )}
              <LivePreview html={html} isLoading={false} pickMode={pickMode} onPick={handlePick} dragSelector={dragSelector} onMoved={handleMoved} onDragEnd={() => setDragSelector(null)} locate={locate} />
              {html && !isProcessing && (
                <button
                  onClick={() => setPickMode((v) => !v)}
                  className={`absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold shadow-lg transition-colors ${
                    pickMode ? 'bg-[var(--color-brand)] text-white' : 'bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)]'
                  }`}
                >
                  <MousePointerClick size={14} />
                  {pickMode ? 'Tap element' : 'Point & edit'}
                </button>
              )}
              {showRevert && !isProcessing && (
                <RevertBar onRevert={revertLastChange} onDismiss={() => setShowRevert(false)} canUndo={canUndo()} />
              )}
            </div>
          )}
          {mobileTab === 'map' && (
            <div className="h-full overflow-y-auto">
              <SystemMap meta={meta} onItemClick={handleMapItemClick} />
            </div>
          )}
          {mobileTab === 'actions' && (
            <div className="h-full overflow-y-auto p-4 space-y-4">
              {/* Action buttons */}
              {!activeAction ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {ACTIONS.map(({ key, icon, label }) => (
                      <button
                        key={key}
                        onClick={() => setActiveAction(key)}
                        disabled={isProcessing}
                        className="flex items-center gap-2 p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] border border-[var(--color-border)] font-medium text-sm hover:border-[var(--color-border-light)] transition-colors disabled:opacity-50"
                      >
                        {icon}{label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { const h = undo(); if (h) setHTML(h) }}
                      disabled={!canUndo() || isProcessing}
                      className="flex-1 gap-1"
                    >
                      <Undo2 size={13} /> Undo
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => setHistoryOpen(true)}
                      disabled={!projectId || isProcessing}
                      className="gap-1"
                    >
                      <History size={13} /> History
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setPublishOpen(true)}
                      disabled={!html}
                      className="flex-1 gap-1"
                    >
                      <Rocket size={13} /> Publish
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={() => setActiveAction(null)}
                    className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  >
                    <ChevronLeft size={14} /> Back
                  </button>
                  {renderAction()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile tab bar */}
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] grid grid-cols-3 h-14">
          {[
            { id: 'preview' as const, icon: <Eye size={20} />, label: 'Preview' },
            { id: 'map'     as const, icon: <Map size={20} />, label: 'Map' },
            { id: 'actions' as const, icon: <Plus size={20} />, label: 'Edit' },
          ].map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => setMobileTab(id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                mobileTab === id ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-dim)]'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Point-and-edit action sheet for the picked element */}
      <AnimatePresence>
        {picked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={closePicked}
          >
            <motion.div
              initial={{ y: 20, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--color-text-dim)] uppercase tracking-wider font-semibold">
                    {moveView ? 'Move — where to?' : 'Selected'}
                  </p>
                  <p className="text-sm font-bold text-[var(--color-text)] truncate mt-0.5">
                    {picked.text ? `"${picked.text}"` : `<${picked.tag}>`}
                  </p>
                </div>
                <button onClick={closePicked} className="h-8 w-8 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] flex-shrink-0">
                  <X size={16} />
                </button>
              </div>

              {!moveView ? (
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={pickedChange} className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-brand)]/50 transition-all text-left">
                    <Pencil size={16} className="text-[var(--color-brand-light)]" />
                    <div>
                      <p className="text-sm font-semibold">Change it</p>
                      <p className="text-xs text-[var(--color-text-dim)]">Tell AI exactly what to change</p>
                    </div>
                  </button>
                  <button onClick={() => setMoveView(true)} className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-brand)]/50 transition-all text-left">
                    <Move size={16} className="text-[var(--color-brand-light)]" />
                    <div>
                      <p className="text-sm font-semibold">Move it</p>
                      <p className="text-xs text-[var(--color-text-dim)]">Put it somewhere else on the screen</p>
                    </div>
                  </button>
                  <button onClick={pickedImprove} className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-brand)]/50 transition-all text-left">
                    <Sparkles size={16} className="text-[var(--color-brand-light)]" />
                    <div>
                      <p className="text-sm font-semibold">Improve it</p>
                      <p className="text-xs text-[var(--color-text-dim)]">Let AI make it look nicer</p>
                    </div>
                  </button>
                  <button onClick={pickedRemove} className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-danger)]/50 transition-all text-left">
                    <Trash2 size={16} className="text-[var(--color-danger)]" />
                    <div>
                      <p className="text-sm font-semibold">Remove it</p>
                      <p className="text-xs text-[var(--color-text-dim)]">Delete this from the project</p>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Primary: free drag to an exact spot */}
                  <button
                    onClick={pickedStartDrag}
                    className="w-full flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-brand)]/12 border border-[var(--color-brand)]/40 hover:bg-[var(--color-brand)]/20 transition-all text-left"
                  >
                    <Move size={18} className="text-[var(--color-brand-light)]" />
                    <div>
                      <p className="text-sm font-semibold">Drag it anywhere</p>
                      <p className="text-xs text-[var(--color-text-dim)]">Grab it and drop it exactly where you want</p>
                    </div>
                  </button>

                  <p className="text-[10px] text-[var(--color-text-dim)] text-center">or snap it to a spot</p>

                  {/* Quick 9-position snap (still handy) */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      ['to the top-left corner', '↖'], ['to the top-center', '↑'], ['to the top-right corner', '↗'],
                      ['to the middle-left', '←'], ['to the exact center of the screen', '●'], ['to the middle-right', '→'],
                      ['to the bottom-left corner', '↙'], ['to the bottom-center', '↓'], ['to the bottom-right corner', '↘'],
                    ] as [string, string][]).map(([where, arrow]) => (
                      <button
                        key={arrow}
                        onClick={() => pickedMove(where)}
                        className="aspect-square flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-3)] border border-[var(--color-border)] text-lg hover:border-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 transition-all"
                        title={where}
                      >
                        {arrow}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setMoveView(false)} className="w-full flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-1">
                    <ChevronLeft size={14} /> Back
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} />
      <VersionHistory
        projectId={projectId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestore={(restored) => { pushHistory(); setHTML(restored) }}
      />
    </>
  )
}

/** One-tap "undo the change I just made" bar shown over the preview after an
 *  AI edit lands — so a wrong delete/change is trivially reversible. */
function RevertBar({ onRevert, onDismiss, canUndo }: { onRevert: () => void; onDismiss: () => void; canUndo: boolean }) {
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[var(--color-surface-2)] border border-[var(--color-border-light)] rounded-full pl-4 pr-2 py-2 shadow-2xl">
      <span className="text-xs text-[var(--color-text-muted)]">Change applied</span>
      <Button size="sm" variant="secondary" className="gap-1.5 h-8" onClick={onRevert} disabled={!canUndo}>
        <Undo2 size={13} /> Revert
      </Button>
      <button onClick={onDismiss} aria-label="Dismiss" className="h-7 w-7 rounded-full flex items-center justify-center text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)]">
        <X size={14} />
      </button>
    </div>
  )
}



