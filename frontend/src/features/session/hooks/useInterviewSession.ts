// features/session/hooks/useInterviewSession.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";
import { useGeminiVoice } from "./useGeminiVoice";
import { useInterviewUI } from "./useInterviewUI";
import { SessionService } from "../services/session.service";
import { InterviewSession, MAX_SESSION_DURATION_MS } from "../types/session.types";

export function useInterviewSession(sessionId: string, session: InterviewSession | null) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const autoEndTimerRef = useRef<number | null>(null);
  const isEndingRef = useRef(false);
  const micStartingRef = useRef(false);
  const micStartedRef = useRef(false);

  const simulation = useInterviewUI();
  const { saveMessage, endSession, isEnded, sessionJoined } = useSocket(sessionId);
  const [micStartedAtMs, setMicStartedAtMs] = useState<number | null>(null);

  const onSaveMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      saveMessage(role, content);
    },
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
  } = useGeminiVoice(sessionId, onSaveMessage, {
    onUserStartedSpeaking: () => simulation.onUserStartedSpeaking(),
    onUserStoppedSpeaking: () => simulation.onUserStoppedSpeaking(),
    onAiStartedResponding: () => simulation.onAiStartedResponding(),
    onAiFinishedSpeaking: () => simulation.onAiFinishedSpeaking(),
  });

  // ── Initialize Gemini connection ────────────────────────────────────────
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

        if (!token) throw new Error("No token returned");
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
      micStartingRef.current = false;
      micStartedRef.current = false;
      stopMic();
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ── Start mic once session is joined AND Gemini is connected ────────────
  useEffect(() => {
    if (isEndingRef.current) return;
    if (!sessionJoined || !isConnected) return;
    if (isMicActive) return;
    if (micStartingRef.current || micStartedRef.current) return;

    micStartingRef.current = true;

    startMic()
      .then(() => {
        micStartedRef.current = true;
        setMicStartedAtMs((prev) => prev ?? Date.now());
      })
      .catch(() => {})
      .finally(() => {
        micStartingRef.current = false;
      });
  }, [sessionJoined, isConnected, isMicActive, startMic]);

  // ── Handle end interview ────────────────────────────────────────────────
  const handleEndInterview = useCallback(async () => {
    isEndingRef.current = true;
    micStartedRef.current = false;
    micStartingRef.current = false;
    interrupt();
    stopMic();
    flushPendingTranscripts();
    endSession();

    try {
      if (session?.jobId) {
        queryClient.invalidateQueries({ queryKey: ["sessions", session.jobId] });
      }
      await SessionService.endSession(sessionId);
    } catch {}

    disconnect();

    const redirectUrl = session?.jobId
      ? `/jobs/${session.jobId}?sessionId=${sessionId}`
      : "/jobs";

    router.replace(redirectUrl);
  }, [interrupt, stopMic, flushPendingTranscripts, endSession, disconnect, router, session, sessionId, queryClient]);

  // ── Handle external session end (e.g. from another tab) ────────────────
  useEffect(() => {
    if (!isEnded) return;

    isEndingRef.current = true;
    micStartedRef.current = false;
    stopMic();
    disconnect();

    if (session?.jobId) {
      queryClient.invalidateQueries({ queryKey: ["sessions", session.jobId] });
    }

    const redirectUrl = session?.jobId
      ? `/jobs/${session.jobId}?sessionId=${sessionId}`
      : "/jobs";

    router.replace(redirectUrl);
  }, [isEnded, stopMic, disconnect, router, session, sessionId, queryClient]);

  // ── Auto-end timer ──────────────────────────────────────────────────────
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
      handleEndInterview().catch(() => {});
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