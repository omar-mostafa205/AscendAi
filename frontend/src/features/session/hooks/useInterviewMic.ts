import { useRef, useState, useCallback } from "react";
import { convertPCM16ToBase64 } from "../services/audio.service";
import { shouldIgnoreTranscript, normalizeTranscript } from "../utils";

const AUDIO_CONFIG = {
  INPUT_SAMPLE_RATE: 16000,
  LATENCY_HINT: "interactive",
  SPEECH_ON_THRESHOLD: 0.07,
  SPEECH_OFF_THRESHOLD: 0.03,

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
  },
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
    if (audioContextRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    mediaStreamRef.current = stream;

    const ctx = new AudioContext({
      sampleRate: AUDIO_CONFIG.INPUT_SAMPLE_RATE,
      latencyHint: "interactive",
    });
    audioContextRef.current = ctx;

    await ctx.audioWorklet.addModule("/gemini-audio-processor.worklet.js");
    const workletNode = new AudioWorkletNode(ctx, "gemini-audio-processor");
    audioWorkletNodeRef.current = workletNode;
    workletNode.port.postMessage({
      type: "updateConfig",
      speechOnThreshold: AUDIO_CONFIG.SPEECH_ON_THRESHOLD,
      speechOffThreshold: AUDIO_CONFIG.SPEECH_OFF_THRESHOLD,
      silenceDuration: AUDIO_CONFIG.SILENCE_DURATION_MS,
    });

    workletNode.port.onmessage = (event) => {
      const data = event.data ?? {};
      const type = data.type;

      if (type === "vad") {
        const vadEvent = data.vadEvent;

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
          }
        }

        if (vadEvent === "stopped") {
          isUserSpeakingSharedRef.current = false;
          setIsUserSpeaking(false);
          callbacks?.onUserStoppedSpeaking?.();

          if (!isModelSpeakingRef.current) {
            send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
          }

          if (finalizeTimerRef.current)
            window.clearTimeout(finalizeTimerRef.current);

          finalizeTimerRef.current = window.setTimeout(() => {
            const age =
              lastTranscriptUpdateAtRef.current > 0
                ? Date.now() - lastTranscriptUpdateAtRef.current
                : Infinity;

            if (age < AUDIO_CONFIG.LATE_UPDATE_GRACE_MS) return;

            const raw = pendingUserTranscriptRef.current;
            if (!raw) return;
            const t = normalizeTranscript(raw);

            if (
              !t ||
              shouldIgnoreTranscript(raw) ||
              t === lastSavedUserTranscriptRef.current
            )
              return;

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

      const base64 = convertPCM16ToBase64(pcm16);
      send(
        JSON.stringify({
          realtimeInput: {
            mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: base64 }],
          },
        }),
      );
    };

    const source = ctx.createMediaStreamSource(stream);
    sourceNodeRef.current = source;
    source.connect(workletNode);
    setIsMicActive(true);
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
    if (finalizeTimerRef.current) {
      window.clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    audioWorkletNodeRef.current?.disconnect();
    audioWorkletNodeRef.current = null;
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    setIsMicActive(false);
    isUserSpeakingSharedRef.current = false;
    setIsUserSpeaking(false);
  }, [send, isUserSpeakingSharedRef]);

  return {
    startMic,
    stopMic,
    isMicActive,
    isUserSpeaking,
    notifyTranscriptUpdate,
  };
}
