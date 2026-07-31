/**
 * Losing-streak analysis over the tool's real chronological picks.
 *
 *   npx tsx scripts/streaks.ts <csv-dir> <prefix> [nTestSeasons]
 *
 * Same blind policy as scripts/verify-picks.ts: point-in-time features,
 * model trained only on earlier seasons, outcome revealed after the pick.
 * Reports the longest run without a hit, where it happened, the full run
 * distribution, and how likely such a run is at the observed hit rate.
 */
import { buildSamples, parseCsvDir, predict, trainLogistic } from './research';

const THRESHOLD = 0.48;
const MAX_PER_DAY = 6;

const dir = process.argv[2];
const prefix = process.argv[3];
if (!dir || !prefix) {
  console.error('usage: npx tsx scripts/streaks.ts <csv-dir> <prefix> [nTestSeasons]');
  process.exit(1);
}
const nTest = Number(process.argv[4] ?? 4);

const matches = parseCsvDir(dir, prefix);
const seasons = [...new Set(matches.map((m) => m.season))].sort();
const baseRate = matches.filter((m) => m.htDraw).length / matches.length;
const samples = buildSamples(matches, baseRate);

interface Pick { date: string; label: string; hit: boolean }
const seq: Pick[] = [];
for (const ts of seasons.slice(-nTest)) {
  const train = samples.filter((s) => s.season < ts);
  const test = samples.filter((s) => s.season === ts);
  if (train.length < 300 || test.length === 0) continue;
  const model = trainLogistic(train.map((s) => s.x), train.map((s) => s.y));
  const byDate = new Map<string, { s: (typeof test)[number]; p: number }[]>();
  for (const s of test) {
    const list = byDate.get(s.date) ?? [];
    list.push({ s, p: predict(model, s.x) });
    byDate.set(s.date, list);
  }
  for (const [date, list] of [...byDate.entries()].sort()) {
    for (const { s } of list.filter((x) => x.p >= THRESHOLD).sort((a, b) => b.p - a.p).slice(0, MAX_PER_DAY)) {
      seq.push({ date, label: `${s.home} vs ${s.away}`, hit: s.y === 1 });
    }
  }
}

const hits = seq.filter((p) => p.hit).length;
const hitRate = hits / seq.length;
console.log(`${prefix}: ${seq.length} picks, ${hits} hits (${(hitRate * 100).toFixed(1)}%)\n`);

// all losing runs
interface Run { len: number; from: string; to: string; picks: Pick[] }
const runs: Run[] = [];
let cur: Pick[] = [];
for (const p of seq) {
  if (p.hit) {
    if (cur.length) runs.push({ len: cur.length, from: cur[0].date, to: cur[cur.length - 1].date, picks: [...cur] });
    cur = [];
  } else {
    cur.push(p);
  }
}
if (cur.length) runs.push({ len: cur.length, from: cur[0].date, to: cur[cur.length - 1].date, picks: [...cur] });

const longest = runs.reduce((a, b) => (b.len > a.len ? b : a), runs[0]);
console.log(`LONGEST LOSING STREAK: ${longest.len} picks in a row (${longest.from} → ${longest.to})`);
for (const p of longest.picks) console.log(`   ✗ ${p.date}  ${p.label}`);

const dist = new Map<number, number>();
for (const r of runs) dist.set(r.len, (dist.get(r.len) ?? 0) + 1);
console.log(`\nlosing-run distribution (${runs.length} runs total):`);
for (const len of [...dist.keys()].sort((a, b) => a - b)) {
  console.log(`   ${String(len).padStart(2)} in a row: ${'█'.repeat(dist.get(len)!)} (${dist.get(len)})`);
}

// longest winning run, for context
let wRun = 0;
let wBest = 0;
for (const p of seq) { wRun = p.hit ? wRun + 1 : 0; wBest = Math.max(wBest, wRun); }
console.log(`\nlongest winning streak: ${wBest}`);

// probability of seeing a run of length L somewhere in n picks (simulation)
const q = 1 - hitRate;
const trials = 200000;
const probOfRun = (L: number): number => {
  let seen = 0;
  for (let t = 0; t < trials; t++) {
    let run = 0;
    let found = false;
    for (let i = 0; i < seq.length; i++) {
      run = Math.random() < q ? run + 1 : 0;
      if (run >= L) { found = true; break; }
    }
    if (found) seen++;
  }
  return seen / trials;
};
console.log(`\nchance of hitting a streak of at least L somewhere in ${seq.length} picks (at ${(hitRate * 100).toFixed(1)}% hit rate):`);
for (const L of [5, 6, 7, 8, 9, 10, 12]) {
  console.log(`   ${String(L).padStart(2)} losses in a row: ${(probOfRun(L) * 100).toFixed(1)}%`);
}
console.log(`\nper full season (~${Math.round(seq.length / nTest)} picks), expect roughly one run of ${longest.len - 1}-${longest.len} losses.`);
