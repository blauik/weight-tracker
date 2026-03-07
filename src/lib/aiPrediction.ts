import { UserProfile, DailyEntry, AIPrediction } from "@/types";
import { getFilledEntries } from "./calculations";

/**
 * Weighted linear regression — recent data points have more influence.
 * Returns slope and intercept for y = slope * x + intercept
 */
function weightedLinearRegression(
  xs: number[],
  ys: number[],
  decayFactor: number = 0.95
): { slope: number; intercept: number } {
  const n = xs.length;

  // Exponential weights: most recent point has weight 1, earlier points decay
  const weights: number[] = [];
  for (let i = 0; i < n; i++) {
    weights.push(Math.pow(decayFactor, n - 1 - i));
  }

  let wSum = 0, wxSum = 0, wySum = 0, wxySum = 0, wxxSum = 0;
  for (let i = 0; i < n; i++) {
    const w = weights[i];
    wSum += w;
    wxSum += w * xs[i];
    wySum += w * ys[i];
    wxySum += w * xs[i] * ys[i];
    wxxSum += w * xs[i] * xs[i];
  }

  const denom = wSum * wxxSum - wxSum * wxSum;
  if (Math.abs(denom) < 1e-10) {
    // Flat line
    return { slope: 0, intercept: wySum / wSum };
  }

  const slope = (wSum * wxySum - wxSum * wySum) / denom;
  const intercept = (wySum - slope * wxSum) / wSum;

  return { slope, intercept };
}

/**
 * Calculate AI-powered weight prediction using weighted linear regression
 */
export function calculateAIPrediction(
  profile: UserProfile,
  entries: DailyEntry[]
): AIPrediction | null {
  const filled = getFilledEntries(entries);
  if (filled.length < 5) return null;

  // Prepare data: x = days from start, y = weight
  const startTime = new Date(profile.startDate).getTime();
  const xs: number[] = [];
  const ys: number[] = [];

  filled.forEach(entry => {
    const dayNum = (new Date(entry.date).getTime() - startTime) / (1000 * 60 * 60 * 24);
    xs.push(dayNum);
    ys.push(entry.weight!);
  });

  // Use weighted linear regression (recent data weighted more)
  const { slope, intercept } = weightedLinearRegression(xs, ys);

  // Calculate R-squared
  const yMean = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  let ssTot = 0, ssRes = 0;

  for (let i = 0; i < xs.length; i++) {
    const yPred = slope * xs[i] + intercept;
    const yActual = ys[i];
    ssTot += (yActual - yMean) ** 2;
    ssRes += (yActual - yPred) ** 2;
  }

  const rSquared = ssTot > 0 ? Math.max(0, Math.min(1, 1 - (ssRes / ssTot))) : 0;

  // Penalize confidence when data is sparse
  const dataRangeDays = xs[xs.length - 1] - xs[0];
  const dataDensity = filled.length / Math.max(1, dataRangeDays);
  const densityPenalty = Math.min(1, dataDensity); // 1.0 = daily, 0.5 = every other day
  const dataAmountPenalty = Math.min(1, filled.length / 14); // Full confidence at 14+ entries
  const confidence = rSquared * densityPenalty * dataAmountPenalty;

  // Calculate recent trend (last 14 days)
  const recentDays = Math.min(14, filled.length);
  const recentEntries = filled.slice(-recentDays);
  const recentXs = recentEntries.map(e =>
    (new Date(e.date).getTime() - startTime) / (1000 * 60 * 60 * 24)
  );
  const recentYs = recentEntries.map(e => e.weight!);

  const recentReg = weightedLinearRegression(recentXs, recentYs, 0.9);
  const recentTrend = -recentReg.slope; // Positive = losing weight
  const overallTrend = -slope;

  // Scale prediction range based on available data
  // Don't predict further than 2x the data range, max 30 days
  const maxPredictionDays = Math.min(30, Math.max(7, Math.round(dataRangeDays * 2)));

  // Sanity bounds
  const maxWeight = Math.max(profile.startWeight, ...ys) + 2;
  const minWeight = profile.targetWeight;

  // Generate predictions
  const lastDayNum = xs[xs.length - 1];
  const predictions: Array<{
    date: string;
    optimistic: number;
    realistic: number;
    pessimistic: number;
  }> = [];

  for (let i = 1; i <= maxPredictionDays; i++) {
    const dayNum = lastDayNum + i;
    let realistic = slope * dayNum + intercept;

    // Clamp to sanity bounds
    realistic = Math.max(minWeight, Math.min(maxWeight, realistic));

    // Optimistic: 20% steeper loss from current weight
    const dailyLoss = Math.max(0, -slope);
    let optimistic = realistic - dailyLoss * i * 0.2;
    optimistic = Math.max(minWeight, Math.min(maxWeight, optimistic));

    // Pessimistic: 30% slower loss
    let pessimistic = realistic + dailyLoss * i * 0.3;
    pessimistic = Math.max(minWeight, Math.min(maxWeight, pessimistic));

    const d = new Date(startTime + dayNum * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];

    predictions.push({
      date: dateStr,
      optimistic: Math.round(optimistic * 100) / 100,
      realistic: Math.round(realistic * 100) / 100,
      pessimistic: Math.round(pessimistic * 100) / 100,
    });
  }

  // Estimate goal dates
  const findGoalDate = (scenario: 'optimistic' | 'realistic' | 'pessimistic'): string | null => {
    for (const pred of predictions) {
      if (pred[scenario] <= profile.targetWeight) {
        return pred.date;
      }
    }
    return null;
  };

  return {
    predictions,
    estimatedGoalDate: {
      optimistic: findGoalDate('optimistic'),
      realistic: findGoalDate('realistic'),
      pessimistic: findGoalDate('pessimistic'),
    },
    confidence,
    recentTrend,
    overallTrend,
  };
}
