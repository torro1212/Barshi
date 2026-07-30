import { isHtDraw } from '../algorithm';
import type { ScoredMatch } from '../types';
import { cn } from '../ui';

interface Props {
  scored: ScoredMatch[];
  recommendedIds: Set<string>;
  onResultChange: (matchId: string, result: string) => void;
}

export default function EvaluationPanel({ scored, recommendedIds, onResultChange }: Props) {
  const withResults = scored.filter((s) => isHtDraw(s.match.htResult) !== undefined);
  const recWithResults = withResults.filter((s) => recommendedIds.has(s.match.id));
  const recHits = recWithResults.filter((s) => isHtDraw(s.match.htResult) === true);
  const hitRate =
    recWithResults.length > 0 ? Math.round((recHits.length / recWithResults.length) * 100) : null;
  const totalDraws = withResults.filter((s) => isHtDraw(s.match.htResult) === true).length;

  if (scored.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
        טען משחקים במסך ההזנה כדי להזין תוצאות מחצית
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-sm font-bold text-slate-300">הזנת תוצאות מחצית (פורמט: 0-0, 1-1, 2-1…)</div>
        <div className="mt-3 space-y-2">
          {scored.map((s) => {
            const draw = isHtDraw(s.match.htResult);
            const recommended = recommendedIds.has(s.match.id);
            return (
              <div
                key={s.match.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-xl border p-3',
                  recommended ? 'border-orange-500/40 bg-orange-500/5' : 'border-slate-800 bg-slate-950/50',
                )}
              >
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">
                    {s.match.homeTeam} — {s.match.awayTeam}
                  </span>
                  <span className="ms-2 text-xs text-slate-500">ציון {s.total}</span>
                  {recommended && (
                    <span className="ms-2 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-400">הומלץ</span>
                  )}
                </div>
                <input
                  dir="ltr"
                  placeholder="0-0"
                  value={s.match.htResult ?? ''}
                  onChange={(e) => onResultChange(s.match.id, e.target.value)}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-center"
                />
                {draw !== undefined && (
                  <span className={cn('text-lg', draw ? 'text-emerald-400' : 'text-red-400')}>
                    {draw ? '✓ תיקו' : '✗'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {hitRate !== null && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-sm font-bold text-slate-300">אחוז פגיעה בהמלצות</div>
          <div className="mt-2 flex items-center gap-4">
            <div className={cn('text-4xl font-black', hitRate >= 50 ? 'text-emerald-400' : 'text-amber-400')}>
              {hitRate}%
            </div>
            <div className="text-sm text-slate-400">
              {recHits.length} פגיעות מתוך {recWithResults.length} המלצות שהוזנה להן תוצאה
              <br />
              סה"כ תיקו במחצית ביום זה: {totalDraws}/{withResults.length}
            </div>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className={cn('h-full transition-all', hitRate >= 50 ? 'bg-emerald-500' : 'bg-amber-500')}
              style={{ width: `${hitRate}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
