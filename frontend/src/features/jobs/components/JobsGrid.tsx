import { AddJobModal } from "./JobModal";
import { JobCard } from "./JobCard";
import type { Job } from "../types";

interface JobsGridProps {
  jobs: Job[];
}

export function JobsGrid({ jobs }: JobsGridProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-serif text-[#1f1f1f]">Your application jobs</h2>
        <AddJobModal />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}