# AeroPredict — Historical Analysis

AeroPredict is now an offline-first historical distribution and provably-fair verification tool.

## What it does

- Displays historical multiplier quantiles.
- Estimates empirical frequencies from recorded rounds.
- Separates provably-fair verification from prediction.
- Performs backtests using older observations only.
- Avoids cash-out recommendations and synthetic future outcomes.

## What it does not do

It cannot reliably predict an Aviator or crash-game result. No UI label, percentage, streak, or confidence interval constitutes a guarantee.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
npm run lint
npm run build
```

## Safety

Keep API keys and server secrets in `.env`. Never expose them through a `VITE_` variable or commit them to Git.
