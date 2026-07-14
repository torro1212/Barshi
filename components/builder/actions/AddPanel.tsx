'use client'

import { useBuilderStore, selectProjectType } from '@/stores/builderStore'

const BLOCKS: Record<string, { icon: string; label: string; request: string }[]> = {
  game: [
    { icon: '❤️', label: 'Health bar',    request: 'Add a health bar to the game' },
    { icon: '⭐', label: 'Score counter', request: 'Add a score counter' },
    { icon: '👾', label: 'New enemy',     request: 'Add a new type of enemy' },
    { icon: '🏆', label: 'Win screen',    request: 'Add a win screen with a message' },
    { icon: '💀', label: 'Game over',     request: 'Add a game over screen' },
    { icon: '⏱️', label: 'Timer',         request: 'Add a countdown timer' },
    { icon: '🪙', label: 'Coins',         request: 'Add collectible coins' },
    { icon: '🔋', label: 'Power-up',      request: 'Add a power-up item' },
  ],
  website: [
    { icon: '🏠', label: 'New page',     request: 'Add a new page section' },
    { icon: '🔘', label: 'Button',       request: 'Add a prominent call-to-action button' },
    { icon: '📋', label: 'Form',         request: 'Add a contact or feedback form' },
    { icon: '🖼️', label: 'Image section',request: 'Add an image gallery section' },
    { icon: '📌', label: 'Menu',         request: 'Add a navigation menu' },
    { icon: '💬', label: 'Popup',        request: 'Add a popup message' },
    { icon: '🛒', label: 'Cart',         request: 'Add a shopping cart area' },
    { icon: '✅', label: 'Checklist',    request: 'Add a checklist or to-do section' },
  ],
  story: [
    { icon: '🎭', label: 'New scene',    request: 'Add a new scene to the story' },
    { icon: '🔀', label: 'Choice',       request: 'Add a branching choice moment' },
    { icon: '🎵', label: 'Sound cue',    request: 'Add an atmospheric sound description' },
    { icon: '🏁', label: 'New ending',   request: 'Add a new alternate ending' },
  ],
  tool: [
    { icon: '📥', label: 'Input field',  request: 'Add an input field' },
    { icon: '📤', label: 'Output area',  request: 'Add an output or result area' },
    { icon: '🔘', label: 'Button',       request: 'Add an action button' },
    { icon: '⚙️', label: 'Counter',      request: 'Add a counter or tracker' },
    { icon: '📊', label: 'Progress bar', request: 'Add a progress bar' },
  ],
  default: [
    { icon: '➕', label: 'Section',    request: 'Add a new section' },
    { icon: '🔘', label: 'Button',     request: 'Add a button' },
    { icon: '📝', label: 'Text block', request: 'Add a text block' },
    { icon: '🖼️', label: 'Image',      request: 'Add an image placeholder' },
  ],
}

interface AddPanelProps {
  onApply: (request: string) => Promise<void>
}

export function AddPanel({ onApply }: AddPanelProps) {
  const type = useBuilderStore(selectProjectType)
  const { isProcessing } = useBuilderStore()
  const blocks = BLOCKS[type] ?? BLOCKS.default

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm mb-1">Add something ➕</h3>
        <p className="text-xs text-[var(--color-text-muted)]">Tap anything to add it instantly</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {blocks.map(({ icon, label, request }) => (
          <button
            key={label}
            type="button"
            disabled={isProcessing}
            onClick={() => onApply(request)}
            className="flex items-center gap-2 p-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface-3)] border border-[var(--color-border)] text-left hover:border-[var(--color-border-light)] hover:bg-[var(--color-surface-2)] transition-all disabled:opacity-50 active:scale-[0.97]"
          >
            <span className="text-lg">{icon}</span>
            <span className="text-xs font-medium text-[var(--color-text-muted)]">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
