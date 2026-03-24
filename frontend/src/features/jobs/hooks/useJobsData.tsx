"use client"

import { useQuery } from "@tanstack/react-query"
import { JobService } from "../services/job.service"
import type { Job } from "../types"

export function useJobsData() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => JobService.getJobs(),
  })

  const jobs: Job[] = (data?.data ?? []).map((job) => ({
    ...job,
    sessions: Array.isArray(job.sessions) ? job.sessions : [],
  }))

  return {
    jobs,
    isLoading,
    error,
    refetch,
  }
}