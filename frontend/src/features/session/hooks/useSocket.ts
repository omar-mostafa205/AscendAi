import { useEffect, useState, useCallback } from "react"
import { useSocketContext } from "@/context/SocketContext"

export const useSocket = (sessionId: string) => {
  const { socket } = useSocketContext()
  const [sessionJoined, setSessionJoined] = useState(false)
  const [isEnded, setIsEnded] = useState(false)

  useEffect(() => {
    if (!socket || !sessionId) return

    const handleSessionJoined = (data: { sessionId: string }) => {
      if (data.sessionId === sessionId) {
        setSessionJoined(true)
      }
    }

    const handleSessionEnded = (data: { sessionId: string }) => {
      if (data.sessionId === sessionId) {
        setSessionJoined(false)
        setIsEnded(true)
      }
    }

    const handleError = (data: { message: string }) => {
      console.error("Socket error:", data.message)
    }

    socket.on("session_joined", handleSessionJoined)
    socket.on("session_ended", handleSessionEnded)
    socket.on("error", handleError)

    socket.emit("join_session", { sessionId })

    return () => {
      socket.off("session_joined", handleSessionJoined)
      socket.off("session_ended", handleSessionEnded)
      socket.off("error", handleError)
      socket.emit("leave_session", sessionId)
    }
  }, [socket, sessionId])

  const saveMessage = useCallback((role: "user" | "assistant", content: string) => {
    if (!socket || !sessionId) return
    socket.emit("save_message", { sessionId, role, content })
  }, [socket, sessionId])

  const endSession = useCallback(() => {
    if (!socket || !sessionId) return
    socket.emit("end_session", { sessionId })
  }, [socket, sessionId])

  return {
    sessionJoined,
    isEnded,
    saveMessage,
    endSession,
  }
}