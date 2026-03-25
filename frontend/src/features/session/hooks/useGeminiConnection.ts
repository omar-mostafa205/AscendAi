import { useRef, useState, useCallback } from "react";
import { SessionService } from "@/features/session/services/session.service";
import { normalizeTranscript, shouldIgnoreTranscript, mergeTranscript } from "../utils";
import { getStoredSessionHandle, storeSessionHandle } from "../utils";

export function useGeminiConnection(
  sessionId: string,
  onSaveMessage: (role: "user" | "assistant", content: string) => void,
  isUserSpeakingRef: React.MutableRefObject<boolean>,
  callbacks?: {
    onAiStartedResponding?: () => void;
    onAiFinishedSpeaking?: () => void;
    onTokenUsage?: () => void;
    onInputTranscriptionUpdate?: () => void;
  }
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<WebSocket | null>(null);
  const isModelSpeakingRef = useRef(false);
  const hasReceivedSetupCompleteRef = useRef(false);
  const hasSentSetupRef = useRef(false);
  const hasSentKickoffRef = useRef(false);
  const sessionHandleRef = useRef<string | null>(null);
  const connectResolveRef = useRef<(() => void) | null>(null);
  const connectRejectRef = useRef<((e: Error) => void) | null>(null);
  const connectTimeoutRef = useRef<number | null>(null);

  // transcript refs
  const pendingUserTranscriptRef = useRef<string | null>(null);
  const pendingAssistantTranscriptRef = useRef<string | null>(null);
  const lastSavedUserTranscriptRef = useRef<string | null>(null);
  const lastSavedAssistantTranscriptRef = useRef<string | null>(null);
  const lastAssistantTranscriptUpdateAtRef = useRef<number>(0);

  // playback refs
  const playbackContextRef = useRef<AudioContext | null>(null);
  const scheduledNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const bufferedAiAudioRef = useRef<string[]>([]);

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
      scheduledNodesRef.current = scheduledNodesRef.current.filter(
        (n) => n !== source
      );
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
    if (
      user &&
      !shouldIgnoreTranscript(user) &&
      user !== lastSavedUserTranscriptRef.current
    ) {
      lastSavedUserTranscriptRef.current = user;
      onSaveMessage("user", user);
    }
  }, [onSaveMessage]);

  const interrupt = useCallback(() => {
    scheduledNodesRef.current.forEach((n) => {
      try {
        n.stop();
      } catch {}
    });
    scheduledNodesRef.current = [];
    nextPlayTimeRef.current = 0;
    send(
      JSON.stringify({
        clientContent: {
          turns: [{ role: "user", parts: [] }],
          turnComplete: true,
        },
      })
    );
    isModelSpeakingRef.current = false;
    setIsModelSpeaking(false);
  }, [send]);

  const disconnect = useCallback(() => {
    flushPendingTranscripts();
    interrupt();
    playbackContextRef.current?.close().catch(() => {});
    playbackContextRef.current = null;
    bufferedAiAudioRef.current = [];
    sessionRef.current?.close();
    sessionRef.current = null;
    setIsConnected(false);
  }, [interrupt, flushPendingTranscripts]);

  const connect = useCallback(
    async (options?: { token?: string }) => {
      setError(null);
      hasSentSetupRef.current = false;
      hasReceivedSetupCompleteRef.current = false;

      const token =
        options?.token ??
        (await SessionService.getLiveToken(sessionId))?.data?.token;
      if (!token) throw new Error("Missing auth token");

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      sessionRef.current = ws;
      ws.binaryType = "arraybuffer";

      const connectPromise = new Promise<void>((resolve, reject) => {
        connectResolveRef.current = resolve;
        connectRejectRef.current = reject;
        connectTimeoutRef.current = window.setTimeout(
          () => reject(new Error("Timed out")),
          15000
        );
      });

      ws.onopen = () => {
        if (hasSentSetupRef.current) return;
        hasSentSetupRef.current = true;
        const handle =
          sessionHandleRef.current ?? getStoredSessionHandle(sessionId);
        ws.send(
          JSON.stringify({
            setup: {
              ...(handle ? { sessionResumption: { handle } } : {}),
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
          })
        );
      };

      ws.onmessage = (event) => {
        const text =
          typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(event.data);
        const msg = JSON.parse(text);

        if (msg.setupComplete !== undefined) {
          hasReceivedSetupCompleteRef.current = true;
          setIsConnected(true);
          window.clearTimeout(connectTimeoutRef.current!);
          connectResolveRef.current?.();
          connectResolveRef.current = null;
          connectRejectRef.current = null;

          if (!hasSentKickoffRef.current) {
            hasSentKickoffRef.current = true;
            ws.send(
              JSON.stringify({
                clientContent: {
                  turns: [
                    {
                      role: "user",
                      parts: [{ text: "Start the interview now." }],
                    },
                  ],
                  turnComplete: true,
                },
              })
            );
          }
        }

        if (msg.serverContent) {
          const { serverContent } = msg;

          if (serverContent.modelTurn) {
            if (!isModelSpeakingRef.current) {
              isModelSpeakingRef.current = true;
              setIsModelSpeaking(true);
              callbacks?.onAiStartedResponding?.();
            }
            serverContent.modelTurn.parts?.forEach((p: any) => {
              if (p.inlineData?.data) handleAudioOutput(p.inlineData.data);
            });
          }

          if (serverContent.turnComplete) {
            isModelSpeakingRef.current = false;
            setIsModelSpeaking(false);
            callbacks?.onAiFinishedSpeaking?.();
            if (scheduledNodesRef.current.length === 0)
              nextPlayTimeRef.current = 0;

            // Flush user transcript first to preserve chronological order
            const userRaw = pendingUserTranscriptRef.current;
            if (userRaw) {
              const userT = normalizeTranscript(userRaw);
              if (
                userT &&
                !shouldIgnoreTranscript(userRaw) &&
                userT !== lastSavedUserTranscriptRef.current
              ) {
                lastSavedUserTranscriptRef.current = userT;
                onSaveMessage("user", userT);
              }
              pendingUserTranscriptRef.current = null;
            }

            const t = pendingAssistantTranscriptRef.current
              ? normalizeTranscript(pendingAssistantTranscriptRef.current)
              : null;
            if (
              t &&
              !shouldIgnoreTranscript(t) &&
              t !== lastSavedAssistantTranscriptRef.current
            ) {
              lastSavedAssistantTranscriptRef.current = t;
              onSaveMessage("assistant", t);
            }
            pendingAssistantTranscriptRef.current = null;
            lastAssistantTranscriptUpdateAtRef.current = 0;
          }

          if (serverContent.outputTranscription?.text) {
            const t = serverContent.outputTranscription.text;
            if (!shouldIgnoreTranscript(t)) {
              pendingAssistantTranscriptRef.current = mergeTranscript(
                pendingAssistantTranscriptRef.current,
                t
              );
              lastAssistantTranscriptUpdateAtRef.current = Date.now();
            }
          }

          if (serverContent.inputTranscription?.text) {
            const t = serverContent.inputTranscription.text;
            if (!shouldIgnoreTranscript(t)) {
              pendingUserTranscriptRef.current = mergeTranscript(
                pendingUserTranscriptRef.current,
                t
              );
              callbacks?.onInputTranscriptionUpdate?.();
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
          disconnect();
          setTimeout(() => connect(), 2000); // no options → fresh token fetched inside connect()
        }

        if (msg.usageMetadata) callbacks?.onTokenUsage?.();
      };

      ws.onerror = () => {
        setError("WebSocket error");
        connectRejectRef.current?.(new Error("WebSocket error"));
        connectResolveRef.current = null;
        connectRejectRef.current = null;
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (!hasReceivedSetupCompleteRef.current) {
          connectRejectRef.current?.(
            new Error(`Closed before setupComplete (code=${event.code})`)
          );
          connectResolveRef.current = null;
          connectRejectRef.current = null;
        }
      };

      return connectPromise;
    },
    [sessionId, handleAudioOutput, disconnect, onSaveMessage, callbacks]
  );

  return {
    connect,
    disconnect,
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