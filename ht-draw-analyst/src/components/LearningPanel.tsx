import { useState } from 'react';
import { LEAGUES } from '../leagues';
import { runLearning } from '../learning';
import type { LeagueId, LearningResult, MatchData, Weights } from '../types';
import { cn } from '../ui';

interface Props {
  league: LeagueId;
  history: MatchData[]; // real matches with results for this league
  currentWeights: Weights;
  hasLearned: boolean;
  onApplyWeights: (weights: Weights) => void;
  onResetWeights: () => void;
}

const WEIGHT_LABELS: { key: keyof Weights; label: string }[] = [
  { key: 'profile', label: 'פרופיל' },
  { key: 'h2h', label: 'H2H' },
  { key: 'form', label: 'פורמה' },
  { key: 'streaks', label: 'רצפים' },
];

export default function LearningPanel(props: Props) {
  const [result, setResult] = useState<LearningResult | null>(null);
  const [running, setRunning] = useState(false);
  const cfg = LEAGUES[props.league];

  const run = () => {
    setRunning(true);
    // let the button re-render before the grid search blocks the main thread
    setTimeout(() => {
      setResult(runLearning(props.league, props.history, props.currentWeights));
      setRunning(false);
    }, 30);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-300">
              מנוע למידה — {cfg.flag} {cfg.nameShort}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              משקולות נשמרות בנפרד לכל ליגה ({cfg.weightsStorageKey})
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={run}
              disabled={running}
              className="rounded-lg bg-orange-500 px-4 py-2 font-bold text-slate-950 transition hover:bg-orange-400 disabled:opacity-50"
            >
              {running ? 'מריץ Grid Search…' : 'הרצת ניתוח למידה (30 יום)'}
            </button>
            {props.hasLearned && (
              <button
                type="button"
                onClick={props.onResetWeights}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
              >
                איפוס לברירת מחדל
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {WEIGHT_LABELS.map(({ key, label }) => (
            <div key={key} className="rounded-lg bg-slate-800/60 p-2 text-center">
              <div className="text-[11px] text-slate-400">{label}</div>
              <div className="text-sm font-bold">{Math.round(props.currentWeights[key] * 100)}%</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {props.hasLearned ? 'משקולות פעילות: נלמדו מהנתונים' : 'משקולות פעילות: ברירת מחדל'}
        </div>
      </div>

      {result && (
        <>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-sm font-bold text-slate-300">משקולות אופטימליות</div>
            {result.usedDemoData && (
              <div className="mt-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
                אין מספיק היסטוריה אמיתית ({props.history.length} משחקים עם תוצאה) — הניתוח רץ על
                מערך דמו של 60 יום ({result.sampleSize} משחקים)
              </div>
            )}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {WEIGHT_LABELS.map(({ key, label }) => (
                <div key={key} className="rounded-lg bg-slate-800/60 p-2 text-center">
                  <div className="text-[11px] text-slate-400">{label}</div>
                  <div className="text-sm font-bold text-orange-400">
                    {Math.round(result.bestWeights[key] * 100)}%
                  </div>
                  <div className="text-[10px] text-slate-500">
                    כרגע {Math.round(result.currentWeights[key] * 100)}%
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-300">
              <span>סף מומלץ: <b className="text-orange-400">{result.bestThreshold}</b></span>
              <span>F1: <b>{result.f1}</b></span>
              <span>דיוק (Precision): <b>{result.precision}%</b></span>
              <span>כיסוי (Recall): <b>{result.recall}%</b></span>
            </div>
            <button
              type="button"
              onClick={() => props.onApplyWeights(result.bestWeights)}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white transition hover:bg-emerald-500"
            >
              שמירת המשקולות לליגה זו
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-sm font-bold text-slate-300">תבניות שזוהו</div>
            <div className="mt-3 space-y-2">
              {result.patterns.map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <div className="w-64 shrink-0 text-sm text-slate-300">{p.name}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full bg-orange-500" style={{ width: `${p.hitRate}%` }} />
                  </div>
                  <div className="w-24 shrink-0 text-xs text-slate-400">
                    {p.hitRate}% ({p.hits}/{p.matches})
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-sm font-bold text-slate-300">פירוט יומי (30 ימים אחרונים)</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.daily.map((d) => {
                const rate = d.recommended > 0 ? d.hits / d.recommended : null;
                return (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.hits}/${d.recommended} פגיעות`}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded text-[10px] font-bold',
                      rate === null && 'bg-slate-800 text-slate-600',
                      rate !== null && rate >= 0.5 && 'bg-emerald-500/30 text-emerald-300',
                      rate !== null && rate > 0 && rate < 0.5 && 'bg-amber-500/30 text-amber-300',
                      rate === 0 && 'bg-red-500/20 text-red-300',
                    )}
                  >
                    {d.recommended > 0 ? `${d.hits}/${d.recommended}` : '—'}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
