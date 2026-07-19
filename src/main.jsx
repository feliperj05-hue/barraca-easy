import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Root from './Root.jsx'
import { registerServiceWorker } from './services/pwa.js'
import './styles/app.css'

// AuthProvider e UpdateBanner sairam daqui e foram para o AppGate (#111): o
// site comercial e publico e nao deve abrir sessao no Supabase so para
// mostrar uma pagina de vendas.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

// PWA: instalacao no tablet + app shell offline (#49).
registerServiceWorker()
