"use client";

import { UserProfile, DailyEntry } from "@/types";
import { calculateWeeklyAverages, formatDate } from "@/lib/calculations";

interface Props {
  profile: UserProfile;
  entries: DailyEntry[];
}

export default function WeeklyAveragesCard({ profile, entries }: Props) {
  const weeks = calculateWeeklyAverages(entries, profile.startDate);

  if (weeks.length === 0) {
    return null;  // Don't display if insufficient data
  }

  const currentWeek = weeks[weeks.length - 1];
  const previousWeeks = weeks.slice(0, -1).reverse();  // Most recent first

  const getTrendIcon = (trend: "down" | "up" | "stable" | null) => {
    if (trend === "down") return "↓";
    if (trend === "up") return "↑";
    if (trend === "stable") return "→";
    return "";
  };

  const getTrendColor = (trend: "down" | "up" | "stable" | null) => {
    if (trend === "down") return "text-emerald-400";  // Good (losing weight)
    if (trend === "up") return "text-red-400";        // Bad (gaining weight)
    if (trend === "stable") return "text-gray-400";
    return "text-gray-400";
  };

  return (
    <div className="glass p-4 sm:p-6 animate-slide-up">
      <div className="mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Týdenní průměry</h3>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Průměrná váha po týdnech</p>
      </div>

      {/* Current week - highlighted */}
      <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-emerald-500 dark:text-emerald-400 font-medium uppercase tracking-wider mb-1">
              Aktuální týden
            </div>
            <div className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">
              {currentWeek.averageWeight} kg
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {currentWeek.label} ({formatDate(currentWeek.startDate)} - {formatDate(currentWeek.endDate)})
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {currentWeek.entryCount} {currentWeek.entryCount === 1 ? "záznam" : currentWeek.entryCount < 5 ? "záznamy" : "záznamů"}
            </div>
          </div>

          {currentWeek.changeFromPrevious !== null && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${getTrendColor(currentWeek.trend)}`}>
                {getTrendIcon(currentWeek.trend)}
              </div>
              <div className={`text-sm font-semibold ${getTrendColor(currentWeek.trend)}`}>
                {currentWeek.changeFromPrevious > 0 ? "+" : ""}
                {currentWeek.changeFromPrevious} kg
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Previous weeks - compact list */}
      {previousWeeks.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
            Historie
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {previousWeeks.map((week) => (
              <div
                key={week.weekNumber}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-200/30 dark:bg-gray-800/30 hover:bg-gray-300/30 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{week.label}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {formatDate(week.startDate)} - {formatDate(week.endDate)}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-200">
                      {week.averageWeight} kg
                    </div>
                    {week.changeFromPrevious !== null && (
                      <div className={`text-xs ${getTrendColor(week.trend)}`}>
                        {getTrendIcon(week.trend)} {week.changeFromPrevious > 0 ? "+" : ""}
                        {week.changeFromPrevious} kg
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
