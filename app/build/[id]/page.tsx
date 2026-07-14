'use client'

import { useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BuilderLayout } from '@/components/builder/BuilderLayout'
import { useBuilderStore } from '@/stores/builderStore'
import { sanitizeHTML } from '@/lib/ai/sanitize'
import { readAIStream } from '@/lib/ai/stream'
import { track, EVENTS } from '@/lib/posthog'

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const shouldGenerate = searchParams.get('generate') === '1'

  const {
    setProjectId, setHTML, setMeta,
    setProcessing, setGenChars, buildPlan, html,
  } = useBuilderStore()

  // Load existing project data
  useEffect(() => {
    if (!id) return
    setProjectId(id)

    async function load() {
      const res = await fetch(`/api/projects/${id}`)
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) { router.push('/'); return }

      const data = await res.json()
      if (data.meta_json) setMeta(data.meta_json)
      if (data.html) setHTML(data.html)
    }

    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger generation if coming from create flow
  useEffect(() => {
    if (!shouldGenerate || !buildPlan || !id || html) return

    async function generate() {
      setProcessing(true, 'Warming up the AI…')
      setGenChars(0)
      track(EVENTS.GENERATION_STARTED, { type: buildPlan?.type })

      try {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: id, plan: buildPlan }),
        })

        if (res.status === 429) {
          const data = await res.json()
          alert(data.error)
          setProcessing(false)
          return
        }

        // Status messages advance both on a timer AND as real code arrives, so
        // the label reflects genuine progress rather than a fixed animation.
        const messages = [
          'Warming up the AI…', 'Designing the structure…', 'Writing the code…',
          'Adding interactions…', 'Setting up the rules…', 'Styling everything…',
          'Polishing the details…', 'Almost ready…',
        ]
        let msgIdx = 0
        const msgTimer = setInterval(() => {
          msgIdx = Math.min(msgIdx + 1, messages.length - 1)
          setProcessing(true, messages[msgIdx])
        }, 2500)

        let firstChunkSeen = false
        const fullHTML = await readAIStream(res, {
          onChunk: (_delta, soFar) => {
            setGenChars(soFar.length)
            if (!firstChunkSeen) {
              firstChunkSeen = true
              msgIdx = 2 // jump to "Writing the code…" once bytes flow
              setProcessing(true, messages[msgIdx])
            }
          },
        })

        clearInterval(msgTimer)
        setProcessing(true, 'Finishing up…')

        // Always re-fetch the project — the server is source of truth and
        // will have the sanitized + saved HTML even if stream parsing missed bytes.
        const updated = await fetch(`/api/projects/${id}`)
        if (updated.ok) {
          const updatedData = await updated.json()
          if (updatedData.meta_json) setMeta(updatedData.meta_json)
          if (updatedData.html) setHTML(updatedData.html)
          else if (fullHTML) setHTML(sanitizeHTML(fullHTML).html)
        } else if (fullHTML) {
          setHTML(sanitizeHTML(fullHTML).html)
        }
        track(EVENTS.GENERATION_COMPLETE, { type: buildPlan?.type })
      } catch (err) {
        console.error('[generate]', err)
        track(EVENTS.GENERATION_FAILED, { type: buildPlan?.type })
      } finally {
        setProcessing(false)
      }
    }

    generate()
  }, [shouldGenerate, buildPlan, id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Self-heal: if we have no HTML yet, the server may already hold a saved
  // bundle — e.g. a dropped generation stream, or a page refresh that wiped the
  // in-memory build plan. Poll briefly to recover it so the preview is never
  // stuck blank when the project actually exists.
  useEffect(() => {
    if (html || !id) return
    let cancelled = false
    let tries = 0
    const iv = setInterval(async () => {
      tries += 1
      if (cancelled || tries > 12) { clearInterval(iv); return }
      try {
        const res = await fetch(`/api/projects/${id}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.html) {
          if (data.meta_json) setMeta(data.meta_json)
          setHTML(data.html)
          clearInterval(iv)
        }
      } catch { /* keep trying */ }
    }, 2500)
    return () => { cancelled = true; clearInterval(iv) }
  }, [html, id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--color-surface)]">
      {/* Minimal builder header */}
      <header className="h-14 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center px-4 gap-3 flex-shrink-0">
        <Link href="/projects" className="p-1.5 hover:bg-[var(--color-surface-3)] rounded-[var(--radius-md)] transition-colors">
          <ArrowLeft size={16} className="text-[var(--color-text-muted)]" />
        </Link>
        <div className="flex-1">
          <span className="font-bold text-sm text-[var(--color-brand)]">barshi</span>
          <span className="text-[var(--color-text-dim)] text-xs ml-2">builder</span>
        </div>
      </header>

      <BuilderLayout />
    </div>
  )
}
