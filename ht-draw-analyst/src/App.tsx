import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fetchMatchesAI } from './ai-service';
import {
  DEFAULT_WEIGHTS,
  isHtDraw,
  recommendations,
  scoreMatches,
} from './algorithm';
import { generateDemoMatches } from './demo-data';
import { LEAGUES } from './leagues';
import {
  dayKey,
  hasLearnedWeights,
  historyForLeague,
  loadState,
  loadWeights,
  resetWeights,
  saveState,
  saveWeights,
} from './storage';
import type { AppState, LeagueId, MatchData, Weights } from './types';
import { cn, formatHebrewDate, todayISO } from './ui';
import EvaluationPanel from './components/EvaluationPanel';
import FetchPanel from './components/FetchPanel';
import LearningPanel from './components/LearningPanel';
import ManualMatchForm from './components/ManualMatchForm';
import MatchTable from './components/MatchTable';
import NextMatchday from './components/NextMatchday';
import RecommendationCard from './components/RecommendationCard';

type Tab = 'dashboard' | 'input' | 'analysis' | 'results' | 'learning' | 'next';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'ראשי' },
  { id: 'input', label: 'הזנה' },
  { id: 'analysis', label: 'ניתוח' },
  { id: 'results', label: 'תוצאות' },
  { id: 'learning', label: 'למידה' },
  { id: 'next', label: 'המחזור הבא' },
];

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [tab, setTab] = useState<Tab>('dashboard');
  const [date, setDate] = useState(todayISO());
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [source, setSource] = useState<'demo' | 'ai' | 'manual' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<Weights>(() => loadWeights(loadState().selectedLeague));
  const [learned, setLearned] = useState(() => hasLearnedWeights(loadState().selectedLeague));

  const league = state.selectedLeague;
  const cfg = LEAGUES[league];
  const minScore = state.minScore[league];

  useEffect(() => saveState(state), [state]);

  const scored = useMemo(() => scoreMatches(matches, weights), [matches, weights]);
  const recs = useMemo(() => recommendations(scored, minScore), [scored, minScore]);
  const recIds = useMemo(() => new Set(recs.map((r) => r.match.id)), [recs]);

  const persistDay = (nextMatches: MatchData[], src: 'demo' | 'ai' | 'manual') => {
    setMatches(nextMatches);
    setSource(src);
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
    setMatches([]); // clear loaded matches
    setSource(null);
    setError(null); // reset error messages
    setWeights(loadWeights(next)); // per-league learned weights
    setLearned(hasLearnedWeights(next));
    setState((s) => ({ ...s, selectedLeague: next })); // persisted via localStorage
  };

  const fetchDemo = () => {
    setError(null);
    const saved = state.days[dayKey(league, date)];
    if (saved && saved.source !== 'ai') {
      setMatches(saved.matches);
      setSource(saved.source);
      return;
    }
    persistDay(generateDemoMatches(league, date), 'demo');
  };

  const fetchAI = async () => {
    setError(null);
    const key = state.geminiApiKey?.trim();
    if (!key) {
      setError('לא הוגדר מפתח Gemini API — נטענו נתוני דמו במקום. אפשר להגדיר מפתח בפאנל השליפה.');
      persistDay(generateDemoMatches(league, date), 'demo');
      return;
    }
    setLoading(true);
    try {
      const aiMatches = await fetchMatchesAI(league, date, key);
      if (aiMatches.length === 0) {
        setError('ה-AI לא מצא משחקים לתאריך הזה — נטענו נתוני דמו במקום.');
        persistDay(generateDemoMatches(league, date), 'demo');
      } else {
        persistDay(aiMatches, 'ai');
      }
    } catch {
      setError('שליפת ה-AI נכשלה — נטענו נתוני דמו במקום.');
      persistDay(generateDemoMatches(league, date), 'demo');
    } finally {
      setLoading(false);
    }
  };

  const addManualMatch = (m: MatchData) => {
    persistDay([...matches, m], 'manual');
  };

  const deleteMatch = (id: string) => {
    persistDay(matches.filter((m) => m.id !== id), source ?? 'manual');
  };

  const setResult = (matchId: string, result: string) => {
    const next = matches.map((m) => (m.id === matchId ? { ...m, htResult: result || undefined } : m));
    persistDay(next, source ?? 'manual');
  };

  const applyWeights = (w: Weights) => {
    saveWeights(league, w);
    setWeights(w);
    setLearned(true);
  };

  const resetLeagueWeights = () => {
    resetWeights(league);
    setWeights(DEFAULT_WEIGHTS);
    setLearned(false);
  };

  const loadRoundToAnalysis = (roundMatches: MatchData[], roundDate: string) => {
    setDate(roundDate);
    setMatches(roundMatches);
    setSource('demo');
    setError(null);
    setTab('analysis');
  };

  const leagueHistory = useMemo(
    () =>
      historyForLeague(state, league)
        .flatMap((d) => d.matches)
        .filter((m) => isHtDraw(m.htResult) !== undefined),
    [state, league],
  );

  const maxScore = scored.length > 0 ? scored[0].total : null;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            HT <span className="text-orange-500">Analyst</span>
          </h1>
          <div className="mt-0.5 text-sm text-slate-400">
            {cfg.flag} {cfg.nameShort} • מנתח תיקו במחצית
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
            {source === 'ai' ? 'AI' : 'DEMO'}
          </span>
          {learned && (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-400">
              למידה פעילה
            </span>
          )}
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
              <FetchPanel
                league={league}
                onLeagueChange={switchLeague}
                date={date}
                onDateChange={setDate}
                onFetchDemo={fetchDemo}
                onFetchAI={fetchAI}
                loading={loading}
                error={error}
                geminiApiKey={state.geminiApiKey ?? ''}
                onApiKeyChange={(k) => setState((s) => ({ ...s, geminiApiKey: k }))}
              />

              <div className="grid grid-cols-3 gap-3">
                <StatCard label="משחקים" value={matches.length} />
                <StatCard label="המלצות" value={recs.length} />
                <StatCard label="ציון מקסימלי" value={maxScore ?? '—'} />
              </div>

              {recs.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-bold text-slate-300">
                    2 ההמלצות המובילות • {formatHebrewDate(date)}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {recs.slice(0, 2).map((r, i) => (
                      <RecommendationCard key={r.match.id} scored={r} rank={i} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'input' && (
            <>
              <FetchPanel
                league={league}
                onLeagueChange={switchLeague}
                date={date}
                onDateChange={setDate}
                onFetchDemo={fetchDemo}
                onFetchAI={fetchAI}
                loading={loading}
                error={error}
                geminiApiKey={state.geminiApiKey ?? ''}
                onApiKeyChange={(k) => setState((s) => ({ ...s, geminiApiKey: k }))}
              />
              <ManualMatchForm league={league} date={date} onAdd={addManualMatch} />
              <div>
                <div className="mb-2 text-sm font-bold text-slate-300">משחקים טעונים ({matches.length})</div>
                <MatchTable scored={scored} onDelete={deleteMatch} />
              </div>
            </>
          )}

          {tab === 'analysis' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-bold text-slate-300">
                  המלצות מובילות • {formatHebrewDate(date)} • סף מינימום:
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={minScore}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        minScore: {
                          ...s.minScore,
                          [league]: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                        },
                      }))
                    }
                    className="ms-2 w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-center"
                  />
                </div>
                {source === 'ai' && (
                  <span className="text-xs text-slate-500">מקור נתונים: Gemini AI + Google Search</span>
                )}
              </div>

              {recs.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
                  {matches.length === 0
                    ? 'אין משחקים — שלוף משחקים במסך הראשי או במסך ההזנה'
                    : `אף משחק לא עבר את סף ה-${minScore} — נסה להוריד את הסף`}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {recs.map((r, i) => (
                    <RecommendationCard key={r.match.id} scored={r} rank={i} />
                  ))}
                </div>
              )}

              <div>
                <div className="mb-2 text-sm font-bold text-slate-300">כל המשחקים לפי ציון</div>
                <MatchTable scored={scored} />
              </div>
            </>
          )}

          {tab === 'results' && (
            <EvaluationPanel scored={scored} recommendedIds={recIds} onResultChange={setResult} />
          )}

          {tab === 'learning' && (
            <LearningPanel
              league={league}
              history={leagueHistory}
              currentWeights={weights}
              hasLearned={learned}
              onApplyWeights={applyWeights}
              onResetWeights={resetLeagueWeights}
            />
          )}

          {tab === 'next' && (
            <NextMatchday league={league} weights={weights} onLoadToAnalysis={loadRoundToAnalysis} />
          )}
        </motion.main>
      </AnimatePresence>

      <footer className="mt-10 border-t border-slate-800 pt-4 text-center text-xs text-slate-600">
        HT Draw Analyst — כלי ניתוח סטטיסטי בלבד, לא ייעוץ הימורים • איכות על כמות: עד 6 המלצות ביום
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
