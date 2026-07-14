'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Wand2, Share2, X } from 'lucide-react'

const STORAGE_KEY = 'barshi_onboarded_v1'

const STEPS = [
  { icon: <Wand2 size={20} />,   title: 'Describe your idea', text: 'Type what you want to make — a game, website, story, or tool.' },
  { icon: <Sparkles size={20} />, title: 'AI builds it',       text: 'Watch it come to life in seconds. Then tweak it with simple buttons.' },
  { icon: <Share2 size={20} />,  title: 'Share with everyone', text: 'Publish it so other creators can play and remix your work.' },
]

/** One-time welcome shown to first-time visitors. Dismissed state is stored
 *  in localStorage so it never nags returning users. */
export function Onboarding() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
    } catch { /* private mode — just skip */ }
  }, [])

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to Barshi"
        >
          <motion.div
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="relative w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden shadow-2xl"
          >
            <button
              onClick={dismiss}
              aria-label="Close"
              className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)] transition-colors"
            >
              <X size={16} />
            </button>

            <div className="px-6 pt-8 pb-6 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/10 text-[var(--color-brand-light)] text-xs font-semibold mb-4 uppercase tracking-wider">
                <Sparkles size={10} className="fill-current" />
                Welcome
              </div>
              <h2 className="text-2xl font-black mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
                Build real things with AI
              </h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                No coding needed. Here&apos;s how it works:
              </p>
            </div>

            <div className="px-6 space-y-3">
              {STEPS.map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-3)]/60">
                  <div className="w-9 h-9 rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand-light)] flex items-center justify-center flex-shrink-0">
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text)]">{s.title}</p>
                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6">
              <Link
                href="/create"
                onClick={dismiss}
                className="w-full inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 cursor-pointer select-none active:scale-[0.98] bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)] h-12 text-base rounded-[var(--radius-lg)] glow-sm"
              >
                <Sparkles size={18} />
                Start creating
              </Link>
              <button
                onClick={dismiss}
                className="w-full mt-2 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] transition-colors h-8"
              >
                I&apos;ll look around first
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
