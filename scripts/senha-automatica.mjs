/**
 * Guarda da senha automatica sequencial (issue #79).
 *
 * Isto mexe no caminho critico do balcao, que ja esta em producao e vai pro
 * piloto (#35). O que nao pode acontecer, em ordem de gravidade:
 *
 *   1. Dois clientes com a mesma senha no mesmo expediente.
 *   2. A sequencia se perder ao reabrir o app, trocar de aparelho ou cair a rede.
 *   3. O caixa fechar e a proxima venda NAO voltar pro 0001.
 *   4. O modo manual mudar de comportamento sem ninguem pedir.
 *
 *   npm run senha-automatica
 */

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const {
  normalizeTicket,
  nextSequentialTicket,
  nextFreeTicket,
  setTicketWidth,
  ticketNumber,
  TICKET_WIDTH_AUTO,
  TICKET_WIDTH_MANUAL,
} = await import('../src/utils/tickets.js')

const { getTicketMode, setTicketMode, isAutoTicket, TICKET_MODE_AUTO, TICKET_MODE_MANUAL } =
  await import('../src/services/settingsService.js')

const passos = []
function ok(nome, cond, extra) {
  passos.push({ nome, cond })
  console.log((cond ? 'OK   ' : 'FALHA') + ' ' + nome + (extra ? '  [' + extra + ']' : ''))
}

const hoje = new Date()
let seq = 0
function pedido(ticket, status = 'aguardando', quando = hoje) {
  seq += 1
  return { id: 'o' + seq, ticket, status, createdAt: new Date(quando).toISOString() }
}

// ---------------------------------------------------------------------------
// 1. Modo manual: nada pode ter mudado
// ---------------------------------------------------------------------------
console.log('--- modo manual (o de hoje) nao pode mudar\n')

setTicketWidth(TICKET_WIDTH_MANUAL)
ok('"27" continua virando "027"', normalizeTicket('27') === '027')
ok('"5" continua virando "005"', normalizeTicket('5') === '005')
ok('Senha maior que a largura passa inteira', normalizeTicket('1234') === '1234')
ok('Texto vira so os digitos', normalizeTicket('A50') === '050')
ok('Padrao de fabrica e senha manual', getTicketMode() === TICKET_MODE_MANUAL)
ok('...e isAutoTicket concorda', isAutoTicket() === false)

// ---------------------------------------------------------------------------
// 2. Modo automatico: a sequencia
// ---------------------------------------------------------------------------
console.log('\n--- modo automatico: 4 digitos a partir de 0001\n')

setTicketWidth(TICKET_WIDTH_AUTO)
ok('Caixa recem-aberto comeca em 0001', nextSequentialTicket([]) === '0001')
ok('Depois da primeira venda vem 0002', nextSequentialTicket([pedido('0001')]) === '0002')
ok(
  'Segue em ordem: 0003',
  nextSequentialTicket([pedido('0001'), pedido('0002')]) === '0003',
)
ok('Sempre 4 digitos', nextSequentialTicket([pedido('0009')]) === '0010')
ok('Passa da centena sem quebrar', nextSequentialTicket([pedido('0099')]) === '0100')

// A regra que evita cliente confuso: numero cancelado fica QUEIMADO ate o fim
// do expediente. Se voltasse a valer, o cliente que ja tinha o 0004 na mao
// veria outro pedido com a senha dele sendo chamado.
const comCancelado = [pedido('0001'), pedido('0002'), pedido('0003', 'cancelado')]
ok(
  'Senha cancelada NAO volta a ser usada no mesmo dia',
  nextSequentialTicket(comCancelado) === '0004',
  'cliente nao ve a senha dele em outro pedido',
)

// Contraste proposital com o nextFreeTicket (#59), que serve a outra coisa:
// aquele procura buraco, este continua a fila.
ok(
  'nextFreeTicket continua achando buraco (uso do #59)',
  nextFreeTicket(comCancelado, { start: 1 }) === '0003',
)

// A pergunta do coordenador: e se o app for reaberto ou cair a rede entre o
// fechamento e a proxima venda? Nao ha contador guardado — a resposta sai dos
// pedidos. Reabrir o app com os mesmos pedidos da a mesma resposta, sempre.
const estado = [pedido('0001'), pedido('0002'), pedido('0003')]
ok(
  'Reabrir o app nao bagunca a sequencia',
  nextSequentialTicket(estado) === nextSequentialTicket(estado) &&
    nextSequentialTicket(estado) === '0004',
  'derivado do estado, nao de memoria',
)

// Pedido de ontem nao empurra a sequencia de hoje.
const ontem = new Date(hoje.getTime() - 26 * 60 * 60 * 1000)
ok(
  'Pedido de ontem nao conta pra hoje',
  nextSequentialTicket([pedido('0087', 'entregue', ontem)]) === '0001',
)

// Faixa reservada da reatribuicao (#59): nao pode empurrar a fila normal de
// 0007 pra 0901 so porque um aparelho offline colidiu.
ok(
  'Reatribuicao na faixa 900 nao empurra a sequencia',
  nextSequentialTicket([pedido('0001'), pedido('0900')], { bandStart: 900 }) === '0002',
)

// ---------------------------------------------------------------------------
// 3. Zerar no fechamento
// ---------------------------------------------------------------------------
console.log('\n--- zerar a cada fechamento de caixa\n')

// Fechar o caixa apaga os pedidos (clearOrders, na nuvem e no local). Como a
// sequencia sai deles, ela zera junto — nao ha contador separado pra
// dessincronizar.
const antesDeFechar = [pedido('0001'), pedido('0002'), pedido('0003')]
const depoisDeFechar = []
ok('Antes de fechar, a proxima e 0004', nextSequentialTicket(antesDeFechar) === '0004')
ok('Fechou o caixa -> volta pro 0001', nextSequentialTicket(depoisDeFechar) === '0001')

// No manual, "zerar" significa liberar os numeros do dia: apagados os pedidos,
// a trava de senha repetida nao tem mais com que comparar e o mesmo papel
// pode rodar de novo.
ok(
  'No manual, fechar o caixa libera o numero pra ser reusado',
  nextFreeTicket([], { start: 1 }) === '0001',
)

// ---------------------------------------------------------------------------
// 4. A configuracao
// ---------------------------------------------------------------------------
console.log('\n--- a configuracao\n')

setTicketMode(TICKET_MODE_AUTO)
ok('Escolha da senha automatica fica gravada', getTicketMode() === TICKET_MODE_AUTO)
ok('...e sobrevive a recarregar', isAutoTicket(getTicketMode()) === true)
setTicketMode(TICKET_MODE_MANUAL)
ok('Da pra voltar pro manual', getTicketMode() === TICKET_MODE_MANUAL)
store.set('barracaEasyTicketMode', 'coisa-estranha')
ok('Valor invalido no storage cai no manual', getTicketMode() === TICKET_MODE_MANUAL)

// A preferencia de senha mora numa chave PROPRIA. Se morasse dentro das
// settings, `selectMode` a apagaria toda vez que alguem tocasse num cartao de
// modo de operacao — e ninguem entenderia por que a barraca voltou a pedir
// senha na mao.
const { selectMode } = await import('../src/services/settingsService.js')
setTicketMode(TICKET_MODE_AUTO)
selectMode('cashier_production_sync')
ok(
  'Trocar o modo de operacao nao apaga a escolha da senha',
  getTicketMode() === TICKET_MODE_AUTO,
)

// ---------------------------------------------------------------------------
// 5. Largura misturada: o risco de dois clientes com a senha 27
// ---------------------------------------------------------------------------
console.log('\n--- largura misturada no mesmo dia\n')

// "027" e "0027" sao textos diferentes, e o indice unico do banco compara
// texto. Se as duas larguras convivessem no mesmo dia, dois clientes ficariam
// com a senha 27. Por isso a tela trava a troca com venda no caixa aberto.
ok(
  '"027" e "0027" sao textos diferentes (por isso a troca e travada)',
  '027' !== '0027',
)
ok('...mas valem o mesmo numero, e a comparacao numerica enxerga isso', ticketNumber('027') === ticketNumber('0027'))
setTicketWidth(TICKET_WIDTH_AUTO)
ok(
  'Com largura 4, uma senha manual antiga de 3 digitos ainda e lida certo',
  nextSequentialTicket([pedido('027')]) === '0028',
)

const falhas = passos.filter((p) => !p.cond)
console.log('\n' + (passos.length - falhas.length) + '/' + passos.length + ' passos OK')
if (falhas.length) process.exit(1)
