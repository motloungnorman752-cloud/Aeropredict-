import React from 'react';
import { ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';
import { PredictionSignal, StrategyMode } from '../types';

interface SignalCardProps {
  signal: PredictionSignal;
  roundNumber: number;
  strategy: StrategyMode;
  volatilityNudge: number;
  onSelectStrategy: (mode: StrategyMode) => void;
  onChangeVolatilityNudge: (nudge: number) => void;
}

const PROFILE_LABELS: { id: StrategyMode; label: string }[] = [
  { id: 'CONSERVATIVE', label: 'Conservative' },
  { id: 'BALANCED', label: 'Balanced' },
  { id: 'AGGRESSIVE', label: 'Aggressive' },
];

export const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  roundNumber,
  strategy,
  volatilityNudge,
  onSelectStrategy,
  onChangeVolatilityNudge,
}) => {
  const isSkip = signal.actionRecommendation === 'SKIP_ROUND';
  const isCaution = signal.actionRecommendation === 'WAIT_CAUTION';

  const autoCoeff = signal.autoVolatilityCoeff ?? signal.dynamicVolatilityCoeff ?? 1.0;
  const effectiveCoeff = signal.dynamicVolatilityCoeff ?? Number((autoCoeff + volatilityNudge).toFixed(4));
  const stdDev20 = signal.rolling20StdDev ?? 0;
  const isNudged = Math.abs(volatilityNudge) >= 0.005;
  const nudgeText =
    volatilityNudge > 0.005
      ? `+${volatilityNudge.toFixed(2)}`
      : volatilityNudge < -0.005
      ? volatilityNudge.toFixed(2)
      : 'Auto';

  return (
    <aside className="rounded-xl bg-[#0D1320] border border-slate-800/80 p-5 sm:p-6 flex flex-col justify-between gap-5 h-full">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isSkip ? (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : isCaution ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <h2 className="text-sm font-semibold text-white">Signal Profile · #{roundNumber}</h2>
          </div>
          <span
            className={`text-xs font-medium whitespace-nowrap ${
              isSkip ? 'text-rose-400' : isCaution ? 'text-amber-300' : 'text-emerald-400'
            }`}
          >
            {isSkip ? 'Skip' : isCaution ? 'Caution' : 'Active'}
          </span>
        </div>

        <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
          <div className="text-xs font-medium text-slate-400">Pattern Classification</div>
          <div className="text-sm font-semibold text-white">{signal.pattern}</div>
          <p className="text-xs text-slate-400 leading-relaxed">{signal.hazardReason}</p>
        </div>

        <div className="grid grid-cols-2 gap-px bg-slate-800/70 rounded-lg border border-slate-800/80 overflow-hidden font-mono">
          <div className="p-3 bg-[#090D16]">
            <div className="text-[11px] font-sans text-slate-400">Safe Cashout</div>
            <div className="text-lg font-bold text-emerald-400 tabular-nums mt-0.5">
              {isSkip ? 'SKIP' : `${signal.safeMultiplier.toFixed(2)}x`}
            </div>
          </div>
          <div className="p-3 bg-[#090D16]">
            <div className="text-[11px] font-sans text-slate-400">Close Target</div>
            <div className="text-lg font-bold text-sky-400 tabular-nums mt-0.5">
              {isSkip ? 'SKIP' : `${signal.closeExitTarget.toFixed(2)}x`}
            </div>
          </div>
          <div className="p-3 bg-[#090D16]">
            <div className="text-[11px] font-sans text-slate-400">Est. Ceiling</div>
            <div className="text-lg font-bold text-amber-300 tabular-nums mt-0.5">
              ~{signal.projectedCeiling.toFixed(2)}x
            </div>
          </div>
          <div className="p-3 bg-[#090D16]">
            <div className="text-[11px] font-sans text-slate-400">10R Accuracy</div>
            <div className="text-lg font-bold text-slate-100 tabular-nums mt-0.5">
              {signal.rollingWindow.rollingAccuracyPct.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Dynamic Volatility Coefficient Manual Nudge */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs min-w-0">
              <label htmlFor="volatility-nudge-slider" className="font-medium text-slate-300 whitespace-nowrap">
                Volatility Coeff
              </label>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-400 whitespace-nowrap">
                σ20 {stdDev20.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-xs font-mono tabular-nums font-semibold whitespace-nowrap ${
                  volatilityNudge > 0.005
                    ? 'text-amber-300'
                    : volatilityNudge < -0.005
                    ? 'text-emerald-400'
                    : 'text-sky-400'
                }`}
              >
                ×{effectiveCoeff.toFixed(2)} ({nudgeText})
              </span>
              <button
                type="button"
                disabled={!isNudged}
                onClick={() => onChangeVolatilityNudge(0)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition-colors ${
                  isNudged
                    ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                    : 'bg-slate-900 text-slate-400 opacity-50 cursor-default'
                }`}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="py-1">
            <input
              id="volatility-nudge-slider"
              type="range"
              min={-0.20}
              max={0.20}
              step={0.01}
              value={volatilityNudge}
              onChange={(e) => onChangeVolatilityNudge(Number(e.target.value))}
              aria-label="Volatility coefficient manual nudge"
              className="w-full h-1.5 rounded-lg bg-slate-800 appearance-none cursor-pointer accent-sky-500"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
            <span>-0.20 Tighter</span>
            <button
              type="button"
              onClick={() => onChangeVolatilityNudge(0)}
              className="text-slate-300 hover:text-white transition-colors whitespace-nowrap"
            >
              Auto ×{autoCoeff.toFixed(2)}
            </button>
            <span>+0.20 Higher</span>
          </div>
        </div>
      </div>

      {/* Risk Profile Switcher */}
      <div className="pt-4 border-t border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium">Risk Profile</span>
          <span className="font-mono tabular-nums text-slate-300">
            {signal.confidenceScore.toFixed(1)}% Confidence
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#090D16] border border-slate-800/80">
          {PROFILE_LABELS.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelectStrategy(mode.id)}
              className={`py-1.5 px-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                strategy === mode.id
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};
