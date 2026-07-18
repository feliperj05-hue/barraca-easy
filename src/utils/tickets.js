import { isSameDay } from './dates.js'

// Senha física prefixada com zeros (ex: "27" -> "027"). O sistema NÃO gera
// senha no modo padrão; apenas normaliza o número informado pelo caixa.
export function normalizeTicket(value) {
  return String(value || '')
    .trim()
    .replace(/\D/g, '')
    .padStart(3, '0')
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
      .map((o) => Number(normalizeTicket(o.ticket))),
  )
  let n = Math.max(1, Number(start) || 1)
  while (used.has(n)) n += 1
  return normalizeTicket(String(n))
}
