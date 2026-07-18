import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import {
  loadMembership,
  signOut as doSignOut,
  cacheMembership,
  readCachedMembership,
} from '../services/authService.js'

const AuthContext = createContext(null)

// Provedor de sessao. Usa o supabaseClient (a sessao persiste sozinha no
// localStorage do supabase-js, o que combina com a operacao offline). Alem
// da sessao, resolve o vinculo do usuario (tenant + papel) pela tabela membros.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [membership, setMembership] = useState(null)
  const [loading, setLoading] = useState(true)

  // Resolve o vinculo do usuario. A distincao que importa (#73):
  //
  // - servidor respondeu -> essa e a verdade, inclusive o `null` de "ainda nao
  //   tem barraca"; atualiza o cache local (e apaga se nao ha mais vinculo).
  // - servidor NAO respondeu (sem sinal na praia) -> isso nao e resposta, e
  //   ausencia dela. Cai no ultimo vinculo conhecido para o app continuar
  //   abrindo no Caixa, com o cache de pedidos e a fila de sync no lugar.
  const refreshMembership = useCallback(async (currentUserId) => {
    if (!isSupabaseConfigured) {
      setMembership(null)
      return null
    }
    const userId = currentUserId || null
    try {
      const m = await loadMembership()
      cacheMembership(userId, m)
      setMembership(m)
      return m
    } catch {
      const cached = readCachedMembership(userId)
      setMembership(cached)
      return cached
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
      if (data.session) await refreshMembership(data.session.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!active) return
      setSession(s)
      if (s) await refreshMembership(s.user.id)
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
