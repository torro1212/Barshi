import { isHtDraw, scoreMatch } from './algorithm';
import { generateLearningDataset } from './demo-data';
import type {
  LeagueId,
  LearningResult,
  MatchData,
  PatternStat,
  Weights,
} from './types';

const MIN_REAL_SAMPLE = 30;

interface EvalMetrics {
  f1: number;
  precision: number;
  recall: number;
}

function evaluate(matches: MatchData[], weights: Weights, threshold: number): EvalMetrics {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const m of matches) {
    const draw = isHtDraw(m.htResult);
    if (draw === undefined) continue;
    const predicted = scoreMatch(m, weights).total >= threshold;
    if (predicted && draw) tp++;
    else if (predicted && !draw) fp++;
    else if (!predicted && draw) fn++;
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { f1, precision, recall };
}

function* weightGrid(): Generator<Weights> {
  const step = 0.05;
  for (let p = 0.2; p <= 0.5001; p += step) {
    for (let h = 0.1; h <= 0.35001; h += step) {
      for (let f = 0.15; f <= 0.40001; f += step) {
        const s = 1 - p - h - f;
        if (s >= 0.0999 && s <= 0.3501) {
          yield {
            profile: round2(p),
            h2h: round2(h),
            form: round2(f),
            streaks: round2(s),
          };
        }
      }
    }
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function detectPatterns(matches: MatchData[]): PatternStat[] {
  const defs: { name: string; test: (m: MatchData) => boolean }[] = [
    {
      name: 'שתי קבוצות 40%+ תיקו במחצית',
      test: (m) => m.homeHtDrawPct >= 40 && m.awayHtDrawPct >= 40,
    },
    {
      name: 'מתח סטטיסטי (10+ משחקים ללא תיקו)',
      test: (m) => Math.max(m.homeGamesSinceHtDraw, m.awayGamesSinceHtDraw) >= 10,
    },
    {
      name: 'H2H חזק (50%+)',
      test: (m) => m.h2hMatchesCount >= 4 && m.h2hHtDraws / m.h2hMatchesCount >= 0.5,
    },
    {
      name: 'פורמת תיקו חמה (5+/12)',
      test: (m) => m.homeRecentHtDraws + m.awayRecentHtDraws >= 5,
    },
  ];
  const stats: PatternStat[] = defs.map((d) => {
    const hit = matches.filter((m) => d.test(m));
    const draws = hit.filter((m) => isHtDraw(m.htResult) === true);
    return {
      name: d.name,
      matches: hit.length,
      hits: draws.length,
      hitRate: hit.length > 0 ? Math.round((draws.length / hit.length) * 100) : 0,
    };
  });
  // Gold pattern: 3+ of the base signals together
  const gold = matches.filter((m) => defs.filter((d) => d.test(m)).length >= 3);
  const goldDraws = gold.filter((m) => isHtDraw(m.htResult) === true);
  stats.push({
    name: 'תבנית הזהב (3+ סיגנלים יחד)',
    matches: gold.length,
    hits: goldDraws.length,
    hitRate: gold.length > 0 ? Math.round((goldDraws.length / gold.length) * 100) : 0,
  });
  return stats;
}

export function runLearning(
  league: LeagueId,
  realHistory: MatchData[],
  currentWeights: Weights,
): LearningResult {
  const withResults = realHistory.filter((m) => isHtDraw(m.htResult) !== undefined);
  const usedDemoData = withResults.length < MIN_REAL_SAMPLE;
  const dataset = usedDemoData ? generateLearningDataset(league, 60) : withResults;

  let best: { weights: Weights; threshold: number; metrics: EvalMetrics } = {
    weights: currentWeights,
    threshold: 50,
    metrics: evaluate(dataset, currentWeights, 50),
  };
  for (const w of weightGrid()) {
    for (let t = 40; t <= 80; t += 5) {
      const metrics = evaluate(dataset, w, t);
      if (metrics.f1 > best.metrics.f1) {
        best = { weights: w, threshold: t, metrics };
      }
    }
  }

  const days = [...new Set(dataset.map((m) => m.date))].sort();
  const daily = days.slice(-30).map((date) => {
    const dayMatches = dataset.filter((m) => m.date === date);
    const recommended = dayMatches.filter(
      (m) => scoreMatch(m, best.weights).total >= best.threshold,
    );
    const hits = recommended.filter((m) => isHtDraw(m.htResult) === true);
    return { date, recommended: recommended.length, hits: hits.length };
  });

  return {
    league,
    sampleSize: dataset.length,
    daysAnalyzed: days.length,
    usedDemoData,
    currentWeights,
    bestWeights: best.weights,
    bestThreshold: best.threshold,
    f1: Math.round(best.metrics.f1 * 100) / 100,
    precision: Math.round(best.metrics.precision * 100),
    recall: Math.round(best.metrics.recall * 100),
    patterns: detectPatterns(dataset),
    daily,
  };
}
