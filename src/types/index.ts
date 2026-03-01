export type Gender = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export interface UserProfile {
  name: string;
  gender: Gender;
  age: number;
  heightCm: number;
  startWeight: number;
  targetWeight: number;
  activityLevel: ActivityLevel;
  startDate: string; // ISO date string
}

export interface DailyEntry {
  date: string; // ISO date string YYYY-MM-DD
  weight: number | null;
  note?: string;
}

export interface AppState {
  profile: UserProfile | null;
  entries: DailyEntry[];
}

export interface CalorieInfo {
  bmr: number;
  tdee: number;
  dailyTarget: number;
  deficit: number;
}

export interface ProjectionData {
  currentTrend: {
    avgDailyLoss: number;
    projectedEndDate: string;
    projectedDaysRemaining: number;
  };
  idealTrend: {
    dailyLoss: number;
    endDate: string;
    totalDays: number;
  };
  stats: {
    totalLost: number;
    percentComplete: number;
    bestDay: { date: string; loss: number } | null;
    worstDay: { date: string; gain: number } | null;
    currentStreak: number;
    longestStreak: number;
    avgWeeklyLoss: number;
  };
}

export interface AIPrediction {
  predictions: Array<{
    date: string;
    optimistic: number;
    realistic: number;
    pessimistic: number;
  }>;
  estimatedGoalDate: {
    optimistic: string | null;
    realistic: string | null;
    pessimistic: string | null;
  };
  confidence: number;
  recentTrend: number;
  overallTrend: number;
}

export interface WeeklyAverage {
  weekNumber: number;           // 1, 2, 3, ...
  label: string;                // "Týden 1", "Týden 2", ...
  startDate: string;            // ISO string
  endDate: string;              // ISO string
  averageWeight: number;        // Average weight in kg
  entryCount: number;           // Number of entries in this week
  trend: "down" | "up" | "stable" | null;  // Trend compared to previous week
  changeFromPrevious: number | null;  // Difference from previous week
}
