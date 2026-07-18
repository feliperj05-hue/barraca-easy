// Diario de bordo do piloto + canal "Fale com o desenvolvedor" (#77, #85).
//
// Por que existe: um piloto que so responde "funcionou / nao funcionou" e um
// piloto desperdicado. Mas ninguem escreve relatorio com fila na frente — se
// registrar um problema custar mais de dois toques, ninguem registra, e o que
// sobra no fim do dia e "acho que travou uma hora dessas".
//
// Entao: um caminho curto -> categoria em botao grande -> pronto. O texto e
// opcional pra queixa. O que importa e o carimbo de hora e o estado do app
// naquele instante, porque e isso que me deixa cruzar a queixa com o que a
// maquina estava fazendo.
//
// No #85 isso deixou de ser so "diario do piloto" e virou o canal permanente de
// conversa com quem usa: problema, melhoria ou elogio. O armazenamento continua
// o mesmo de proposito — ja estava resolvido e ja alimenta o relatorio.
//
// Fica em localStorage (nao IndexedDB) de proposito: e sincrono, sobrevive a
// recarga e ao fechar o app, e nunca pode falhar bem na hora em que o operador
// esta tentando reclamar de alguma coisa.

import { incidentAll, outboxAll, cacheGet } from './offlineDb.js'
import { getNetStatus } from './netStatus.js'
import { filtrarPorRetencao, resumoAparelho, DIAS_RETENCAO_LOCAL } from './privacidade.js'

const KEY = 'barracaEasyPilotLog'
const LIMITE = 300 // teto de sanidade; um dia de barraca nao passa disso

// Os tres tipos de recado (#85). Tres e o numero certo: da pra ler tudo de
// uma vez, sem rolar e sem ficar escolhendo gaveta. Antes eram sete categorias
// de queixa de piloto — bom pra caçar bug, ruim pra quem so queria dizer que
// gostou.
export const TIPOS = [
  {
    id: 'problema',
    label: 'Reportar um problema',
    hint: 'Algo travou, sumiu ou fez o que nao devia',
  },
  {
    id: 'melhoria',
    label: 'Sugerir uma melhoria',
    hint: 'Uma ideia pro app te ajudar mais',
  },
  {
    id: 'elogio',
    label: 'Fazer um elogio',
    hint: 'Alguma coisa que esta funcionando bem',
  },
]

// Rotulos das 7 categorias antigas do piloto. Ficam aqui porque pode haver nota
// gravada no tablet desde antes do #85 — apagar o rotulo faria a nota antiga
// aparecer no relatorio como "sumiu" cru, sem sentido pra quem le.
const LABELS_ANTIGOS = {
  lento: 'Ficou lento / travou',
  senha: 'Problema com a senha',
  sumiu: 'Pedido sumiu ou apareceu errado',
  internet: 'Parou de mandar / sem internet',
  confuso: 'Nao achei / nao entendi a tela',
  errado: 'Botei errado sem querer',
  outro: 'Outra coisa',
}

export function categoriaLabel(id) {
  const t = TIPOS.find((x) => x.id === id)
  if (t) return t.label
  return LABELS_ANTIGOS[id] || id
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

// Retencao (#87): recado com mais de 90 dias sai do aparelho sozinho.
//
// Roda na leitura, e nao num timer, de proposito: nao existe app aberto que
// nao leia essa lista, entao a limpeza acontece na pratica sempre — sem
// agendador, sem processo em segundo plano, sem mais uma coisa pra quebrar.
// Se apagou alguem, regrava na hora; se nao, nao mexe no storage a toa.
export function aplicarRetencao() {
  const itens = ler()
  const mantidos = filtrarPorRetencao(itens)
  if (mantidos.length !== itens.length) gravar(mantidos)
  return { apagados: itens.length - mantidos.length, mantidos: mantidos.length }
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
  aplicarRetencao()
  return ler().slice().reverse() // mais recente primeiro
}

export { DIAS_RETENCAO_LOCAL }

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
  nota.enviado = false
  const itens = ler()
  itens.push(nota)
  gravar(itens)
  return nota
}

// Marca que a nota ja chegou na nuvem. Guardar isso no aparelho e o que evita
// mandar a mesma reclamacao duas vezes quando a internet volta.
export function marcarEnviada(id) {
  const itens = ler().map((n) => (n.id === id ? { ...n, enviado: true } : n))
  gravar(itens)
}

// Nota antiga (de antes do #85) nao tem o campo `enviado` e nunca foi pra
// nuvem; `!== true` cobre os dois casos sem precisar migrar nada.
export function notasNaoEnviadas() {
  return ler().filter((n) => n.enviado !== true)
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
  // Resumo, nao a string inteira (#87). Pra investigar bug isto basta.
  L.push('Aparelho: ' + (typeof navigator !== 'undefined' ? resumoAparelho(navigator.userAgent) : '-'))
  L.push('Tela: ' + (typeof screen !== 'undefined' ? screen.width + 'x' + screen.height : '-'))
  L.push('Recados guardados neste aparelho por ate ' + DIAS_RETENCAO_LOCAL + ' dias.')
  L.push('')
  L.push('--- CONEXAO AGORA ---')
  L.push('Falando com a nuvem: ' + (net.online ? 'sim' : 'NAO'))
  L.push('Ultima resposta boa: ' + (net.lastOkAt ? linhaData(new Date(net.lastOkAt).toISOString()) : 'nenhuma'))
  L.push('Vendas/alteracoes ainda nao enviadas: ' + net.pending)
  if (pedidosEmCache !== null) L.push('Pedidos no cache do aparelho: ' + pedidosEmCache)
  L.push('')

  L.push('--- RECADOS DO OPERADOR (' + notas.length + ') ---')
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
        n.pendentes +
        ' | chegou na nuvem: ' +
        (n.enviado ? 'sim' : 'nao'),
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
