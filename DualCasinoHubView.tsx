import React, { useRef, useState } from 'react';
import { Camera, Check, Copy, Layers, Plus, RefreshCw } from 'lucide-react';
import { ApiConfig, RoundRecord } from '../types';
import { copyTextSafely } from '../utils/clipboard';
import { PrecisionForecastResult } from '../utils/precisionPredictor';

interface DualCasinoHubViewProps {
  apiConfig: ApiConfig;
  currentRoundNumber: number;
  signal: PrecisionForecastResult;
  recentRounds: RoundRecord[];
  isScanningScreenshot: boolean;
  scanStatusMessage: string | null;
  onSelectProvider: (provider: ApiConfig['provider']) => void;
  onLogRound: (multiplier: number) => Promise<void> | void;
  onLogBatchRounds: (multipliers: number[]) => Promise<void> | void;
  onScanScreenshot: (file: File) => Promise<void> | void;
}

const PROVIDERS: ApiConfig['provider'][] = [
  '[REDACTED_PROVIDER]',
  '[REDACTED_PROVIDER_2]',
  '[REDACTED_PROVIDER_3]',
  '[REDACTED_PROVIDER_5]',
  '[REDACTED_PROVIDER_6]',
];

export const DualCasinoHubView: React.FC<DualCasinoHubViewProps> = ({
  apiConfig,
  currentRoundNumber,
  signal,
  recentRounds,
  isScanningScreenshot,
  scanStatusMessage,
  onSelectProvider,
  onLogRound,
  onLogBatchRounds,
  onScanScreenshot,
}) => {
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isSkip = signal.actionRecommendation === 'SKIP_ROUND';
  const target = isSkip ? 0 : signal.closeExitTarget;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nums = input
      .replace(/x/gi, ' ')
      .split(/[\s,;|\n\t]+/)
      .map((t) => Number(t.trim()))
      .filter((n) => !isNaN(n) && isFinite(n) && n >= 1.0 && n <= 10000);
    if (nums.length === 0) return;
    setInput('');
    if (nums.length === 1) {
      await onLogRound(nums[0]);
    } else {
      await onLogBatchRounds(nums);
    }
  };

  const handleCopy = async () => {
    if (isSkip) return;
    const ok = await copyTextSafely(target.toFixed(2));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <section className="rounded-xl bg-[#0D1320] border border-slate-800/80 p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400 shrink-0" />
          <h2 className="text-sm font-semibold text-white">Dual-Screen Companion Cockpit</h2>
        </div>
        <span className="text-xs font-mono text-slate-400 tabular-nums">
          Round #{currentRoundNumber} · {apiConfig.provider}
        </span>
      </div>

      {/* Provider Switcher */}
      <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-[#090D16] border border-slate-800/80">
        {PROVIDERS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onSelectProvider(p)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              apiConfig.provider === p
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Split-screen Signal + Quick Logger */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800/80 rounded-lg border border-slate-800/80 bg-[#090D16] overflow-hidden">
        <div className="p-4 sm:p-5 space-y-3">
          <div className="text-xs font-medium text-slate-400">Active Cashout Signal</div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-3xl font-bold font-mono text-emerald-400 tabular-nums">
              {isSkip ? 'SKIP' : `${target.toFixed(2)}x`}
            </div>
            <button
              type="button"
              disabled={isSkip}
              onClick={handleCopy}
              className="h-9 px-3.5 rounded-lg bg-[#0D1320] hover:bg-slate-800 disabled:opacity-40 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="text-xs font-mono text-slate-400 tabular-nums">
            Safe Floor {signal.safeMultiplier.toFixed(2)}x · Est. Ceiling ~
            {signal.projectedCeiling.toFixed(2)}x
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-3">
          <div className="text-xs font-medium text-slate-400">Rapid Crash Log &amp; OCR</div>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Crash e.g. 2.82"
              className="flex-1 min-w-[130px] h-9 px-3 rounded-lg bg-[#0D1320] border border-slate-700/80 text-xs font-mono text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log</span>
            </button>
            <button
              type="button"
              disabled={isScanningScreenshot}
              onClick={() => fileRef.current?.click()}
              className="h-9 px-3.5 rounded-lg bg-[#0D1320] hover:bg-slate-800 disabled:opacity-50 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              {isScanningScreenshot ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span>Scan Bar</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await onScanScreenshot(file);
                e.target.value = '';
              }}
              className="hidden"
            />
          </form>
          {scanStatusMessage && (
            <p className="text-xs text-sky-300">{scanStatusMessage}</p>
          )}
        </div>
      </div>

      {/* Recent Synced Tail */}
      <div className="pt-2 border-t border-slate-800/80 space-y-2">
        <div className="text-xs font-medium text-slate-400">
          Latest {apiConfig.provider} Ribbon (Newest First)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {recentRounds
            .slice(-12)
            .reverse()
            .map((r) => (
              <span
                key={r.id}
                className="px-2.5 py-1 rounded bg-[#090D16] border border-slate-800/80 text-xs font-mono font-medium text-slate-200 tabular-nums"
              >
                #{r.roundNumber}: {r.multiplier.toFixed(2)}x
              </span>
            ))}
        </div>
      </div>
    </section>
  );
};
