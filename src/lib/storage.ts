import { AppState, UserProfile, DailyEntry } from "@/types";

export async function loadState(): Promise<AppState> {
  try {
    const res = await fetch("/api/state");
    if (!res.ok) throw new Error("Failed to load state");
    return await res.json();
  } catch {
    return { profile: null, entries: [] };
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
}

export async function saveEntries(entries: DailyEntry[]): Promise<void> {
  await fetch("/api/entries", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries),
  });
}

export async function updateEntry(
  date: string,
  weight: number | null
): Promise<void> {
  await fetch("/api/entries", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, weight }),
  });
}

export async function clearAll(): Promise<void> {
  await fetch("/api/state", { method: "DELETE" });
}

export async function exportData(): Promise<string> {
  const state = await loadState();
  return JSON.stringify(state, null, 2);
}
