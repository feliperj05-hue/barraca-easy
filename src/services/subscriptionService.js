// Assinatura da barraca (issue #90, epic #26).
//
// O banco ja e a autoridade: a RLS e a `create_order` nao deixam barraca
// suspensa escrever nada (#89). Este servico existe para o app **explicar**
// isso antes do erro acontecer — bloquear na tela com um recado claro em vez
// de deixar o operador levar "permission denied" na cara do cliente.
//
// REGRA DE OURO DO OFFLINE: falta de sinal NAO bloqueia ninguem.
// Barraca na praia perde internet o tempo todo. Se a ausencia de resposta
// valesse como "assinatura vencida", o app se desligaria sozinho no meio do
// expediente de quem esta pagando em dia — que e o pior erro possivel aqui.
// Entao: servidor respondeu -> essa e a verdade (e vira cache); servidor nao
// respondeu -> vale o ultimo status conhecido; nunca viu status nenhum ->
// libera. Cobrar de menos por um dia sem sinal e barato; travar a venda de
// quem pagou e caro. Mesma logica do vinculo em cache do #73.

import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { reportNetResult } from './netStatus.js'

const CACHE_KEY = 'barracaEasyAssinatura'

export const STATUS_LABELS = {
  teste: 'Período de teste',
  ativa: 'Assinatura ativa',
  suspensa: 'Assinatura suspensa',
  cancelada: 'Assinatura cancelada',
}

// --- Cache local -------------------------------------------------------

export function readCachedSubscription(tenantId) {
  if (typeof localStorage === 'undefined' || !tenantId) return null
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (!raw || raw.tenant_id !== tenantId) return null
    return raw
  } catch {
    return null
  }
}

export function cacheSubscription(sub) {
  if (typeof localStorage === 'undefined') return
  try {
    if (!sub) localStorage.removeItem(CACHE_KEY)
    else localStorage.setItem(CACHE_KEY, JSON.stringify({ ...sub, cached_at: Date.now() }))
  } catch {
    /* storage cheio ou bloqueado: seguir sem cache e melhor que quebrar */
  }
}

export function clearSubscriptionCache() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* nada a fazer */
  }
}

// --- Leitura -----------------------------------------------------------

// Busca o estado da assinatura. Devolve { sub, stale }:
// - stale=false -> veio do servidor agora;
// - stale=true  -> veio do cache porque o servidor nao respondeu.
export async function loadSubscription(tenantId) {
  if (!isSupabaseConfigured || !tenantId) return { sub: null, stale: false }
  try {
    const { data, error } = await supabase.rpc('minha_assinatura', {
      p_tenant_id: tenantId,
    })
    if (error) throw error
    reportNetResult(true)
    const sub = Array.isArray(data) ? data[0] || null : data || null
    cacheSubscription(sub)
    return { sub, stale: false }
  } catch (e) {
    // Erro de regra (permissao, tenant inexistente) e RESPOSTA do servidor:
    // a rede esta boa, nao ha porque marcar o app como offline. So falha de
    // transporte conta para o indicador de conexao.
    if (!e || !e.code) reportNetResult(false)
    return { sub: readCachedSubscription(tenantId), stale: true }
  }
}

// --- Regra de acesso ---------------------------------------------------

export function diasRestantesDeTeste(sub) {
  if (!sub || sub.status_assinatura !== 'teste') return null
  if (sub.dias_restantes != null) return sub.dias_restantes
  if (!sub.teste_expira_em) return null
  // Comparacao de DATA, nao de instante. A conta ingenua
  // ((fim - agora) / 24h) erra em um dia: as horas que ainda faltam para
  // acabar o dia de hoje entram no resultado, entao um teste que venceu
  // ONTEM devolvia 0 e a barraca continuava liberada de graca. Zerando as
  // duas pontas na meia-noite local, a diferenca vira contagem de dias no
  // calendario — que e como o dono pensa ("vence dia 20").
  const partes = String(sub.teste_expira_em).slice(0, 10).split('-').map(Number)
  const [ano, mes, dia] = partes
  if (!ano || !mes || !dia) return null
  const fim = new Date(ano, mes - 1, dia)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((fim.getTime() - hoje.getTime()) / 86400000)
}

// A pergunta que o app faz: esta barraca pode operar?
//
// `sub` nulo devolve liberado de proposito — e o caso do modo local sem nuvem
// e o do aparelho que nunca conseguiu falar com o servidor.
export function podeOperar(sub) {
  if (!sub) return true
  if (sub.status_assinatura === 'ativa') return true
  if (sub.status_assinatura === 'teste') {
    const dias = diasRestantesDeTeste(sub)
    return dias == null || dias >= 0
  }
  return false // suspensa, cancelada
}

// Motivo do bloqueio, em portugues de gente — o operador precisa entender o
// que houve sem ligar para ninguem.
export function motivoBloqueio(sub) {
  if (!sub || podeOperar(sub)) return null
  if (sub.status_assinatura === 'suspensa') {
    return {
      titulo: 'Assinatura suspensa',
      texto:
        'A barraca está com pagamento em aberto e por isso não consegue lançar pedidos. ' +
        'Assim que o pagamento for confirmado, tudo volta na hora — nenhum dado foi apagado.',
    }
  }
  if (sub.status_assinatura === 'cancelada') {
    return {
      titulo: 'Assinatura cancelada',
      texto:
        'Esta barraca foi cancelada. O histórico continua aqui para consulta, ' +
        'mas não dá para lançar pedidos novos. Fale com o suporte para reativar.',
    }
  }
  return {
    titulo: 'Período de teste encerrado',
    texto:
      'O teste grátis chegou ao fim. Para continuar usando o Barraca Easy, ' +
      'é só acertar a mensalidade — seus produtos e seu histórico estão salvos.',
  }
}

// Aviso amarelo de teste acabando: aparece nos ultimos dias, sem atrapalhar.
export function avisoDeTeste(sub) {
  const dias = diasRestantesDeTeste(sub)
  if (dias == null || dias < 0 || dias > 7) return null
  if (dias === 0) return 'Seu teste grátis termina hoje.'
  if (dias === 1) return 'Seu teste grátis termina amanhã.'
  return `Seu teste grátis termina em ${dias} dias.`
}

// Cobrancas da propria barraca (o dono ve o que deve). RLS `cobrancas_select`
// ja limita ao dono do tenant; aqui e so leitura.
export async function listarMinhasCobrancas(tenantId) {
  if (!isSupabaseConfigured || !tenantId) return []
  const { data, error } = await supabase
    .from('cobrancas')
    .select('id, competencia, valor, vencimento, status, pago_em, metodo, observacao')
    .eq('tenant_id', tenantId)
    .order('competencia', { ascending: false })
  if (error) throw error
  return data || []
}
