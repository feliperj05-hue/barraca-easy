export default function Layout({ screens, current, onNavigate, children }) {
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="logo">B</div>
          <div>
            <h1>Barraca Easy</h1>
            <p className="brand-sub">Caixa digital, senha física e fila interna.</p>
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
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
