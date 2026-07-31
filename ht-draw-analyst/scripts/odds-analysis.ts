import { readFileSync } from 'node:fs';
import { buildSamples, parseCsvDir, trainLogistic, predict } from './research';

// --- load real bookmaker odds (4 seasons) ---
interface OddsRow { avgD: number; impH: number; impD: number; impA: number; over25: number | null }
const odds = new Map<string, OddsRow>();
for (const s of ['2223','2324','2425','2526']) {
  const lines = readFileSync(`data-laliga-odds/SP1_${s}.csv`, 'utf8').trim().split(/\r?\n/);
  const h = lines[0].split(',');
  const i = (n: string) => h.indexOf(n);
  const [iD,iH,iA,iAvgH,iAvgD,iAvgA,iO25] = [i('Date'),i('HomeTeam'),i('AwayTeam'),i('AvgH'),i('AvgD'),i('AvgA'),i('Avg>2.5')];
  for (const l of lines.slice(1)) {
    const c = l.split(','); if (!c[iD]) continue;
    const d = c[iD].includes('/') ? c[iD].split('/').reverse().join('-') : c[iD];
    const [H,D,A] = [Number(c[iAvgH]), Number(c[iAvgD]), Number(c[iAvgA])];
    if (!H || !D || !A) continue;
    const s2 = 1/H + 1/D + 1/A;
    odds.set(`${d}|${c[iH]}|${c[iA]}`, {
      avgD: D,
      impH: (1/H)/s2, impD: (1/D)/s2, impA: (1/A)/s2,
      over25: Number(c[iO25]) ? (1/Number(c[iO25])) : null,
    });
  }
}
console.log(`odds rows loaded: ${odds.size}`);

// --- rebuild walk-forward predictions with the base model (12 seasons of results) ---
const matches = parseCsvDir('data-laliga', 'SP1');
const base = matches.filter((m) => m.htDraw).length / matches.length;
const samples = buildSamples(matches, base);
const testSeasons = ['2223','2324','2425','2526'];

interface Joined { season: string; p: number; y: number; o: OddsRow }
const joined: Joined[] = [];
for (const ts of testSeasons) {
  const train = samples.filter((x) => x.season < ts);
  const test = samples.filter((x) => x.season === ts);
  const model = trainLogistic(train.map((x) => x.x), train.map((x) => x.y));
  for (const t of test) {
    const o = odds.get(`${t.date}|${t.home}|${t.away}`);
    if (o) joined.push({ season: ts, p: predict(model, t.x), y: t.y, o });
  }
}
console.log(`joined (model pred + odds): ${joined.length}\n`);

// --- A: does the market already price our draw picks? ---
const drawPicks = joined.filter((j) => j.p >= 0.48);
const rest = joined.filter((j) => j.p < 0.48);
const avg = (a: number[]) => a.reduce((x,y)=>x+y,0)/a.length;
console.log('A. Market pricing of our DRAW picks (P>=0.48):');
console.log(`   picks: ${drawPicks.length}, HT-draw hit ${(avg(drawPicks.map(j=>j.y))*100).toFixed(1)}%`);
console.log(`   avg market FT-draw odds on picks: ${avg(drawPicks.map(j=>j.o.avgD)).toFixed(2)} vs rest: ${avg(rest.map(j=>j.o.avgD)).toFixed(2)}`);
console.log(`   avg market |favGap| on picks: ${avg(drawPicks.map(j=>Math.abs(j.o.impH-j.o.impA))).toFixed(3)} vs rest: ${avg(rest.map(j=>Math.abs(j.o.impH-j.o.impA))).toFixed(3)}\n`);

// --- B: HT-market odds estimator (market-only features), calibrated on first 2 odds seasons ---
const calib = joined.filter((j) => j.season <= '2324');
const evalSet = joined.filter((j) => j.season >= '2425');
const mx = (j: Joined) => [j.o.impD, Math.abs(j.o.impH-j.o.impA), j.o.over25 ?? 0.5];
const htModel = trainLogistic(calib.map(mx), calib.map((j) => j.y));
const estP = (j: Joined) => predict(htModel, mx(j));
// sanity: calibration quality on eval
const bins: [string,(p:number)=>boolean][] = [['<0.38',p=>p<0.38],['0.38-0.44',p=>p>=0.38&&p<0.44],['0.44+',p=>p>=0.44]];
console.log('B. Market-based HT-draw estimator (calibrated 2223-2324, applied 2425-2526):');
for (const [label, test] of bins) {
  const g = evalSet.filter((j) => test(estP(j)));
  if (g.length) console.log(`   est ${label}: n=${g.length}, actual HT draw ${(avg(g.map(j=>j.y))*100).toFixed(1)}%`);
}

// --- C: EV of our picks against the modeled HT market line ---
const MARGIN = 1.07; // typical 3-way margin share per outcome (Winner is worse, ~1.10)
const evalDraw = evalSet.filter((j) => j.p >= 0.48);
const evalNoDraw = evalSet.filter((j) => j.p <= 0.38);
const evPick = (g: Joined[], side: 'draw'|'no') => {
  if (!g.length) return;
  const hit = avg(g.map((j) => side==='draw' ? j.y : 1-j.y));
  const fairOdd = avg(g.map((j) => 1 / (side==='draw' ? estP(j) : 1-estP(j))));
  const marketOdd = fairOdd / MARGIN;
  const winnerOdd = fairOdd / 1.10;
  console.log(`   ${side==='draw'?'DRAW':'NO-DRAW'} picks (n=${g.length}): real hit ${(hit*100).toFixed(1)}%, modeled market odd ${marketOdd.toFixed(2)} (winner-like ${winnerOdd.toFixed(2)})`);
  console.log(`      EV @market: ${((hit*marketOdd-1)*100).toFixed(1)}%  |  EV @winner-like: ${((hit*winnerOdd-1)*100).toFixed(1)}%`);
};
console.log('\nC. Estimated EV of the model picks on 2425-2526 (out-of-sample):');
evPick(evalDraw, 'draw');
evPick(evalNoDraw, 'no');

// --- D: does adding market features improve the model? walk-forward within odds seasons ---
console.log('\nD. Model + market features (walk-forward inside the 4 odds seasons):');
const bySeasonSamples = new Map(testSeasons.map((s) => [s, samples.filter((x) => x.season === s)]));
const joinKeyed = new Map<string, OddsRow>();
for (const [k, v] of odds) joinKeyed.set(k, v);
const extend = (s: { date: string; home: string; away: string; x: number[] }) => {
  const o = joinKeyed.get(`${s.date}|${s.home}|${s.away}`);
  if (!o) return null;
  return [...s.x, o.impD, Math.abs(o.impH - o.impA), o.over25 ?? 0.5];
};
for (const ts of ['2324','2425','2526']) {
  const trainS = testSeasons.filter((s) => s < ts).flatMap((s) => bySeasonSamples.get(s)!);
  const testS = bySeasonSamples.get(ts)!;
  const trX: number[][] = [], trY: number[] = [];
  for (const s of trainS) { const x = extend(s); if (x) { trX.push(x); trY.push(s.y); } }
  const teP: { p: number; y: number }[] = [];
  const m2 = trainLogistic(trX, trY);
  for (const s of testS) { const x = extend(s); if (x) teP.push({ p: predict(m2, x), y: s.y }); }
  teP.sort((a,b)=>b.p-a.p);
  const top10 = teP.slice(0, Math.round(teP.length*0.1));
  const bot10 = teP.slice(-Math.round(teP.length*0.1));
  console.log(`   ${ts}: top10% DRAW ${(avg(top10.map(t=>t.y))*100).toFixed(1)}% | bottom10% NO-DRAW ${((1-avg(bot10.map(t=>t.y)))*100).toFixed(1)}% (n=${teP.length})`);
}
