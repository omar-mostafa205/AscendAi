"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DashboardStats } from "../types";

interface ProgressChartProps {
  data: DashboardStats["scoreProgression"];
}

export function ProgressChart({ data }: ProgressChartProps) {
  if (data.length <= 1) return null;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e1dc" />
          <XAxis
            dataKey="session"
            stroke="#676662"
            label={{ value: "Session", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#676662"
            label={{ value: "Score", angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "2px solid #b9b1ab",
              borderRadius: "12px",
            }}
            formatter={(value?: number) => [`${value ?? 0}`, "Score"]}
            labelFormatter={(label) =>
              `Session ${label} · ${data[label - 1]?.date ?? ""}`
            }
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#1b1917"
            strokeWidth={2}
            dot={{ fill: "#1b1917", r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
