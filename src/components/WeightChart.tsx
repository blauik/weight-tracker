"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import { UserProfile, DailyEntry } from "@/types";
import { getIdealWeightForDate, formatDate, getFilledEntries } from "@/lib/calculations";

interface Props {
  profile: UserProfile;
  entries: DailyEntry[];
}

export default function WeightChart({ profile, entries }: Props) {
  const filled = getFilledEntries(entries);
  if (filled.length === 0) return null;

  // Build chart data: actual weight + ideal line
  const chartData = filled.map((entry) => ({
    date: entry.date,
    label: formatDate(entry.date),
    weight: entry.weight,
    ideal: Math.round(getIdealWeightForDate(profile, entry.date) * 100) / 100,
  }));

  // Add projection line if we have enough data
  if (filled.length >= 2) {
    const lastEntry = filled[filled.length - 1];
    const secondLast = filled[filled.length - 2];
    const dailyChange = (lastEntry.weight! - secondLast.weight!);

    // Add 14 days of projection
    for (let i = 1; i <= 14; i++) {
      const d = new Date(lastEntry.date);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const projectedWeight = lastEntry.weight! + dailyChange * i;
      if (projectedWeight >= profile.targetWeight) {
        chartData.push({
          date: dateStr,
          label: formatDate(dateStr),
          weight: undefined as unknown as number,
          ideal: Math.round(getIdealWeightForDate(profile, dateStr) * 100) / 100,
          projected: Math.round(projectedWeight * 100) / 100,
        } as any);
      }
    }
  }

  const allWeights = chartData
    .flatMap((d: any) => [d.weight, d.ideal, d.projected])
    .filter((w: number | undefined) => w !== undefined && w !== null) as number[];
  const minW = Math.floor(Math.min(...allWeights) - 1);
  const maxW = Math.ceil(Math.max(...allWeights) + 1);

  return (
    <div className="glass p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">Vývoj váhy</h3>
          <p className="text-sm text-gray-500">Skutečnost vs. ideální plán</p>
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="label"
              stroke="#6b7280"
              fontSize={11}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#6b7280"
              fontSize={11}
              tickLine={false}
              domain={[minW, maxW]}
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
              labelStyle={{ color: "#9ca3af" }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  weight: "Skutečná váha",
                  ideal: "Ideální plán",
                  projected: "Projekce",
                };
                return [`${value} kg`, labels[name] || name];
              }}
            />
            <Legend
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  weight: "Skutečná váha",
                  ideal: "Ideální plán",
                  projected: "Projekce trendu",
                };
                return labels[value] || value;
              }}
              wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }}
            />
            <ReferenceLine
              y={profile.targetWeight}
              stroke="#f59e0b"
              strokeDasharray="8 4"
              strokeWidth={1.5}
              label={{
                value: `Cíl: ${profile.targetWeight} kg`,
                position: "right",
                fill: "#f59e0b",
                fontSize: 11,
              }}
            />
            <Area
              type="monotone"
              dataKey="weight"
              fill="url(#weightGradient)"
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ fill: "#10b981", strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="ideal"
              stroke="#6366f1"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
            />
            {(chartData as any[]).some((d) => d.projected) && (
              <Line
                type="monotone"
                dataKey="projected"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
