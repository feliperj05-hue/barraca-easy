import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './auth/AuthContext.jsx'
import Root from './Root.jsx'
import { registerServiceWorker } from './services/pwa.js'
import './styles/app.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
)

// PWA: instalacao no tablet + app shell offline (#49).
registerServiceWorker()
