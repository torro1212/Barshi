export type LeagueId = 'laliga' | 'israel';

export type TeamStyle = 'attacking' | 'balanced' | 'defensive';

export interface TeamProfile {
  name: string;
  style: TeamStyle;
  htDrawRate: number; // typical % of matches drawn at half-time
}

export interface MatchData {
  id: string;
  league: LeagueId;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  homeTeam: string;
  awayTeam: string;
  // Layer 1 — profile
  homeHtDrawPct: number; // 0-100, HT draw % at home
  awayHtDrawPct: number; // 0-100, HT draw % away
  // Layer 2 — head to head
  h2hMatchesCount: number; // 0-20
  h2hHtDraws: number;
  // Layer 3 — form (last 6 matches)
  homeRecentHtDraws: number; // 0-6
  awayRecentHtDraws: number; // 0-6
  // Layer 4 — streaks / statistical tension
  homeGamesSinceHtDraw: number;
  awayGamesSinceHtDraw: number;
  homeTablePosition: number;
  awayTablePosition: number;
  note?: string;
  htResult?: string; // e.g. "0-0"
}

export interface Weights {
  profile: number;
  h2h: number;
  form: number;
  streaks: number;
}

export interface LayerScores {
  profile: number;
  h2h: number;
  form: number;
  streaks: number;
}

export type Confidence = 'top' | 'good' | 'borderline' | 'low';

export interface ScoredMatch {
  match: MatchData;
  layers: LayerScores;
  total: number; // 0-100
  confidence: Confidence;
  reasons: string[];
  signals: number; // count of strong signals (for gold pattern)
}

export interface DayRecord {
  league: LeagueId;
  date: string;
  matches: MatchData[];
  source: 'demo' | 'ai' | 'manual';
}

export interface AppState {
  selectedLeague: LeagueId;
  minScore: Record<LeagueId, number>;
  days: Record<string, DayRecord>; // key: `${league}:${date}`
  geminiApiKey?: string;
}

export interface PatternStat {
  name: string;
  matches: number;
  hits: number;
  hitRate: number; // 0-100
}

export interface LearningResult {
  league: LeagueId;
  sampleSize: number;
  daysAnalyzed: number;
  usedDemoData: boolean;
  currentWeights: Weights;
  bestWeights: Weights;
  bestThreshold: number;
  f1: number;
  precision: number;
  recall: number;
  patterns: PatternStat[];
  daily: { date: string; recommended: number; hits: number }[];
}
