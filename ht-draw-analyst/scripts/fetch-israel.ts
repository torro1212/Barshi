/**
 * Fetch Israeli Premier League (Ligat Ha'al) historical results, including
 * half-time scores, from API-Football (api-sports.io) and write them as
 * season CSVs the backtest script can read.
 *
 * Usage:
 *   npx tsx scripts/fetch-israel.ts --key <API_FOOTBALL_KEY> [--seasons 2021,2022,2023] [--out data]
 *   npx tsx scripts/fetch-israel.ts --mock <fixtures.json> --season 2022 [--out data]
 *
 * A free API key from https://dashboard.api-football.com (100 requests/day)
 * is enough: one request per season. Note the free plan only serves seasons
 * 2021-2023; paid plans unlock newer seasons.
 *
 * Output files are named ISR_2122.csv, ISR_2223.csv, ... with the columns
 * Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG — run the backtest with:
 *   npx tsx scripts/backtest.ts <out-dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API_BASE = 'https://v3.football.api-sports.io';
const LEAGUE_COUNTRY = 'Israel';
const LEAGUE_NAME_MATCH = /ligat ha'?al/i;

interface ApiFixture {
  fixture: { date: string; status: { short: string } };
  teams: { home: { name: string }; away: { name: string } };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
}

interface CsvRow {
  date: string;
  home: string;
  away: string;
  fthg: number;
  ftag: number;
  hthg: number;
  htag: number;
}

export function fixturesToRows(fixtures: ApiFixture[]): CsvRow[] {
  return fixtures
    .filter(
      (f) =>
        f.fixture.status.short === 'FT' &&
        f.score.halftime.home !== null &&
        f.score.halftime.away !== null &&
        f.score.fulltime.home !== null &&
        f.score.fulltime.away !== null,
    )
    .map((f) => ({
      date: f.fixture.date.slice(0, 10),
      home: f.teams.home.name,
      away: f.teams.away.name,
      fthg: f.score.fulltime.home as number,
      ftag: f.score.fulltime.away as number,
      hthg: f.score.halftime.home as number,
      htag: f.score.halftime.away as number,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function rowsToCsv(rows: CsvRow[]): string {
  const header = 'Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG';
  const lines = rows.map((r) => {
    const ftr = r.fthg > r.ftag ? 'H' : r.fthg < r.ftag ? 'A' : 'D';
    return [r.date, r.home, r.away, r.fthg, r.ftag, ftr, r.hthg, r.htag].join(',');
  });
  return [header, ...lines].join('\n') + '\n';
}

function seasonFileName(startYear: number): string {
  const yy = startYear % 100;
  return `ISR_${String(yy).padStart(2, '0')}${String((yy + 1) % 100).padStart(2, '0')}.csv`;
}

async function api<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-apisports-key': key },
  });
  if (!res.ok) throw new Error(`API-Football ${path} → HTTP ${res.status}`);
  const body = (await res.json()) as { errors: unknown; response: T };
  const errs = body.errors;
  if (errs && (Array.isArray(errs) ? errs.length > 0 : Object.keys(errs).length > 0)) {
    throw new Error(`API-Football ${path} → ${JSON.stringify(errs)}`);
  }
  return body.response;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const outDir = arg('out') ?? 'data';
  mkdirSync(outDir, { recursive: true });

  const mock = arg('mock');
  if (mock) {
    const season = Number(arg('season'));
    if (!season) throw new Error('--mock requires --season <startYear>');
    const fixtures = JSON.parse(readFileSync(mock, 'utf8')) as ApiFixture[];
    const rows = fixturesToRows(fixtures);
    const file = join(outDir, seasonFileName(season));
    writeFileSync(file, rowsToCsv(rows));
    console.log(`${file}: ${rows.length} matches (mock)`);
    return;
  }

  const key = arg('key') ?? process.env.API_FOOTBALL_KEY;
  if (!key) {
    console.error('usage: npx tsx scripts/fetch-israel.ts --key <API_FOOTBALL_KEY> [--seasons 2021,2022,2023] [--out data]');
    console.error('Get a free key (100 req/day) at https://dashboard.api-football.com');
    process.exit(1);
  }
  const seasons = (arg('seasons') ?? '2021,2022,2023').split(',').map(Number);

  // resolve the league id by name so we don't hardcode it
  const leagues = await api<{ league: { id: number; name: string } }[]>(
    `/leagues?country=${encodeURIComponent(LEAGUE_COUNTRY)}`,
    key,
  );
  const league = leagues.find((l) => LEAGUE_NAME_MATCH.test(l.league.name));
  if (!league) {
    throw new Error(`Ligat Ha'al not found; got: ${leagues.map((l) => l.league.name).join(', ')}`);
  }
  console.log(`League: ${league.league.name} (id ${league.league.id})`);

  for (const season of seasons) {
    const fixtures = await api<ApiFixture[]>(
      `/fixtures?league=${league.league.id}&season=${season}`,
      key,
    );
    const rows = fixturesToRows(fixtures);
    if (rows.length === 0) {
      console.warn(`season ${season}: no finished matches with HT scores (plan limit?) — skipped`);
      continue;
    }
    const file = join(outDir, seasonFileName(season));
    writeFileSync(file, rowsToCsv(rows));
    console.log(`${file}: ${rows.length} matches`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
