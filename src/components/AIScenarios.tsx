"use client";

import { UserProfile, DailyEntry } from "@/types";
import { calculateAIPrediction } from "@/lib/aiPrediction";
import { formatDateFull } from "@/lib/calculations";

interface Props {
  profile: UserProfile;
  entries: DailyEntry[];
}

export default function AIScenarios({ profile, entries }: Props) {
  const aiPrediction = calculateAIPrediction(profile, entries);

  if (!aiPrediction || aiPrediction.confidence < 0.3) {
    return (
      <div className="glass p-4 sm:p-6 animate-slide-up" style={{ animationDelay: "0.3s" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="text-2xl">🤖</div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">AI Predikce</h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {aiPrediction ? "Nízká přesnost - potřeba více dat" : "Potřeba alespoň 5 záznamů"}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Pokračujte v zadávání váhy pro přesnější AI predikci vašeho pokroku.
        </p>
      </div>
    );
  }

  const confidence = Math.round(aiPrediction.confidence * 100);
  const confidenceColor =
    confidence >= 85 ? "text-emerald-500 dark:text-emerald-400" : confidence >= 70 ? "text-amber-500 dark:text-amber-400" : "text-orange-400";

  const scenarios = [
    {
      name: "Optimistický",
      color: "emerald",
      bgColor: "bg-emerald-500/10 border-emerald-500/20",
      textColor: "text-emerald-400",
      date: aiPrediction.estimatedGoalDate.optimistic,
      icon: "🚀",
    },
    {
      name: "Realistický",
      color: "violet",
      bgColor: "bg-violet-500/10 border-violet-500/20",
      textColor: "text-violet-400",
      date: aiPrediction.estimatedGoalDate.realistic,
      icon: "🎯",
    },
    {
      name: "Pesimistický",
      color: "orange",
      bgColor: "bg-orange-500/10 border-orange-500/20",
      textColor: "text-orange-400",
      date: aiPrediction.estimatedGoalDate.pessimistic,
      icon: "🐢",
    },
  ];

  return (
    <div className="glass p-4 sm:p-6 animate-slide-up" style={{ animationDelay: "0.3s" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🤖</div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">AI Predikce</h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Polynomiální regrese</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xl sm:text-2xl font-bold ${confidenceColor}`}>{confidence}%</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">spolehlivost</div>
        </div>
      </div>

      {/* Trends */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="stat-card p-3 sm:p-4">
          <span className="stat-label text-xs">Nedávný trend (14 dní)</span>
          <span className={`stat-value text-base sm:text-lg ${aiPrediction.recentTrend > 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-400"}`}>
            {aiPrediction.recentTrend > 0 ? "-" : "+"}
            {Math.abs(aiPrediction.recentTrend).toFixed(3)} kg/den
          </span>
        </div>
        <div className="stat-card p-3 sm:p-4">
          <span className="stat-label text-xs">Celkový trend</span>
          <span className={`stat-value text-base sm:text-lg ${aiPrediction.overallTrend > 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-400"}`}>
            {aiPrediction.overallTrend > 0 ? "-" : "+"}
            {Math.abs(aiPrediction.overallTrend).toFixed(3)} kg/den
          </span>
        </div>
      </div>

      {/* Scenarios */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
          Scénáře dosažení cíle
        </h4>
        {scenarios.map((scenario) => (
          <div
            key={scenario.name}
            className={`flex items-center justify-between p-3 rounded-lg border ${scenario.bgColor}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{scenario.icon}</span>
              <span className={`text-sm font-medium ${scenario.textColor}`}>{scenario.name}</span>
            </div>
            <div className="text-right">
              {scenario.date ? (
                <>
                  <div className={`text-xs sm:text-sm font-semibold ${scenario.textColor}`}>
                    {formatDateFull(scenario.date)}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {(() => {
                      const today = new Date();
                      const goalDate = new Date(scenario.date);
                      const daysLeft = Math.ceil((goalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      return `za ${daysLeft} dní`;
                    })()}
                  </div>
                </>
              ) : (
                <span className="text-xs text-gray-600 dark:text-gray-400">Nedosažitelný v 30 dnech</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-gray-200/20 dark:bg-gray-800/30 rounded-lg border border-gray-400/30 dark:border-gray-700/30">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong className="text-gray-900 dark:text-gray-300">Jak to funguje:</strong> AI analyzuje váš pokrok pomocí kvadratické regrese a předpovídá budoucí vývoj s{" "}
          <span className={confidenceColor}>{confidence}% spolehlivostí</span>. Čím více dat, tím přesnější predikce.
        </p>
      </div>
    </div>
  );
}
