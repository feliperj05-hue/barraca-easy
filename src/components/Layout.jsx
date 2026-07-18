import ConnectionStatus from './ConnectionStatus.jsx'

// Cabecalho do app.
//
// A engrenagem (#68) fica no cabecalho e nao na barra de abas de proposito: a
// barra e o que a equipe usa com cliente na frente (Caixa, Producao,
// Fechamento). Configuracao e coisa de antes de abrir a barraca, entao vive
// num canto proprio — perto do botao Sair, longe do dedo apressado.
//
// O botao de anotar problema do piloto (#77) entra pelo mesmo canto, como slot:
// o Layout so reserva o lugar, quem decide se ele existe e o App.
export default function Layout({
  screens,
  current,
  onNavigate,
  children,
  userLabel,
  tenantLabel,
  role,
  onLogout,
  onOpenSettings,
  pilotNote,
}) {
  const settingsActive = current === 'settings'

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="logo">B</div>
          <div>
            <h1>Barraca Easy</h1>
            <p className="brand-sub">
              {tenantLabel || 'Caixa digital, senha física e fila interna.'}
            </p>
          </div>
        </div>
        <ConnectionStatus />
        <nav className="app-nav">
          {screens.map((s) => (
            <button
              key={s.id}
              type="button"
              className={'nav-btn' + (s.id === current ? ' active-tab' : '')}
              onClick={() => onNavigate(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="app-account">
          {pilotNote}
          {onOpenSettings && (
            <button
              type="button"
              className={'icon-btn settings-gear' + (settingsActive ? ' active' : '')}
              onClick={onOpenSettings}
              title="Configurações"
              aria-label="Configurações"
              aria-pressed={settingsActive}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
                <path
                  fill="currentColor"
                  d="M19.14 12.94a7.6 7.6 0 0 0 .06-.94 7.6 7.6 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.62l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.24-1.12.56-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.86a.5.5 0 0 0 .12.62l2.03 1.58c-.04.31-.06.62-.06.94 0 .32.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.62l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.5.38 1.04.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.24 1.12-.56 1.62-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.62l-2.03-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z"
                />
              </svg>
            </button>
          )}
          {userLabel && (
            <span className="account-info">
              {userLabel}
              {role && <span className="account-role"> · {role}</span>}
            </span>
          )}
          {onLogout && (
            <button type="button" className="btn-ghost small" onClick={onLogout}>
              Sair
            </button>
          )}
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
