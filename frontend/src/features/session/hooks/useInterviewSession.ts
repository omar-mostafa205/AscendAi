// features/session/hooks/useInterviewSession.ts

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "./useSocket";
import { useGeminiLive } from "./useGeminiLive";
import { useSimulation } from "./useSimulation";
import { SessionService } from "../services/session.service";
import { InterviewSession, MAX_SESSION_DURATION_MS } from "../types/session.types";

export function useInterviewSession(sessionId: string, session: InterviewSession | null) {
  const router = useRouter();
  const autoEndTimerRef = useRef<number | null>(null);
  const simulation = useSimulation();
  const { saveMessage, endSession, isEnded, sessionJoined } = useSocket(sessionId);

  
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
  } = useGeminiLive(session?.jobId ?? "", sessionId, onSaveMessage, {
    onUserStartedSpeaking: simulation.onUserStartedSpeaking,
    onUserStoppedSpeaking: simulation.onUserStoppedSpeaking,
    onAiStartedResponding: simulation.onAiStartedResponding,
    onAiFinishedSpeaking: simulation.onAiFinishedSpeaking,
  });

  
  useEffect(() => {
    if (!session) return;
    
    let cancelled = false;

    const initializeConnection = async () => {
      simulation.setStage("fetching_token");
      simulation.setLoadingStep("fetching_token", false);
      
      try {
        simulation.setStage("connecting_gemini");
        simulation.setLoadingStep("fetching_token", true);
        
        await connect();
        
        if (!cancelled) {
          simulation.setLoadingStep("connecting_gemini", true);
          simulation.setStage("ready");
        }
      } catch {
        if (!cancelled) simulation.setStage("error");
      }
    };

    initializeConnection();
    return () => {
      cancelled = true;
      disconnect();
    };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps
  
  useEffect(() => {
    if (sessionJoined && isConnected && !isMicActive) {
      startMic().catch(console.error);
    }
  }, [sessionJoined, isConnected, isMicActive, startMic]);

  
  const handleEndInterview = useCallback(async () => {
    interrupt();
    stopMic();
    flushPendingTranscripts();
    endSession();
    
    try {
      await SessionService.endSession(sessionId);
    } catch {
    }
    
    disconnect();
    
    const redirectUrl = session?.jobId 
      ? `/jobs/${session.jobId}?feedbackSessionId=${sessionId}`
      : "/jobs";
    
    router.replace(redirectUrl);
  }, [interrupt, stopMic, flushPendingTranscripts, endSession, disconnect, router, session, sessionId]);

  
  useEffect(() => {
    if (!isEnded) return;

    stopMic();
    disconnect();
    
    const redirectUrl = session?.jobId 
      ? `/jobs/${session.jobId}?feedbackSessionId=${sessionId}`
      : "/jobs";
    
    router.replace(redirectUrl);
  }, [isEnded, stopMic, disconnect, router, session, sessionId]);

  
  useEffect(() => {
    if (!session?.startedAt) return;

    if (autoEndTimerRef.current) {
      window.clearTimeout(autoEndTimerRef.current);
    }

    const startedAtMs = new Date(session.startedAt).getTime();
    const remainingMs = Math.max(0, startedAtMs + MAX_SESSION_DURATION_MS - Date.now());

    autoEndTimerRef.current = window.setTimeout(() => {
      handleEndInterview().catch(console.error);
    }, remainingMs);

    return () => {
      if (autoEndTimerRef.current) {
        window.clearTimeout(autoEndTimerRef.current);
        autoEndTimerRef.current = null;
      }
    };
  }, [session, handleEndInterview]);

  return {
    simulation,
    isConnected,
    isModelSpeaking,
    isMicActive,
    error,
    startMic,
    stopMic,
    handleEndInterview,
  };
}