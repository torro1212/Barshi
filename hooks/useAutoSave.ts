'use client'

import { useEffect, useRef } from 'react'

interface UseAutoSaveOptions {
  data: string
  projectId: string | null
  enabled: boolean
  /** Debounce delay in ms. Default: 30 seconds */
  delay?: number
  onSave: (projectId: string, html: string) => Promise<void>
}

/**
 * Debounced auto-save hook.
 * Saves after `delay` ms of inactivity.
 * Does NOT create a new project_version entry — just updates the current row.
 */
export function useAutoSave({
  data,
  projectId,
  enabled,
  delay = 30_000,
  onSave,
}: UseAutoSaveOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>('')
  const onSaveRef = useRef(onSave)

  // Keep the latest onSave without retriggering the debounce effect.
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  useEffect(() => {
    if (!enabled || !projectId || !data) return
    if (data === lastSavedRef.current) return // nothing changed

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      if (!projectId) return
      try {
        await onSaveRef.current(projectId, data)
        lastSavedRef.current = data
      } catch (err) {
        console.error('[AutoSave] Failed:', err)
      }
    }, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [data, projectId, enabled, delay])
}
