import { CONFIDENCE_LABELS } from '../algorithm';
import type { ScoredMatch } from '../types';
import { CONFIDENCE_STYLES, cn, scoreColor } from '../ui';

interface Props {
  scored: ScoredMatch[];
  onDelete?: (id: string) => void;
}

export default function MatchTable({ scored, onDelete }: Props) {
  if (scored.length === 0) {
    return <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">אין משחקים טעונים</div>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-900 text-slate-400">
          <tr>
            <th className="p-3 text-right font-medium">משחק</th>
            <th className="p-3 text-center font-medium">פרופיל</th>
            <th className="p-3 text-center font-medium">H2H</th>
            <th className="p-3 text-center font-medium">פורמה</th>
            <th className="p-3 text-center font-medium">רצפים</th>
            <th className="p-3 text-center font-medium">ציון</th>
            <th className="p-3 text-center font-medium">המלצה</th>
            {onDelete && <th className="p-3" />}
          </tr>
        </thead>
        <tbody>
          {scored.map((s) => (
            <tr key={s.match.id} className="border-t border-slate-800 bg-slate-950/50 hover:bg-slate-900/70">
              <td className="p-3">
                <div className="font-semibold">
                  {s.match.homeTeam} — {s.match.awayTeam}
                </div>
                <div className="text-xs text-slate-500">
                  {s.match.time}
                  {s.match.note ? ` • ${s.match.note}` : ''}
                </div>
              </td>
              <td className="p-3 text-center text-slate-300">{s.layers.profile}</td>
              <td className="p-3 text-center text-slate-300">{s.layers.h2h}</td>
              <td className="p-3 text-center text-slate-300">{s.layers.form}</td>
              <td className="p-3 text-center text-slate-300">{s.layers.streaks}</td>
              <td className={cn('p-3 text-center text-base font-bold', scoreColor(s.total))}>{s.total}</td>
              <td className="p-3 text-center">
                <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs', CONFIDENCE_STYLES[s.confidence])}>
                  {CONFIDENCE_LABELS[s.confidence]}
                </span>
              </td>
              {onDelete && (
                <td className="p-3 text-center">
                  <button
                    type="button"
                    onClick={() => onDelete(s.match.id)}
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
