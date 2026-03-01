"use client";

import { useState, useEffect } from "react";
import { UserProfile, DailyEntry } from "@/types";
import { loadState, saveProfile, saveEntries } from "@/lib/storage";
import { generateInitialEntries } from "@/lib/calculations";
import OnboardingForm from "@/components/OnboardingForm";
import Dashboard from "@/components/Dashboard";

export default function HomeClient() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadState().then((state) => {
      if (state.profile) {
        setProfile(state.profile);
        setEntries(
          state.entries.length > 0
            ? state.entries
            : generateInitialEntries(state.profile)
        );
      }
      setLoading(false);
    });
  }, []);

  const handleOnboardingComplete = async (newProfile: UserProfile) => {
    const initialEntries = generateInitialEntries(newProfile);
    setProfile(newProfile);
    setEntries(initialEntries);
    await saveProfile(newProfile);
    await saveEntries(initialEntries);
  };

  const handleReset = () => {
    setProfile(null);
    setEntries([]);
  };

  const handleUpdateProfile = (newProfile: UserProfile, newEntries: DailyEntry[]) => {
    setProfile(newProfile);
    setEntries(newEntries);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center animate-pulse">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="text-gray-500 text-sm">Načítání...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <OnboardingForm onComplete={handleOnboardingComplete} />;
  }

  return (
    <Dashboard
      profile={profile}
      entries={entries}
      setEntries={setEntries}
      onReset={handleReset}
      onProfileUpdate={handleUpdateProfile}
    />
  );
}
