import { useRef, useState, useCallback } from "react";
import { convertPCM16ToBase64 } from "../services/audio.service";

const AUDIO_CONFIG = {
  INPUT_SAMPLE_RATE: 16000,
  SPEECH_ON_THRESHOLD: 0.012,
  SPEECH_OFF_THRESHOLD: 0.007,
  SILENCE_DURATION_MS: 1200,
  FINALIZE_DELAY_MS: 950,
  LATE_UPDATE_GRACE_MS: 1400,
} as const;

export function useGeminiMic(
  send: (data: string) => void,
  isModelSpeakingRef: React.MutableRefObject<boolean>,
  onSaveMessage: (role: "user" | "assistant", content: string) => void,
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
  const isUserSpeakingRef = useRef(false);
  const finalizeTimerRef = useRef<number | null>(null);
  const pendingUserTranscriptRef = useRef<string | null>(null);
  const lastSavedUserTranscriptRef = useRef<string | null>(null);
  const lastTranscriptUpdateAtRef = useRef<number>(0);

  const startMic = useCallback(async () => {
    if (audioContextRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    mediaStreamRef.current = stream;

    const ctx = new AudioContext({ sampleRate: AUDIO_CONFIG.INPUT_SAMPLE_RATE });
    audioContextRef.current = ctx;

    await ctx.audioWorklet.addModule("/gemini-audio-processor.worklet.js");
    const workletNode = new AudioWorkletNode(ctx, "gemini-audio-processor");
    audioWorkletNodeRef.current = workletNode;

    workletNode.port.onmessage = (event) => {
      const data = event.data ?? {};
      const type = data.type;

      if (type === "vad") {
        const vadEvent = data.vadEvent;
        if (vadEvent === "started") {
          isUserSpeakingRef.current = true;
          setIsUserSpeaking(true);
          callbacks?.onUserStartedSpeaking?.();
          if (finalizeTimerRef.current) {
            window.clearTimeout(finalizeTimerRef.current);
            finalizeTimerRef.current = null;
          }
          send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
        }

        if (vadEvent === "stopped") {
          isUserSpeakingRef.current = false;
          setIsUserSpeaking(false);
          callbacks?.onUserStoppedSpeaking?.();
          send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));

          if (finalizeTimerRef.current) window.clearTimeout(finalizeTimerRef.current);
          finalizeTimerRef.current = window.setTimeout(() => {
            const age = lastTranscriptUpdateAtRef.current > 0
              ? Date.now() - lastTranscriptUpdateAtRef.current : Infinity;
            if (age < AUDIO_CONFIG.LATE_UPDATE_GRACE_MS) return;
            const t = pendingUserTranscriptRef.current?.trim();
            if (!t || t === lastSavedUserTranscriptRef.current) return;
            lastSavedUserTranscriptRef.current = t;
            onSaveMessage("user", t);
            pendingUserTranscriptRef.current = null;
            lastTranscriptUpdateAtRef.current = 0;
          }, AUDIO_CONFIG.FINALIZE_DELAY_MS);
        }

        return;
      }

      if (type !== "audioData") return;

      const pcm16 = data.pcm16;
      const amplitude = data.amplitude;
      if (!pcm16 || typeof amplitude !== "number") return;

      const shouldSend = !isModelSpeakingRef.current || amplitude > 0.004;
      if (shouldSend) {
        const base64 = convertPCM16ToBase64(pcm16);
        send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: base64 }] } }));
      }
    };

    const source = ctx.createMediaStreamSource(stream);
    sourceNodeRef.current = source;
    source.connect(workletNode);
    setIsMicActive(true);
  }, [send, isModelSpeakingRef, callbacks, onSaveMessage]);

  const stopMic = useCallback(() => {
    audioWorkletNodeRef.current?.disconnect();
    audioWorkletNodeRef.current = null;
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    setIsMicActive(false);
    isUserSpeakingRef.current = false;
    setIsUserSpeaking(false);
  }, [send]);

  return { startMic, stopMic, isMicActive, isUserSpeaking };
}
