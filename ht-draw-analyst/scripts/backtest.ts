/**
 * Walk-forward backtest of the HT Draw Analyst algorithm on real historical
 * results (football-data.co.uk CSV format: Date,HomeTeam,AwayTeam,...,HTHG,HTAG).
 *
 * For every match, team/H2H features are computed ONLY from matches played
 * before it — the model never sees the result it is predicting. Usage:
 *
 *   npx tsx scripts/backtest.ts <csv-dir> [prefix]
 *
 * where <csv-dir> contains season files named <PREFIX>_2122.csv,
 * <PREFIX>_2223.csv, ... — e.g. SP1 for La Liga (default) or ISR for
 * Ligat Ha'al (produced by scripts/fetch-israel.ts). The last two seasons
 * are held out as the test set for the weight-optimization comparison.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_WEIGHTS, MAX_RECOMMENDATIONS, scoreMatch } from './algorithm-v1';
import type { MatchData, Weights } from './algorithm-v1';

interface RawMatch {
  season: string;
  date: string;
  home: string;
  away: string;
  fthg: number;
  ftag: number;
  htDraw: boolean;
}

interface TeamState {
  homeHt: boolean[]; // HT-draw flags, home matches, oldest→newest
  awayHt: boolean[];
  recent: boolean[]; // all matches
  gamesSinceHtDraw: number;
  seasonPoints: number;
  seasonPlayed: number;
}

function parseCsvDir(dir: string, prefix: string): RawMatch[] {
  const pattern = new RegExp(`^${prefix}_\\d{4}\\.csv$`);
  const files = readdirSync(dir).filter((f) => pattern.test(f)).sort();
  if (files.length === 0) throw new Error(`no ${prefix}_*.csv files in ${dir}`);
  const out: RawMatch[] = [];
  for (const file of files) {
    const season = file.slice(prefix.length + 1, prefix.length + 5);
    const lines = readFileSync(join(dir, file), 'utf8').trim().split(/\r?\n/);
    const header = lines[0].split(',');
    const col = (name: string) => header.indexOf(name);
    const [iDate, iHome, iAway, iFthg, iFtag, iHthg, iHtag] = [
      col('Date'), col('HomeTeam'), col('AwayTeam'), col('FTHG'), col('FTAG'), col('HTHG'), col('HTAG'),
    ];
    for (const line of lines.slice(1)) {
      const c = line.split(',');
      if (c.length < header.length || !c[iDate]) continue;
      const hthg = Number(c[iHthg]);
      const htag = Number(c[iHtag]);
      if (Number.isNaN(hthg) || Number.isNaN(htag)) continue;
      // dates are either YYYY-MM-DD or DD/MM/YYYY
      const d = c[iDate].includes('/')
        ? c[iDate].split('/').reverse().join('-')
        : c[iDate];
      out.push({
        season,
        date: d,
        home: c[iHome],
        away: c[iAway],
        fthg: Number(c[iFthg]),
        ftag: Number(c[iFtag]),
        htDraw: hthg === htag,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

interface Sample {
  raw: RawMatch;
  features: MatchData;
}

function pct(flags: boolean[], window: number): number {
  const w = flags.slice(-window);
  return Math.round((w.filter(Boolean).length / w.length) * 100);
}

/** Build point-in-time features for every match with enough prior history. */
function buildSamples(matches: RawMatch[]): Sample[] {
  const teams = new Map<string, TeamState>();
  const h2h = new Map<string, boolean[]>();
  const state = (name: string): TeamState => {
    let t = teams.get(name);
    if (!t) {
      t = { homeHt: [], awayHt: [], recent: [], gamesSinceHtDraw: 0, seasonPoints: 0, seasonPlayed: 0 };
      teams.set(name, t);
    }
    return t;
  };
  const h2hKey = (a: string, b: string) => [a, b].sort().join('|');

  let currentSeason = '';
  const samples: Sample[] = [];

  for (const m of matches) {
    if (m.season !== currentSeason) {
      currentSeason = m.season;
      for (const t of teams.values()) {
        t.seasonPoints = 0;
        t.seasonPlayed = 0;
      }
    }
    const home = state(m.home);
    const away = state(m.away);
    const versus = h2h.get(h2hKey(m.home, m.away)) ?? [];

    // enough history? (≥5 home/away matches, full last-6, standings ≥4 rounds)
    const enough =
      home.homeHt.length >= 5 &&
      away.awayHt.length >= 5 &&
      home.recent.length >= 6 &&
      away.recent.length >= 6 &&
      home.seasonPlayed >= 4 &&
      away.seasonPlayed >= 4;

    if (enough) {
      const standings = [...teams.entries()]
        .filter(([, t]) => t.seasonPlayed > 0)
        .sort((a, b) => b[1].seasonPoints - a[1].seasonPoints)
        .map(([name]) => name);
      const posOf = (name: string) => {
        const i = standings.indexOf(name);
        return i === -1 ? 10 : Math.min(20, i + 1);
      };
      const recentH2h = versus.slice(-10);
      samples.push({
        raw: m,
        features: {
          id: `${m.date}-${m.home}-${m.away}`,
          league: 'laliga',
          date: m.date,
          time: '21:00',
          homeTeam: m.home,
          awayTeam: m.away,
          homeHtDrawPct: pct(home.homeHt, 15),
          awayHtDrawPct: pct(away.awayHt, 15),
          h2hMatchesCount: recentH2h.length,
          h2hHtDraws: recentH2h.filter(Boolean).length,
          homeRecentHtDraws: home.recent.slice(-6).filter(Boolean).length,
          awayRecentHtDraws: away.recent.slice(-6).filter(Boolean).length,
          homeGamesSinceHtDraw: home.gamesSinceHtDraw,
          awayGamesSinceHtDraw: away.gamesSinceHtDraw,
          homeTablePosition: posOf(m.home),
          awayTablePosition: posOf(m.away),
        },
      });
    }

    // update state AFTER building the sample
    home.homeHt.push(m.htDraw);
    away.awayHt.push(m.htDraw);
    home.recent.push(m.htDraw);
    away.recent.push(m.htDraw);
    home.gamesSinceHtDraw = m.htDraw ? 0 : home.gamesSinceHtDraw + 1;
    away.gamesSinceHtDraw = m.htDraw ? 0 : away.gamesSinceHtDraw + 1;
    home.seasonPlayed++;
    away.seasonPlayed++;
    if (m.fthg > m.ftag) home.seasonPoints += 3;
    else if (m.fthg < m.ftag) away.seasonPoints += 3;
    else {
      home.seasonPoints += 1;
      away.seasonPoints += 1;
    }
    h2h.set(h2hKey(m.home, m.away), [...versus, m.htDraw]);
  }
  return samples;
}

interface EvalResult {
  evaluated: number;
  baseRate: number;
  picks: number;
  hits: number;
  hitRate: number;
  pickDays: number;
  daysWithPicks: number;
}

/** Daily selection exactly like the app: score ≥ threshold, top 6 per day. */
function evaluate(samples: Sample[], weights: Weights, threshold: number): EvalResult {
  const byDate = new Map<string, { s: Sample; total: number }[]>();
  for (const s of samples) {
    const total = scoreMatch(s.features, weights).total;
    const list = byDate.get(s.raw.date) ?? [];
    list.push({ s, total });
    byDate.set(s.raw.date, list);
  }
  let picks = 0;
  let hits = 0;
  let daysWithPicks = 0;
  for (const list of byDate.values()) {
    const selected = list
      .filter((x) => x.total >= threshold)
      .sort((a, b) => b.total - a.total)
      .slice(0, MAX_RECOMMENDATIONS);
    if (selected.length > 0) daysWithPicks++;
    picks += selected.length;
    hits += selected.filter((x) => x.s.raw.htDraw).length;
  }
  const draws = samples.filter((s) => s.raw.htDraw).length;
  return {
    evaluated: samples.length,
    baseRate: Math.round((draws / samples.length) * 1000) / 10,
    picks,
    hits,
    hitRate: picks > 0 ? Math.round((hits / picks) * 1000) / 10 : 0,
    pickDays: byDate.size,
    daysWithPicks,
  };
}

function bucketCalibration(samples: Sample[], weights: Weights): void {
  const buckets: { name: string; min: number; max: number }[] = [
    { name: '75+  (TOP PICK)', min: 75, max: 101 },
    { name: '60-74 (המלצה טובה)', min: 60, max: 75 },
    { name: '45-59 (על הגבול)', min: 45, max: 60 },
    { name: '<45  (לא מומלץ)', min: -1, max: 45 },
  ];
  for (const b of buckets) {
    const inB = samples.filter((s) => {
      const t = scoreMatch(s.features, weights).total;
      return t >= b.min && t < b.max;
    });
    const draws = inB.filter((s) => s.raw.htDraw).length;
    const rate = inB.length > 0 ? Math.round((draws / inB.length) * 1000) / 10 : 0;
    console.log(`  ${b.name.padEnd(22)} ${String(inB.length).padStart(4)} matches → ${rate}% HT draws`);
  }
}

function* weightGrid(): Generator<Weights> {
  const step = 0.05;
  for (let p = 0.2; p <= 0.5001; p += step) {
    for (let h = 0.1; h <= 0.35001; h += step) {
      for (let f = 0.15; f <= 0.40001; f += step) {
        const s = Math.round((1 - p - h - f) * 100) / 100;
        if (s >= 0.1 && s <= 0.35) {
          yield { profile: Math.round(p * 100) / 100, h2h: Math.round(h * 100) / 100, form: Math.round(f * 100) / 100, streaks: s };
        }
      }
    }
  }
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: npx tsx scripts/backtest.ts <csv-dir> [prefix]');
    process.exit(1);
  }
  const prefix = process.argv[3] ?? 'SP1';
  const matches = parseCsvDir(dir, prefix);
  const seasons = [...new Set(matches.map((m) => m.season))].sort();
  console.log(`Loaded ${matches.length} matches, seasons: ${seasons.join(', ')}`);
  const allDraws = matches.filter((m) => m.htDraw).length;
  console.log(`Overall HT draw base rate: ${((allDraws / matches.length) * 100).toFixed(1)}%\n`);

  const samples = buildSamples(matches);

  console.log('=== Walk-forward, default weights (35/20/25/20), threshold 50 ===');
  for (const season of seasons) {
    const s = samples.filter((x) => x.raw.season === season);
    if (s.length === 0) continue;
    const r = evaluate(s, DEFAULT_WEIGHTS, 50);
    console.log(
      `  ${season}: ${r.evaluated} evaluated | base ${r.baseRate}% | picks ${r.picks} (${r.daysWithPicks}/${r.pickDays} days) | hits ${r.hits} | hit rate ${r.hitRate}%`,
    );
  }
  const overall = evaluate(samples, DEFAULT_WEIGHTS, 50);
  console.log(
    `  TOTAL: ${overall.evaluated} evaluated | base ${overall.baseRate}% | picks ${overall.picks} | hit rate ${overall.hitRate}% (edge ${(overall.hitRate - overall.baseRate).toFixed(1)}pp)\n`,
  );

  console.log('=== Calibration by score bucket (all seasons, default weights) ===');
  bucketCalibration(samples, DEFAULT_WEIGHTS);

  console.log('\n=== Threshold sweep (default weights, all seasons) ===');
  for (const t of [50, 55, 60, 65, 70]) {
    const r = evaluate(samples, DEFAULT_WEIGHTS, t);
    console.log(
      `  threshold ${t}: picks ${String(r.picks).padStart(4)} | hit rate ${r.hitRate}% (edge ${(r.hitRate - r.baseRate).toFixed(1)}pp)`,
    );
  }

  // Train on all but the last two seasons, test out-of-sample on the rest.
  const testSeasons = seasons.slice(-2);
  const train = samples.filter((s) => !testSeasons.includes(s.raw.season));
  const test = samples.filter((s) => testSeasons.includes(s.raw.season));
  console.log(`\n=== Weight optimization: train ${seasons.slice(0, -2).join(',')} → test ${testSeasons.join(',')} ===`);
  let best: { w: Weights; t: number; score: number } | null = null;
  for (const w of weightGrid()) {
    for (const t of [50, 55, 60, 65]) {
      const r = evaluate(train, w, t);
      if (r.picks < 60) continue; // demand a usable volume of picks
      const score = r.hitRate;
      if (!best || score > best.score) best = { w, t, score };
    }
  }
  if (best) {
    console.log(
      `  best on train: profile ${best.w.profile} / h2h ${best.w.h2h} / form ${best.w.form} / streaks ${best.w.streaks}, threshold ${best.t} → ${best.score}% hit rate`,
    );
    const testDefault = evaluate(test, DEFAULT_WEIGHTS, 50);
    const testBest = evaluate(test, best.w, best.t);
    console.log(`  test, default weights: picks ${testDefault.picks} | hit rate ${testDefault.hitRate}% | base ${testDefault.baseRate}%`);
    console.log(`  test, trained weights: picks ${testBest.picks} | hit rate ${testBest.hitRate}% | base ${testBest.baseRate}%`);
  }
}

main();
