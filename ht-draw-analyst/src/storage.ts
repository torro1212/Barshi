import { DEFAULT_MIN_SCORE, DEFAULT_WEIGHTS } from './algorithm';
import { LEAGUES } from './leagues';
import type { AppState, DayRecord, LeagueId, Weights } from './types';

const APP_KEY = 'ht_draw_analyst';

function emptyState(): AppState {
  return {
    selectedLeague: 'israel',
    minScore: { laliga: DEFAULT_MIN_SCORE, israel: DEFAULT_MIN_SCORE },
    days: {},
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(APP_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...emptyState(), ...parsed, minScore: { ...emptyState().minScore, ...parsed.minScore } };
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(APP_KEY, JSON.stringify(state));
  } catch {
    // storage full / unavailable — the app keeps working in memory
  }
}

export function dayKey(league: LeagueId, date: string): string {
  return `${league}:${date}`;
}

export function historyForLeague(state: AppState, league: LeagueId): DayRecord[] {
  return Object.values(state.days)
    .filter((d) => d.league === league)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function loadWeights(league: LeagueId): Weights {
  try {
    const raw = localStorage.getItem(LEAGUES[league].weightsStorageKey);
    if (!raw) return DEFAULT_WEIGHTS;
    const w = JSON.parse(raw) as Weights;
    if ([w.profile, w.h2h, w.form, w.streaks].some((v) => typeof v !== 'number')) {
      return DEFAULT_WEIGHTS;
    }
    return w;
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export function saveWeights(league: LeagueId, weights: Weights): void {
  try {
    localStorage.setItem(LEAGUES[league].weightsStorageKey, JSON.stringify(weights));
  } catch {
    // ignore
  }
}

export function hasLearnedWeights(league: LeagueId): boolean {
  return localStorage.getItem(LEAGUES[league].weightsStorageKey) !== null;
}

export function resetWeights(league: LeagueId): void {
  localStorage.removeItem(LEAGUES[league].weightsStorageKey);
}
