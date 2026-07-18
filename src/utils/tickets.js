import { isSameDay } from './dates.js'

// Largura da senha em digitos (#79).
//
// Manual continua com 3 ("27" -> "027"), que e como a barraca sempre trabalhou.
// Automatica usa 4 ("0001"), como o Felipe pediu.
//
// Por que existe uma largura "corrente" em vez de um parametro em cada
// chamada: `normalizeTicket` e chamada la no fundo do orderService, inclusive
// no replay da fila offline, onde nao ha settings por perto. O App define a
// largura uma vez, quando carrega/muda a configuracao, e todo mundo formata
// igual. Trocar de modo com pedido aberto no dia e bloqueado na tela — e o
// que garante que, dentro de um mesmo expediente, a largura nunca muda.
//
// Isso importa mais do que parece: "027" e "0027" sao strings diferentes, e o
// indice unico do banco e por string. Largura misturada no mesmo dia deixaria
// passar dois clientes com a senha 27.
export const TICKET_WIDTH_MANUAL = 3
export const TICKET_WIDTH_AUTO = 4

let currentWidth = TICKET_WIDTH_MANUAL

export function setTicketWidth(width) {
  currentWidth = Number(width) === TICKET_WIDTH_AUTO ? TICKET_WIDTH_AUTO : TICKET_WIDTH_MANUAL
}

export function getTicketWidth() {
  return currentWidth
}

// Senha prefixada com zeros. No modo manual o sistema NAO gera senha: apenas
// normaliza o numero que o caixa informou. `padStart` so completa, nunca corta
// — senha maior que a largura corrente passa inteira, que e o certo (um papel
// "1234" nao pode virar "234").
export function normalizeTicket(value, width) {
  return String(value || '')
    .trim()
    .replace(/\D/g, '')
    .padStart(Number(width) || currentWidth, '0')
}

// Menor senha livre hoje a partir de `start` (#59). Usada quando a fila
// offline sobe um pedido cuja senha ja foi ocupada por outro aparelho: em vez
// de descartar a venda, o sistema pega este numero e avisa o operador para
// falar com o cliente.
//
// Por que `start` existe: a senha e um papel fisico de bloco sequencial. Se a
// reatribuicao pegasse o menor numero livre (ex.: 001), ela poderia cair
// justamente num papel que o caixa ainda vai entregar mais tarde — e a
// colisao voltaria. Por isso a reatribuicao usa uma FAIXA RESERVADA, alta o
// bastante para nao encostar no bloco de papel em uso.
//
// Senha cancelada NAO conta como ocupada — o indice do banco tambem a ignora,
// entao o numero volta a valer. Pedido de outro dia idem.
export function nextFreeTicket(orders, { ref = new Date(), start = 1 } = {}) {
  const used = new Set(
    (orders || [])
      .filter((o) => o && o.status !== 'cancelado' && isSameDay(o.createdAt, ref))
      .map((o) => ticketNumber(o.ticket)),
  )
  let n = Math.max(1, Number(start) || 1)
  while (used.has(n)) n += 1
  return normalizeTicket(String(n))
}

// Valor numerico da senha, ignorando os zeros da frente. E assim que a gente
// compara senha com senha sem depender de quantos digitos ela tem.
export function ticketNumber(ticket) {
  const n = Number(String(ticket || '').replace(/\D/g, ''))
  return Number.isFinite(n) ? n : 0
}

// Primeira senha do expediente no modo automatico.
export const FIRST_AUTO_TICKET = 1

// Proxima senha do modo automatico (#79).
//
// Sai do MAIOR numero ja usado hoje + 1 — e nao do menor numero livre. A
// diferenca aparece no cancelamento: se o pedido 0004 foi cancelado, o menor
// livre devolveria 0004 de novo, e o cliente que ja estava com o 0004 na mao
// veria outro pedido com a senha dele. Entao numero cancelado fica queimado
// ate o fim do expediente. Por isso os cancelados CONTAM aqui, ao contrario do
// `nextFreeTicket`.
//
// Nao existe contador guardado a parte, de proposito. A sequencia e derivada
// dos pedidos do dia, que e o mesmo dado que o app ja carrega e sincroniza.
// Consequencias praticas:
//   - fechar o caixa apaga os pedidos, entao a proxima venda volta pro 0001
//     sozinha: nao ha nada pra "zerar" e, portanto, nada pra dessincronizar;
//   - fechar e reabrir o app, trocar de aparelho ou perder a rede no meio nao
//     bagunca nada — a resposta sai do estado, nao de memoria;
//   - dois aparelhos offline podem chegar no mesmo numero. Isso ja tem
//     tratamento: o indice unico do banco recusa, e a fila reatribui a senha e
//     avisa o operador (#59).
//
// `bandStart` protege a faixa reservada da reatribuicao (900+): senha daquela
// faixa nao empurra a sequencia normal, senao uma reatribuicao faria a proxima
// venda pular de 0007 pra 0901.
export function nextSequentialTicket(orders, { ref = new Date(), bandStart = Infinity } = {}) {
  let max = 0
  ;(orders || []).forEach((o) => {
    if (!o || !isSameDay(o.createdAt, ref)) return
    const n = ticketNumber(o.ticket)
    if (n >= bandStart) return
    if (n > max) max = n
  })
  return normalizeTicket(String(Math.max(FIRST_AUTO_TICKET, max + 1)))
}
