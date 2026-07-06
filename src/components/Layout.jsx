export default function Layout({ screens, current, onNavigate, children }) {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">Barraca Easy</div>
        <nav className="app-nav">
          {screens.map((s) => (
            <button
              key={s.id}
              type="button"
              className={'nav-btn' + (s.id === current ? ' nav-btn--active' : '')}
              onClick={() => onNavigate(s.id)}
            >
              <span className="nav-btn__icon" aria-hidden="true">{s.icon}</span>
              <span className="nav-btn__label">{s.label}</span>
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
