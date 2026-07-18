import { useAuth } from './auth/AuthContext.jsx'
import { isSupabaseConfigured } from './services/supabaseClient.js'
import App from './App.jsx'
import Login from './routes/Login.jsx'
import Onboarding from './routes/Onboarding.jsx'
import SubscriptionBlocked from './components/SubscriptionBlocked.jsx'
import { podeOperar } from './services/subscriptionService.js'

// Portao de autenticacao. Decide o que renderizar conforme a sessao/vinculo.
// Sem Supabase configurado, cai no modo local (sem auth) para nao travar o app.
export default function Root() {
  const { loading, session, membership, subscription, refreshSubscription, role } = useAuth()

  if (!isSupabaseConfigured) return <App />

  if (loading) {
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

  if (!session) return <Login />
  if (!membership) return <Onboarding />

  // Portao de assinatura (#90). Vem depois do vinculo porque so faz sentido
  // para quem ja tem barraca. `podeOperar` devolve true quando nao ha status
  // conhecido — sem sinal, barraca em dia continua vendendo (ver comentario
  // do subscriptionService).
  if (!podeOperar(subscription)) {
    return (
      <SubscriptionBlocked
        subscription={subscription}
        role={role}
        onRecheck={() => refreshSubscription(membership.tenantId)}
      />
    )
  }

  return <App />
}
