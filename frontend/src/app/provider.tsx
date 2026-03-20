"use client"
import { Toaster } from '@/shared/components/AppToaster'
import { AuthProvider } from '@/shared/context/AuthContext'
import { SocketProvider } from "@/shared/context/SocketContext"
import { queryClient } from '@/shared/lib/query/query.client'
import { QueryClientProvider } from '@tanstack/react-query'
import React, { ReactNode } from 'react'

const AppProviders = ({children} : {children : ReactNode}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          {children}
          <Toaster />
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default AppProviders
