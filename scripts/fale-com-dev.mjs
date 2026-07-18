/**
 * Fale com o desenvolvedor — teste do caminho completo (#85).
 *
 * Prova o que interessa: o megafone sumiu, o link discreto existe em todas as
 * telas, as tres categorias estao la, e — o mais importante — o recado NAO se
 * perde quando nao ha nuvem (que e o caso do modo local).
 */
import { chromium } from 'playwright-core'

const URL = process.env.ALVO || 'http://127.0.0.1:4178/'
const EXEC = process.env.HOME + '/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome'
const [LARG, ALT] = (process.env.VIEWPORT || '1280x900').split('x').map(Number)

const passos = []
function ok(nome, cond, extra) {
  passos.push({ nome, cond })
  console.log((cond ? 'OK   ' : 'FALHA') + ' ' + nome + (extra ? '  [' + extra + ']' : ''))
}

const navegador = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-gpu'] })
const pagina = await navegador.newPage({ viewport: { width: LARG, height: ALT } })
pagina.on('pageerror', (e) => console.log('ERRO DE PAGINA:', e.message))
await pagina.goto(URL, { waitUntil: 'networkidle' })
console.log('viewport ' + LARG + 'x' + ALT)

// --- 1. O megafone tem que ter sumido ---------------------------------
await pagina.waitForSelector('.app-header')
const cabecalho = await pagina.locator('.app-header').innerText()
ok('Megafone fora do cabecalho', !/📣/.test(cabecalho))
const btnAntigo = await pagina.locator('.pilot-note-btn').count()
ok('Botao antigo do piloto nao existe mais', btnAntigo === 0, btnAntigo + ' encontrados')

// --- 2. Entrada discreta, em todas as telas ---------------------------
const link = pagina.getByRole('button', { name: 'Fale com o desenvolvedor' })
ok('Link no rodape com o rotulo pedido', (await link.innerText()).trim() === 'Fale com o desenvolvedor')
const noRodape = await pagina.evaluate(() => {
  const l = document.querySelector('.app-footer .dev-feedback-link')
  const main = document.querySelector('.app-main')
  return l.getBoundingClientRect().top > main.getBoundingClientRect().top
})
ok('Fica no rodape, abaixo do conteudo', noRodape)

for (const tela of ['Produção', 'Fechamento']) {
  await pagina.getByRole('button', { name: tela, exact: true }).click()
  await pagina.waitForTimeout(200)
  const achados = await pagina.getByRole('button', { name: 'Fale com o desenvolvedor' }).count()
  ok('Link continua na tela ' + tela, achados === 1, achados + ' encontrado(s)')
}
await pagina.getByRole('button', { name: 'Caixa', exact: true }).click()

// --- 3. A tela de feedback --------------------------------------------
await pagina.getByRole('button', { name: 'Fale com o desenvolvedor' }).click()
await pagina.waitForSelector('.dev-feedback-modal')
const titulo = await pagina.locator('.dev-feedback-modal h2').innerText()
ok('Abre a tela com o titulo certo', titulo.trim() === 'Fale com o desenvolvedor', titulo)

const tipos = await pagina.locator('.dev-feedback-tipo strong').allInnerTexts()
ok(
  'Tres categorias: problema, melhoria, elogio',
  tipos.length === 3 &&
    /problema/i.test(tipos[0]) &&
    /melhoria/i.test(tipos[1]) &&
    /elogio/i.test(tipos[2]),
  tipos.join(' / '),
)

const enviarDesativado = await pagina.getByRole('button', { name: 'Enviar' }).isDisabled()
ok('Enviar comeca travado (sem assunto escolhido)', enviarDesativado)

// Elogio sem texto nao passa: elogio vazio nao diz nada.
await pagina.locator('.dev-feedback-tipo', { hasText: 'elogio' }).click()
ok('Elogio sem texto continua travado', await pagina.getByRole('button', { name: 'Enviar' }).isDisabled())
await pagina.locator('.dev-feedback-campo textarea').fill('A fila da producao ficou facil de acompanhar')
ok('Com texto, libera o envio', !(await pagina.getByRole('button', { name: 'Enviar' }).isDisabled()))
await pagina.getByRole('button', { name: 'Enviar' }).click()
await pagina.waitForTimeout(500)
ok('Tela fecha depois de enviar', (await pagina.locator('.dev-feedback-modal').count()) === 0)

// --- 4. Sem nuvem, o recado NAO se perde -------------------------------
const guardado = await pagina.evaluate(() => JSON.parse(localStorage.getItem('barracaEasyPilotLog') || '[]'))
ok('Recado guardado no aparelho', guardado.length === 1, JSON.stringify(guardado[0] || {}).slice(0, 120))
ok('Tipo gravado como elogio', guardado[0] && guardado[0].categoria === 'elogio')
ok('Texto gravado', guardado[0] && /fila da producao/.test(guardado[0].texto))
ok('Contexto automatico junto (tela/conexao)', guardado[0] && guardado[0].tela === 'Caixa' && 'online' in guardado[0])
ok('Marcado como ainda nao enviado (sem nuvem)', guardado[0] && guardado[0].enviado === false)

// Problema pode ir sem texto: o contexto ja diz muita coisa.
await pagina.getByRole('button', { name: 'Fale com o desenvolvedor' }).click()
await pagina.locator('.dev-feedback-tipo', { hasText: 'problema' }).click()
ok('Problema sem texto pode ser enviado', !(await pagina.getByRole('button', { name: 'Enviar' }).isDisabled()))
await pagina.getByRole('button', { name: 'Enviar' }).click()
await pagina.waitForTimeout(400)

// --- 5. Sobrevive a recarga e aparece no relatorio ---------------------
await pagina.reload({ waitUntil: 'networkidle' })
await pagina.waitForTimeout(600)
const depois = await pagina.evaluate(() => JSON.parse(localStorage.getItem('barracaEasyPilotLog') || '[]'))
ok('Recados sobrevivem a recarga', depois.length === 2, depois.length + ' recados')

await pagina.locator('.settings-gear').click()
await pagina.waitForSelector('.settings-nav-btn')
await pagina.locator('.settings-nav-btn', { hasText: 'Piloto' }).click()
await pagina.waitForSelector('.pilot-notes')
const listados = await pagina.locator('.pilot-notes li').count()
ok('Recados aparecem na secao Piloto', listados === 2, listados + ' na lista')
const textoLista = await pagina.locator('.pilot-notes').innerText()
ok('Rotulo novo aparece na lista', /elogio/i.test(textoLista), textoLista.split('\n')[0])
ok('Mostra que ainda esta no aparelho', /ainda no aparelho/.test(textoLista))
await pagina.screenshot({ path: '/tmp/fb_piloto.png', fullPage: false })

await navegador.close()
const falhas = passos.filter((p) => !p.cond)
console.log('\n' + (passos.length - falhas.length) + '/' + passos.length + ' passos OK')
if (falhas.length) process.exit(1)
