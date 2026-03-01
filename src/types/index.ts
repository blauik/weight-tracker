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
