import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import { supabase, isSupabaseConfigured } from "../services/supabaseClient.js"
import {
  loadSubscription,
  readCachedSubscription,
  clearSubscriptionCache,
} from "../services/subscriptionService.js"
import {
  loadMembership,
  signOut as doSignOut,
  cacheMembership,
  readCachedMembership,
  resolveSession,
  readStoredSession,
} from "../services/authService.js"

const AuthContext = createContext(null)

// Provedor de sessao. Usa o supabaseClient (a sessao persiste sozinha no
// localStorage do supabase-js, o que combina com a operacao offline). Alem
// da sessao, resolve o vinculo do usuario (tenant + papel) pela tabela membros.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  // Sessao vencida que nao deu pra renovar por falta de rede (#75). O app
  // continua operando; so o que depende do servidor fica em espera.
  const [staleSession, setStaleSession] = useState(false)
  const [membership, setMembership] = useState(null)
  // Assinatura da barraca (#90). Vive junto do vinculo porque depende dele:
  // sem tenant resolvido nao ha assinatura para consultar.
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const resolving = useRef(false)
  // `refreshMembership` precisa disparar a assinatura, mas `refreshSubscription`
  // e declarado depois. A ref quebra o ciclo sem recriar os callbacks a cada
  // render (o que reassinaria os listeners de auth sem necessidade).
  const refreshSubscriptionRef = useRef(async () => null)

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
      if (m) refreshSubscriptionRef.current(m.tenantId)
      else setSubscription(null)
      return m
    } catch {
      const cached = readCachedMembership(userId)
      setMembership(cached)
      // Sem servidor, o status da assinatura sai do cache local: barraca em
      // dia nao pode parar so porque o sinal caiu.
      setSubscription(cached ? readCachedSubscription(cached.tenantId) : null)
      return cached
    }
  }, [])

  // Recarrega a assinatura do tenant atual. Nunca lanca: se o servidor nao
  // responder, o proprio servico ja cai no ultimo status conhecido, e um erro
  // aqui nao pode derrubar a arvore inteira do app.
  const refreshSubscription = useCallback(async (tenantId) => {
    if (!isSupabaseConfigured || !tenantId) {
      setSubscription(null)
      return null
    }
    const { sub } = await loadSubscription(tenantId)
    setSubscription(sub)
    return sub
  }, [])

  refreshSubscriptionRef.current = refreshSubscription

  // Espelho do estado degradado: os listeners de "voltou o sinal" leem daqui
  // para o efeito nao precisar reassinar a cada mudanca de estado.
  const staleRef = useRef(false)
  staleRef.current = staleSession

  // Resolve a sessao pelo caminho tolerante a falha de transporte (#75).
  const syncSession = useCallback(async () => {
    if (resolving.current) return
    resolving.current = true
    try {
      const { session: s, stale } = await resolveSession()
      setSession(s)
      setStaleSession(stale)
      if (s) await refreshMembership(s.user.id)
      else {
        setMembership(null)
        setSubscription(null)
      }
    } finally {
      resolving.current = false
    }
  }, [refreshMembership])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let active = true

    syncSession().then(() => {
      if (active) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!active) return
      if (s) {
        // Renovou (ou logou): saimos do modo degradado.
        setSession(s)
        setStaleSession(false)
        await refreshMembership(s.user.id)
        return
      }
      // Sessao nula vinda da lib. So aceitamos como "deslogado" se a
      // credencial tambem sumiu do storage — que e o que a lib faz num
      // signOut/refresh recusado de verdade. Se ela continua la, isso foi
      // falha de transporte e nao pode derrubar o operador (#75).
      const stored = readStoredSession()
      if (stored) {
        setSession(stored)
        setStaleSession(true)
        return
      }
      setSession(null)
      setStaleSession(false)
      setMembership(null)
      setSubscription(null)
      clearSubscriptionCache()
    })

    // Quando o sinal volta, tenta sair do modo degradado na hora em vez de
    // esperar o proximo tique de auto-refresh da lib.
    const retomar = () => {
      if (staleRef.current) syncSession()
    }
    const aoVoltarPraTela = () => {
      if (document.visibilityState === "visible") retomar()
    }
    window.addEventListener("online", retomar)
    document.addEventListener("visibilitychange", aoVoltarPraTela)

    return () => {
      active = false
      sub.subscription.unsubscribe()
      window.removeEventListener("online", retomar)
      document.removeEventListener("visibilitychange", aoVoltarPraTela)
    }
  }, [refreshMembership, syncSession])

  const value = {
    loading,
    session,
    staleSession,
    user: session ? session.user : null,
    membership,
    role: membership ? membership.papel : null,
    subscription,
    refreshMembership,
    refreshSubscription,
    signOut: doSignOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider")
  return ctx
}
