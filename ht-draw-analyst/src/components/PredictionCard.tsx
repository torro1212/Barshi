import { motion } from 'framer-motion';
import { displayTeam } from '../leagues';
import type { Prediction } from '../types';
import { SIDE_LABELS, SIDE_STYLES, cn, formatHebrewDate, sideColor } from '../ui';

export default function PredictionCard({ pred, rank }: { pred: Prediction; rank: number }) {
  const { match, p, side, precisionPct, reasons, missingTeam } = pred;
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
            {displayTeam(match.league, match.homeTeam)}{' '}
            <span className="text-slate-500">נגד</span>{' '}
            {displayTeam(match.league, match.awayTeam)}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            {formatHebrewDate(match.date)} • {match.time}
          </div>
        </div>
        <div className="text-center">
          <div className={cn('text-2xl font-black', sideColor(side))}>{Math.round(p * 100)}%</div>
          <div className="text-[10px] text-slate-500">סיכוי לתיקו</div>
        </div>
      </div>

      {missingTeam ? (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          אין מספיק נתונים היסטוריים על {displayTeam(match.league, missingTeam)} — לא ניתן לחזות
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={cn('inline-block rounded-full border px-3 py-1 text-sm font-bold', SIDE_STYLES[side])}>
              {SIDE_LABELS[side]}
            </span>
            {precisionPct !== null && (
              <span className="text-xs text-slate-400">
                דיוק מדוד מחוץ למדגם: <b className={sideColor(side)}>{precisionPct}%</b>
              </span>
            )}
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
        </>
      )}
    </motion.div>
  );
}
