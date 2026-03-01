"use client";

import { useState } from "react";
import { UserProfile } from "@/types";

interface Props {
  profile: UserProfile;
  currentWeight: number;
  onConfirm: (newTarget: number) => Promise<void>;
  onClose: () => void;
}

export default function EditTargetModal({ profile, currentWeight, onConfirm, onClose }: Props) {
  const [newTarget, setNewTarget] = useState(profile.targetWeight.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const targetNum = parseFloat(newTarget);

    // Validation
    if (isNaN(targetNum) || targetNum <= 0) {
      setError("Zadejte platnou váhu");
      return;
    }

    if (targetNum >= profile.startWeight) {
      setError(`Cíl musí být nižší než počáteční váha (${profile.startWeight} kg)`);
      return;
    }

    if (targetNum >= currentWeight) {
      setError(`Cíl musí být nižší než aktuální váha (${currentWeight.toFixed(1)} kg)`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onConfirm(targetNum);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při ukládání");
    } finally {
      setLoading(false);
    }
  };

  const oldDays = Math.ceil((profile.startWeight - profile.targetWeight) * 7700 / 500);
  const newDays = Math.ceil((profile.startWeight - parseFloat(newTarget || "0")) * 7700 / 500);
  const daysDiff = newDays - oldDays;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass p-6 max-w-md w-full mx-4 animate-scale-in">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Upravit cílovou váhu</h3>

        <div className="space-y-4">
          {/* Current target */}
          <div className="bg-gray-200/30 dark:bg-gray-800/30 p-4 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Současný cíl</div>
            <div className="text-2xl font-bold text-amber-500 dark:text-amber-400">{profile.targetWeight} kg</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{oldDays} dní celkem</div>
          </div>

          {/* New target input */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Nový cíl</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={newTarget}
                onChange={(e) => {
                  setNewTarget(e.target.value);
                  setError(null);
                }}
                className="input-base pr-12"
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 text-sm">kg</span>
            </div>
          </div>

          {/* Preview of change */}
          {parseFloat(newTarget) > 0 && parseFloat(newTarget) < profile.startWeight && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Náhled změny:</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">Nový celkový plán:</span>
                <span className="font-semibold text-emerald-500 dark:text-emerald-400">{newDays} dní</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-700 dark:text-gray-300">Rozdíl:</span>
                <span className={`font-semibold ${daysDiff > 0 ? "text-amber-500 dark:text-amber-400" : "text-emerald-500 dark:text-emerald-400"}`}>
                  {daysDiff > 0 ? "+" : ""}{daysDiff} dní
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Warning */}
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs text-amber-300">
            Změnou cíle se přepočítá celý plán. Vaše váhové záznamy zůstanou zachovány.
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} className="btn-secondary" disabled={loading}>
            Zrušit
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !!error}
            className="btn-primary"
          >
            {loading ? "Ukládám..." : "Potvrdit změnu"}
          </button>
        </div>
      </div>
    </div>
  );
}
