import laligaBundle from './data/laliga.json';
import israelBundle from './data/israel.json';
import type { LeagueBundle, LeagueId, MatchData, Prediction, TeamStats } from './types';

export const BUNDLES: Record<LeagueId, LeagueBundle> = {
  laliga: laligaBundle as LeagueBundle,
  israel: israelBundle as LeagueBundle,
};

export const MAX_RECOMMENDATIONS = 6;

/** Feature order must match scripts/research.ts FEATURE_NAMES exactly. */
function features(b: LeagueBundle, h: TeamStats, a: TeamStats): number[] {
  const ppgGap = Math.abs(h.ppg - a.ppg);
  const tempo = (h.tempo + a.tempo) / 2;
  const h2hKey = [h.name, a.name].sort().join('|');
  const versus = b.h2h[h2hKey];
  const h2hRate = versus
    ? (versus.draws + b.baseRate * 4) / (versus.n + 4)
    : b.baseRate;
  const m = b.model.means;
  return [
    ppgGap,
    h.ppg - a.ppg,
    h.ppg + a.ppg,
    tempo,
    h.gfAvg + a.gfAvg,
    h.gaAvg + a.gaAvg,
    tempo * ppgGap,
    Math.abs(h.position - a.position) / b.nTeams,
    (h.homeHtRate + a.awayHtRate) / 2,
    Math.abs(h.homeHtRate - a.awayHtRate),
    h.recent6 + a.recent6,
    Math.max(h.since, a.since),
    h2hRate,
    m[13], // rest-day difference — unknown pre-match, neutralized at the mean
    m[14], // season phase — neutralized at the mean
  ];
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function predictP(b: LeagueBundle, x: number[]): number {
  const { means, stds, weights } = b.model;
  let z = weights[0];
  for (let j = 0; j < x.length; j++) z += weights[j + 1] * ((x[j] - means[j]) / (stds[j] || 1));
  return sigmoid(z);
}

const REASON_TEXTS: ((v: number, up: boolean) => string | null)[] = [
  (v, up) => `פער כוחות של ${v.toFixed(2)} נק' למשחק ${up ? 'מעלה' : 'מוריד'} סיכוי לתיקו`,
  () => null,
  () => null,
  (v, up) => `קצב של ${v.toFixed(1)} שערים למשחק ${up ? 'מעלה' : 'מוריד'} סיכוי לתיקו`,
  (v, up) => `התקפות ${up ? 'חלשות' : 'חזקות'} (${v.toFixed(1)} שערי זכות יחד) — ${up ? 'מעלה' : 'מוריד'} סיכוי`,
  (v, up) => `הגנות ${up ? 'הדוקות' : 'פרוצות'} (${v.toFixed(1)} ספיגות יחד) — ${up ? 'מעלה' : 'מוריד'} סיכוי`,
  () => null,
  (v, up) => `פער של ${Math.round(v * 100)}% בטבלה ${up ? 'מעלה' : 'מוריד'} סיכוי לתיקו`,
  (v, up) => `פרופיל תיקו-מחצית ממוצע ${Math.round(v * 100)}% — ${up ? 'מעלה' : 'מוריד'} סיכוי`,
  () => null,
  (v, up) => `${v} תיקו במחצית ב-12 המשחקים האחרונים — ${up ? 'מעלה' : 'מוריד'} סיכוי`,
  (v, up) => `${v} משחקים מאז תיקו במחצית — ${up ? 'מעלה' : 'מוריד'} סיכוי`,
  (v, up) => `היסטוריית H2H עם ${Math.round(v * 100)}% תיקו — ${up ? 'מעלה' : 'מוריד'} סיכוי`,
  () => null,
  () => null,
];

function reasonsFor(b: LeagueBundle, x: number[]): string[] {
  const { means, stds, weights } = b.model;
  const contribs = x.map((v, j) => ({
    j,
    v,
    c: weights[j + 1] * ((v - means[j]) / (stds[j] || 1)),
  }));
  return contribs
    .filter((c) => REASON_TEXTS[c.j] !== null && Math.abs(c.c) > 0.01)
    .sort((a, bb) => Math.abs(bb.c) - Math.abs(a.c))
    .slice(0, 3)
    .map((c) => REASON_TEXTS[c.j]!(c.v, c.c > 0))
    .filter((s): s is string => s !== null);
}

export function predictMatch(match: MatchData): Prediction {
  const b = BUNDLES[match.league];
  const h = b.teams[match.homeTeam];
  const a = b.teams[match.awayTeam];
  if (!h || !a) {
    return {
      match, p: b.baseRate, side: 'none', precisionPct: null, reasons: [],
      missingTeam: !h ? match.homeTeam : match.awayTeam,
    };
  }
  const x = features(b, h, a);
  const p = predictP(b, x);
  let side: Prediction['side'] = 'none';
  let precisionPct: number | null = null;
  if (p <= b.thresholds.noDraw) {
    side = 'no-draw';
    precisionPct = b.precision.noDraw;
  } else if (b.drawRecommendable && p >= b.thresholds.draw) {
    side = 'draw';
    precisionPct = b.precision.draw;
  }
  return { match, p, side, precisionPct, reasons: reasonsFor(b, x) };
}

export function predictAll(matches: MatchData[]): Prediction[] {
  return matches
    .map(predictMatch)
    .sort((x, y) => distance(y) - distance(x));
}

/** Recommendation strength: how far past its threshold a pick sits. */
function distance(p: Prediction): number {
  const b = BUNDLES[p.match.league];
  if (p.side === 'no-draw') return b.thresholds.noDraw - p.p;
  if (p.side === 'draw') return p.p - b.thresholds.draw;
  return -1;
}

export function recommendations(preds: Prediction[]): Prediction[] {
  return preds.filter((p) => p.side !== 'none').slice(0, MAX_RECOMMENDATIONS);
}

export function isHtDraw(result: string | undefined): boolean | undefined {
  if (!result) return undefined;
  const m = result.trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return undefined;
  return m[1] === m[2];
}

/** Did a recommendation hit, given the actual HT result? */
export function pickHit(side: Prediction['side'], result: string | undefined): boolean | undefined {
  const draw = isHtDraw(result);
  if (draw === undefined || side === 'none') return undefined;
  return side === 'draw' ? draw : !draw;
}
