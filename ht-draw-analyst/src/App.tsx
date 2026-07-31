import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fetchFixturesByDate } from './fixtures';
import { LEAGUES } from './leagues';
import { BUNDLES, predictAll, recommendations } from './model';
import { dayKey, historyForLeague, loadState, saveState } from './storage';
import type { AppState, LeagueId, MatchData } from './types';
import { cn, formatHebrewDate, todayISO } from './ui';
import AccuracyPanel from './components/AccuracyPanel';
import EvaluationPanel from './components/EvaluationPanel';
import FetchPanel from './components/FetchPanel';
import ManualMatchForm from './components/ManualMatchForm';
import NextMatchday from './components/NextMatchday';
import PredictionCard from './components/PredictionCard';
import PredictionTable from './components/PredictionTable';

type Tab = 'dashboard' | 'matches' | 'analysis' | 'results' | 'accuracy' | 'next';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'ראשי' },
  { id: 'matches', label: 'משחקים' },
  { id: 'analysis', label: 'ניתוח' },
  { id: 'results', label: 'תוצאות' },
  { id: 'accuracy', label: 'דיוק' },
  { id: 'next', label: 'המחזור הבא' },
];

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [tab, setTab] = useState<Tab>('dashboard');
  const [date, setDate] = useState(todayISO());
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const league = state.selectedLeague;
  const cfg = LEAGUES[league];
  const bundle = BUNDLES[league];

  useEffect(() => saveState(state), [state]);

  const preds = useMemo(() => predictAll(matches), [matches]);
  const recs = useMemo(() => recommendations(preds), [preds]);

  const persistDay = (nextMatches: MatchData[], src: 'api' | 'manual') => {
    setMatches(nextMatches);
    setState((s) => ({
      ...s,
      days: {
        ...s.days,
        [dayKey(league, date)]: { league, date, matches: nextMatches, source: src },
      },
    }));
  };

  const switchLeague = (next: LeagueId) => {
    if (next === league) return;
    setMatches([]);
    setError(null);
    setState((s) => ({ ...s, selectedLeague: next }));
  };

  const fetchForDate = async () => {
    setError(null);
    const saved = state.days[dayKey(league, date)];
    const key = state.apiFootballKey?.trim();
    if (!key) {
      if (saved) {
        setMatches(saved.matches);
        return;
      }
      setError('נדרש מפתח API-Football כדי לשלוף משחקים אמיתיים — אפשר גם להוסיף משחקים ידנית במסך "משחקים"');
      return;
    }
    setLoading(true);
    try {
      const fixtures = await fetchFixturesByDate(league, date, key);
      if (fixtures.length === 0) {
        setError('אין משחקים בליגה הזו בתאריך הזה');
        if (saved) setMatches(saved.matches);
      } else {
        persistDay(fixtures, 'api');
      }
    } catch {
      setError('השליפה נכשלה — בדוק את המפתח ואת מגבלת הבקשות היומית');
      if (saved) setMatches(saved.matches);
    } finally {
      setLoading(false);
    }
  };

  const addManualMatch = (m: MatchData) => persistDay([...matches, m], 'manual');
  const deleteMatch = (id: string) => persistDay(matches.filter((m) => m.id !== id), 'manual');

  const setResult = (matchId: string, result: string) => {
    persistDay(
      matches.map((m) => (m.id === matchId ? { ...m, htResult: result || undefined } : m)),
      'manual',
    );
  };

  const loadToAnalysis = (roundMatches: MatchData[], roundDate: string) => {
    setDate(roundDate);
    setMatches(roundMatches);
    setError(null);
    setTab('analysis');
  };

  const leagueHistory = useMemo(
    () => historyForLeague(state, league).flatMap((d) => d.matches),
    [state, league],
  );

  const fetchPanel = (
    <FetchPanel
      league={league}
      onLeagueChange={switchLeague}
      date={date}
      onDateChange={setDate}
      onFetch={fetchForDate}
      loading={loading}
      error={error}
      apiKey={state.apiFootballKey ?? ''}
      onApiKeyChange={(k) => setState((s) => ({ ...s, apiFootballKey: k }))}
    />
  );

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            HT <span className="text-orange-500">Analyst</span>
          </h1>
          <div className="mt-0.5 text-sm text-slate-400">
            {cfg.flag} {cfg.nameShort} • מנתח תיקו במחצית • נתונים אמיתיים בלבד
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-400">
            {bundle.matches.toLocaleString()} משחקים אמיתיים
          </span>
          <span className="rounded-full border border-slate-700 px-3 py-1">{cfg.flag}</span>
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-1 rounded-2xl border border-slate-800 bg-slate-900 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 rounded-xl px-3 py-2 text-sm font-bold transition',
              tab === t.id ? 'bg-orange-500 text-slate-950' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.main
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="space-y-4"
        >
          {tab === 'dashboard' && (
            <>
              {fetchPanel}
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="משחקים" value={matches.length} />
                <StatCard label="המלצות" value={recs.length} />
                <StatCard
                  label={`דיוק "אין תיקו" מדוד`}
                  value={`${bundle.precision.noDraw}%`}
                />
              </div>
              {recs.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-bold text-slate-300">
                    ההמלצות המובילות • {formatHebrewDate(date)}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {recs.slice(0, 2).map((r, i) => (
                      <PredictionCard key={r.match.id} pred={r} rank={i} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'matches' && (
            <>
              {fetchPanel}
              <ManualMatchForm league={league} date={date} onAdd={addManualMatch} />
              <div>
                <div className="mb-2 text-sm font-bold text-slate-300">משחקים טעונים ({matches.length})</div>
                <PredictionTable preds={preds} onDelete={deleteMatch} />
              </div>
            </>
          )}

          {tab === 'analysis' && (
            <>
              <div className="text-sm font-bold text-slate-300">
                המלצות • {formatHebrewDate(date)} • עד 6, לפי מרחק מהסף
              </div>
              {recs.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
                  {matches.length === 0
                    ? 'אין משחקים — שלוף משחקים אמיתיים או הוסף ידנית במסך "משחקים"'
                    : 'אף משחק לא חצה את ספי ההמלצה — אין המלצה היום (איכות על כמות)'}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {recs.map((r, i) => (
                    <PredictionCard key={r.match.id} pred={r} rank={i} />
                  ))}
                </div>
              )}
              <div>
                <div className="mb-2 text-sm font-bold text-slate-300">כל המשחקים</div>
                <PredictionTable preds={preds} />
              </div>
            </>
          )}

          {tab === 'results' && <EvaluationPanel preds={preds} onResultChange={setResult} />}

          {tab === 'accuracy' && <AccuracyPanel league={league} history={leagueHistory} />}

          {tab === 'next' && (
            <NextMatchday
              league={league}
              apiKey={state.apiFootballKey ?? ''}
              onLoadToAnalysis={loadToAnalysis}
            />
          )}
        </motion.main>
      </AnimatePresence>

      <footer className="mt-10 border-t border-slate-800 pt-4 text-center text-xs text-slate-600">
        HT Draw Analyst — נתונים אמיתיים בלבד • דיוק מדוד בבדיקה עיוורת, לא הבטחה • כלי ניתוח
        סטטיסטי, לא ייעוץ הימורים
      </footer>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center">
      <div className="text-2xl font-black text-orange-400">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}
