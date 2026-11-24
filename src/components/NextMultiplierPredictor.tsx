import React, { useMemo } from 'react';
import { ApiConfig, RoomSyncMeta, RoundRecord } from '../types';
import { PrecisionForecastResult } from '../utils/precisionPredictor';

interface Props {
  history: RoundRecord[];
  signal: PrecisionForecastResult;
  currentRoundNumber: number;
  apiConfig: ApiConfig;
  roomSyncMeta: RoomSyncMeta;
}

export const NextMultiplierPredictor: React.FC<Props> = ({ history, signal, currentRoundNumber, apiConfig, roomSyncMeta }) => {
  const probabilityAbove2 = useMemo(() => {
    const values = history.map((round) => round.multiplier).filter((value) => Number.isFinite(value) && value >= 1);
    return values.length ? (values.filter((value) => value >= 2).length / values.length) * 100 : 0;
  }, [history]);

  return (
    <section className="rounded-xl bg-[#0D1320] border border-slate-800/80 p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          <span className="font-semibold text-slate-200">Round #{currentRoundNumber}</span>
          <span> · {apiConfig.provider} historical analysis</span>
        </div>
        <span className="text-xs font-mono text-amber-300">DESCRIPTIVE ONLY</span>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        Past multipliers do not reveal the next result. This page reports historical frequencies and uncertainty; it does not guarantee an outcome or recommend staking money.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Median" value={`${signal.medianMultiplier.toFixed(2)}x`} />
        <Metric label="10th percentile" value={`${signal.percentiles.p10.toFixed(2)}x`} />
        <Metric label="90th percentile" value={`${signal.percentiles.p90.toFixed(2)}x`} />
        <Metric label="Historical P(X ≥ 2x)" value={`${probabilityAbove2.toFixed(1)}%`} />
      </div>

      <div className="text-xs font-mono text-slate-400">
        90% historical range: [{signal.confidenceInterval.lower.toFixed(2)}x – {signal.confidenceInterval.upper.toFixed(2)}x]
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

      <div className="text-[11px] text-slate-500">Source: {roomSyncMeta.source} · {history.length} rounds loaded</div>
    </section>
  );
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#090D16] p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold text-slate-100">{value}</div>
    </div>
  );
}
