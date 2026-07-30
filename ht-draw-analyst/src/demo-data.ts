import { LEAGUES, isDerby } from './leagues';
import type { LeagueId, MatchData, TeamProfile } from './types';
import { createRng, type Rng } from './rng';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function buildMatch(
  league: LeagueId,
  date: string,
  home: TeamProfile,
  away: TeamProfile,
  rng: Rng,
  time: string,
): MatchData {
  const cfg = LEAGUES[league];
  const noise = () => rng.int(-6, 6);
  const homePct = clamp(home.htDrawRate + noise(), 18, 60);
  const awayPct = clamp(away.htDrawRate + noise(), 18, 60);
  const h2hCount = rng.int(0, 12);
  const h2hRate = (homePct + awayPct) / 200;
  let h2hDraws = 0;
  for (let i = 0; i < h2hCount; i++) {
    if (rng.next() < h2hRate + (rng.next() - 0.5) * 0.2) h2hDraws++;
  }
  const recent = (pct: number) => {
    let n = 0;
    for (let i = 0; i < 6; i++) if (rng.next() < pct / 100) n++;
    return n;
  };
  const notes: string[] = [];
  if (isDerby(league, home.name, away.name)) {
    notes.push(league === 'israel' ? 'דרבי עירוני' : 'דרבי');
  }
  if (rng.next() < 0.15) notes.push('מחזור צפוף');

  const positions = createRngPositions(rng, cfg.maxTablePosition);

  return {
    id: `${league}-${date}-${home.name}-${away.name}`.replace(/\s+/g, '_'),
    league,
    date,
    time,
    homeTeam: home.name,
    awayTeam: away.name,
    homeHtDrawPct: homePct,
    awayHtDrawPct: awayPct,
    h2hMatchesCount: h2hCount,
    h2hHtDraws: h2hDraws,
    homeRecentHtDraws: recent(homePct),
    awayRecentHtDraws: recent(awayPct),
    homeGamesSinceHtDraw: rng.int(0, 14),
    awayGamesSinceHtDraw: rng.int(0, 14),
    homeTablePosition: positions[0],
    awayTablePosition: positions[1],
    note: notes.join(' • ') || undefined,
  };
}

function createRngPositions(rng: Rng, max: number): [number, number] {
  const a = rng.int(1, max);
  let b = rng.int(1, max);
  if (b === a) b = (b % max) + 1;
  return [a, b];
}

/** Demo matches for a single date. Same league + date → same matches. */
export function generateDemoMatches(league: LeagueId, date: string): MatchData[] {
  const cfg = LEAGUES[league];
  const rng = createRng(`${league}:${date}`);
  const [min, max] = cfg.demoMatchesPerDay;
  const count = rng.int(min, max);
  const teams = rng.shuffle(cfg.teams);
  const matches: MatchData[] = [];
  for (let i = 0; i < count && i * 2 + 1 < teams.length; i++) {
    const time = rng.pick(cfg.matchTimes);
    matches.push(buildMatch(league, date, teams[i * 2], teams[i * 2 + 1], rng, time));
  }
  return matches.sort((a, b) => a.time.localeCompare(b.time));
}

export interface RoundDay {
  date: string;
  dayName: string;
  matches: MatchData[];
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Dates of the next matchday: opening day (Fri/Sat) plus the following days. */
export function nextRoundDates(league: LeagueId, from = new Date()): Date[] {
  const cfg = LEAGUES[league];
  const start = new Date(from);
  const delta = (cfg.roundOpeningDay - start.getDay() + 7) % 7 || 7;
  start.setDate(start.getDate() + delta);
  return cfg.roundDaySplit.map((_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** A full round (7 or 10 matches) spread over the round's days. */
export function generateNextRound(league: LeagueId, from = new Date()): RoundDay[] {
  const cfg = LEAGUES[league];
  const dates = nextRoundDates(league, from);
  const rng = createRng(`round:${league}:${toISO(dates[0])}`);
  const teams = rng.shuffle(cfg.teams);
  const pairs: [TeamProfile, TeamProfile][] = [];
  for (let i = 0; i * 2 + 1 < teams.length; i++) {
    pairs.push([teams[i * 2], teams[i * 2 + 1]]);
  }
  const days: RoundDay[] = [];
  let cursor = 0;
  cfg.roundDaySplit.forEach((n, dayIdx) => {
    const date = toISO(dates[dayIdx]);
    const matches: MatchData[] = [];
    for (let k = 0; k < n && cursor < pairs.length; k++, cursor++) {
      const [home, away] = pairs[cursor];
      matches.push(buildMatch(league, date, home, away, rng, rng.pick(cfg.matchTimes)));
    }
    days.push({
      date,
      dayName: cfg.roundDayNames[dayIdx],
      matches: matches.sort((a, b) => a.time.localeCompare(b.time)),
    });
  });
  return days;
}

/**
 * Simulated half-time result for demo/learning data. The draw probability is
 * driven by the match's real underlying signal so the learning engine has
 * something meaningful to find.
 */
export function simulateHtResult(match: MatchData, rng: Rng): string {
  const profile = (match.homeHtDrawPct + match.awayHtDrawPct) / 2 / 100;
  const h2h = match.h2hMatchesCount > 0 ? match.h2hHtDraws / match.h2hMatchesCount : profile;
  const form = (match.homeRecentHtDraws + match.awayRecentHtDraws) / 12;
  const p = clamp(0.12 + profile * 0.45 + h2h * 0.15 + form * 0.2, 0.08, 0.72);
  if (rng.next() < p) {
    const g = rng.next() < 0.75 ? 0 : 1;
    return `${g}-${g}`;
  }
  const winnerGoals = rng.int(1, 2);
  const loserGoals = rng.int(0, winnerGoals - 1);
  return rng.next() < 0.5 ? `${winnerGoals}-${loserGoals}` : `${loserGoals}-${winnerGoals}`;
}

/** 60 days of simulated history for the learning engine (per league). */
export function generateLearningDataset(league: LeagueId, days = 60): MatchData[] {
  const rng = createRng(`learning:${league}`);
  const out: MatchData[] = [];
  const today = new Date();
  for (let d = days; d >= 1; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const iso = toISO(date);
    const cfg = LEAGUES[league];
    const dayRng = createRng(`learning:${league}:${iso}`);
    const count = dayRng.int(3, 6);
    const teams = dayRng.shuffle(cfg.teams);
    for (let i = 0; i < count && i * 2 + 1 < teams.length; i++) {
      const m = buildMatch(league, iso, teams[i * 2], teams[i * 2 + 1], dayRng, dayRng.pick(cfg.matchTimes));
      m.htResult = simulateHtResult(m, rng);
      out.push(m);
    }
  }
  return out;
}
