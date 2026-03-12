import { ApiClient } from "@/lib/api/api.client";
import { CreateJob, Job } from "../types";
import { ApiEnvelope } from "@/lib/api/types";

export const JobService = {
    getJobs: () =>
      ApiClient.get<ApiEnvelope<Job[]>>("/jobs"),
  
    getJobById: (id: string) =>
      ApiClient.get<ApiEnvelope<Job>>(`/jobs/${id}`),
  
    createJob: (data: CreateJob) =>
      ApiClient.post<ApiEnvelope<Job>, CreateJob>("/jobs", data),
  } as const;
