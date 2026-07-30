import { LEAGUES } from '../leagues';
import type { LeagueId } from '../types';
import { cn } from '../ui';

interface Props {
  value: LeagueId;
  onChange: (league: LeagueId) => void;
  disabled?: boolean;
}

export default function LeagueSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="flex gap-3">
      {(Object.keys(LEAGUES) as LeagueId[]).map((id) => {
        const cfg = LEAGUES[id];
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(id)}
            className={cn(
              'flex-1 rounded-2xl border-2 px-4 py-4 text-center transition-all',
              'disabled:cursor-not-allowed disabled:opacity-50',
              active
                ? 'border-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/10'
                : 'border-slate-700 bg-slate-900 hover:border-slate-500',
            )}
          >
            <div className="text-3xl">{cfg.flag}</div>
            <div className={cn('mt-1 text-lg font-bold', active ? 'text-orange-400' : 'text-slate-200')}>
              {cfg.nameShort}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">{cfg.nameFull}</div>
          </button>
        );
      })}
    </div>
  );
}
