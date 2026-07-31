import { displayTeam } from '../leagues';
import { isHtDraw, pickHit } from '../model';
import type { Prediction } from '../types';
import { SIDE_LABELS, SIDE_STYLES, cn } from '../ui';

interface Props {
  preds: Prediction[];
  onResultChange: (matchId: string, result: string) => void;
}

export default function EvaluationPanel({ preds, onResultChange }: Props) {
  const recommended = preds.filter((p) => p.side !== 'none');
  const withResults = recommended.filter((p) => isHtDraw(p.match.htResult) !== undefined);
  const hits = withResults.filter((p) => pickHit(p.side, p.match.htResult) === true);
  const hitRate = withResults.length > 0 ? Math.round((hits.length / withResults.length) * 100) : null;

  if (preds.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
        טען משחקים כדי להזין תוצאות מחצית
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-sm font-bold text-slate-300">הזנת תוצאות מחצית (פורמט: 0-0, 1-1, 2-1…)</div>
        <div className="mt-3 space-y-2">
          {preds.map((pr) => {
            const hit = pickHit(pr.side, pr.match.htResult);
            return (
              <div
                key={pr.match.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-xl border p-3',
                  pr.side !== 'none' ? 'border-orange-500/40 bg-orange-500/5' : 'border-slate-800 bg-slate-950/50',
                )}
              >
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">
                    {displayTeam(pr.match.league, pr.match.homeTeam)} — {displayTeam(pr.match.league, pr.match.awayTeam)}
                  </span>
                  <span className={cn('ms-2 rounded-full border px-2 py-0.5 text-xs', SIDE_STYLES[pr.side])}>
                    {SIDE_LABELS[pr.side]} {pr.side !== 'none' && `(${Math.round(pr.p * 100)}%)`}
                  </span>
                </div>
                <input
                  dir="ltr"
                  placeholder="0-0"
                  value={pr.match.htResult ?? ''}
                  onChange={(e) => onResultChange(pr.match.id, e.target.value)}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-center"
                />
                {hit !== undefined && (
                  <span className={cn('text-lg', hit ? 'text-emerald-400' : 'text-red-400')}>
                    {hit ? '✓ פגיעה' : '✗ החטאה'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {hitRate !== null && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-sm font-bold text-slate-300">אחוז פגיעה בהמלצות היום</div>
          <div className="mt-2 flex items-center gap-4">
            <div className={cn('text-4xl font-black', hitRate >= 60 ? 'text-emerald-400' : 'text-amber-400')}>
              {hitRate}%
            </div>
            <div className="text-sm text-slate-400">
              {hits.length} פגיעות מתוך {withResults.length} המלצות שהוזנה להן תוצאה
            </div>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className={cn('h-full transition-all', hitRate >= 60 ? 'bg-emerald-500' : 'bg-amber-500')}
              style={{ width: `${hitRate}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
