import type { LeagueId, TeamProfile } from './types';

export interface LeagueConfig {
  id: LeagueId;
  flag: string;
  nameShort: string;
  nameHe: string;
  nameFull: string;
  teams: TeamProfile[];
  demoMatchesPerDay: [number, number]; // min, max
  matchesPerRound: number;
  roundOpeningDay: number; // JS getDay(): 5 = Friday, 6 = Saturday
  roundDaySplit: number[]; // matches per day of the round
  roundDayNames: string[];
  maxTablePosition: number;
  matchTimes: string[];
  aiName: string;
  aiSources: string;
  weightsStorageKey: string;
}

const LALIGA_TEAMS: TeamProfile[] = [
  { name: 'Real Madrid', style: 'attacking', htDrawRate: 30 },
  { name: 'Barcelona', style: 'attacking', htDrawRate: 29 },
  { name: 'Atlético Madrid', style: 'balanced', htDrawRate: 42 },
  { name: 'Athletic Bilbao', style: 'balanced', htDrawRate: 41 },
  { name: 'Villarreal', style: 'balanced', htDrawRate: 38 },
  { name: 'Real Betis', style: 'balanced', htDrawRate: 39 },
  { name: 'Real Sociedad', style: 'balanced', htDrawRate: 40 },
  { name: 'Girona', style: 'attacking', htDrawRate: 35 },
  { name: 'Sevilla', style: 'balanced', htDrawRate: 41 },
  { name: 'Valencia', style: 'defensive', htDrawRate: 44 },
  { name: 'Osasuna', style: 'defensive', htDrawRate: 45 },
  { name: 'Getafe', style: 'defensive', htDrawRate: 48 },
  { name: 'Celta Vigo', style: 'attacking', htDrawRate: 37 },
  { name: 'Rayo Vallecano', style: 'balanced', htDrawRate: 40 },
  { name: 'Mallorca', style: 'defensive', htDrawRate: 46 },
  { name: 'Las Palmas', style: 'balanced', htDrawRate: 39 },
  { name: 'Alavés', style: 'defensive', htDrawRate: 45 },
  { name: 'Leganés', style: 'defensive', htDrawRate: 47 },
  { name: 'Espanyol', style: 'defensive', htDrawRate: 44 },
  { name: 'Valladolid', style: 'defensive', htDrawRate: 43 },
];

const ISRAEL_TEAMS: TeamProfile[] = [
  { name: 'מכבי תל אביב', style: 'attacking', htDrawRate: 34 },
  { name: 'מכבי חיפה', style: 'attacking', htDrawRate: 36 },
  { name: 'הפועל באר שבע', style: 'balanced', htDrawRate: 42 },
  { name: 'בית"ר ירושלים', style: 'balanced', htDrawRate: 38 },
  { name: 'הפועל חיפה', style: 'defensive', htDrawRate: 44 },
  { name: 'הפועל תל אביב', style: 'attacking', htDrawRate: 40 },
  { name: 'מ.ס. אשדוד', style: 'defensive', htDrawRate: 46 },
  { name: 'מכבי נתניה', style: 'balanced', htDrawRate: 41 },
  { name: 'הפועל פתח תקווה', style: 'balanced', htDrawRate: 43 },
  { name: 'הפועל ירושלים', style: 'defensive', htDrawRate: 45 },
  { name: 'בני סכנין', style: 'defensive', htDrawRate: 48 },
  { name: 'עירוני קרית שמונה', style: 'defensive', htDrawRate: 47 },
  { name: 'עירוני טבריה', style: 'balanced', htDrawRate: 39 },
  { name: 'מכבי בני ריינה', style: 'defensive', htDrawRate: 44 },
];

export const DERBIES: Record<LeagueId, [string, string][]> = {
  israel: [
    ['מכבי תל אביב', 'הפועל תל אביב'],
    ['מכבי חיפה', 'הפועל חיפה'],
    ['בית"ר ירושלים', 'הפועל ירושלים'],
  ],
  laliga: [
    ['Real Madrid', 'Atlético Madrid'],
    ['Barcelona', 'Espanyol'],
    ['Real Betis', 'Sevilla'],
  ],
};

export const LEAGUES: Record<LeagueId, LeagueConfig> = {
  laliga: {
    id: 'laliga',
    flag: '🇪🇸',
    nameShort: 'לה ליגה',
    nameHe: 'לה ליגה',
    nameFull: 'La Liga — Primera División',
    teams: LALIGA_TEAMS,
    demoMatchesPerDay: [4, 6],
    matchesPerRound: 10,
    roundOpeningDay: 6, // Saturday
    roundDaySplit: [4, 5, 1],
    roundDayNames: ['שבת', 'ראשון', 'שני'],
    maxTablePosition: 20,
    matchTimes: ['15:00', '17:00', '19:15', '21:30'],
    aiName: 'Spanish La Liga (Primera División)',
    aiSources: 'official La Liga stats sites',
    weightsStorageKey: 'learned_weights_laliga',
  },
  israel: {
    id: 'israel',
    flag: '🇮🇱',
    nameShort: 'ליגת העל',
    nameHe: 'ליגת העל',
    nameFull: "Ligat Ha'al — Israeli Premier League",
    teams: ISRAEL_TEAMS,
    demoMatchesPerDay: [2, 4],
    matchesPerRound: 7,
    roundOpeningDay: 5, // Friday
    roundDaySplit: [2, 3, 2],
    roundDayNames: ['שישי', 'שבת', 'ראשון'],
    maxTablePosition: 14,
    matchTimes: ['19:30', '20:00', '20:30', '21:00'],
    aiName: "Israeli Premier League (Ligat Ha'al / ליגת העל)",
    aiSources: 'One.co.il, Winner, UEFA',
    weightsStorageKey: 'learned_weights_israel',
  },
};

export function isDerby(league: LeagueId, home: string, away: string): boolean {
  return DERBIES[league].some(
    ([a, b]) => (a === home && b === away) || (a === away && b === home),
  );
}

export function teamProfile(league: LeagueId, name: string): TeamProfile | undefined {
  return LEAGUES[league].teams.find((t) => t.name === name);
}
