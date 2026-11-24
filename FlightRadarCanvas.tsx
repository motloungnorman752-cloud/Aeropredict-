import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { FlightPhase, RoundRecord } from '../types';
import { PrecisionForecastResult } from '../utils/precisionPredictor';

interface FlightRadarCanvasProps {
  roundNumber: number;
  phase: FlightPhase;
  currentMultiplier: number;
  countdownSeconds: number;
  signal: PrecisionForecastResult;
  lastRound?: RoundRecord;
  onInspectFairness?: () => void;
}

export const FlightRadarCanvas: React.FC<FlightRadarCanvasProps> = ({
  roundNumber,
  phase,
  currentMultiplier,
  countdownSeconds,
  signal,
  lastRound,
  onInspectFairness,
}) => {
  const safe = signal.safeMultiplier;
  const target = signal.closeExitTarget;
  const ceiling = Math.max(target + 0.5, signal.projectedCeiling);

  return (
    <section className="rounded-xl bg-[#0D1320] border border-slate-800/80 p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">
          Flight Trajectory Corridor · Round #{roundNumber}
        </h2>
        <span className="text-xs font-mono text-slate-400 tabular-nums">
          {phase === 'COUNTDOWN'
            ? `Next flight in ${countdownSeconds.toFixed(1)}s`
            : phase === 'FLYING'
            ? `Live telemetry ${currentMultiplier.toFixed(2)}x`
            : `Last crashed @ ${lastRound ? lastRound.multiplier.toFixed(2) : '1.00'}x`}
        </span>
      </div>

      {/* Trajectory SVG Curve */}
      <div className="rounded-lg bg-[#090D16] border border-slate-800/80 p-3 overflow-hidden">
        <svg viewBox="0 0 600 180" className="w-full h-40 overflow-visible">
          <defs>
            <linearGradient id="flightCurveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid Lines */}
          {[40, 80, 120, 160].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="600"
              y2={y}
              stroke="#1e293b"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          ))}

          {/* Target Corridor Band */}
          <rect
            x="0"
            y="48"
            width="600"
            height="34"
            fill="#10b981"
            fillOpacity="0.07"
          />
          <line x1="0" y1="82" x2="600" y2="82" stroke="#10b981" strokeDasharray="3 3" strokeOpacity="0.55" />
          <line x1="0" y1="48" x2="600" y2="48" stroke="#38bdf8" strokeDasharray="3 3" strokeOpacity="0.55" />

          {/* Area & Exponential Path */}
          <path
            d="M 10 165 Q 240 155 560 28 L 560 165 Z"
            fill="url(#flightCurveFill)"
          />
          <path
            d="M 10 165 Q 240 155 560 28"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Marker Nodes */}
          <circle cx="340" cy="82" r="4.5" fill="#10b981" />
          <text x="352" y="96" fill="#6ee7b7" fontSize="11" fontFamily="monospace">
            Safe {safe.toFixed(2)}x
          </text>

          <circle cx="470" cy="48" r="5" fill="#38bdf8" />
          <text x="372" y="39" fill="#7dd3fc" fontSize="11" fontFamily="monospace">
            Exit {target.toFixed(2)}x
          </text>

          <circle cx="560" cy="28" r="5" fill="#f59e0b" />
          <text x="480" y="18" fill="#fcd34d" fontSize="11" fontFamily="monospace">
            Ceil ~{ceiling.toFixed(2)}x
          </text>
        </svg>
      </div>

      {/* Provably Fair Verification Footer */}
      {lastRound && (
        <div className="pt-2 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Last Settled #{lastRound.roundNumber} · Nonce {lastRound.nonce} · {lastRound.multiplier.toFixed(2)}x
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-slate-400">
              Commit {lastRound.serverSeedHash.slice(0, 12)}…
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-slate-400">
              Client {lastRound.clientSeed.slice(0, 12)}…
            </span>
          </div>

          {onInspectFairness && (
            <button
              type="button"
              onClick={onInspectFairness}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 whitespace-nowrap transition-colors"
            >
              Inspect Seeds, Formula &amp; API →
            </button>
          )}
        </div>
      )}
    </section>
  );
};
