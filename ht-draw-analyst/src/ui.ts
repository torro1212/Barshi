import type { Side } from './types';

export function cn(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ');
}

export const SIDE_LABELS: Record<Side, string> = {
  'no-draw': 'אין תיקו במחצית',
  draw: 'תיקו במחצית',
  none: 'ללא המלצה',
};

export const SIDE_STYLES: Record<Side, string> = {
  'no-draw': 'bg-sky-500/15 text-sky-400 border-sky-500/40',
  draw: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  none: 'bg-slate-500/15 text-slate-400 border-slate-500/40',
};

export function sideColor(side: Side): string {
  if (side === 'draw') return 'text-emerald-400';
  if (side === 'no-draw') return 'text-sky-400';
  return 'text-slate-400';
}

export function formatHebrewDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
