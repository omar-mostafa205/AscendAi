// features/jobs/components/StatsCards.tsx

import type { DashboardStats } from "../types";

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-[#f5f3f0] rounded-xl p-4">
        <p className="text-sm text-[#676662] mb-1">Total Sessions</p>
        <p className="text-3xl font-bold text-[#1b1917]">{stats.totalSessions}</p>
      </div>
      
      <div className="bg-[#f5f3f0] rounded-xl p-4">
        <p className="text-sm text-[#676662] mb-1">Average Score</p>
        <p className="text-3xl font-bold text-[#1b1917]">
          {stats.averageScore > 0 ? stats.averageScore.toFixed(1) : "—"}
        </p>
      </div>
      
      <div className="bg-[#f5f3f0] rounded-xl p-4">
        <p className="text-sm text-[#676662] mb-1">Improvement</p>
        <p className="text-3xl font-bold text-emerald-600">
          {stats.totalSessions < 2
            ? "—"
            : `${stats.improvementPercentage > 0 ? "+" : ""}${stats.improvementPercentage.toFixed(1)}%`}
        </p>
      </div>
    </div>
  );
}