import { Session } from "@/features/jobs/types"
import { ApiClient } from "@/lib/api/api.client"
import { ApiEnvelope } from "@/lib/api/types"

type ScenarioType = "technical" | "background" | "culture"

interface CreateSessionInput {
  scenarioType: ScenarioType
}

export const SessionService = {
  getSessions: (jobId: string) =>
    ApiClient.get<ApiEnvelope<Session[]>>(`/jobs/${jobId}/sessions`),

  createSession: (jobId: string, data: CreateSessionInput) =>
    ApiClient.post<ApiEnvelope<{ session: Session; livekitToken: string }>, CreateSessionInput>(
      `/jobs/${jobId}/sessions`,
      data
    ),

  getSession: (sessionId: string) =>
    ApiClient.get<
      ApiEnvelope<
        Session & {
          job?: { title: string; company: string }
          livekitToken?: string | null
        }
      >
    >(`/sessions/${sessionId}`),

  endSession: (sessionId: string) =>
    ApiClient.post<ApiEnvelope<{ id: string; status: string }>>(`/sessions/${sessionId}/end`, {}),
} as const
