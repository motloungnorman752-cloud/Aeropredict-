import React from 'react';
import { TrendingUp } from 'lucide-react';
import { TrendAnalytics } from '../types';

interface AnalyticsViewProps {
  trends: TrendAnalytics;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ trends }) => {
  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-[#0D1320] border border-slate-800/80 p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">Trend &amp; Distribution Analytics</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Rolling moving averages, volatility dispersion, and empirical RTP calibration
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>97.0% RTP Baseline</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80 rounded-lg border border-slate-800/80 bg-[#090D16] overflow-hidden font-mono">
          <div className="p-3.5">
            <div className="text-[11px] font-sans text-slate-400">SMA (5R / 15R)</div>
            <div className="text-lg font-bold text-white mt-0.5 tabular-nums">
              {trends.sma5.toFixed(2)}x / {trends.sma15.toFixed(2)}x
            </div>
            <div className="text-[11px] text-sky-300 mt-0.5 font-sans">
              {trends.trendDirection.replace(/_/g, ' ')}
            </div>
          </div>

          <div className="p-3.5">
            <div className="text-[11px] font-sans text-slate-400">Volatility Index</div>
            <div className="text-lg font-bold text-amber-300 mt-0.5 tabular-nums">
              {trends.volatilityIndex.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-sans tabular-nums">
              Streak: {trends.currentStreakLength}x {trends.currentStreakType.replace(/_/g, ' ')}
            </div>
          </div>

          <div className="p-3.5">
            <div className="text-[11px] font-sans text-slate-400">Pink Cycle Readiness</div>
            <div className="text-lg font-bold text-fuchsia-300 mt-0.5 tabular-nums">
              {trends.pinkCycleReadinessPct}%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-sans tabular-nums">
              {trends.roundsSinceLastPink}r since 10x+ (avg {trends.avgPinkInterval}r)
            </div>
          </div>

          <div className="p-3.5">
            <div className="text-[11px] font-sans text-slate-400">Reversion Signal</div>
            <div className="text-sm font-bold text-emerald-400 mt-1 font-sans">
              {trends.reversionSignal.replace(/_/g, ' ')}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 tabular-nums">
              Sample RTP: {trends.sampleRtp.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Probability Calibration Table */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-medium text-slate-300">
            Empirical vs. Theoretical Hit Probabilities
          </h3>
          <div className="overflow-x-auto rounded-lg border border-slate-800/80 bg-[#090D16]">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead className="border-b border-slate-800 text-[11px] font-sans font-medium text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Target</th>
                  <th className="py-2.5 px-3 text-right">Theoretical (0.97/M)</th>
                  <th className="py-2.5 px-3 text-right">Live Empirical</th>
                  <th className="py-2.5 px-3 text-right">Deviation</th>
                  <th className="py-2.5 px-3 text-right">Adjusted Odds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {trends.probabilities.map((row) => (
                  <tr key={row.target} className="hover:bg-slate-800/35 transition-colors">
                    <td className="py-2 px-3 font-semibold text-white tabular-nums">
                      {row.target.toFixed(2)}x
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300 tabular-nums">
                      {row.theoreticalPct.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-right text-sky-300 tabular-nums">
                      {row.empiricalPct.toFixed(1)}%
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold tabular-nums ${
                        row.deviation >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {row.deviation >= 0 ? `+${row.deviation.toFixed(1)}%` : `${row.deviation.toFixed(1)}%`}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-100 tabular-nums">
                      {row.adjustedPredictionPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
