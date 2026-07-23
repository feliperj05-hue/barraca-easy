/**
 * Guarda da fila presa e do loop do caixa (issue #132).
 *
 * Reproduz, sem navegador, as duas decisoes que causavam:
 *   - pedidos travados em "Enviando..." no tablet;
 *   - os mesmos pedidos voltando toda hora no caixa depois de fechar.
 *
 * O nucleo do fix e a RECONCILIACAO: a RPC create_order nao e idempotente, entao
 * um `create` que subiu mas perdeu a resposta volta pela fila e bate "senha ja
 * usada". Sem reconhecer que e a MESMA venda, o replay criaria uma duplicata na
 * faixa 900. `findAppliedOrder` e a decisao pura que evita isso; aqui provamos
 * o comportamento dela nos cenarios que importam.
 *
 *   npm run fila-presa
 */

// A lib do supabase instancia realtime no construtor (WebSocket nativo). Como
// nao ha credenciais nos testes, `supabase` fica null e nem chega a construir,
// mas o stub garante o import sem susto se algo mudar.
class WebSocketStub {
  addEventListener() {}
  removeEventListener() {}
  close() {}
  send() {}
}
globalThis.WebSocket = globalThis.WebSocket || WebSocketStub

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const { findAppliedOrder, purgePendingOnClose } = await import(
  "../src/services/orderService.js"
)
const { normalizeTicket } = await import("../src/utils/tickets.js")

const passos = []
function ok(nome, cond, extra) {
  passos.push({ nome, cond })
  console.log((cond ? "OK   " : "FALHA") + " " + nome + (extra ? "  [" + extra + "]" : ""))
}

const hoje = () => new Date().toISOString()
const ontem = () => new Date(Date.now() - 24 * 3600 * 1000).toISOString()

function pedido(ticket, total, extra = {}) {
  return {
    id: "srv-" + ticket,
    ticket: normalizeTicket(ticket),
    total,
    status: "aguardando",
    createdAt: hoje(),
    ...extra,
  }
}

console.log("--- reconciliacao: a venda que ja subiu nao pode virar duplicata\n")

const noServidor = [pedido("12", 30), pedido("13", 18), pedido("14", 55)]

// 1. A MESMA venda ja esta la (resposta perdida): tem que ser reconhecida, para
//    o replay adotar a existente em vez de reatribuir para a faixa 900.
{
  const achou = findAppliedOrder({ ticket: "13", total: 18 }, noServidor)
  ok("Venda ja aplicada (mesma senha e total) e reconhecida", achou && achou.ticket === "013")
  ok("...e o id devolvido e o da linha do servidor", achou && achou.id === "srv-13")
}

// 2. Outra venda DIFERENTE pegou a mesma senha (total diferente): NAO e a nossa,
//    entao findAppliedOrder devolve null e o caller reatribui de verdade.
{
  const achou = findAppliedOrder({ ticket: "13", total: 99 }, noServidor)
  ok("Senha ocupada por venda de OUTRO valor nao e confundida com a nossa", achou === null)
}

// 3. A senha existe, mas o pedido foi cancelado: numero esta livre, nao ha o que
//    adotar.
{
  const comCancelado = [pedido("20", 40, { status: "cancelado" })]
  ok(
    "Pedido cancelado com a mesma senha nao conta como aplicado",
    findAppliedOrder({ ticket: "20", total: 40 }, comCancelado) === null,
  )
}

// 4. A senha foi usada ONTEM: e outro dia, o numero reinicia. Nao adota.
{
  const deOntem = [pedido("12", 30, { createdAt: ontem() })]
  ok(
    "Venda de ontem com a mesma senha nao e tratada como aplicada hoje",
    findAppliedOrder({ ticket: "12", total: 30 }, deOntem) === null,
  )
}

// 5. Nada parecido no servidor: null, segue o create normal.
{
  ok(
    "Sem correspondencia, findAppliedOrder devolve null",
    findAppliedOrder({ ticket: "99", total: 10 }, noServidor) === null,
  )
}

// 6. Lista vazia / ausente nao quebra.
{
  ok("Servidor vazio nao quebra", findAppliedOrder({ ticket: "1", total: 1 }, []) === null)
  ok("Servidor ausente nao quebra", findAppliedOrder({ ticket: "1", total: 1 }, null) === null)
}

console.log("\n--- fechamento neutraliza a fila (nao ressuscita no proximo caixa)\n")

// purgePendingOnClose so age no modo nuvem (ctx com tenantId). Sem tenant (modo
// local) e no-op — nao ha fila offline para limpar. Sem IndexedDB no Node, a
// funcao degrada para no-op tambem; aqui garantimos que ela nao estoura e que
// existe como parte publica do modulo (o App a chama no fechamento).
{
  ok("purgePendingOnClose e exportada pelo orderService", typeof purgePendingOnClose === "function")
  let quebrou = false
  try {
    await purgePendingOnClose(null) // modo local: no-op
    await purgePendingOnClose({ tenantId: "t-1" }) // nuvem sem IndexedDB: no-op seguro
  } catch {
    quebrou = true
  }
  ok("purgePendingOnClose nao estoura no fechamento", quebrou === false)
}

const falhas = passos.filter((p) => !p.cond)
console.log("\n" + (passos.length - falhas.length) + "/" + passos.length + " passos OK")
if (falhas.length) process.exit(1)
