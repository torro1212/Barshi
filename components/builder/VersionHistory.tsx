'use client'

import { useCallback, useEffect, useState } from 'react'
import { History, RotateCcw, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { timeAgo } from '@/lib/utils'

interface VersionMeta {
  version_num: number
  created_at: string
}

interface VersionHistoryProps {
  projectId: string | null
  open: boolean
  onClose: () => void
  onRestore: (html: string) => void
}

export function VersionHistory({ projectId, open, onClose, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<VersionMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/versions`)
      const data = await res.json()
      setVersions(data.versions ?? [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  async function restore(versionNum: number) {
    if (!projectId || restoring !== null) return
    setRestoring(versionNum)
    try {
      const res = await fetch(`/api/projects/${projectId}/versions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_num: versionNum }),
      })
      const data = await res.json()
      if (data.html) {
        onRestore(data.html)
        onClose()
      }
    } catch { /* ignore */ } finally {
      setRestoring(null)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[var(--color-brand-light)]" />
                <h2 className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)' }}>Version history</h2>
              </div>
              <button onClick={onClose} className="h-8 w-8 rounded-[var(--radius-md)] flex items-center justify-center hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
                <X size={16} />
              </button>
            </div>

            <div className="p-2 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : versions.length === 0 ? (
                <div className="text-center py-10 px-4 space-y-2">
                  <p className="text-2xl">🕐</p>
                  <p className="text-sm text-[var(--color-text-muted)]">No saved versions yet</p>
                  <p className="text-xs text-[var(--color-text-dim)]">Every change you make gets saved here so you can go back.</p>
                </div>
              ) : (
                versions.map((v, i) => (
                  <div
                    key={v.version_num}
                    className="flex items-center justify-between gap-3 px-3 py-3 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-3)] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        {i === 0 ? 'Latest saved' : `Version ${v.version_num}`}
                      </p>
                      <p className="text-xs text-[var(--color-text-dim)]">{timeAgo(v.created_at)} ago</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5 flex-shrink-0"
                      loading={restoring === v.version_num}
                      disabled={restoring !== null}
                      onClick={() => restore(v.version_num)}
                    >
                      <RotateCcw size={13} />
                      Restore
                    </Button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
