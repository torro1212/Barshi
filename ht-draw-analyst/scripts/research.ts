/**
 * Per-league model research for HT-draw prediction, with strict walk-forward
 * validation: for every test season the model is trained only on earlier
 * seasons, and every feature is computed only from matches before the one
 * being predicted.
 *
 *   npx tsx scripts/research.ts <csv-dir> <prefix> [testSeasons]
 *
 * Evaluates BOTH sides of the market out-of-sample:
 *   - picking HT draws  (top of the probability ranking)
 *   - picking NO HT draw (bottom of the ranking)
 * and reports precision at several selectivity levels.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------- data ----------

export interface RawMatch {
  season: string;
  date: string;
  home: string;
  away: string;
  fthg: number;
  ftag: number;
  htDraw: boolean;
}

export function parseCsvDir(dir: string, prefix: string): RawMatch[] {
  const pattern = new RegExp(`^${prefix}_\\d{4}\\.csv$`);
  const files = readdirSync(dir).filter((f) => pattern.test(f)).sort();
  if (files.length === 0) throw new Error(`no ${prefix}_*.csv files in ${dir}`);
  const out: RawMatch[] = [];
  for (const file of files) {
    const season = file.slice(prefix.length + 1, prefix.length + 5);
    const lines = readFileSync(join(dir, file), 'utf8').trim().split(/\r?\n/);
    const header = lines[0].split(',');
    const col = (n: string) => header.indexOf(n);
    const [iD, iH, iA, iFh, iFa, iG, iAg] = [
      col('Date'), col('HomeTeam'), col('AwayTeam'), col('FTHG'), col('FTAG'), col('HTHG'), col('HTAG'),
    ];
    for (const line of lines.slice(1)) {
      const c = line.split(',');
      if (c.length < 8 || !c[iD]) continue;
      const hthg = Number(c[iG]);
      const htag = Number(c[iAg]);
      if (Number.isNaN(hthg) || Number.isNaN(htag)) continue;
      const d = c[iD].includes('/') ? c[iD].split('/').reverse().join('-') : c[iD];
      out.push({
        season, date: d, home: c[iH], away: c[iA],
        fthg: Number(c[iFh]), ftag: Number(c[iFa]), htDraw: hthg === htag,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- features (point-in-time) ----------

export const FEATURE_NAMES = [
  'ppgGap',        // |home ppg - away ppg| this season
  'strengthSigned',// home ppg - away ppg (signed: home favorite vs underdog)
  'qualitySum',    // home ppg + away ppg
  'tempo',         // combined goals/game, last 10 each
  'attack',        // combined goals scored/game, last 10
  'defenseLeaky',  // combined goals conceded/game, last 10
  'tempoGapInter', // tempo * ppgGap interaction
  'posDiffNorm',   // |table position diff| / teams
  'htRateAvg',     // avg of home team's home HT-draw rate and away team's away rate (last 15)
  'htRateDiff',    // |home rate - away rate|
  'recentHt',      // HT draws in last 6, both teams (0-12)
  'gamesSinceMax', // max games since an HT draw
  'h2hRate',       // shrunk H2H HT-draw rate (last 10 meetings)
  'restDiff',      // |rest days home - away|, capped
  'seasonPhase',   // fraction of season elapsed
] as const;

interface Sample {
  season: string;
  date: string;
  home: string;
  away: string;
  x: number[];
  y: number; // 1 = HT draw
}

export function buildSamples(matches: RawMatch[], baseRate: number): Sample[] {
  interface TS {
    homeHt: boolean[]; awayHt: boolean[]; recent: boolean[];
    since: number; pts: number; played: number;
    goals: number[]; gf: number[]; ga: number[]; lastDate: string | null;
  }
  const teams = new Map<string, TS>();
  const h2h = new Map<string, boolean[]>();
  const st = (n: string): TS => {
    let t = teams.get(n);
    if (!t) { t = { homeHt: [], awayHt: [], recent: [], since: 0, pts: 0, played: 0, goals: [], gf: [], ga: [], lastDate: null }; teams.set(n, t); }
    return t;
  };
  const key = (a: string, b: string) => [a, b].sort().join('|');
  const days = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  const pct = (f: boolean[], w: number) => { const s = f.slice(-w); return s.filter(Boolean).length / s.length; };

  let season = '';
  let seasonIdx = 0;
  let seasonTotal = 0;
  const bySeason = new Map<string, number>();
  for (const m of matches) bySeason.set(m.season, (bySeason.get(m.season) ?? 0) + 1);

  const out: Sample[] = [];
  for (const m of matches) {
    if (m.season !== season) {
      season = m.season; seasonIdx = 0; seasonTotal = bySeason.get(season) ?? 1;
      for (const t of teams.values()) { t.pts = 0; t.played = 0; }
    }
    seasonIdx++;
    const h = st(m.home);
    const a = st(m.away);
    const versus = (h2h.get(key(m.home, m.away)) ?? []).slice(-10);

    const enough =
      h.homeHt.length >= 5 && a.awayHt.length >= 5 &&
      h.recent.length >= 6 && a.recent.length >= 6 &&
      h.goals.length >= 10 && a.goals.length >= 10 &&
      h.played >= 4 && a.played >= 4;

    if (enough) {
      const standings = [...teams.entries()].filter(([, t]) => t.played > 0)
        .sort((x, y) => y[1].pts / y[1].played - x[1].pts / x[1].played).map(([n]) => n);
      const nTeams = Math.max(standings.length, 2);
      const pos = (n: string) => { const i = standings.indexOf(n); return i === -1 ? nTeams / 2 : i + 1; };
      const homePpg = h.pts / h.played;
      const awayPpg = a.pts / a.played;
      const ppgGap = Math.abs(homePpg - awayPpg);
      const avg10 = (arr: number[]) => arr.slice(-10).reduce((s, g) => s + g, 0) / Math.min(arr.length, 10);
      const tempo = (avg10(h.goals) + avg10(a.goals)) / 2;
      const rateH = pct(h.homeHt, 15);
      const rateA = pct(a.awayHt, 15);
      const h2hRate = versus.length > 0
        ? (versus.filter(Boolean).length + baseRate * 4) / (versus.length + 4) // shrunk
        : baseRate;
      const restH = h.lastDate ? Math.min(days(h.lastDate, m.date), 14) : 7;
      const restA = a.lastDate ? Math.min(days(a.lastDate, m.date), 14) : 7;
      out.push({
        season: m.season, date: m.date, home: m.home, away: m.away,
        x: [
          ppgGap,
          homePpg - awayPpg,
          homePpg + awayPpg,
          tempo,
          avg10(h.gf) + avg10(a.gf),
          avg10(h.ga) + avg10(a.ga),
          tempo * ppgGap,
          Math.abs(pos(m.home) - pos(m.away)) / nTeams,
          (rateH + rateA) / 2,
          Math.abs(rateH - rateA),
          h.recent.slice(-6).filter(Boolean).length + a.recent.slice(-6).filter(Boolean).length,
          Math.max(h.since, a.since),
          h2hRate,
          Math.abs(restH - restA),
          seasonIdx / seasonTotal,
        ],
        y: m.htDraw ? 1 : 0,
      });
    }

    h.homeHt.push(m.htDraw); a.awayHt.push(m.htDraw);
    h.recent.push(m.htDraw); a.recent.push(m.htDraw);
    h.since = m.htDraw ? 0 : h.since + 1;
    a.since = m.htDraw ? 0 : a.since + 1;
    h.played++; a.played++;
    if (m.fthg > m.ftag) h.pts += 3; else if (m.fthg < m.ftag) a.pts += 3; else { h.pts++; a.pts++; }
    h.goals.push(m.fthg + m.ftag); a.goals.push(m.fthg + m.ftag);
    h.gf.push(m.fthg); h.ga.push(m.ftag);
    a.gf.push(m.ftag); a.ga.push(m.fthg);
    h.lastDate = m.date; a.lastDate = m.date;
    h2h.set(key(m.home, m.away), [...(h2h.get(key(m.home, m.away)) ?? []), m.htDraw]);
  }
  return out;
}

// ---------- logistic regression ----------

export interface Model {
  means: number[];
  stds: number[];
  weights: number[]; // includes bias at index 0
}

export function trainLogistic(X: number[][], y: number[], l2 = 0.01, epochs = 400, lr = 0.1): Model {
  const n = X.length;
  const d = X[0].length;
  const means = Array(d).fill(0);
  const stds = Array(d).fill(0);
  for (let j = 0; j < d; j++) {
    means[j] = X.reduce((s, r) => s + r[j], 0) / n;
    stds[j] = Math.sqrt(X.reduce((s, r) => s + (r[j] - means[j]) ** 2, 0) / n) || 1;
  }
  const Z = X.map((r) => r.map((v, j) => (v - means[j]) / stds[j]));
  const w = Array(d + 1).fill(0);
  for (let e = 0; e < epochs; e++) {
    const grad = Array(d + 1).fill(0);
    for (let i = 0; i < n; i++) {
      let z = w[0];
      for (let j = 0; j < d; j++) z += w[j + 1] * Z[i][j];
      const p = 1 / (1 + Math.exp(-z));
      const err = p - y[i];
      grad[0] += err;
      for (let j = 0; j < d; j++) grad[j + 1] += err * Z[i][j];
    }
    for (let j = 0; j <= d; j++) {
      const reg = j === 0 ? 0 : l2 * w[j];
      w[j] -= lr * (grad[j] / n + reg);
    }
  }
  return { means, stds, weights: w };
}

export function predict(model: Model, x: number[]): number {
  let z = model.weights[0];
  for (let j = 0; j < x.length; j++) {
    z += model.weights[j + 1] * ((x[j] - model.means[j]) / model.stds[j]);
  }
  return 1 / (1 + Math.exp(-z));
}

// ---------- evaluation ----------

function precisionReport(scored: { p: number; y: number }[], label: string): void {
  const sorted = [...scored].sort((a, b) => b.p - a.p);
  const n = sorted.length;
  const base = scored.reduce((s, r) => s + r.y, 0) / n;
  console.log(`  ${label}: n=${n}, base HT draw ${(base * 100).toFixed(1)}%`);
  for (const frac of [0.05, 0.1, 0.2, 0.3]) {
    const k = Math.max(1, Math.round(n * frac));
    const top = sorted.slice(0, k);
    const bot = sorted.slice(-k);
    const pTop = top.reduce((s, r) => s + r.y, 0) / k;
    const pBot = bot.filter((r) => r.y === 0).length / k;
    console.log(
      `    top ${String(frac * 100).padStart(2)}% (${String(k).padStart(3)} picks): DRAW ${(pTop * 100).toFixed(1)}%` +
      `  |  bottom ${String(frac * 100).padStart(2)}%: NO-DRAW ${(pBot * 100).toFixed(1)}%`,
    );
  }
}

function main() {
  const dir = process.argv[2];
  const prefix = process.argv[3];
  if (!dir || !prefix) {
    console.error('usage: npx tsx scripts/research.ts <csv-dir> <prefix> [nTestSeasons]');
    process.exit(1);
  }
  const nTest = Number(process.argv[4] ?? 3);
  const matches = parseCsvDir(dir, prefix);
  const seasons = [...new Set(matches.map((m) => m.season))].sort();
  const base = matches.filter((m) => m.htDraw).length / matches.length;
  console.log(`${prefix}: ${matches.length} matches, ${seasons.length} seasons (${seasons[0]}..${seasons[seasons.length - 1]}), base ${(base * 100).toFixed(1)}%`);

  const samples = buildSamples(matches, base);
  const testSeasons = seasons.slice(-nTest);

  const all: { p: number; y: number }[] = [];
  for (const ts of testSeasons) {
    const train = samples.filter((s) => s.season < ts);
    const test = samples.filter((s) => s.season === ts);
    if (train.length < 300 || test.length === 0) {
      console.log(`  ${ts}: skipped (train=${train.length})`);
      continue;
    }
    const model = trainLogistic(train.map((s) => s.x), train.map((s) => s.y));
    const scored = test.map((s) => ({ p: predict(model, s.x), y: s.y }));
    precisionReport(scored, `season ${ts} (trained on ${train.length})`);
    all.push(...scored);
  }
  if (all.length > 0) {
    console.log('');
    precisionReport(all, `ALL TEST SEASONS COMBINED`);
    console.log('\n  by absolute probability threshold (all test seasons):');
    for (const t of [0.32, 0.34, 0.36, 0.38, 0.4]) {
      const g = all.filter((r) => r.p <= t);
      if (g.length === 0) continue;
      const prec = g.filter((r) => r.y === 0).length / g.length;
      console.log(`    P<=${t.toFixed(2)}: NO-DRAW ${(prec * 100).toFixed(1)}% (${g.length} picks, ${(g.length / all.length * 100).toFixed(0)}%)`);
    }
    for (const t of [0.44, 0.46, 0.48, 0.5, 0.52]) {
      const g = all.filter((r) => r.p >= t);
      if (g.length === 0) continue;
      const prec = g.filter((r) => r.y === 1).length / g.length;
      console.log(`    P>=${t.toFixed(2)}: DRAW ${(prec * 100).toFixed(1)}% (${g.length} picks, ${(g.length / all.length * 100).toFixed(0)}%)`);
    }
  }

  // final model on all data (for the app) + feature weights
  const model = trainLogistic(samples.map((s) => s.x), samples.map((s) => s.y));
  console.log('\nfeature weights (standardized, full data):');
  FEATURE_NAMES.forEach((f, i) => {
    console.log(`  ${f.padEnd(14)} ${model.weights[i + 1].toFixed(4)}`);
  });
  console.log(`  bias           ${model.weights[0].toFixed(4)}`);
  console.log('\nmodel JSON (for embedding):');
  console.log(JSON.stringify({ means: model.means, stds: model.stds, weights: model.weights }));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  main();
}
