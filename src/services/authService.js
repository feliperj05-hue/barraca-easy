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
