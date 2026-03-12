import { useCallback, useEffect, useRef, useState } from "react"
import { Room, RoomEvent, Track, RemoteTrack } from "livekit-client"
import { useSocketContext } from "@/context/SocketContext"
import { useParams } from "next/navigation"

// Simple, predictable implementation:
// - User holds/taps mic button to record.
// - We send exactly one self-contained blob to the backend (WebM/Opus).
// This avoids VAD chunking edge cases and keeps STT reliable.
export const useLiveKit = (token: string | null, enabled: boolean) => {
  const roomRef = useRef<Room | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isTalking, setIsTalking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { socket } = useSocketContext()
  const params = useParams()
  const sessionId = params?.id as string

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!token || !enabled) return
    const livekitUrl =
      process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://ascendai-edlboend.livekit.cloud"

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    })

    roomRef.current = room

    room.on(RoomEvent.Connected, () => setIsConnected(true))
    room.on(RoomEvent.Disconnected, () => setIsConnected(false))

    // Play remote audio tracks (if/when LiveKit is used for AI voice).
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        const audioEl = track.attach()
        audioEl.id = "ai-audio"
        document.getElementById("ai-audio")?.remove()
        document.body.appendChild(audioEl)
      }
    })

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      track.detach()
      document.getElementById("ai-audio")?.remove()
    })

    room
      .connect(livekitUrl, token)
      .then(() => {
        // Not used for STT capture; keep disabled.
        room.localParticipant.setMicrophoneEnabled(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Connection failed")
      })

    return () => {
      try {
        mediaRecorderRef.current?.stop()
      } catch {
        // ignore
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      chunksRef.current = []
      room.disconnect()
      document.getElementById("ai-audio")?.remove()
      roomRef.current = null
    }
  }, [token, enabled])

  const startTalking = useCallback(async () => {
    if (isTalking) return
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream
      chunksRef.current = []

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm"

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        try {
          const sId = sessionId
          const sock = socket
          if (!sId || !sock) return
          if (chunksRef.current.length === 0) return

          const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
          const ab = await blob.arrayBuffer()
          sock.emit("user_answer", {
            sessionId: sId,
            audioBuffer: ab,
            mimeType: recorder.mimeType,
          })
        } finally {
          streamRef.current?.getTracks().forEach((t) => t.stop())
          streamRef.current = null
          chunksRef.current = []
          mediaRecorderRef.current = null
          setIsTalking(false)
        }
      }

      recorder.start()
      setIsTalking(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access denied")
      setIsTalking(false)
    }
  }, [isTalking, sessionId, socket])

  const stopTalking = useCallback(async () => {
    if (!isTalking) return
    const rec = mediaRecorderRef.current
    if (rec && rec.state !== "inactive") {
      try {
        rec.requestData()
      } catch {
        // ignore
      }
      try {
        rec.stop()
      } catch {
        // ignore
      }
    } else {
      setIsTalking(false)
    }
  }, [isTalking])

  const disconnect = useCallback(async () => {
    try {
      await stopTalking()
    } catch {
      // ignore
    }
    roomRef.current?.disconnect()
    roomRef.current = null
  }, [stopTalking])

  return { isConnected, isTalking, error, startTalking, stopTalking, disconnect }
}

