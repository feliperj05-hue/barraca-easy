// Modos de operação. Apenas "Sincronizado com Produção" é completo no MVP;
// os outros dois ficam pré-configurados para fases futuras.
const STORAGE_KEY = 'barracaEasySettings'

export const DEFAULT_MODE = 'cashier_production_sync'

export const MODES = {
  cashier_printer: {
    key: 'cashier_printer',
    number: 1,
    short: 'Print',
    name: 'Caixa + Impressora',
    description:
      'O caixa registra o pedido, recebe o pagamento e entrega ou imprime a senha para o cliente.',
    ideal: ['Caixa tradicional', 'Senha impressa ou física', 'Operação com uma tela principal'],
    preview: [
      'Senha: sistema gera ou caixa informa',
      'Produção: opcional',
      'Impressora: preparada para fase futura',
    ],
    status: 'future',
    statusLabel: 'Preparado para próxima fase',
    preset: {
      operationMode: 'cashier_printer',
      deviceMode: 'cashier',
      ticketMode: 'manual_or_system_generated',
      usesProductionScreen: false,
      customerSelfService: false,
      paymentTiming: 'before_ticket',
    },
  },
  cashier_production_sync: {
    key: 'cashier_production_sync',
    number: 2,
    short: 'Sync',
    name: 'Sincronizado com Produção',
    description:
      'Um tablet fica no caixa e outro na produção. O caixa confirma o pagamento, informa a senha física e a produção acompanha a fila.',
    ideal: [
      'Barraca com caixa externo',
      'Senha física em papel',
      'Equipe chamando senha em sequência',
    ],
    preview: [
      'Senha: caixa informa senha física',
      'Produção: obrigatória',
      'Fluxo: pedido → pagamento → senha → produção',
    ],
    status: 'mvp',
    statusLabel: 'Completo no MVP',
    preset: {
      operationMode: 'cashier_production_sync',
      deviceMode: 'cashier',
      ticketMode: 'manual_physical_ticket',
      usesProductionScreen: true,
      customerSelfService: false,
      paymentTiming: 'before_ticket',
    },
  },
  self_service_kiosk: {
    key: 'self_service_kiosk',
    number: 3,
    short: 'Auto',
    name: '100% Autônomo',
    description:
      'O cliente escolhe os itens sozinho, paga, recebe a senha e o pedido vai para a produção.',
    ideal: ['Autoatendimento real', 'Redução de fila no caixa', 'Pix integrado no futuro'],
    preview: [
      'Senha: sistema gera automaticamente',
      'Produção: obrigatória',
      'Pagamento: preparado para integração futura',
    ],
    status: 'future',
    statusLabel: 'Preparado para próxima fase',
    preset: {
      operationMode: 'self_service_kiosk',
      deviceMode: 'kiosk',
      ticketMode: 'system_generated',
      usesProductionScreen: true,
      customerSelfService: true,
      paymentTiming: 'before_production',
    },
  },
}

export function getModeList() {
  return Object.values(MODES).sort((a, b) => a.number - b.number)
}

export function getSettings() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      // fallback para o padrão se o storage estiver corrompido
    }
  }
  return { ...MODES[DEFAULT_MODE].preset }
}

export function getCurrentMode(settings = getSettings()) {
  return MODES[settings.operationMode] || MODES[DEFAULT_MODE]
}

export function selectMode(modeKey) {
  const mode = MODES[modeKey] || MODES[DEFAULT_MODE]
  const settings = { ...mode.preset }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  return settings
}

export function resetSettings() {
  return selectMode(DEFAULT_MODE)
}
