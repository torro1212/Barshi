/**
 * Blind verification of the app's exact recommendation policy on past
 * seasons: which matches would the tool have recommended as HT draws, and
 * how many actually ended level at half-time.
 *
 *   npx tsx scripts/verify-picks.ts <csv-dir> <prefix> [nTestSeasons]
 *
 * Blindness guarantees:
 *   1. Every feature is computed only from matches BEFORE the one being
 *      predicted (point-in-time, enforced in buildSamples).
 *   2. For each test season the model is trained only on EARLIER seasons.
 *   3. The actual HT result is looked at only AFTER the pick is made.
 *
 * Pick policy = the app's: P(HT draw) >= 0.48, at most 6 picks per calendar
 * day, sorted by probability.
 */
import { buildSamples, parseCsvDir, predict, trainLogistic } from './research';

const THRESHOLD = 0.48;
const MAX_PER_DAY = 6;

const dir = process.argv[2];
const prefix = process.argv[3];
if (!dir || !prefix) {
  console.error('usage: npx tsx scripts/verify-picks.ts <csv-dir> <prefix> [nTestSeasons]');
  process.exit(1);
}
const nTest = Number(process.argv[4] ?? 4);

const matches = parseCsvDir(dir, prefix);
const seasons = [...new Set(matches.map((m) => m.season))].sort();
const baseRate = matches.filter((m) => m.htDraw).length / matches.length;
const samples = buildSamples(matches, baseRate);
const testSeasons = seasons.slice(-nTest);

interface Pick {
  season: string;
  date: string;
  home: string;
  away: string;
  p: number;
  htDraw: boolean;
}

const allPicks: Pick[] = [];
let evaluated = 0;
let evaluatedDraws = 0;

console.log(`${prefix}: ${matches.length} matches, base HT-draw rate ${(baseRate * 100).toFixed(1)}%`);
console.log(`policy: recommend when P >= ${THRESHOLD}, max ${MAX_PER_DAY}/day\n`);

for (const ts of testSeasons) {
  const train = samples.filter((s) => s.season < ts);
  const test = samples.filter((s) => s.season === ts);
  if (train.length < 300 || test.length === 0) {
    console.log(`season ${ts}: skipped (not enough earlier data to train on: ${train.length})`);
    continue;
  }
  const model = trainLogistic(train.map((s) => s.x), train.map((s) => s.y));

  // group by day, pick like the app does — WITHOUT looking at outcomes
  const byDate = new Map<string, { s: (typeof test)[number]; p: number }[]>();
  for (const s of test) {
    const p = predict(model, s.x);
    const list = byDate.get(s.date) ?? [];
    list.push({ s, p });
    byDate.set(s.date, list);
  }
  const picks: Pick[] = [];
  for (const [date, list] of byDate) {
    const selected = list
      .filter((x) => x.p >= THRESHOLD)
      .sort((a, b) => b.p - a.p)
      .slice(0, MAX_PER_DAY);
    for (const { s, p } of selected) {
      // outcome revealed only now, after the pick is locked in
      picks.push({ season: ts, date, home: s.home, away: s.away, p, htDraw: s.y === 1 });
    }
  }
  picks.sort((a, b) => a.date.localeCompare(b.date));
  const hits = picks.filter((x) => x.htDraw).length;
  const seasonBase = test.filter((s) => s.y === 1).length / test.length;
  evaluated += test.length;
  evaluatedDraws += test.filter((s) => s.y === 1).length;
  console.log(
    `season ${ts}: ${picks.length} recommendations → ${hits} hits = ${((hits / picks.length) * 100).toFixed(1)}%  (season base ${(seasonBase * 100).toFixed(1)}%, trained on ${train.length} earlier matches)`,
  );
  allPicks.push(...picks);
}

if (allPicks.length > 0) {
  const hits = allPicks.filter((x) => x.htDraw).length;
  console.log(
    `\nTOTAL: ${allPicks.length} recommendations → ${hits} hits = ${((hits / allPicks.length) * 100).toFixed(1)}%` +
      ` | base rate over the same matches: ${((evaluatedDraws / evaluated) * 100).toFixed(1)}%` +
      ` | edge: +${(((hits / allPicks.length) - evaluatedDraws / evaluated) * 100).toFixed(1)}pp`,
  );

  console.log(`\nlast 15 picks (date, match, P at pick time → actual):`);
  for (const x of allPicks.slice(-15)) {
    console.log(
      `  ${x.date}  ${x.home} vs ${x.away}  P=${(x.p * 100).toFixed(0)}%  → ${x.htDraw ? '✓ HT DRAW' : '✗ no draw'}`,
    );
  }
}
