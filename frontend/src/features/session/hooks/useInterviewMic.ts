import { useRef, useState, useCallback } from "react";
import { convertPCM16ToBase64 } from "../services/audio.service";
import { shouldIgnoreTranscript, normalizeTranscript } from "../utils";

const AUDIO_CONFIG = {
  INPUT_SAMPLE_RATE: 16000,
  LATENCY_HINT: "interactive",

  SPEECH_ON_THRESHOLD: 0.03,

  SPEECH_OFF_THRESHOLD: 0.01,

  SILENCE_DURATION_MS: 1600,
  FINALIZE_DELAY_MS: 2200,
  LATE_UPDATE_GRACE_MS: 2500,
} as const;


export function useInterviewMic(
  send: (data: string) => void,
  isModelSpeakingRef: React.MutableRefObject<boolean>,
  isUserSpeakingSharedRef: React.MutableRefObject<boolean>,
  onSaveMessage: (role: "user" | "assistant", content: string) => void,
  pendingUserTranscriptRef: React.MutableRefObject<string | null>,
  lastSavedUserTranscriptRef: React.MutableRefObject<string | null>,
  callbacks?: {
    onUserStartedSpeaking?: () => void;
    onUserStoppedSpeaking?: () => void;
  }
) {
  const [isMicActive, setIsMicActive] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const finalizeTimerRef = useRef<number | null>(null);
  const lastTranscriptUpdateAtRef = useRef<number>(0);

  const startMic = useCallback(async () => {
    console.log("[useInterviewMic] startMic called", {
      alreadyActive: !!audioContextRef.current,
    });

    if (audioContextRef.current) {
      console.warn("[useInterviewMic] Mic already active, skipping startMic");
      return;
    }

    // 1. Request microphone permission
    console.log("[useInterviewMic] Requesting getUserMedia...");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log("[useInterviewMic] getUserMedia granted", {
        tracks: stream.getAudioTracks().map((t) => ({
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted,
        })),
      });
    } catch (err) {
      console.error("[useInterviewMic] getUserMedia FAILED — mic permission denied or no device", err);
      throw err;
    }

    mediaStreamRef.current = stream;

    // 2. Create AudioContext
    console.log("[useInterviewMic] Creating AudioContext at sampleRate", AUDIO_CONFIG.INPUT_SAMPLE_RATE);
    const ctx = new AudioContext({
      sampleRate: AUDIO_CONFIG.INPUT_SAMPLE_RATE,
      latencyHint: "interactive",
    });
    audioContextRef.current = ctx;
    console.log("[useInterviewMic] AudioContext created", {
      state: ctx.state,
      sampleRate: ctx.sampleRate,
    });

    // 3. Load audio worklet
    console.log("[useInterviewMic] Loading audio worklet module...");
    try {
      await ctx.audioWorklet.addModule("/gemini-audio-processor.worklet.js");
      console.log("[useInterviewMic] Audio worklet module loaded successfully");
    } catch (err) {
      console.error("[useInterviewMic] Failed to load audio worklet module", err);
      throw err;
    }

    // 4. Create worklet node
    const workletNode = new AudioWorkletNode(ctx, "gemini-audio-processor");
    audioWorkletNodeRef.current = workletNode;
    console.log("[useInterviewMic] AudioWorkletNode created");

    workletNode.port.postMessage({
      type: "updateConfig",
      speechOnThreshold: AUDIO_CONFIG.SPEECH_ON_THRESHOLD,
      speechOffThreshold: AUDIO_CONFIG.SPEECH_OFF_THRESHOLD,
      silenceDuration: AUDIO_CONFIG.SILENCE_DURATION_MS,
    });
    console.log("[useInterviewMic] Worklet config sent", {
      speechOnThreshold: AUDIO_CONFIG.SPEECH_ON_THRESHOLD,
      speechOffThreshold: AUDIO_CONFIG.SPEECH_OFF_THRESHOLD,
      silenceDuration: AUDIO_CONFIG.SILENCE_DURATION_MS,
    });

    let audioChunkCount = 0;
    let vadEventCount = 0;

    workletNode.port.onmessage = (event) => {
      const data = event.data ?? {};
      const type = data.type;

      if (type === "vad") {
        vadEventCount++;
        const vadEvent = data.vadEvent;
        console.log(`[useInterviewMic] VAD event #${vadEventCount}:`, vadEvent, {
          isModelSpeaking: isModelSpeakingRef.current,
          isUserSpeaking: isUserSpeakingSharedRef.current,
        });

        if (vadEvent === "started") {
          isUserSpeakingSharedRef.current = true;
          setIsUserSpeaking(true);
          callbacks?.onUserStartedSpeaking?.();

          if (finalizeTimerRef.current) {
            window.clearTimeout(finalizeTimerRef.current);
            finalizeTimerRef.current = null;
          }

          if (!isModelSpeakingRef.current) {
            send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
            console.log("[useInterviewMic] Sent activityStart to Gemini");
          } else {
            console.warn("[useInterviewMic] Model is speaking — skipping activityStart");
          }
        }

        if (vadEvent === "stopped") {
          isUserSpeakingSharedRef.current = false;
          setIsUserSpeaking(false);
          callbacks?.onUserStoppedSpeaking?.();

          if (!isModelSpeakingRef.current) {
            send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
            console.log("[useInterviewMic] Sent activityEnd to Gemini");
          } else {
            console.warn("[useInterviewMic] Model is speaking — skipping activityEnd");
          }

          if (finalizeTimerRef.current) window.clearTimeout(finalizeTimerRef.current);

          finalizeTimerRef.current = window.setTimeout(() => {
            const age =
              lastTranscriptUpdateAtRef.current > 0
                ? Date.now() - lastTranscriptUpdateAtRef.current
                : Infinity;

            if (age < AUDIO_CONFIG.LATE_UPDATE_GRACE_MS) {
              console.log("[useInterviewMic] Skipping finalize — transcript updated recently", { age });
              return;
            }

            const raw = pendingUserTranscriptRef.current;
            if (!raw) {
              console.log("[useInterviewMic] Finalize timer fired — no pending transcript");
              return;
            }
            const t = normalizeTranscript(raw);

            if (!t || shouldIgnoreTranscript(raw) || t === lastSavedUserTranscriptRef.current) {
              console.log("[useInterviewMic] Finalize timer fired — transcript ignored or duplicate", { t });
              return;
            }

            console.log("[useInterviewMic] Finalizing user transcript", { t });
            lastSavedUserTranscriptRef.current = t;
            onSaveMessage("user", t);
          }, AUDIO_CONFIG.FINALIZE_DELAY_MS);
        }

        return;
      }

      if (type !== "audioData") return;

      if (isModelSpeakingRef.current) return;

      const pcm16 = data.pcm16;
      const amplitude = data.amplitude;
      if (!pcm16 || typeof amplitude !== "number") return;

      audioChunkCount++;
      if (audioChunkCount === 1) {
        console.log("[useInterviewMic] First audio chunk received from worklet ✅", {
          amplitude,
          pcm16Length: pcm16.length,
        });
      }
      if (audioChunkCount % 100 === 0) {
        console.log(`[useInterviewMic] Audio chunks sent so far: ${audioChunkCount}`, { amplitude });
      }

      const base64 = convertPCM16ToBase64(pcm16);
      send(
        JSON.stringify({
          realtimeInput: {
            mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: base64 }],
          },
        })
      );
    };

    // 5. Connect source → worklet
    const source = ctx.createMediaStreamSource(stream);
    sourceNodeRef.current = source;
    source.connect(workletNode);
    setIsMicActive(true);

    console.log("[useInterviewMic] ✅ Mic fully started", {
      audioContextState: ctx.state,
      trackLabel: stream.getAudioTracks()[0]?.label,
    });

    // 6. Warn if AudioContext is suspended (autoplay policy)
    if (ctx.state === "suspended") {
      console.warn(
        "[useInterviewMic] ⚠️ AudioContext is SUSPENDED — browser autoplay policy may be blocking audio. " +
        "A user gesture (click) is required to resume it."
      );
      // Attempt to resume
      ctx.resume().then(() => {
        console.log("[useInterviewMic] AudioContext resumed successfully");
      }).catch((e) => {
        console.error("[useInterviewMic] AudioContext resume failed", e);
      });
    }
  }, [
    isModelSpeakingRef,
    send,
    isUserSpeakingSharedRef,
    callbacks,
    pendingUserTranscriptRef,
    lastSavedUserTranscriptRef,
    onSaveMessage,
  ]);

  const notifyTranscriptUpdate = useCallback(() => {
    lastTranscriptUpdateAtRef.current = Date.now();
  }, []);

  const stopMic = useCallback(() => {
    console.log("[useInterviewMic] stopMic called");
    if (finalizeTimerRef.current) {
      window.clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    audioWorkletNodeRef.current?.disconnect();
    audioWorkletNodeRef.current = null;
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => {
      t.stop();
      console.log("[useInterviewMic] Track stopped:", t.label);
    });
    mediaStreamRef.current = null;
    audioContextRef.current?.close().catch(() => { });
    audioContextRef.current = null;
    send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    setIsMicActive(false);
    isUserSpeakingSharedRef.current = false;
    setIsUserSpeaking(false);
    console.log("[useInterviewMic] Mic stopped ✅");
  }, [send, isUserSpeakingSharedRef]);

  return { startMic, stopMic, isMicActive, isUserSpeaking, notifyTranscriptUpdate };
}