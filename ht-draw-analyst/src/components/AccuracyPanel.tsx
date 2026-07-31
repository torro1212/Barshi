import { LEAGUES } from '../leagues';
import { BUNDLES, isHtDraw, pickHit, predictMatch } from '../model';
import type { LeagueId, MatchData } from '../types';
import { cn } from '../ui';

interface Props {
  league: LeagueId;
  history: MatchData[]; // this league's stored matches (may include results)
}

/**
 * Real accuracy, two layers: the measured out-of-sample precision from the
 * walk-forward backtest (the honest expectation), and the user's own
 * accumulating record from results entered in the app.
 */
export default function AccuracyPanel({ league, history }: Props) {
  const bundle = BUNDLES[league];
  const cfg = LEAGUES[league];
  const basePct = Math.round(bundle.baseRate * 100);
  const reliable = bundle.precision.draw >= 50;

  const withResults = history.filter((m) => isHtDraw(m.htResult) !== undefined);
  const recs = withResults.map((m) => predictMatch(m)).filter((p) => p.side === 'draw');
  const hits = recs.filter((p) => pickHit(p.side, p.match.htResult) === true);
  const rate = recs.length > 0 ? Math.round((hits.length / recs.length) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-sm font-bold text-slate-300">
          המלצות "תיקו במחצית" — {cfg.flag} {cfg.nameShort}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          נבדק בבדיקה עיוורת (walk-forward) על נתונים אמיתיים: {bundle.testedOn}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div
            className={cn(
              'rounded-xl border p-4',
              reliable ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5',
            )}
          >
            <div className={reliable ? 'text-sm text-emerald-400' : 'text-sm text-amber-400'}>
              דיוק מדוד מחוץ למדגם
            </div>
            <div className={cn('mt-1 text-3xl font-black', reliable ? 'text-emerald-400' : 'text-amber-400')}>
              {bundle.precision.draw}%
            </div>
            <div className="mt-1 text-xs text-slate-500">
              כאשר P(תיקו) ≥ {Math.round(bundle.thresholds.draw * 100)}% • שיעור הבסיס בליגה: {basePct}%
            </div>
          </div>
          <div className="rounded-xl bg-slate-950/40 p-4">
            <div className="text-sm text-slate-300">הרשומה האישית שלך</div>
            <div className="mt-1 text-3xl font-black">{rate !== null ? `${rate}%` : '—'}</div>
            <div className="mt-1 text-xs text-slate-500">
              {recs.length > 0
                ? `${hits.length}/${recs.length} פגיעות בהמלצות שהוזנה להן תוצאה`
                : 'הזן תוצאות מחצית במסך התוצאות והדיוק יצטבר כאן'}
            </div>
          </div>
        </div>
        {!reliable && (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            שקיפות: בליגה זו הדיוק המדוד ({bundle.precision.draw}%) קרוב לשיעור הבסיס ({basePct}%) —
            היתרון הסטטיסטי עדיין לא מוכח, בין היתר כי יש רק {bundle.testedOn.includes('עונת') ? 'עונת מבחן אחת' : 'מעט נתונים'}.
            התייחס להמלצות כאן בזהירות יתרה.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs leading-relaxed text-slate-500">
        שקיפות מלאה: המודל אומן על {bundle.matches.toLocaleString()} משחקים אמיתיים, וכל תחזית
        בבדיקה השתמשה רק בנתונים שקדמו למשחק. הכלי ממליץ אך ורק על משחקים שהוא צופה
        שיסתיימו בתיקו במחצית — מעט המלצות, ממוינות לפי סיכוי. זהו כלי ניתוח סטטיסטי, לא
        ייעוץ הימורים.
      </div>
    </div>
  );
}
