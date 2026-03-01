import { AppState, UserProfile, DailyEntry } from "@/types";

const STORAGE_KEY = "weight-tracker-app";

export function loadState(): AppState {
  if (typeof window === "undefined") return { profile: null, entries: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { profile: null, entries: [] };
    return JSON.parse(raw);
  } catch {
    return { profile: null, entries: [] };
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function saveProfile(profile: UserProfile): void {
  const state = loadState();
  state.profile = profile;
  saveState(state);
}

export function saveEntries(entries: DailyEntry[]): void {
  const state = loadState();
  state.entries = entries;
  saveState(state);
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function exportData(): string {
  const state = loadState();
  return JSON.stringify(state, null, 2);
}
