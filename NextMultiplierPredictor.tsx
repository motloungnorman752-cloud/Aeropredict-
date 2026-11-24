import React, { useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Layers,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import { ApiConfig, RoomSyncMeta, RoundRecord } from '../types';
import { evaluateRoundOutcome } from '../utils/accuracyMetrics';
import { copyTextSafely } from '../utils/clipboard';
import {
  calculateSequenceForecast,
  FlightTier,
  PrecisionForecastResult,
  SensitivityMode,
} from '../utils/precisionPredictor';

interface NextMultiplierPredictorProps {
  history: RoundRecord[];
  signal: PrecisionForecastResult;
  currentRoundNumber: number;
  apiConfig: ApiConfig;
  roomSyncMeta: RoomSyncMeta;
  sensitivityMode: SensitivityMode;
  flightTier: FlightTier;
  proximityRatio: number;
  customAnchorMultiplier?: number;
  volatilityNudge?: number;
  isScanningScreenshot: boolean;
  scanStatusMessage: string | null;
  onChangeSensitivity: (mode: SensitivityMode) => void;
  onChangeFlightTier: (tier: FlightTier) => void;
  onChangeProximityRatio: (ratio: number) => void;
  onChangeCustomAnchor: (val?: number) => void;
  onLogRound: (multiplier: number, roundNum?: number) => Promise<void> | void;
  onLogBatchRounds: (multipliers: number[]) => Promise<void> | void;
  onSyncHistory: (multipliers: number[], order: 'newest_first' | 'oldest_first') => Promise<void> | void;
  onScanScreenshot: (file: File) => Promise<void> | void;
  onAdvanceNextRound: () => Promise<void> | void;
  onToggleDataSource: () => void;
}

const SENSITIVITY_OPTIONS: { id: SensitivityMode; label: string }[] = [
  { id: 'TIGHT_CORRIDOR', label: 'Tight Corridor' },
  { id: 'BALANCED', label: 'Balanced' },
  { id: 'PINK_HUNTER', label: 'Pink Hunter' },
];

const FLIGHT_TIER_OPTIONS: { id: FlightTier; label: string }[] = [
  { id: 'AUTO', label: 'Auto' },
  { id: 'SAFE_150', label: 'Safe 1.5x' },
  { id: 'MEDIAN_CORRIDOR', label: 'Median' },
  { id: 'PURPLE_304', label: 'Purple 3x' },
  { id: 'PINK_HIGH', label: 'Pink 10x+' },
  { id: 'PASS', label: 'Skip / Pass' },
];

export const NextMultiplierPredictor: React.FC<NextMultiplierPredictorProps> = ({
  history,
  signal,
  currentRoundNumber,
  apiConfig,
  roomSyncMeta,
  sensitivityMode,
  flightTier,
  proximityRatio,
  customAnchorMultiplier,
  volatilityNudge = 0,
  isScanningScreenshot,
  scanStatusMessage,
  onChangeSensitivity,
  onChangeFlightTier,
  onChangeProximityRatio,
  onChangeCustomAnchor,
  onLogRound,
  onLogBatchRounds,
  onSyncHistory,
  onScanScreenshot,
  onAdvanceNextRound,
  onToggleDataSource,
}) => {
  const [quickInput, setQuickInput] = useState('');
  const [quickError, setQuickError] = useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showPasteDrawer, setShowPasteDrawer] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);
  const [customAnchorInput, setCustomAnchorInput] = useState(
    customAnchorMultiplier ? String(customAnchorMultiplier) : ''
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isSkip = signal.actionRecommendation === 'SKIP_ROUND';
  const isCaution = signal.actionRecommendation === 'WAIT_CAUTION';
  const isPractice = apiConfig.dataSourceMode === 'ALGORITHMIC_SIMULATOR';

  const heroTarget = isSkip ? 0 : signal.closeExitTarget;

  const lastRecordedRound = history.length > 0 ? history[history.length - 1].roundNumber : currentRoundNumber - 1;
  const aheadSteps = Math.max(0, currentRoundNumber - (lastRecordedRound + 1));

  // Dynamic 6-round lookahead forecast
  const sixRoundForecast = useMemo(() => {
    return calculateSequenceForecast(
      history,
      currentRoundNumber,
      6,
      apiConfig.provider,
      sensitivityMode,
      flightTier,
      proximityRatio,
      customAnchorMultiplier,
      volatilityNudge
    );
  }, [
    history,
    currentRoundNumber,
    apiConfig.provider,
    sensitivityMode,
    flightTier,
    proximityRatio,
    customAnchorMultiplier,
    volatilityNudge,
  ]);

  // Verified Bot Results: latest 8 finished rounds (newest left/first)
  const verifiedLast8 = useMemo(() => {
    return history
      .slice(-8)
      .reverse()
      .map((round) => ({
        round,
        evalResult: evaluateRoundOutcome(round),
      }));
  }, [history]);

  const parseMultipliers = (raw: string): number[] => {
    return raw
      .replace(/x/gi, ' ')
      .split(/[\s,;|\n\t]+/)
      .map((token) => Number(token.trim()))
      .filter((n) => !isNaN(n) && isFinite(n) && n >= 1.0 && n <= 10000);
  };

  const handleQuickSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setQuickError(null);
    const nums = parseMultipliers(quickInput);
    if (nums.length === 0) {
      setQuickError('Enter a crash multiplier >= 1.00 (e.g. 2.82 or 1.26 5.64).');
      return;
    }
    setQuickInput('');
    if (nums.length === 1) {
      await onLogRound(nums[0]);
    } else {
      await onLogBatchRounds(nums);
    }
  };

  const handlePasteSync = async () => {
    const nums = parseMultipliers(pasteText);
    if (nums.length === 0) return;
    await onSyncHistory(nums, newestFirst ? 'newest_first' : 'oldest_first');
    setPasteText('');
    setShowPasteDrawer(false);
  };

  const handleCopyTarget = async () => {
    if (isSkip) return;
    const ok = await copyTextSafely(`${heroTarget.toFixed(2)}`);
    if (ok) {
      setCopiedTarget(true);
      setTimeout(() => setCopiedTarget(false), 1600);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onScanScreenshot(file);
    }
    e.target.value = '';
  };

  return (
    <section className="rounded-xl bg-[#0D1320] border border-slate-800/80 p-5 sm:p-6 space-y-5">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 text-xs text-slate-400">
          <span className="font-semibold text-slate-200 whitespace-nowrap">
            Round #{currentRoundNumber}
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{apiConfig.provider} Target</span>
          {aheadSteps > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-sky-400 font-mono tabular-nums whitespace-nowrap">
                +{aheadSteps}r Lookahead
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs font-medium shrink-0">
          <button
            type="button"
            onClick={onToggleDataSource}
            className="text-slate-400 hover:text-white flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <Play className="w-3 h-3 text-slate-400" />
            <span>{isPractice ? 'Switch to Live' : 'Practice Stream'}</span>
          </button>
          <span className="h-3.5 w-px bg-slate-800" aria-hidden="true" />
          <span
            className={`font-mono text-xs font-semibold whitespace-nowrap ${
              isSkip ? 'text-rose-400' : isCaution ? 'text-amber-300' : 'text-emerald-400'
            }`}
          >
            {isSkip ? 'Skip Round' : isCaution ? 'Caution Window' : 'Bet Safe'}
          </span>
        </div>
      </div>

      {/* Hero Target + Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="text-4xl sm:text-5xl font-bold font-mono tracking-tight tabular-nums text-emerald-400">
            {isSkip ? (
              <span className="text-rose-400">SKIP</span>
            ) : (
              `${heroTarget.toFixed(2)}x`
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400 tabular-nums">
            <span>
              Safe Floor{' '}
              <strong className="text-slate-200 font-semibold">
                {isSkip ? '—' : `${signal.safeMultiplier.toFixed(2)}x`}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Est. Crash{' '}
              <strong className="text-amber-300 font-semibold">
                ~{signal.projectedCeiling.toFixed(2)}x
              </strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={isSkip}
            onClick={handleCopyTarget}
            className="h-9 px-3.5 rounded-lg bg-[#090D16] hover:bg-slate-800 disabled:opacity-40 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            {copiedTarget ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{copiedTarget ? 'Copied' : `Copy ${heroTarget.toFixed(2)}x`}</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              if (quickInput.trim().length > 0) {
                const nums = parseMultipliers(quickInput);
                if (nums.length === 1) {
                  setQuickInput('');
                  await onLogRound(nums[0]);
                  return;
                } else if (nums.length > 1) {
                  setQuickInput('');
                  await onLogBatchRounds(nums);
                  return;
                }
              }
              await onAdvanceNextRound();
            }}
            className="h-9 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
          >
            <span>Next #{currentRoundNumber + 1}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Instruction + Crash Logger */}
      <div className="space-y-2.5">
        <p className="text-xs text-slate-400 leading-relaxed">
          {isSkip ? (
            <span className="text-rose-300 font-medium">{signal.hazardReason}</span>
          ) : (
            <>
              Set {apiConfig.provider} Auto Cashout to{' '}
              <span className="text-white font-semibold font-mono">{heroTarget.toFixed(2)}x</span>, then log the finished crash result below.
            </>
          )}
        </p>

        <form onSubmit={handleQuickSubmit} className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Crash e.g. 2.82"
              className="flex-1 min-w-[140px] h-9 px-3 rounded-lg bg-[#090D16] border border-slate-700/80 focus:border-sky-500 focus:outline-none text-xs font-mono text-white placeholder:text-slate-500"
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
              onClick={() => fileInputRef.current?.click()}
              className="h-9 px-3.5 rounded-lg bg-[#090D16] hover:bg-slate-800 disabled:opacity-50 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              {isScanningScreenshot ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span>{isScanningScreenshot ? 'Scanning...' : 'Scan Bar'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          {quickError && <p className="text-xs text-rose-400">{quickError}</p>}
          {scanStatusMessage && <p className="text-xs text-sky-300">{scanStatusMessage}</p>}
        </form>
      </div>

      {/* Clean Unboxed Diagnostic Strip + Tune Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 border-y border-slate-800/80 text-xs font-mono tabular-nums">
        <div className="flex flex-wrap items-center gap-3 text-slate-400">
          <span>
            Median <strong className="text-slate-100">~{signal.medianMultiplier.toFixed(2)}x</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {signal.confidenceInterval.levelPct}% CI{' '}
            <strong className="text-slate-100">
              [{signal.confidenceInterval.lower.toFixed(2)}–
              {signal.confidenceInterval.upper.toFixed(2)}x]
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            10R Delta{' '}
            <strong className="text-slate-100">±{signal.rollingWindow.rollingDelta.toFixed(2)}x</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowControls((v) => !v)}
          className="text-xs font-sans font-medium text-slate-300 hover:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
          <span>Parameters</span>
          {showControls ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Collapsible Sensitivity, Flight Tier & Custom Anchor Controls */}
      {showControls && (
        <div className="p-4 rounded-lg bg-[#090D16] border border-slate-800/80 space-y-4 text-xs">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-400">Sensitivity Regime</div>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#0D1320] border border-slate-800/80">
              {SENSITIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeSensitivity(opt.id)}
                  className={`py-1.5 px-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    sensitivityMode === opt.id
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-400">Flight Tier Override</div>
            <div className="flex flex-wrap gap-1.5">
              {FLIGHT_TIER_OPTIONS.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => onChangeFlightTier(tier.id)}
                  className={`py-1.5 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    flightTier === tier.id
                      ? 'bg-sky-600 text-white'
                      : 'bg-[#0D1320] border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 tabular-nums">
                Ceiling Proximity: {Math.round(proximityRatio * 100)}%
              </label>
              <input
                type="range"
                min={0.65}
                max={0.96}
                step={0.01}
                value={proximityRatio}
                onChange={(e) => onChangeProximityRatio(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Custom Anchor (Optional)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="1.10"
                  value={customAnchorInput}
                  onChange={(e) => setCustomAnchorInput(e.target.value)}
                  placeholder="e.g. 2.50"
                  className="flex-1 h-8 px-2.5 rounded-lg bg-[#0D1320] border border-slate-800 text-xs font-mono text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    const num = Number(customAnchorInput);
                    if (!isNaN(num) && num >= 1.1) {
                      onChangeCustomAnchor(num);
                      onChangeFlightTier('CUSTOM');
                    } else {
                      onChangeCustomAnchor(undefined);
                      onChangeFlightTier('AUTO');
                    }
                  }}
                  className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white whitespace-nowrap"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6-Round Sequence Forecast */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium text-slate-300">6-Round Sequence Forecast</span>
          <span className="text-[11px] font-mono text-slate-500">Source: {roomSyncMeta.source}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80 rounded-lg border border-slate-800/80 bg-[#090D16] overflow-hidden">
          {sixRoundForecast.map((item, idx) => (
            <div
              key={item.roundNumber}
              className={`p-2.5 font-mono ${idx === 0 ? 'bg-emerald-500/5' : ''}`}
            >
              <div className="text-[11px] text-slate-500 tabular-nums">#{item.roundNumber}</div>
              <div
                className={`text-sm font-bold tabular-nums mt-0.5 ${
                  item.action === 'SKIP_ROUND'
                    ? 'text-rose-400'
                    : idx === 0
                    ? 'text-emerald-400'
                    : 'text-sky-300'
                }`}
              >
                {item.action === 'SKIP_ROUND' ? 'SKIP' : `${item.target.toFixed(2)}x`}
              </div>
              <div className="text-[10px] text-slate-500 tabular-nums mt-0.5">
                {item.safe.toFixed(2)}x · ~{item.ceiling.toFixed(1)}x
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Verified Last 8 Rounds */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium text-slate-300">Recent Bot Verification (Last 8)</span>
          <span className="font-mono tabular-nums">
            {verifiedLast8.filter((v) => v.evalResult.isTrueWin).length}/{verifiedLast8.length} Hits ·{' '}
            <strong className="text-sky-300 font-semibold">
              {verifiedLast8.filter((v) => v.evalResult.outcome === 'EXACT_WIN').length} Close
            </strong>
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-800/70 rounded-lg border border-slate-800/80 overflow-hidden">
          {verifiedLast8.map(({ round, evalResult }) => {
            const win = evalResult.isTrueWin;
            const isClose = evalResult.outcome === 'EXACT_WIN';
            return (
              <div
                key={round.id}
                className="p-2.5 bg-[#090D16] flex items-center justify-between gap-2 font-mono"
              >
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-500 tabular-nums">#{round.roundNumber}</div>
                  <div className="text-sm font-bold text-white tabular-nums">
                    {round.multiplier.toFixed(2)}x
                  </div>
                  <div className="text-[10px] text-slate-400 truncate tabular-nums">
                    Target{' '}
                    {evalResult.predicted === 0
                      ? 'SKIP'
                      : `${evalResult.predicted.toFixed(2)}x`}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-semibold whitespace-nowrap shrink-0 ${
                    isClose
                      ? 'text-sky-300'
                      : win
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {evalResult.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collapsible Paste Casino Bar Sync Drawer */}
      <div className="pt-2 border-t border-slate-800/80">
        <button
          type="button"
          onClick={() => setShowPasteDrawer((v) => !v)}
          className="w-full flex items-center justify-between text-xs font-medium text-slate-400 hover:text-white py-1 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Bulk Sync via History Ribbon</span>
          </span>
          {showPasteDrawer ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showPasteDrawer && (
          <div className="mt-2.5 p-3.5 rounded-lg bg-[#090D16] border border-slate-800/80 space-y-2.5">
            <textarea
              rows={2}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste ribbon numbers e.g. 1.26x 5.64x 1.16x 5.76x 5.52x 9.03x 2.05x 1.16x"
              className="w-full rounded-lg bg-[#0D1320] border border-slate-800 p-2.5 text-xs font-mono text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newestFirst}
                  onChange={(e) => setNewestFirst(e.target.checked)}
                  className="accent-sky-500"
                />
                <span>Newest first ([REDACTED_PROVIDER] left-to-right order)</span>
              </label>
              <button
                type="button"
                onClick={handlePasteSync}
                className="h-8 px-3.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white whitespace-nowrap"
              >
                Sync Sequence
              </button>
            </div>
          </div>
        )}
      </div>

      {isSkip && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-200">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Consecutive low-bust cluster detected. Hold stake until corridor stabilizes.</span>
        </div>
      )}
    </section>
  );
};
