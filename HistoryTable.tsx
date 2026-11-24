import React, { useMemo, useState } from 'react';
import { RoundRecord } from '../types';
import { computeAccuracyMetrics, evaluateRoundOutcome } from '../utils/accuracyMetrics';

interface HistoryTableProps {
  rounds: RoundRecord[];
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ rounds }) => {
  const [filter, setFilter] = useState<'ALL' | 'WIN' | 'MISS'>('ALL');

  const sortedNewest = useMemo(() => [...rounds].reverse(), [rounds]);
  const metrics = useMemo(() => computeAccuracyMetrics(rounds.slice(-60)), [rounds]);

  const filtered = useMemo(() => {
    return sortedNewest.filter((r) => {
      if (filter === 'ALL') return true;
      const evalRes = evaluateRoundOutcome(r);
      return filter === 'WIN' ? evalRes.isTrueWin : !evalRes.isTrueWin;
    });
  }, [sortedNewest, filter]);

  return (
    <section className="rounded-xl bg-[#0D1320] border border-slate-800/80 p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Verified Round Ledger</h2>
          <p className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
            Last 60 rounds: {metrics.wins}/{metrics.total} Wins ({metrics.winRatePct}%) ·{' '}
            {metrics.exactHits} Close Hits
          </p>
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#090D16] border border-slate-800/80">
          {([
            { id: 'ALL', label: 'All' },
            { id: 'WIN', label: 'Wins' },
            { id: 'MISS', label: 'Misses' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                filter === tab.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800/80 bg-[#090D16]">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead className="border-b border-slate-800 text-[11px] font-sans font-medium text-slate-400">
            <tr>
              <th className="py-2.5 px-3">Round</th>
              <th className="py-2.5 px-3 text-right">Actual Crash</th>
              <th className="py-2.5 px-3 text-right">Bot Target</th>
              <th className="py-2.5 px-3 text-right">Delta</th>
              <th className="py-2.5 px-3">Outcome</th>
              <th className="py-2.5 px-3">Risk</th>
              <th className="py-2.5 px-3 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((round) => {
              const evalRes = evaluateRoundOutcome(round);
              const mult = round.multiplier;
              const signedDelta = evalRes.predicted === 0 ? 0 : Number((mult - evalRes.predicted).toFixed(2));
              const multColor =
                mult >= 10
                  ? 'text-fuchsia-300'
                  : mult >= 2.0
                  ? 'text-indigo-300'
                  : 'text-sky-300';

              return (
                <tr key={round.id} className="hover:bg-slate-800/35 transition-colors">
                  <td className="py-2 px-3 text-slate-300 tabular-nums">#{round.roundNumber}</td>
                  <td className={`py-2 px-3 text-right font-semibold tabular-nums ${multColor}`}>
                    {mult.toFixed(2)}x
                  </td>
                  <td className="py-2 px-3 text-right text-slate-300 tabular-nums">
                    {evalRes.predicted === 0 ? 'SKIP' : `${evalRes.predicted.toFixed(2)}x`}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-semibold tabular-nums ${
                      evalRes.predicted === 0
                        ? 'text-amber-300'
                        : signedDelta >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {evalRes.predicted === 0
                      ? '—'
                      : `${signedDelta >= 0 ? '+' : ''}${signedDelta.toFixed(2)}x`}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`font-sans text-[11px] font-semibold whitespace-nowrap ${
                        evalRes.outcome === 'EXACT_WIN'
                          ? 'text-sky-300'
                          : evalRes.isTrueWin
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {evalRes.label}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`font-sans text-[11px] font-medium ${
                        round.riskLevel === 'HIGH'
                          ? 'text-rose-400'
                          : round.riskLevel === 'MEDIUM'
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {round.riskLevel === 'HIGH' ? 'High' : round.riskLevel === 'MEDIUM' ? 'Medium' : 'Low'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-slate-500 tabular-nums">
                    {new Date(round.crashTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
