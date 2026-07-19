/**
 * Roteamento por URL no navegador de verdade (issue #107, item 1).
 *
 * O `npm run rotas` prova a tabela de enderecos, que e logica pura. Isto aqui
 * prova a outra metade, a que aquele teste NAO alcanca: que o roteador entrou
 * por baixo do App.jsx sem derrubar o fluxo do balcao. O App tem 559 linhas e
 * o piloto (#35) esta para rodar numa barraca de verdade — trocar a navegacao
 * as cegas nao era opcao.
 *
 * O que este teste garante, em ordem de gravidade:
 *
 *   1. A raiz `/` continua abrindo o app. E o start_url do PWA ja instalado
 *      no tablet; se isso quebrar, a barraca abre o app e nao ve nada.
 *   2. Da para montar pedido no Caixa (produto entra no carrinho).
 *   3. Trocar de tela muda o endereco, e o Voltar do navegador (que no
 *      Android e o botao fisico) volta de TELA em vez de sair do app.
 *   4. Abrir um endereco direto — recarregar em /fechamento — cai na tela
 *      certa, e nao no Caixa.
 *   5. Endereco desconhecido nao mostra erro: cai no Caixa. Quem digitou
 *      errado no meio do movimento precisa vender.
 *   6. As paginas publicas NAO carregam o app (a separacao de carregamento
 *      so vale se for verdade no HTML servido, nao no papel).
 *
 * COMO RODAR. Precisa de um servidor servindo o build e, para cair no modo
 * local em vez da tela de Login, de um build SEM credenciais Supabase:
 *
 *   VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run build
 *   npx vite preview --port 4181
 *   ALVO=http://localhost:4181 npm run rotas-navegador
 *
 * (Era exatamente esse pulo do gato que faltava no `fale-com-dev`, que falha
 * hoje por cair na tela de Login — ver #108.)
 */
import { chromium } from 'playwright-core'

const EXEC = process.env.HOME + '/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome'
const BASE = process.env.ALVO || 'http://127.0.0.1:4180'

let falhas = 0
const ok = (nome, cond, extra) => {
  if (!cond) falhas++
  console.log((cond ? 'OK   ' : 'FALHA') + ' ' + nome + (extra ? '  [' + extra + ']' : ''))
}

const nav = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-gpu'] })
const pg = await nav.newPage({ viewport: { width: 1280, height: 900 } })
const erros = []
pg.on('pageerror', (e) => erros.push(e.message))

// --- raiz abre o app e normaliza para /caixa -------------------------
await pg.goto(BASE + '/', { waitUntil: 'networkidle' })
await pg.waitForSelector('.app-header', { timeout: 15000 })
ok('Raiz abre o app', true)
ok('Raiz normaliza para /caixa', new URL(pg.url()).pathname === '/caixa', pg.url())

// --- fluxo do Caixa: montar pedido ------------------------------------
const produtos = pg.locator('.products .product .btn-add')
const qtd = await produtos.count()
ok('Cardapio tem produtos', qtd > 0, qtd + ' itens')
await produtos.first().click()
await pg.waitForTimeout(300)
const carrinho = await pg.locator('.cart-list').innerText()
ok('Item entrou no carrinho', carrinho.length > 0)

// --- navegar muda a URL ------------------------------------------------
const irPara = async (rotulo, pathEsperado) => {
  await pg.getByRole('button', { name: rotulo, exact: true }).first().click()
  await pg.waitForTimeout(400)
  ok(`Navegar para ${rotulo} muda a URL`, new URL(pg.url()).pathname === pathEsperado, pg.url())
}
await irPara('Produção', '/producao')
await irPara('Fechamento', '/fechamento')

// --- botao Voltar do navegador -----------------------------------------
await pg.goBack()
await pg.waitForTimeout(400)
ok('Voltar do navegador volta para /producao', new URL(pg.url()).pathname === '/producao', pg.url())
const temHeader = await pg.locator('.app-header').count()
ok('App continua de pe apos Voltar', temHeader === 1)

// --- recarregar em /fechamento mantem a tela ---------------------------
await pg.goto(BASE + '/fechamento', { waitUntil: 'networkidle' })
await pg.waitForSelector('.app-header', { timeout: 15000 })
ok('Abrir /fechamento direto mantem a tela', new URL(pg.url()).pathname === '/fechamento', pg.url())
const corpo = await pg.locator('.app-main').innerText()
ok('Tela de Fechamento renderizou', corpo.length > 0)

// --- endereco desconhecido cai no Caixa --------------------------------
await pg.goto(BASE + '/nao-existe', { waitUntil: 'networkidle' })
await pg.waitForSelector('.app-header', { timeout: 15000 })
ok('Endereco desconhecido cai no Caixa', new URL(pg.url()).pathname === '/caixa', pg.url())

// --- paginas publicas: sem JS do app -----------------------------------
for (const p of ['/site/index.html', '/site/planos.html', '/site/privacidade.html']) {
  const r = await pg.goto(BASE + p, { waitUntil: 'networkidle' })
  const html = await pg.content()
  ok(`${p} responde 200`, r.status() === 200, String(r.status()))
  ok(`${p} tem conteudo no HTML servido`, /<h1/.test(html))
  const temApp = await pg.evaluate(() => !!document.getElementById('root'))
  ok(`${p} nao carrega o app`, temApp === false)
}

ok('Nenhum erro de pagina', erros.length === 0, erros.slice(0, 3).join(' | '))

await nav.close()
console.log('')
if (falhas) { console.error(falhas + ' falha(s).'); process.exit(1) }
console.log('Fumaca ok.')
