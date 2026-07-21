/**
 * Guarda do aviso legal no papel (issue #128).
 *
 * O cupom da barraca NAO e documento fiscal. Se o papel nao disser isso, o
 * cliente guarda achando que e nota e sobra dor de cabeca para a barraca. O
 * aviso e exigencia do Felipe e nao pode:
 *
 *   1. sumir do cupom — com rodape configurado, sem rodape, ou com o rodape
 *      apagado pelo dono nas Configuracoes;
 *   2. sair reescrito, abreviado ou traduzido;
 *   3. quebrar no meio de palavra no papel de 58 mm nem no de 80 mm;
 *   4. sair fora do rodape (tem que ser a ultima coisa escrita no cupom);
 *   5. aparecer duplicado se o dono colar a mesma frase no rodape dele.
 *
 *   npm run aviso-fiscal
 */

const { AVISO_SEM_VALIDADE_FISCAL: AVISO } = await import('../src/services/fiscalNotice.js')
const { buildReceipt, sampleOrder } = await import('../src/services/receiptLayout.js')
const { renderPlainText, renderBytes, columnsFor, encodeText } = await import('../src/services/escpos.js')

let falhas = 0
function ok(cond, msg) {
  if (cond) {
    console.log(`  ok   ${msg}`)
  } else {
    falhas += 1
    console.error(`  FALHA ${msg}`)
  }
}

console.log('\nO texto e exatamente o que o Felipe pediu')
ok(AVISO === 'Este documento não tem validade fiscal', JSON.stringify(AVISO))

// Uma linha da previa em texto e uma linha do papel — o escpos.js usa a mesma
// largura e a mesma quebra nos dois caminhos. Da para conferir sem impressora.
const linhasDe = (config, paperWidth) =>
  renderPlainText(buildReceipt(sampleOrder(), config), { paperWidth })
    .split('\n')
    .map((l) => l.trimEnd())

const cenarios = [
  ['rodape padrao', { header: 'BARRACA EASY', footer: 'Obrigado e volte sempre!' }],
  ['sem rodape', { header: 'BARRACA EASY', footer: '' }],
  ['sem rodape nem cabecalho', {}],
  ['itens escondidos', { footer: 'Volte sempre', showItems: false }],
]

for (const largura of [58, 80]) {
  const colunas = columnsFor(largura)
  for (const [nome, config] of cenarios) {
    console.log(`\nPapel de ${largura} mm (${colunas} colunas) — ${nome}`)
    const linhas = linhasDe({ ...config, paperWidth: largura }, largura)

    const inicio = linhas.findIndex((l) => l.includes('Este documento'))
    ok(inicio >= 0, 'o aviso aparece no papel')
    if (inicio < 0) continue

    // Quebra por palavra: juntando as linhas do aviso, ele sai inteiro e igual.
    const doAviso = linhas.slice(inicio).map((l) => l.trim()).filter(Boolean)
    ok(doAviso.join(' ') === AVISO, `sai inteiro, sem cortar palavra: ${JSON.stringify(doAviso)}`)

    // Nada impresso depois dele: e o rodape mesmo.
    ok(
      linhas.slice(inicio + doAviso.length).every((l) => !l.trim()),
      'e a ultima coisa escrita no cupom',
    )

    // Cabe no papel e sai uma vez so.
    ok(linhas.every((l) => l.length <= colunas), `nenhuma linha passa de ${colunas} colunas`)
    ok(doAviso.length === (largura === 80 ? 1 : 2), `sai em ${largura === 80 ? '1 linha' : '2 linhas equilibradas'}`)
    ok(
      doAviso.length < 2 || Math.abs(doAviso[0].length - doAviso[1].length) <= 4,
      'as duas linhas ficam com tamanho parecido (nao sobra palavra solta)',
    )
    const vezes = linhas.filter((l) => l.includes('Este documento')).length
    ok(vezes === 1, `aparece uma unica vez (${vezes})`)
  }
}

console.log('\nO dono nao consegue apagar o aviso pelo rodape das Configuracoes')
for (const footer of ['', '   ', 'Promocao de terca!', null, undefined]) {
  const linhas = linhasDe({ footer }, 58)
  ok(linhas.some((l) => l.includes('Este documento')), `rodape ${JSON.stringify(footer)} -> aviso continua`)
}

console.log('\nDono colando a mesma frase no rodape nao duplica o aviso')
for (const footer of [AVISO, AVISO.toUpperCase(), '  este documento nao tem validade fiscal  ']) {
  const linhas = linhasDe({ footer }, 80)
  const vezes = linhas.filter((l) => l.includes('validade fiscal')).length
  ok(vezes === 1, `rodape ${JSON.stringify(footer)} -> sai uma vez so (${vezes})`)
}

console.log('\nOs bytes que vao para a impressora carregam o aviso')
for (const encoding of ['cp850', 'ascii']) {
  const bytes = Array.from(renderBytes(buildReceipt(sampleOrder(), {}), { paperWidth: 58, encoding }))
  const esperado = encodeText('Este documento', encoding)
  ok(bytes.join(',').includes(esperado.join(',')), `encoding ${encoding}: o aviso esta nos bytes ESC/POS`)
}

console.log(falhas === 0 ? '\nTudo certo: o papel avisa que nao vale como nota.\n' : `\n${falhas} falha(s).\n`)
process.exit(falhas === 0 ? 0 : 1)
