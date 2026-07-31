import { useState } from 'react';
import { fetchNextFixtures } from '../fixtures';
import { LEAGUES } from '../leagues';
import { predictAll } from '../model';
import type { LeagueId, MatchData, Prediction } from '../types';
import PredictionTable from './PredictionTable';

interface Props {
  league: LeagueId;
  apiKey: string;
  onLoadToAnalysis: (matches: MatchData[], date: string) => void;
}

export default function NextMatchday({ league, apiKey, onLoadToAnalysis }: Props) {
  const cfg = LEAGUES[league];
  const [preds, setPreds] = useState<Prediction[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!apiKey.trim()) {
      setError('נדרש מפתח API-Football (מוזן במסך הראשי) כדי לשלוף את המחזור הבא');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fixtures = await fetchNextFixtures(league, apiKey.trim(), 10);
      if (fixtures.length === 0) {
        setError('לא נמצאו משחקים קרובים — ייתכן שהעונה בהפסקה');
        setPreds(null);
      } else {
        setPreds(predictAll(fixtures));
      }
    } catch {
      setError('שליפת המשחקים נכשלה — בדוק את המפתח ואת מגבלת הבקשות היומית');
      setPreds(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-300">
              המחזור הבא — {cfg.flag} {cfg.nameShort}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              10 המשחקים הקרובים מלוח המשחקים האמיתי (API-Football)
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-lg bg-orange-500 px-4 py-2 font-bold text-slate-950 transition hover:bg-orange-400 disabled:opacity-50"
            >
              {loading ? 'שולף…' : 'שליפת המחזור הבא'}
            </button>
            {preds && preds.length > 0 && (
              <button
                type="button"
                onClick={() => onLoadToAnalysis(preds.map((p) => p.match), preds[0].match.date)}
                className="rounded-lg border border-orange-500/50 px-4 py-2 font-bold text-orange-400 transition hover:bg-orange-500/10"
              >
                טען לניתוח המלא
              </button>
            )}
          </div>
        </div>
        {error && (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            {error}
          </div>
        )}
      </div>

      {preds && <PredictionTable preds={preds} />}
    </div>
  );
}
