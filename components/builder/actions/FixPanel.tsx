'use client'

import { useState } from 'react'
import { Wrench, AlertCircle, AlertTriangle, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBuilderStore } from '@/stores/builderStore'
import type { FixIssue } from '@/types'

const SEVERITY_ICONS = {
  critical: <AlertCircle size={14} className="text-[var(--color-danger)]" />,
  warning:  <AlertTriangle size={14} className="text-[var(--color-warning)]" />,
  suggestion: <Lightbulb size={14} className="text-[var(--color-brand)]" />,
}

interface FixPanelProps {
  onAnalyze: () => Promise<FixIssue[]>
  onApplyFix: (html: string) => void
}

export function FixPanel({ onAnalyze, onApplyFix }: FixPanelProps) {
  const { isProcessing } = useBuilderStore()
  const [issues, setIssues] = useState<FixIssue[] | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  async function handleAnalyze() {
    setAnalyzing(true)
    try {
      const found = await onAnalyze()
      setIssues(found)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm mb-1">Check & Fix 🔧</h3>
        <p className="text-xs text-[var(--color-text-muted)]">AI checks your project and fixes anything broken</p>
      </div>

      {issues === null ? (
        <Button
          size="md"
          variant="secondary"
          className="w-full gap-2"
          onClick={handleAnalyze}
          loading={analyzing}
        >
          <Wrench size={15} />
          Check my project
        </Button>
      ) : issues.length === 0 ? (
        <div className="text-center py-6 space-y-2">
          <p className="text-2xl">✅</p>
          <p className="text-sm font-medium text-[var(--color-success)]">Everything looks great!</p>
          <p className="text-xs text-[var(--color-text-muted)]">No problems found.</p>
          <Button size="sm" variant="ghost" onClick={() => setIssues(null)}>Check again</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-3)] border border-[var(--color-border)] space-y-2"
            >
              <div className="flex items-start gap-2">
                {SEVERITY_ICONS[issue.severity]}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--color-text)]">{issue.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{issue.description}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                disabled={isProcessing}
                onClick={() => onApplyFix(issue.fix)}
              >
                Fix this
              </Button>
            </div>
          ))}
          <Button size="sm" variant="ghost" className="w-full" onClick={() => setIssues(null)}>
            Check again
          </Button>
        </div>
      )}
    </div>
  )
}
