"use client";

import { useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import { UserProfile, DailyEntry } from "@/types";
import { updateEntry, clearAll } from "@/lib/storage";
import {
  calculateCalorieInfo,
  getFilledEntries,
  calculateTotalDays,
  calculateTotalCaloriesToBurn,
  calculateCaloriesBurned
} from "@/lib/calculations";
import WeightChart from "./WeightChart";
import WeeklyChart from "./WeeklyChart";
import WeightTable from "./WeightTable";
import ProgressSection from "./ProgressSection";

interface Props {
  profile: UserProfile;
  entries: DailyEntry[];
  setEntries: (entries: DailyEntry[]) => void;
  onReset: () => void;
}

export default function Dashboard({ profile, entries, setEntries, onReset }: Props) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const filled = getFilledEntries(entries);
  const latestWeight = filled.length > 0 ? filled[filled.length - 1].weight! : profile.startWeight;
  const calorieInfo = calculateCalorieInfo(profile, latestWeight);
  const totalDays = calculateTotalDays(profile);

  // Calculate total and burned calories
  const totalCaloriesToBurn = calculateTotalCaloriesToBurn(profile);
  const caloriesBurned = calculateCaloriesBurned(profile, latestWeight);

  const handleUpdateEntry = useCallback(
    (date: string, weight: number | null) => {
      const updated = entries.map((e) => (e.date === date ? { ...e, weight } : e));
      setEntries(updated);
      updateEntry(date, weight);
    },
    [entries, setEntries]
  );

  const handleReset = async () => {
    await clearAll();
    onReset();
    setShowResetConfirm(false);
  };

  return (
    <div className="min-h-screen">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 glass border-b border-gray-800/50 rounded-none backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                WeightFlow
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">
                Ahoj, {profile.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Quick Stats in Nav */}
            <div className="hidden md:flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-emerald-400 font-bold">{calorieInfo.dailyTarget}</div>
                <div className="text-xs text-gray-500">kcal/den</div>
              </div>
              <div className="h-6 w-px bg-gray-800" />
              <div className="text-center">
                <div className="text-gray-100 font-bold">{latestWeight.toFixed(1)} kg</div>
                <div className="text-xs text-gray-500">aktuální</div>
              </div>
              <div className="h-6 w-px bg-gray-800" />
              <div className="text-center">
                <div className="text-amber-400 font-bold">{totalDays} dní</div>
                <div className="text-xs text-gray-500">plán</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Odhlásit
              </button>

              <button
                onClick={() => setShowResetConfirm(true)}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-fade-in">
          <div className="stat-card glass-sm">
            <span className="stat-label">Start</span>
            <span className="stat-value text-lg">{profile.startWeight} kg</span>
          </div>
          <div className="stat-card glass-sm">
            <span className="stat-label">Cíl</span>
            <span className="stat-value text-lg text-amber-400">{profile.targetWeight} kg</span>
          </div>
          <div className="stat-card glass-sm">
            <span className="stat-label">Celkem shodit</span>
            <span className="stat-value text-lg text-emerald-400">
              {(profile.startWeight - profile.targetWeight).toFixed(1)} kg
            </span>
          </div>
          <div className="stat-card glass-sm">
            <span className="stat-label">Kalorie</span>
            <span className="stat-value text-sm text-cyan-400">
              {caloriesBurned.toLocaleString()} / {totalCaloriesToBurn.toLocaleString()}
            </span>
            <span className="text-xs text-gray-500 mt-0.5">
              spáleno / celkem
            </span>
          </div>
          <div className="stat-card glass-sm">
            <span className="stat-label">Záznamy</span>
            <span className="stat-value text-lg">{filled.length}/{totalDays}</span>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Charts */}
          <div className="lg:col-span-2 space-y-6">
            <WeightChart profile={profile} entries={entries} />
            <WeeklyChart entries={entries} />
            <WeightTable
              profile={profile}
              entries={entries}
              onUpdateEntry={handleUpdateEntry}
            />
          </div>

          {/* Right: Progress & Stats */}
          <div className="lg:col-span-1">
            <ProgressSection profile={profile} entries={entries} />
          </div>
        </div>
      </main>

      {/* Reset Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass p-6 max-w-sm w-full mx-4 animate-scale-in">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Smazat všechna data?</h3>
            <p className="text-sm text-gray-400 mb-6">
              Tato akce je nevratná. Všechna data včetně profilu a záznamů budou smazána.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowResetConfirm(false)} className="btn-secondary">
                Zrušit
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl border border-red-500/30 transition-all"
              >
                Smazat vše
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
