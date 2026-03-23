import { useMutation, useQueryClient } from "@tanstack/react-query"
import { JobService } from "../services/job.service"
import { CreateJob } from "../types"
import { toast } from "sonner"

export const useCreateJob = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateJob) => JobService.createJob(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      toast.success("Job created successfully")
    },
    onError: (error) => {
      toast.error("Failed to create job", {
        description: "Please try again.",
      })
    },
  })
}