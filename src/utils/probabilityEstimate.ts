export interface ProbabilityEstimate {
  threshold: number;
  successes: number;
  sampleSize: number;
  probabilityPct: number;
  lower95Pct: number;
  upper95Pct: number;
}

/**
 * Descriptive estimate of P(multiplier >= threshold), based on prior observations.
 * The Wilson interval represents sampling uncertainty only, not a guarantee or
 * evidence that rounds are dependent/predictable.
 */
export function estimateExceedance(values: number[], threshold: number): ProbabilityEstimate {
  const sample = values.filter((value) => Number.isFinite(value) && value >= 1);
  const successes = sample.filter((value) => value >= threshold).length;
  const n = sample.length;
  if (n === 0) {
    return { threshold, successes: 0, sampleSize: 0, probabilityPct: 0, lower95Pct: 0, upper95Pct: 100 };
  }

  const z = 1.96;
  const p = successes / n;
  const denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const halfWidth = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denominator;
  const pct = (value: number) => Number((Math.max(0, Math.min(1, value)) * 100).toFixed(1));

  return {
    threshold,
    successes,
    sampleSize: n,
    probabilityPct: pct(p),
    lower95Pct: pct(center - halfWidth),
    upper95Pct: pct(center + halfWidth),
  };
}

export interface ProbabilityBacktest {
  evaluatedRounds: number;
  modelBrier: number | null;
  baselineBrier: number | null;
  observedRatePct: number | null;
  testStartIndex: number;
}

/** Expanding-window, chronological holdout; each forecast uses only earlier rounds. */
export function backtestExceedance(values: number[], threshold: number, minTrain = 30): ProbabilityBacktest {
  const sample = values.filter((value) => Number.isFinite(value) && value >= 1);
  const testStartIndex = Math.max(minTrain, Math.floor(sample.length * 0.7));
  if (sample.length <= testStartIndex || testStartIndex < 1) {
    return { evaluatedRounds: 0, modelBrier: null, baselineBrier: null, observedRatePct: null, testStartIndex };
  }

  const training = sample.slice(0, testStartIndex);
  const baselineProbability = training.filter((value) => value >= threshold).length / training.length;
  let modelLoss = 0;
  let baselineLoss = 0;
  let hits = 0;
  let count = 0;

  for (let i = testStartIndex; i < sample.length; i++) {
    const prior = sample.slice(0, i);
    const probability = prior.filter((value) => value >= threshold).length / prior.length;
    const outcome = sample[i] >= threshold ? 1 : 0;
    modelLoss += (probability - outcome) ** 2;
    baselineLoss += (baselineProbability - outcome) ** 2;
    hits += outcome;
    count++;
  }

  return {
    evaluatedRounds: count,
    modelBrier: Number((modelLoss / count).toFixed(4)),
    baselineBrier: Number((baselineLoss / count).toFixed(4)),
    observedRatePct: Number((hits / count * 100).toFixed(1)),
    testStartIndex,
  };
}
