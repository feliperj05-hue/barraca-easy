import { useCallback, useRef, useState } from 'react'
import Layout from './components/Layout.jsx'
import Toast from './components/Toast.jsx'
import Cashier from './routes/Cashier.jsx'
import Production from './routes/Production.jsx'
import Closing from './routes/Closing.jsx'
import Settings from './routes/Settings.jsx'
import {
  getOrders,
  createOrder,
  callOrder,
  deliverOrder,
  cancelOrder,
  clearOrders,
} from './services/orderService.js'
import { getSettings, selectMode, resetSettings } from './services/settingsService.js'

const SCREENS = [
  { id: 'cashier', label: 'Caixa' },
  { id: 'production', label: 'Produção' },
  { id: 'closing', label: 'Fechamento' },
  { id: 'settings', label: 'Configurações' },
]

export default function App() {
  const [screen, setScreen] = useState('cashier')
  const [orders, setOrders] = useState(() => getOrders())
  const [settings, setSettings] = useState(() => getSettings())
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const notify = useCallback((message) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  // Cria o pedido via service; retorna a ordem criada ou null (e avisa o erro).
  const handleCreateOrder = useCallback(
    (payload) => {
      try {
        const order = createOrder(payload)
        setOrders(getOrders())
        return order
      } catch (e) {
        notify(e.message)
        return null
      }
    },
    [notify],
  )

  const handleCall = useCallback(
    (id) => {
      setOrders([...callOrder(id)])
    },
    [],
  )

  const handleDeliver = useCallback((id) => {
    setOrders([...deliverOrder(id)])
  }, [])

  const handleCancel = useCallback(
    (id) => {
      if (!window.confirm('Cancelar este pedido? Ele sairá da fila e do fechamento.')) return
      setOrders([...cancelOrder(id)])
      notify('Pedido cancelado.')
    },
    [notify],
  )

  const handleResetDay = useCallback(() => {
    if (!window.confirm('Limpar todos os pedidos deste dia?')) return
    setOrders([...clearOrders()])
    notify('Pedidos limpos.')
  }, [notify])

  const handleSelectMode = useCallback(
    (modeKey, modeName) => {
      setSettings(selectMode(modeKey))
      notify(`Modo ${modeName} selecionado.`)
    },
    [notify],
  )

  const handleResetSettings = useCallback(() => {
    setSettings(resetSettings())
    notify('Configuração padrão restaurada.')
  }, [notify])

  return (
    <Layout screens={SCREENS} current={screen} onNavigate={setScreen} onResetDay={handleResetDay}>
      {screen === 'cashier' && (
        <Cashier settings={settings} onCreateOrder={handleCreateOrder} notify={notify} />
      )}
      {screen === 'production' && (
        <Production
          orders={orders}
          onCall={handleCall}
          onDeliver={handleDeliver}
          onCancel={handleCancel}
        />
      )}
      {screen === 'closing' && <Closing orders={orders} />}
      {screen === 'settings' && (
        <Settings
          settings={settings}
          onSelectMode={handleSelectMode}
          onResetSettings={handleResetSettings}
        />
      )}
      <Toast message={toast} />
    </Layout>
  )
}
