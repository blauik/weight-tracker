import { UserProfile, DailyEntry, AIPrediction } from "@/types";
import { getFilledEntries } from "./calculations";

/**
 * Solve quadratic regression using least squares method
 * Returns coefficients for y = a*x^2 + b*x + c
 */
function solveQuadraticFit(xs: number[], ys: number[]): { a: number; b: number; c: number } {
  const n = xs.length;
  let sx = 0, sx2 = 0, sx3 = 0, sx4 = 0;
  let sy = 0, sxy = 0, sx2y = 0;

  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i];
    sx += x;
    sx2 += x * x;
    sx3 += x * x * x;
    sx4 += x * x * x * x;
    sy += y;
    sxy += x * y;
    sx2y += x * x * y;
  }

  // Solve system of equations using Cramer's rule:
  // | sx4 sx3 sx2 | |a|   |sx2y|
  // | sx3 sx2 sx  | |b| = |sxy |
  // | sx2 sx  n   | |c|   |sy  |

  const det = sx4 * (sx2 * n - sx * sx) - sx3 * (sx3 * n - sx * sx2) + sx2 * (sx3 * sx - sx2 * sx2);

  if (Math.abs(det) < 0.0001) {
    // Fallback to linear if determinant too small
    const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
    const intercept = (sy - slope * sx) / n;
    return { a: 0, b: slope, c: intercept };
  }

  const detA = sx2y * (sx2 * n - sx * sx) - sxy * (sx3 * n - sx * sx2) + sy * (sx3 * sx - sx2 * sx2);
  const detB = sx4 * (sxy * n - sy * sx) - sx3 * (sx2y * n - sy * sx2) + sx2 * (sx2y * sx - sxy * sx2);
  const detC = sx4 * (sx2 * sy - sx * sxy) - sx3 * (sx3 * sy - sx * sx2y) + sx2 * (sx3 * sxy - sx2 * sx2y);

  return {
    a: detA / det,
    b: detB / det,
    c: detC / det,
  };
}

/**
 * Calculate AI-powered weight prediction using polynomial regression
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

  // Fit quadratic regression
  const { a, b, c } = solveQuadraticFit(xs, ys);

  // Calculate R-squared (coefficient of determination)
  const yMean = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  let ssTot = 0, ssRes = 0;

  for (let i = 0; i < xs.length; i++) {
    const yPred = a * xs[i] * xs[i] + b * xs[i] + c;
    const yActual = ys[i];
    ssTot += (yActual - yMean) ** 2;
    ssRes += (yActual - yPred) ** 2;
  }

  const rSquared = Math.max(0, Math.min(1, 1 - (ssRes / ssTot)));

  // Calculate recent trend (last 14 days)
  const recentDays = Math.min(14, filled.length);
  const recentEntries = filled.slice(-recentDays);
  const recentXs = recentEntries.map(e =>
    (new Date(e.date).getTime() - startTime) / (1000 * 60 * 60 * 24)
  );
  const recentYs = recentEntries.map(e => e.weight!);

  const n = recentXs.length;
  const sumX = recentXs.reduce((a, b) => a + b, 0);
  const sumY = recentYs.reduce((a, b) => a + b, 0);
  const sumXY = recentXs.reduce((sum, x, i) => sum + x * recentYs[i], 0);
  const sumXX = recentXs.reduce((sum, x) => sum + x * x, 0);

  const recentSlope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const recentTrend = -recentSlope; // Negative because we want weight loss

  // Overall trend
  const allSumX = xs.reduce((a, b) => a + b, 0);
  const allSumY = ys.reduce((a, b) => a + b, 0);
  const allSumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0);
  const allSumXX = xs.reduce((sum, x) => sum + x * x, 0);
  const allSlope = (xs.length * allSumXY - allSumX * allSumY) / (xs.length * allSumXX - allSumX * allSumX);
  const overallTrend = -allSlope;

  // Generate predictions for next 30 days
  const lastDayNum = xs[xs.length - 1];
  const predictions: Array<{
    date: string;
    optimistic: number;
    realistic: number;
    pessimistic: number;
  }> = [];

  for (let i = 1; i <= 30; i++) {
    const dayNum = lastDayNum + i;
    const realistic = a * dayNum * dayNum + b * dayNum + c;

    // Optimistic: 20% faster weight loss
    const optimistic = realistic - (profile.startWeight - realistic) * 0.2;

    // Pessimistic: 30% slower weight loss
    const pessimistic = realistic + (profile.startWeight - realistic) * 0.3;

    const d = new Date(startTime + dayNum * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];

    predictions.push({
      date: dateStr,
      optimistic: Math.max(profile.targetWeight, Math.round(optimistic * 100) / 100),
      realistic: Math.max(profile.targetWeight, Math.round(realistic * 100) / 100),
      pessimistic: Math.max(profile.targetWeight, Math.round(pessimistic * 100) / 100),
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
    confidence: rSquared,
    recentTrend,
    overallTrend,
  };
}
