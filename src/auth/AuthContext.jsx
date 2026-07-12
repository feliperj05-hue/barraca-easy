import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { loadMembership, signOut as doSignOut } from '../services/authService.js'

const AuthContext = createContext(null)

// Provedor de sessao. Usa o supabaseClient (a sessao persiste sozinha no
// localStorage do supabase-js, o que combina com a operacao offline). Alem
// da sessao, resolve o vinculo do usuario (tenant + papel) pela tabela membros.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [membership, setMembership] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshMembership = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setMembership(null)
      return null
    }
    try {
      const m = await loadMembership()
      setMembership(m)
      return m
    } catch {
      setMembership(null)
      return null
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) await refreshMembership()
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!active) return
      setSession(s)
      if (s) await refreshMembership()
      else setMembership(null)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [refreshMembership])

  const value = {
    loading,
    session,
    user: session ? session.user : null,
    membership,
    role: membership ? membership.papel : null,
    refreshMembership,
    signOut: doSignOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
