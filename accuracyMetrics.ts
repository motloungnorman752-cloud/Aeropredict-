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
  const predicted = typeof round.predictedMultiplier === 'number' ? round.predictedMultiplier : 0;
  const isWin = predicted > 0 && actual >= predicted;
  const isLoss = predicted > 0 && actual < predicted;
  const delta = predicted > 0 ? Number(Math.abs(actual - predicted).toFixed(2)) : 0;
  return {
    outcome: isWin ? 'SAFE_WIN' : isLoss ? 'LOSS' : 'EXACT_WIN',
    isTrueWin: isWin,
    isTrapAvoided: predicted === 0,
    predicted,
    actual,
    delta,
    label: predicted === 0 ? 'No-bet' : isWin ? 'Met threshold' : 'Missed threshold',
  };
}

export function computeAccuracyMetrics(rounds: RoundRecord[]) {
  const evaluated = rounds.map(evaluateRoundOutcome);
  const wins = evaluated.filter((e) => e.isTrueWin).length;
  const exactHits = evaluated.filter((e) => e.outcome === 'EXACT_WIN').length;
  const losses = evaluated.filter((e) => e.outcome === 'LOSS').length;
  const total = evaluated.length;
  const decisiveTotal = wins + losses;
  const winRatePct = decisiveTotal > 0 ? Number((wins / decisiveTotal * 100).toFixed(1)) : 0;
  return { total, wins, exactHits, losses, winRatePct };
}
