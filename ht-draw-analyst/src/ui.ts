import type { Confidence } from './types';

export function cn(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ');
}

export const CONFIDENCE_STYLES: Record<Confidence, string> = {
  top: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  good: 'bg-sky-500/15 text-sky-400 border-sky-500/40',
  borderline: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  low: 'bg-slate-500/15 text-slate-400 border-slate-500/40',
};

export function scoreColor(total: number): string {
  if (total >= 75) return 'text-emerald-400';
  if (total >= 60) return 'text-sky-400';
  if (total >= 45) return 'text-amber-400';
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
