/**
 * Odds logger — builds our own odds archive going forward, since no public
 * historical archive of Winner (or HT-market) odds exists.
 *
 *   API_FOOTBALL_KEY=... npx tsx scripts/fetch-odds.ts [--out odds-log]
 *
 * 1. Pulls upcoming-fixture odds for both leagues from API-Football,
 *    focusing on the First Half Winner (HT 1X2) market, across all
 *    bookmakers the API carries. Appends rows to odds-log/odds.csv.
 * 2. Probes winner.co.il's public site API from this machine and reports
 *    reachability (the site may be geo-blocked outside Israel) — when it
 *    responds, the raw line is saved for later parsing.
 */
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API_BASE = 'https://v3.football.api-sports.io';
const LEAGUES = [
  { league: 'laliga', id: 140 },
  { league: 'israel', id: 383 },
];

const key = process.env.API_FOOTBALL_KEY;
const outDir = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'odds-log';
mkdirSync(outDir, { recursive: true });

const CSV = join(outDir, 'odds.csv');
const CSV_HEADER = 'fetched_at,league,fixture_date,home,away,bookmaker,ht_home,ht_draw,ht_away\n';

interface OddsResponse {
  errors: unknown;
  paging?: { current: number; total: number };
  response: {
    fixture: { id: number; date: string };
    teams?: { home: { name: string }; away: { name: string } };
    bookmakers: {
      name: string;
      bets: { id: number; name: string; values: { value: string; odd: string }[] }[];
    }[];
  }[];
}

async function api(path: string): Promise<OddsResponse> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'x-apisports-key': key! } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as OddsResponse;
  const errs = body.errors;
  if (errs && (Array.isArray(errs) ? errs.length > 0 : Object.keys(errs as object).length > 0)) {
    throw new Error(JSON.stringify(errs));
  }
  return body;
}

interface FixturesResponse {
  errors: unknown;
  response: { fixture: { id: number; date: string }; teams: { home: { name: string }; away: { name: string } } }[];
}

async function fetchApiFootballOdds(): Promise<void> {
  if (!key) {
    console.warn('API_FOOTBALL_KEY not set — skipping API-Football odds');
    return;
  }
  if (!existsSync(CSV)) writeFileSync(CSV, CSV_HEADER);
  const now = new Date().toISOString();
  for (const lg of LEAGUES) {
    // resolve upcoming fixtures first so odds rows carry team names
    let fixtures: FixturesResponse;
    try {
      const res = await fetch(`${API_BASE}/fixtures?league=${lg.id}&next=15`, {
        headers: { 'x-apisports-key': key },
      });
      fixtures = (await res.json()) as FixturesResponse;
    } catch (e) {
      console.warn(`${lg.league}: fixtures fetch failed — ${e instanceof Error ? e.message : e}`);
      continue;
    }
    const names = new Map<number, { date: string; home: string; away: string }>();
    for (const f of fixtures.response ?? []) {
      names.set(f.fixture.id, {
        date: f.fixture.date.slice(0, 10),
        home: f.teams.home.name,
        away: f.teams.away.name,
      });
    }
    console.log(`${lg.league}: ${names.size} upcoming fixtures`);

    let rows = 0;
    for (const [fixtureId, meta] of names) {
      try {
        // bet 13 = First Half Winner (HT 1X2) in API-Football's catalogue
        const body = await api(`/odds?fixture=${fixtureId}&bet=13`);
        for (const r of body.response) {
          for (const bm of r.bookmakers) {
            const bet = bm.bets.find((b) => /first half winner/i.test(b.name));
            if (!bet) continue;
            const v = (name: string) =>
              bet.values.find((x) => x.value.toLowerCase() === name)?.odd ?? '';
            appendFileSync(
              CSV,
              `${now},${lg.league},${meta.date},${meta.home},${meta.away},${bm.name.replace(/,/g, ' ')},${v('home')},${v('draw')},${v('away')}\n`,
            );
            rows++;
          }
        }
      } catch (e) {
        console.warn(`  fixture ${fixtureId}: ${e instanceof Error ? e.message : e}`);
        break; // most likely a plan/quota error — no point hammering
      }
    }
    console.log(`${lg.league}: appended ${rows} odds rows`);
  }
}

async function probeWinner(): Promise<void> {
  const endpoints = [
    'https://www.winner.co.il/api/v2/publicapi/GetCMobileLine',
    'https://api.winner.co.il/v2/publicapi/GetCMobileLine',
    'https://www.winner.co.il/api/v1/lines',
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });
      const text = await res.text();
      console.log(`winner probe ${url}: HTTP ${res.status}, ${text.length} bytes, starts: ${text.slice(0, 80).replace(/\s+/g, ' ')}`);
      if (res.ok && text.length > 1000) {
        const file = join(outDir, `winner-raw-${new Date().toISOString().slice(0, 10)}.json`);
        writeFileSync(file, text);
        console.log(`saved raw Winner line to ${file}`);
        return;
      }
    } catch (e) {
      console.log(`winner probe ${url}: failed — ${e instanceof Error ? e.message : e}`);
    }
  }
}

await fetchApiFootballOdds();
await probeWinner();
