export interface BacktestReport {
  rounds: number;
  mae: number;
  brierAt2x: number;
  empiricalHitRate: number;
  baseline: number;
}

export function backtestEmpiricalQuantiles(history: number[], target = 2): BacktestReport {
  const clean = history.filter((n) => Number.isFinite(n) && n >= 1);
  let absError = 0;
  let brierSum = 0;
  let hits = 0;
  let count = 0;

  for (let i = 30; i < clean.length; i++) {
    const prior = clean.slice(0, i);
    const sorted = [...prior].sort((a, b) => a - b);
    const median = quantile(sorted, 0.5);
    const predictedAbove = prior.filter((n) => n >= target).length / prior.length;
    const actualAbove = clean[i] >= target ? 1 : 0;

    absError += Math.abs(clean[i] - median);
    brierSum += (predictedAbove - actualAbove) ** 2;
    hits += actualAbove === 1 ? 1 : 0;
    count++;
  }

  const mae = count ? absError / count : 0;
  const brierAt2x = count ? brierSum / count : 0;
  const baseline = clean.length ? clean.filter((n) => n >= target).length / clean.length : 0;
  const empiricalHitRate = count ? hits / count : baseline;

  return {
    rounds: count,
    mae: Number(mae.toFixed(3)),
    brierAt2x: Number(brierAt2x.toFixed(4)),
    empiricalHitRate: Number((empiricalHitRate * 100).toFixed(1)),
    baseline: Number((baseline * 100).toFixed(1)),
  };
}

export function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return 1;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}
