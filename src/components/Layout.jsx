export default function Layout({
  screens,
  current,
  onNavigate,
  children,
  userLabel,
  tenantLabel,
  role,
  onLogout,
}) {
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
        {onLogout && (
          <div className="app-account">
            {userLabel && (
              <span className="account-info">
                {userLabel}
                {role && <span className="account-role"> · {role}</span>}
              </span>
            )}
            <button type="button" className="btn-ghost small" onClick={onLogout}>
              Sair
            </button>
          </div>
        )}
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
