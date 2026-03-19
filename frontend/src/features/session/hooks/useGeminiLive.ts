import { useState, useRef, useCallback } from "react";
import { SessionService } from "@/features/session/services/session.service";

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
  const pendingUserTranscriptRef = useRef<string | null>(null);
  const pendingAssistantTranscriptRef = useRef<string | null>(null);
  const lastSavedUserTranscriptRef = useRef<string | null>(null);
  const lastSavedAssistantTranscriptRef = useRef<string | null>(null);
  const userStopTalkingTimeRef = useRef<number>(0);
  const isInitialTriggerRef = useRef(true);

  // ── Flush any unsaved transcripts ──────────────────────────────────────────
  const flushPendingTranscripts = useCallback(() => {
    const userTranscript = pendingUserTranscriptRef.current;
    if (userTranscript && userTranscript !== lastSavedUserTranscriptRef.current) {
      lastSavedUserTranscriptRef.current = userTranscript;
      onSaveMessage("user", userTranscript);
      console.log("📝 Flushed pending user transcript before disconnect");
    }

    const assistantTranscript = pendingAssistantTranscriptRef.current;
    if (assistantTranscript && assistantTranscript !== lastSavedAssistantTranscriptRef.current) {
      lastSavedAssistantTranscriptRef.current = assistantTranscript;
      onSaveMessage("assistant", assistantTranscript);
      console.log("📝 Flushed pending assistant transcript before disconnect");
    }
  }, [onSaveMessage]);

  const handleAudioOutput = useCallback((base64Audio: string) => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      console.log("🔊 Audio contexts initialized with separate contexts (16kHz input, 24kHz output)");
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
    console.log("🛑 Audio interrupted, stopping all playback");
    scheduledNodesRef.current.forEach(node => {
      try { node.stop(); } catch(e) {}
    });
    scheduledNodesRef.current = [];
    nextPlayTimeRef.current = 0;
    
    const ws = sessionRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
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
    console.log("🔌 Disconnecting from Live API...");

    // Flush any unsaved transcripts BEFORE tearing down the socket
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
    console.log("🔌 Disconnected from Live API and cleaned up audio contexts");
  }, [interrupt, flushPendingTranscripts]);

  const connectToGemini = useCallback(async () => {
    try {
      setError(null);
      console.log("🎬 Fetching Live API token...");
      const res = await SessionService.getLiveToken(sessionId);
      const token = res?.data?.token;
      const model = res?.data?.model || "gemini-2.5-flash-native-audio-preview-12-2025";

      if (!token) {
        throw new Error("Missing auth token from backend");
      }

      console.log("Warning: Ephemeral token support is experimental and may change in future versions.");

      // Ephemeral auth tokens require the constrained websocket method + access_token parameter.
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;
      const ws = new window.WebSocket(wsUrl);
      sessionRef.current = ws;

      ws.onopen = () => {
        // Gemini Live API requires a setup message as the very first client message.
        // When using constrained ephemeral tokens, the model + systemInstruction + voice
        // are already configured in the token, so we keep setup empty to avoid overriding it.
        ws.send(JSON.stringify({
          setup: {
            // Intentionally empty; token constraints supply the full LiveConnectConfig.
          }
        }));
        console.log("🔗 Session connected - waiting for setupComplete message...");
      };

      ws.onmessage = async (event) => {
        let msg;
        if (event.data instanceof Blob) {
           const text = await event.data.text();
           msg = JSON.parse(text);
        } else {
           msg = JSON.parse(event.data);
        }
        
        // Server acknowledges setup with setupComplete → now we are truly connected
        if (msg.setupComplete !== undefined) {
          console.log("✅ Setup complete received - transitioning to CALLING state");
          setIsConnected(true);

          // Kick off the interview so the AI speaks first.
          if (!hasSentKickoffRef.current && sessionRef.current?.readyState === WebSocket.OPEN) {
            hasSentKickoffRef.current = true;
            isInitialTriggerRef.current = true;
            console.log("🎯 Sending initial trigger message to start conversation...");
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

          if (serverContent.modelTurn) {
            // Use ref to avoid stale closure — React state is captured at mount time
            if (!isModelSpeakingRef.current) {
              isModelSpeakingRef.current = true;
              setIsModelSpeaking(true);
              callbacks?.onAiStartedResponding?.();
              console.log("🔊 Live Gemini API call has started");
              console.log("🔊 Starting Live Gemini API call immediately - bypassing video sync");
            }

            // When the model starts responding, flush the latest user transcript once.
            const userTranscript = pendingUserTranscriptRef.current;
            if (userTranscript && userTranscript !== lastSavedUserTranscriptRef.current) {
              lastSavedUserTranscriptRef.current = userTranscript;
              onSaveMessage("user", userTranscript);
              console.log("💬 Saved user transcript:", userTranscript.substring(0, 80));
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
            console.log("✅ Generation complete - model finished generating response");
            isModelSpeakingRef.current = false;
            setIsModelSpeaking(false);
            callbacks?.onAiFinishedSpeaking?.();
            if (scheduledNodesRef.current.length === 0) {
              nextPlayTimeRef.current = 0;
            }

            // Flush the latest assistant transcript at end of turn (reduces DB spam).
            const assistantTranscript = pendingAssistantTranscriptRef.current;
            if (assistantTranscript && assistantTranscript !== lastSavedAssistantTranscriptRef.current) {
              lastSavedAssistantTranscriptRef.current = assistantTranscript;
              onSaveMessage("assistant", assistantTranscript);
              console.log("💬 Saved assistant transcript:", assistantTranscript.substring(0, 80));
            } else {
              console.log("⚠️ No new assistant transcript to save at turnComplete", {
                pending: pendingAssistantTranscriptRef.current?.substring(0, 40),
                lastSaved: lastSavedAssistantTranscriptRef.current?.substring(0, 40),
              });
            }

            // Reset transcript buffers for next turn
            console.log("📝 Buffer reset");
            pendingUserTranscriptRef.current = null;
            pendingAssistantTranscriptRef.current = null;

            if (isInitialTriggerRef.current) {
              isInitialTriggerRef.current = false;
              console.log("🎯 Initial trigger phase completed - normal conversation can begin");
            } else {
              console.log("🤖 Avatar finished speaking, ready for user turn");
            }
          }

          if (serverContent.outputTranscription) {
            const transcript = serverContent.outputTranscription.parts?.[0]?.text;
            console.log("📜 Output transcription received:", transcript?.substring(0, 80) ?? "(empty)");
            if (transcript) {
              pendingAssistantTranscriptRef.current = transcript;

              // Log response time on first output transcription chunk after user stopped talking
              if (userStopTalkingTimeRef.current > 0) {
                const responseTime = Math.round(performance.now() - userStopTalkingTimeRef.current);
                console.log(`⏱️ Response Time: ${responseTime}ms (from user end talking to Gemini output transcription start)`);
                userStopTalkingTimeRef.current = 0;
              }
            }
          }

          if (serverContent.inputTranscription) {
             const transcript = serverContent.inputTranscription.parts?.[0]?.text;
             console.log("📜 Input transcription received:", transcript?.substring(0, 80) ?? "(empty)");
             if (transcript) pendingUserTranscriptRef.current = transcript;
          }

          // Debug: log any serverContent keys we don't explicitly handle
          const handledKeys = ['modelTurn', 'turnComplete', 'outputTranscription', 'inputTranscription'];
          const unknownKeys = Object.keys(serverContent).filter(k => !handledKeys.includes(k));
          if (unknownKeys.length > 0) {
            console.log("🔍 Unhandled serverContent keys:", unknownKeys, serverContent);
          }
        }

        if (msg.usageMetadata) {
          const usage = msg.usageMetadata;
          console.log("🔢 Token usage:", {
            promptTokenCount: usage.promptTokenCount,
            responseTokenCount: usage.candidatesTokenCount ?? usage.responseTokenCount,
            totalTokenCount: usage.totalTokenCount,
            promptTokensDetails: usage.promptTokensDetails,
            responseTokensDetails: usage.candidatesTokensDetails ?? usage.responseTokensDetails,
          });
          callbacks?.onTokenUsage?.();
        }
        
        if (msg.sessionResumptionUpdate) {
           const handle = msg.sessionResumptionUpdate.newHandle ?? msg.sessionResumptionUpdate.handle;
           if (handle) {
             sessionHandleRef.current = handle;
             console.log(`🔄 Session resumption update received, storing new handle: ${handle.substring(0, 56)}`);
           }
        }

        if (msg.goAway) {
           console.warn("⚠️ Server sent goAway, reconnecting...");
           disconnect();
           setTimeout(connectToGemini, 2000);
        }
      };

      ws.onerror = (e) => {
        console.error("❌ WebSocket error", e);
        setError("WebSocket error");
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        stopMic();
        console.log(`🔌 Live API connection closed:  Code: ${event.code}`);
        if (event.code !== 1000) {
          console.warn("⚠️ Gemini Live WS closed unexpectedly", event.code, event.reason);
        }
        console.log("🔌 Live API ended");
        console.log("🔌 Live API connection ended, waiting for manual end call");
      };

    } catch (err: any) {
      console.error("❌ Connection failed:", err.message);
      setError(err.message || "Connection failed");
    }
  }, [sessionId, handleAudioOutput, disconnect, onSaveMessage, callbacks]);

  const startMic = useCallback(async () => {
    if (audioContextRef.current) {
      console.log("🎤 Audio capture already set up, just ensuring context is resumed");
      return;
    }

    console.log("🎤 Starting audio capture...");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      console.log("✅ Microphone access granted");
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;
      
      source.connect(processor);
      // ScriptProcessorNode must be connected to run, but we don't want mic audio to play back.
      const zeroGain = audioCtx.createGain();
      zeroGain.gain.value = 0;
      processor.connect(zeroGain);
      zeroGain.connect(audioCtx.destination);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]);
        const avg = sum / inputData.length;
        
        if (avg > 0.01) {
          if (!isUserSpeakingRef.current) {
            isUserSpeakingRef.current = true;
            setIsUserSpeaking(true);
            callbacks?.onUserStartedSpeaking?.();
            console.log(`🎤 Input volume: ${avg.toFixed(4)}, state: idle`);
            console.log("👤 User started speaking (audio detected)");

            // Explicit activity signals (required when server-side activity detection is disabled).
            if (sessionRef.current && sessionRef.current.readyState === window.WebSocket.OPEN) {
              sessionRef.current.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
            }
          }
          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = setTimeout(() => {
            isUserSpeakingRef.current = false;
            setIsUserSpeaking(false);
            callbacks?.onUserStoppedSpeaking?.();
            userStopTalkingTimeRef.current = performance.now();

            if (sessionRef.current && sessionRef.current.readyState === window.WebSocket.OPEN) {
              sessionRef.current.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
            }
          }, 450);
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

        if (sessionRef.current && sessionRef.current.readyState === window.WebSocket.OPEN) {
          sessionRef.current.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio
              }]
            }
          }));
        }
      };
      
      setIsMicActive(true);
      console.log("✅ Audio capture started - ready for user input");
    } catch (err: any) {
      console.error("❌ Failed to start microphone:", err.message);
      setError(err.message || "Failed to start microphone");
    }
  }, [callbacks]);

  const stopMic = useCallback(() => {
    console.log("🛑 Stopping audio capture...");
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

    // Tell the server the audio stream ended (helps the Live API finalize turns).
    if (sessionRef.current && sessionRef.current.readyState === window.WebSocket.OPEN) {
      try {
        sessionRef.current.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      } catch {}
    }

    setIsMicActive(false);
    isUserSpeakingRef.current = false;
    setIsUserSpeaking(false);
    console.log("✅ Audio capture stopped");
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
