'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldAlert, ExternalLink, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, TypeBadge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { timeAgo, formatCount } from '@/lib/utils'
import type { ProjectType, ReportReason } from '@/types'

interface ReportRow {
  id: string
  project_id: string
  reason: ReportReason
  status: string
  created_at: string
  project: {
    id: string
    title: string
    type: ProjectType
    visibility: string
    creator_id: string
    like_count: number
    play_count: number
  } | null
}

const REASON_LABELS: Record<ReportReason, string> = {
  bullying: 'Bullying', inappropriate: 'Inappropriate', personal_info: 'Personal info',
  unsafe: 'Unsafe', spam: 'Spam', other: 'Other',
}

export function ModerationDashboard() {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/moderation/reports')
      const data = await res.json()
      setReports(data.reports ?? [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function act(report: ReportRow, decision: 'remove' | 'dismiss') {
    setBusy(report.id)
    try {
      await fetch('/api/moderation/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id, projectId: report.project_id, decision }),
      })
      setReports((prev) => prev.filter((r) => r.id !== report.id))
    } catch { /* ignore */ } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ShieldAlert size={20} className="text-orange-400" />
        <h1 className="text-xl font-black" style={{ fontFamily: 'var(--font-display)' }}>Moderation</h1>
        {!loading && <Badge variant={reports.length ? 'warning' : 'success'}>{reports.length} pending</Badge>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-4xl">✅</p>
          <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>All clear</p>
          <p className="text-sm text-[var(--color-text-muted)]">No pending reports right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="glass rounded-[var(--radius-lg)] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.project && <TypeBadge type={r.project.type} showEmoji />}
                    <Badge variant="danger">{REASON_LABELS[r.reason]}</Badge>
                    {r.project?.visibility === 'removed' && <Badge>removed</Badge>}
                  </div>
                  <p className="font-bold text-sm truncate">
                    {r.project?.title ?? '(deleted project)'}
                  </p>
                  <p className="text-xs text-[var(--color-text-dim)]">
                    Reported {timeAgo(r.created_at)} ago
                    {r.project && ` · ${formatCount(r.project.play_count)} plays · ${formatCount(r.project.like_count)} likes`}
                  </p>
                </div>
                {r.project && (
                  <Link
                    href={`/p/${r.project_id}`}
                    target="_blank"
                    className="flex-shrink-0 text-xs text-[var(--color-brand-light)] hover:underline inline-flex items-center gap-1"
                  >
                    View <ExternalLink size={11} />
                  </Link>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm" variant="secondary" className="flex-1 gap-1.5"
                  disabled={busy === r.id}
                  onClick={() => act(r, 'dismiss')}
                >
                  <Check size={14} /> Looks fine
                </Button>
                <Button
                  size="sm" variant="danger" className="flex-1 gap-1.5"
                  loading={busy === r.id}
                  onClick={() => act(r, 'remove')}
                >
                  <Trash2 size={14} /> Take down
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
