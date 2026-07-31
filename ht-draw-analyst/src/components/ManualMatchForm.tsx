import { useState } from 'react';
import { LEAGUES } from '../leagues';
import type { LeagueId, MatchData } from '../types';

interface Props {
  league: LeagueId;
  date: string;
  onAdd: (match: MatchData) => void;
}

interface NumField {
  key: keyof Pick<
    MatchData,
    | 'homeHtDrawPct'
    | 'awayHtDrawPct'
    | 'h2hMatchesCount'
    | 'h2hHtDraws'
    | 'homeRecentHtDraws'
    | 'awayRecentHtDraws'
    | 'homeGamesSinceHtDraw'
    | 'awayGamesSinceHtDraw'
    | 'homeTablePosition'
    | 'awayTablePosition'
  >;
  label: string;
  min: number;
  max: number;
  layer: string;
}

export default function ManualMatchForm({ league, date, onAdd }: Props) {
  const cfg = LEAGUES[league];
  const maxPos = cfg.maxTablePosition;

  const fields: NumField[] = [
    { key: 'homeHtDrawPct', label: '% תיקו HT בית (מארחת)', min: 0, max: 100, layer: 'שכבה 1 — פרופיל' },
    { key: 'awayHtDrawPct', label: '% תיקו HT חוץ (אורחת)', min: 0, max: 100, layer: 'שכבה 1 — פרופיל' },
    { key: 'h2hMatchesCount', label: 'מספר משחקי H2H', min: 0, max: 20, layer: 'שכבה 2 — H2H' },
    { key: 'h2hHtDraws', label: 'מתוכם תיקו במחצית', min: 0, max: 20, layer: 'שכבה 2 — H2H' },
    { key: 'homeRecentHtDraws', label: 'תיקו HT ב-6 האחרונים (מארחת)', min: 0, max: 6, layer: 'שכבה 3 — פורמה' },
    { key: 'awayRecentHtDraws', label: 'תיקו HT ב-6 האחרונים (אורחת)', min: 0, max: 6, layer: 'שכבה 3 — פורמה' },
    { key: 'homeGamesSinceHtDraw', label: 'משחקים מאז תיקו HT (מארחת)', min: 0, max: 40, layer: 'שכבה 4 — רצפים' },
    { key: 'awayGamesSinceHtDraw', label: 'משחקים מאז תיקו HT (אורחת)', min: 0, max: 40, layer: 'שכבה 4 — רצפים' },
    { key: 'homeTablePosition', label: `מיקום בטבלה (מארחת) 1–${maxPos}`, min: 1, max: maxPos, layer: 'שכבה 4 — רצפים' },
    { key: 'awayTablePosition', label: `מיקום בטבלה (אורחת) 1–${maxPos}`, min: 1, max: maxPos, layer: 'שכבה 4 — רצפים' },
  ];

  const defaults = {
    homeHtDrawPct: 40,
    awayHtDrawPct: 40,
    h2hMatchesCount: 6,
    h2hHtDraws: 2,
    homeRecentHtDraws: 2,
    awayRecentHtDraws: 2,
    homeGamesSinceHtDraw: 3,
    awayGamesSinceHtDraw: 3,
    homeTablePosition: 5,
    awayTablePosition: 9,
  };

  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [time, setTime] = useState('20:00');
  const [values, setValues] = useState<Record<NumField['key'], number>>(defaults);

  const teamNames = cfg.teams.map((t) => t.name);
  const valid = homeTeam.trim() && awayTeam.trim() && homeTeam.trim() !== awayTeam.trim();

  const submit = () => {
    if (!valid) return;
    onAdd({
      id: `${league}-${date}-manual-${Date.now()}`,
      league,
      date,
      time,
      homeTeam: homeTeam.trim(),
      awayTeam: awayTeam.trim(),
      ...values,
    });
    setHomeTeam('');
    setAwayTeam('');
    setValues(defaults);
  };

  const grouped = fields.reduce<Record<string, NumField[]>>((acc, f) => {
    (acc[f.layer] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-sm font-bold text-slate-300">הזנה ידנית — {cfg.nameShort}</div>

      <datalist id="team-names">
        {teamNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="flex flex-wrap gap-3">
        <input
          value={homeTeam}
          onChange={(e) => setHomeTeam(e.target.value)}
          list="team-names"
          placeholder="קבוצה מארחת"
          className="min-w-40 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
        />
        <input
          value={awayTeam}
          onChange={(e) => setAwayTeam(e.target.value)}
          list="team-names"
          placeholder="קבוצה אורחת"
          className="min-w-40 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
        />
      </div>

      {Object.entries(grouped).map(([layer, layerFields]) => (
        <div key={layer}>
          <div className="mb-2 text-xs font-bold text-orange-400">{layer}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {layerFields.map((f) => (
              <label key={f.key} className="block text-sm">
                <span className="mb-1 block text-slate-400">{f.label}</span>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [f.key]: Math.min(f.max, Math.max(f.min, Number(e.target.value) || 0)),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={submit}
        disabled={!valid}
        className="rounded-lg bg-orange-500 px-4 py-2 font-bold text-slate-950 transition hover:bg-orange-400 disabled:opacity-40"
      >
        הוספת משחק
      </button>
    </div>
  );
}
