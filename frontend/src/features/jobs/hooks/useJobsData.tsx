// features/jobs/hooks/useJobsData.ts

"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { JobService } from "../services/job.service";
import { SessionService } from "@/features/session/services/session.service";
import type { Job } from "../types";

export function useJobsData() {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => JobService.getJobs(),
  });

  const jobs = data?.data ?? [];
  
  const sessionsQueries = useQueries({
    queries: jobs.map((job) => ({
      queryKey: ["sessions", job.id],
      queryFn: () => SessionService.getSessions(job.id),
      enabled: !!job.id,
      select: (res: any) => res.data,
    })),
  });

  const jobsWithSessions: Job[] = jobs.map((job, idx) => {
    const sessions = (sessionsQueries[idx]?.data ?? []) as Job["sessions"];
    return { ...job, sessions: Array.isArray(sessions) ? sessions : [] };
  });

  const isLoadingSessions = sessionsQueries.some((query) => query.isLoading);

  return {
    jobs: jobsWithSessions,
    isLoading: isLoading || isLoadingSessions,
    error,
    refetch,
  };
}