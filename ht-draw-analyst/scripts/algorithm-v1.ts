// Legacy v1 4-layer scoring algorithm. Kept only for scripts/backtest.ts so
// the historical evaluation of the original spec's algorithm stays
// reproducible; the app itself now uses src/model.ts (logistic model on real
// data). The v1 types live here, self-contained.

export type LeagueId = 'laliga' | 'israel';
export type Confidence = 'top' | 'good' | 'borderline' | 'low';

export interface MatchData {
  id: string;
  league: LeagueId;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  homeHtDrawPct: number;
  awayHtDrawPct: number;
  h2hMatchesCount: number;
  h2hHtDraws: number;
  homeRecentHtDraws: number;
  awayRecentHtDraws: number;
  homeGamesSinceHtDraw: number;
  awayGamesSinceHtDraw: number;
  homeTablePosition: number;
  awayTablePosition: number;
  note?: string;
  htResult?: string;
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

export interface ScoredMatch {
  match: MatchData;
  layers: LayerScores;
  total: number;
  confidence: Confidence;
  reasons: string[];
  signals: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  profile: 0.35,
  h2h: 0.2,
  form: 0.25,
  streaks: 0.2,
};

export const MAX_RECOMMENDATIONS = 6;
export const DEFAULT_MIN_SCORE = 50;
export const TOP_PICK_SCORE = 65;

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v));
}

/** Map a raw HT-draw percentage (realistic range ~20%–55%) to a 0–100 score. */
function normalizePct(pct: number): number {
  return clamp(((pct - 20) / 35) * 100);
}

export function scoreMatch(match: MatchData, weights: Weights): ScoredMatch {
  const reasons: string[] = [];
  let signals = 0;

  // Layer 1 — profile (HT draw % home/away)
  const avgProfile = (match.homeHtDrawPct + match.awayHtDrawPct) / 2;
  const profile = normalizePct(avgProfile);
  if (match.homeHtDrawPct >= 40 && match.awayHtDrawPct >= 40) {
    reasons.push(`שתי הקבוצות עם 40%+ תיקו במחצית (${match.homeHtDrawPct}% / ${match.awayHtDrawPct}%)`);
    signals++;
  } else if (avgProfile >= 40) {
    reasons.push(`פרופיל חזק: ממוצע ${Math.round(avgProfile)}% תיקו במחצית`);
  }

  // Layer 2 — head to head
  let h2h: number;
  if (match.h2hMatchesCount === 0) {
    h2h = 50; // neutral when no data
  } else {
    const h2hPct = (match.h2hHtDraws / match.h2hMatchesCount) * 100;
    h2h = clamp((h2hPct / 60) * 100);
    if (h2hPct >= 50 && match.h2hMatchesCount >= 4) {
      reasons.push(`H2H חזק: ${match.h2hHtDraws}/${match.h2hMatchesCount} תיקו במחצית (${Math.round(h2hPct)}%)`);
      signals++;
    }
  }

  // Layer 3 — form (last 6 matches per team)
  const formDraws = match.homeRecentHtDraws + match.awayRecentHtDraws;
  const form = clamp((formDraws / 12) * 100 * 1.6); // 7-8/12 already means red-hot form
  if (formDraws >= 5) {
    reasons.push(`פורמת תיקו חמה: ${formDraws}/12 תיקו במחצית ב-6 המשחקים האחרונים`);
    signals++;
  }

  // Layer 4 — streaks / statistical tension
  const avgSince = (match.homeGamesSinceHtDraw + match.awayGamesSinceHtDraw) / 2;
  const tension = clamp((avgSince / 12) * 100);
  const posGap = Math.abs(match.homeTablePosition - match.awayTablePosition);
  const closeness = clamp(100 - posGap * 8);
  const streaks = clamp(tension * 0.7 + closeness * 0.3);
  const maxSince = Math.max(match.homeGamesSinceHtDraw, match.awayGamesSinceHtDraw);
  if (maxSince >= 10) {
    reasons.push(`מתח סטטיסטי: ${maxSince} משחקים ללא תיקו במחצית`);
    signals++;
  }
  if (posGap <= 3) {
    reasons.push(`קבוצות צמודות בטבלה (מקומות ${match.homeTablePosition} ו-${match.awayTablePosition})`);
  }

  if (signals >= 3) {
    reasons.unshift('⭐ תבנית הזהב: 3+ סיגנלים חזקים יחד');
  }

  const layers: LayerScores = {
    profile: Math.round(profile),
    h2h: Math.round(h2h),
    form: Math.round(form),
    streaks: Math.round(streaks),
  };

  const total = Math.round(
    profile * weights.profile +
      h2h * weights.h2h +
      form * weights.form +
      streaks * weights.streaks,
  );

  return {
    match,
    layers,
    total: clamp(total),
    confidence: confidenceFor(total),
    reasons,
    signals,
  };
}

export function confidenceFor(total: number): Confidence {
  if (total >= 75) return 'top';
  if (total >= 60) return 'good';
  if (total >= 45) return 'borderline';
  return 'low';
}

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  top: 'TOP PICK ⭐',
  good: 'המלצה טובה',
  borderline: 'שקול בזהירות',
  low: 'לא מומלץ',
};

export function scoreMatches(matches: MatchData[], weights: Weights): ScoredMatch[] {
  return matches.map((m) => scoreMatch(m, weights)).sort((a, b) => b.total - a.total);
}

export function recommendations(scored: ScoredMatch[], minScore: number): ScoredMatch[] {
  return scored.filter((s) => s.total >= minScore).slice(0, MAX_RECOMMENDATIONS);
}

export function isHtDraw(result: string | undefined): boolean | undefined {
  if (!result) return undefined;
  const m = result.trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return undefined;
  return m[1] === m[2];
}
