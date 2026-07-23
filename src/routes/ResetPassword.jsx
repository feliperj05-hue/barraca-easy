import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { updatePassword, validarNovaSenha } from '../services/authService.js'

// Tela de recuperacao de senha (#98). Vive FORA do AppGate de proposito (ver
// Root.jsx): o link do e-mail pode chegar sem sessao normal, com tenant
// pendente ou assinatura vencida -- nada disso pode barrar quem so quer
// trocar a senha.
//
// Como o Supabase avisa que o link e valido: ao abrir esta URL, o
// supabase-js le o token no hash (`detectSessionInUrl`, ligado por padrao),
// cria uma sessao de recuperacao e dispara o evento `PASSWORD_RECOVERY` via
// `onAuthStateChange`. Isso pode acontecer ANTES deste componente montar (o
// cliente e criado no import de supabaseClient.js), entao alem de escutar o
// evento tambem conferimos `getSession()` uma vez ao montar.
//
// Link invalido ou expirado: o Supabase redireciona de volta com
// `?error=...` na query, sem nunca criar sessao -- tratamos isso primeiro,
// sem esperar nenhum evento.
function friendly(err) {
  const msg = (err && err.message) || String(err)
  if (/session.*missing|invalid.*token|expired/i.test(msg)) {
    return 'Link expirado ou invalido. Peca um novo na tela de entrar.'
  }
  return msg
}

export default function ResetPassword() {
  const [status, setStatus] = useState('checking') // checking | ready | invalid
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStatus('invalid')
      return undefined
    }

    const params = new URLSearchParams(window.location.search)
    if (params.get('error')) {
      setStatus('invalid')
      return undefined
    }

    let resolved = false

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        resolved = true
        setStatus('ready')
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (resolved) return
      if (data && data.session) {
        resolved = true
        setStatus('ready')
        return
      }
      // Deu tempo do proprio supabase-js processar o hash da URL (corrida com
      // o listener acima); se nada chegou, o link nao e de recuperacao.
      setTimeout(() => {
        if (!resolved) setStatus('invalid')
      }, 1200)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const msg = validarNovaSenha(password, confirm)
    if (msg) {
      setError(msg)
      return
    }
    setBusy(true)
    try {
      await updatePassword(password)
      setDone(true)
    } catch (err) {
      setError(friendly(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo">B</div>
          <h1>Nova senha</h1>
        </div>

        {status === 'checking' && <p className="muted">Verificando o link...</p>}

        {status === 'invalid' && (
          <>
            <p className="auth-error">
              Este link de recuperacao e invalido ou ja expirou.
            </p>
            <a className="btn-primary" href="/">
              Voltar para entrar
            </a>
          </>
        )}

        {status === 'ready' && !done && (
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              Nova senha
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimo 6 caracteres"
              />
            </label>
            <label>
              Confirmar nova senha
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita a senha"
              />
            </label>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Aguarde...' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        {status === 'ready' && done && (
          <>
            <p className="auth-info">Senha atualizada. Ja pode entrar com ela.</p>
            <a className="btn-primary" href="/">
              Ir para o login
            </a>
          </>
        )}
      </div>
    </div>
  )
}
