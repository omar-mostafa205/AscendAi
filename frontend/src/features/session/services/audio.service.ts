const AUDIO_CONFIG = {
    INPUT_SAMPLE_RATE: 16000,
    OUTPUT_SAMPLE_RATE: 24000,
    BUFFER_SIZE: 4096,
    SPEECH_ON_THRESHOLD: 0.012,
    SPEECH_OFF_THRESHOLD: 0.007,
    SILENCE_DURATION_MS: 1200,
    FINALIZE_DELAY_MS: 950,
    TRANSCRIPT_STABILIZE_MS: 800,
    LATE_UPDATE_GRACE_MS: 1400,
  } as const;

/**
 * Handles audio encoding/decoding and playback scheduling for Gemini Live
 */
export class GeminiAudioService {
  private playbackContext: AudioContext | null = null;
  private scheduledNodes: AudioBufferSourceNode[] = [];
  private nextPlayTime: number = 0;

  /**
   * Initializes the audio playback context (24kHz for Gemini output)
   */
  private initializePlaybackContext(): void {
    if (!this.playbackContext) {
      this.playbackContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )({ sampleRate: AUDIO_CONFIG.OUTPUT_SAMPLE_RATE });
      // console.log("Audio playback context initialized (24kHz output)");
    }
  }

  /**
   * Decodes base64 PCM audio from Gemini and schedules sequential playback
   */
  playAudio(base64Audio: string): void {
    try {
      if (!this.playbackContext) {
        this.initializePlaybackContext();
      }

      const ctx = this.playbackContext!;

      // Decode base64 to binary
      const binary = atob(base64Audio);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }

      // Convert PCM16 to Float32
      const float32Array = new Float32Array(array.length / 2);
      const dataView = new DataView(array.buffer);
      for (let i = 0; i < float32Array.length; i++) {
        float32Array[i] = dataView.getInt16(i * 2, true) / 32768;
      }

      // Create audio buffer
      const audioBuffer = ctx.createBuffer(
        1,
        float32Array.length,
        AUDIO_CONFIG.OUTPUT_SAMPLE_RATE
      );
      audioBuffer.getChannelData(0).set(float32Array);

      // Schedule playback
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const currTime = ctx.currentTime;
      if (this.nextPlayTime < currTime) {
        this.nextPlayTime = currTime;
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.scheduledNodes.push(source);

      source.onended = () => {
        this.scheduledNodes = this.scheduledNodes.filter((n) => n !== source);
      };
    } catch (error) {
      // console.error("Failed to play audio:", error);
    }
  }

  /**
   * Stops all scheduled audio playback (for interruptions)
   */
  interruptPlayback(): void {
    this.scheduledNodes.forEach((node) => {
      try {
        node.stop();
      } catch (error) {
        // console.warn("Failed to stop audio node:", error);
      }
    });

    this.scheduledNodes = [];
    this.nextPlayTime = 0;
  }

  /**
   * Resets playback timer when all audio finishes naturally
   */
  resetIfEmpty(): void {
    if (this.scheduledNodes.length === 0) {
      this.nextPlayTime = 0;
    }
  }

  /**
   * Cleanup all audio resources
   */
  cleanup(): void {
    this.interruptPlayback();
    if (this.playbackContext) {
      this.playbackContext.close().catch(() => {});
      this.playbackContext = null;
    }
  }
}

/**
 * Converts PCM16 Int16Array to base64-encoded string
 */
export function convertPCM16ToBase64(pcm16: Int16Array): string {
  const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  const parts: string[] = [];
  const CHUNK = 0x2000; // 8KB (safer across browsers)

  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    // eslint-disable-next-line prefer-spread
    parts.push(String.fromCharCode.apply(null, slice as unknown as number[]));
  }

  return btoa(parts.join(""));
}

/**
 * Converts Float32 audio samples to base64-encoded PCM16
 */
export function convertFloat32ToBase64PCM(inputData: Float32Array): string {
  const pcm16 = new Int16Array(inputData.length);
  for (let i = 0; i < inputData.length; i++) {
    const s = Math.max(-1, Math.min(1, inputData[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return convertPCM16ToBase64(pcm16);
}

/**
 * Calculates average amplitude for Voice Activity Detection
 */
export function calculateAudioAmplitude(inputData: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < inputData.length; i++) {
    sum += Math.abs(inputData[i]);
  }
  return sum / inputData.length;
}
