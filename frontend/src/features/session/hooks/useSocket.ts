import { useCallback, useEffect, useRef, useState } from "react"
import { useSocketContext } from "@/context/SocketContext"

export const useSocket = (sessionId: string) => {
  const { socket } = useSocketContext()
  const [sessionJoined, setSessionJoined] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [aiText, setAiText] = useState("")
  const [isEnded, setIsEnded] = useState(false)
  const lastAudioUrlRef = useRef<string | null>(null)

  const setAndPlayAudio = useCallback((audio: any) => {
    try {
      let audioBytes: Uint8Array | null = null
      if (typeof audio === "string") {
        const bin = atob(audio)
        const arr = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
        audioBytes = arr
      } else if (Array.isArray(audio)) {
        audioBytes = new Uint8Array(audio)
      } else if (audio?.type === "Buffer" && Array.isArray(audio.data)) {
        audioBytes = new Uint8Array(audio.data)
      } else if (audio?.data && Array.isArray(audio.data)) {
        audioBytes = new Uint8Array(audio.data)
      } else if (audio instanceof ArrayBuffer) {
        audioBytes = new Uint8Array(audio)
      }

      if (!audioBytes || audioBytes.length === 0) return

      // Ensure we have an ArrayBuffer-backed view (not SharedArrayBuffer) for Blob compatibility.
      const safeBytes = new Uint8Array(audioBytes)
      const blob = new Blob([safeBytes.buffer], { type: "audio/mpeg" })
      const url = URL.createObjectURL(blob)

      if (lastAudioUrlRef.current) URL.revokeObjectURL(lastAudioUrlRef.current)
      lastAudioUrlRef.current = url

      const audioObj = new Audio(url)
      audioObj.play().catch((e) => console.error("Audio play blocked/failed", e))
    } catch (e) {
      console.error("Failed to decode/play AI audio", e)
    }
  }, [])

  const playLastAudio = useCallback(() => {
    const url = lastAudioUrlRef.current
    if (!url) return
    const audioObj = new Audio(url)
    audioObj.play().catch((e) => console.error("Audio play blocked/failed", e))
  }, [])

  useEffect(() => {
    if (!socket || !sessionId) return

    socket.emit("join_session", { sessionId })

    socket.on("session_joined", () => setSessionJoined(true))

    socket.on("ai_thinking", () => {
      setIsThinking(true)
      setAiText("")
    })

    socket.on("ai_token", ({ token }: { token: string }) => {
      setIsThinking(false)
      setAiText((prev) => prev + token)
    })

    socket.on("ai_response", ({ text, audio }: { text: string; audio: any }) => {
      setIsThinking(false)
      if (text) setAiText(text)
      if (audio) setAndPlayAudio(audio)
    })

    socket.on("ai_audio", ({ audio }: { audio: any }) => {
      if (audio) setAndPlayAudio(audio)
    })

    socket.on("session_ended", () => setIsEnded(true))

    socket.on("error", ({ message }: { message: string }) => {
      console.error("Socket error", message)
    })

    return () => {
      socket.off("session_joined")
      socket.off("ai_thinking")
      socket.off("ai_token")
      socket.off("ai_response")
      socket.off("ai_audio")
      socket.off("session_ended")
      socket.off("error")

      if (lastAudioUrlRef.current) {
        URL.revokeObjectURL(lastAudioUrlRef.current)
        lastAudioUrlRef.current = null
      }
    }
  }, [socket, sessionId, setAndPlayAudio])
  const endSession = () => {
    socket?.emit("end_session", { sessionId })
  }

  return {
    sessionJoined,
    isThinking,
    aiText,
    isEnded,
    endSession,
    playLastAudio,
  }
}
