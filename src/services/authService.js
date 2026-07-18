// Servico de autenticacao e membros (Supabase Auth + tabela membros).
// Regras de negocio de auth ficam aqui; os componentes so chamam.
import { supabase } from './supabaseClient.js'

function requireClient() {
  if (!supabase) throw new Error('Supabase nao configurado.')
  return supabase
}

// --- Sessao ---

export async function signIn(email, password) {
  const { data, error } = await requireClient().auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw error
  return data
}

export async function signUp(email, password) {
  const { data, error } = await requireClient().auth.signUp({
    email: email.trim(),
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  // Limpa o vinculo em cache antes de sair: o proximo usuario deste aparelho
  // nao pode herdar o tenant do anterior (#73).
  clearMembershipCache()
  const { error } = await requireClient().auth.signOut()
  if (error) throw error
}

// Reenvia o e-mail de confirmacao (Confirm email ligado no projeto).
export async function resendConfirmation(email) {
  const { error } = await requireClient().auth.resend({
    type: 'signup',
    email: email.trim(),
  })
  if (error) throw error
}

// --- Sessao resiliente (#75) ---
//
// O degrau anterior ao vinculo do #73: a **sessao**. O access token do Supabase
// dura ~1h. Passado esse tempo com o tablet sem sinal, o supabase-js tenta
// renovar, o `fetch` estoura e o `getSession()` devolve `session: null` com um
// `AuthRetryableFetchError`. O portao lia esse `null` como "nao esta logado" e
// jogava o operador na tela de Login **sem internet para logar**. Barraca parada
// no meio do expediente.
//
// Comprovado empiricamente com a lib real (ver `npm run sessao-offline`):
// token vencido + rede morta -> `session: null` + `AuthRetryableFetchError`,
// mas **a credencial continua no localStorage**. A propria lib so apaga a
// sessao quando o erro NAO e de transporte (`_removeSession` em
// `_callRefreshToken` roda so no ramo nao-retryable). Ou seja: o dado pra
// continuar vendendo esta la; quem jogava fora era o nosso portao.
//
// Mesma regra da #73: **falha de transporte nao e resposta de negocio.**
// "Nao consegui renovar" nao e "sessao invalida".

// Erro de transporte: a resposta nao chegou. Nao confundir com o servidor
// dizendo "nao". `AuthRetryableFetchError` e o que a lib levanta quando o
// `fetch` do refresh falha; o resto cobre variacoes de mensagem e o caso do
// aparelho declaradamente offline.
export function isTransportFailure(err) {
  if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
    return true
  }
  if (!err) return false
  if (err.name === 'AuthRetryableFetchError') return true
  const msg = String(err.message || err)
  return /Failed to fetch|NetworkError|network|Load failed|ERR_INTERNET|timeout/i.test(msg)
}

// Le a sessao crua que o supabase-js persiste. A chave e derivada da URL do
// projeto pela propria lib e exposta em `client.storageKey` — usamos ela em vez
// de remontar a string, pra nao quebrar se a lib mudar o formato.
export function readStoredSession(client) {
  const c = client || supabase
  if (!c || !c.storageKey) return null
  try {
    const raw = localStorage.getItem(c.storageKey)
    if (!raw) return null
    const s = JSON.parse(raw)
    // So serve como credencial de trabalho se tiver o minimo: quem e o usuario
    // e com que token tentar renovar quando o sinal voltar.
    if (!s || !s.access_token || !s.refresh_token || !s.user || !s.user.id) return null
    return s
  } catch {
    return null
  }
}

// Resolve a sessao para o portao de auth.
//
//   { session, stale }
//
// - `stale: false` -> resposta confiavel (sessao viva, ou ausencia real dela).
// - `stale: true`  -> o token venceu e nao deu pra renovar por falta de rede;
//   seguimos com a ultima credencial conhecida em modo degradado. As escritas
//   vao pra fila offline e sobem quando a rede (e o token) voltarem.
export async function resolveSession(client) {
  const c = client || supabase
  if (!c) return { session: null, stale: false }
  const { data, error } = await c.auth.getSession()
  if (data && data.session) return { session: data.session, stale: false }
  // Sem sessao E sem resposta: a lib nao pode ter dito "voce nao esta logado",
  // porque ela nao falou com ninguem. Cai na credencial guardada, se houver.
  if (isTransportFailure(error)) {
    const stored = readStoredSession(c)
    if (stored) return { session: stored, stale: true }
  }
  // Servidor respondeu (ou nunca houve credencial): `null` aqui e verdade.
  return { session: null, stale: false }
}

// --- Cache local do vinculo (#73) ---
//
// Por que existe: o vinculo (tenant + papel) so vinha da rede e vivia no state
// do React. Abrir o app sem sinal fazia o `select` estourar, o vinculo virava
// `null` e o portao de auth confundia isso com "esse usuario nao tem barraca",
// jogando o operador na tela de Onboarding com a barraca funcionando e as
// vendas do dia no cache. Erro de transporte nao pode virar resposta de
// negocio. Guardamos por usuario porque um tablet pode trocar de dono.

const MEMBERSHIP_KEY = 'barracaEasyMembership'

function membershipStore() {
  try {
    return JSON.parse(localStorage.getItem(MEMBERSHIP_KEY) || '{}')
  } catch {
    return {}
  }
}

export function cacheMembership(userId, membership) {
  if (!userId) return
  try {
    const all = membershipStore()
    if (membership) all[userId] = membership
    else delete all[userId]
    localStorage.setItem(MEMBERSHIP_KEY, JSON.stringify(all))
  } catch {
    // best-effort: sem cache o app so perde a resiliencia offline
  }
}

export function readCachedMembership(userId) {
  if (!userId) return null
  return membershipStore()[userId] || null
}

export function clearMembershipCache() {
  try {
    localStorage.removeItem(MEMBERSHIP_KEY)
  } catch {
    // ignore
  }
}

// --- Membros / tenant ---

// Vinculo do usuario logado. Fase 1 assume 1 tenant por usuario (pega o 1o).
// Retorna { tenantId, papel, tenantNome } ou null se ainda nao tem barraca.
export async function loadMembership() {
  const { data, error } = await requireClient()
    .from('membros')
    .select('tenant_id, papel, tenants(nome)')
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error
  const row = data && data[0]
  if (!row) return null
  return {
    tenantId: row.tenant_id,
    papel: row.papel,
    tenantNome: (row.tenants && row.tenants.nome) || 'Minha barraca',
  }
}

// Onboarding (#30): cria o tenant e vincula o usuario logado como dono
// numa unica transacao coerente, via RPC SECURITY DEFINER. O vinculo do
// dono e sempre auth.uid() no servidor, por isso a funcao nao recebe userId.
export async function createTenantAsOwner(nome) {
  const { data, error } = await requireClient().rpc('create_tenant_with_owner', {
    p_nome: nome,
  })
  if (error) throw error
  // A RPC retorna table(id, nome) -> array com uma unica linha.
  return Array.isArray(data) ? data[0] : data
}

// Lista membros do tenant (via RPC SECURITY DEFINER, traz e-mail).
export async function listMembers(tenantId) {
  const { data, error } = await requireClient().rpc('list_tenant_members', {
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return data || []
}

// Dono adiciona um membro existente (por e-mail) ao tenant.
export async function addMember(tenantId, email, papel) {
  const { data, error } = await requireClient().rpc('add_member', {
    p_tenant_id: tenantId,
    p_email: email,
    p_papel: papel,
  })
  if (error) throw error
  return data
}
