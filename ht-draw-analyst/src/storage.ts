import type { AppState, DayRecord, LeagueId } from './types';

const APP_KEY = 'ht_draw_analyst_v2';

function emptyState(): AppState {
  return { selectedLeague: 'israel', days: {} };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(APP_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(APP_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable — the app keeps working in memory
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
