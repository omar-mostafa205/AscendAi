// features/session/hooks/useInterviewSession.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "./useSocket";
import { useGeminiLive } from "./useGemini";
import { useSimulation } from "./useSimulation";
import { SessionService } from "../services/session.service";
import { InterviewSession, MAX_SESSION_DURATION_MS } from "../types/session.types";

export function useInterviewSession(sessionId: string, session: InterviewSession | null) {
  const router = useRouter();
  const autoEndTimerRef = useRef<number | null>(null);
  const isEndingRef = useRef(false);
  const simulation = useSimulation();
  const { saveMessage, endSession, isEnded, sessionJoined } = useSocket(sessionId);
  const [micStartedAtMs, setMicStartedAtMs] = useState<number | null>(null);

  const onSaveMessage = useCallback(
    (role: "user" | "assistant", content: string) => saveMessage(role, content),
    [saveMessage]
  );

  const {
    connect,
    disconnect,
    interrupt,
    startMic,
    stopMic,
    flushPendingTranscripts,
    isConnected,
    isModelSpeaking,
    isMicActive,
    error,
  } = useGeminiLive(sessionId, onSaveMessage, {
    onUserStartedSpeaking: simulation.onUserStartedSpeaking,
    onUserStoppedSpeaking: simulation.onUserStoppedSpeaking,
    onAiStartedResponding: simulation.onAiStartedResponding,
    onAiFinishedSpeaking: simulation.onAiFinishedSpeaking,
  });

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    const initializeConnection = async () => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      simulation.setStage("initializing_ai");
      simulation.setLoadingStep("initializing_ai", false);
      await sleep(250);
      simulation.setLoadingStep("initializing_ai", true);

      simulation.setStage("generating_persona");
      await sleep(250);
      simulation.setLoadingStep("generating_persona", false);
      simulation.setLoadingStep("generating_persona", true);

      simulation.setStage("fetching_token");
      simulation.setLoadingStep("fetching_token", false);

      try {
        const res = await SessionService.getLiveToken(sessionId);
        const token = res?.data?.token;
        simulation.setLoadingStep("fetching_token", true);

        simulation.setStage("connecting_gemini");
        simulation.setLoadingStep("connecting_gemini", false);

        await connect({ token });

        if (!cancelled) {
          simulation.setLoadingStep("connecting_gemini", true);
          simulation.setStage("ready");
          simulation.setLoadingStep("ready", true);
        }
      } catch {
        if (!cancelled) simulation.setStage("error");
      }
    };

    initializeConnection();
    return () => {
      cancelled = true;
      isEndingRef.current = true;
      stopMic();
      disconnect();
    };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isEndingRef.current) return;
    if (sessionJoined && isConnected && !isMicActive) {
      (async () => {
        try {
          await startMic();
          setMicStartedAtMs((prev) => prev ?? Date.now());
        } catch (e) {
          console.error(e);
        }
      })();
    }
  }, [sessionJoined, isConnected, isMicActive, startMic]);

  const handleEndInterview = useCallback(async () => {
    isEndingRef.current = true;
    interrupt();
    stopMic();
    flushPendingTranscripts();
    endSession();

    try {
      await SessionService.endSession(sessionId);
    } catch {}

    disconnect();

    const redirectUrl = session?.jobId
      ? `/jobs/${session.jobId}?feedbackSessionId=${sessionId}`
      : "/jobs";

    router.replace(redirectUrl);
  }, [interrupt, stopMic, flushPendingTranscripts, endSession, disconnect, router, session, sessionId]);

  useEffect(() => {
    if (!isEnded) return;

    isEndingRef.current = true;
    stopMic();
    disconnect();

    const redirectUrl = session?.jobId
      ? `/jobs/${session.jobId}?feedbackSessionId=${sessionId}`
      : "/jobs";

    router.replace(redirectUrl);
  }, [isEnded, stopMic, disconnect, router, session, sessionId]);

  useEffect(() => {
    if (autoEndTimerRef.current) {
      window.clearTimeout(autoEndTimerRef.current);
    }

    const baseMs =
      micStartedAtMs ??
      (session?.startedAt ? new Date(session.startedAt).getTime() : null);

    if (!baseMs || Number.isNaN(baseMs)) return;

    const remainingMs = Math.max(0, baseMs + MAX_SESSION_DURATION_MS - Date.now());

    autoEndTimerRef.current = window.setTimeout(() => {
      handleEndInterview().catch(console.error);
    }, remainingMs);

    return () => {
      if (autoEndTimerRef.current) {
        window.clearTimeout(autoEndTimerRef.current);
        autoEndTimerRef.current = null;
      }
    };
  }, [session, micStartedAtMs, handleEndInterview]);

  return {
    simulation,
    isConnected,
    isModelSpeaking,
    isMicActive,
    micStartedAtMs,
    error,
    startMic,
    stopMic,
    handleEndInterview,
  };
}