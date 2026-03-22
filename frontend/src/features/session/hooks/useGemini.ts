import { useRef } from "react";
import { useGeminiSession } from "./useGeminiSession";
import { useGeminiMic } from "./useGeminiMic";

export const useGeminiLive = (
  sessionId: string,
  onSaveMessage: (role: "user" | "assistant", content: string) => void,
  callbacks?: {
    onUserStartedSpeaking?: () => void;
    onUserStoppedSpeaking?: () => void;
    onAiStartedResponding?: () => void;
    onAiFinishedSpeaking?: () => void;
    onTokenUsage?: () => void;
  }
) => {
  const isUserSpeakingRef = useRef(false);

  const session = useGeminiSession(sessionId, onSaveMessage, isUserSpeakingRef, {
    onAiStartedResponding: callbacks?.onAiStartedResponding,
    onAiFinishedSpeaking: callbacks?.onAiFinishedSpeaking,
    onTokenUsage: callbacks?.onTokenUsage,
  });

  const mic = useGeminiMic(
    session.send,
    session.isModelSpeakingRef,
    isUserSpeakingRef,
    onSaveMessage,
    session.pendingUserTranscriptRef,
    session.lastSavedUserTranscriptRef,
    {
      onUserStartedSpeaking: callbacks?.onUserStartedSpeaking,
      onUserStoppedSpeaking: () => {
        callbacks?.onUserStoppedSpeaking?.();
        session.flushBufferedAiAudio();
      },
    }
  );

  return {
    connect: session.connect,
    disconnect: session.disconnect,
    interrupt: session.interrupt,
    flushPendingTranscripts: session.flushPendingTranscripts,
    flushBufferedAiAudio: session.flushBufferedAiAudio,
    startMic: mic.startMic,
    stopMic: mic.stopMic,
    isConnected: session.isConnected,
    isModelSpeaking: session.isModelSpeaking,
    isUserSpeaking: mic.isUserSpeaking,
    isMicActive: mic.isMicActive,
    error: session.error,
  };
};
