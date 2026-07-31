export type LeagueId = 'laliga' | 'israel';

export type Side = 'draw' | 'none';

export interface MatchData {
  id: string;
  league: LeagueId;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  homeTeam: string; // dataset name (English)
  awayTeam: string;
  htResult?: string; // e.g. "0-0"
}

export interface TeamStats {
  name: string;
  ppg: number; // points per game, latest season in the data
  position: number;
  played: number;
  gfAvg: number; // goals for per game, last 10
  gaAvg: number; // goals against per game, last 10
  tempo: number; // gf+ga per game, last 10
  homeHtRate: number; // 0-1, HT draws in last 15 home matches
  awayHtRate: number;
  recent6: number; // HT draws in last 6 matches
  since: number; // games since an HT draw
}

export interface LeagueModel {
  means: number[];
  stds: number[];
  weights: number[]; // bias at index 0
}

export interface LeagueBundle {
  league: LeagueId;
  baseRate: number; // historical HT draw rate
  nTeams: number;
  season: string; // last season in the data, e.g. "2526"
  lastDate: string;
  matches: number;
  teams: Record<string, TeamStats>;
  h2h: Record<string, { n: number; draws: number }>; // key: sorted "A|B"
  model: LeagueModel;
  thresholds: { noDraw: number; draw: number };
  precision: { noDraw: number; draw: number }; // measured out-of-sample, %
  drawRecommendable: boolean;
  testedOn: string;
}

export interface Prediction {
  match: MatchData;
  p: number; // P(HT draw), 0-1
  side: Side;
  precisionPct: number | null; // measured OOS precision for the picked side
  reasons: string[];
  missingTeam?: string; // set when a team has no stats in the bundle
}

export interface DayRecord {
  league: LeagueId;
  date: string;
  matches: MatchData[];
  source: 'api' | 'manual';
}

export interface AppState {
  selectedLeague: LeagueId;
  days: Record<string, DayRecord>; // key: `${league}:${date}`
  apiFootballKey?: string;
}
