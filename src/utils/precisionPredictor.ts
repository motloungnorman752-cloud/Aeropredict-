import { RoundRecord, PredictionSignal } from '../types';

export type SensitivityMode = 'TIGHT_CORRIDOR' | 'BALANCED' | 'PINK_HUNTER';
export type FlightTier = 'AUTO' | 'SAFE_150' | 'MEDIAN_CORRIDOR' | 'PINK_HIGH' | 'PASS' | 'CUSTOM';

export interface PrecisionForecastResult extends PredictionSignal {
  harmonicMean: number;
  medianMultiplier: number;
  emaRecent: number;
  recentMultipliersSample: number[];
  dynamicVolatilityCoeff: number;
  autoVolatilityCoeff: number;
  rolling20StdDev: number;
  empiricalProbabilityAbove2x: number;
}

export function calculatePercentile(sorted: number[], p: number): number {
  if (!sorted.length) return 1;
  const clamped = Math.max(0, Math.min(100, p));
  const index = (clamped / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return Number(sorted[lower].toFixed(2));
  const fraction = index - lower;
  return Number((sorted[lower] * (1 - fraction) + sorted[upper] * fraction).toFixed(2));
}

export function computeMedian(values: number[]): number {
  if (!values.length) return 1;
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 1;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Number(median.toFixed(2));
}

export function computeStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Number(Math.sqrt(variance).toFixed(4));
}

export function calculatePrecisionPrediction(
  history: RoundRecord[],
  provider = 'Historical analysis',
  _sensitivityMode: SensitivityMode = 'TIGHT_CORRIDOR',
  _flightTierOverride: FlightTier = 'AUTO',
  _proximityRatio = 0.85,
  _customAnchorMultiplier?: number,
  _volatilityNudge = 0,
): PrecisionForecastResult {
  const values = history
    .map((round) => Number(round.multiplier))
    .filter((value) => Number.isFinite(value) && value >= 1)
    .slice(-250);

  if (!values.length) {
    const empty = {
      lower: 1, upper: 1, levelPct: 90, margin: 0,
    };
    return makeResult([], empty, provider);
  }

  const sorted = [...values].sort((a, b) => a - b);
  const p10 = calculatePercentile(sorted, 10);
  const p25 = calculatePercentile(sorted, 25);
  const median = calculatePercentile(sorted, 50);
  const p75 = calculatePercentile(sorted, 75);
  const p90 = calculatePercentile(sorted, 90);
  const probability = values.filter((value) => value >= 2).length / values.length;

  const interval = {
    lower: p10,
    upper: p90,
    levelPct: 90,
    margin: Number(((p90 - p10) / 2).toFixed(2)),
  };

  return makeResult(values, interval, provider, { p10, p25, p50: median, p75, p90 });
}

function makeResult(
  values: number[],
  confidenceInterval: PredictionSignal['confidenceInterval'],
  provider: string,
  suppliedPercentiles?: PredictionSignal['percentiles'],
): PrecisionForecastResult {
  const sorted = [...values].sort((a, b) => a - b);
  const p10 = suppliedPercentiles?.p10 ?? confidenceInterval.lower;
  const p25 = suppliedPercentiles?.p25 ?? p10;
  const p50 = suppliedPercentiles?.p50 ?? 1;
  const p75 = suppliedPercentiles?.p75 ?? confidenceInterval.upper;
  const p90 = suppliedPercentiles?.p90 ?? confidenceInterval.upper;
  const probability = values.length ? values.filter((value) => value >= 2).length / values.length : 0;
  const harmonic = values.length
    ? values.length / values.reduce((sum, value) => sum + 1 / Math.max(1, value), 0)
    : 1;
  const recent = values.slice(-30);
  const ema = recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : 1;
  const stdDev = computeStandardDeviation(values.slice(-20));

  return {
    safeMultiplier: p25,
    optimalMultiplier: p50,
    moonshotMultiplier: p90,
    rawCrashPrediction: p90,
    exactPredictedCrash: p50,
    closeExitTarget: p50,
    projectedCeiling: p90,
    closenessRatioPct: 0,
    flightTier: 'Historical percentile',
    predictedCrashMargin: { min: p10, max: p90, toleranceDelta: confidenceInterval.margin },
    projectedRange: { min: confidenceInterval.lower, max: confidenceInterval.upper },
    safeExitBracket: { min: p10, max: p25 },
    actionRecommendation: 'WAIT_CAUTION',
    hazardReason: 'No future outcome can be predicted. These are historical distribution estimates only.',
    confidenceScore: 0,
    riskLevel: 'HIGH',
    pattern: 'Historical distribution · no predictive edge',
    historicalAverage: values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : 1,
    historicalMedian: p50,
    medianMultiplier: p50,
    confidenceInterval,
    percentiles: { p10, p25, p50, p75, p90, currentPercentile: 0 },
    rollingWindow: {
      windowSize: Math.min(10, values.length),
      rollingMedian: computeMedian(values.slice(-10)),
      rollingDelta: stdDev,
      rollingMad: 0,
      rollingAccuracyPct: 0,
      recentDeltas: [],
    },
    calculatedAt: new Date().toISOString(),
    signalTier: 'DESCRIPTIVE ONLY',
    recommendedExit: 0,
    closenessScore: 0,
    harmonicMean: Number(harmonic.toFixed(2)),
    emaRecent: Number(ema.toFixed(2)),
    recentMultipliersSample: recent.slice(-10),
    dynamicVolatilityCoeff: 1,
    autoVolatilityCoeff: 1,
    rolling20StdDev: stdDev,
    empiricalProbabilityAbove2x: Number((probability * 100).toFixed(1)),
  };
}

export function calculateSequenceForecast(
  history: RoundRecord[],
  startRoundNumber: number,
  count = 6,
  provider = 'Historical analysis',
) {
  const signal = calculatePrecisionPrediction(history, provider);
  return Array.from({ length: count }, (_, index) => ({
    roundNumber: startRoundNumber + index,
    target: 0,
    safe: 0,
    ceiling: signal.projectedCeiling,
    action: 'WAIT_CAUTION' as const,
    signal,
  }));
}

export function calculatePrecisionPredictionForRound(
  history: RoundRecord[],
  _targetRoundNumber: number,
  provider = 'Historical analysis',
  _sensitivityMode: SensitivityMode = 'TIGHT_CORRIDOR',
  _flightTierOverride: FlightTier = 'AUTO',
  proximityRatio = 0.85,
  customAnchorMultiplier?: number,
  volatilityNudge = 0,
) {
  return calculatePrecisionPrediction(history, provider, _sensitivityMode, _flightTierOverride, proximityRatio, customAnchorMultiplier, volatilityNudge);
}
