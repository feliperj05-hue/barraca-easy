import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { listMembers, addMember, removeMember } from '../services/authService.js'
import { vagasRestantes, planoCheio } from '../services/subscriptionService.js'
import { isSupabaseConfigured } from '../services/supabaseClient.js'
import PermissionsCard from '../components/PermissionsCard.jsx'

// Gestao de membros do tenant (somente dono). Lista os membros e permite
// vincular um usuario existente (por e-mail) como operador ou dono.
// O operador precisa ter criado a conta e confirmado o e-mail antes.
//
// Virou secao de Configuracoes na #68: sem hero proprio, para nao repetir
// cabecalho dentro da tela de Configuracoes.
export default function Members() {
  const { membership, user, subscription } = useAuth()
  const tenantId = membership && membership.tenantId

  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState('operador')
  const [busy, setBusy] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const reload = useCallback(async () => {
    if (!tenantId) {
      setLoading(false)
      return
    }
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

  // Quantos donos existem hoje: serve para nao oferecer o botao de remover ao
  // unico dono. O banco recusa de qualquer jeito (#101), mas mostrar um botao
  // que sempre da erro e maltratar quem usa.
  const donos = members.filter((m) => m.papel === 'dono').length

  async function handleRemove(m) {
    const ehVoce = user && m.user_id === user.id
    const aviso = ehVoce
      ? 'Remover VOCE MESMO desta barraca? Voce perde o acesso na hora.'
      : `Remover ${m.email} desta barraca? A pessoa perde o acesso na hora.`
    if (!window.confirm(aviso)) return
    setError('')
    setInfo('')
    setRemovendo(m.user_id)
    try {
      await removeMember(tenantId, m.user_id)
      setInfo('Membro removido.')
      await reload()
    } catch (err) {
      setError((err && err.message) || String(err))
    } finally {
      setRemovendo(null)
    }
  }

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

  // Sem nuvem nao existe "membro": nao ha login, nao ha quem separar. Dizer
  // isso na cara e melhor que exibir um formulario que nao vai salvar nada.
  if (!tenantId) {
    return (
      <>
        <div className="panel settings-panel">
          <div className="panel-title">
            <h2>Membros da barraca</h2>
            <span className="settings-badge">Precisa de conta na nuvem</span>
          </div>
          <p className="muted">
            {isSupabaseConfigured
              ? 'Este aparelho está operando sem conta. Entre com um login de dono para gerenciar quem opera a barraca.'
              : 'Este aparelho está no modo local: os dados ficam só aqui e não existe login para separar quem é quem.'}
          </p>
          <p className="settings-note">
            Enquanto isso, quem estiver com o tablet na mão tem acesso a tudo —
            inclusive fechamento e configurações. A tabela abaixo mostra como
            fica a divisão assim que houver conta.
          </p>
        </div>
        <PermissionsCard />
      </>
    )
  }

  // Limite do plano. A tela apenas ANTECIPA o recado: quem recusa de verdade
  // e o banco (add_member + RLS), entao nao ha como contornar pela API.
  const limite = subscription ? subscription.max_usuarios : null
  const vagas = vagasRestantes(subscription)
  const cheio = planoCheio(subscription)

  return (
    <>
      <div className="panel settings-panel">
        <div className="panel-title">
          <h2>Membros da barraca</h2>
          <span className="settings-badge">
            {limite == null
              ? `${members.length} vinculado(s)`
              : `${members.length} de ${limite} usuário(s)`}
          </span>
        </div>
        <p className="muted">
          Vincule quem vai operar o caixa. A pessoa precisa criar a conta e
          confirmar o e-mail antes de ser adicionada.
        </p>

        {cheio ? (
          <p className="settings-note">
            O plano da barraca permite {limite} usuário(s) e todas as vagas estão em uso. Para
            incluir mais gente, é preciso mudar de plano. Trocar o papel de quem já está na
            lista continua funcionando.
          </p>
        ) : null}
        {vagas != null && vagas > 0 ? (
          <p className="settings-note">
            {vagas} vaga(s) de usuário disponível(is) no plano.
          </p>
        ) : null}

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
          <button type="submit" className="btn-primary" disabled={busy || cheio}>
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
                  {user && m.user_id === user.id && (
                    <span className="member-you"> (voce)</span>
                  )}
                </div>
                <div className="member-actions">
                  <span className={'member-badge ' + m.papel}>{m.papel}</span>
                  {!(m.papel === 'dono' && donos <= 1) && (
                    <button
                      type="button"
                      className="member-remove"
                      onClick={() => handleRemove(m)}
                      disabled={removendo === m.user_id}
                    >
                      {removendo === m.user_id ? 'Removendo...' : 'Remover'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <PermissionsCard />
    </>
  )
}
