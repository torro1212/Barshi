import { LEAGUES } from './leagues';
import type { LeagueId, MatchData } from './types';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(Number(v) || 0)));
}

function buildPrompt(league: LeagueId, date: string): string {
  const cfg = LEAGUES[league];
  const teamLang = league === 'israel' ? 'Hebrew (if available)' : 'English';
  return `You are a football statistics researcher. Using Google Search, find the ${cfg.aiName} matches scheduled for ${date} (2024-2025 season). Preferred sources: ${cfg.aiSources}.

For each match collect half-time (HT) draw statistics:
- homeHtDrawPct: % of the home team's HOME matches drawn at half-time this season (0-100)
- awayHtDrawPct: % of the away team's AWAY matches drawn at half-time this season (0-100)
- h2hMatchesCount (0-20) and h2hHtDraws: recent head-to-head matches and how many were drawn at HT
- homeRecentHtDraws / awayRecentHtDraws: HT draws in each team's last 6 matches (0-6)
- homeGamesSinceHtDraw / awayGamesSinceHtDraw: consecutive matches without an HT draw
- homeTablePosition / awayTablePosition: league table position (1-${cfg.maxTablePosition})
- time: kickoff time (HH:MM local)

Team names in ${teamLang}.

Respond with ONLY a JSON array (no markdown, no commentary):
[{"homeTeam":"...","awayTeam":"...","time":"20:00","homeHtDrawPct":40,"awayHtDrawPct":45,"h2hMatchesCount":6,"h2hHtDraws":3,"homeRecentHtDraws":2,"awayRecentHtDraws":3,"homeGamesSinceHtDraw":4,"awayGamesSinceHtDraw":2,"homeTablePosition":5,"awayTablePosition":9}]
If no matches are scheduled for that date, respond with [].`;
}

function extractJsonArray(text: string): unknown[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('no JSON array in AI response');
  }
  const parsed = JSON.parse(candidate.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('AI response is not an array');
  return parsed;
}

export async function fetchMatchesAI(
  league: LeagueId,
  date: string,
  apiKey: string,
): Promise<MatchData[]> {
  const cfg = LEAGUES[league];
  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(league, date) }] }],
      tools: [{ google_search: {} }],
    }),
  });
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('');
  const raw = extractJsonArray(text) as Record<string, unknown>[];

  return raw
    .filter((m) => typeof m.homeTeam === 'string' && typeof m.awayTeam === 'string')
    .map((m, i) => ({
      id: `${league}-${date}-ai-${i}`,
      league,
      date,
      time: typeof m.time === 'string' && /^\d{1,2}:\d{2}$/.test(m.time) ? m.time : '20:00',
      homeTeam: m.homeTeam as string,
      awayTeam: m.awayTeam as string,
      homeHtDrawPct: clamp(m.homeHtDrawPct as number, 0, 100),
      awayHtDrawPct: clamp(m.awayHtDrawPct as number, 0, 100),
      h2hMatchesCount: clamp(m.h2hMatchesCount as number, 0, 20),
      h2hHtDraws: clamp(m.h2hHtDraws as number, 0, 20),
      homeRecentHtDraws: clamp(m.homeRecentHtDraws as number, 0, 6),
      awayRecentHtDraws: clamp(m.awayRecentHtDraws as number, 0, 6),
      homeGamesSinceHtDraw: clamp(m.homeGamesSinceHtDraw as number, 0, 40),
      awayGamesSinceHtDraw: clamp(m.awayGamesSinceHtDraw as number, 0, 40),
      homeTablePosition: clamp(m.homeTablePosition as number, 1, cfg.maxTablePosition),
      awayTablePosition: clamp(m.awayTablePosition as number, 1, cfg.maxTablePosition),
    }));
}
