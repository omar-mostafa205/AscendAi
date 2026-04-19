import { useRef, useState, useCallback, useEffect } from "react";
import { SessionService } from "@/features/session/services/session.service";
import { normalizeTranscript, shouldIgnoreTranscript, mergeTranscript } from "../utils";
import { getStoredSessionHandle, storeSessionHandle } from "../utils";

interface GeminiCallbacks {
  onAiStartedResponding?: () => void;
  onAiFinishedSpeaking?: () => void;
  onTokenUsage?: () => void;
  onInputTranscriptionUpdate?: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const CONNECT_TIMEOUT_MS = 15_000;

export function useGeminiConnection(
  sessionId: string,
  onSaveMessage: (role: "user" | "assistant", content: string) => void,
  isUserSpeakingRef: React.MutableRefObject<boolean>,
  callbacks?: GeminiCallbacks
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbacksRef = useRef<GeminiCallbacks | undefined>(callbacks);
  useEffect(() => { callbacksRef.current = callbacks; }, [callbacks]);

  const onSaveMessageRef = useRef(onSaveMessage);
  useEffect(() => { onSaveMessageRef.current = onSaveMessage; }, [onSaveMessage]);

  const sessionRef = useRef<WebSocket | null>(null);
  const isModelSpeakingRef = useRef(false);
  const hasReceivedSetupCompleteRef = useRef(false);
  const hasSentSetupRef = useRef(false);
  const hasSentKickoffRef = useRef(false);
  const sessionHandleRef = useRef<string | null>(null);
  const connectResolveRef = useRef<(() => void) | null>(null);
  const connectRejectRef = useRef<((e: Error) => void) | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIntentionalDisconnectRef = useRef(false);

  const pendingUserTranscriptRef = useRef<string | null>(null);
  const pendingAssistantTranscriptRef = useRef<string | null>(null);
  const lastSavedUserTranscriptRef = useRef<string | null>(null);
  const lastSavedAssistantTranscriptRef = useRef<string | null>(null);

  const playbackContextRef = useRef<AudioContext | null>(null);
  const scheduledNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const bufferedAiAudioRef = useRef<string[]>([]);

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current !== null) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, []);

  const send = useCallback((data: string) => {
    const ws = sessionRef.current;
    if (ws?.readyState === WebSocket.OPEN && hasReceivedSetupCompleteRef.current) {
      ws.send(data);
    }
  }, []);

  const playAudioChunk = useCallback((base64Audio: string) => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new AudioContext({
        sampleRate: 24000,
        latencyHint: "interactive",
      });
    }
    const ctx = playbackContextRef.current;
    const binary = atob(base64Audio);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    const float32 = new Float32Array(array.length / 2);
    const view = new DataView(array.buffer);
    for (let i = 0; i < float32.length; i++)
      float32[i] = view.getInt16(i * 2, true) / 32768;
    const buf = ctx.createBuffer(1, float32.length, 24000);
    buf.getChannelData(0).set(float32);
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.connect(ctx.destination);
    if (nextPlayTimeRef.current < ctx.currentTime)
      nextPlayTimeRef.current = ctx.currentTime;
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += buf.duration;
    scheduledNodesRef.current.push(source);
    source.onended = () => {
      scheduledNodesRef.current = scheduledNodesRef.current.filter((n) => n !== source);
    };
  }, []);

  const handleAudioOutput = useCallback(
    (base64Audio: string) => {
      if (isUserSpeakingRef.current) {
        bufferedAiAudioRef.current.push(base64Audio);
        return;
      }
      playAudioChunk(base64Audio);
    },
    [isUserSpeakingRef, playAudioChunk]
  );

  const flushBufferedAiAudio = useCallback(() => {
    if (isUserSpeakingRef.current) return;
    const queued = bufferedAiAudioRef.current;
    if (!queued || queued.length === 0) return;
    bufferedAiAudioRef.current = [];
    for (const chunk of queued) playAudioChunk(chunk);
  }, [isUserSpeakingRef, playAudioChunk]);

  const flushPendingTranscripts = useCallback(() => {
    const user = pendingUserTranscriptRef.current
      ? normalizeTranscript(pendingUserTranscriptRef.current)
      : null;
    if (user && !shouldIgnoreTranscript(user) && user !== lastSavedUserTranscriptRef.current) {
      lastSavedUserTranscriptRef.current = user;
      onSaveMessageRef.current("user", user);
    }
  }, []);

  const interrupt = useCallback(() => {
    const nodes = scheduledNodesRef.current;
    scheduledNodesRef.current = [];
    nodes.forEach((n) => { try { n.stop(); } catch { } });
    nextPlayTimeRef.current = 0;
    send(JSON.stringify({
      clientContent: {
        turns: [{ role: "user", parts: [] }],
        turnComplete: true,
      },
    }));
    isModelSpeakingRef.current = false;
    setIsModelSpeaking(false);
  }, [send]);

  const handleTurnEnd = useCallback(() => {
    if (!isModelSpeakingRef.current) return;

    isModelSpeakingRef.current = false;
    setIsModelSpeaking(false);
    callbacksRef.current?.onAiFinishedSpeaking?.();
    if (scheduledNodesRef.current.length === 0) nextPlayTimeRef.current = 0;

    const userRaw = pendingUserTranscriptRef.current;
    if (userRaw) {
      const userT = normalizeTranscript(userRaw);
      if (userT && !shouldIgnoreTranscript(userRaw) && userT !== lastSavedUserTranscriptRef.current) {
        lastSavedUserTranscriptRef.current = userT;
        onSaveMessageRef.current("user", userT);
      }
      pendingUserTranscriptRef.current = null;
    }

    const t = pendingAssistantTranscriptRef.current
      ? normalizeTranscript(pendingAssistantTranscriptRef.current)
      : null;
    if (t && !shouldIgnoreTranscript(t) && t !== lastSavedAssistantTranscriptRef.current) {
      lastSavedAssistantTranscriptRef.current = t;
      onSaveMessageRef.current("assistant", t);
    }
    pendingAssistantTranscriptRef.current = null;
  }, []);

  const disconnect = useCallback(
    (intentional = true) => {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      isIntentionalDisconnectRef.current = intentional;
      isModelSpeakingRef.current = false;
      setIsModelSpeaking(false);
      flushPendingTranscripts();
      interrupt();
      clearConnectTimeout();
      playbackContextRef.current?.close().catch(() => { });
      playbackContextRef.current = null;
      bufferedAiAudioRef.current = [];
      sessionRef.current?.close();
      sessionRef.current = null;
      setIsConnected(false);
    },
    [interrupt, flushPendingTranscripts, clearConnectTimeout]
  );

  const connect = useCallback(
    async (options?: { token?: string }) => {
      setError(null);
      hasSentSetupRef.current = false;
      hasReceivedSetupCompleteRef.current = false;
      hasSentKickoffRef.current = false;

      const token =
        options?.token ??
        (await SessionService.getLiveToken(sessionId))?.data?.token;

      if (!token) {
        const err = new Error("Missing auth token");
        setError(err.message);
        throw err;
      }

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      sessionRef.current = ws;
      ws.binaryType = "arraybuffer";

      const connectPromise = new Promise<void>((resolve, reject) => {
        connectResolveRef.current = resolve;
        connectRejectRef.current = reject;

        clearConnectTimeout();
        connectTimeoutRef.current = setTimeout(() => {
          connectTimeoutRef.current = null;
          connectRejectRef.current?.(new Error("Timed out"));
          connectResolveRef.current = null;
          connectRejectRef.current = null;
        }, CONNECT_TIMEOUT_MS);
      });

      ws.onopen = () => {
        if (hasSentSetupRef.current) return;
        hasSentSetupRef.current = true;

        const handle = sessionHandleRef.current ?? getStoredSessionHandle(sessionId);

        ws.send(JSON.stringify({
          setup: {
            ...(handle ? { sessionResumption: { handle } } : {}),
            model: "models/gemini-2.0-flash-live-001",
            system_instruction: {
              parts: [{
                text: "You are a professional interview assistant conducting a voice interview. Ask the candidate thoughtful interview questions and evaluate their responses. Be warm, professional, and encouraging. Keep all responses concise and conversational.",
              }],
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        }));
      };

      ws.onmessage = (event) => {
        const text =
          typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(event.data);
        const msg = JSON.parse(text);

        if (msg.setupComplete !== undefined) {
          hasReceivedSetupCompleteRef.current = true;
          clearConnectTimeout();
          setIsConnected(true);
          reconnectAttemptsRef.current = 0;
          connectResolveRef.current?.();
          connectResolveRef.current = null;
          connectRejectRef.current = null;

          if (!hasSentKickoffRef.current) {
            hasSentKickoffRef.current = true;
            ws.send(JSON.stringify({
              clientContent: {
                turns: [
                  {
                    role: "user",
                    parts: [{ text: "Start the interview now." }],
                  },
                ],
                turnComplete: true,
              },
            }));
          }
        }

        if (msg.serverContent) {
          const { serverContent } = msg;

          if (serverContent.modelTurn) {
            if (!isModelSpeakingRef.current) {
              isModelSpeakingRef.current = true;
              setIsModelSpeaking(true);
              callbacksRef.current?.onAiStartedResponding?.();
            }
            serverContent.modelTurn.parts?.forEach((p: any) => {
              if (p.inlineData?.data) handleAudioOutput(p.inlineData.data);
            });
          }

          if (serverContent.generationComplete === true) handleTurnEnd();
          if (serverContent.turnComplete === true) handleTurnEnd();

          if (serverContent.outputTranscription?.text) {
            const t = serverContent.outputTranscription.text;
            if (!shouldIgnoreTranscript(t)) {
              pendingAssistantTranscriptRef.current = mergeTranscript(
                pendingAssistantTranscriptRef.current, t
              );
            }
          }

          if (serverContent.inputTranscription?.text) {
            const t = serverContent.inputTranscription.text;
            if (!shouldIgnoreTranscript(t)) {
              pendingUserTranscriptRef.current = mergeTranscript(
                pendingUserTranscriptRef.current, t
              );
              callbacksRef.current?.onInputTranscriptionUpdate?.();
            }
          }
        }

        if (msg.sessionResumptionUpdate) {
          const handle =
            msg.sessionResumptionUpdate?.newHandle ??
            msg.sessionResumptionUpdate?.handle;
          if (typeof handle === "string" && handle.trim()) {
            sessionHandleRef.current = handle;
            storeSessionHandle(sessionId, handle);
          }
        }

        if (msg.goAway) {
          const attempt = reconnectAttemptsRef.current;
          if (attempt >= MAX_RECONNECT_ATTEMPTS) {
            setError(`Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`);
            disconnect(true);
            return;
          }
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(
            BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt),
            MAX_RECONNECT_DELAY_MS
          );
          disconnect(false);
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
          }, delay);
        }

        if (msg.usageMetadata) callbacksRef.current?.onTokenUsage?.();
      };

      ws.onerror = () => {
        setError("WebSocket error");
        clearConnectTimeout();
        connectRejectRef.current?.(new Error("WebSocket error"));
        connectResolveRef.current = null;
        connectRejectRef.current = null;
      };

      ws.onclose = (event) => {
        isModelSpeakingRef.current = false;
        setIsModelSpeaking(false);
        setIsConnected(false);
        clearConnectTimeout();

        if (!hasReceivedSetupCompleteRef.current) {
          connectRejectRef.current?.(
            new Error(`Closed before setupComplete (code=${event.code})`)
          );
          connectResolveRef.current = null;
          connectRejectRef.current = null;
          return;
        }

        if (!isIntentionalDisconnectRef.current) {
          const attempt = reconnectAttemptsRef.current;
          if (attempt >= MAX_RECONNECT_ATTEMPTS) {
            setError(`Connection lost after ${MAX_RECONNECT_ATTEMPTS} attempts`);
            return;
          }
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(
            BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt),
            MAX_RECONNECT_DELAY_MS
          );
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
          }, delay);
        }
      };

      return connectPromise;
    },
    [sessionId, handleAudioOutput, disconnect, clearConnectTimeout, handleTurnEnd]
  );

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  return {
    connect,
    disconnect: () => disconnect(true),
    interrupt,
    flushPendingTranscripts,
    flushBufferedAiAudio,
    send,
    isModelSpeakingRef,
    pendingUserTranscriptRef,
    lastSavedUserTranscriptRef,
    isConnected,
    isModelSpeaking,
    error,
  };
}