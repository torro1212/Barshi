import { motion } from 'framer-motion';
import { CONFIDENCE_LABELS } from '../algorithm';
import type { ScoredMatch } from '../types';
import { CONFIDENCE_STYLES, cn, formatHebrewDate } from '../ui';
import ScoreRing from './ScoreRing';

const LAYER_LABELS: { key: keyof ScoredMatch['layers']; label: string; weightLabel: string }[] = [
  { key: 'profile', label: 'פרופיל', weightLabel: '35%' },
  { key: 'h2h', label: 'H2H', weightLabel: '20%' },
  { key: 'form', label: 'פורמה', weightLabel: '25%' },
  { key: 'streaks', label: 'רצפים', weightLabel: '20%' },
];

export default function RecommendationCard({ scored, rank }: { scored: ScoredMatch; rank: number }) {
  const { match, layers, total, confidence, reasons } = scored;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">
            {match.homeTeam} <span className="text-slate-500">נגד</span> {match.awayTeam}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            {formatHebrewDate(match.date)} • {match.time}
            {match.note ? ` • ${match.note}` : ''}
          </div>
        </div>
        <ScoreRing total={total} />
      </div>

      <div className={cn('mt-3 inline-block rounded-full border px-3 py-1 text-xs font-bold', CONFIDENCE_STYLES[confidence])}>
        {CONFIDENCE_LABELS[confidence]}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {LAYER_LABELS.map(({ key, label }) => (
          <div key={key} className="rounded-lg bg-slate-800/60 p-2 text-center">
            <div className="text-[11px] text-slate-400">{label}</div>
            <div className="text-sm font-bold">{layers[key]}</div>
            <div className="mt-1 h-1 overflow-hidden rounded bg-slate-700">
              <div className="h-full bg-orange-500" style={{ width: `${layers[key]}%` }} />
            </div>
          </div>
        ))}
      </div>

      {reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-slate-300">
          {reasons.map((r) => (
            <li key={r} className="flex gap-2">
              <span className="text-orange-400">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
