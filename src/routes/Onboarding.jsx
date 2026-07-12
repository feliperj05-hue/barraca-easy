import { useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { createTenantAsOwner } from '../services/authService.js'

// Estado "sem barraca": o usuario esta logado mas ainda nao tem tenant.
// Bootstrap minimo (cria tenant + vincula como dono) para a #29 ser
// testavel de ponta a ponta. O #30 formaliza o onboarding completo.
export default function Onboarding() {
  const { user, refreshMembership, signOut } = useAuth()
  const [nome, setNome] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!nome.trim()) {
      setError('Informe o nome da barraca.')
      return
    }
    setBusy(true)
    try {
      await createTenantAsOwner(nome, user.id)
      await refreshMembership()
    } catch (err) {
      setError((err && err.message) || String(err))
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo">B</div>
          <h1>Criar barraca</h1>
        </div>
        <p className="muted">
          Voce entrou como <strong>{user && user.email}</strong>, mas ainda nao tem uma
          barraca. Crie a sua para comecar.
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Nome da barraca
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Barraca da Praia"
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Criando...' : 'Criar barraca'}
          </button>
          <button type="button" className="btn-ghost small" onClick={signOut}>
            Sair
          </button>
        </form>
      </div>
    </div>
  )
}
