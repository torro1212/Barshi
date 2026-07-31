import { LEAGUES } from '../leagues';
import { BUNDLES, isHtDraw, pickHit, predictMatch } from '../model';
import type { LeagueId, MatchData } from '../types';
import { cn } from '../ui';

interface Props {
  league: LeagueId;
  history: MatchData[]; // this league's stored matches (may include results)
}

/**
 * Real accuracy, two layers:
 * 1. The measured out-of-sample precision from the walk-forward backtest
 *    (baked into the bundle — the honest expectation).
 * 2. The user's own accumulating record from results entered in the app.
 */
export default function AccuracyPanel({ league, history }: Props) {
  const bundle = BUNDLES[league];
  const cfg = LEAGUES[league];

  const withResults = history.filter((m) => isHtDraw(m.htResult) !== undefined);
  const recs = withResults
    .map((m) => predictMatch(m))
    .filter((p) => p.side !== 'none');
  const bySide = (side: 'draw' | 'no-draw') => {
    const g = recs.filter((p) => p.side === side);
    const hits = g.filter((p) => pickHit(p.side, p.match.htResult) === true);
    return { n: g.length, hits: hits.length, rate: g.length > 0 ? Math.round((hits.length / g.length) * 100) : null };
  };
  const noDraw = bySide('no-draw');
  const draw = bySide('draw');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-sm font-bold text-slate-300">
          דיוק מדוד מחוץ למדגם — {cfg.flag} {cfg.nameShort}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          מבדיקה עיוורת (walk-forward) על נתונים אמיתיים: {bundle.testedOn}. שיעור בסיס של תיקו
          במחצית בליגה: {Math.round(bundle.baseRate * 100)}%.
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
            <div className="text-sm text-sky-400">המלצת "אין תיקו במחצית"</div>
            <div className="mt-1 text-3xl font-black text-sky-400">{bundle.precision.noDraw}%</div>
            <div className="mt-1 text-xs text-slate-500">
              כאשר P(תיקו) ≤ {Math.round(bundle.thresholds.noDraw * 100)}%
            </div>
          </div>
          <div
            className={cn(
              'rounded-xl border p-4',
              bundle.drawRecommendable ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700 bg-slate-950/40',
            )}
          >
            <div className={bundle.drawRecommendable ? 'text-sm text-emerald-400' : 'text-sm text-slate-400'}>
              המלצת "תיקו במחצית"
            </div>
            <div className={cn('mt-1 text-3xl font-black', bundle.drawRecommendable ? 'text-emerald-400' : 'text-slate-500')}>
              {bundle.precision.draw}%
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {bundle.drawRecommendable
                ? `כאשר P(תיקו) ≥ ${Math.round(bundle.thresholds.draw * 100)}%`
                : 'מתחת לרף אמינות — הכלי לא ממליץ על צד זה בליגה הזו'}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-sm font-bold text-slate-300">הרשומה האישית שלך (מתוצאות שהזנת)</div>
        {recs.length === 0 ? (
          <div className="mt-2 text-sm text-slate-500">
            עדיין אין תוצאות — הזן תוצאות מחצית במסך התוצאות והדיוק יצטבר כאן
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-950/40 p-4">
              <div className="text-sm text-sky-400">אין תיקו במחצית</div>
              <div className="mt-1 text-2xl font-black">
                {noDraw.rate !== null ? `${noDraw.rate}%` : '—'}
              </div>
              <div className="text-xs text-slate-500">{noDraw.hits}/{noDraw.n} פגיעות</div>
            </div>
            <div className="rounded-xl bg-slate-950/40 p-4">
              <div className="text-sm text-emerald-400">תיקו במחצית</div>
              <div className="mt-1 text-2xl font-black">
                {draw.rate !== null ? `${draw.rate}%` : '—'}
              </div>
              <div className="text-xs text-slate-500">{draw.hits}/{draw.n} פגיעות</div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs leading-relaxed text-slate-500">
        שקיפות מלאה: המודל אומן על {bundle.matches.toLocaleString()} משחקים אמיתיים ונבדק בבדיקה
        עיוורת שבה כל תחזית משתמשת רק בנתונים שקדמו למשחק. ניבוי "תיקו במחצית" הוא אירוע
        עתיר-רעש — היתרון האמיתי והיציב נמצא בצד "אין תיקו במחצית". זהו כלי ניתוח סטטיסטי,
        לא ייעוץ הימורים.
      </div>
    </div>
  );
}
