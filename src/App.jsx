import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Layout from './components/Layout.jsx'
import Toast from './components/Toast.jsx'
import SyncAlerts from './components/SyncAlerts.jsx'
import DevFeedbackButton from './components/DevFeedbackButton.jsx'
import PrivacyDialog from './components/PrivacyDialog.jsx'
import Cashier from './routes/Cashier.jsx'
import Production from './routes/Production.jsx'
import Closing from './routes/Closing.jsx'
import Settings from './routes/Settings.jsx'
import TrialBanner from './components/TrialBanner.jsx'
import TrialBadge from './components/TrialBadge.jsx'
import Admin from './routes/Admin.jsx'
import { souAdmin } from './services/adminService.js'
import { useAuth } from './auth/AuthContext.jsx'
import { setTicketWidth, TICKET_WIDTH_AUTO, TICKET_WIDTH_MANUAL } from './utils/tickets.js'
import { getTicketMode, isAutoTicket } from './services/settingsService.js'
import {
  NAV_SCREENS,
  SETTINGS_SCREEN,
  ALL_SCREENS,
  canAccess,
  visibleFor,
} from './services/permissions.js'
import {
  fetchOrders,
  createOrder,
  callOrder,
  deliverOrder,
  cancelOrder,
  clearOrders,
} from './services/orderService.js'
import { initSync } from './services/syncQueue.js'
import { reenviarPendentes } from './services/feedbackCloud.js'
import { initNetStatus } from './services/netStatus.js'
import { subscribeOrders } from './services/realtime.js'
import { getSettings, selectMode, resetSettings } from './services/settingsService.js'
import { businessLabel } from './services/businessService.js'
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
import { getClosings, fetchClosings, createClosing } from './services/closingsService.js'
import { downloadClosingReport } from './services/reportService.js'

// Quem ve o que agora mora em services/permissions.js — a mesma fonte que
// alimenta a tabela de permissoes mostrada ao dono (#68).
//
// De quanto em quanto tempo o aparelho reconfere os pedidos no servidor (#57).
// 10s: rapido o bastante para a fila da producao, leve o bastante para o plano
// de dados de uma barraca.
const ORDERS_REFRESH_MS = 10000

export default function App() {
  const { role, membership, user, session, signOut, subscription, refreshSubscription } =
    useAuth()

  // Largura da senha (#79). Vive num lugar so porque `normalizeTicket` e
  // chamada la no fundo do orderService, inclusive no replay da fila offline,
  // onde nao existe settings por perto. Trocar de tipo de senha com venda no
  // caixa e bloqueado na tela, entao dentro de um mesmo expediente a largura
  // nunca muda no meio — e "027" nunca convive com "0027".
  const [ticketMode, setTicketModeState] = useState(() => getTicketMode())
  useEffect(() => {
    setTicketWidth(isAutoTicket(ticketMode) ? TICKET_WIDTH_AUTO : TICKET_WIDTH_MANUAL)
  }, [ticketMode])

  // role null => modo local (sem nuvem) ou dono; libera tudo exceto quando
  // explicitamente for 'operador'.
  const navScreens = visibleFor(NAV_SCREENS, role)

  // Admin da plataforma (#91). Nao e papel da barraca (dono/operador) e sim
  // um flag da plataforma, por isso vem de uma pergunta ao banco em vez de
  // sair de `permissions.js`. Esconder a aba e so conveniencia: as RPCs de
  // admin recusam quem nao esta em `plataforma_admins` de qualquer jeito.
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    let vivo = true
    souAdmin().then((v) => {
      if (vivo) setIsAdmin(v)
    })
    return () => {
      vivo = false
    }
  }, [session])
  const canOpenSettings = canAccess(SETTINGS_SCREEN, role)

  const [screen, setScreen] = useState('cashier')
  const [orders, setOrders] = useState([])
  const [settings, setSettings] = useState(() => getSettings())
  const [menu, setMenu] = useState([])
  const [closings, setClosings] = useState(() => getClosings())
  // getClosings() acima serve o modo local (síncrono); no modo nuvem o
  // efeito abaixo recarrega o histórico do tenant.
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  // Cada acao local (criar, chamar, entregar, cancelar, zerar) incrementa este
  // contador. A recarga periodica (#57) compara o valor de antes e depois da
  // ida ao servidor: se mudou no meio do caminho, a resposta ja nasceu velha e
  // e descartada. Sem isso, marcar "Entregue" podia ver o pedido reaparecer na
  // fila por ate 10s — parecendo bug bem na frente do cliente.
  const ordersSeq = useRef(0)

  const commitOrders = useCallback((list) => {
    ordersSeq.current += 1
    setOrders(list)
  }, [])

  // Garante que o operador nunca fique numa tela que nao pode ver. Settings
  // nao esta na barra, entao entra na checagem por fora dela. Clientes (admin
  // da plataforma) idem: nao e papel da barraca, e flag de plataforma — e se
  // o `isAdmin` chegar como falso, esta checagem sozinha ja devolve a pessoa
  // para o Caixa mesmo que ela force a tela.
  const screenAllowed =
    navScreens.some((s) => s.id === screen) ||
    (screen === 'settings' && canOpenSettings) ||
    (screen === 'admin' && isAdmin)
  const currentScreen = screenAllowed ? screen : 'cashier'

  const notify = useCallback((message) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  // Contexto de dados: com tenant os dados vao para a nuvem (Supabase);
  // sem tenant (modo local) caem no localStorage. Vale para cardapio e pedidos.
  const tenantCtx = useMemo(
    () => (membership && membership.tenantId ? { tenantId: membership.tenantId } : null),
    [membership],
  )

  // Carrega o cardapio (local ou nuvem) e semeia os padrao num tenant novo.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        // Semear so como dono (#99): depois que a RLS passou a exigir papel de
        // dono para escrever em `produtos`, um operador abrindo o app de uma
        // barraca com cardapio vazio tomaria erro de permissao e ficaria sem
        // cardapio nenhum. Semear e tarefa de quem configura a barraca.
        if (role !== "operador") await ensureSeeded(tenantCtx)
        const list = await fetchMenu(tenantCtx)
        if (active) setMenu(list)
      } catch {
        if (active) notify('Falha ao carregar o cardápio.')
      }
    })()
    return () => {
      active = false
    }
  }, [tenantCtx, role, notify])

  // Carrega os pedidos (local ou nuvem) por tenant.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const list = await fetchOrders(tenantCtx)
        if (active) setOrders(list)
      } catch {
        if (active) notify('Falha ao carregar os pedidos.')
      }
    })()
    return () => {
      active = false
    }
  }, [tenantCtx, notify])

  // Sincronizacao entre aparelhos (#57). O caixa lanca num aparelho e a
  // producao acompanha em outro; sem isso a fila da cozinha so atualizava com
  // refresh na mao — ou seja, pedido sumia da vista com fila na frente.
  //
  // Recarga periodica em vez de websocket: nao depende de habilitar publication
  // no painel, e na praia (sinal oscilando) degrada melhor — perdeu uma volta,
  // pega na proxima. So faz sentido no modo nuvem; no modo local o aparelho e
  // um so e a fonte da verdade e o proprio localStorage.
  useEffect(() => {
    if (!tenantCtx) return

    let active = true
    let inFlight = false
    let timer = null

    const refresh = async () => {
      // Nao empilha requisicao quando a rede esta lenta.
      if (inFlight || !active) return
      // Aba escondida (tablet bloqueado, outro app na frente) nao gasta dado.
      if (document.visibilityState !== 'visible') return
      inFlight = true
      const seq = ordersSeq.current
      try {
        const list = await fetchOrders(tenantCtx)
        // Se o operador mexeu na fila enquanto a resposta vinha, ela ja nasceu
        // velha: descarta e deixa o estado local valer.
        if (!active || seq !== ordersSeq.current) return
        // Silencio no erro de proposito: numa praia com sinal ruim, um toast a
        // cada 10s seria pior que o problema. A proxima volta corrige.
        setOrders(list)
      } catch {
        /* mantem a ultima lista boa conhecida */
      } finally {
        inFlight = false
      }
    }

    timer = setInterval(refresh, ORDERS_REFRESH_MS)

    // Realtime por CIMA do polling, nunca no lugar dele: o servidor empurra a
    // mudanca e a fila da producao atualiza quase na hora. Se o websocket cair
    // calado (praia, sinal oscilando), o polling acima continua cobrindo.
    const unsubscribe = subscribeOrders(tenantCtx.tenantId, refresh)

    // Voltou pro primeiro plano ou a conexao voltou: atualiza na hora, sem
    // esperar a proxima volta do relogio.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)

    return () => {
      active = false
      clearInterval(timer)
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [tenantCtx])

  // Recado que ficou preso no aparelho (#85). Quem escreve reclamacao muitas
  // vezes esta sem internet na hora — entao na abertura do app, com a sessao ja
  // resolvida, tenta subir o que sobrou. Sem timer e sem insistencia: se falhar
  // de novo, fica guardado e vai na proxima. Recado nao e venda; a fila de
  // vendas tem motor proprio logo abaixo.
  useEffect(() => {
    reenviarPendentes({
      tenantId: (membership && membership.tenantId) || null,
      tenantNome: (membership && membership.tenantNome) || null,
      userEmail: (user && user.email) || null,
      role,
    }).catch(() => {})
  }, [membership, user, role])

  // Sincronizacao offline (issue #34): liga o motor da fila e recarrega
  // os pedidos quando a outbox sobe ao reconectar.
  useEffect(() => {
    initSync()
    initNetStatus()
  }, [])

  useEffect(() => {
    const onSynced = () => {
      fetchOrders(tenantCtx)
        .then((list) => setOrders(list))
        .catch(() => {})
    }
    window.addEventListener('barraca:synced', onSynced)
    return () => window.removeEventListener('barraca:synced', onSynced)
  }, [tenantCtx])

  // Carrega o histórico de fechamentos (local ou nuvem) por tenant.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const list = await fetchClosings(tenantCtx)
        if (active) setClosings(list)
      } catch {
        if (active) notify('Falha ao carregar o histórico de fechamentos.')
      }
    })()
    return () => {
      active = false
    }
  }, [tenantCtx, notify])

  const handleCreateOrder = useCallback(
    async (payload) => {
      try {
        const order = await createOrder(tenantCtx, payload)
        commitOrders(await fetchOrders(tenantCtx))
        return order
      } catch (e) {
        notify(e.message)
        return null
      }
    },
    [tenantCtx, notify, commitOrders],
  )

  const handleCall = useCallback(
    async (id) => {
      try {
        commitOrders(await callOrder(tenantCtx, id))
      } catch {
        notify('Falha ao chamar a senha.')
      }
    },
    [tenantCtx, notify, commitOrders],
  )

  const handleDeliver = useCallback(
    async (id) => {
      try {
        commitOrders(await deliverOrder(tenantCtx, id))
      } catch {
        notify('Falha ao marcar como entregue.')
      }
    },
    [tenantCtx, notify, commitOrders],
  )

  const handleCancel = useCallback(
    async (id) => {
      if (!window.confirm('Cancelar este pedido? Ele sairá da fila e do fechamento.')) return
      try {
        commitOrders(await cancelOrder(tenantCtx, id))
        notify('Pedido cancelado.')
      } catch {
        notify('Falha ao cancelar o pedido.')
      }
    },
    [tenantCtx, notify, commitOrders],
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

  // --- Cardápio (async: local ou nuvem, conforme o tenantCtx) ---
  const handleSetPrice = useCallback(
    async (id, price) => {
      try {
        setMenu(await svcSetPrice(tenantCtx, id, price))
        notify('Preço atualizado.')
      } catch {
        notify('Falha ao atualizar o preço.')
      }
    },
    [tenantCtx, notify],
  )

  const handleToggleHidden = useCallback(
    async (id, hidden) => {
      try {
        setMenu(await svcToggleHidden(tenantCtx, id, hidden))
        notify(hidden ? 'Item ocultado.' : 'Item visível.')
      } catch {
        notify('Falha ao atualizar a visibilidade.')
      }
    },
    [tenantCtx, notify],
  )

  const handleAddItem = useCallback(
    async (payload) => {
      try {
        setMenu(await svcAddItem(tenantCtx, payload))
        notify('Item adicionado ao cardápio.')
      } catch {
        notify('Falha ao adicionar o item.')
      }
    },
    [tenantCtx, notify],
  )

  const handleUpdateItem = useCallback(
    async (id, patch) => {
      try {
        setMenu(await svcUpdateItem(tenantCtx, id, patch))
        notify('Item atualizado.')
      } catch {
        notify('Falha ao atualizar o item.')
      }
    },
    [tenantCtx, notify],
  )

  const handleRemoveItem = useCallback(
    async (item) => {
      if (!window.confirm(`Remover "${item.name}" do cardápio?`)) return
      try {
        setMenu(await svcRemoveItem(tenantCtx, item.id))
        notify('Item removido.')
      } catch {
        notify('Falha ao remover o item.')
      }
    },
    [tenantCtx, notify],
  )

  const handleResetMenu = useCallback(async () => {
    if (!window.confirm('Restaurar o cardápio padrão? As customizações serão perdidas.')) return
    try {
      setMenu(await svcResetMenu(tenantCtx))
      notify('Cardápio padrão restaurado.')
    } catch {
      notify('Falha ao restaurar o cardápio.')
    }
  }, [tenantCtx, notify])

  // --- Fechamento de caixa ---
  const handleCloseRegister = useCallback(async () => {
    const hasValidSales = orders.some((o) => o.status !== 'cancelado')
    if (!hasValidSales) {
      notify('Nenhuma venda confirmada para fechar.')
      return
    }
    if (!window.confirm('Tem certeza? Isso vai fechar o caixa e zerar a produção.')) return
    try {
      // Cria o fechamento (nuvem ou local; o snapshot vem do estado atual já
      // carregado do backend) e só então limpa os pedidos do tenant.
      await createClosing(tenantCtx, orders)
      await clearOrders(tenantCtx)
      commitOrders([])
      setClosings(await fetchClosings(tenantCtx))
      notify('Caixa fechado. Relatório disponível no histórico.')
    } catch {
      notify('Falha ao fechar o caixa.')
    }
  }, [orders, tenantCtx, notify])

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

  // Cardapio virou secao de Configuracoes (#68); os handlers continuam aqui e
  // descem agrupados, sem mudar nenhuma regra de negocio.
  // Nome da tela em portugues, so pra anotacao do piloto sair legivel (#77).
  const screenLabel = (ALL_SCREENS.find((s) => s.id === currentScreen) || {}).label || currentScreen

  // O que vai no cabecalho do relatorio do piloto. Tudo que ja temos aqui e
  // que ajuda a entender de que aparelho e de que barraca veio a queixa.
  const pilotContext = {
    tenantId: (membership && membership.tenantId) || null,
    tenantNome: (membership && membership.tenantNome) || null,
    userEmail: (user && user.email) || null,
    role,
    modo: settings.operationMode,
    standalone:
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(display-mode: standalone)').matches,
  }

  const menuProps = {
    menu,
    onSetPrice: handleSetPrice,
    onToggleHidden: handleToggleHidden,
    onAddItem: handleAddItem,
    onUpdateItem: handleUpdateItem,
    onRemoveItem: handleRemoveItem,
    onResetMenu: handleResetMenu,
  }

  // A aba Clientes so existe para o admin da plataforma; para todo o resto
  // do mundo a barra continua exatamente como era.
  const telasDaBarra = isAdmin
    ? [...navScreens, { id: 'admin', label: 'Clientes' }]
    : navScreens

  return (
    <Layout
      screens={telasDaBarra}
      current={currentScreen}
      onNavigate={setScreen}
      userLabel={(user && user.email) || null}
      tenantLabel={businessLabel((membership && membership.tenantNome) || null)}
      role={role}
      onLogout={session ? signOut : null}
      onOpenSettings={canOpenSettings ? () => setScreen('settings') : null}
      selo={<TrialBadge subscription={subscription} />}
      rodape={
        <>
          <DevFeedbackButton tela={screenLabel} contexto={pilotContext} notify={notify} />
          <PrivacyDialog />
        </>
      }
    >
      {currentScreen === 'cashier' && (
        <Cashier
          settings={settings}
          menu={menu}
          orders={orders}
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
      {currentScreen === 'settings' && (
        <Settings
          settings={settings}
          onSelectMode={handleSelectMode}
          onResetSettings={handleResetSettings}
          notify={notify}
          role={role}
          tenantNome={(membership && membership.tenantNome) || null}
          menuProps={menuProps}
          pilotContext={pilotContext}
          vendasNoCaixa={orders.length}
          onTicketModeChange={setTicketModeState}
          subscription={subscription}
          onContratou={() => refreshSubscription(membership && membership.tenantId)}
        />
      )}
      {currentScreen === 'admin' && isAdmin && <Admin notify={notify} />}
      <Toast message={toast} />
      <TrialBanner
        subscription={subscription}
        role={role}
        onAbrirAssinatura={
          canOpenSettings ? () => setScreen('settings') : null
        }
      />
      <SyncAlerts />
    </Layout>
  )
}
