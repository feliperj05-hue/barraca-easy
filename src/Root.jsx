import { useAuth } from './auth/AuthContext.jsx'
import { isSupabaseConfigured } from './services/supabaseClient.js'
import App from './App.jsx'
import Login from './routes/Login.jsx'
import Onboarding from './routes/Onboarding.jsx'

// Portao de autenticacao. Decide o que renderizar conforme a sessao/vinculo.
// Sem Supabase configurado, cai no modo local (sem auth) para nao travar o app.
export default function Root() {
  const { loading, session, membership } = useAuth()

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
  return <App />
}
