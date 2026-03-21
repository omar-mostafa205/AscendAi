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
  const session = useGeminiSession(sessionId, onSaveMessage, {
    onAiStartedResponding: callbacks?.onAiStartedResponding,
    onAiFinishedSpeaking: callbacks?.onAiFinishedSpeaking,
    onTokenUsage: callbacks?.onTokenUsage,
  });

  const mic = useGeminiMic(session.send, session.isModelSpeakingRef, onSaveMessage, {
    onUserStartedSpeaking: callbacks?.onUserStartedSpeaking,
    onUserStoppedSpeaking: callbacks?.onUserStoppedSpeaking,
  });

  return {
    connect: session.connect,
    disconnect: session.disconnect,
    interrupt: session.interrupt,
    flushPendingTranscripts: session.flushPendingTranscripts,
    startMic: mic.startMic,
    stopMic: mic.stopMic,
    isConnected: session.isConnected,
    isModelSpeaking: session.isModelSpeaking,
    isUserSpeaking: mic.isUserSpeaking,
    isMicActive: mic.isMicActive,
    error: session.error,
  };
};