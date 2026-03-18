import React, { createContext, useContext, useEffect, useState } from "react"
import { io, Socket } from "socket.io-client"
import { supabase } from "@/lib/supabase"
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
    let cancelled = false
    let current: Socket | null = null
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8000"

    const connect = async (accessToken: string) => {
      if (cancelled) return
      // Important: do NOT disconnect/recreate the socket on token refresh or tab switches.
      // Recreating the socket causes "transport close" and forces the session to re-join.
      if (current) {
        // Update auth for future reconnect handshakes.
        ;(current as any).auth = { token: accessToken }
        if (!current.connected) {
          try {
            current.connect()
          } catch {
            // ignore
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
        toast.error("Connection error. Retrying...")
      })

      current.on("error", ({ message }: { message: string }) => {
        toast.error(message)
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
      cancelled = true
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
