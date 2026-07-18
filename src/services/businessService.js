// Dados da barraca / empresa (issue #68).
//
// ESCOPO HONESTO DESTA FASE: isso e configuracao LOCAL do aparelho
// (localStorage), nao cadastro de empresa em nuvem. O nome do tenant continua
// morando no Supabase; aqui ficam os dados que o app usa no dia a dia e que
// hoje nao tem onde morar — contato, CNPJ, endereco, mensagem do cupom.
//
// Consequencia pratica que a UI avisa ao operador: dois tablets da mesma
// barraca tem cada um a sua copia. Sincronizar isso e assunto da fase SaaS
// (epic #26), quando houver tabela de tenant com esses campos.

import {
  getPrinterSettings,
  savePrinterSettings,
  DEFAULT_PRINTER_SETTINGS,
} from './printerService.js'

const STORAGE_KEY = 'barracaEasyBusiness'

export const DEFAULT_BUSINESS = {
  name: '',
  phone: '',
  document: '', // CNPJ/CPF — opcional
  address: '',
  receiptMessage: '', // rodape do cupom (ex.: "Obrigado e volte sempre!")
}

export function getBusiness() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_BUSINESS, ...JSON.parse(raw) }
  } catch {
    // storage corrompido: volta para o padrao em vez de quebrar a tela
  }
  return { ...DEFAULT_BUSINESS }
}

// Salva e devolve o estado completo (mesmo contrato do printerService).
export function saveBusiness(patch) {
  const next = { ...getBusiness(), ...patch }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  syncReceiptIdentity(next)
  return next
}

export function resetBusiness() {
  localStorage.removeItem(STORAGE_KEY)
  return { ...DEFAULT_BUSINESS }
}

// Liga os dados da barraca ao cupom SEM atropelar quem ja customizou.
//
// Regra: so escreve no cabecalho/rodape do cupom se o campo ainda estiver no
// padrao de fabrica (ou vazio). Quem digitou um cabecalho proprio na tela de
// impressao continua com ele — dado de cadastro nao manda mais que escolha
// explicita do dono.
function syncReceiptIdentity(business) {
  const printer = getPrinterSettings()
  const patch = {}

  const headerIsFactory =
    !printer.header || printer.header.trim() === DEFAULT_PRINTER_SETTINGS.header
  if (business.name && headerIsFactory) {
    patch.header = business.name.toUpperCase().slice(0, 40)
  }

  const footerIsFactory =
    !printer.footer || printer.footer.trim() === DEFAULT_PRINTER_SETTINGS.footer
  if (business.receiptMessage && footerIsFactory) {
    patch.footer = business.receiptMessage.slice(0, 60)
  }

  if (Object.keys(patch).length) savePrinterSettings(patch)
}

// Rotulo curto da barraca para o cabecalho do app. Prioriza o nome do tenant
// (nuvem, vale para a equipe toda) e cai no cadastro local quando nao ha nuvem.
export function businessLabel(tenantNome) {
  if (tenantNome) return tenantNome
  const { name } = getBusiness()
  return name || null
}
