/**
 * Fluxo manual minimo do MVP, automatizado (issue #71).
 *
 * Existe para provar que uma mexida de estilo nao mexeu em comportamento:
 * pedido -> popup de pagamento -> senha fisica -> bloqueio de duplicada ->
 * producao -> chamar -> entregar -> cancelar -> fechamento -> configuracoes.
 *
 * NAO e dependencia do projeto de proposito: o app nao carrega playwright em
 * producao e nao vale inflar o node_modules de quem so quer rodar o app.
 * Para usar:
 *
 *   npm i --no-save playwright-core
 *   VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npx vite build
 *   npx vite preview --port 4178 --host 127.0.0.1 &
 *   node scripts/fluxo-mvp.mjs
 *
 * O build precisa sair sem Supabase: sem nuvem configurada o app entra em
 * modo local e pula o login, que e o que interessa aqui.
 */
import { chromium } from 'playwright-core'

const URL = process.env.ALVO || 'http://127.0.0.1:4178/'
const EXEC =
  process.env.HOME + '/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome'

const passos = []
function ok(nome, cond, extra) {
  passos.push({ nome, cond, extra: extra || '' })
  console.log((cond ? 'OK   ' : 'FALHA') + ' ' + nome + (extra ? '  [' + extra + ']' : ''))
}

const navegador = await chromium.launch({
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-gpu'],
})
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 900 } })
pagina.on('pageerror', (e) => console.log('ERRO DE PAGINA:', e.message))
await pagina.goto(URL, { waitUntil: 'networkidle' })

// --- 1. Caixa: monta o pedido ---------------------------------------
await pagina.waitForSelector('.product')
const produtos = await pagina.locator('.product').count()
ok('Caixa carrega a grade de produtos', produtos > 0, produtos + ' produtos')

await pagina.locator('.product', { hasText: /R\$/ }).first().getByText('Adicionar').click()
await pagina.locator('.product').nth(1).getByText('Adicionar').click()
const itensCarrinho = await pagina.locator('.cart-item').count()
ok('Itens entram no carrinho', itensCarrinho === 2, itensCarrinho + ' linhas')

const totalTexto = await pagina.locator('.total').innerText()
ok('Carrinho mostra total', /R\$/.test(totalTexto), totalTexto.replace(/\n/g, ' '))

await pagina.locator('.payment-grid button', { hasText: 'Pix' }).click()
const pixSelecionado = await pagina
  .locator('.payment-grid button.selected')
  .innerText()
ok('Forma de pagamento selecionavel', pixSelecionado.trim() === 'Pix', pixSelecionado)

// --- 2. Popup Aguardando pagamento ----------------------------------
await pagina.getByRole('button', { name: 'Confirmar pedido' }).click()
await pagina.waitForSelector('.modal')
const tituloModal = await pagina.locator('.modal h2').innerText()
ok('Abre popup de pagamento', /pagamento/i.test(tituloModal), tituloModal)
await pagina.screenshot({ path: '/tmp/fluxo_modal.png' })

// --- 3. Informa a senha fisica --------------------------------------
await pagina.locator('.modal input').fill('50')
await pagina.getByRole('button', { name: 'Pagamento confirmado' }).click()
await pagina.waitForSelector('.ticket-number')
const senha = await pagina.locator('.ticket-number').innerText()
ok('Registra a senha fisica informada', senha.trim() === '050', senha)
await pagina.screenshot({ path: '/tmp/fluxo_senha.png' })

await pagina.getByRole('button', { name: 'Próximo cliente' }).click()

// --- 4. Senha duplicada e bloqueada ---------------------------------
await pagina.locator('.product').first().getByText('Adicionar').click()
await pagina.locator('.payment-grid button', { hasText: 'Dinheiro' }).click()
await pagina.getByRole('button', { name: 'Confirmar pedido' }).click()
await pagina.waitForSelector('.modal')
await pagina.locator('.modal input').fill('50')
await pagina.getByRole('button', { name: 'Pagamento confirmado' }).click()
await pagina.waitForTimeout(600)
const aindaNoModal = await pagina.locator('.modal').count()
const aviso = await pagina.locator('.toast.show').count()
ok(
  'Bloqueia senha duplicada no mesmo dia',
  aindaNoModal > 0 || aviso > 0,
  'modal aberto=' + aindaNoModal + ' toast=' + aviso,
)

await pagina.locator('.modal input').fill('51')
await pagina.getByRole('button', { name: 'Pagamento confirmado' }).click()
await pagina.waitForSelector('.ticket-number')
ok('Aceita senha nova', (await pagina.locator('.ticket-number').innerText()).trim() === '051')
await pagina.getByRole('button', { name: 'Próximo cliente' }).click()

// --- 5. Producao ----------------------------------------------------
await pagina.getByRole('button', { name: 'Produção', exact: true }).click()
await pagina.waitForSelector('.order-card')
const naFila = await pagina.locator('.order-card').count()
ok('Pedidos pagos entram na producao', naFila === 2, naFila + ' pedidos')
await pagina.screenshot({ path: '/tmp/fluxo_producao.png' })

await pagina.locator('.order-card').first().getByText('Chamar senha').click()
await pagina.waitForTimeout(300)
const chamados = await pagina.locator('.status.called').count()
ok('Chamar senha muda o status', chamados === 1, chamados + ' chamado(s)')

await pagina.locator('.order-card').first().getByText('Entregue / OK').click()
await pagina.waitForTimeout(400)
const restantes = await pagina.locator('.order-card').count()
ok('Entregue sai da fila', restantes === 1, restantes + ' restante(s)')

// --- 6. Cancelamento ------------------------------------------------
pagina.once('dialog', (d) => d.accept())
await pagina.locator('.order-card').first().getByText('Cancelar').click()
await pagina.waitForTimeout(500)
const filaVazia = await pagina.locator('.order-card').count()
ok('Cancelar remove da fila', filaVazia === 0, filaVazia + ' na fila')

// --- 7. Fechamento --------------------------------------------------
await pagina.getByRole('button', { name: 'Fechamento', exact: true }).click()
await pagina.waitForSelector('.metric')
const metricas = await pagina.locator('.metric').allInnerTexts()
const textoFechamento = metricas.join(' | ').replace(/\n/g, ' ')
ok('Fechamento mostra metricas', metricas.length >= 4, textoFechamento)
const canceladoFora = await pagina.getByText(/cancelado\(s\)/).count()
ok('Sinaliza cancelados fora do faturamento', canceladoFora > 0)
await pagina.screenshot({ path: '/tmp/fluxo_fechamento.png' })

// --- 8. Configuracoes -----------------------------------------------
await pagina.locator('.settings-gear').click()
await pagina.waitForSelector('.settings-nav-btn')
await pagina.locator('.settings-nav-btn', { hasText: /Modo de opera/i }).click()
await pagina.waitForSelector('.mode-card')
const modos = await pagina.locator('.mode-card').count()
ok('Configuracoes mostram os 3 modos', modos === 3, modos + ' modos')
const selecionado = await pagina.locator('.mode-card.selected h3').innerText()
ok('Modo padrao e o sincronizado', /Sincronizado/i.test(selecionado), selecionado)
await pagina.screenshot({ path: '/tmp/fluxo_config.png' })

// --- 9. Persistencia ------------------------------------------------
await pagina.reload({ waitUntil: 'networkidle' })
await pagina.waitForTimeout(800)
const depois = await pagina.evaluate(() => Object.keys(localStorage).length)
ok('Dados persistem em localStorage', depois > 0, depois + ' chaves')

await navegador.close()

const falhas = passos.filter((p) => !p.cond)
console.log('\n' + (passos.length - falhas.length) + '/' + passos.length + ' passos OK')
if (falhas.length) process.exit(1)
