/**
 * Prova de conteudo do que esta REALMENTE publicado num canal (issue #124).
 *
 * Historico curto e feio: o CI ja acusou "deploy succeeded" tres vezes com a
 * producao congelada num commit velho (#67, #104, #124). Deploy verde nao e
 * prova de nada — prova e baixar o que o canal esta servindo e achar a marca
 * do commit la dentro.
 *
 * O que este script confere, em ordem:
 *
 *   1. `version.json` do canal (carimbado no build) e, se pedirem, se o `sha`
 *      bate com o commit esperado.
 *   2. `index.html` do canal aponta para um bundle de entrada em /assets.
 *   3. Esse bundle EXISTE de verdade: status 200 + content-type de JavaScript.
 *      Isso pega a armadilha do SPA: rewrite `** -> /index.html` devolve 200 e
 *      HTML para arquivo inexistente, entao "deu 200" nao significa que o
 *      arquivo foi publicado.
 *   4. Opcionalmente, marcadores de texto dentro do bundle (--marcador), que e
 *      como a #124 foi diagnosticada na mao.
 *
 * Uso:
 *   node scripts/verifica-publicado.mjs <url-base> [opcoes]
 *
 *   --sha=<commit>         exige que version.json sirva exatamente esse commit
 *   --marcador=<texto>     exige o texto dentro do bundle (pode repetir)
 *   --tentativas=<n>       repete ate propagar (padrao 1)
 *   --intervalo=<seg>      espera entre tentativas (padrao 10)
 *
 * Sai com codigo 0 so quando tudo passa. Qualquer duvida = codigo 1.
 */

const args = process.argv.slice(2)
const base = (args.find((a) => !a.startsWith('--')) || '').replace(/\/+$/, '')
const opt = (nome, padrao = null) => {
  const achado = args.find((a) => a.startsWith(`--${nome}=`))
  return achado ? achado.slice(nome.length + 3) : padrao
}
const todos = (nome) =>
  args.filter((a) => a.startsWith(`--${nome}=`)).map((a) => a.slice(nome.length + 3))

if (!base) {
  console.error('uso: node scripts/verifica-publicado.mjs <url-base> [--sha=] [--marcador=] [--tentativas=] [--intervalo=]')
  process.exit(2)
}

const shaEsperado = opt('sha')
const marcadores = todos('marcador')
const tentativas = Number(opt('tentativas', '1')) || 1
const intervalo = (Number(opt('intervalo', '10')) || 10) * 1000

const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
const semCache = { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }

async function pega(url) {
  const r = await fetch(url, semCache)
  return { status: r.status, tipo: r.headers.get('content-type') || '', corpo: await r.text() }
}

/** Uma passada completa. Devolve {ok, motivo, info}. Nunca lanca. */
async function verificar() {
  const info = {}

  // 1. version.json — o carimbo do build
  let versao
  try {
    const r = await pega(`${base}/version.json`)
    if (r.status !== 200) return { ok: false, motivo: `version.json respondeu ${r.status}`, info }
    versao = JSON.parse(r.corpo)
  } catch (e) {
    return { ok: false, motivo: `version.json ilegivel: ${e.message}`, info }
  }
  info.sha = versao.sha
  info.env = versao.env
  info.built_at = versao.built_at
  if (shaEsperado && versao.sha !== shaEsperado) {
    return { ok: false, motivo: `canal serve ${versao.sha} e nao ${shaEsperado}`, info }
  }

  // 2. index.html -> bundle de entrada
  let indice
  try {
    indice = await pega(`${base}/`)
  } catch (e) {
    return { ok: false, motivo: `index.html inacessivel: ${e.message}`, info }
  }
  if (indice.status !== 200) return { ok: false, motivo: `index.html respondeu ${indice.status}`, info }

  const entradas = [...indice.corpo.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1])
  if (entradas.length === 0) {
    return { ok: false, motivo: 'index.html publicado nao referencia nenhum script', info }
  }
  const caminho = entradas[0].startsWith('http') ? entradas[0] : `${base}/${entradas[0].replace(/^\//, '')}`
  info.bundle = caminho

  // 3. o bundle existe MESMO (SPA devolve 200 + HTML para arquivo que nao existe)
  let bundle
  try {
    bundle = await pega(caminho)
  } catch (e) {
    return { ok: false, motivo: `bundle inacessivel: ${e.message}`, info }
  }
  if (bundle.status !== 200) return { ok: false, motivo: `bundle respondeu ${bundle.status}`, info }
  if (!/javascript|ecmascript/i.test(bundle.tipo)) {
    return { ok: false, motivo: `bundle veio como '${bundle.tipo}' (fallback do SPA, arquivo nao publicado)`, info }
  }
  info.bytes = bundle.corpo.length

  // 4. marcadores de conteudo, quando pedidos
  const faltando = marcadores.filter((m) => !bundle.corpo.includes(m))
  if (faltando.length) {
    return { ok: false, motivo: `marcador ausente no bundle: ${faltando.join(', ')}`, info }
  }

  return { ok: true, motivo: 'conteudo publicado confere', info }
}

let resultado
for (let i = 1; i <= tentativas; i++) {
  resultado = await verificar()
  if (resultado.ok) break
  if (i < tentativas) {
    console.log(`tentativa ${i}/${tentativas}: ${resultado.motivo} (aguardando propagacao)`)
    await dorme(intervalo)
  }
}

const { ok, motivo, info } = resultado
console.log(`\nCanal:   ${base}`)
console.log(`sha:     ${info.sha ?? '?'}   env: ${info.env ?? '?'}   build: ${info.built_at ?? '?'}`)
console.log(`bundle:  ${info.bundle ?? '?'}${info.bytes ? ` (${info.bytes} bytes)` : ''}`)
if (marcadores.length) console.log(`marcadores exigidos: ${marcadores.join(', ')}`)
console.log(ok ? `OK: ${motivo}\n` : `FALHA: ${motivo}\n`)
process.exit(ok ? 0 : 1)
