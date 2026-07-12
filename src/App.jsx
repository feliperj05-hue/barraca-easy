import { useCallback, useRef, useState } from 'react'
import Layout from './components/Layout.jsx'
import Toast from './components/Toast.jsx'
import Cashier from './routes/Cashier.jsx'
import Production from './routes/Production.jsx'
import Closing from './routes/Closing.jsx'
import MenuAdmin from './routes/MenuAdmin.jsx'
import Settings from './routes/Settings.jsx'
import Members from './routes/Members.jsx'
import { useAuth } from './auth/AuthContext.jsx'
import {
  getOrders,
  createOrder,
  callOrder,
  deliverOrder,
  cancelOrder,
  clearOrders,
} from './services/orderService.js'
import { getSettings, selectMode, resetSettings } from './services/settingsService.js'
import {
  getMenu,
  setDefaultOverride,
  addCustomItem,
  updateCustomItem,
  removeCustomItem,
  resetMenu,
} from './services/productService.js'
import { getClosings, createClosing } from './services/closingsService.js'
import { downloadClosingReport } from './services/reportService.js'

// Telas e quais papeis podem ve-las. Operador opera o caixa; dono gerencia
// tudo. Sem papel (modo local sem nuvem) libera tudo.
const ALL_SCREENS = [
  { id: 'cashier', label: 'Caixa', roles: ['dono', 'operador'] },
  { id: 'production', label: 'Produção', roles: ['dono', 'operador'] },
  { id: 'closing', label: 'Fechamento', roles: ['dono'] },
  { id: 'menu', label: 'Cardápio', roles: ['dono'] },
  { id: 'members', label: 'Membros', roles: ['dono'] },
  { id: 'settings', label: 'Configurações', roles: ['dono'] },
]

export default function App() {
  const { role, membership, user, session, signOut } = useAuth()

  // role null => modo local (sem nuvem) ou dono; libera tudo exceto quando
  // explicitamente for 'operador'.
  const visibleScreens = ALL_SCREENS.filter(
    (s) => role == null || s.roles.includes(role),
  )

  const [screen, setScreen] = useState('cashier')
  const [orders, setOrders] = useState(() => getOrders())
  const [settings, setSettings] = useState(() => getSettings())
  const [menu, setMenu] = useState(() => getMenu())
  const [closings, setClosings] = useState(() => getClosings())
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  // Garante que o operador nunca fique numa tela que nao pode ver.
  const currentScreen = visibleScreens.some((s) => s.id === screen) ? screen : 'cashier'

  const notify = useCallback((message) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

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

  const handleCall = useCallback((id) => {
    setOrders([...callOrder(id)])
  }, [])

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

  // --- Cardápio ---
  const handleSetPrice = useCallback(
    (id, price) => {
      setMenu([...setDefaultOverride(id, { price })])
      notify('Preço atualizado.')
    },
    [notify],
  )

  const handleToggleHidden = useCallback(
    (id, hidden) => {
      const isCustom = id.startsWith('custom-')
      const next = isCustom
        ? updateCustomItem(id, { hidden })
        : setDefaultOverride(id, { hidden })
      setMenu([...next])
      notify(hidden ? 'Item ocultado.' : 'Item visível.')
    },
    [notify],
  )

  const handleAddItem = useCallback(
    (payload) => {
      setMenu([...addCustomItem(payload)])
      notify('Item adicionado ao cardápio.')
    },
    [notify],
  )

  const handleUpdateItem = useCallback(
    (id, patch) => {
      setMenu([...updateCustomItem(id, patch)])
      notify('Item atualizado.')
    },
    [notify],
  )

  const handleRemoveItem = useCallback(
    (item) => {
      if (!window.confirm(`Remover "${item.name}" do cardápio?`)) return
      setMenu([...removeCustomItem(item.id)])
      notify('Item removido.')
    },
    [notify],
  )

  const handleResetMenu = useCallback(() => {
    if (!window.confirm('Restaurar o cardápio padrão? As customizações serão perdidas.')) return
    setMenu([...resetMenu()])
    notify('Cardápio padrão restaurado.')
  }, [notify])

  // --- Fechamento de caixa ---
  const handleCloseRegister = useCallback(() => {
    const hasValidSales = orders.some((o) => o.status !== 'cancelado')
    if (!hasValidSales) {
      notify('Nenhuma venda confirmada para fechar.')
      return
    }
    if (!window.confirm('Tem certeza? Isso vai fechar o caixa e zerar a produção.')) return
    createClosing(orders)
    clearOrders()
    setOrders([])
    setClosings(getClosings())
    notify('Caixa fechado. Relatório disponível no histórico.')
  }, [orders, notify])

  const handleDownloadReport = useCallback(
    async (closing) => {
      try {
        await downloadClosingReport(closing)
      } catch {
        notify('Falha ao gerar o relatório.')
      }
    },
    [notify],
  )

  return (
    <Layout
      screens={visibleScreens}
      current={currentScreen}
      onNavigate={setScreen}
      userLabel={(user && user.email) || null}
      tenantLabel={(membership && membership.tenantNome) || null}
      role={role}
      onLogout={session ? signOut : null}
    >
      {currentScreen === 'cashier' && (
        <Cashier
          settings={settings}
          menu={menu}
          onCreateOrder={handleCreateOrder}
          notify={notify}
        />
      )}
      {currentScreen === 'production' && (
        <Production
          orders={orders}
          onCall={handleCall}
          onDeliver={handleDeliver}
          onCancel={handleCancel}
        />
      )}
      {currentScreen === 'closing' && (
        <Closing
          orders={orders}
          closings={closings}
          onCloseRegister={handleCloseRegister}
          onDownloadReport={handleDownloadReport}
        />
      )}
      {currentScreen === 'menu' && (
        <MenuAdmin
          menu={menu}
          onSetPrice={handleSetPrice}
          onToggleHidden={handleToggleHidden}
          onAddItem={handleAddItem}
          onUpdateItem={handleUpdateItem}
          onRemoveItem={handleRemoveItem}
          onResetMenu={handleResetMenu}
        />
      )}
      {currentScreen === 'members' && <Members />}
      {currentScreen === 'settings' && (
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
