// Fumaca de render das telas (issue #113).
//
// POR QUE ISTO EXISTE. A #113 foi uma prop que o App passava e a tela nao
// declarava: `initialSection`. Em modulo ES isso nao vira `undefined`, vira
// ReferenceError no meio do render — ou seja, Configuracoes parava de abrir
// INTEIRA, tela branca. E passou por lint, por `npm run build` e por PR.
//
// Nenhum dos testes que existiam MONTA componente: eles conferem regra de
// negocio pura, rota e contraste. Build so garante que compila; compilar nao
// e a mesma coisa que renderizar. Este arquivo fecha exatamente esse buraco:
// pega cada tela principal, renderiza de verdade e falha se estourar.
//
// Nao e teste de aparencia. Nao confere layout — so responde "esta tela
// ABRE?", que era a pergunta que ninguem estava fazendo.

import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { createServer } from 'vite'

// O supabase-js instancia o Realtime no import e exige WebSocket no Node 20.
// Aqui nada abre conexao — o teste so renderiza —, entao um esqueleto basta.
globalThis.WebSocket = class {
  constructor() {}
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

const settings = { operationMode: 'cashier_production_sync' }
const menuProps = {
  products: [],
  onCreate: () => {},
  onUpdate: () => {},
  onDelete: () => {},
  onRestore: () => {},
}

const baseSettings = {
  settings,
  role: 'dono',
  menuProps,
  notify: () => {},
  subscription: null,
}

// [arquivo, nome, props]. As props sao o MINIMO que a tela precisa; o ponto
// nao e simular o app, e provar que o render nao explode.
const TELAS = [
  ['/src/routes/Production.jsx', 'Producao', { orders: [] }],
  ['/src/routes/Closing.jsx', 'Fechamento', { orders: [], closings: [] }],
  ['/src/routes/Settings.jsx', 'Configuracoes (dono)', baseSettings],
  [
    '/src/routes/Settings.jsx',
    'Configuracoes (operador)',
    { ...baseSettings, role: 'operador' },
  ],
  // O caso EXATO da #113: quem chega do site comercial com plano escolhido
  // cai direto em Minha assinatura. Era esta chamada que derrubava a tela.
  [
    '/src/routes/Settings.jsx',
    'Configuracoes (vindo do site, secao assinatura)',
    { ...baseSettings, initialSection: 'assinatura' },
  ],
]

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

let falhas = 0

for (const [arquivo, nome, props] of TELAS) {
  try {
    const mod = await server.ssrLoadModule(arquivo)
    const html = renderToString(createElement(mod.default, props))
    if (!html || !html.length) throw new Error('render vazio')
    console.log(`ok    ${nome}`)
  } catch (e) {
    falhas += 1
    console.log(`FALHA ${nome}: ${e && e.name}: ${e && e.message}`)
  }
}

// A secao aberta tem que ser a que o App pediu, senao a prop volta a ser
// decorativa e o bug reaparece sem ninguem ver.
try {
  const mod = await server.ssrLoadModule('/src/routes/Settings.jsx')
  const html = renderToString(
    createElement(mod.default, { ...baseSettings, initialSection: 'assinatura' }),
  )
  if (!html.includes('Minha assinatura')) {
    throw new Error('initialSection nao abriu a secao pedida')
  }
  console.log('ok    initialSection abre a secao pedida')
} catch (e) {
  falhas += 1
  console.log(`FALHA initialSection: ${e && e.message}`)
}

await server.close()

if (falhas) {
  console.log(`\n${falhas} falha(s).`)
  process.exit(1)
}
console.log('\nTodas as telas renderizaram.')
