import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import { isSupabaseConfigured } from './services/supabaseClient.js'
import App from './App.jsx'
import Login from './routes/Login.jsx'
import Onboarding from './routes/Onboarding.jsx'
import SubscriptionBlocked from './components/SubscriptionBlocked.jsx'
import UpdateBanner from './components/UpdateBanner.jsx'
import { podeOperar } from './services/subscriptionService.js'

function AppGateContent() {
  const { loading, session, membership, subscription, refreshSubscription, role } = useAuth()

  let content = null

  if (!isSupabaseConfigured) {
    content = <App />
  } else if (loading) {
    content = (
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
  } else if (!session) {
    content = <Login />
  } else if (!membership) {
    content = <Onboarding />
  } else if (!podeOperar(subscription)) {
    content = (
      <SubscriptionBlocked
        subscription={subscription}
        role={role}
        onRecheck={() => refreshSubscription(membership.tenantId)}
      />
    )
  } else {
    content = <App />
  }

  return <>{content}<UpdateBanner /></>
}

export default function AppGate() {
  return (
    <AuthProvider>
      <AppGateContent />
    </AuthProvider>
  )
}
