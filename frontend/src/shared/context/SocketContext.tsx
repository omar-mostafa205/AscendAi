import React, { createContext, useContext, useEffect, useState } from "react"
import { io, Socket } from "socket.io-client"
import { supabase } from "@/shared/lib/supabase"
import { toast } from "sonner"

type SocketContextType = {
  socket: Socket | null
}

const SocketContext = createContext<SocketContextType | null>(null)

export const useSocketContext = () => {
  const context = useContext(SocketContext)
  if (!context) throw new Error("useSocketContext must be used within a SocketProvider")
  return context
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    let ignore = false
    let current: Socket | null = null
    const rawSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8001"
    const socketUrl = rawSocketUrl
      .replace(/^wss:\/\//i, "https://")
      .replace(/^ws:\/\//i, "http://")

    const connect = async (accessToken: string) => {
      if (ignore) return
      if (current) {
        (current as any).auth = { token: accessToken }
        if (!current.connected) {
          try {
            current.connect()
          } catch {
          }
        }
        return
      }

      current = io(socketUrl, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10,
        auth: { token: accessToken },
      })

      current.on("connect_error", (error) => {
        console.error("Socket connection error", error)
      })

      current.on("error", ({ message }: { message: string }) => {
        console.error("Socket error", message)
      })

      setSocket(current)
    }

    const disconnect = () => {
      if (current) current.disconnect()
      current = null
      setSocket(null)
    }

    supabase.auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token
      if (accessToken) connect(accessToken)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const accessToken = session?.access_token
      if (accessToken) connect(accessToken)
      else disconnect()
    })

    return () => {
      ignore = true
      listener.subscription.unsubscribe()
      disconnect()
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  )
}
