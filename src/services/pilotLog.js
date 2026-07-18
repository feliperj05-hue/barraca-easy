// Diario de bordo do piloto (issue #77, parte da #35).
//
// Por que existe: um piloto que so responde "funcionou / nao funcionou" e um
// piloto desperdicado. Mas ninguem escreve relatorio com fila na frente — se
// registrar um problema custar mais de dois toques, ninguem registra, e o que
// sobra no fim do dia e "acho que travou uma hora dessas".
//
// Entao: botao no cabecalho -> categoria em botao grande -> pronto. O texto e
// opcional. O que importa e o carimbo de hora e o estado do app naquele
// instante, porque e isso que me deixa cruzar a queixa com o que a maquina
// estava fazendo.
//
// Fica em localStorage (nao IndexedDB) de proposito: e sincrono, sobrevive a
// recarga e ao fechar o app, e nunca pode falhar bem na hora em que o operador
// esta tentando reclamar de alguma coisa.

import { incidentAll, outboxAll, cacheGet } from './offlineDb.js'
import { getNetStatus } from './netStatus.js'

const KEY = 'barracaEasyPilotLog'
const LIMITE = 300 // teto de sanidade; um dia de barraca nao passa disso

// As queixas que a gente consegue prever. Botao grande, uma batida de dedo.
// "Outro" existe pra nao perder o que a gente nao previu — que costuma ser
// justamente a parte interessante.
export const CATEGORIAS = [
  { id: 'lento', label: 'Ficou lento / travou', icone: '🐢' },
  { id: 'senha', label: 'Problema com a senha', icone: '🎫' },
  { id: 'sumiu', label: 'Pedido sumiu ou apareceu errado', icone: '👻' },
  { id: 'internet', label: 'Parou de mandar / sem internet', icone: '📡' },
  { id: 'confuso', label: 'Nao achei / nao entendi a tela', icone: '🤔' },
  { id: 'errado', label: 'Botei errado sem querer', icone: '🙈' },
  { id: 'outro', label: 'Outra coisa', icone: '📝' },
]

export function categoriaLabel(id) {
  const c = CATEGORIAS.find((x) => x.id === id)
  return c ? c.label : id
}

function ler() {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function gravar(itens) {
  try {
    localStorage.setItem(KEY, JSON.stringify(itens.slice(-LIMITE)))
    return true
  } catch {
    return false
  }
}

export function listarNotas() {
  return ler().slice().reverse() // mais recente primeiro
}

// Registra a queixa junto com o estado do app naquele momento. O estado e o
// que transforma "travou" em informacao: se a fila tinha 12 pendentes e o selo
// estava vermelho, a queixa ja vem com o diagnostico do lado.
export function anotar(categoria, texto, contexto) {
  const net = getNetStatus()
  const nota = {
    id: 'n' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    ts: new Date().toISOString(),
    categoria,
    texto: (texto || '').trim().slice(0, 500),
    tela: (contexto && contexto.tela) || null,
    online: net.online,
    pendentes: net.pending,
  }
  const itens = ler()
  itens.push(nota)
  gravar(itens)
  return nota
}

export function apagarNota(id) {
  gravar(ler().filter((n) => n.id !== id))
}

export function limparNotas() {
  gravar([])
}

// --- Pacote de diagnostico ---
//
// O problema que isto resolve: incidentes (#59) e fila pendente vivem no
// IndexedDB do tablet. Sem isto, acabado o piloto, esse material fica preso no
// aparelho e eu fico so com o relato de memoria. Aqui vira um arquivo de texto
// que o Felipe manda por WhatsApp/e-mail sem precisar plugar nada.
//
// Texto puro, e nao JSON, porque quem aperta o botao e quem manda o arquivo e
// gente — tem que dar pra abrir e entender. Nao ha dado sensivel: sem senha,
// sem token, sem chave. So o e-mail de quem estava logado, que o proprio dono
// da barraca ja sabe.

function linhaData(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch {
    return String(iso)
  }
}

export async function montarDiagnostico(info) {
  const dados = info || {}
  const net = getNetStatus()
  const [notas, incidentes, fila] = await Promise.all([
    Promise.resolve(listarNotas()),
    incidentAll().catch(() => []),
    outboxAll().catch(() => []),
  ])
  let pedidosEmCache = null
  if (dados.tenantId) {
    const c = await cacheGet('orders:' + dados.tenantId).catch(() => null)
    pedidosEmCache = Array.isArray(c) ? c.length : null
  }

  const L = []
  L.push('BARRACA EASY - DIAGNOSTICO DO PILOTO')
  L.push('Gerado em: ' + new Date().toLocaleString('pt-BR'))
  L.push('')
  L.push('--- APARELHO E APP ---')
  L.push('Barraca: ' + (dados.tenantNome || '(nao informado)'))
  L.push('Usuario: ' + (dados.userEmail || '(nao informado)'))
  L.push('Papel: ' + (dados.role || '(sem papel / modo local)'))
  L.push('Modo de operacao: ' + (dados.modo || '(nao informado)'))
  L.push('Endereco do app: ' + (typeof location !== 'undefined' ? location.href : '-'))
  L.push('Instalado como app (tela cheia): ' + (dados.standalone ? 'sim' : 'nao'))
  L.push('Navegador: ' + (typeof navigator !== 'undefined' ? navigator.userAgent : '-'))
  L.push('Tela: ' + (typeof screen !== 'undefined' ? screen.width + 'x' + screen.height : '-'))
  L.push('')
  L.push('--- CONEXAO AGORA ---')
  L.push('Falando com a nuvem: ' + (net.online ? 'sim' : 'NAO'))
  L.push('Ultima resposta boa: ' + (net.lastOkAt ? linhaData(new Date(net.lastOkAt).toISOString()) : 'nenhuma'))
  L.push('Vendas/alteracoes ainda nao enviadas: ' + net.pending)
  if (pedidosEmCache !== null) L.push('Pedidos no cache do aparelho: ' + pedidosEmCache)
  L.push('')

  L.push('--- ANOTACOES DO OPERADOR (' + notas.length + ') ---')
  if (!notas.length) L.push('(nenhuma anotacao registrada)')
  notas.forEach((n) => {
    L.push(
      '[' +
        linhaData(n.ts) +
        '] ' +
        categoriaLabel(n.categoria) +
        (n.tela ? ' | tela: ' + n.tela : '') +
        ' | conexao: ' +
        (n.online ? 'ok' : 'caiu') +
        ' | nao enviados: ' +
        n.pendentes,
    )
    if (n.texto) L.push('    "' + n.texto + '"')
  })
  L.push('')

  L.push('--- AVISOS QUE O APP REGISTROU SOZINHO (' + incidentes.length + ') ---')
  if (!incidentes.length) L.push('(nenhum)')
  incidentes.forEach((i) => {
    L.push(
      '[' +
        linhaData(new Date(i.ts).toISOString()) +
        '] ' +
        i.kind +
        (i.from ? ' senha ' + i.from + ' -> ' + i.to : '') +
        (i.ticket ? ' senha ' + i.ticket : '') +
        (i.opType ? ' (' + i.opType + ')' : '') +
        (i.reason ? ' motivo: ' + i.reason : ''),
    )
  })
  L.push('')

  L.push('--- FILA AINDA NAO ENVIADA (' + fila.length + ') ---')
  if (!fila.length) L.push('(vazia - tudo subiu)')
  fila.forEach((op) => {
    const senha = op.payload && op.payload.ticket ? ' senha ' + op.payload.ticket : ''
    L.push('#' + op.seq + ' ' + op.type + senha + ' tentativas: ' + (op.attempts || 0))
  })
  L.push('')
  L.push('--- FIM ---')
  return L.join('\n')
}

// Gera o arquivo e dispara o download. Em tablet, cai na pasta de downloads e
// de la o Felipe anexa no WhatsApp/e-mail.
export async function baixarDiagnostico(info) {
  const texto = await montarDiagnostico(info)
  const carimbo = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'barraca-easy-piloto-' + carimbo + '.txt'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return texto
}
