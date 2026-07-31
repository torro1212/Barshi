import { useState } from 'react';
import { BUNDLES } from '../model';
import type { LeagueId } from '../types';
import LeagueSelector from './LeagueSelector';

interface Props {
  league: LeagueId;
  onLeagueChange: (league: LeagueId) => void;
  date: string;
  onDateChange: (date: string) => void;
  onFetch: () => void;
  loading: boolean;
  error: string | null;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export default function FetchPanel(props: Props) {
  const [showKey, setShowKey] = useState(!props.apiKey);
  const bundle = BUNDLES[props.league];
  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-sm font-bold text-slate-300">בחירת ליגה</div>
      <LeagueSelector value={props.league} onChange={props.onLeagueChange} disabled={props.loading} />

      <div className="text-xs text-slate-500">
        נתונים אמיתיים: {bundle.matches.toLocaleString()} משחקים היסטוריים, מעודכן עד {bundle.lastDate}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-400">תאריך</span>
          <input
            type="date"
            value={props.date}
            onChange={(e) => props.onDateChange(e.target.value)}
            disabled={props.loading}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
        </label>
        <button
          type="button"
          onClick={props.onFetch}
          disabled={props.loading}
          className="rounded-lg bg-orange-500 px-4 py-2 font-bold text-slate-950 transition hover:bg-orange-400 disabled:opacity-50"
        >
          {props.loading ? 'שולף…' : 'שליפת משחקים אמיתיים'}
        </button>
      </div>

      <div>
        <button type="button" onClick={() => setShowKey((v) => !v)} className="text-xs text-slate-500 hover:text-slate-300">
          {showKey ? 'הסתר מפתח API' : 'מפתח API-Football…'}
        </button>
        {showKey && (
          <div className="mt-2 space-y-1">
            <input
              type="password"
              dir="ltr"
              placeholder="API_FOOTBALL_KEY"
              value={props.apiKey}
              onChange={(e) => props.onApiKeyChange(e.target.value)}
              className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            <div className="text-xs text-slate-500">
              מפתח חינמי (100 בקשות ליום) מ-dashboard.api-football.com — נשמר רק בדפדפן שלך
            </div>
          </div>
        )}
      </div>

      {props.error && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {props.error}
        </div>
      )}
    </div>
  );
}
