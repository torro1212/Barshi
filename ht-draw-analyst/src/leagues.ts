import type { LeagueId } from './types';

export interface LeagueConfig {
  id: LeagueId;
  flag: string;
  nameShort: string;
  nameFull: string;
}

export const LEAGUES: Record<LeagueId, LeagueConfig> = {
  laliga: {
    id: 'laliga',
    flag: '🇪🇸',
    nameShort: 'לה ליגה',
    nameFull: 'La Liga — Primera División',
  },
  israel: {
    id: 'israel',
    flag: '🇮🇱',
    nameShort: 'ליגת העל',
    nameFull: "Ligat Ha'al — Israeli Premier League",
  },
};

/** Hebrew display names for Israeli teams (dataset stores English names). */
const ISRAEL_HEBREW: Record<string, string> = {
  'Maccabi Tel Aviv': 'מכבי תל אביב',
  'Maccabi Haifa': 'מכבי חיפה',
  'Hapoel Beer Sheva': 'הפועל באר שבע',
  'Beitar Jerusalem': 'בית"ר ירושלים',
  'Hapoel Haifa': 'הפועל חיפה',
  'Hapoel Tel Aviv': 'הפועל תל אביב',
  'Ashdod': 'מ.ס. אשדוד',
  'Maccabi Netanya': 'מכבי נתניה',
  'Hapoel Katamon': 'הפועל ירושלים (קטמון)',
  'Hapoel Jerusalem': 'הפועל ירושלים',
  'Bnei Sakhnin': 'בני סכנין',
  'Ironi Kiryat Shmona': 'עירוני קרית שמונה',
  'Ironi Tiberias': 'עירוני טבריה',
  'Maccabi Bnei Raina': 'מכבי בני ריינה',
  'Hapoel Hadera': 'הפועל חדרה',
  'Maccabi Petah Tikva': 'מכבי פתח תקווה',
  'Hapoel Petah Tikva': 'הפועל פתח תקווה',
};

export function displayTeam(league: LeagueId, name: string): string {
  if (league === 'israel') return ISRAEL_HEBREW[name] ?? name;
  return name;
}
