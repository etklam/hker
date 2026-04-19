'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { AuthUser, SessionResponse } from './types'
import { api } from './api-client'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (input: { email: string; password: string }) => Promise<void>
  register: (input: { email: string; password: string; displayName?: string }) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const session = await api<SessionResponse>('/api/auth/session')
      setUser(session.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const login = useCallback(async (input: { email: string; password: string }) => {
    const session = await api<SessionResponse>('/api/auth/login', {
      method: 'POST',
      body: input,
    })
    setUser(session.user)
  }, [])

  const register = useCallback(async (input: { email: string; password: string; displayName?: string }) => {
    const session = await api<SessionResponse>('/api/auth/register', {
      method: 'POST',
      body: input,
    })
    setUser(session.user)
  }, [])

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
