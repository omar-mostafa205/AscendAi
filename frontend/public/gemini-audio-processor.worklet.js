class GeminiAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.lastVoiceAt = 0;
    this.isUserSpeaking = false;
    this.speakingStartedAt = 0;
    this.voiceFrames = 0;

    this.SPEECH_ON_THRESHOLD = 0.07;
    this.SPEECH_OFF_THRESHOLD = 0.03;
    this.SILENCE_DURATION_MS = 1600;

    this.MAX_SPEECH_MS = 15000;

    this.VOICE_FRAMES_REQUIRED = 2;

    this.CHUNK_SAMPLES = 640;
    this.chunkWriteIndex = 0;
    this.chunkAmplitudeMax = 0;
    this.chunkBuffer = new Int16Array(this.CHUNK_SAMPLES);
    this.configReceived = false;

    this.port.onmessage = (event) => {
      const { type } = event.data;

      if (type === "updateConfig") {
        const { speechOnThreshold, speechOffThreshold, silenceDuration } =
          event.data;
        if (speechOnThreshold !== undefined)
          this.SPEECH_ON_THRESHOLD = speechOnThreshold;
        if (speechOffThreshold !== undefined)
          this.SPEECH_OFF_THRESHOLD = speechOffThreshold;
        if (silenceDuration !== undefined)
          this.SILENCE_DURATION_MS = silenceDuration;
        this.configReceived = true;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const inputData = input[0];
    const now = currentTime * 1000;

    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += Math.abs(inputData[i]);
    }
    const amplitude = sum / inputData.length;

    if (amplitude >= this.SPEECH_ON_THRESHOLD) {
      this.lastVoiceAt = now;
      this.voiceFrames = Math.min(
        this.VOICE_FRAMES_REQUIRED,
        this.voiceFrames + 1
      );

      if (
        !this.isUserSpeaking &&
        this.voiceFrames >= this.VOICE_FRAMES_REQUIRED
      ) {
        this.isUserSpeaking = true;
        this.speakingStartedAt = now;
        this.port.postMessage({
          type: "vad",
          vadEvent: "started",
          timestamp: now,
        });
      }
    } else {
      this.voiceFrames = Math.max(0, this.voiceFrames - 1);
    }

    if (this.isUserSpeaking) {
      const silenceDuration = now - this.lastVoiceAt;
      const speakingDuration = now - this.speakingStartedAt;

      if (
        amplitude <= this.SPEECH_OFF_THRESHOLD &&
        this.lastVoiceAt > 0 &&
        silenceDuration >= this.SILENCE_DURATION_MS
      ) {
        this.isUserSpeaking = false;
        this.voiceFrames = 0;
        this.port.postMessage({
          type: "vad",
          vadEvent: "stopped",
          timestamp: now,
        });
      } else if (
        this.speakingStartedAt > 0 &&
        speakingDuration >= this.MAX_SPEECH_MS
      ) {
        this.isUserSpeaking = false;
        this.voiceFrames = 0;
        this.port.postMessage({
          type: "vad",
          vadEvent: "stopped",
          timestamp: now,
          forced: true,
        });
      }
    }

    // ──────────────────────────────────────────────────────────────
    // 4. Convert Float32 → PCM16
    // ──────────────────────────────────────────────────────────────
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      this.chunkBuffer[this.chunkWriteIndex++] =
        s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.chunkWriteIndex >= this.CHUNK_SAMPLES) break;
    }
    this.chunkAmplitudeMax = Math.max(this.chunkAmplitudeMax, amplitude);

    // ──────────────────────────────────────────────────────────────
    // 5. Send chunk to main thread when buffer is full
    // ──────────────────────────────────────────────────────────────
    if (this.chunkWriteIndex >= this.CHUNK_SAMPLES) {
      const chunk = this.chunkBuffer;
      const amp = this.chunkAmplitudeMax;
      const isUserSpeaking = this.isUserSpeaking;

      this.chunkBuffer = new Int16Array(this.CHUNK_SAMPLES);
      this.chunkWriteIndex = 0;
      this.chunkAmplitudeMax = 0;

      this.port.postMessage(
        {
          type: "audioData",
          pcm16: chunk,
          amplitude: amp,
          timestamp: now,
          isUserSpeaking,
        },
        [chunk.buffer]
      );
    }

    return true;
  }
}

registerProcessor("gemini-audio-processor", GeminiAudioProcessor);
