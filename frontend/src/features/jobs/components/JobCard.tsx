"use client";

import { useRouter } from "next/navigation";
import { Briefcase, Calendar, TrendingUp } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { formatRelativeTime } from "@/shared/lib/utils";
import { CARD_STYLES } from "../types";
import type { Job } from "../types";

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  const router = useRouter();
  
  const sessionCount = job.sessions?.length ?? 0;
  const avgScore =
    sessionCount > 0
      ? (
          job.sessions!.reduce((a, s) => a + (s.overallScore ?? 0), 0) /
          sessionCount
        ).toFixed(1)
      : null;
  const lastPracticed =
    sessionCount > 0
      ? job.sessions!.reduce((latest, s) =>
          new Date(s.createdAt) > new Date(latest.createdAt) ? s : latest
        ).createdAt
      : null;

  return (
    <Card
      className={`hover:shadow-lg transition-shadow ${CARD_STYLES.className}`}
      style={CARD_STYLES.style}
    >
      <CardHeader>
        <CardTitle className="text-xl text-[#1f1f1f]">{job.title}</CardTitle>
        <p className="text-[#676662]">{job.company}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-[#676662]">
            <Briefcase className="w-4 h-4" />
            <span>{sessionCount} session{sessionCount !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#676662]">
            <TrendingUp className="w-4 h-4" />
            <span>{avgScore ? `Avg Score: ${avgScore}/100` : "No sessions yet"}</span>
          </div>
          {lastPracticed && (
            <div className="flex items-center gap-2 text-sm text-[#676662]">
              <Calendar className="w-4 h-4" />
              <span>{formatRelativeTime(lastPracticed)}</span>
            </div>
          )}
        </div>
        <Button
          onClick={() => router.push(`/jobs/${job.id}`)}
          className="w-full bg-[#1b1917] hover:bg-neutral-800 text-white"
        >
          {sessionCount > 0 ? "Continue Practicing" : "Start Practicing"}
        </Button>
      </CardContent>
    </Card>
  );
}