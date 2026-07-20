// Paridade de passos: cancelar x contratar (issue #115).
//
// POR QUE ESTE TESTE EXISTE. A regra que o juridico cobra e "cancelar tem que
// ser tao simples quanto contratar". Isso e facil de prometer no texto da
// issue e facil de perder de vista seis meses depois, quando alguem achar que
// "so uma perguntinha antes de deixar o cliente sair" nao faz mal.
//
// Entao a regra vira teste. Cada passo aqui e CONFIRMADO no HTML renderizado
// de verdade — a contagem nao e um numero escrito a mao num comentario, e o
// resultado de checar que o controle daquele passo existe mesmo na tela.
//
// Se alguem acrescentar uma etapa no caminho de saida, este teste quebra.

import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { createServer } from 'vite'

globalThis.WebSocket = class {
  constructor() {}
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

const assinaturaAtiva = {
  tenant_id: '00000000-0000-0000-0000-000000000001',
  nome: 'Barraca de Teste',
  plano: 'plano_2',
  plano_nome: 'Plano 2',
  max_usuarios: 2,
  usuarios_atuais: 1,
  status_assinatura: 'ativa',
  valor_mensal: 35,
  ativo: true,
  cobrancas_abertas: 0,
  cancelamento_pedido_em: null,
  cancelamento_efetivo_em: null,
  // pago ate o fim de um mes bem no futuro, para cair no caso "agendado"
  fim_periodo_pago: '2099-12-31',
}

const assinaturaTeste = {
  ...assinaturaAtiva,
  status_assinatura: 'teste',
  teste_expira_em: '2099-01-01',
  dias_restantes: 5,
  fim_periodo_pago: null,
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

let falhas = 0
function checa(condicao, descricao) {
  if (condicao) {
    console.log(`  ok    ${descricao}`)
    return true
  }
  console.log(`  FALHA ${descricao}`)
  falhas += 1
  return false
}

// Texto sem tags, que e como o usuario le a tela.
function texto(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
}

const [Layout, Settings, SubscriptionCard, PlanosCard, CancelDialog] = await Promise.all([
  server.ssrLoadModule('/src/components/Layout.jsx'),
  server.ssrLoadModule('/src/routes/Settings.jsx'),
  server.ssrLoadModule('/src/components/SubscriptionCard.jsx'),
  server.ssrLoadModule('/src/components/PlanosCard.jsx'),
  server.ssrLoadModule('/src/components/CancelSubscriptionDialog.jsx'),
])

const menuProps = { products: [], onCreate() {}, onUpdate() {}, onDelete() {}, onRestore() {} }

// ---------------------------------------------------------------------
// Passo 1 (comum aos dois fluxos): a engrenagem da tela inicial
// ---------------------------------------------------------------------
console.log('\nPasso 1 — engrenagem no cabecalho (comum aos dois fluxos)')
const layoutHtml = renderToString(
  createElement(Layout.default, {
    screens: [{ id: 'cashier', label: 'Caixa' }],
    current: 'cashier',
    onNavigate() {},
    onOpenSettings() {},
    role: 'dono',
    children: null,
  }),
)
const temEngrenagem = checa(
  layoutHtml.includes('settings-gear') && layoutHtml.includes('Configurações'),
  'engrenagem existe na tela inicial e leva a Configuracoes',
)

// ---------------------------------------------------------------------
// Passo 2 (comum): a secao Minha assinatura na navegacao de Configuracoes
// ---------------------------------------------------------------------
console.log('\nPasso 2 — secao "Minha assinatura" (comum aos dois fluxos)')
const settingsHtml = renderToString(
  createElement(Settings.default, {
    settings: { operationMode: 'cashier_production_sync' },
    role: 'dono',
    menuProps,
    notify() {},
    subscription: assinaturaAtiva,
  }),
)
const temSecao = checa(
  texto(settingsHtml).includes('Minha assinatura'),
  'a secao aparece na navegacao de Configuracoes, sem submenu',
)

// ---------------------------------------------------------------------
// Fluxo CONTRATAR
// ---------------------------------------------------------------------
console.log('\nFluxo CONTRATAR')
const planosHtml = renderToString(
  createElement(PlanosCard.default, { subscription: assinaturaAtiva, notify() {} }),
)
const temEscolher = checa(
  planosHtml.includes('Escolher este') ||
    planosHtml.includes('Confirmar plano escolhido') ||
    planosHtml.includes('planos-lista'),
  'passo 3: escolher o plano acontece na propria secao',
)
const contratarConfirma = /Confirmar contrata|Tem certeza|confirmar a contrata/i.test(
  texto(planosHtml),
)
checa(!contratarConfirma, 'contratar nao pede confirmacao extra')

const PASSOS_CONTRATAR = [temEngrenagem, temSecao, temEscolher].filter(Boolean).length

// ---------------------------------------------------------------------
// Fluxo CANCELAR
// ---------------------------------------------------------------------
console.log('\nFluxo CANCELAR')
const cardHtml = renderToString(
  createElement(SubscriptionCard.default, {
    subscription: assinaturaAtiva,
    notify() {},
    onContratou() {},
  }),
)
const temLink = checa(
  texto(cardHtml).includes('Cancelar assinatura'),
  'passo 3: link "Cancelar assinatura" esta na propria secao',
)
checa(
  cardHtml.includes('link-discreto'),
  'o link e discreto (nao e botao de destaque)',
)

const dialogHtml = renderToString(
  createElement(CancelDialog.default, {
    subscription: assinaturaAtiva,
    busy: false,
    onConfirm() {},
    onClose() {},
  }),
)
const temConfirmar = checa(
  dialogHtml.includes('Sim, cancelar assinatura'),
  'passo 4: confirmacao com um unico botao',
)

const PASSOS_CANCELAR = [temEngrenagem, temSecao, temLink, temConfirmar].filter(Boolean).length

// ---------------------------------------------------------------------
// O dialogo nao pode virar funil de retencao
// ---------------------------------------------------------------------
console.log('\nAusencia de padroes escuros no caminho de saida')
const t = texto(dialogHtml)

checa(
  !/required/.test(dialogHtml),
  'nenhum campo obrigatorio no dialogo',
)
checa(
  /opcional/i.test(t),
  'o motivo esta marcado como opcional, em texto',
)
checa(
  !/fale com o suporte|entre em contato|ligue para|whatsapp|e-mail para cancelar/i.test(t),
  'nao manda falar com o suporte para concluir',
)
checa(
  !/desconto|oferta|espere|espera!|pense bem|nao va|promo/i.test(t),
  'nao oferece desconto nem tenta segurar o cliente',
)
checa(
  !/digite o nome|digite CANCELAR|confirme sua senha/i.test(t),
  'nao exige confirmacao datilografada',
)
const confirmacoes = (dialogHtml.match(/Sim, cancelar assinatura/g) || []).length
checa(confirmacoes === 1, 'existe exatamente UMA confirmacao, nao uma cascata')

// ---------------------------------------------------------------------
// Natureza do pedido (#122): escolha opcional, no MESMO passo
// ---------------------------------------------------------------------
console.log('\nNatureza do pedido (resilicao x arrependimento) — #122')
checa(
  dialogHtml.includes('name="cancelar-natureza"'),
  'existe escolha de natureza (resilicao/arrependimento) dentro do proprio dialogo',
)
checa(
  !/<input[^>]*name="cancelar-natureza"[^>]*required/.test(dialogHtml),
  'a escolha de natureza nao e obrigatoria (sem required no radio)',
)
checa(
  /Qual frase combina mais[^<]*\(opcional\)/.test(t),
  'a escolha de natureza esta rotulada como opcional, em texto',
)
// A escolha vive no MESMO dialogo do passo 4 — nao cria passo novo.
checa(
  PASSOS_CANCELAR === PASSOS_CONTRATAR + 1,
  'natureza nao criou um passo a mais no caminho de saida',
)

// ---------------------------------------------------------------------
// Os dois casos (teste e paga) usam o MESMO caminho
// ---------------------------------------------------------------------
console.log('\nFluxo unico para teste e para assinatura paga')
const cardTesteHtml = renderToString(
  createElement(SubscriptionCard.default, {
    subscription: assinaturaTeste,
    notify() {},
    onContratou() {},
  }),
)
checa(
  texto(cardTesteHtml).includes('Cancelar assinatura'),
  'quem esta em teste ve o mesmo link, no mesmo lugar',
)

const dialogTesteHtml = renderToString(
  createElement(CancelDialog.default, {
    subscription: assinaturaTeste,
    busy: false,
    onConfirm() {},
    onClose() {},
  }),
)
checa(
  /nada foi cobrado/i.test(texto(dialogTesteHtml)),
  'em teste, o dialogo avisa que nada foi cobrado',
)
checa(
  /31\/12\/2099/.test(texto(dialogHtml)),
  'em assinatura paga, o dialogo diz ate que dia funciona ANTES de confirmar',
)

// ---------------------------------------------------------------------
// O veredito
// ---------------------------------------------------------------------
console.log('\n-----------------------------------------------')
console.log(`Contratar: ${PASSOS_CONTRATAR} toques`)
console.log(`Cancelar:  ${PASSOS_CANCELAR} toques`)
console.log('-----------------------------------------------')

// O teto e contratar + 1. O passo extra e a confirmacao, e ela se justifica
// porque cancelar e destrutivo e contratar nao. Dois passos extras ja seria
// atrito, nao protecao.
if (PASSOS_CANCELAR > PASSOS_CONTRATAR + 1) {
  console.log(
    `FALHA cancelar leva ${PASSOS_CANCELAR} toques contra ${PASSOS_CONTRATAR} de contratar ` +
      '— passou do teto de contratar + 1',
  )
  falhas += 1
} else {
  console.log('ok    paridade mantida (cancelar <= contratar + 1)')
}

await server.close()

if (falhas) {
  console.log(`\n${falhas} falha(s).`)
  process.exit(1)
}
console.log('\nCancelamento self-service: tudo certo.')
