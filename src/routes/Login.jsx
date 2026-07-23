import { useState } from 'react'
import { signIn, signUp, resendConfirmation, requestPasswordReset } from '../services/authService.js'

// Tela de login/cadastro (e-mail + senha via Supabase Auth).
// Confirm email fica LIGADO no projeto: apos criar conta, o usuario precisa
// confirmar o e-mail antes do primeiro login. Tratamos essa mensagem aqui.
export default function Login() {
  // O site comercial manda ?acao=cadastro nos botoes "Testar gratuitamente".
  const [mode, setMode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('acao') === 'cadastro' ? 'signup' : 'signin'
  }) // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  function friendly(err) {
    const msg = (err && err.message) || String(err)
    if (/email not confirmed/i.test(msg)) {
      return 'E-mail ainda nao confirmado. Confira sua caixa de entrada e clique no link de confirmacao.'
    }
    if (/invalid login credentials/i.test(msg)) {
      return 'E-mail ou senha incorretos.'
    }
    if (/password should be at least/i.test(msg)) {
      return 'A senha precisa ter pelo menos 6 caracteres.'
    }
    if (/user already registered/i.test(msg)) {
      return 'Ja existe uma conta com esse e-mail. Tente entrar.'
    }
    return msg
  }

  function trocarModo(novoModo) {
    setMode(novoModo)
    setError('')
    setInfo('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        // onAuthStateChange no AuthProvider assume daqui.
      } else {
        const data = await signUp(email, password)
        if (data.session) {
          // Projeto sem confirmacao: ja logou.
        } else {
          setInfo(
            'Conta criada. Enviamos um e-mail de confirmacao — confirme para poder entrar.',
          )
          setMode('signin')
        }
      }
    } catch (err) {
      setError(friendly(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    setError('')
    setInfo('')
    try {
      await resendConfirmation(email)
      setInfo('E-mail de confirmacao reenviado.')
    } catch (err) {
      setError(friendly(err))
    }
  }

  // Recuperacao de senha (#98). Mensagem sempre neutra: nao da para o
  // resultado (sucesso ou erro) revelar se o e-mail existe na base.
  async function handleForgotSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!email.trim()) {
      setError('Informe o e-mail.')
      return
    }
    setBusy(true)
    try {
      await requestPasswordReset(email)
    } catch {
      // Ignorado de proposito: mesma mensagem, com ou sem erro do provedor.
    } finally {
      setBusy(false)
      setInfo('Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha.')
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo">B</div>
          <h1>Barraca Easy</h1>
        </div>

        {mode !== 'forgot' && (
          <div className="auth-tabs">
            <button
              type="button"
              className={'auth-tab' + (mode === 'signin' ? ' active' : '')}
              onClick={() => trocarModo('signin')}
            >
              Entrar
            </button>
            <button
              type="button"
              className={'auth-tab' + (mode === 'signup' ? ' active' : '')}
              onClick={() => trocarModo('signup')}
            >
              Criar conta
            </button>
          </div>
        )}

        {mode === 'forgot' ? (
          <form onSubmit={handleForgotSubmit} className="auth-form">
            <label>
              E-mail
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
              />
            </label>

            {error && <p className="auth-error">{error}</p>}
            {info && <p className="auth-info">{info}</p>}

            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Aguarde...' : 'Enviar link de recuperacao'}
            </button>
            <button type="button" className="btn-ghost small" onClick={() => trocarModo('signin')}>
              Voltar para entrar
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              E-mail
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
              />
            </label>

            {error && <p className="auth-error">{error}</p>}
            {info && <p className="auth-info">{info}</p>}

            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Aguarde...' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
            </button>

            {mode === 'signin' && (
              <>
                <button type="button" className="btn-ghost small" onClick={handleResend}>
                  Reenviar e-mail de confirmacao
                </button>
                <button type="button" className="btn-ghost small" onClick={() => trocarModo('forgot')}>
                  Esqueci minha senha
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
