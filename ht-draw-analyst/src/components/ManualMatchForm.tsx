import { useState } from 'react';
import { displayTeam } from '../leagues';
import { BUNDLES } from '../model';
import type { LeagueId, MatchData } from '../types';

interface Props {
  league: LeagueId;
  date: string;
  onAdd: (match: MatchData) => void;
}

/**
 * Manual match entry: pick two real teams — all statistics come from the
 * bundled real historical data, nothing is entered by hand.
 */
export default function ManualMatchForm({ league, date, onAdd }: Props) {
  const bundle = BUNDLES[league];
  const teams = Object.keys(bundle.teams).sort((a, b) =>
    displayTeam(league, a).localeCompare(displayTeam(league, b), 'he'),
  );
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [time, setTime] = useState('20:00');

  const valid = homeTeam && awayTeam && homeTeam !== awayTeam;

  const submit = () => {
    if (!valid) return;
    onAdd({
      id: `${league}-${date}-manual-${Date.now()}`,
      league,
      date,
      time,
      homeTeam,
      awayTeam,
    });
    setHomeTeam('');
    setAwayTeam('');
  };

  const select = (value: string, onChange: (v: string) => void, label: string) => (
    <label className="block min-w-44 flex-1">
      <span className="mb-1 block text-sm text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
      >
        <option value="">בחר קבוצה…</option>
        {teams.map((t) => (
          <option key={t} value={t}>
            {displayTeam(league, t)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-sm font-bold text-slate-300">הוספת משחק ידנית</div>
      <div className="text-xs text-slate-500">
        בוחרים שתי קבוצות — כל הסטטיסטיקות מגיעות מהנתונים ההיסטוריים האמיתיים
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {select(homeTeam, setHomeTeam, 'קבוצה מארחת')}
        {select(awayTeam, setAwayTeam, 'קבוצה אורחת')}
        <label className="block">
          <span className="mb-1 block text-sm text-slate-400">שעה</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className="rounded-lg bg-orange-500 px-4 py-2 font-bold text-slate-950 transition hover:bg-orange-400 disabled:opacity-40"
        >
          הוספה
        </button>
      </div>
    </div>
  );
}
