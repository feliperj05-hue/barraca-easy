/**
 * LGPD — minimizacao e retencao (#87).
 *
 * Prova pelas duas pontas:
 * 1. Funcoes puras (resumo do aparelho, corte por prazo), sem navegador.
 * 2. App de verdade: o que fica gravado depois de mandar um recado, e o que
 *    acontece com recado velho plantado no aparelho.
 */
import { chromium } from 'playwright-core'
import { resumoAparelho, origemDoApp, filtrarPorRetencao, DIAS_RETENCAO_LOCAL } from '../src/services/privacidade.js'

const URL = process.env.ALVO || 'http://127.0.0.1:4178/'
const EXEC = process.env.HOME + '/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome'

const passos = []
function ok(nome, cond, extra) {
  passos.push({ nome, cond })
  console.log((cond ? 'OK   ' : 'FALHA') + ' ' + nome + (extra ? '  [' + extra + ']' : ''))
}

// ---------- 1. Funcoes puras ----------
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
const UA_SAMSUNG =
  'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/19.0 Chrome/102.0.0.0 Mobile Safari/537.36'

ok('Resume Android + Chrome', resumoAparelho(UA_ANDROID) === 'Android 13 · Chrome', resumoAparelho(UA_ANDROID))
ok('Resume iPhone + Safari', resumoAparelho(UA_IPHONE) === 'iOS 17 · Safari', resumoAparelho(UA_IPHONE))
ok('Samsung Internet nao vira Chrome', resumoAparelho(UA_SAMSUNG) === 'Android 12 · Samsung Internet', resumoAparelho(UA_SAMSUNG))
ok('Sem user-agent nao quebra', resumoAparelho('') === 'nao informado')

// O que importa de verdade: o modelo do aparelho nao pode sobreviver ao resumo.
ok('Modelo do aparelho nao passa (SM-A536E)', !resumoAparelho(UA_ANDROID).includes('SM-A536E'))
ok('Versao detalhada do navegador nao passa', !resumoAparelho(UA_ANDROID).includes('120.0.0.0'))
ok('Resumo e curto', resumoAparelho(UA_ANDROID).length < 30, resumoAparelho(UA_ANDROID).length + ' caracteres')

ok('URL vira so a origem', origemDoApp('https://barraca-easy.web.app/caixa?x=1#y') === 'https://barraca-easy.web.app')
ok('URL quebrada nao explode', origemDoApp('nao-e-url') === null)

const agora = new Date('2026-07-18T12:00:00Z')
const dia = 24 * 60 * 60 * 1000
const lista = [
  { id: 'novo', ts: new Date(agora.getTime() - 5 * dia).toISOString() },
  { id: 'limite', ts: new Date(agora.getTime() - (DIAS_RETENCAO_LOCAL - 1) * dia).toISOString() },
  { id: 'velho', ts: new Date(agora.getTime() - (DIAS_RETENCAO_LOCAL + 1) * dia).toISOString() },
  { id: 'antigo-demais', ts: new Date(agora.getTime() - 400 * dia).toISOString() },
  { id: 'data-quebrada', ts: 'nao-e-data' },
]
const ficam = filtrarPorRetencao(lista, agora).map((n) => n.id)
ok('Recado recente fica', ficam.includes('novo'))
ok('Recado no limite do prazo fica', ficam.includes('limite'))
ok('Recado passado do prazo sai', !ficam.includes('velho'))
ok('Recado de 400 dias sai', !ficam.includes('antigo-demais'))
ok('Data ilegivel nao apaga o recado de ninguem', ficam.includes('data-quebrada'))

// ---------- 2. App de verdade ----------
const navegador = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-gpu'] })
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 900 } })
pagina.on('pageerror', (e) => console.log('ERRO DE PAGINA:', e.message))
await pagina.goto(URL, { waitUntil: 'networkidle' })

// Manda um recado e confere o que foi parar no aparelho.
await pagina.getByRole('button', { name: 'Fale com o desenvolvedor' }).click()
await pagina.locator('.dev-feedback-tipo', { hasText: 'problema' }).click()
await pagina.locator('.dev-feedback-campo textarea').fill('teste de minimizacao')
await pagina.getByRole('button', { name: 'Enviar' }).click()
await pagina.waitForTimeout(400)

const gravado = await pagina.evaluate(() => localStorage.getItem('barracaEasyPilotLog'))
const uaReal = await pagina.evaluate(() => navigator.userAgent)
ok('Recado nao guarda user-agent no aparelho', !gravado.includes(uaReal.slice(0, 40)), 'ua nao encontrado')
ok('Recado nao guarda modelo/versao do navegador', !/AppleWebKit|Mozilla\/5\.0/.test(gravado))

// Relatorio de diagnostico: linha de aparelho tem que ser o resumo.
await pagina.locator('.settings-gear').click()
await pagina.waitForSelector('.settings-nav-btn')
await pagina.locator('.settings-nav-btn', { hasText: 'Piloto' }).click()
await pagina.getByRole('button', { name: 'Baixar relatório do piloto' }).click()
await pagina.waitForSelector('.pilot-preview')
await pagina.locator('.pilot-preview summary').click()
const relatorio = await pagina.locator('.pilot-preview pre').innerText()
ok('Relatorio nao traz o user-agent inteiro', !relatorio.includes(uaReal), 'string completa ausente')
ok('Relatorio traz o resumo do aparelho', /Aparelho: .+ · .+/.test(relatorio), (relatorio.match(/Aparelho: .*/) || [''])[0])
ok('Relatorio declara o prazo de guarda', /guardados neste aparelho por ate 90 dias/.test(relatorio))

// Retencao no app: planta um recado velho e ve ele sumir.
await pagina.evaluate((dias) => {
  const chave = 'barracaEasyPilotLog'
  const itens = JSON.parse(localStorage.getItem(chave) || '[]')
  itens.unshift({
    id: 'plantado-velho',
    ts: new Date(Date.now() - (dias + 30) * 24 * 60 * 60 * 1000).toISOString(),
    categoria: 'problema',
    texto: 'recado antigo que deve sumir',
    tela: 'Caixa',
    online: true,
    pendentes: 0,
    enviado: false,
  })
  localStorage.setItem(chave, JSON.stringify(itens))
}, DIAS_RETENCAO_LOCAL)

const antes = await pagina.evaluate(() => JSON.parse(localStorage.getItem('barracaEasyPilotLog')).length)
await pagina.reload({ waitUntil: 'networkidle' })
await pagina.waitForTimeout(500)
await pagina.locator('.settings-gear').click()
await pagina.locator('.settings-nav-btn', { hasText: 'Piloto' }).click()
await pagina.waitForTimeout(400)
const depois = await pagina.evaluate(() => JSON.parse(localStorage.getItem('barracaEasyPilotLog')))
ok('Recado velho foi apagado do aparelho', !depois.some((n) => n.id === 'plantado-velho'), antes + ' -> ' + depois.length)
ok('Recado recente continua la', depois.some((n) => /minimizacao/.test(n.texto || '')))

// ---------- 3. Politica de privacidade ----------
// Nome acessivel exato: separador de rodape nao pode virar texto do botao.
const nomes = await pagina.locator('.app-footer button').evaluateAll((bs) =>
  bs.map((b) => b.textContent.trim()),
)
ok('Rodape sem caractere de enfeite no nome dos botoes', nomes.every((n) => !/^[·|-]/.test(n)), nomes.join(' | '))
await pagina.locator('.privacy-link').click()
await pagina.waitForSelector('.privacy-modal')
const politica = await pagina.locator('.privacy-modal').innerText()
ok('Politica abre pelo rodape', /Privacidade e dados/.test(politica))
ok('Diz que nao guarda dado de cliente', /Nada sobre o cliente da barraca/.test(politica))
ok('Declara os prazos', /90 dias/.test(politica) && /12 meses/.test(politica))
ok('Declara onde o dado fica', /São Paulo/.test(politica))
ok('Aponta o canal de direitos do titular', /Fale com o desenvolvedor/.test(politica))
await pagina.screenshot({ path: '/tmp/lgpd_politica.png' })

await navegador.close()
const falhas = passos.filter((p) => !p.cond)
console.log('\n' + (passos.length - falhas.length) + '/' + passos.length + ' passos OK')
if (falhas.length) process.exit(1)
