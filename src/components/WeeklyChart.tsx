"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts";
import { DailyEntry } from "@/types";
import { getFilledEntries } from "@/lib/calculations";
import { useTheme } from "./ThemeProvider";

interface Props {
  entries: DailyEntry[];
}

export default function WeeklyChart({ entries }: Props) {
  const { theme } = useTheme();
  const filled = getFilledEntries(entries);
  if (filled.length < 7) return null;

  // Group entries by week
  const startDate = new Date(filled[0].date);
  const weekGroups = new Map<number, DailyEntry[]>();

  for (const entry of filled) {
    const daysSinceStart = Math.floor(
      (new Date(entry.date).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const weekNum = Math.floor(daysSinceStart / 7);
    if (!weekGroups.has(weekNum)) weekGroups.set(weekNum, []);
    weekGroups.get(weekNum)!.push(entry);
  }

  const weeks = Array.from(weekGroups.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekNum, weekEntries]) => {
      const firstW = weekEntries[0].weight!;
      const lastW = weekEntries[weekEntries.length - 1].weight!;
      const avg = weekEntries.reduce((s, e) => s + e.weight!, 0) / weekEntries.length;
      return {
        label: `T${weekNum + 1}`,
        change: Math.round((lastW - firstW) * 100) / 100,
        avgWeight: Math.round(avg * 100) / 100,
      };
    });

  if (weeks.length < 2) return null;

  return (
    <div className="glass p-4 sm:p-6 animate-slide-up">
      <div className="mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-100">Týdenní změny</h3>
        <p className="text-xs sm:text-sm text-gray-500">Změna váhy za každý týden</p>
      </div>
      <div className="h-48 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeks} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1f2937" : "#e5e7eb"} />
            <XAxis dataKey="label" stroke={theme === "dark" ? "#6b7280" : "#9ca3af"} fontSize={11} tickLine={false} />
            <YAxis
              stroke={theme === "dark" ? "#6b7280" : "#9ca3af"}
              fontSize={11}
              tickLine={false}
              tickFormatter={(v) => `${v} kg`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme === "dark" ? "#111827" : "#ffffff",
                border: `1px solid ${theme === "dark" ? "#374151" : "#e5e7eb"}`,
                borderRadius: "12px",
                fontSize: "13px",
                color: theme === "dark" ? "#e5e7eb" : "#1f2937",
              }}
              formatter={(value: number) => [`${value} kg`, "Změna"]}
            />
            <ReferenceLine y={0} stroke={theme === "dark" ? "#374151" : "#d1d5db"} />
            <Bar dataKey="change" radius={[6, 6, 0, 0]} maxBarSize={40}>
              {weeks.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.change <= 0 ? "#10b981" : "#ef4444"}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
