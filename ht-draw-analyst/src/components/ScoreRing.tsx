import { scoreColor } from '../ui';

export default function ScoreRing({ total, size = 56 }: { total: number; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const filled = (total / 100) * circ;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          className={scoreColor(total)}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${scoreColor(total)}`}>
        {total}
      </div>
    </div>
  );
}
