/**
 * Money simulation: what a flat-stake bettor following the tool's exact
 * picks would have won or lost, using modeled HT-draw market odds.
 *
 *   npx tsx scripts/simulate-pnl.ts [stake]
 *
 * Real historical HT-market quotes do not exist publicly, so the market
 * odds are modeled: a logistic estimator maps each match's REAL FT 1X2
 * odds (data-laliga-odds/) to the HT-draw probability the market would
 * have priced, then a bookmaker margin is applied. The estimator is
 * calibrated walk-forward — for every season it is trained only on
 * earlier seasons' odds and outcomes, so no future information leaks.
 *
 * Picks are the app's exact policy: P(HT draw) >= 0.48, max 6/day.
 */
import { readFileSync } from 'node:fs';
import { buildSamples, parseCsvDir, predict, trainLogistic } from './research';

const STAKE = Number(process.argv[2] ?? 100);
const THRESHOLD = 0.48;
const MAX_PER_DAY = 6;
const EURO_MARGIN = 1.07; // typical European book 3-way margin share
const WINNER_MARGIN = 1.1; // Winner-like margin share

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

// --- model + samples ---
const matches = parseCsvDir('data-laliga', 'SP1');
const baseRate = matches.filter((m) => m.htDraw).length / matches.length;
const samples = buildSamples(matches, baseRate);

console.log(`stake: ${STAKE}₪ flat per pick | picks: P>=${THRESHOLD}, max ${MAX_PER_DAY}/day`);
console.log(`HT-market odds are MODELED from real FT odds (walk-forward calibrated)\n`);

let grand = { picks: 0, hits: 0, euro: 0, winner: 0 };
for (const ts of ODDS_SEASONS.slice(1)) {
  // pick model: trained on all result-seasons before ts (12-season history)
  const train = samples.filter((s) => s.season < ts);
  const test = samples.filter((s) => s.season === ts);
  const model = trainLogistic(train.map((s) => s.x), train.map((s) => s.y));

  // odds estimator: calibrated on odds seasons before ts only
  const calibSeasons = ODDS_SEASONS.filter((s) => s < ts);
  const calibX: number[][] = [];
  const calibY: number[] = [];
  for (const s of samples.filter((x) => calibSeasons.includes(x.season))) {
    const o = odds.get(`${s.date}|${s.home}|${s.away}`);
    if (o) {
      calibX.push([o.impD, o.favGap, o.over25]);
      calibY.push(s.y);
    }
  }
  const htMarket = trainLogistic(calibX, calibY);

  // daily picks, blind
  const byDate = new Map<string, { s: (typeof test)[number]; p: number }[]>();
  for (const s of test) {
    const list = byDate.get(s.date) ?? [];
    list.push({ s, p: predict(model, s.x) });
    byDate.set(s.date, list);
  }
  let seasonPicks = 0;
  let seasonHits = 0;
  let pnlEuro = 0;
  let pnlWinner = 0;
  const detail: string[] = [];
  for (const [date, list] of [...byDate.entries()].sort()) {
    const selected = list.filter((x) => x.p >= THRESHOLD).sort((a, b) => b.p - a.p).slice(0, MAX_PER_DAY);
    for (const { s } of selected) {
      const o = odds.get(`${s.date}|${s.home}|${s.away}`);
      if (!o) continue;
      const pMarket = predict(htMarket, [o.impD, o.favGap, o.over25]);
      const oddEuro = 1 / pMarket / EURO_MARGIN;
      const oddWinner = 1 / pMarket / WINNER_MARGIN;
      const hit = s.y === 1; // outcome revealed only after the pick
      seasonPicks++;
      if (hit) seasonHits++;
      pnlEuro += hit ? STAKE * (oddEuro - 1) : -STAKE;
      pnlWinner += hit ? STAKE * (oddWinner - 1) : -STAKE;
      if (ts === '2526') {
        detail.push(
          `  ${date}  ${s.home} vs ${s.away}  odds~${oddWinner.toFixed(2)}  ${hit ? `✓ +${(STAKE * (oddWinner - 1)).toFixed(0)}₪` : `✗ -${STAKE}₪`}`,
        );
      }
    }
  }
  const invested = seasonPicks * STAKE;
  console.log(
    `season ${ts}: ${seasonPicks} bets (${invested}₪ total) | ${seasonHits} hits (${((seasonHits / seasonPicks) * 100).toFixed(1)}%)` +
      ` | P&L euro-book: ${pnlEuro >= 0 ? '+' : ''}${pnlEuro.toFixed(0)}₪ (${((pnlEuro / invested) * 100).toFixed(1)}%)` +
      ` | winner-like: ${pnlWinner >= 0 ? '+' : ''}${pnlWinner.toFixed(0)}₪ (${((pnlWinner / invested) * 100).toFixed(1)}%)`,
  );
  if (detail.length) console.log(detail.join('\n'));
  grand.picks += seasonPicks;
  grand.hits += seasonHits;
  grand.euro += pnlEuro;
  grand.winner += pnlWinner;
}
const investedAll = grand.picks * STAKE;
console.log(
  `\nTOTAL (3 seasons): ${grand.picks} bets, ${investedAll}₪ staked | ${grand.hits} hits (${((grand.hits / grand.picks) * 100).toFixed(1)}%)` +
    `\n  euro-book:   ${grand.euro >= 0 ? '+' : ''}${grand.euro.toFixed(0)}₪  (ROI ${((grand.euro / investedAll) * 100).toFixed(1)}%)` +
    `\n  winner-like: ${grand.winner >= 0 ? '+' : ''}${grand.winner.toFixed(0)}₪  (ROI ${((grand.winner / investedAll) * 100).toFixed(1)}%)`,
);
