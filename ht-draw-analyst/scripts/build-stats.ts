/**
 * Build the per-league data bundles the app ships with — real statistics
 * only, computed from the historical CSVs, plus the trained logistic model.
 *
 *   npx tsx scripts/build-stats.ts
 *
 * Reads  data-laliga/SP1_*.csv  and  data-israel/ISR_*.csv
 * Writes src/data/laliga.json   and  src/data/israel.json
 *
 * The recommendation thresholds and their precision figures are the
 * out-of-sample walk-forward results from scripts/research.ts (documented
 * in BACKTEST.md) — they are measured, not aspirational.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSamples, parseCsvDir, trainLogistic, type RawMatch } from './research';

interface TeamSnapshot {
  name: string;
  ppg: number;
  position: number;
  played: number;
  gfAvg: number;
  gaAvg: number;
  tempo: number;
  homeHtRate: number;
  awayHtRate: number;
  recent6: number;
  since: number;
}

function snapshot(matches: RawMatch[]): {
  teams: Record<string, TeamSnapshot>;
  h2h: Record<string, { n: number; draws: number }>;
  season: string;
  lastDate: string;
} {
  interface TS {
    homeHt: boolean[]; awayHt: boolean[]; recent: boolean[];
    since: number; pts: number; played: number; gf: number[]; ga: number[];
  }
  const teams = new Map<string, TS>();
  const h2h = new Map<string, boolean[]>();
  const st = (n: string): TS => {
    let t = teams.get(n);
    if (!t) { t = { homeHt: [], awayHt: [], recent: [], since: 0, pts: 0, played: 0, gf: [], ga: [] }; teams.set(n, t); }
    return t;
  };
  const key = (a: string, b: string) => [a, b].sort().join('|');

  let season = '';
  const lastSeason = matches[matches.length - 1].season;
  const lastSeasonTeams = new Set<string>();
  for (const m of matches) {
    if (m.season === lastSeason) { lastSeasonTeams.add(m.home); lastSeasonTeams.add(m.away); }
  }

  for (const m of matches) {
    if (m.season !== season) {
      season = m.season;
      for (const t of teams.values()) { t.pts = 0; t.played = 0; }
    }
    const h = st(m.home);
    const a = st(m.away);
    h.homeHt.push(m.htDraw); a.awayHt.push(m.htDraw);
    h.recent.push(m.htDraw); a.recent.push(m.htDraw);
    h.since = m.htDraw ? 0 : h.since + 1;
    a.since = m.htDraw ? 0 : a.since + 1;
    h.played++; a.played++;
    if (m.fthg > m.ftag) h.pts += 3; else if (m.fthg < m.ftag) a.pts += 3; else { h.pts++; a.pts++; }
    h.gf.push(m.fthg); h.ga.push(m.ftag);
    a.gf.push(m.ftag); a.ga.push(m.fthg);
    h2h.set(key(m.home, m.away), [...(h2h.get(key(m.home, m.away)) ?? []).slice(-9), m.htDraw]);
  }

  const standings = [...teams.entries()]
    .filter(([n, t]) => lastSeasonTeams.has(n) && t.played > 0)
    .sort((x, y) => y[1].pts / y[1].played - x[1].pts / x[1].played)
    .map(([n]) => n);

  const pct = (f: boolean[], w: number) => { const s = f.slice(-w); return s.length ? s.filter(Boolean).length / s.length : 0.4; };
  const avg10 = (arr: number[]) => { const s = arr.slice(-10); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : 1.3; };

  const out: Record<string, TeamSnapshot> = {};
  for (const name of lastSeasonTeams) {
    const t = teams.get(name)!;
    out[name] = {
      name,
      ppg: t.played > 0 ? Math.round((t.pts / t.played) * 100) / 100 : 1,
      position: standings.indexOf(name) + 1 || standings.length,
      played: t.played,
      gfAvg: Math.round(avg10(t.gf) * 100) / 100,
      gaAvg: Math.round(avg10(t.ga) * 100) / 100,
      tempo: Math.round((avg10(t.gf) + avg10(t.ga)) * 100) / 100,
      homeHtRate: Math.round(pct(t.homeHt, 15) * 1000) / 1000,
      awayHtRate: Math.round(pct(t.awayHt, 15) * 1000) / 1000,
      recent6: t.recent.slice(-6).filter(Boolean).length,
      since: t.since,
    };
  }
  const h2hOut: Record<string, { n: number; draws: number }> = {};
  for (const [k, flags] of h2h) {
    const [a, b] = k.split('|');
    if (lastSeasonTeams.has(a) && lastSeasonTeams.has(b)) {
      h2hOut[k] = { n: flags.length, draws: flags.filter(Boolean).length };
    }
  }
  return { teams: out, h2h: h2hOut, season: lastSeason, lastDate: matches[matches.length - 1].date };
}

interface LeagueSpec {
  league: string;
  dir: string;
  prefix: string;
  nTeams: number;
  // measured out-of-sample (walk-forward) — see BACKTEST.md
  thresholds: { noDraw: number; draw: number };
  precision: { noDraw: number; draw: number };
  drawRecommendable: boolean;
  testedOn: string;
}

const SPECS: LeagueSpec[] = [
  {
    league: 'laliga', dir: 'data-laliga', prefix: 'SP1', nTeams: 20,
    thresholds: { noDraw: 0.38, draw: 0.48 },
    precision: { noDraw: 64.7, draw: 50.6 },
    drawRecommendable: true,
    testedOn: '4 עונות מבחן (2022-2026), 1,351 משחקים מחוץ למדגם',
  },
  {
    league: 'israel', dir: 'data-israel', prefix: 'ISR', nTeams: 14,
    thresholds: { noDraw: 0.36, draw: 0.48 },
    precision: { noDraw: 62.0, draw: 44.0 },
    drawRecommendable: true,
    testedOn: 'עונת מבחן 2024-25, 203 משחקים מחוץ למדגם',
  },
];

for (const spec of SPECS) {
  const matches = parseCsvDir(join(process.cwd(), spec.dir), spec.prefix);
  const baseRate = matches.filter((m) => m.htDraw).length / matches.length;
  const samples = buildSamples(matches, baseRate);
  const model = trainLogistic(samples.map((s) => s.x), samples.map((s) => s.y));
  const snap = snapshot(matches);
  const bundle = {
    league: spec.league,
    baseRate: Math.round(baseRate * 1000) / 1000,
    nTeams: spec.nTeams,
    season: snap.season,
    lastDate: snap.lastDate,
    matches: matches.length,
    teams: snap.teams,
    h2h: snap.h2h,
    model: {
      means: model.means.map((v) => Math.round(v * 1e6) / 1e6),
      stds: model.stds.map((v) => Math.round(v * 1e6) / 1e6),
      weights: model.weights.map((v) => Math.round(v * 1e6) / 1e6),
    },
    thresholds: spec.thresholds,
    precision: spec.precision,
    drawRecommendable: spec.drawRecommendable,
    testedOn: spec.testedOn,
  };
  const file = join(process.cwd(), 'src', 'data', `${spec.league}.json`);
  writeFileSync(file, JSON.stringify(bundle));
  console.log(`${file}: ${Object.keys(snap.teams).length} teams, ${matches.length} matches, base ${(baseRate * 100).toFixed(1)}%`);
}
