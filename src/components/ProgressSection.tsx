"use client";

import { UserProfile, DailyEntry } from "@/types";
import { calculateProjection, calculateCalorieInfo, formatDateFull, getFilledEntries } from "@/lib/calculations";

interface Props {
  profile: UserProfile;
  entries: DailyEntry[];
}

export default function ProgressSection({ profile, entries }: Props) {
  const filled = getFilledEntries(entries);
  const projection = calculateProjection(profile, entries);
  const latestWeight = filled.length > 0 ? filled[filled.length - 1].weight! : profile.startWeight;
  const calorieInfo = calculateCalorieInfo(profile, latestWeight);
  const totalToLose = profile.startWeight - profile.targetWeight;
  const totalLost = profile.startWeight - latestWeight;
  const percentComplete = Math.min(100, Math.max(0, (totalLost / totalToLose) * 100));
  const remaining = latestWeight - profile.targetWeight;

  return (
    <div className="space-y-6">
      {/* Main Progress Bar */}
      <div className="glass p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Celkový pokrok</h3>
            <p className="text-sm text-gray-500">
              {profile.startWeight} kg &rarr; {profile.targetWeight} kg
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-emerald-400">{percentComplete.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">dokončeno</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden mb-4">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${percentComplete}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/30 to-emerald-400/30 rounded-full animate-pulse-slow"
            style={{ width: `${percentComplete}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-emerald-400">-{totalLost.toFixed(1)} kg</div>
            <div className="text-xs text-gray-500">Shozeno</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-300">{latestWeight.toFixed(1)} kg</div>
            <div className="text-xs text-gray-500">Aktuální</div>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-400">{remaining.toFixed(1)} kg</div>
            <div className="text-xs text-gray-500">Zbývá</div>
          </div>
        </div>
      </div>

      {/* Calorie Info */}
      <div className="glass p-6 animate-slide-up" style={{ animationDelay: "0.1s" }}>
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Kalorický plán</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="stat-card">
            <span className="stat-label">BMR</span>
            <span className="stat-value text-xl">{calorieInfo.bmr}</span>
            <span className="text-xs text-gray-500">kcal/den</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">TDEE</span>
            <span className="stat-value text-xl">{calorieInfo.tdee}</span>
            <span className="text-xs text-gray-500">kcal/den</span>
          </div>
          <div className="stat-card col-span-2 bg-emerald-500/5 border-emerald-500/20">
            <span className="stat-label text-emerald-500">Denní příjem (deficit {calorieInfo.deficit} kcal)</span>
            <span className="stat-value text-3xl text-emerald-400">{calorieInfo.dailyTarget}</span>
            <span className="text-xs text-gray-500">kcal/den pro hubnutí</span>
          </div>
        </div>
      </div>

      {/* Projection & Stats */}
      {projection && (
        <div className="glass p-6 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Projekce & Statistiky</h3>

          <div className="space-y-4">
            {/* Trend comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div className="stat-card">
                <span className="stat-label">Dle plánu</span>
                <span className="text-sm font-semibold text-indigo-400">
                  {formatDateFull(projection.idealTrend.endDate)}
                </span>
                <span className="text-xs text-gray-500">{projection.idealTrend.totalDays} dní celkem</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Dle aktuálního trendu</span>
                {projection.currentTrend.avgDailyLoss > 0 ? (
                  <>
                    <span className="text-sm font-semibold text-amber-400">
                      {formatDateFull(projection.currentTrend.projectedEndDate)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {projection.currentTrend.projectedDaysRemaining} dní zbývá
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-red-400">Váha roste</span>
                )}
              </div>
            </div>

            {/* Speed comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div className="stat-card">
                <span className="stat-label">Průměrný úbytek/den</span>
                <span className={`stat-value text-xl ${projection.currentTrend.avgDailyLoss > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {projection.currentTrend.avgDailyLoss > 0 ? "-" : "+"}
                  {Math.abs(projection.currentTrend.avgDailyLoss).toFixed(2)} kg
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Průměrný úbytek/týden</span>
                <span className={`stat-value text-xl ${projection.stats.avgWeeklyLoss > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {projection.stats.avgWeeklyLoss > 0 ? "-" : "+"}
                  {Math.abs(projection.stats.avgWeeklyLoss).toFixed(2)} kg
                </span>
              </div>
            </div>

            {/* Best/Worst days */}
            <div className="grid grid-cols-2 gap-4">
              {projection.stats.bestDay && (
                <div className="stat-card">
                  <span className="stat-label">Nejlepší den</span>
                  <span className="text-sm font-semibold text-emerald-400">
                    -{projection.stats.bestDay.loss.toFixed(2)} kg
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDateFull(projection.stats.bestDay.date)}
                  </span>
                </div>
              )}
              {projection.stats.worstDay && (
                <div className="stat-card">
                  <span className="stat-label">Nejhorší den</span>
                  <span className="text-sm font-semibold text-red-400">
                    +{projection.stats.worstDay.gain.toFixed(2)} kg
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDateFull(projection.stats.worstDay.date)}
                  </span>
                </div>
              )}
            </div>

            {/* Streaks */}
            <div className="grid grid-cols-2 gap-4">
              <div className="stat-card">
                <span className="stat-label">Aktuální série</span>
                <span className="stat-value text-xl text-emerald-400">
                  {projection.stats.currentStreak} dní
                </span>
                <span className="text-xs text-gray-500">v řadě dolů</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Nejdelší série</span>
                <span className="stat-value text-xl text-indigo-400">
                  {projection.stats.longestStreak} dní
                </span>
                <span className="text-xs text-gray-500">v řadě dolů</span>
              </div>
            </div>

            {/* Hypothetical Scenarios */}
            <div className="mt-4 pt-4 border-t border-gray-800">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Hypotetické scénáře
              </h4>
              <div className="space-y-2">
                {[
                  { deficit: 300, label: "Deficit 300 kcal/den" },
                  { deficit: 500, label: "Deficit 500 kcal/den (aktuální)" },
                  { deficit: 750, label: "Deficit 750 kcal/den" },
                  { deficit: 1000, label: "Deficit 1000 kcal/den" },
                ].map((scenario) => {
                  const kgPerDay = scenario.deficit / 7700;
                  const daysNeeded = Math.ceil(remaining / kgPerDay);
                  const endDate = new Date();
                  endDate.setDate(endDate.getDate() + daysNeeded);
                  return (
                    <div
                      key={scenario.deficit}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        scenario.deficit === 500 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-gray-800/30"
                      }`}
                    >
                      <span className={`text-sm ${scenario.deficit === 500 ? "text-emerald-400 font-medium" : "text-gray-400"}`}>
                        {scenario.label}
                      </span>
                      <div className="text-right">
                        <div className={`text-sm font-semibold ${scenario.deficit === 500 ? "text-emerald-400" : "text-gray-300"}`}>
                          {daysNeeded} dní
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDateFull(endDate.toISOString().split("T")[0])}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
