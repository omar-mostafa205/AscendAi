/**
 * Gemini Audio Processor - Runs in the Audio Thread
 * Handles real-time audio capture, VAD, and format conversion
 */
class GeminiAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Voice Activity Detection state
    this.lastVoiceAt = 0;
    this.isUserSpeaking = false;
    this.speakingStartedAt = 0;
    this.voiceFrames = 0;

    // Configuration (matches your AUDIO_CONFIG)
    this.SPEECH_ON_THRESHOLD = 0.02;
    this.SPEECH_OFF_THRESHOLD = 0.012;
    this.SILENCE_DURATION_MS = 900;
    this.MAX_SPEECH_MS = 15000;
    // Require a few consecutive frames over the threshold before starting speech.
    // Reduces false positives from keyboard/mic noise.
    this.VOICE_FRAMES_REQUIRED = 3;

    // Chunking: avoid posting/sending every render quantum
    // 640 samples @ 16kHz ≈ 40ms per chunk (good latency/overhead balance)
    this.CHUNK_SAMPLES = 640;
    this.chunkWriteIndex = 0;
    this.chunkAmplitudeMax = 0;
    this.chunkBuffer = new Int16Array(this.CHUNK_SAMPLES);

    // Listen for messages from main thread
    this.port.onmessage = (event) => {
      const { type } = event.data;

      if (type === "updateConfig") {
        // Allow main thread to update thresholds
        const { speechOnThreshold, speechOffThreshold, silenceDuration } =
          event.data;
        if (speechOnThreshold !== undefined)
          this.SPEECH_ON_THRESHOLD = speechOnThreshold;
        if (speechOffThreshold !== undefined)
          this.SPEECH_OFF_THRESHOLD = speechOffThreshold;
        if (silenceDuration !== undefined)
          this.SILENCE_DURATION_MS = silenceDuration;
      }
    };
  }

  /**
   * Main processing function - called for every 128 samples
   * @param {Float32Array[][]} inputs - Input audio data
   * @param {Float32Array[][]} outputs - Output audio data (unused)
   * @param {Object} parameters - Audio parameters
   * @returns {boolean} - true to keep processor alive
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];

    // No input or no channel data
    if (!input || !input[0] || input[0].length === 0) {
      return true; // Keep processor alive
    }

    const inputData = input[0]; // Float32Array of 128 samples
    const now = currentTime * 1000; // Convert to milliseconds

    // ────────────────────────────────────────────────────────────────
    // 1. Calculate Amplitude (for Voice Activity Detection)
    // ────────────────────────────────────────────────────────────────
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += Math.abs(inputData[i]);
    }
    const amplitude = sum / inputData.length;

    // ────────────────────────────────────────────────────────────────
    // 2. Voice Activity Detection - START
    // ────────────────────────────────────────────────────────────────
    if (amplitude >= this.SPEECH_ON_THRESHOLD) {
      this.lastVoiceAt = now;
      this.voiceFrames = Math.min(this.VOICE_FRAMES_REQUIRED, this.voiceFrames + 1);

      if (!this.isUserSpeaking) {
        if (this.voiceFrames >= this.VOICE_FRAMES_REQUIRED) {
          this.isUserSpeaking = true;
          this.speakingStartedAt = now;
          this.port.postMessage({ type: "vad", vadEvent: "started", timestamp: now });
        }
      }
    } else {
      this.voiceFrames = 0;
    }

    // ────────────────────────────────────────────────────────────────
    // 3. Voice Activity Detection - STOP
    // ────────────────────────────────────────────────────────────────
    if (this.isUserSpeaking) {
      const isSilentEnough = amplitude <= this.SPEECH_OFF_THRESHOLD;
      const silenceDuration = now - this.lastVoiceAt;
      const speakingDuration = now - this.speakingStartedAt;

      if (
        isSilentEnough &&
        this.lastVoiceAt > 0 &&
        silenceDuration >= this.SILENCE_DURATION_MS
      ) {
        this.isUserSpeaking = false;
        this.port.postMessage({ type: "vad", vadEvent: "stopped", timestamp: now });
      } else if (this.speakingStartedAt > 0 && speakingDuration >= this.MAX_SPEECH_MS) {
        this.isUserSpeaking = false;
        this.port.postMessage({ type: "vad", vadEvent: "stopped", timestamp: now, forced: true });
      }
    }

    // ────────────────────────────────────────────────────────────────
    // 4. Convert Float32 → PCM16 (Int16)
    // ────────────────────────────────────────────────────────────────
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      this.chunkBuffer[this.chunkWriteIndex++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.chunkWriteIndex >= this.CHUNK_SAMPLES) {
        break;
      }
    }
    this.chunkAmplitudeMax = Math.max(this.chunkAmplitudeMax, amplitude);

    // ────────────────────────────────────────────────────────────────
    // 5. Send Data to Main Thread
    // ────────────────────────────────────────────────────────────────
    if (this.chunkWriteIndex >= this.CHUNK_SAMPLES) {
      const chunk = this.chunkBuffer;
      const amp = this.chunkAmplitudeMax;
      const isUserSpeaking = this.isUserSpeaking;

      // Reset chunk state before transferring
      this.chunkBuffer = new Int16Array(this.CHUNK_SAMPLES);
      this.chunkWriteIndex = 0;
      this.chunkAmplitudeMax = 0;

      this.port.postMessage(
        {
          type: "audioData",
          pcm16: chunk,
          amplitude: amp,
          timestamp: now,
          isUserSpeaking: isUserSpeaking,
        },
        [chunk.buffer]
      );
    }

    return true; // Keep processor alive
  }
}

registerProcessor("gemini-audio-processor", GeminiAudioProcessor);
