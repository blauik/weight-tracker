"use client";

import { useState, useRef, useEffect } from "react";
import { UserProfile, DailyEntry } from "@/types";
import { formatDate, getDayOfWeek, isToday, isPast, getIdealWeightForDate } from "@/lib/calculations";

interface Props {
  profile: UserProfile;
  entries: DailyEntry[];
  onUpdateEntry: (date: string, weight: number | null) => void;
}

export default function WeightTable({ profile, entries, onUpdateEntry }: Props) {
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [page, setPage] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const todayRef = useRef<HTMLTableRowElement>(null);
  const ROWS_PER_PAGE = 14;

  // Find today's page
  const todayIndex = entries.findIndex((e) => isToday(e.date));
  const initialPage = todayIndex >= 0 ? Math.floor(todayIndex / ROWS_PER_PAGE) : 0;

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    if (editingDate && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingDate]);

  const totalPages = Math.ceil(entries.length / ROWS_PER_PAGE);
  const displayEntries = entries.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  const startEdit = (entry: DailyEntry) => {
    setEditingDate(entry.date);
    setEditValue(entry.weight !== null ? String(entry.weight) : "");
  };

  const commitEdit = () => {
    if (editingDate) {
      const weight = editValue.trim() === "" ? null : parseFloat(editValue);
      if (weight === null || (!isNaN(weight) && weight > 0)) {
        onUpdateEntry(editingDate, weight);
      }
      setEditingDate(null);
      setEditValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commitEdit();
      // Move to next row
      const idx = entries.findIndex((entry) => entry.date === editingDate);
      if (idx < entries.length - 1) {
        const nextEntry = entries[idx + 1];
        if (isPast(nextEntry.date)) {
          setTimeout(() => startEdit(nextEntry), 50);
        }
      }
    } else if (e.key === "Escape") {
      setEditingDate(null);
    }
  };

  const getDiff = (index: number): { value: number; text: string; color: string } | null => {
    const globalIdx = page * ROWS_PER_PAGE + index;
    const entry = entries[globalIdx];
    if (!entry || entry.weight === null) return null;

    // Find previous entry with weight
    for (let i = globalIdx - 1; i >= 0; i--) {
      if (entries[i].weight !== null) {
        const diff = entry.weight! - entries[i].weight!;
        const rounded = Math.round(diff * 100) / 100;
        return {
          value: rounded,
          text: rounded > 0 ? `+${rounded.toFixed(2)}` : rounded.toFixed(2),
          color: rounded < 0 ? "text-emerald-400" : rounded > 0 ? "text-red-400" : "text-gray-500",
        };
      }
    }
    return null;
  };

  return (
    <div className="glass p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">Denní záznamy</h3>
          <p className="text-sm text-gray-500">Klikněte na řádek pro zadání váhy</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-30"
          >
            &larr;
          </button>
          <span className="text-sm text-gray-500 min-w-[80px] text-center">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-30"
          >
            &rarr;
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-3 px-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Den</th>
              <th className="text-left py-3 px-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Datum</th>
              <th className="text-right py-3 px-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Váha</th>
              <th className="text-right py-3 px-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Změna</th>
              <th className="text-right py-3 px-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Ideál</th>
              <th className="text-right py-3 px-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Rozdíl</th>
            </tr>
          </thead>
          <tbody>
            {displayEntries.map((entry, idx) => {
              const today = isToday(entry.date);
              const past = isPast(entry.date);
              const dayNum = page * ROWS_PER_PAGE + idx + 1;
              const idealWeight = Math.round(getIdealWeightForDate(profile, entry.date) * 100) / 100;
              const diff = getDiff(idx);
              const vsIdeal = entry.weight !== null ? Math.round((entry.weight - idealWeight) * 100) / 100 : null;
              const isEditing = editingDate === entry.date;
              const isWeekend = [0, 6].includes(new Date(entry.date).getDay());

              return (
                <tr
                  key={entry.date}
                  ref={today ? todayRef : undefined}
                  onClick={() => past && !isEditing && startEdit(entry)}
                  className={`border-b border-gray-800/50 transition-colors duration-150 ${
                    today
                      ? "table-row-today"
                      : past
                      ? "hover:bg-gray-800/30 cursor-pointer"
                      : "opacity-40"
                  } ${isWeekend && !today ? "bg-gray-800/10" : ""}`}
                >
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs font-mono w-6">#{dayNum}</span>
                      <span className={`text-xs ${today ? "text-emerald-400 font-bold" : "text-gray-500"}`}>
                        {getDayOfWeek(entry.date)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={today ? "text-emerald-400 font-medium" : "text-gray-300"}>
                      {formatDate(entry.date)}
                    </span>
                    {today && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">
                        dnes
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="number"
                        step="0.1"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                        className="w-24 px-2 py-1 bg-gray-800 border border-emerald-500/50 rounded-lg text-right text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : entry.weight !== null ? (
                      <span className="font-mono font-medium text-gray-100">
                        {entry.weight.toFixed(1)} kg
                      </span>
                    ) : past ? (
                      <span className="text-gray-600 italic">klikněte</span>
                    ) : (
                      <span className="text-gray-700">&mdash;</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {diff ? (
                      <span className={`font-mono text-xs font-medium ${diff.color}`}>{diff.text}</span>
                    ) : (
                      <span className="text-gray-700">&mdash;</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="font-mono text-xs text-indigo-400/60">{idealWeight.toFixed(1)}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {vsIdeal !== null ? (
                      <span
                        className={`font-mono text-xs font-medium ${
                          vsIdeal <= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {vsIdeal > 0 ? "+" : ""}
                        {vsIdeal.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-gray-700">&mdash;</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
