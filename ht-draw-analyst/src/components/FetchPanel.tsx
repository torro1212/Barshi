import { useState } from 'react';
import { LEAGUES } from '../leagues';
import type { LeagueId } from '../types';
import LeagueSelector from './LeagueSelector';

interface Props {
  league: LeagueId;
  onLeagueChange: (league: LeagueId) => void;
  date: string;
  onDateChange: (date: string) => void;
  onFetchDemo: () => void;
  onFetchAI: () => void;
  loading: boolean;
  error: string | null;
  geminiApiKey: string;
  onApiKeyChange: (key: string) => void;
}

export default function FetchPanel(props: Props) {
  const [showKey, setShowKey] = useState(false);
  const cfg = LEAGUES[props.league];
  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-sm font-bold text-slate-300">בחירת ליגה</div>
      <LeagueSelector value={props.league} onChange={props.onLeagueChange} disabled={props.loading} />

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
          onClick={props.onFetchDemo}
          disabled={props.loading}
          className="rounded-lg bg-orange-500 px-4 py-2 font-bold text-slate-950 transition hover:bg-orange-400 disabled:opacity-50"
        >
          {props.loading ? 'שולף…' : `שליפת משחקים (דמו) ${cfg.flag}`}
        </button>
        <button
          type="button"
          onClick={props.onFetchAI}
          disabled={props.loading}
          className="rounded-lg border border-orange-500/50 px-4 py-2 font-bold text-orange-400 transition hover:bg-orange-500/10 disabled:opacity-50"
        >
          שליפה אמיתית (Gemini AI)
        </button>
      </div>

      <div>
        <button type="button" onClick={() => setShowKey((v) => !v)} className="text-xs text-slate-500 hover:text-slate-300">
          {showKey ? 'הסתר מפתח API' : 'הגדרת מפתח Gemini API…'}
        </button>
        {showKey && (
          <input
            type="password"
            dir="ltr"
            placeholder="GEMINI_API_KEY"
            value={props.geminiApiKey}
            onChange={(e) => props.onApiKeyChange(e.target.value)}
            className="mt-2 w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
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
