import { useState } from 'react'
import Layout from './components/Layout.jsx'
import Cashier from './routes/Cashier.jsx'
import Production from './routes/Production.jsx'
import Closing from './routes/Closing.jsx'
import Settings from './routes/Settings.jsx'

const SCREENS = [
  { id: 'cashier', label: 'Caixa', icon: '🧾', Component: Cashier },
  { id: 'production', label: 'Produção', icon: '👨‍🍳', Component: Production },
  { id: 'closing', label: 'Fechamento', icon: '📊', Component: Closing },
  { id: 'settings', label: 'Configurações', icon: '⚙️', Component: Settings },
]

export default function App() {
  const [screen, setScreen] = useState('cashier')
  const active = SCREENS.find((s) => s.id === screen) ?? SCREENS[0]
  const Active = active.Component

  return (
    <Layout screens={SCREENS} current={screen} onNavigate={setScreen}>
      <Active />
    </Layout>
  )
}
