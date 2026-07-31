import { displayTeam } from '../leagues';
import type { Prediction } from '../types';
import { SIDE_LABELS, SIDE_STYLES, cn, sideColor } from '../ui';

interface Props {
  preds: Prediction[];
  onDelete?: (id: string) => void;
}

export default function PredictionTable({ preds, onDelete }: Props) {
  if (preds.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
        אין משחקים טעונים
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-slate-900 text-slate-400">
          <tr>
            <th className="p-3 text-right font-medium">משחק</th>
            <th className="p-3 text-center font-medium">סיכוי לתיקו</th>
            <th className="p-3 text-center font-medium">המלצה</th>
            <th className="p-3 text-center font-medium">דיוק מדוד</th>
            {onDelete && <th className="p-3" />}
          </tr>
        </thead>
        <tbody>
          {preds.map((pr) => (
            <tr key={pr.match.id} className="border-t border-slate-800 bg-slate-950/50 hover:bg-slate-900/70">
              <td className="p-3">
                <div className="font-semibold">
                  {displayTeam(pr.match.league, pr.match.homeTeam)} — {displayTeam(pr.match.league, pr.match.awayTeam)}
                </div>
                <div className="text-xs text-slate-500">
                  {pr.match.date} • {pr.match.time}
                  {pr.missingTeam ? ' • אין נתונים' : ''}
                </div>
              </td>
              <td className={cn('p-3 text-center text-base font-bold', sideColor(pr.side))}>
                {pr.missingTeam ? '—' : `${Math.round(pr.p * 100)}%`}
              </td>
              <td className="p-3 text-center">
                <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs', SIDE_STYLES[pr.side])}>
                  {SIDE_LABELS[pr.side]}
                </span>
              </td>
              <td className="p-3 text-center text-slate-300">
                {pr.precisionPct !== null ? `${pr.precisionPct}%` : '—'}
              </td>
              {onDelete && (
                <td className="p-3 text-center">
                  <button
                    type="button"
                    onClick={() => onDelete(pr.match.id)}
                    className="text-xs text-slate-500 hover:text-red-400"
                  >
                    מחיקה
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
