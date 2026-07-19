/**
 * Gera a previa do SITE COMERCIAL num arquivo HTML unico — issue #111.
 *
 * Mesma ideia do `npm run previa` (#71): usa o JSX e o CSS de VERDADE. Se
 * alguem mexer no site, a previa muda junto — nao existe versao de propaganda
 * divergindo do que vai pro ar.
 *
 * Por que build de verdade e nao SSR: os planos e as novidades chegam por
 * efeito, depois da montagem. Renderizado no servidor o site sairia todo no
 * estado "Carregando". Aqui o React roda no navegador, igual em producao.
 *
 * Os planos e novidades sao trocados por dados de EXEMPLO via alias, para a
 * previa nao depender do Supabase. Os valores oficiais vivem na tabela
 * `planos`; os numeros da previa sao ilustrativos.
 *
 * Uso: npm run previa-site  ->  public/previa-site-comercial.html
 */
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = join(raiz, '.previa-site')

const PLANOS_EXEMPLO = [
  { codigo: 'plano_1', nome: 'Essencial', descricao: 'Só o caixa', descricao_comercial: 'Para começar só no caixa', max_usuarios: 1, valor_mensal: 49.9, taxa_implantacao: 0, ordem: 1 },
  { codigo: 'plano_2', nome: 'Operação', descricao: 'Caixa e produção', descricao_comercial: 'Para caixa e produção conectados', max_usuarios: 3, valor_mensal: 89.9, taxa_implantacao: 0, ordem: 2 },
  { codigo: 'plano_3', nome: 'Equipe', descricao: 'Equipes maiores', descricao_comercial: 'Para equipes em crescimento', max_usuarios: 6, valor_mensal: 149.9, taxa_implantacao: 199, ordem: 3 },
]
const NOVIDADES_EXEMPLO = [
  { slug: 'a', categoria: 'Melhoria', titulo: 'Pedidos mais claros para a produção', resumo: 'Informações organizadas para facilitar a leitura dos itens, observações e andamento.', publicado_em: new Date().toISOString(), destaque: true },
  { slug: 'b', categoria: 'Melhoria', titulo: 'Mais clareza durante oscilações de internet', resumo: 'Identificação mais simples do que já foi sincronizado e do que ainda está aguardando.', publicado_em: new Date().toISOString(), destaque: false },
  { slug: 'c', categoria: 'Em breve', titulo: 'Atendimento mais automático', resumo: 'Estamos preparando o autoatendimento por totem integrado ao fluxo da produção.', publicado_em: new Date().toISOString(), destaque: false },
]

mkdirSync(tmp, { recursive: true })

const stub = join(tmp, 'marketingService.js')
writeFileSync(stub, `
export async function listarPlanosPublicos() { return ${JSON.stringify(PLANOS_EXEMPLO)} }
export async function listarNovidadesPublicas(limit = 3) { return ${JSON.stringify(NOVIDADES_EXEMPLO)}.slice(0, limit) }
`)

const entrada = join(tmp, 'entrada.jsx')
writeFileSync(entrada, `
import { createRoot } from 'react-dom/client'
import MarketingSite from '../src/marketing/MarketingSite.jsx'
createRoot(document.getElementById('previa')).render(<MarketingSite />)
`)

const htmlEntrada = join(tmp, 'index.html')
writeFileSync(htmlEntrada, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Prévia — site comercial do Barraca Easy</title></head>
<body><div id="previa"></div><script type="module" src="./entrada.jsx"></script></body></html>`)

await build({
  root: tmp,
  configFile: false,
  plugins: [react()],
  resolve: { alias: [{ find: './marketingService.js', replacement: stub }] },
  logLevel: 'error',
  build: {
    outDir: join(tmp, 'dist'),
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    codeSplitting: false,
  },
})

// Junta tudo num arquivo so, para o Felipe abrir com dois cliques.
const distDir = join(tmp, 'dist')
let html = readFileSync(join(distDir, 'index.html'), 'utf8')
const { readdirSync } = await import('node:fs')
const assets = readdirSync(join(distDir, 'assets'))
const js = assets.find((f) => f.endsWith('.js'))
const css = assets.find((f) => f.endsWith('.css'))

html = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/,
  `<script type="module">${readFileSync(join(distDir, 'assets', js), 'utf8')}</script>`)
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/,
  `<style>${readFileSync(join(distDir, 'assets', css), 'utf8')}</style>`)

const aviso = `<p style="position:sticky;top:0;z-index:99;background:#111;color:#fff;
margin:0;font:14px/1.5 system-ui,sans-serif;padding:10px 16px;text-align:center">
PRÉVIA — issue #111. Planos e novidades são <b style="color:#ffcf5c">dados de exemplo</b>;
os valores oficiais vêm do banco. Links não navegam nesta prévia.</p>`
html = html.replace('<body>', '<body>' + aviso)

const saida = join(raiz, 'public/previa-site-comercial.html')
writeFileSync(saida, html)
rmSync(tmp, { recursive: true, force: true })
console.log('Previa gerada:', saida, `(${(html.length / 1024).toFixed(0)} kB)`)
