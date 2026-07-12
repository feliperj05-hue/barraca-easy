import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  fetchMenu,
  ensureSeeded,
  setPrice as svcSetPrice,
  toggleHidden as svcToggleHidden,
  addItem as svcAddItem,
  updateItem as svcUpdateItem,
  removeItem as svcRemoveItem,
  resetMenu as svcResetMenu,
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
  const [menu, setMenu] = useState([])
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

  // Contexto do cardapio: com tenant os dados vao para a nuvem (Supabase);
  // sem tenant (modo local) caem no localStorage.
  const menuCtx = useMemo(
    () => (membership && membership.tenantId ? { tenantId: membership.tenantId } : null),
    [membership],
  )

  // Carrega o cardapio (local ou nuvem) e semeia os padrao num tenant novo.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        await ensureSeeded(menuCtx)
        const list = await fetchMenu(menuCtx)
        if (active) setMenu(list)
      } catch {
        if (active) notify('Falha ao carregar o cardápio.')
      }
    })()
    return () => {
      active = false
    }
  }, [menuCtx, notify])

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

  // --- Cardápio (async: local ou nuvem, conforme o menuCtx) ---
  const handleSetPrice = useCallback(
    async (id, price) => {
      try {
        setMenu(await svcSetPrice(menuCtx, id, price))
        notify('Preço atualizado.')
      } catch {
        notify('Falha ao atualizar o preço.')
      }
    },
    [menuCtx, notify],
  )

  const handleToggleHidden = useCallback(
    async (id, hidden) => {
      try {
        setMenu(await svcToggleHidden(menuCtx, id, hidden))
        notify(hidden ? 'Item ocultado.' : 'Item visível.')
      } catch {
        notify('Falha ao atualizar a visibilidade.')
      }
    },
    [menuCtx, notify],
  )

  const handleAddItem = useCallback(
    async (payload) => {
      try {
        setMenu(await svcAddItem(menuCtx, payload))
        notify('Item adicionado ao cardápio.')
      } catch {
        notify('Falha ao adicionar o item.')
      }
    },
    [menuCtx, notify],
  )

  const handleUpdateItem = useCallback(
    async (id, patch) => {
      try {
        setMenu(await svcUpdateItem(menuCtx, id, patch))
        notify('Item atualizado.')
      } catch {
        notify('Falha ao atualizar o item.')
      }
    },
    [menuCtx, notify],
  )

  const handleRemoveItem = useCallback(
    async (item) => {
      if (!window.confirm(`Remover "${item.name}" do cardápio?`)) return
      try {
        setMenu(await svcRemoveItem(menuCtx, item.id))
        notify('Item removido.')
      } catch {
        notify('Falha ao remover o item.')
      }
    },
    [menuCtx, notify],
  )

  const handleResetMenu = useCallback(async () => {
    if (!window.confirm('Restaurar o cardápio padrão? As customizações serão perdidas.')) return
    try {
      setMenu(await svcResetMenu(menuCtx))
      notify('Cardápio padrão restaurado.')
    } catch {
      notify('Falha ao restaurar o cardápio.')
    }
  }, [menuCtx, notify])

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
