// features/jobs/components/ProgressCard.tsx

import { TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { StatsCards } from "./StatsCards";
import { ProgressChart } from "./ProgressChart";
import { CARD_STYLES } from "../types";
import type { DashboardStats } from "../types";

interface ProgressCardProps {
  stats: DashboardStats;
}

export function ProgressCard({ stats }: ProgressCardProps) {
  return (
    <Card className={`mb-8 ${CARD_STYLES.className}`} style={CARD_STYLES.style}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#1f1f1f]">
          <TrendingUp className="w-5 h-5" />
          Your Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <StatsCards stats={stats} />
        <ProgressChart data={stats.scoreProgression} />
      </CardContent>
    </Card>
  );
}
