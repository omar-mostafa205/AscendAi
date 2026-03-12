import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { JobService } from "../services/job.service"
import { SessionService } from "@/features/session/services/session.service"
import { ScenarioType } from "../types"

export function useJobSessions(jobId: string) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType | null>(null)

  const {
    data: job,
    isLoading: jobLoading,
    error: jobError,
  } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => JobService.getJobById(jobId),
    select: (res) => res.data,
  })

  const {
    data: sessions,
    isLoading: sessionsLoading,
  } = useQuery({
    queryKey: ["sessions", jobId],
    queryFn: () => SessionService.getSessions(jobId),
    enabled: !!jobId,
    select: (res) => res.data,
  })

  const { mutate: startInterview, isPending: creating } = useMutation({
    mutationFn: () =>
      SessionService.createSession(jobId, { scenarioType: selectedScenario! }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["sessions", jobId] })
      router.push(`/session/${response.data.session.id}`)
    },
    onError: () => {
      toast.error("Failed to start interview", {
        description: "Please try again.",
      })
    },
  })

  const handleStartInterview = () => {
    if (!selectedScenario) {
      toast.error("Please select a scenario type")
      return
    }
    startInterview()
  }

  return {
    job,
    sessions,
    isLoading: jobLoading || sessionsLoading,
    error: jobError instanceof Error ? jobError.message : null,
    selectedScenario,
    setSelectedScenario,
    handleStartInterview,
    creating,
  }
}
