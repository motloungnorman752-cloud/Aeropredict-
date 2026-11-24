import { RoundRecord, RoundOutcomeType } from '../types';

export interface EvaluatedRoundOutcome {
  outcome: RoundOutcomeType;
  isTrueWin: boolean;
  isTrapAvoided: boolean;
  predicted: number;
  actual: number;
  delta: number;
  label: string;
}

export function evaluateRoundOutcome(round: RoundRecord): EvaluatedRoundOutcome {
  const actual = Number(round.multiplier);
  const predicted = typeof round.predictedMultiplier === 'number' && !isNaN(round.predictedMultiplier)
    ? Number(round.predictedMultiplier.toFixed(2))
    : 1.35;

  if (predicted === 0) {
    const avoided = actual < 1.35;
    return {
      outcome: avoided ? 'EXACT_WIN' : 'SAFE_WIN',
      isTrueWin: avoided,
      isTrapAvoided: avoided,
      predicted: 0,
      actual,
      delta: 0,
      label: avoided ? 'TRAP AVOIDED' : 'SKIPPED',
    };
  }

  const delta = Number(Math.abs(actual - predicted).toFixed(2));
  const isWin = actual >= predicted;
  const isExact = isWin && delta <= 0.35;

  return {
    outcome: isExact ? 'EXACT_WIN' : isWin ? 'SAFE_WIN' : 'LOSS',
    isTrueWin: isWin,
    isTrapAvoided: false,
    predicted,
    actual,
    delta,
    label: isExact ? 'CLOSE HIT' : isWin ? 'WIN' : 'MISS',
  };
}

export function computeAccuracyMetrics(rounds: RoundRecord[]) {
  const evaluated = rounds.map(evaluateRoundOutcome);
  const wins = evaluated.filter((e) => e.isTrueWin).length;
  const exactHits = evaluated.filter((e) => e.outcome === 'EXACT_WIN').length;
  const losses = evaluated.filter((e) => e.outcome === 'LOSS').length;
  const total = evaluated.length;
  const decisiveTotal = wins + losses;
  const winRatePct = decisiveTotal > 0 ? Number(((wins / decisiveTotal) * 100).toFixed(1)) : 0;

  return {
    total,
    wins,
    exactHits,
    losses,
    winRatePct,
  };
}
