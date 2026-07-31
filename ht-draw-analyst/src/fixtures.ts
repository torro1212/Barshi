import { BUNDLES } from './model';
import type { LeagueId, MatchData } from './types';

const API_BASE = 'https://v3.football.api-sports.io';

// API-Football league ids
const LEAGUE_API_IDS: Record<LeagueId, number> = {
  laliga: 140,
  israel: 383,
};

// API-Football team names → dataset (football-data.co.uk) names
const LALIGA_ALIASES: Record<string, string> = {
  'atletico madrid': 'Ath Madrid',
  'athletic club': 'Ath Bilbao',
  'real betis': 'Betis',
  'real sociedad': 'Sociedad',
  'rayo vallecano': 'Vallecano',
  'celta vigo': 'Celta',
  'espanyol': 'Espanol',
  'real valladolid': 'Valladolid',
  'real oviedo': 'Oviedo',
  'deportivo alaves': 'Alaves',
  'alaves': 'Alaves',
  'cadiz': 'Cadiz',
  'leganes': 'Leganes',
  'almeria': 'Almeria',
};

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Map an API-Football team name to the bundled dataset name (or return as-is). */
export function normalizeTeam(league: LeagueId, apiName: string): string {
  const teams = BUNDLES[league].teams;
  if (teams[apiName]) return apiName;
  const plain = stripAccents(apiName).trim();
  if (teams[plain]) return plain;
  if (league === 'laliga') {
    const alias = LALIGA_ALIASES[plain.toLowerCase()];
    if (alias) return alias;
    const noPrefix = plain.replace(/^(Real|Deportivo|CD|UD|CA)\s+/i, '');
    if (teams[noPrefix]) return noPrefix;
  }
  return plain;
}

interface ApiFixtureResponse {
  errors: unknown;
  response: {
    fixture: { id: number; date: string };
    teams: { home: { name: string }; away: { name: string } };
  }[];
}

async function apiGet(path: string, key: string): Promise<ApiFixtureResponse> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'x-apisports-key': key } });
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  const body = (await res.json()) as ApiFixtureResponse;
  const errs = body.errors;
  if (errs && (Array.isArray(errs) ? errs.length > 0 : Object.keys(errs as object).length > 0)) {
    throw new Error(JSON.stringify(errs));
  }
  return body;
}

function toMatch(league: LeagueId, f: ApiFixtureResponse['response'][number]): MatchData {
  const d = new Date(f.fixture.date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    id: `${league}-api-${f.fixture.id}`,
    league,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    homeTeam: normalizeTeam(league, f.teams.home.name),
    awayTeam: normalizeTeam(league, f.teams.away.name),
  };
}

function seasonForDate(date: string): number {
  const d = new Date(date);
  return d.getMonth() + 1 >= 7 ? d.getFullYear() : d.getFullYear() - 1;
}

/** Real fixtures for a specific date. */
export async function fetchFixturesByDate(
  league: LeagueId,
  date: string,
  key: string,
): Promise<MatchData[]> {
  const body = await apiGet(
    `/fixtures?league=${LEAGUE_API_IDS[league]}&season=${seasonForDate(date)}&date=${date}`,
    key,
  );
  return body.response.map((f) => toMatch(league, f));
}

/** The next N real fixtures for the league. */
export async function fetchNextFixtures(
  league: LeagueId,
  key: string,
  n = 10,
): Promise<MatchData[]> {
  const body = await apiGet(`/fixtures?league=${LEAGUE_API_IDS[league]}&next=${n}`, key);
  return body.response.map((f) => toMatch(league, f));
}
