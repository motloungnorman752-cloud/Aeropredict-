import React from 'react';
import { RoundRecord } from '../types';

interface MultiplierTickerProps {
  rounds: RoundRecord[];
  onSelectRound?: (round: RoundRecord) => void;
}

export const MultiplierTicker: React.FC<MultiplierTickerProps> = ({ rounds, onSelectRound }) => {
  const recent = rounds.slice(-24).reverse(); // Newest-left like [REDACTED_PROVIDER] top ribbon

  return (
    <div className="border-b border-slate-800/70 bg-[#090D16] px-4 sm:px-6 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap shrink-0">
          Recent Crashes
        </span>
        <div className="h-3.5 w-px bg-slate-800 shrink-0" aria-hidden="true" />
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {recent.map((r, idx) => {
            const m = Number(r.multiplier);
            const tierStyle =
              m >= 10
                ? 'text-fuchsia-300 bg-fuchsia-500/10'
                : m >= 2.0
                ? 'text-indigo-300 bg-indigo-500/10'
                : 'text-sky-300 bg-sky-500/5';

            return (
              <button
                key={r.id || `${r.roundNumber}-${idx}`}
                type="button"
                onClick={() => onSelectRound?.(r)}
                className={`px-2 py-1 rounded text-xs font-mono font-semibold tabular-nums whitespace-nowrap shrink-0 transition-colors hover:bg-slate-800 ${tierStyle} ${
                  idx === 0 ? 'ring-1 ring-slate-700' : ''
                }`}
                title={`Round #${r.roundNumber}: ${m.toFixed(2)}x`}
              >
                {m.toFixed(2)}x
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
