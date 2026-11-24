import React, { useMemo, useState } from 'react';
import { ApiConfig, RoomSyncMeta, RoundRecord } from '../types';
import { PrecisionForecastResult } from '../utils/precisionPredictor';
import { backtestExceedance, estimateExceedance } from '../utils/probabilityEstimate';

interface Props {
  history: RoundRecord[];
  signal: PrecisionForecastResult;
  currentRoundNumber: number;
  apiConfig: ApiConfig;
  roomSyncMeta: RoomSyncMeta;
}

export const NextMultiplierPredictor: React.FC<Props> = ({ history, signal, currentRoundNumber, apiConfig, roomSyncMeta }) => {
  const [threshold, setThreshold] = useState(2);
  const values = useMemo(
    () => history.map((round) => Number(round.multiplier)).filter((value) => Number.isFinite(value) && value >= 1),
    [history],
  );
  const estimate = useMemo(() => estimateExceedance(values, threshold), [values, threshold]);
  const backtest = useMemo(() => backtestExceedance(values, threshold), [values, threshold]);

  const enoughEvidence = backtest.evaluatedRounds >= 30;
  const expandingWon =
    enoughEvidence &&
    backtest.modelBrier !== null &&
    backtest.baselineBrier !== null &&
    backtest.modelBrier < backtest.baselineBrier;

  return (
    <section className="rounded-xl bg-[#0D1320] border border-slate-800/80 p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          <span className="font-semibold text-slate-200">Next round #{currentRoundNumber}</span>
          <span> · {apiConfig.provider}</span>
        </div>
        <span className={`text-xs font-mono ${expandingWon ? 'text-amber-300' : 'text-slate-400'}`}>
          {expandingWon ? 'VALIDATION: SMALL ADVANTAGE' : 'VALIDATION: NO DEMONSTRATED ADVANTAGE'}
        </span>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        This app estimates a probability from past results only. Independent provably-fair rounds cannot be reliably predicted. This is an experimental reference estimate, not a guarantee or betting advice.
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">
          Estimated probability of reaching
          <span className="mt-1 flex items-center gap-2">
            <input
              aria-label="Multiplier threshold"
              type="number"
              min="1"
              max="1000"
              step="0.1"
              value={threshold}
              onChange={(event) => setThreshold(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))}
              className="w-28 rounded-lg border border-slate-700 bg-[#090D16] px-3 py-2 font-mono text-white"
            />
            <span className="font-mono text-slate-200">x</span>
          </span>
        </label>
        <div className="text-xs text-slate-400">{estimate.sampleSize} valid rounds</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metric label={`Estimated P(X ≥ ${threshold.toFixed(1)}x)`} value={`${estimate.probabilityPct.toFixed(1)}%`} />
        <Metric label="95% sampling interval" value={`${estimate.lower95Pct.toFixed(1)}–${estimate.upper95Pct.toFixed(1)}%`} />
        <Metric label="Historical median" value={`${signal.medianMultiplier.toFixed(2)}x`} />
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        {estimate.successes}/{estimate.sampleSize} recorded rounds reached {threshold.toFixed(1)}x. The interval measures sampling uncertainty only and does not prove that rounds are dependent or predictable.
      </p>

      <div className="rounded-lg border border-slate-800 bg-[#090D16] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-200">Chronological holdout validation</div>
          <span className={`rounded-md px-2 py-1 text-[11px] font-mono ${expandingWon ? 'bg-amber-500/10 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
            {expandingWon ? 'OUTPERFORMS BASELINE' : 'NO PREDICTIVE ADVANTAGE SHOWN'}
          </span>
        </div>

        {backtest.evaluatedRounds > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Metric label="Future rounds tested" value={String(backtest.evaluatedRounds)} />
              <Metric label="Expanding estimate Brier" value={backtest.modelBrier?.toFixed(4) ?? '—'} />
              <Metric label="Fixed baseline Brier" value={backtest.baselineBrier?.toFixed(4) ?? '—'} />
            </div>
            <p className="text-[11px] text-slate-500">
              Lower Brier score is better. Predictions are made only from earlier rounds, never from the held-out result.
              {!enoughEvidence && ' This sample is too small to establish a stable advantage.'}
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-500">At least 31 valid rounds are needed for a chronological holdout check.</p>
        )}
      </div>

      <div className="pt-3 border-t border-slate-800/80">
        <div className="text-xs text-slate-400 mb-2">Recent results</div>
        <div className="flex flex-wrap gap-2">
          {history.slice(-12).reverse().map((round) => (
            <span key={round.id} className="rounded-md border border-slate-700 px-2.5 py-1 font-mono text-sm text-slate-200">
              {round.multiplier.toFixed(2)}x
            </span>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-slate-500">Source: {roomSyncMeta.source} · Experimental estimate; no result is guaranteed.</div>
    </section>
  );
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#0D1320] p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold text-slate-100">{value}</div>
    </div>
  );
}
