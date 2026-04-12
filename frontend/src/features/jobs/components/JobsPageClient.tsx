"use client";

import { useJobsData } from "../hooks/useJobsData";
import { computeStats } from "../utils";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { EmptyState } from "./EmptyState";
import { ProgressCard } from "./ProgressCard";
import { JobsGrid } from "./JobsGrid";

export function JobsPageClient() {
  const { jobs, isLoading, error, refetch } = useJobsData();

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  }

  if (jobs.length === 0) {
    return <EmptyState />;
  }

  const stats = computeStats(jobs);

  return (
    <div className="min-h-screen bg-[#f5f2ef]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif mb-8 text-[#1f1f1f]">
          My Interview Prep
        </h1>
        <ProgressCard stats={stats} />
        <JobsGrid jobs={jobs} />
      </div>
    </div>
  );
}
