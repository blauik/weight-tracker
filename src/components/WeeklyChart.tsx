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

interface Props {
  entries: DailyEntry[];
}

export default function WeeklyChart({ entries }: Props) {
  const filled = getFilledEntries(entries);
  if (filled.length < 7) return null;

  // Group entries by week
  const weeks: { label: string; change: number; avgWeight: number }[] = [];
  const startDate = new Date(filled[0].date);

  let weekEntries: DailyEntry[] = [];
  for (const entry of filled) {
    const daysSinceStart = Math.floor(
      (new Date(entry.date).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const weekNum = Math.floor(daysSinceStart / 7);

    while (weeks.length <= weekNum) {
      if (weekEntries.length > 0) {
        const firstW = weekEntries[0].weight!;
        const lastW = weekEntries[weekEntries.length - 1].weight!;
        const avg = weekEntries.reduce((s, e) => s + e.weight!, 0) / weekEntries.length;
        weeks.push({
          label: `T${weeks.length + 1}`,
          change: Math.round((lastW - firstW) * 100) / 100,
          avgWeight: Math.round(avg * 100) / 100,
        });
      }
      weekEntries = [];
    }
    weekEntries.push(entry);
  }

  // Push last week
  if (weekEntries.length > 0) {
    const firstW = weekEntries[0].weight!;
    const lastW = weekEntries[weekEntries.length - 1].weight!;
    const avg = weekEntries.reduce((s, e) => s + e.weight!, 0) / weekEntries.length;
    weeks.push({
      label: `T${weeks.length + 1}`,
      change: Math.round((lastW - firstW) * 100) / 100,
      avgWeight: Math.round(avg * 100) / 100,
    });
  }

  if (weeks.length < 2) return null;

  return (
    <div className="glass p-6 animate-slide-up">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-100">Týdenní změny</h3>
        <p className="text-sm text-gray-500">Změna váhy za každý týden</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeks} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" stroke="#6b7280" fontSize={11} tickLine={false} />
            <YAxis
              stroke="#6b7280"
              fontSize={11}
              tickLine={false}
              tickFormatter={(v) => `${v} kg`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: "12px",
                fontSize: "13px",
                color: "#e5e7eb",
              }}
              formatter={(value: number) => [`${value} kg`, "Změna"]}
            />
            <ReferenceLine y={0} stroke="#374151" />
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
