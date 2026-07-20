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
// O teste passou a ser de 7 dias (#96), entao o aviso vale o teste INTEIRO —
// nao so a reta final. Foi exatamente por nao ver aviso nenhum que o dono do
// produto achou que uma conta nova tinha entrado liberada.
export function avisoDeTeste(sub) {
  const dias = diasRestantesDeTeste(sub)
  if (dias == null || dias < 0) return null
  if (dias === 0) return 'Seu teste grátis termina hoje.'
  if (dias === 1) return 'Seu teste grátis termina amanhã.'
  return `Seu teste grátis termina em ${dias} dias.`
}

// Quantos usuarios ainda cabem no plano. `max_usuarios` nulo = plano legado,
// sem limite — barraca que ja rodava antes da tabela de precos nao pode ser
// travada por causa de um deploy.
export function vagasRestantes(sub) {
  if (!sub || sub.max_usuarios == null) return null
  return Math.max(sub.max_usuarios - (sub.usuarios_atuais || 0), 0)
}

export function planoCheio(sub) {
  const vagas = vagasRestantes(sub)
  return vagas != null && vagas <= 0
}

// Catalogo de planos visto pelo DONO (so os contratavais: o legado nao e
// oferecido a ninguem).
export async function listarPlanosDisponiveis() {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('planos')
    .select('codigo, nome, descricao, max_usuarios, valor_mensal, taxa_implantacao')
    .eq('contratavel', true)
    .order('ordem')
  if (error) throw error
  return data || []
}

// Contratar e MANIFESTACAO DE INTERESSE, nao pagamento: troca o plano e deixa
// a cobranca em aberto. Quem confirma o dinheiro (Pix recebido por fora) e o
// Felipe, no painel. Por isso a barraca NAO fica ativa so por clicar aqui.
export async function contratarPlano(tenantId, codigo) {
  const { data, error } = await supabase.rpc('contratar_plano', {
    p_tenant_id: tenantId,
    p_plano: codigo,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

// Dados de pagamento. Vem do banco (nao de env var) porque o Felipe vai
// querer trocar a chave sem depender de deploy.
export async function lerDadosPix() {
  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase
      .from('plataforma_config')
      .select('chave, valor')
      .in('chave', ['pix_chave', 'pix_nome'])
    if (error) throw error
    const mapa = {}
    for (const linha of data || []) mapa[linha.chave] = linha.valor
    return mapa.pix_chave ? mapa : null
  } catch {
    return null
  }
}

// Status do usuario logado SEM dizer qual barraca (#107).
//
// Diferente de `loadSubscription`, que pergunta por um tenant conhecido. Esta
// e a porta de entrada do site comercial, onde a pessoa pode nem ter conta:
// uma unica ida ao banco responde tem-conta / tem-barraca / plano / em-teste
// / dias-restantes.
//
// A decisao continua sendo do banco. O front so exibe o que vier — inclusive
// porque isto vai virar tela de venda, e regra de cobranca decidida no
// navegador e regra que o cliente pode reescrever.
export async function meuStatus() {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.rpc('meu_status')
  if (error) throw error
  return Array.isArray(data) ? data[0] || null : data || null
}

// --- Cancelamento self-service (#115) ----------------------------------
//
// Origem do pedido. Vai junto para a trilha responder "por qual tela" — sem
// isso nao da para demonstrar por onde o cliente conseguiu cancelar.
export const ORIGEM_CANCELAMENTO = 'app:configuracoes/minha-assinatura'

// Ha um cancelamento pedido que ainda nao chegou na data de valer?
export function cancelamentoAgendado(sub) {
  if (!sub || !sub.cancelamento_efetivo_em) return false
  if (sub.status_assinatura === 'cancelada') return false
  return diasAte(sub.cancelamento_efetivo_em) >= 0
}

// Diferenca em DIAS DE CALENDARIO, nao em horas. Mesma armadilha do
// `diasRestantesDeTeste`: a conta ingenua com timestamp erra em um dia porque
// as horas que faltam para acabar hoje entram no resultado.
function diasAte(data) {
  const partes = String(data).slice(0, 10).split('-').map(Number)
  const [ano, mes, dia] = partes
  if (!ano || !mes || !dia) return NaN
  const alvo = new Date(ano, mes - 1, dia)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

// O que vai acontecer se o dono cancelar AGORA. A tela precisa disso ANTES da
// confirmacao: mandar alguem confirmar sem saber se perde o acesso na hora ou
// no fim do mes ja pago e esconder a informacao que mais importa.
//
// Espelha a regra da RPC `cancelar_minha_assinatura`. A decisao continua sendo
// do banco — isto aqui e so a previsao mostrada ao usuario. Se as duas
// discordarem, quem manda e o banco, e a tela mostra o resultado que voltou.
export function previsaoDeCancelamento(sub) {
  if (!sub) return null
  if (sub.status_assinatura === 'cancelada') {
    return { imediato: true, ate: null, texto: 'Esta assinatura já está cancelada.' }
  }
  if (sub.status_assinatura === 'teste') {
    return {
      imediato: true,
      ate: null,
      texto:
        'Você está no período de teste e nada foi cobrado. O acesso é encerrado agora ' +
        'e não há nada a pagar nem a devolver.',
    }
  }
  const fim = sub.fim_periodo_pago
  if (sub.status_assinatura === 'ativa' && fim && diasAte(fim) >= 0) {
    return {
      imediato: false,
      ate: fim,
      texto:
        `Sua barraca continua funcionando normalmente até ${dataBR(fim)}, que é o fim do ` +
        'período que você já pagou. Depois dessa data o acesso é encerrado. ' +
        'Nenhuma cobrança nova é gerada, e as que estiverem em aberto são canceladas.',
    }
  }
  return {
    imediato: true,
    ate: null,
    texto:
      'O acesso é encerrado agora. Não há período pago em aberto, então não há ' +
      'cobrança nova nem valor a devolver. Seu histórico continua salvo.',
  }
}

function dataBR(iso) {
  if (!iso) return ''
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

// Cancelar de verdade. `motivo` e OPCIONAL de proposito: exigir motivo para
// deixar sair e atrito disfarcado de pesquisa, e deixaria cancelar mais
// dificil que contratar — que e exatamente o que a regra proibe.
//
// `natureza` (#122) e TAMBEM opcional, e pelo mesmo motivo: 'resilicao'
// (parar daqui pra frente) ou 'arrependimento' (desfazer a contratacao).
// Manda sempre explicito (mesmo vazio) para NAO cair no default do banco —
// aqui, sem escolha do cliente, a trilha grava null (nao declarada), que e
// diferente de assumir 'resilicao' por ele.
export async function cancelarMinhaAssinatura(tenantId, motivo = '', natureza = null) {
  if (!isSupabaseConfigured) {
    throw new Error('Este aparelho está no modo local, sem conta na nuvem.')
  }
  const { data, error } = await supabase.rpc('cancelar_minha_assinatura', {
    p_tenant_id: tenantId,
    p_motivo: motivo || null,
    p_origem: ORIGEM_CANCELAMENTO,
    p_natureza: natureza || null,
  })
  if (error) throw error
  const r = Array.isArray(data) ? data[0] || null : data || null
  // O estado guardado localmente ficou velho no mesmo instante. Deixar o
  // cache antigo faria a tela mostrar "ativa" depois de cancelar.
  clearSubscriptionCache()
  return r
}

// Historico da assinatura para o proprio dono. A RLS ja limita ao membro do
// tenant; aqui e so leitura.
export async function listarEventosAssinatura(tenantId) {
  if (!isSupabaseConfigured || !tenantId) return []
  const { data, error } = await supabase
    .from('assinatura_eventos')
    .select('id, tipo, email, plano_nome, origem, status_antes, status_depois, efetivo_em, motivo, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Cobrancas da propria barraca (o dono ve o que deve). RLS `cobrancas_select`
// ja limita ao dono do tenant; aqui e so leitura.
export async function listarMinhasCobrancas(tenantId) {
  if (!isSupabaseConfigured || !tenantId) return []
  const { data, error } = await supabase
    .from('cobrancas')
    .select('id, competencia, valor, vencimento, status, pago_em, metodo, tipo, observacao')
    .eq('tenant_id', tenantId)
    .order('competencia', { ascending: false })
  if (error) throw error
  return data || []
}
