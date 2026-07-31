import { useMemo } from 'react';
import { TOP_PICK_SCORE, scoreMatch } from '../algorithm';
import { generateNextRound } from '../demo-data';
import { LEAGUES } from '../leagues';
import type { LeagueId, MatchData, Weights } from '../types';
import { cn, formatHebrewDate, scoreColor } from '../ui';

interface Props {
  league: LeagueId;
  weights: Weights;
  onLoadToAnalysis: (matches: MatchData[], date: string) => void;
}

export default function NextMatchday({ league, weights, onLoadToAnalysis }: Props) {
  const cfg = LEAGUES[league];
  const round = useMemo(() => generateNextRound(league), [league]);
  const allMatches = round.flatMap((d) => d.matches);
  const scoredById = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of allMatches) map.set(m.id, scoreMatch(m, weights).total);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, weights]);

  const topPicks = allMatches
    .map((m) => ({ m, total: scoredById.get(m.id) ?? 0 }))
    .filter((x) => x.total >= TOP_PICK_SCORE)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-300">
              המחזור הבא — {cfg.flag} {cfg.nameShort}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {cfg.matchesPerRound} משחקים • {cfg.roundDayNames.join('–')} (
              {cfg.roundDaySplit.join('+')})
            </div>
          </div>
          <button
            type="button"
            onClick={() => onLoadToAnalysis(allMatches, round[0].date)}
            className="rounded-lg bg-orange-500 px-4 py-2 font-bold text-slate-950 transition hover:bg-orange-400"
          >
            טען לניתוח המלא
          </button>
        </div>
      </div>

      {topPicks.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4">
          <div className="text-sm font-bold text-emerald-400">TOP PICKS (ציון ≥ {TOP_PICK_SCORE})</div>
          <div className="mt-2 space-y-1">
            {topPicks.map(({ m, total }) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span>
                  {m.homeTeam} — {m.awayTeam}
                  <span className="ms-2 text-xs text-slate-500">{formatHebrewDate(m.date)} • {m.time}</span>
                </span>
                <b className={scoreColor(total)}>{total}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {round.map((day) => (
        <div key={day.date} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-sm font-bold text-slate-300">
            יום {day.dayName} • {formatHebrewDate(day.date)}
          </div>
          <div className="mt-2 divide-y divide-slate-800">
            {day.matches.map((m) => {
              const total = scoredById.get(m.id) ?? 0;
              return (
                <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-semibold">
                      {m.homeTeam} — {m.awayTeam}
                    </span>
                    <span className="ms-2 text-xs text-slate-500">
                      {m.time}
                      {m.note ? ` • ${m.note}` : ''}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-sm font-bold',
                      total >= TOP_PICK_SCORE && 'bg-emerald-500/15',
                      scoreColor(total),
                    )}
                  >
                    {total}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
