import { useState, useRef, useCallback } from "react";
import { SessionService } from "@/features/session/services/session.service";

function getStoredSessionHandle(sessionId: string): string | null {
  try {
    return window.localStorage.getItem(`gemini_live_handle:${sessionId}`);
  } catch {
    return null;
  }
}

function storeSessionHandle(sessionId: string, handle: string) {
  try {
    window.localStorage.setItem(`gemini_live_handle:${sessionId}`, handle);
  } catch {}
}

function normalizeTranscript(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/<noise>/gi, "")
    .replace(/\[(noise|silence)\]/gi, "")
    .replace(/\(silence\)/gi, "")
    .trim();
}

function shouldIgnoreTranscript(inputRaw: string): boolean {
  const input = normalizeTranscript(inputRaw);
  if (!input) return true;
  if (/^[\.\,\!\?\-–—]+$/.test(input)) return true;

  const lower = input.toLowerCase();
  const filler = new Set([
    "um",
    "uh",
    "erm",
    "hmm",
    "mm",
    "mhm",
    "ah",
    "eh",
    "ehm",
    "ähm",
    "uhm",
  ]);
  if (filler.has(lower) && input.split(" ").length <= 2) return true;

  const hasLatin = /[A-Za-z]/.test(input);
  const hasDigit = /\d/.test(input);
  if (!hasLatin && !hasDigit) return true;

  return false;
}

function mergeTranscript(prevRaw: string | null, nextRaw: string): string {
  const prev = normalizeTranscript(prevRaw ?? "");
  const next = normalizeTranscript(nextRaw);
  if (!prev) return next;
  if (!next) return prev;
  
  // Keep the longest (Gemini sends full transcript each time)
  if (next.length >= prev.length) return next;
  return prev;
}

export const useGeminiLive = (
  jobId: string,
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
  const [isConnected, setIsConnected] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isUserSpeakingRef = useRef(false);
  const isModelSpeakingRef = useRef(false);
  const hasSentKickoffRef = useRef(false);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const playbackContextRef = useRef<AudioContext | null>(null);
  const scheduledNodesRef = useRef<AudioBufferSourceNode[]>([]);
  let nextPlayTimeRef = useRef<number>(0);

  const sessionHandleRef = useRef<string | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastVoiceAtRef = useRef<number>(0);
  const pendingUserTranscriptRef = useRef<string | null>(null);
  const pendingAssistantTranscriptRef = useRef<string | null>(null);
  const lastSavedUserTranscriptRef = useRef<string | null>(null);
  const lastSavedAssistantTranscriptRef = useRef<string | null>(null);
  const userStopTalkingTimeRef = useRef<number>(0);
  const isInitialTriggerRef = useRef(true);
  const lastUserTranscriptUpdateAtRef = useRef<number>(0);
  const lastAssistantTranscriptUpdateAtRef = useRef<number>(0);
  const userTranscriptStableTimerRef = useRef<NodeJS.Timeout | null>(null);
  const assistantTranscriptStableTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSentSetupRef = useRef(false);
  const hasReceivedSetupCompleteRef = useRef(false);

  const flushPendingTranscripts = useCallback(() => {
    // Clear any pending timers
    if (userTranscriptStableTimerRef.current) {
      clearTimeout(userTranscriptStableTimerRef.current);
      userTranscriptStableTimerRef.current = null;
    }
    if (assistantTranscriptStableTimerRef.current) {
      clearTimeout(assistantTranscriptStableTimerRef.current);
      assistantTranscriptStableTimerRef.current = null;
    }

    const userTranscript = pendingUserTranscriptRef.current
      ? normalizeTranscript(pendingUserTranscriptRef.current)
      : null;
    if (userTranscript && !shouldIgnoreTranscript(userTranscript) && userTranscript !== lastSavedUserTranscriptRef.current) {
      lastSavedUserTranscriptRef.current = userTranscript;
      onSaveMessage("user", userTranscript);
      console.log("Flushed pending user transcript before disconnect");
    }

    const assistantTranscript = pendingAssistantTranscriptRef.current
      ? normalizeTranscript(pendingAssistantTranscriptRef.current)
      : null;
    if (
      assistantTranscript &&
      !shouldIgnoreTranscript(assistantTranscript) &&
      assistantTranscript !== lastSavedAssistantTranscriptRef.current
    ) {
      lastSavedAssistantTranscriptRef.current = assistantTranscript;
      onSaveMessage("assistant", assistantTranscript);
      console.log("Flushed pending assistant transcript before disconnect");
    }
  }, [onSaveMessage]);

  const handleAudioOutput = useCallback((base64Audio: string) => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      console.log("Audio playback context initialized (24kHz output)");
    }
    const ctx = playbackContextRef.current;
    
    const binary = atob(base64Audio);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
    }
    
    const float32Array = new Float32Array(array.length / 2);
    const dataView = new DataView(array.buffer);
    for (let i = 0; i < float32Array.length; i++) {
        float32Array[i] = dataView.getInt16(i * 2, true) / 32768;
    }
    
    const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);
    
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    const currTime = ctx.currentTime;
    if (nextPlayTimeRef.current < currTime) {
      nextPlayTimeRef.current = currTime;
    }
    
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += audioBuffer.duration;
    scheduledNodesRef.current.push(source);
    
    source.onended = () => {
      scheduledNodesRef.current = scheduledNodesRef.current.filter((n) => n !== source);
    };
  }, []);

  const interrupt = useCallback(() => {
    console.log("Audio interrupted, stopping playback");
    scheduledNodesRef.current.forEach(node => {
      try { node.stop(); } catch(e) {}
    });
    scheduledNodesRef.current = [];
    nextPlayTimeRef.current = 0;
    
    const ws = sessionRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && hasReceivedSetupCompleteRef.current) {
      try {
        ws.send(JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [] }], turnComplete: true } }));
      } catch (e) {
        console.error("Interrupt send error", e);
      }
    }
    isModelSpeakingRef.current = false;
    setIsModelSpeaking(false);
  }, []);

  const disconnect = useCallback(() => {
    console.log("Disconnecting from Live API...");

    flushPendingTranscripts();

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    
    interrupt();
    
    setIsMicActive(false);
    setIsUserSpeaking(false);
    
    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => {});
      playbackContextRef.current = null;
    }

    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null; 
    }
    setIsConnected(false);
    console.log("Disconnected from Live API and cleaned up audio contexts");
  }, [interrupt, flushPendingTranscripts]);

  const connectToGemini = useCallback(async () => {
    try {
      setError(null);
      console.log("Fetching Live API token...");

      hasSentSetupRef.current = false;
      hasReceivedSetupCompleteRef.current = false;

      const res = await SessionService.getLiveToken(sessionId);
      const token = res?.data?.token;

      if (!token) {
        throw new Error("Missing auth token from backend");
      }

      console.log("Ephemeral token support is experimental and may change in future versions.");

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;
      const ws = new window.WebSocket(wsUrl);
      sessionRef.current = ws;

      ws.onopen = () => {
        if (hasSentSetupRef.current) return;
        hasSentSetupRef.current = true;
        const resumeHandle = sessionHandleRef.current ?? getStoredSessionHandle(sessionId);

        ws.send(
          JSON.stringify({
            setup: {
              ...(resumeHandle ? { sessionResumption: { handle: resumeHandle } } : {}),
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
          })
        );
        console.log("Session websocket opened; waiting for setupComplete...");
      };

      ws.onmessage = async (event) => {
        let msg;
        if (event.data instanceof Blob) {
           const text = await event.data.text();
           msg = JSON.parse(text);
        } else {
           msg = JSON.parse(event.data);
        }
        
        if (msg.setupComplete !== undefined) {
          console.log("setupComplete received");
          hasReceivedSetupCompleteRef.current = true;
          setIsConnected(true);

          if (!hasSentKickoffRef.current && sessionRef.current?.readyState === WebSocket.OPEN) {
            hasSentKickoffRef.current = true;
            isInitialTriggerRef.current = true;
            console.log("Sending initial trigger message to start conversation...");
            sessionRef.current.send(
              JSON.stringify({
                clientContent: {
                  turns: [{ role: "user", parts: [{ text: "Start the interview now." }] }],
                  turnComplete: true,
                },
              })
            );
          }
        }

        if (msg.serverContent) {
          const { serverContent } = msg;

          // Buffer user transcript + schedule save after stabilization
          if (serverContent.inputTranscription) {
            const transcript = serverContent.inputTranscription.text;
            if (transcript && !shouldIgnoreTranscript(transcript)) {
              pendingUserTranscriptRef.current = mergeTranscript(pendingUserTranscriptRef.current, transcript);
              lastUserTranscriptUpdateAtRef.current = Date.now();
              
              // Clear existing timer
              if (userTranscriptStableTimerRef.current) {
                clearTimeout(userTranscriptStableTimerRef.current);
              }
              
              // Save after 800ms of no new updates (transcript stabilized)
              userTranscriptStableTimerRef.current = setTimeout(() => {
                const userTranscript = pendingUserTranscriptRef.current
                  ? normalizeTranscript(pendingUserTranscriptRef.current)
                  : null;
                if (userTranscript && 
                    !shouldIgnoreTranscript(userTranscript) && 
                    userTranscript !== lastSavedUserTranscriptRef.current) {
                  lastSavedUserTranscriptRef.current = userTranscript;
                  onSaveMessage("user", userTranscript);
                  console.log("💬 Saved user:", userTranscript);
                  pendingUserTranscriptRef.current = null;
                  lastUserTranscriptUpdateAtRef.current = 0;
                }
              }, 800);
            }
          }

          // Buffer assistant transcript + schedule save after stabilization
          if (serverContent.outputTranscription){
            const transcript = serverContent.outputTranscription.text;
            if (transcript && !shouldIgnoreTranscript(transcript)) {
              pendingAssistantTranscriptRef.current = mergeTranscript(pendingAssistantTranscriptRef.current, transcript);
              lastAssistantTranscriptUpdateAtRef.current = Date.now();
          
              if (userStopTalkingTimeRef.current > 0) {
                const responseTime = Math.round(performance.now() - userStopTalkingTimeRef.current);
                console.log(`Response time: ${responseTime}ms (user stop → output transcription)`);
                userStopTalkingTimeRef.current = 0;
              }
              
              // Clear existing timer
              if (assistantTranscriptStableTimerRef.current) {
                clearTimeout(assistantTranscriptStableTimerRef.current);
              }
              
              // Save after 800ms of no new updates (transcript stabilized)
              assistantTranscriptStableTimerRef.current = setTimeout(() => {
                const assistantTranscript = pendingAssistantTranscriptRef.current
                  ? normalizeTranscript(pendingAssistantTranscriptRef.current)
                  : null;
                if (assistantTranscript && 
                    !shouldIgnoreTranscript(assistantTranscript) && 
                    assistantTranscript !== lastSavedAssistantTranscriptRef.current) {
                  lastSavedAssistantTranscriptRef.current = assistantTranscript;
                  onSaveMessage("assistant", assistantTranscript);
                  console.log("💬 Saved assistant:", assistantTranscript);
                  pendingAssistantTranscriptRef.current = null;
                  lastAssistantTranscriptUpdateAtRef.current = 0;
                }
              }, 800);
            }
          }

          if (serverContent.modelTurn) {
            if (!isModelSpeakingRef.current) {
              isModelSpeakingRef.current = true;
              setIsModelSpeaking(true);
              callbacks?.onAiStartedResponding?.();
              console.log("Model started responding");
            }
            
            const parts = serverContent.modelTurn.parts;
            if (parts && parts.length > 0) {
              parts.forEach((p: any) => {
                if (p.inlineData && p.inlineData.data) {
                  handleAudioOutput(p.inlineData.data);
                }
              });
            }
          }

          if (serverContent.turnComplete) {
            console.log("turnComplete received");
            isModelSpeakingRef.current = false;
            setIsModelSpeaking(false);
            callbacks?.onAiFinishedSpeaking?.();
            if (scheduledNodesRef.current.length === 0) {
              nextPlayTimeRef.current = 0;
            }

            if (isInitialTriggerRef.current) {
              isInitialTriggerRef.current = false;
              console.log("Initial trigger phase completed");
            }
          }

          const handledKeys = ['modelTurn', 'turnComplete', 'outputTranscription', 'inputTranscription'];
          const unknownKeys = Object.keys(serverContent).filter(k => !handledKeys.includes(k));
          if (unknownKeys.length > 0) {
            console.log("Unhandled serverContent keys:", unknownKeys);
          }
        }

        if (msg.usageMetadata) {
          const usage = msg.usageMetadata;
          console.log("Token usage:", {
            promptTokenCount: usage.promptTokenCount,
            responseTokenCount: usage.candidatesTokenCount ?? usage.responseTokenCount,
            totalTokenCount: usage.totalTokenCount,
            promptTokensDetails: usage.promptTokensDetails,
            responseTokensDetails: usage.candidatesTokensDetails ?? usage.responseTokensDetails,
          });
          callbacks?.onTokenUsage?.();
        }
        
        if (msg.sessionResumptionUpdate) {
          const update = msg.sessionResumptionUpdate;
          const handle = update?.newHandle ?? update?.handle;
          if (typeof handle === "string" && handle.trim().length > 0) {
            sessionHandleRef.current = handle;
            storeSessionHandle(sessionId, handle);
            console.log(`Session resumption handle updated: ${handle.substring(0, 56)}`);
          }
        }

        if (msg.goAway) {
           console.warn("Server sent goAway, reconnecting...");
           disconnect();
           setTimeout(connectToGemini, 2000);
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error", e);
        setError("WebSocket error");
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        stopMic();
        console.log(`Live API connection closed: code=${event.code}`);
        if (event.code !== 1000) {
          console.warn("Gemini Live WS closed unexpectedly", event.code, event.reason);
        }
        console.log("Live API ended");
      };

    } catch (err: any) {
      console.error("Connection failed:", err.message);
      setError(err.message || "Connection failed");
    }
  }, [sessionId, handleAudioOutput, disconnect, onSaveMessage, callbacks]);

  const startMic = useCallback(async () => {
    if (audioContextRef.current) {
      console.log("Audio capture already set up");
      return;
    }

    console.log("Starting audio capture...");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
      console.log("Microphone access granted");
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;
      
      source.connect(processor);
      const zeroGain = audioCtx.createGain();
      zeroGain.gain.value = 0;
      processor.connect(zeroGain);
      zeroGain.connect(audioCtx.destination);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]);
        const avg = sum / inputData.length;

        const SPEECH_ON = 0.012;
        const SPEECH_OFF = 0.007;
        const SILENCE_MS = 1200;

        const now = performance.now();

        if (avg >= SPEECH_ON) {
          lastVoiceAtRef.current = now;

          if (!isUserSpeakingRef.current) {
            isUserSpeakingRef.current = true;
            setIsUserSpeaking(true);
            callbacks?.onUserStartedSpeaking?.();
            console.log("User started speaking (audio detected)");

            if (
              sessionRef.current &&
              sessionRef.current.readyState === window.WebSocket.OPEN &&
              hasReceivedSetupCompleteRef.current
            ) {
              sessionRef.current.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
            }
          }
        }

        if (isUserSpeakingRef.current) {
          const isSilentEnough = avg <= SPEECH_OFF;
          if (isSilentEnough && lastVoiceAtRef.current > 0 && now - lastVoiceAtRef.current >= SILENCE_MS) {
            isUserSpeakingRef.current = false;
            setIsUserSpeaking(false);
            callbacks?.onUserStoppedSpeaking?.();
            userStopTalkingTimeRef.current = performance.now();

            if (
              sessionRef.current &&
              sessionRef.current.readyState === window.WebSocket.OPEN &&
              hasReceivedSetupCompleteRef.current
            ) {
              sessionRef.current.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
            }
          }
        }
        
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        const buffer = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < buffer.byteLength; i++) {
          binary += String.fromCharCode(buffer[i]);
        }
        const base64Audio = btoa(binary);

        const shouldSendAudio = !isModelSpeakingRef.current || avg > 0.004;

        if (
          shouldSendAudio &&
          sessionRef.current &&
          sessionRef.current.readyState === window.WebSocket.OPEN &&
          hasReceivedSetupCompleteRef.current
        ) {
          sessionRef.current.send(
            JSON.stringify({
              realtimeInput: {
                mediaChunks: [
                  {
                    mimeType: "audio/pcm;rate=16000",
                    data: base64Audio,
                  },
                ],
              },
            })
          );
        }
      };
      
      setIsMicActive(true);
      console.log("Audio capture started");
    } catch (err: any) {
      console.error("Failed to start microphone:", err.message);
      setError(err.message || "Failed to start microphone");
    }
  }, [callbacks]);

  const stopMic = useCallback(() => {
    console.log("Stopping audio capture...");
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (
      sessionRef.current &&
      sessionRef.current.readyState === window.WebSocket.OPEN &&
      hasReceivedSetupCompleteRef.current
    ) {
      try {
        sessionRef.current.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      } catch {}
    }

    setIsMicActive(false);
    isUserSpeakingRef.current = false;
    setIsUserSpeaking(false);
    console.log("Audio capture stopped");
  }, []);

  return {
    connect: connectToGemini,
    disconnect,
    interrupt,
    startMic,
    stopMic,
    flushPendingTranscripts,
    isConnected,
    isModelSpeaking,
    isUserSpeaking,
    isMicActive,
    error,
  };
};