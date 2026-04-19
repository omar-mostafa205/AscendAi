// features/session/hooks/useInterviewSession.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";
import { useGeminiVoice } from "./useGeminiVoice";
import { useInterviewUI } from "./useInterviewUI";
import { SessionService } from "../services/session.service";
import { InterviewSession, MAX_SESSION_DURATION_MS } from "../types/session.types";

const latency = {
  userStoppedAt: 0,
  aiStartedAt: 0,
  aiStoppedAt: 0,
  userStartedAt: 0,

  markUserStarted() {
    this.userStartedAt = performance.now();
    console.log("[Latency] 🎤 User started speaking");
  },

  markUserStopped() {
    this.userStoppedAt = performance.now();
    console.log("[Latency] 🎤 User stopped speaking");
  },

  markAiStarted() {
    this.aiStartedAt = performance.now();
    const sinceUserStop =
      this.userStoppedAt > 0
        ? Math.round(this.aiStartedAt - this.userStoppedAt)
        : null;
    console.log(
      `[Latency] 🤖 AI started responding${sinceUserStop !== null ? ` — response latency: ${sinceUserStop}ms` : ""
      }`
    );
  },

  markAiStopped() {
    this.aiStoppedAt = performance.now();
    const duration =
      this.aiStartedAt > 0
        ? Math.round(this.aiStoppedAt - this.aiStartedAt)
        : null;
    console.log(
      `[Latency] 🤖 AI finished speaking${duration !== null ? ` — AI spoke for: ${duration}ms` : ""
      }`
    );
  },
};

export function useInterviewSession(sessionId: string, session: InterviewSession | null) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const autoEndTimerRef = useRef<number | null>(null);
  const isEndingRef = useRef(false);

  // ── Strict singleton mic guard ──────────────────────────────────────────
  // Prevents StrictMode double-invoke and re-render races from starting
  // multiple mic instances simultaneously.
  const micStartingRef = useRef(false);
  const micStartedRef = useRef(false);

  const simulation = useInterviewUI();
  const { saveMessage, endSession, isEnded, sessionJoined } = useSocket(sessionId);
  const [micStartedAtMs, setMicStartedAtMs] = useState<number | null>(null);

  const onSaveMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      console.log(`[Session] 💾 Saving ${role} message (${content.length} chars)`);
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
    onUserStartedSpeaking: () => {
      latency.markUserStarted();
      simulation.onUserStartedSpeaking();
    },
    onUserStoppedSpeaking: () => {
      latency.markUserStopped();
      simulation.onUserStoppedSpeaking();
    },
    onAiStartedResponding: () => {
      latency.markAiStarted();
      simulation.onAiStartedResponding();
    },
    onAiFinishedSpeaking: () => {
      latency.markAiStopped();
      simulation.onAiFinishedSpeaking();
    },
  });

  // ── Initialize Gemini connection ────────────────────────────────────────
  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    const initializeConnection = async () => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      console.log("[Session] 🚀 Initializing Gemini connection...");

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
        console.log("[Session] 🔑 Fetching live token...");
        const res = await SessionService.getLiveToken(sessionId);
        const token = res?.data?.token;

        if (!token) throw new Error("No token returned");
        console.log("[Session] ✅ Token fetched");
        simulation.setLoadingStep("fetching_token", true);

        simulation.setStage("connecting_gemini");
        simulation.setLoadingStep("connecting_gemini", false);

        console.log("[Session] 🔌 Connecting to Gemini WebSocket...");
        await connect({ token });

        if (!cancelled) {
          console.log("[Session] ✅ Gemini connected");
          simulation.setLoadingStep("connecting_gemini", true);
          simulation.setStage("ready");
          simulation.setLoadingStep("ready", true);
        }
      } catch (err) {
        console.error("[Session] ❌ Connection failed:", err);
        if (!cancelled) simulation.setStage("error");
      }
    };

    initializeConnection();

    return () => {
      console.log("[Session] 🧹 Cleanup — disconnecting");
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
    // console.log("[Session] Mic-start gate check", {
    //   sessionJoined,
    //   isConnected,
    //   isMicActive,
    //   isEnding: isEndingRef.current,
    //   micStarting: micStartingRef.current,
    //   micStarted: micStartedRef.current,
    // });

    if (isEndingRef.current) return;
    if (!sessionJoined || !isConnected) return;
    if (isMicActive) return;

    // Singleton guard — prevent concurrent or duplicate startMic calls
    if (micStartingRef.current || micStartedRef.current) {
      console.warn("[Session] ⚠️ Mic start already in progress or completed, skipping");
      return;
    }

    micStartingRef.current = true;

    console.log("[Session] ✅ All gates passed — starting mic");

    startMic()
      .then(() => {
        console.log("[Session] ✅ Mic started successfully");
        micStartedRef.current = true;
        setMicStartedAtMs((prev) => prev ?? Date.now());
      })
      .catch((err) => {
        console.error("[Session] ❌ Failed to start mic:", err);
      })
      .finally(() => {
        micStartingRef.current = false;
      });
  }, [sessionJoined, isConnected, isMicActive, startMic]);

  // ── Handle end interview ────────────────────────────────────────────────
  const handleEndInterview = useCallback(async () => {
    console.log("[Session] 🛑 Ending interview...");
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
      console.log("[Session] ✅ Session ended on server");
    } catch (err) {
      console.error("[Session] ⚠️ Failed to end session on server:", err);
    }

    disconnect();

    const redirectUrl = session?.jobId
      ? `/jobs/${session.jobId}?sessionId=${sessionId}`
      : "/jobs";

    router.replace(redirectUrl);
  }, [interrupt, stopMic, flushPendingTranscripts, endSession, disconnect, router, session, sessionId, queryClient]);

  // ── Handle external session end (e.g. from another tab) ────────────────
  useEffect(() => {
    if (!isEnded) return;

    console.log("[Session] 🔚 Session ended externally");
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
    console.log(`[Session] ⏱ Auto-end timer set for ${Math.round(remainingMs / 1000)}s`);

    autoEndTimerRef.current = window.setTimeout(() => {
      console.log("[Session] ⏱ Auto-end timer fired");
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