// Apply Object.is polyfill for Safari before creating store
if (typeof Object.is !== 'function') {
  Object.is = function (x, y) {
    if (x === y) {
      return x !== 0 || 1 / x === 1 / (y as number)
    } else {
      return x !== x && y !== y
    }
  }
}

import { create } from 'zustand'
import type { BuildPlan, ProjectMeta, ProjectType } from '@/types'

type BuilderAction = 'add' | 'change' | 'fix' | 'smarter' | null
type BuilderPhase = 'idle' | 'intent' | 'plan' | 'generating' | 'building'

interface HistoryEntry {
  html: string
  timestamp: number
}

interface BuilderState {
  /** Current project ID (null if unsaved) */
  projectId: string | null

  /** Current HTML source (the live runnable code) */
  html: string

  /** Lightweight metadata about the project structure */
  meta: ProjectMeta | null

  /** The approved build plan (from creation flow) */
  buildPlan: BuildPlan | null

  /** Which action panel is open */
  activeAction: BuilderAction

  /** Whether the builder is processing an AI request */
  isProcessing: boolean

  /** Current generation/edit progress message */
  progressMessage: string

  /** Characters of code streamed so far (drives the live build meter) */
  genChars: number

  /** Prefill text for the next opened action panel (set when clicking a
   *  Project Map item), consumed once by the panel */
  actionSeed: string

  /** In-session undo history (circular buffer, max 20) */
  history: HistoryEntry[]
  historyIndex: number

  /** Whether unsaved changes exist */
  isDirty: boolean

  /** Current phase of the creation flow */
  phase: BuilderPhase

  // Actions
  setProjectId: (id: string) => void
  setHTML: (html: string) => void
  setMeta: (meta: ProjectMeta) => void
  setBuildPlan: (plan: BuildPlan) => void
  setActiveAction: (action: BuilderAction) => void
  setProcessing: (processing: boolean, message?: string) => void
  setGenChars: (chars: number) => void
  setActionSeed: (seed: string) => void
  setPhase: (phase: BuilderPhase) => void

  /** Push current HTML to history before making a change */
  pushHistory: () => void

  /** Undo to previous HTML */
  undo: () => string | null

  /** Redo to next HTML */
  redo: () => string | null

  /** Check if undo is available */
  canUndo: () => boolean
  canRedo: () => boolean

  /** Reset the entire builder state */
  reset: () => void
}

const MAX_HISTORY = 20

export const useBuilderStore = create<BuilderState>((set, get) => ({
  projectId: null,
  html: '',
  meta: null,
  buildPlan: null,
  activeAction: null,
  isProcessing: false,
  progressMessage: '',
  genChars: 0,
  actionSeed: '',
  history: [],
  historyIndex: -1,
  isDirty: false,
  phase: 'idle',

  setProjectId: (id) => set({ projectId: id }),

  setHTML: (html) =>
    set({ html, isDirty: true }),

  setMeta: (meta) => set({ meta }),

  setBuildPlan: (plan) => set({ buildPlan: plan }),

  setActiveAction: (action) => set({ activeAction: action }),

  setProcessing: (isProcessing, message = '') =>
    set({ isProcessing, progressMessage: message, ...(isProcessing ? {} : { genChars: 0 }) }),

  setGenChars: (genChars) => set({ genChars }),

  setActionSeed: (actionSeed) => set({ actionSeed }),

  setPhase: (phase) => set({ phase }),

  pushHistory: () => {
    const { html, history, historyIndex } = get()
    if (!html) return

    // Trim any redo history ahead of current index
    const trimmed = history.slice(0, historyIndex + 1)

    const entry: HistoryEntry = { html, timestamp: Date.now() }
    const newHistory = [...trimmed, entry].slice(-MAX_HISTORY)

    set({ history: newHistory, historyIndex: newHistory.length - 1 })
  },

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex <= 0) return null

    const newIndex = historyIndex - 1
    const entry = history[newIndex]
    set({ historyIndex: newIndex, html: entry.html })
    return entry.html
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return null

    const newIndex = historyIndex + 1
    const entry = history[newIndex]
    set({ historyIndex: newIndex, html: entry.html })
    return entry.html
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  reset: () =>
    set({
      projectId: null,
      html: '',
      meta: null,
      buildPlan: null,
      activeAction: null,
      isProcessing: false,
      progressMessage: '',
      genChars: 0,
      actionSeed: '',
      history: [],
      historyIndex: -1,
      isDirty: false,
      phase: 'idle',
    }),
}))

/** Selector for project type (derived from meta) */
export const selectProjectType = (state: BuilderState): ProjectType =>
  state.meta?.type ?? 'game'
