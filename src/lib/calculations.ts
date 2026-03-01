import {
  UserProfile,
  DailyEntry,
  CalorieInfo,
  ProjectionData,
  ActivityLevel,
} from "@/types";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const DEFICIT = 500;
const KCAL_PER_KG = 7700; // ~7700 kcal per 1 kg of body fat

export function calculateBMR(profile: UserProfile): number {
  // Mifflin-St Jeor Equation
  const base = 10 * profile.startWeight + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.gender === "male" ? base + 5 : base - 161;
}

export function calculateBMRForWeight(profile: UserProfile, weight: number): number {
  const base = 10 * weight + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.gender === "male" ? base + 5 : base - 161;
}

export function calculateCalorieInfo(profile: UserProfile, currentWeight?: number): CalorieInfo {
  const weight = currentWeight ?? profile.startWeight;
  const bmr = calculateBMRForWeight(profile, weight);
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel]);
  const dailyTarget = Math.round(tdee - DEFICIT);

  return {
    bmr: Math.round(bmr),
    tdee,
    dailyTarget: Math.max(dailyTarget, 1200), // never go below 1200
    deficit: DEFICIT,
  };
}

export function calculateTotalDays(profile: UserProfile): number {
  const totalKgToLose = profile.startWeight - profile.targetWeight;
  const totalKcalDeficit = totalKgToLose * KCAL_PER_KG;
  return Math.ceil(totalKcalDeficit / DEFICIT);
}

export function generateDateRange(startDate: string, days: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export function generateInitialEntries(profile: UserProfile): DailyEntry[] {
  const totalDays = calculateTotalDays(profile);
  const dates = generateDateRange(profile.startDate, totalDays);
  return dates.map((date) => ({ date, weight: null }));
}

export function getFilledEntries(entries: DailyEntry[]): DailyEntry[] {
  return entries.filter((e) => e.weight !== null);
}

export function calculateProjection(
  profile: UserProfile,
  entries: DailyEntry[]
): ProjectionData | null {
  const filled = getFilledEntries(entries);
  if (filled.length < 2) return null;

  const totalToLose = profile.startWeight - profile.targetWeight;
  const latestWeight = filled[filled.length - 1].weight!;
  const totalLost = profile.startWeight - latestWeight;
  const percentComplete = Math.min(100, Math.max(0, (totalLost / totalToLose) * 100));

  // Calculate average daily loss from trend (linear regression)
  const dayNumbers = filled.map((e) => {
    const start = new Date(profile.startDate).getTime();
    const current = new Date(e.date).getTime();
    return (current - start) / (1000 * 60 * 60 * 24);
  });
  const weights = filled.map((e) => e.weight!);

  const n = dayNumbers.length;
  const sumX = dayNumbers.reduce((a, b) => a + b, 0);
  const sumY = weights.reduce((a, b) => a + b, 0);
  const sumXY = dayNumbers.reduce((sum, x, i) => sum + x * weights[i], 0);
  const sumXX = dayNumbers.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const avgDailyLoss = -slope; // positive = losing weight

  // Current trend projection
  let projectedDaysRemaining = Infinity;
  let projectedEndDate = "";
  if (avgDailyLoss > 0) {
    const remaining = latestWeight - profile.targetWeight;
    projectedDaysRemaining = Math.ceil(remaining / avgDailyLoss);
    const endDate = new Date(filled[filled.length - 1].date);
    endDate.setDate(endDate.getDate() + projectedDaysRemaining);
    projectedEndDate = endDate.toISOString().split("T")[0];
  }

  // Ideal trend
  const idealDailyLoss = DEFICIT / KCAL_PER_KG;
  const idealTotalDays = calculateTotalDays(profile);
  const idealEndDate = new Date(profile.startDate);
  idealEndDate.setDate(idealEndDate.getDate() + idealTotalDays);

  // Stats
  let bestDay: { date: string; loss: number } | null = null;
  let worstDay: { date: string; gain: number } | null = null;
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  for (let i = 1; i < filled.length; i++) {
    const diff = filled[i - 1].weight! - filled[i].weight!;
    if (diff > 0) {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }

    if (!bestDay || diff > bestDay.loss) {
      bestDay = { date: filled[i].date, loss: diff };
    }
    if (!worstDay || diff < -worstDay.gain) {
      worstDay = { date: filled[i].date, gain: -diff };
    }
  }

  // Current streak (from end)
  for (let i = filled.length - 1; i > 0; i--) {
    if (filled[i - 1].weight! > filled[i].weight!) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Average weekly loss
  const totalDaysTracked = dayNumbers[dayNumbers.length - 1] - dayNumbers[0];
  const weeks = totalDaysTracked / 7;
  const avgWeeklyLoss = weeks > 0 ? totalLost / weeks : 0;

  return {
    currentTrend: {
      avgDailyLoss: Math.round(avgDailyLoss * 1000) / 1000,
      projectedEndDate,
      projectedDaysRemaining,
    },
    idealTrend: {
      dailyLoss: Math.round(idealDailyLoss * 1000) / 1000,
      endDate: idealEndDate.toISOString().split("T")[0],
      totalDays: idealTotalDays,
    },
    stats: {
      totalLost: Math.round(totalLost * 100) / 100,
      percentComplete: Math.round(percentComplete * 10) / 10,
      bestDay,
      worstDay,
      currentStreak,
      longestStreak,
      avgWeeklyLoss: Math.round(avgWeeklyLoss * 100) / 100,
    },
  };
}

export function getIdealWeightForDate(profile: UserProfile, date: string): number {
  const start = new Date(profile.startDate).getTime();
  const current = new Date(date).getTime();
  const dayNum = (current - start) / (1000 * 60 * 60 * 24);
  const idealDailyLoss = DEFICIT / KCAL_PER_KG;
  return Math.max(profile.targetWeight, profile.startWeight - idealDailyLoss * dayNum);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
  });
}

export function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return dateStr === today;
}

export function isPast(dateStr: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return dateStr <= today;
}

export function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("cs-CZ", { weekday: "short" });
}

/**
 * Calculate total calories needed to burn to reach target weight
 */
export function calculateTotalCaloriesToBurn(profile: UserProfile): number {
  const totalKgToLose = profile.startWeight - profile.targetWeight;
  return Math.round(totalKgToLose * KCAL_PER_KG);
}

/**
 * Calculate calories already burned based on current weight
 */
export function calculateCaloriesBurned(profile: UserProfile, currentWeight: number): number {
  const kgLost = profile.startWeight - currentWeight;
  return Math.round(Math.max(0, kgLost * KCAL_PER_KG));
}
