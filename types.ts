export type FlightPhase = 'COUNTDOWN' | 'FLYING' | 'CRASHED';
export type StrategyMode = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type RoundOutcomeType = 'EXACT_WIN' | 'SAFE_WIN' | 'LOSS';

export interface RoundRecord {
  id: string;
  roundNumber: number;
  multiplier: number;
  crashTime: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  predictedMultiplier: number;
  accuracy: 'exact' | 'safe_win' | 'missed';
  riskLevel: RiskLevel;
  isRealLiveRound?: boolean;
  isArchiveSeed?: boolean;
  revealedServerSeed?: string | null;
  resultHash?: string;
  rotationId?: number;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  levelPct: number;
  margin: number;
}

export interface PercentilesSummary {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  currentPercentile: number;
}

export interface RollingWindowSummary {
  windowSize: number;
  rollingMedian: number;
  rollingDelta: number;
  rollingMad: number;
  rollingAccuracyPct: number;
  recentDeltas: number[];
}

export interface PredictionSignal {
  safeMultiplier: number;
  optimalMultiplier: number;
  moonshotMultiplier: number;
  rawCrashPrediction: number;
  exactPredictedCrash: number;
  closeExitTarget: number;
  projectedCeiling: number;
  closenessRatioPct: number;
  flightTier: string;
  predictedCrashMargin: {
    min: number;
    max: number;
    toleranceDelta: number;
  };
  projectedRange: {
    min: number;
    max: number;
  };
  safeExitBracket: {
    min: number;
    max: number;
  };
  actionRecommendation: 'BET_SAFE' | 'SKIP_ROUND' | 'WAIT_CAUTION';
  hazardReason: string;
  confidenceScore: number;
  riskLevel: RiskLevel;
  pattern: string;
  historicalAverage: number;
  historicalMedian: number;
  medianMultiplier: number;
  confidenceInterval: ConfidenceInterval;
  percentiles: PercentilesSummary;
  rollingWindow: RollingWindowSummary;
  calculatedAt: string;
  signalTier: string;
  recommendedExit: number;
  closenessScore: number;
  lastAccuracyResult?: {
    actual: number;
    predicted: number;
    delta: number;
    isInsideWindow: boolean;
    accuracyPct: number;
  };
  dynamicVolatilityCoeff?: number;
  autoVolatilityCoeff?: number;
  rolling20StdDev?: number;
}

export interface ApiConfig {
  provider: '[REDACTED_PROVIDER]' | '[REDACTED_PROVIDER_OFFICIAL]' | '[REDACTED_PROVIDER_2]' | '[REDACTED_PROVIDER_3]' | '[REDACTED_PROVIDER_4]' | '[REDACTED_PROVIDER_5]' | '[REDACTED_PROVIDER_6]' | 'Custom API';
  dataSourceMode: 'LIVE_CASINO_API' | 'ALGORITHMIC_SIMULATOR';
  roomName: string;
  activePlayers: number;
  connected: boolean;
  latencyMs: number;
  lastSync: string;
}

export interface RoomSyncMeta {
  source: 'ARCHIVE_SEED' | 'MANUAL_LOG' | 'PASTE_BAR' | 'SCREENSHOT_OCR';
  lastSyncedAt: string | null;
  syncedRoundCount: number;
}

export interface ProbabilityMetric {
  target: number;
  theoreticalPct: number;
  empiricalPct: number;
  adjustedPredictionPct: number;
  deviation: number;
}

export interface TrendAnalytics {
  currentStreakType: 'LOW_BUST' | 'BALANCED' | 'PINK_SPIKE';
  currentStreakLength: number;
  sma5: number;
  sma15: number;
  trendDirection: 'BULLISH_EXPANSION' | 'BEARISH_COMPRESSION' | 'STABLE_EQUILIBRIUM';
  volatilityIndex: number;
  sampleRtp: number;
  roundsSinceLastPink: number;
  avgPinkInterval: number;
  pinkCycleReadinessPct: number;
  probabilities: ProbabilityMetric[];
  reversionSignal: 'STRONG_REBOUND_DUE' | 'COMPRESSION_ZONE' | 'BALANCED_MOMENTUM';
  reversionConfidence: number;
  recentMultipliers: number[];
  lastCalculated: string;
}
