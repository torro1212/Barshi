/**
 * Martingale simulation over the tool's real chronological pick sequence:
 * base stake, multiplied by X after every losing pick, reset after a win.
 *
 *   npx tsx scripts/simulate-martingale.ts [baseStake]
 *
 * Uses the same blind picks and walk-forward modeled HT-draw odds as
 * scripts/simulate-pnl.ts, replayed as one continuous 3-season sequence
 * (2023-24 → 2025-26) exactly as a real bettor would experience it.
 */
import { readFileSync } from 'node:fs';
import { buildSamples, parseCsvDir, predict, trainLogistic } from './research';

const BASE = Number(process.argv[2] ?? 100);
const THRESHOLD = 0.48;
const MAX_PER_DAY = 6;
const MARGIN = 1.1; // Winner-like

// --- real FT odds ---
interface OddsRow { impD: number; favGap: number; over25: number }
const odds = new Map<string, OddsRow>();
const ODDS_SEASONS = ['2223', '2324', '2425', '2526'];
for (const s of ODDS_SEASONS) {
  const lines = readFileSync(`data-laliga-odds/SP1_${s}.csv`, 'utf8').trim().split(/\r?\n/);
  const h = lines[0].split(',');
  const i = (n: string) => h.indexOf(n);
  const [iD, iH, iA, iAvgH, iAvgD, iAvgA, iO25] = [
    i('Date'), i('HomeTeam'), i('AwayTeam'), i('AvgH'), i('AvgD'), i('AvgA'), i('Avg>2.5'),
  ];
  for (const l of lines.slice(1)) {
    const c = l.split(',');
    if (!c[iD]) continue;
    const d = c[iD].includes('/') ? c[iD].split('/').reverse().join('-') : c[iD];
    const [H, D, A] = [Number(c[iAvgH]), Number(c[iAvgD]), Number(c[iAvgA])];
    if (!H || !D || !A) continue;
    const sum = 1 / H + 1 / D + 1 / A;
    odds.set(`${d}|${c[iH]}|${c[iA]}`, {
      impD: 1 / D / sum,
      favGap: Math.abs(1 / H / sum - 1 / A / sum),
      over25: Number(c[iO25]) ? 1 / Number(c[iO25]) : 0.5,
    });
  }
}

// --- rebuild the blind chronological pick sequence with modeled odds ---
const matches = parseCsvDir('data-laliga', 'SP1');
const baseRate = matches.filter((m) => m.htDraw).length / matches.length;
const samples = buildSamples(matches, baseRate);

interface Bet { date: string; label: string; odd: number; hit: boolean }
const sequence: Bet[] = [];
for (const ts of ODDS_SEASONS.slice(1)) {
  const train = samples.filter((s) => s.season < ts);
  const test = samples.filter((s) => s.season === ts);
  const model = trainLogistic(train.map((s) => s.x), train.map((s) => s.y));
  const calibSeasons = ODDS_SEASONS.filter((s) => s < ts);
  const cx: number[][] = [];
  const cy: number[] = [];
  for (const s of samples.filter((x) => calibSeasons.includes(x.season))) {
    const o = odds.get(`${s.date}|${s.home}|${s.away}`);
    if (o) { cx.push([o.impD, o.favGap, o.over25]); cy.push(s.y); }
  }
  const htMarket = trainLogistic(cx, cy);
  const byDate = new Map<string, { s: (typeof test)[number]; p: number }[]>();
  for (const s of test) {
    const list = byDate.get(s.date) ?? [];
    list.push({ s, p: predict(model, s.x) });
    byDate.set(s.date, list);
  }
  for (const [date, list] of [...byDate.entries()].sort()) {
    const sel = list.filter((x) => x.p >= THRESHOLD).sort((a, b) => b.p - a.p).slice(0, MAX_PER_DAY);
    for (const { s } of sel) {
      const o = odds.get(`${s.date}|${s.home}|${s.away}`);
      if (!o) continue;
      const pMarket = predict(htMarket, [o.impD, o.favGap, o.over25]);
      sequence.push({ date, label: `${s.home} vs ${s.away}`, odd: 1 / pMarket / MARGIN, hit: s.y === 1 });
    }
  }
}

const hits = sequence.filter((b) => b.hit).length;
let maxStreak = 0;
let cur = 0;
for (const b of sequence) {
  cur = b.hit ? 0 : cur + 1;
  maxStreak = Math.max(maxStreak, cur);
}
console.log(
  `sequence: ${sequence.length} picks (2023-24 → 2025-26), ${hits} hits (${((hits / sequence.length) * 100).toFixed(1)}%), longest losing streak: ${maxStreak}`,
);
console.log(`base stake ${BASE}₪, Winner-like margin, avg odds ${(sequence.reduce((a, b) => a + b.odd, 0) / sequence.length).toFixed(2)}\n`);

for (const mult of [2, 2.2, 2.5]) {
  let stake = BASE;
  let pnl = 0;
  let maxStake = 0;
  let seriesCost = 0;
  let maxSeriesCost = 0;
  let minPnl = 0;
  for (const b of sequence) {
    maxStake = Math.max(maxStake, stake);
    seriesCost += stake;
    maxSeriesCost = Math.max(maxSeriesCost, seriesCost);
    if (b.hit) {
      pnl += stake * (b.odd - 1);
      stake = BASE;
      seriesCost = 0;
    } else {
      pnl -= stake;
      stake = Math.round(stake * mult);
    }
    minPnl = Math.min(minPnl, pnl);
  }
  console.log(`multiplier x${mult}:`);
  console.log(`  final P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}₪`);
  console.log(`  biggest single bet you must place: ${maxStake.toLocaleString()}₪`);
  console.log(`  worst series total outlay: ${maxSeriesCost.toLocaleString()}₪`);
  console.log(`  deepest drawdown: ${minPnl.toFixed(0)}₪`);
  for (const bankroll of [5000, 10000, 20000]) {
    // bust check: the moment the required stake exceeds what's left
    let cash = bankroll;
    let st = BASE;
    let busted: string | null = null;
    for (const b of sequence) {
      if (st > cash) { busted = b.date; break; }
      cash -= st;
      if (b.hit) { cash += st * b.odd; st = BASE; } else { st = Math.round(st * mult); }
    }
    console.log(
      busted
        ? `  bankroll ${bankroll.toLocaleString()}₪: BUST on ${busted} (cannot place the required stake)`
        : `  bankroll ${bankroll.toLocaleString()}₪: survives, ends with ${(cash - bankroll >= 0 ? '+' : '')}${(cash - bankroll).toFixed(0)}₪`,
    );
  }
  console.log('');
}
