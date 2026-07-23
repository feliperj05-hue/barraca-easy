import { lazy, Suspense } from 'react'
import { ehRotaMarketing, ehRotaRecuperarSenha } from './services/siteConfig.js'

// Divisao entre SITE COMERCIAL e APLICATIVO (#111).
//
// Os dois convivem no mesmo projeto e na mesma origem, mas cada lado so e
// baixado quando sua rota e acessada: quem cai na pagina de vendas nao puxa
// os ~530 kB do app, e quem abre o app no tablet nao puxa o CSS do site.
//
// A RAIZ "/" CONTINUA SENDO O APP, de proposito. Trocar a raiz para a home
// comercial mexe no `start_url` do PWA e faria o tablet ja instalado no
// piloto abrir na pagina de vendas depois de um update. Isso e decisao de
// produto pendente (#107 item 3, #111) — quando for tomada, muda em
// services/siteConfig.js, nao aqui.
//
// O roteamento de telas do app (/caixa, /producao, ...) segue inteiro no
// services/router.js: nada aqui interfere nele.
const MarketingSite = lazy(() => import('./marketing/MarketingSite.jsx'))
const AppGate = lazy(() => import('./AppGate.jsx'))
const ResetPassword = lazy(() => import('./routes/ResetPassword.jsx'))

function RouteLoading() {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo">B</div>
          <h1>Barraca Easy</h1>
        </div>
        <p className="muted">Carregando...</p>
      </div>
    </div>
  )
}

export default function Root() {
  const pathname = typeof window === 'undefined' ? '/' : window.location.pathname
  const marketing = ehRotaMarketing(pathname)
  // Recuperacao de senha (#98) e checada ANTES do AppGate de proposito: o
  // link do e-mail pode chegar sem sessao, com tenant pendente ou com
  // assinatura vencida, e nenhuma dessas checagens deve impedir a pessoa de
  // trocar a senha.
  const recuperarSenha = ehRotaRecuperarSenha(pathname)

  return (
    <Suspense fallback={<RouteLoading />}>
      {recuperarSenha ? <ResetPassword /> : marketing ? <MarketingSite /> : <AppGate />}
    </Suspense>
  )
}
