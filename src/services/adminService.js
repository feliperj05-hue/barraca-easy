// Administracao da plataforma (issue #91, epic #26).
//
// Tudo aqui passa por RPC SECURITY DEFINER que checa `is_plataforma_admin()`
// no banco. O front esconder o menu e conveniencia, nao seguranca: quem nao e
// admin toma erro do Postgres mesmo chamando a API na unha.

import { supabase, isSupabaseConfigured } from './supabaseClient.js'

// O app pergunta ao banco se o usuario e admin — nao ha lista de e-mail no
// bundle. Assim da para promover alguem sem publicar versao nova.
export async function souAdmin() {
  if (!isSupabaseConfigured) return false
  try {
    const { data, error } = await supabase.rpc('is_plataforma_admin')
    if (error) throw error
    return Boolean(data)
  } catch {
    return false
  }
}

// Catalogo de planos. Vem do banco, nao de constante no bundle: mudar preco
// nao pode exigir publicar versao nova do app.
export async function listarPlanos() {
  const { data, error } = await supabase
    .from('planos')
    .select('codigo, nome, descricao, max_usuarios, valor_mensal, taxa_implantacao, contratavel, ordem')
    .order('ordem')
  if (error) throw error
  return data || []
}

// Contrata/troca o plano. A RPC devolve `excedente` > 0 quando a barraca ja
// tem mais gente do que o plano novo comporta — ninguem e removido, o painel
// so avisa (ver comentario de rebaixamento na migration).
export async function contratarPlano(tenantId, codigo, { gerarSetup = true, aplicarPreco = true } = {}) {
  const { data, error } = await supabase.rpc('admin_contratar_plano', {
    p_tenant_id: tenantId,
    p_plano: codigo,
    p_gerar_setup: gerarSetup,
    p_aplicar_preco: aplicarPreco,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function listarBarracas() {
  const { data, error } = await supabase.rpc('admin_listar_barracas')
  if (error) throw error
  return data || []
}

export async function definirStatus(tenantId, status, extras = {}) {
  const { data, error } = await supabase.rpc('admin_definir_status', {
    p_tenant_id: tenantId,
    p_status: status,
    p_plano: extras.plano ?? null,
    p_valor_mensal: extras.valorMensal ?? null,
    p_teste_expira_em: extras.testeExpiraEm ?? null,
    p_observacao: extras.observacao ?? null,
  })
  if (error) throw error
  return data
}

export async function listarCobrancas(tenantId = null) {
  const { data, error } = await supabase.rpc('admin_listar_cobrancas', {
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return data || []
}

// Sem competencia, o banco assume o mes corrente e normaliza para o dia 1 —
// entao nao da para duplicar a cobranca de julho por clicar duas vezes.
export async function gerarCobranca(
  tenantId,
  { competencia, valor, vencimento, observacao, tipo = 'mensalidade' } = {},
) {
  const { data, error } = await supabase.rpc('admin_gerar_cobranca', {
    p_tenant_id: tenantId,
    p_competencia: competencia ?? null,
    p_valor: valor ?? null,
    p_vencimento: vencimento ?? null,
    p_observacao: observacao ?? null,
    p_tipo: tipo,
  })
  if (error) throw error
  return data
}

// Baixa manual do Pix. A reativacao da barraca acontece dentro da RPC, na
// mesma transacao: nao existe estado "pagou mas continua bloqueado".
export async function baixarCobranca(cobrancaId, { pagoEm, observacao } = {}) {
  const { data, error } = await supabase.rpc('admin_baixar_cobranca', {
    p_cobranca_id: cobrancaId,
    p_pago_em: pagoEm ?? null,
    p_observacao: observacao ?? null,
  })
  if (error) throw error
  return data
}

export async function cancelarCobranca(cobrancaId, motivo = null) {
  const { data, error } = await supabase.rpc('admin_cancelar_cobranca', {
    p_cobranca_id: cobrancaId,
    p_motivo: motivo,
  })
  if (error) throw error
  return data
}
