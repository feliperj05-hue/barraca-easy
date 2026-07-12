import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { listMembers, addMember } from '../services/authService.js'

// Gestao de membros do tenant (somente dono). Lista os membros e permite
// vincular um usuario existente (por e-mail) como operador ou dono.
// O operador precisa ter criado a conta e confirmado o e-mail antes.
export default function Members() {
  const { membership, user } = useAuth()
  const tenantId = membership && membership.tenantId

  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState('operador')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const reload = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      setMembers(await listMembers(tenantId))
    } catch (err) {
      setError((err && err.message) || String(err))
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    reload()
  }, [reload])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!email.trim()) {
      setError('Informe o e-mail do membro.')
      return
    }
    setBusy(true)
    try {
      await addMember(tenantId, email, papel)
      setInfo('Membro vinculado.')
      setEmail('')
      await reload()
    } catch (err) {
      setError((err && err.message) || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="hero">
        <div>
          <h2>Membros da barraca</h2>
          <p>
            Vincule quem vai operar o caixa. A pessoa precisa criar a conta e confirmar o
            e-mail antes de ser adicionada.
          </p>
        </div>
        <div className="hero-card">
          <span>Barraca</span>
          <strong>{membership && membership.tenantNome}</strong>
        </div>
      </div>

      <form onSubmit={handleAdd} className="member-form">
        <label>
          E-mail do membro
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="operador@exemplo.com"
          />
        </label>
        <label>
          Papel
          <select value={papel} onChange={(e) => setPapel(e.target.value)}>
            <option value="operador">Operador</option>
            <option value="dono">Dono</option>
          </select>
        </label>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Adicionando...' : 'Adicionar membro'}
        </button>
      </form>

      {error && <p className="auth-error">{error}</p>}
      {info && <p className="auth-info">{info}</p>}

      <div className="member-list">
        {loading ? (
          <p className="muted">Carregando...</p>
        ) : (
          members.map((m) => (
            <div key={m.user_id} className="member-row">
              <div>
                <strong>{m.email}</strong>
                {user && m.user_id === user.id && <span className="member-you"> (voce)</span>}
              </div>
              <span className={'member-badge ' + m.papel}>{m.papel}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
