/**
 * Guarda da recuperacao de senha (issue #98).
 *
 * `validarNovaSenha` e a unica regra pura desta feature -- o resto
 * (requestPasswordReset, updatePassword, o evento PASSWORD_RECOVERY) depende
 * do supabase-js e de rede de verdade, entao nao da para simular aqui sem
 * inventar um mock que mentiria sobre o comportamento real. O que da pra
 * travar sem rede e travamos: a regra de senha valida e a mensagem de erro
 * que a tela mostra.
 *
 *   npm run recuperar-senha
 */

const { validarNovaSenha } = await import('../src/services/authService.js')

let falhas = 0
function ok(cond, msg) {
  if (cond) {
    console.log(`  ok   ${msg}`)
  } else {
    falhas += 1
    console.error(`  FALHA ${msg}`)
  }
}

console.log('\nSenha curta e recusada (#98: minimo 6 caracteres)')
ok(validarNovaSenha('', '') !== null, "senha vazia falha")
ok(validarNovaSenha('123', '123') !== null, "'123' (3 chars) falha")
ok(validarNovaSenha('12345', '12345') !== null, "'12345' (5 chars) falha")

console.log('\nSenha e confirmacao precisam ser iguais')
ok(validarNovaSenha('123456', '654321') !== null, "senhas diferentes falham")
ok(validarNovaSenha('abcdef', 'abcdef') === null, "senhas iguais (6 chars) passam")

console.log('\nSenha valida nao gera mensagem de erro')
ok(validarNovaSenha('minhaSenhaForte', 'minhaSenhaForte') === null, "senha longa igual passa")

console.log('')
if (falhas > 0) {
  console.error(`${falhas} falha(s) na recuperacao de senha.`)
  process.exit(1)
}
console.log('Recuperacao de senha ok.')
