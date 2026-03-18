import { useRef, useState, useCallback } from "react"
import { GoogleGenAI, Modality } from "@google/genai"
import { useSocketContext } from "@/context/SocketContext"
import { SessionService } from "@/features/session/services/session.service"

type ScenarioType = "technical" | "background" | "culture"

export const useGeminiLive = (sessionId: string, scenarioType?: ScenarioType) => {
  const sessionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const inputAudioContextRef = useRef<AudioContext | null>(null)
  const audioQueueRef = useRef<AudioBuffer[]>([])
  const isPlayingRef = useRef(false)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const micGainNodeRef = useRef<GainNode | null>(null)
  const pendingUserTranscriptRef = useRef<string>("")
  const pendingAssistantTranscriptRef = useRef<string>("")
  const lastSavedUserTranscriptRef = useRef<string>("")
  const lastSavedAssistantTranscriptRef = useRef<string>("")
  const receivedAudioThisTurnRef = useRef(false)
  const hasEverReceivedAudioRef = useRef(false)
  const vadRef = useRef<{
    isSpeaking: boolean
    lastLoudAtMs: number
    activityStarted: boolean
  }>({ isSpeaking: false, lastLoudAtMs: 0, activityStarted: false })

  const [isConnected, setIsConnected] = useState(false)
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [isUserSpeaking, setIsUserSpeaking] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isMicActive, setIsMicActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { socket } = useSocketContext()

  const ensureAudioContextRunning = useCallback(async () => {
    const ctx = audioContextRef.current
    if (!ctx) return
    if (ctx.state === "running") return
    try {
      await ctx.resume()
    } catch {
      // Autoplay policies may block resume until a user gesture; retry on mic click.
    }
  }, [])

  const speakFallback = useCallback((text: string) => {
    if (typeof window === "undefined") return
    if (isMuted) return
    if (!("speechSynthesis" in window)) return

    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1
      utterance.pitch = 1
      utterance.onstart = () => setIsModelSpeaking(true)
      utterance.onend = () => setIsModelSpeaking(false)
      utterance.onerror = () => setIsModelSpeaking(false)
      window.speechSynthesis.speak(utterance)
    } catch {
      // ignore
    }
  }, [isMuted])

  const playAudioChunk = async (base64Data: string) => {
    if (!audioContextRef.current) return
    await ensureAudioContextRunning()
    if (audioContextRef.current.state !== "running") return

    const raw = atob(base64Data)
    const pcm = new Int16Array(raw.length / 2)
    for (let i = 0; i < pcm.length; i++) {
      pcm[i] = (raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8))
    }

    const float32 = new Float32Array(pcm.length)
    for (let i = 0; i < pcm.length; i++) {
      float32[i] = pcm[i] / 32768.0
    }

    const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000)
    audioBuffer.getChannelData(0).set(float32)
    audioQueueRef.current.push(audioBuffer)
    playNextChunk()
  }

  const playNextChunk = () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return
    if (!audioContextRef.current || !gainNodeRef.current) return
    if (audioContextRef.current.state !== "running") return

    isPlayingRef.current = true
    setIsModelSpeaking(true)

    const buffer = audioQueueRef.current.shift()!
    const source = audioContextRef.current.createBufferSource()
    source.buffer = buffer
    source.connect(gainNodeRef.current)
    
    source.onended = () => {
      isPlayingRef.current = false
      if (audioQueueRef.current.length > 0) {
        playNextChunk()
      } else {
        setIsModelSpeaking(false)
      }
    }
    source.start(0)
  }

  const interrupt = useCallback(() => {
    audioQueueRef.current = []
    isPlayingRef.current = false
    setIsModelSpeaking(false)
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        // ignore
      }
    }
  }, [])

  const handleMessage = useCallback((message: any) => {
    const data = message.data ?? message

    if (data?.serverContent?.modelTurn?.parts) {
      for (const part of data.serverContent.modelTurn.parts) {
        const hasInline = !!part?.inlineData?.data
        const mt = part?.inlineData?.mimeType as string | undefined
        // Docs show audio comes in inlineData; mimeType may be omitted in some responses.
        const looksLikeAudio = !mt || mt.startsWith("audio/")
        if (hasInline && looksLikeAudio) {
          receivedAudioThisTurnRef.current = true
          hasEverReceivedAudioRef.current = true
          playAudioChunk(part.inlineData.data)
        }
      }
    }

    if (data?.serverContent?.outputTranscription?.text) {
      pendingAssistantTranscriptRef.current = data.serverContent.outputTranscription.text
      setIsModelSpeaking(true)
    }

    if (data?.serverContent?.inputTranscription?.text) {
      pendingUserTranscriptRef.current = data.serverContent.inputTranscription.text
    }

    if (data?.serverContent?.turnComplete) {
      const userText = pendingUserTranscriptRef.current?.trim()
      if (userText && userText !== lastSavedUserTranscriptRef.current) {
        socket?.emit("save_message", { sessionId, role: "user", content: userText })
        lastSavedUserTranscriptRef.current = userText
      }

      const assistantText = pendingAssistantTranscriptRef.current?.trim()
      if (assistantText && assistantText !== lastSavedAssistantTranscriptRef.current) {
        socket?.emit("save_message", { sessionId, role: "assistant", content: assistantText })
        lastSavedAssistantTranscriptRef.current = assistantText
      }

      // If the Live API isn't returning audio chunks, fall back to browser TTS so the user still hears a response.
      // This also helps when autoplay policies block WebAudio playback.
      if (assistantText && !receivedAudioThisTurnRef.current && audioQueueRef.current.length === 0) {
        speakFallback(assistantText)
      }

      pendingUserTranscriptRef.current = ""
      pendingAssistantTranscriptRef.current = ""
      receivedAudioThisTurnRef.current = false
      setIsModelSpeaking(false)
      setIsUserSpeaking(false)
    }
  }, [sessionId, socket])

  const startInterview = useCallback(async () => {
    if (!sessionRef.current) throw new Error("Not connected")
    try {
      sessionRef.current.sendClientContent({
        turns: [{ role: "user", parts: [{ text: "Start the interview now. Ask your first question." }] }],
        turnComplete: true,
      })
    } catch (e: any) {
      setError(e?.message ?? "Failed to start interview")
      throw e
    }
  }, [])

  const connect = useCallback(async () => {
    try {
      if (sessionRef.current) return
      if (!scenarioType) {
        throw new Error("Missing scenarioType")
      }

      audioContextRef.current = new AudioContext({ sampleRate: 24000 })
      await ensureAudioContextRunning()
      
      const gainNode = audioContextRef.current.createGain()
      gainNode.gain.value = 1
      gainNodeRef.current = gainNode
      gainNodeRef.current.connect(audioContextRef.current.destination)

      const liveTokenRes = await SessionService.getLiveToken(sessionId, scenarioType)
      const liveToken = liveTokenRes.data?.token
      const model = liveTokenRes.data?.model
      if (!liveToken) {
        throw new Error("Failed to get live token")
      }

      const ai = new GoogleGenAI({
        // Ephemeral auth token generated by backend (do not expose real API key to browser).
        apiKey: liveToken,
        httpOptions: { apiVersion: "v1alpha" },
      })

      const session = await ai.live.connect({
        model: model ?? "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          // Use client-side VAD + explicit activityStart/activityEnd so the model reliably takes turns.
          // (Matches the current Live API docs; auto-VAD can get stuck if background noise never reaches "silence".)
          realtimeInputConfig: {
            automaticActivityDetection: { disabled: true },
          },
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true)
          },
          onmessage: handleMessage,
          onerror: (e: any) => {
            setError(e.message ?? "Connection error")
          },
          onclose: () => {
            setIsConnected(false)
          },
        },
      })

      sessionRef.current = session
    } catch (e: any) {
      setError(e.message ?? "Failed to connect")
    }
  }, [handleMessage, scenarioType, sessionId, ensureAudioContextRunning])

  const startMic = useCallback(async () => {
    if (isMicActive) return

    try {
      // User gesture path: resume output context so TTS playback isn't blocked by autoplay policies.
      await ensureAudioContextRunning()

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      })
      streamRef.current = stream

      inputAudioContextRef.current?.close().catch(() => {})
      inputAudioContextRef.current = null

      const inputCtx = new AudioContext({ sampleRate: 16000 })
      inputAudioContextRef.current = inputCtx
      try {
        if (inputCtx.state !== "running") await inputCtx.resume()
      } catch {
        // ignore
      }
      const source = inputCtx.createMediaStreamSource(stream)
      const processor = inputCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      const micGain = inputCtx.createGain()
      micGain.gain.value = 1
      micGainNodeRef.current = micGain

      processor.onaudioprocess = (e) => {
        if (!sessionRef.current) return
        const float32 = e.inputBuffer.getChannelData(0)

        // Simple client-side VAD (RMS). Tune if needed.
        let sum = 0
        for (let i = 0; i < float32.length; i++) {
          const v = float32[i]
          sum += v * v
        }
        const rms = Math.sqrt(sum / float32.length)
        const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now()
        const THRESHOLD = 0.012
        const SILENCE_MS = 700

        const isLoud = rms >= THRESHOLD
        if (isLoud) {
          vadRef.current.lastLoudAtMs = nowMs
        }

        if (!vadRef.current.activityStarted && isLoud) {
          vadRef.current.activityStarted = true
          vadRef.current.isSpeaking = true
          setIsUserSpeaking(true)
          try {
            sessionRef.current.sendRealtimeInput({ activityStart: {} })
          } catch {
            // ignore
          }
        }

        // While in an "activity", keep sending audio chunks (including short silence tail)
        // until we decide the user stopped speaking.
        const inActivity = vadRef.current.activityStarted
        if (!inActivity) return

        const int16 = new Int16Array(float32.length)
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768))
        }

        const bytes = new Uint8Array(int16.buffer)
        let binary = ""
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        const base64 = btoa(binary)

        sessionRef.current.sendRealtimeInput({
          audio: { data: base64, mimeType: "audio/pcm;rate=16000" },
        })

        if (vadRef.current.isSpeaking && !isLoud && nowMs - vadRef.current.lastLoudAtMs > SILENCE_MS) {
          vadRef.current.isSpeaking = false
          vadRef.current.activityStarted = false
          setIsUserSpeaking(false)
          try {
            sessionRef.current.sendRealtimeInput({ activityEnd: {} })
          } catch {
            // ignore
          }
        }
      }

      source.connect(micGain)
      micGain.connect(processor)
      processor.connect(inputCtx.destination)
      
      setIsMicActive(true)
    } catch (e: any) {
      setError(e.message ?? "Microphone access denied")
    }
  }, [isMicActive, ensureAudioContextRunning])

  const stopMic = useCallback(() => {
    vadRef.current.isSpeaking = false
    vadRef.current.lastLoudAtMs = 0
    vadRef.current.activityStarted = false
    processorRef.current?.disconnect()
    processorRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    inputAudioContextRef.current?.close().catch(() => {})
    inputAudioContextRef.current = null
    setIsUserSpeaking(false)
    setIsMicActive(false)
  }, [])

  const toggleMute = useCallback(() => {
    if (!gainNodeRef.current) return
    ensureAudioContextRunning()
    const newMuted = !isMuted
    gainNodeRef.current.gain.value = newMuted ? 0 : 1
    setIsMuted(newMuted)
  }, [isMuted, ensureAudioContextRunning])

  const disconnect = useCallback(() => {
    interrupt()
    stopMic()
    sessionRef.current?.close()
    sessionRef.current = null
    audioContextRef.current?.close()
    audioContextRef.current = null
    setIsConnected(false)
  }, [interrupt, stopMic])

  return {
    connect,
    startInterview,
    disconnect,
    interrupt,
    startMic,
    stopMic,
    toggleMute,
    isConnected,
    isModelSpeaking,
    isUserSpeaking,
    isMuted,
    isMicActive,
    hasAudio: hasEverReceivedAudioRef.current,
    error,
  }
}
