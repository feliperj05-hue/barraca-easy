/**
 * Guarda da regra de acesso por assinatura (issue #90, epic #26).
 *
 * O bug que este script existe para nunca deixar acontecer: o app se
 * desligar sozinho na mao de quem esta pagando em dia. Barraca opera na praia,
 * em feira, em rua sem sinal — se "o servidor nao respondeu" for tratado como
 * "assinatura vencida", o Barraca Easy trava a venda do cliente bom no pior
 * momento possivel. Cobrar de menos por um dia offline e barato; travar o
 * caixa de quem pagou custa o cliente.
 *
 * A regra em uma frase: **so o servidor pode dizer que a assinatura acabou.**
 * Sem resposta, vale o ultimo status conhecido; sem status nenhum, libera.
 * O bloqueio de verdade quem faz e o banco (RLS + create_order, #89) — a tela
 * so antecipa o recado.
 *
 * Roda sem navegador e sem rede.
 *
 *   npm run assinatura
 */

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const {
  podeOperar,
  motivoBloqueio,
  avisoDeTeste,
  diasRestantesDeTeste,
  cacheSubscription,
  readCachedSubscription,
  clearSubscriptionCache,
} = await import('../src/services/subscriptionService.js')

let falhas = 0
function ok(cond, titulo, detalhe = '') {
  if (cond) {
    console.log(`  OK   ${titulo}`)
  } else {
    falhas += 1
    console.log(`  FALHA ${titulo}${detalhe ? ` — ${detalhe}` : ''}`)
  }
}

// Data LOCAL (nao UTC): toISOString empurraria a data um dia para tras em
// fuso negativo e o teste passaria ou falharia conforme a hora do dia.
const emDias = (n) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + n)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

const sub = (over) => ({
  tenant_id: 't1',
  nome: 'Barraca do Ze',
  plano: 'mensal',
  valor_mensal: 39.9,
  status_assinatura: 'ativa',
  teste_expira_em: null,
  ...over,
})

console.log('\n1. Quem pode operar')
ok(podeOperar(sub({ status_assinatura: 'ativa' })), 'assinatura ativa opera')
ok(
  podeOperar(sub({ status_assinatura: 'teste', teste_expira_em: emDias(5) })),
  'teste dentro do prazo opera',
)
ok(
  podeOperar(sub({ status_assinatura: 'teste', teste_expira_em: emDias(0) })),
  'teste que vence hoje ainda opera (o dia inteiro vale)',
)
ok(
  !podeOperar(sub({ status_assinatura: 'teste', teste_expira_em: emDias(-1) })),
  'teste vencido ontem NAO opera',
)
ok(!podeOperar(sub({ status_assinatura: 'suspensa' })), 'suspensa NAO opera')
ok(!podeOperar(sub({ status_assinatura: 'cancelada' })), 'cancelada NAO opera')

console.log('\n2. Sem sinal ninguem e bloqueado')
ok(podeOperar(null), 'status desconhecido (offline / modo local) libera')
ok(
  podeOperar(sub({ status_assinatura: 'teste', teste_expira_em: null })),
  'teste sem data de fim libera em vez de travar',
)

console.log('\n3. Cache sobrevive a queda de rede')
clearSubscriptionCache()
ok(readCachedSubscription('t1') === null, 'cache comeca vazio')
cacheSubscription(sub({ status_assinatura: 'ativa' }))
ok(podeOperar(readCachedSubscription('t1')), 'status ativo em cache mantem a barraca operando')
ok(
  readCachedSubscription('t2') === null,
  'cache de outro tenant nao vaza (aparelho trocado de conta)',
)
cacheSubscription(sub({ status_assinatura: 'suspensa' }))
ok(
  !podeOperar(readCachedSubscription('t1')),
  'suspensao conhecida continua valendo offline (nao da pra burlar tirando o wi-fi)',
)

console.log('\n4. Recado do bloqueio')
ok(motivoBloqueio(sub({ status_assinatura: 'ativa' })) === null, 'ativa nao tem motivo de bloqueio')
ok(
  motivoBloqueio(sub({ status_assinatura: 'suspensa' })).titulo === 'Assinatura suspensa',
  'suspensa explica a suspensao',
)
ok(
  motivoBloqueio(sub({ status_assinatura: 'teste', teste_expira_em: emDias(-3) })).titulo ===
    'Período de teste encerrado',
  'teste vencido fala de teste, nao de suspensao',
)

console.log('\n5. Aviso de teste acabando')
ok(avisoDeTeste(sub({ status_assinatura: 'ativa' })) === null, 'assinante ativo nao ve aviso')
ok(
  avisoDeTeste(sub({ status_assinatura: 'teste', teste_expira_em: emDias(20) })) === null,
  'teste longe do fim nao polui a tela',
)
ok(
  /termina em 5 dias/.test(
    avisoDeTeste(sub({ status_assinatura: 'teste', teste_expira_em: emDias(5) })) || '',
  ),
  'faltando 5 dias, avisa',
)
ok(
  avisoDeTeste(sub({ status_assinatura: 'teste', teste_expira_em: emDias(0) })) ===
    'Seu teste grátis termina hoje.',
  'no ultimo dia, avisa "hoje"',
)

console.log('\n6. Dias restantes')
ok(
  diasRestantesDeTeste(sub({ status_assinatura: 'teste', teste_expira_em: emDias(7) })) === 7,
  'conta 7 dias',
)
ok(
  diasRestantesDeTeste(sub({ status_assinatura: 'ativa' })) === null,
  'assinante ativo nao tem contagem de teste',
)
ok(
  diasRestantesDeTeste(sub({ status_assinatura: 'teste', dias_restantes: 3 })) === 3,
  'quando o banco ja calculou, usa o numero do banco',
)

console.log(falhas === 0 ? '\nTudo certo.\n' : `\n${falhas} falha(s).\n`)
process.exit(falhas === 0 ? 0 : 1)
