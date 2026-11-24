import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { RoundRecord } from '../types';
import { evaluateRoundOutcome, EvaluatedRoundOutcome } from '../utils/accuracyMetrics';
import { computeMedian } from '../utils/precisionPredictor';

interface PerformanceMonitorProps {
  rounds: RoundRecord[];
  defaultExpandedTable?: boolean;
}

interface AnalyzedDeltaRow {
  round: RoundRecord;
  evalRes: EvaluatedRoundOutcome;
  signedDelta: number;
  isSkip: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  rounds,
  defaultExpandedTable = true,
}) => {
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number | null>(null);
  const [tableFilter, setTableFilter] = useState<'ALL' | 'CLOSE' | 'MISS'>('ALL');
  const [showTable, setShowTable] = useState(defaultExpandedTable);

  const last50 = useMemo<AnalyzedDeltaRow[]>(() => {
    return rounds.slice(-50).map((round) => {
      const evalRes = evaluateRoundOutcome(round);
      const isSkip = evalRes.predicted === 0;
      const signedDelta = isSkip
        ? 0
        : Number((evalRes.actual - evalRes.predicted).toFixed(2));
      return { round, evalRes, signedDelta, isSkip };
    });
  }, [rounds]);

  const summary = useMemo(() => {
    const wins = last50.filter((r) => r.evalRes.isTrueWin).length;
    const losses = last50.filter((r) => r.evalRes.outcome === 'LOSS').length;
    const skipped = last50.filter((r) => r.isSkip && !r.evalRes.isTrapAvoided).length;
    const closeHits = last50.filter((r) => r.evalRes.outcome === 'EXACT_WIN').length;
    const decisive = wins + losses;
    const winRatePct = decisive > 0 ? Number(((wins / decisive) * 100).toFixed(1)) : 0;
    const closeHitPct = decisive > 0 ? Number(((closeHits / decisive) * 100).toFixed(1)) : 0;

    const placed = last50.filter((r) => !r.isSkip);
    const rawAbsDeltas = placed.map((r) => Math.abs(r.signedDelta));
    const medianAbsDelta =
      rawAbsDeltas.length > 0 ? computeMedian(rawAbsDeltas) : 0;
    const maxPosDelta = placed.reduce((mx, r) => (r.signedDelta > mx ? r.signedDelta : mx), 0.5);
    const maxNegDelta = placed.reduce(
      (mx, r) => (r.signedDelta < 0 && Math.abs(r.signedDelta) > mx ? Math.abs(r.signedDelta) : mx),
      0.25
    );

    const avgRawMissShortfall = (() => {
      const misses = placed.filter((r) => r.signedDelta < 0);
      if (misses.length === 0) return 0;
      return Number(
        (misses.reduce((acc, m) => acc + Math.abs(m.signedDelta), 0) / misses.length).toFixed(2)
      );
    })();

    // Recent 10-round health check
    const recent10 = last50.slice(-10);
    const r10Wins = recent10.filter((r) => r.evalRes.isTrueWin).length;
    const r10Losses = recent10.filter((r) => r.evalRes.outcome === 'LOSS').length;
    const r10Decisive = r10Wins + r10Losses;
    const r10WinRate = r10Decisive > 0 ? (r10Wins / r10Decisive) * 100 : winRatePct;

    let status: 'OPTIMAL' | 'WATCH' | 'RECALIBRATE' = 'OPTIMAL';
    let feedbackText =
      'Signal corridor is locked onto room volatility. High Close Hit capture inside ≤0.35x cashout zone.';
    if (winRatePct < 60 || r10WinRate < 50) {
      status = 'RECALIBRATE';
      feedbackText =
        'Recent 10-round miss cluster detected. Switch Sensitivity to Tight Corridor or log latest [REDACTED_PROVIDER] crashes.';
    } else if (winRatePct < 74 || r10WinRate < 70) {
      status = 'WATCH';
      feedbackText =
        'Moderate room variance around exits. Respect WAIT_CAUTION cooldowns after ≥4.50x spikes.';
    }

    return {
      count: last50.length,
      wins,
      losses,
      skipped,
      closeHits,
      decisive,
      winRatePct,
      closeHitPct,
      medianAbsDelta,
      maxPosDelta,
      maxNegDelta,
      avgRawMissShortfall,
      r10WinRate: Number(r10WinRate.toFixed(1)),
      status,
      feedbackText,
    };
  }, [last50]);

  const activeInspect = useMemo(() => {
    if (last50.length === 0) return null;
    if (selectedRoundNumber != null) {
      const found = last50.find((r) => r.round.roundNumber === selectedRoundNumber);
      if (found) return found;
    }
    return last50[last50.length - 1];
  }, [last50, selectedRoundNumber]);

  const filteredRows = useMemo(() => {
    return [...last50].reverse().filter((row) => {
      if (tableFilter === 'ALL') return true;
      if (tableFilter === 'CLOSE') return row.evalRes.outcome === 'EXACT_WIN';
      return row.evalRes.outcome === 'LOSS';
    });
  }, [last50, tableFilter]);

  const baselineY = 76;
  const maxPosLog = Math.log1p(summary.maxPosDelta);

  return (
    <section className="rounded-xl bg-[#0D1320] border border-slate-800/80 p-5 sm:p-6 space-y-5">
      {/* Header + Real-Time Status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Performance Monitor · Last {summary.count} Rounds
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Live predicted vs. actual crash delta and signal calibration
          </p>
        </div>

        <span
          className={`text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${
            summary.status === 'OPTIMAL'
              ? 'text-emerald-400'
              : summary.status === 'WATCH'
              ? 'text-amber-300'
              : 'text-rose-400'
          }`}
        >
          {summary.status === 'OPTIMAL' ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>Signal Health: {summary.status === 'OPTIMAL' ? 'Optimal' : summary.status === 'WATCH' ? 'Watch' : 'Recalibrate'}</span>
        </span>
      </div>

      {/* Unified 4-Column KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80 rounded-lg border border-slate-800/80 bg-[#090D16] overflow-hidden font-mono">
        <div className="p-3.5">
          <div className="text-[11px] font-sans text-slate-400">50-Round Win Rate</div>
          <div className="text-xl font-bold text-emerald-400 tabular-nums mt-0.5">
            {summary.winRatePct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {summary.wins}W / {summary.losses}L{summary.skipped > 0 ? ` / ${summary.skipped} Skip` : ''} · {summary.r10WinRate}% 10R
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[11px] font-sans text-slate-400">Close Hits (≤0.35x)</div>
          <div className="text-xl font-bold text-sky-400 tabular-nums mt-0.5">
            {summary.closeHits}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {summary.closeHitPct.toFixed(1)}% exact-band capture
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[11px] font-sans text-slate-400">Raw Median Delta</div>
          <div className="text-xl font-bold text-slate-100 tabular-nums mt-0.5">
            ±{summary.medianAbsDelta.toFixed(2)}x
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Unclipped median error
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[11px] font-sans text-slate-400">Avg Miss Shortfall</div>
          <div className="text-xl font-bold text-rose-400 tabular-nums mt-0.5">
            -{summary.avgRawMissShortfall.toFixed(2)}x
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Mean gap on misses
          </div>
        </div>
      </div>

      {/* Real-time Feedback Line */}
      <div className="flex items-center gap-2 text-xs text-slate-300">
        <Activity className="w-4 h-4 text-sky-400 shrink-0" />
        <span>{summary.feedbackText}</span>
      </div>

      {/* 50-Round Signed Delta Chart (Actual - Predicted) */}
      <div className="rounded-lg bg-[#090D16] border border-slate-800/80 p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span className="font-medium text-slate-300">Chronological Signed Delta (Actual − Predicted)</span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-sky-400" />
              Close Hit
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-emerald-400" />
              Win
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-rose-400" />
              Miss
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Skip
            </span>
          </div>
        </div>

        <svg viewBox="0 0 600 118" className="w-full h-32 overflow-visible">
          {/* Zero Delta Baseline (Predicted Target Line) */}
          <line
            x1="0"
            y1={baselineY}
            x2="600"
            y2={baselineY}
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <text x="2" y={baselineY - 4} fill="#64748b" fontSize="8" fontFamily="monospace">
            Target 0.00x
          </text>

          {/* +0.35x Close Hit Zone Band */}
          <rect
            x="0"
            y={baselineY - (Math.log1p(0.35) / Math.max(0.1, maxPosLog)) * 66}
            width="600"
            height={(Math.log1p(0.35) / Math.max(0.1, maxPosLog)) * 66}
            fill="#38bdf8"
            fillOpacity="0.08"
          />

          {last50.map((item, idx) => {
            const slotW = 600 / Math.max(1, last50.length);
            const barW = Math.max(4, slotW * 0.68);
            const x = idx * slotW + (slotW - barW) / 2;
            const isSelected = activeInspect?.round.roundNumber === item.round.roundNumber;

            if (item.isSkip) {
              return (
                <g
                  key={item.round.id}
                  onMouseEnter={() => setSelectedRoundNumber(item.round.roundNumber)}
                  onClick={() => setSelectedRoundNumber(item.round.roundNumber)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={x + barW / 2}
                    cy={baselineY}
                    r={isSelected ? 4 : 2.8}
                    fill={item.evalRes.isTrapAvoided ? '#38bdf8' : '#f59e0b'}
                  />
                </g>
              );
            }

            const pos = item.signedDelta >= 0;
            const barH = pos
              ? Math.max(3, (Math.log1p(item.signedDelta) / Math.max(0.1, maxPosLog)) * 66)
              : Math.max(4, (Math.abs(item.signedDelta) / Math.max(0.1, summary.maxNegDelta)) * 34);
            const y = pos ? baselineY - barH : baselineY;
            const color =
              item.evalRes.outcome === 'EXACT_WIN'
                ? '#38bdf8'
                : item.evalRes.isTrueWin
                ? '#34d399'
                : '#fb7185';

            return (
              <g
                key={item.round.id}
                onMouseEnter={() => setSelectedRoundNumber(item.round.roundNumber)}
                onClick={() => setSelectedRoundNumber(item.round.roundNumber)}
                className="cursor-pointer"
              >
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx="1.5"
                  fill={color}
                  fillOpacity={isSelected ? 1 : 0.82}
                  stroke={isSelected ? '#ffffff' : 'none'}
                  strokeWidth={isSelected ? 1 : 0}
                />
              </g>
            );
          })}
        </svg>

        {/* Active Bar Inspector */}
        {activeInspect && (
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
            <span className="text-slate-400">
              Round <strong className="text-white">#{activeInspect.round.roundNumber}</strong> ·
              Predicted{' '}
              <strong className="text-sky-300">
                {activeInspect.isSkip ? 'SKIP' : `${activeInspect.evalRes.predicted.toFixed(2)}x`}
              </strong>{' '}
              · Actual{' '}
              <strong className="text-white">{activeInspect.evalRes.actual.toFixed(2)}x</strong>
            </span>
            <span
              className={`font-semibold ${
                activeInspect.evalRes.outcome === 'EXACT_WIN'
                  ? 'text-sky-300'
                  : activeInspect.evalRes.isTrueWin
                  ? 'text-emerald-400'
                  : activeInspect.isSkip
                  ? 'text-amber-300'
                  : 'text-rose-400'
              }`}
            >
              {activeInspect.isSkip
                ? activeInspect.evalRes.label
                : `Δ ${activeInspect.signedDelta >= 0 ? '+' : ''}${activeInspect.signedDelta.toFixed(2)}x · ${activeInspect.evalRes.label}`}
            </span>
          </div>
        )}
      </div>

      {/* Collapsible 50-Round Delta Ledger */}
      <div className="pt-1 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <span>{showTable ? 'Hide' : 'Show'} 50-Round Delta Log ({filteredRows.length})</span>
            {showTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showTable && (
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#090D16] border border-slate-800/80 text-xs">
              {([
                { id: 'ALL', label: 'All' },
                { id: 'CLOSE', label: 'Close Hits' },
                { id: 'MISS', label: 'Misses' },
              ] as const).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTableFilter(f.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    tableFilter === f.id
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {showTable && (
          <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-lg border border-slate-800/80 bg-[#090D16]">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead className="sticky top-0 bg-[#090D16] border-b border-slate-800 text-[11px] font-sans font-medium text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Round</th>
                  <th className="py-2.5 px-3 text-right">Predicted</th>
                  <th className="py-2.5 px-3 text-right">Actual</th>
                  <th className="py-2.5 px-3 text-right">Delta (Act − Pred)</th>
                  <th className="py-2.5 px-3 text-right">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRows.map((row) => (
                  <tr
                    key={row.round.id}
                    onClick={() => setSelectedRoundNumber(row.round.roundNumber)}
                    className="hover:bg-slate-800/35 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 text-slate-300 tabular-nums">#{row.round.roundNumber}</td>
                    <td className="py-2 px-3 text-right text-slate-300 tabular-nums">
                      {row.isSkip ? 'SKIP' : `${row.evalRes.predicted.toFixed(2)}x`}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-white tabular-nums">
                      {row.evalRes.actual.toFixed(2)}x
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold tabular-nums ${
                        row.isSkip
                          ? 'text-amber-300'
                          : row.signedDelta >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {row.isSkip
                        ? '—'
                        : `${row.signedDelta >= 0 ? '+' : ''}${row.signedDelta.toFixed(2)}x`}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`text-[11px] font-sans font-semibold whitespace-nowrap ${
                          row.evalRes.outcome === 'EXACT_WIN'
                            ? 'text-sky-300'
                            : row.evalRes.isTrueWin
                            ? 'text-emerald-400'
                            : row.isSkip
                            ? 'text-amber-300'
                            : 'text-rose-400'
                        }`}
                      >
                        {row.evalRes.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
