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
import { getIdealWeightForDate, formatDate, getFilledEntries, calculateMovingAverage } from "@/lib/calculations";
import { calculateAIPrediction } from "@/lib/aiPrediction";
import { useTheme } from "./ThemeProvider";

interface Props {
  profile: UserProfile;
  entries: DailyEntry[];
}

export default function WeightChart({ profile, entries }: Props) {
  const { theme } = useTheme();
  const filled = getFilledEntries(entries);
  if (filled.length === 0) return null;

  // Calculate moving average
  const movingAvg = calculateMovingAverage(filled, 7);

  // Calculate AI prediction
  const aiPrediction = calculateAIPrediction(profile, entries);

  // Build chart data: actual weight + ideal line + trend
  const chartData = filled.map((entry, i) => ({
    date: entry.date,
    label: formatDate(entry.date),
    weight: entry.weight,
    ideal: Math.round(getIdealWeightForDate(profile, entry.date) * 100) / 100,
    trend: movingAvg[i],
  }));

  // Add AI prediction if available
  if (aiPrediction && aiPrediction.predictions.length > 0) {
    aiPrediction.predictions.forEach(pred => {
      chartData.push({
        date: pred.date,
        label: formatDate(pred.date),
        weight: undefined as unknown as number,
        ideal: Math.round(getIdealWeightForDate(profile, pred.date) * 100) / 100,
        aiRealistic: pred.realistic,
        trend: undefined as unknown as number,
      } as any);
    });
  }

  const allWeights = chartData
    .flatMap((d: any) => [d.weight, d.ideal, d.aiRealistic, d.trend])
    .filter((w: number | undefined) => w !== undefined && w !== null) as number[];
  const minW = Math.floor(Math.min(...allWeights) - 1);
  const maxW = Math.ceil(Math.max(...allWeights) + 1);

  return (
    <div className="glass p-4 sm:p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-100">Vývoj váhy</h3>
          <p className="text-xs sm:text-sm text-gray-500">Skutečnost vs. ideální plán</p>
        </div>
      </div>
      <div className="h-56 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
            <defs>
              <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1f2937" : "#e5e7eb"} />
            <XAxis
              dataKey="label"
              stroke={theme === "dark" ? "#6b7280" : "#9ca3af"}
              fontSize={11}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke={theme === "dark" ? "#6b7280" : "#9ca3af"}
              fontSize={11}
              tickLine={false}
              domain={[minW, maxW]}
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
              labelStyle={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  weight: "Skutečná váha",
                  ideal: "Ideální plán",
                  aiRealistic: "AI Predikce",
                  trend: "7D klouzavý průměr",
                };
                return [`${value} kg`, labels[name] || name];
              }}
            />
            <Legend
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  weight: "Skutečná váha",
                  ideal: "Ideální plán",
                  aiRealistic: `AI Predikce ${aiPrediction ? `(${Math.round(aiPrediction.confidence * 100)}%)` : ''}`,
                  trend: "7D klouzavý průměr",
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
              legendType="none"
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
            {/* 7-day moving average trend line */}
            <Line
              type="monotone"
              dataKey="trend"
              stroke="#f472b6"
              strokeWidth={2}
              strokeDasharray="2 2"
              dot={false}
              connectNulls
            />
            {/* AI Prediction line */}
            {aiPrediction && (
              <Line
                type="monotone"
                dataKey="aiRealistic"
                stroke="#8b5cf6"
                strokeWidth={2.5}
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
