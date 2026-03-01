"use client";

import { useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import { UserProfile, DailyEntry } from "@/types";
import { updateEntry, clearAll, updateTargetWeight, loadState } from "@/lib/storage";
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
import WeeklyAveragesCard from "./WeeklyAveragesCard";
import EditTargetModal from "./EditTargetModal";
import ThemeToggle from "./ThemeToggle";
import Confetti from "./Confetti";
import NewRecordToast from "./NewRecordToast";

interface Props {
  profile: UserProfile;
  entries: DailyEntry[];
  setEntries: (entries: DailyEntry[]) => void;
  onReset: () => void;
  onProfileUpdate: (profile: UserProfile, entries: DailyEntry[]) => void;
}

export default function Dashboard({ profile, entries, setEntries, onReset, onProfileUpdate }: Props) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showEditTarget, setShowEditTarget] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [newRecord, setNewRecord] = useState<{ weight: number; previousMin: number } | null>(null);

  const filled = getFilledEntries(entries);
  const latestWeight = filled.length > 0 ? filled[filled.length - 1].weight! : profile.startWeight;
  const calorieInfo = calculateCalorieInfo(profile, latestWeight);
  const totalDays = calculateTotalDays(profile);

  // Calculate total and burned calories
  const totalCaloriesToBurn = calculateTotalCaloriesToBurn(profile);
  const caloriesBurned = calculateCaloriesBurned(profile, latestWeight);

  const handleUpdateEntry = useCallback(
    (date: string, weight: number | null) => {
      // Protection: Cannot delete first day
      if (date === profile.startDate && weight === null) {
        alert("První den (výchozí váha) nelze smazat.");
        return;
      }

      if (weight !== null) {
        // Find current minimum (excluding the entry being updated)
        const otherWeights = entries
          .filter(e => e.date !== date && e.weight !== null)
          .map(e => e.weight!);
        const currentMin = otherWeights.length > 0 ? Math.min(...otherWeights) : profile.startWeight;

        // Check if this is a new record
        if (weight < currentMin) {
          setShowConfetti(true);
          setNewRecord({ weight, previousMin: currentMin });
          setTimeout(() => setShowConfetti(false), 4000);
        }
      }

      const updated = entries.map((e) => (e.date === date ? { ...e, weight } : e));
      setEntries(updated);
      updateEntry(date, weight);
    },
    [entries, setEntries, profile.startWeight, profile.startDate]
  );

  const handleReset = async () => {
    await clearAll();
    onReset();
    setShowResetConfirm(false);
  };

  const handleUpdateTarget = useCallback(async (newTarget: number) => {
    await updateTargetWeight(newTarget);

    // Reload fresh data
    const state = await loadState();
    if (state.profile && state.entries) {
      onProfileUpdate(state.profile, state.entries);
    }
  }, [onProfileUpdate]);

  return (
    <div className="min-h-screen">
      {/* Confetti & Toast */}
      <Confetti trigger={showConfetti} />
      <NewRecordToast
        show={!!newRecord}
        weight={newRecord?.weight ?? 0}
        previousMin={newRecord?.previousMin ?? 0}
        onClose={() => setNewRecord(null)}
      />

      {/* Top Nav */}
      <header className="sticky top-0 z-50 glass border-b border-gray-200 dark:border-gray-800/50 rounded-none backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo - always visible */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  WeightFlow
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-400 hidden sm:block">
                  Ahoj, {profile.name}
                </p>
              </div>
            </div>

            {/* Current weight - mobile only */}
            <div className="md:hidden text-center">
              <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{latestWeight.toFixed(1)} kg</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">aktuální</div>
            </div>

            {/* Desktop: full stats + buttons */}
            <div className="hidden md:flex items-center gap-6">
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="text-emerald-500 dark:text-emerald-400 font-bold">{calorieInfo.dailyTarget}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">kcal/den</div>
                </div>
                <div className="h-6 w-px bg-gray-300 dark:bg-gray-800" />
                <div className="text-center">
                  <div className="text-gray-900 dark:text-gray-100 font-bold">{latestWeight.toFixed(1)} kg</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">aktuální</div>
                </div>
                <div className="h-6 w-px bg-gray-300 dark:bg-gray-800" />
                <div className="text-center">
                  <div className="text-amber-500 dark:text-amber-400 font-bold">{totalDays} dní</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">plán</div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <ThemeToggle />
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

            {/* Mobile: hamburger menu */}
            <button
              className="md:hidden p-2 hover:bg-gray-200 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile dropdown menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 dark:border-gray-800/50 mt-3 pt-3 px-2 space-y-3 animate-slide-up">
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <span className="text-emerald-500 dark:text-emerald-400 font-bold block">{calorieInfo.dailyTarget}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">kcal/den</span>
                </div>
                <div>
                  <span className="text-gray-900 dark:text-gray-100 font-bold block">{latestWeight.toFixed(1)} kg</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">aktuální</span>
                </div>
                <div>
                  <span className="text-amber-500 dark:text-amber-400 font-bold block">{totalDays} dní</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">plán</span>
                </div>
              </div>
              <div className="flex gap-2">
                <ThemeToggle />
                <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary flex-1 text-xs py-2">
                  Odhlásit
                </button>
                <button onClick={() => setShowResetConfirm(true)} className="btn-secondary flex-1 text-xs py-2">
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 animate-fade-in">
          <div className="stat-card glass-sm p-3 sm:p-4">
            <span className="stat-label">Start</span>
            <span className="stat-value text-base sm:text-lg">{profile.startWeight} kg</span>
          </div>
          <div className="stat-card glass-sm p-3 sm:p-4 relative group">
            <span className="stat-label">Cíl</span>
            <span className="stat-value text-base sm:text-lg text-amber-400">{profile.targetWeight} kg</span>

            {/* Edit button */}
            <button
              onClick={() => setShowEditTarget(true)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700/50 rounded-lg"
              title="Upravit cíl"
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
          <div className="stat-card glass-sm p-3 sm:p-4">
            <span className="stat-label">Celkem shodit</span>
            <span className="stat-value text-base sm:text-lg text-emerald-500 dark:text-emerald-400">
              {(profile.startWeight - profile.targetWeight).toFixed(1)} kg
            </span>
          </div>
          <div className="stat-card glass-sm p-3 sm:p-4">
            <span className="stat-label">Kalorie</span>
            <span className="stat-value text-xs sm:text-sm text-cyan-500 dark:text-cyan-400">
              {caloriesBurned.toLocaleString()} / {totalCaloriesToBurn.toLocaleString()}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              spáleno / celkem
            </span>
          </div>
          <div className="stat-card glass-sm p-3 sm:p-4">
            <span className="stat-label">Záznamy</span>
            <span className="stat-value text-base sm:text-lg">{filled.length}/{totalDays}</span>
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
          <div className="lg:col-span-1 space-y-6">
            <ProgressSection profile={profile} entries={entries} />
            <WeeklyAveragesCard profile={profile} entries={entries} />
          </div>
        </div>
      </main>

      {/* Edit Target Modal */}
      {showEditTarget && (
        <EditTargetModal
          profile={profile}
          currentWeight={latestWeight}
          onConfirm={handleUpdateTarget}
          onClose={() => setShowEditTarget(false)}
        />
      )}

      {/* Reset Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass p-6 max-w-sm w-full mx-4 animate-scale-in">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Smazat všechna data?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
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
