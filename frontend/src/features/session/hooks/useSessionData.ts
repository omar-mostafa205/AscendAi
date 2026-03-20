// features/session/hooks/useSessionData.ts

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SessionService } from "../services/session.service";
import { InterviewSession } from "../types/session.types";

export function useSessionData(sessionId: string) {
  const router = useRouter();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    
    let cancelled = false;

    const fetchSession = async () => {
      try {
        const { data } = await SessionService.getSession(sessionId);
        
        if (cancelled) return;

        if (data.endedAt || data.status === "processing" || data.status === "completed") {
          router.replace(`/jobs/${data.jobId}?feedbackSessionId=${sessionId}`);
          return;
        }

        setSession({
          id: data.id,
          scenarioType: data.scenarioType,
          jobTitle: data.job?.title ?? "Interview Session",
          company: data.job?.company ?? "",
          startedAt: data.startedAt,
          jobId: data.jobId,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSession();
    return () => { cancelled = true; };
  }, [sessionId, router]);

  return { session, loading };
}