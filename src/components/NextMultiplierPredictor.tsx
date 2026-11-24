import React, { useMemo, useState } from 'react';
import { ApiConfig, RoomSyncMeta, RoundRecord } from '../types';
import { PrecisionForecastResult, SensitivityMode, FlightTier } from '../utils/precisionPredictor';
import { backtestExceedance, estimateExceedance } from '../utils/probabilityEstimate';

interface Props {
  history: RoundRecord[];
  signal: PrecisionForecastResult;
  currentRoundNumber: number;
  apiConfig: ApiConfig;
  roomSyncMeta: RoomSyncMeta;
  sensitivityMode?: SensitivityMode;
  flightTier?: FlightTier;
  proximityRatio?: number;
  customAnchorMultiplier?: number;
  volatilityNudge?: number;
  isScanningScreenshot?: boolean;
  scanStatusMessage?: string | null;
  onChangeSensitivity?: (mode: SensitivityMode) => void;
  onChangeFlightTier?: (tier: FlightTier) => void;
  onChangeProximityRatio?: (ratio: number) => void;
  onChangeCustomAnchor?: (value?: number) => void;
  onLogRound?: (multiplier: number, roundNum?: number) => Promise<void> | void;
  onLogBatchRounds?: (multipliers: number[]) => Promise<void> | void;
  onSyncHistory?: (multipliers: number[], order: 'newest_first' | 'oldest_first') => Promise<void> | void;
  onScanScreenshot?: (file: File) => Promise<void> | void;
  onAdvanceNextRound?: () => Promise<void> | void;
  onToggleDataSource?: () => void;
}

export const NextMultiplierPredictor: React.FC<Props> = ({ history, signal, currentRoundNumber, apiConfig, roomSyncMeta }) => {
  const [threshold, setThreshold] = useState(2);
  const values = useMemo(
    () => history.map((round) => Number(round.multiplier)).filter((value) => Number.isFinite(value) && value >= 1),
    [history],
  );
  const estimate = useMemo(() => estimateExceedance(values, threshold), [values, threshold]);
  const backtest = useMemo(() => backtestExceedance(values, threshold), [values, threshold]);

  return (
    <section className="rounded-xl bg-[#0D1320] border border-slate-800/80 p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          <span className="font-semibold text-slate-200">Next round #{currentRoundNumber}</span>
          <span> · {apiConfig.provider}</span>
        </div>
        <span className="text-xs font-mono text-amber-300">PROBABILITY ESTIMATE · NOT A CERTAINTY</span>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        This estimates the next round’s chance of reaching a chosen multiplier by assuming past rounds are representative. If rounds are independent, history does not predict the next result. It is not betting advice and cannot guarantee an outcome.
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">
          Estimate chance of reaching
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
        <div className="text-xs text-slate-400">Based on {estimate.sampleSize} recorded rounds</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metric label={`Estimated P(X ≥ ${threshold.toFixed(1)}x)`} value={`${estimate.probabilityPct.toFixed(1)}%`} />
        <Metric label="95% sampling interval" value={`${estimate.lower95Pct.toFixed(1)}–${estimate.upper95Pct.toFixed(1)}%`} />
        <Metric label="Historical median" value={`${signal.medianMultiplier.toFixed(2)}x`} />
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Estimated frequency: {estimate.successes}/{estimate.sampleSize} historical rounds reached {threshold.toFixed(1)}x. The interval describes sampling uncertainty in this history; it does not account for changes in the game or prove predictive power.
      </p>

      <div className="rounded-lg border border-slate-800 bg-[#090D16] p-4 space-y-2">
        <div className="text-sm font-semibold text-slate-200">Chronological holdout check</div>
        {backtest.evaluatedRounds > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <Metric label="Unseen rounds tested" value={String(backtest.evaluatedRounds)} />
              <Metric label="Expanding estimate Brier" value={String(backtest.modelBrier)} />
              <Metric label="Train-only baseline Brier" value={String(backtest.baselineBrier)} />
            </div>
            <p className="text-[11px] text-slate-500">Lower Brier scores are better. The test uses only earlier rounds to estimate each later round. A similar or worse score than baseline means no demonstrated improvement on this sample.</p>
          </>
        ) : (
          <p className="text-xs text-slate-500">At least 31 valid historical rounds are needed for a chronological holdout check.</p>
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
      <div className="text-[11px] text-slate-500">Source: {roomSyncMeta.source} · estimates are descriptive, not guaranteed predictions.</div>
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
