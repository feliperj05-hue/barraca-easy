// Roteamento por URL (#107, item 1).
//
// ATE AQUI o app navegava com `useState('cashier')` dentro do App.jsx: uma
// variavel na memoria. Funcionava, mas cobrava caro:
//
// - o endereco nunca mudava, entao nao existia link para tela nenhuma
//   ("abre no Fechamento" era impossivel de mandar por mensagem);
// - o botao Voltar do Android saia do app em vez de voltar de tela — no
//   tablet do piloto isso e o operador perdendo o pedido pela metade;
// - recarregar a pagina sempre jogava a pessoa no Caixa;
// - e, o que motivou isto: sem URL nao da para separar o que e site publico
//   do que e app.
//
// POR QUE SEM BIBLIOTECA. `react-router` resolveria, mas traz roteador
// aninhado, loaders e um vocabulario inteiro para um app de CINCO telas sem
// nenhuma rota aninhada e sem parametro de URL. O projeto tem regra explicita
// de nao adicionar dependencia sem necessidade. Sao ~40 linhas de History API
// contra ~20 kB de bundle que o dono de barraca baixaria no 4G dele.
//
// CONTRATO DELIBERADO: `useScreenRoute()` devolve exatamente `[screen,
// setScreen]`, a mesma cara do `useState` que substituiu. Foi de proposito —
// o App.jsx tem 559 linhas e o piloto esta para rodar. Trocar uma linha e
// muito mais seguro que reescrever a navegacao inteira.

import { useCallback, useEffect, useState } from 'react'

export const TELA_PADRAO = 'cashier'

// Enderecos em portugues porque sao publicos: o dono da barraca ve isso na
// barra do navegador e pode mandar por WhatsApp. `cashier` continua sendo o
// id interno para nao mexer em permissions.js nem no resto do App.
const ROTAS = [
  { screen: 'cashier', path: '/caixa' },
  { screen: 'production', path: '/producao' },
  { screen: 'closing', path: '/fechamento' },
  { screen: 'settings', path: '/configuracoes' },
  { screen: 'admin', path: '/clientes' },
]

export function pathDaTela(screen) {
  const r = ROTAS.find((x) => x.screen === screen)
  return r ? r.path : '/caixa'
}

export function telaDoPath(pathname) {
  const limpo = String(pathname || '').replace(/\/+$/, '') || '/'
  const r = ROTAS.find((x) => x.path === limpo)
  // Endereco desconhecido cai no Caixa em vez de mostrar tela de erro: quem
  // digitou errado no meio do expediente precisa vender, nao depurar URL.
  return r ? r.screen : TELA_PADRAO
}

function telaAtual() {
  if (typeof window === 'undefined') return TELA_PADRAO
  return telaDoPath(window.location.pathname)
}

export function useScreenRoute() {
  const [screen, setScreenState] = useState(telaAtual)

  // Botao Voltar/Avancar do navegador (e o botao fisico do Android).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onPop = () => setScreenState(telaAtual())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Normaliza a barra de enderecos na primeira carga: quem abre a raiz `/`
  // (o caso do PWA instalado, cujo start_url e "./") passa a ver `/caixa`.
  // `replaceState` e nao `pushState` para nao criar um passo de historico que
  // faria o primeiro Voltar nao sair do app.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const alvo = pathDaTela(telaAtual())
    if (window.location.pathname !== alvo) {
      window.history.replaceState({}, '', alvo + window.location.search)
    }
  }, [])

  // O empurrao no historico fica FORA do updater do useState de proposito:
  // em StrictMode o React chama o updater duas vezes, e um pushState ali
  // dentro empilharia dois passos por clique — o Voltar precisaria de dois
  // toques para sair de uma tela so. Comparar com a URL atual em vez de
  // comparar com o estado deixa a funcao idempotente.
  const setScreen = useCallback((proxima) => {
    const alvo = pathDaTela(proxima)
    if (typeof window !== 'undefined' && window.location.pathname !== alvo) {
      window.history.pushState({}, '', alvo + window.location.search)
    }
    setScreenState(proxima)
  }, [])

  return [screen, setScreen]
}
