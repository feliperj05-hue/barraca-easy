// Impressora termica via WebUSB (issue #63).
//
// POR QUE WEBUSB E NAO window.print():
// `window.print()` sempre abre dialogo do sistema. Com fila no balcao isso e
// inviavel — o cupom tem que sair sozinho. Impressao automatica de verdade
// exige mandar bytes ESC/POS direto para a impressora, e no navegador o unico
// caminho confiavel para isso e WebUSB (cabo USB/OTG).
//
// POR QUE NAO BLUETOOTH:
// o Web Bluetooth do Chrome so fala BLE; a maioria das termicas baratas usa
// Bluetooth Classic/SPP. Nao e questao de codigo — o navegador simplesmente
// nao conversa com elas.
//
// LIMITE CONHECIDO: iPhone/Safari nao tem WebUSB. Neste ambiente o app detecta
// a ausencia de suporte e explica, em vez de quebrar. O cupom automatico e
// recurso do tablet Android com Chrome.

import { renderBytes, renderPlainText, toHexDump } from './escpos.js'
import { buildReceipt } from './receiptLayout.js'

const SETTINGS_KEY = 'barracaEasyPrinterSettings'

// Classe USB 7 = printer. E o filtro que faz o seletor do Chrome mostrar so
// impressora, e nao a lista inteira de tranqueira USB do aparelho.
const USB_PRINTER_CLASS = 7

export const DEFAULT_PRINTER_SETTINGS = {
  enabled: false, // impressao automatica ao confirmar o pagamento
  paperWidth: 58, // 58mm (32 col) ou 80mm (48 col)
  encoding: 'cp850', // 'cp850' ou 'ascii' (sem acento)
  header: 'BARRACA EASY',
  footer: 'Obrigado e volte sempre!',
  showItems: true,
  copies: 1,
  cut: true, // enviar comando de corte no fim
}

export function getPrinterSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // storage corrompido: volta para o padrao
  }
  return { ...DEFAULT_PRINTER_SETTINGS }
}

export function savePrinterSettings(patch) {
  const next = { ...getPrinterSettings(), ...patch }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch {
    // sem storage o app segue funcionando, so nao lembra a config
  }
  return next
}

// --- Suporte do ambiente ---------------------------------------------

export function isWebUsbSupported() {
  return typeof navigator !== 'undefined' && Boolean(navigator.usb)
}

// Mensagem util quando nao da para imprimir automatico neste aparelho.
export function unsupportedReason() {
  if (isWebUsbSupported()) return null
  if (typeof navigator === 'undefined') return 'Ambiente sem navegador.'
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua) || /^((?!chrome|android).)*safari/i.test(ua)) {
    return 'iPhone, iPad e Safari não têm WebUSB. A impressão automática funciona no tablet Android com Chrome.'
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'WebUSB só funciona em HTTPS. Abra o app pelo endereço seguro (https).'
  }
  return 'Este navegador não tem WebUSB. Use o Chrome no Android para imprimir automaticamente.'
}

// --- Dispositivo -------------------------------------------------------

// Impressora ja autorizada antes (a permissao do WebUSB fica gravada no
// navegador, entao no dia seguinte a barraca nao precisa parear de novo).
export async function getKnownPrinter() {
  if (!isWebUsbSupported()) return null
  const devices = await navigator.usb.getDevices()
  return devices[0] || null
}

// Abre o seletor do Chrome. Exige gesto do usuario (clique) — por isso mora
// num botao nas Configuracoes, nunca no meio da venda.
export async function requestPrinter() {
  if (!isWebUsbSupported()) throw new Error(unsupportedReason())
  return navigator.usb.requestDevice({
    filters: [{ classCode: USB_PRINTER_CLASS }],
  })
}

export function describeDevice(device) {
  if (!device) return null
  const name = device.productName || 'Impressora USB'
  const vendor = device.manufacturerName ? device.manufacturerName + ' · ' : ''
  const ids =
    'VID ' +
    (device.vendorId || 0).toString(16).padStart(4, '0') +
    ' / PID ' +
    (device.productId || 0).toString(16).padStart(4, '0')
  return vendor + name + ' (' + ids + ')'
}

// Acha a interface de impressora e o endpoint de saida. Cada clone monta isso
// de um jeito, entao procuramos em vez de chutar numero fixo.
function findOutEndpoint(device) {
  for (const config of device.configurations || []) {
    for (const iface of config.interfaces || []) {
      for (const alt of iface.alternates || []) {
        if (alt.interfaceClass !== USB_PRINTER_CLASS) continue
        const ep = (alt.endpoints || []).find((e) => e.direction === 'out')
        if (ep) {
          return {
            configuration: config.configurationValue,
            interfaceNumber: iface.interfaceNumber,
            endpoint: ep.endpointNumber,
          }
        }
      }
    }
  }
  return null
}

// Manda os bytes. Fatiamos em blocos porque buffer de impressora termica e
// pequeno; pacote grande demais some no meio.
const CHUNK = 2048

export async function sendBytes(bytes, device) {
  const target = device || (await getKnownPrinter())
  if (!target) {
    throw new Error('Nenhuma impressora conectada. Conecte em Configurações → Impressora.')
  }
  const route = (() => {
    const found = findOutEndpoint(target)
    if (found) return found
    // Perfil de fallback: praticamente todo clone ESC/POS usa config 1,
    // interface 0, endpoint 1.
    return { configuration: 1, interfaceNumber: 0, endpoint: 1 }
  })()

  await target.open()
  try {
    if (!target.configuration) await target.selectConfiguration(route.configuration)
    await target.claimInterface(route.interfaceNumber)
    for (let i = 0; i < bytes.length; i += CHUNK) {
      await target.transferOut(route.endpoint, bytes.slice(i, i + CHUNK))
    }
  } finally {
    try {
      await target.releaseInterface(route.interfaceNumber)
    } catch {
      // liberar interface pode falhar se o cabo saiu; nao mascara o erro real
    }
    try {
      await target.close()
    } catch {
      // idem
    }
  }
}

// --- API de alto nivel usada pelas telas ------------------------------

// Bytes + preview de um pedido, na config atual. Serve tanto para imprimir
// quanto para conferir na tela sem hardware.
export function buildReceiptOutput(order, settings = getPrinterSettings()) {
  const blocks = buildReceipt(order, settings)
  const options = {
    paperWidth: settings.paperWidth,
    encoding: settings.encoding,
    cut: settings.cut !== false,
  }
  const bytes = renderBytes(blocks, options)
  return {
    blocks,
    bytes,
    text: renderPlainText(blocks, options),
    hex: toHexDump(bytes),
  }
}

// Imprime o cupom de um pedido. Devolve {printed, reason} em vez de estourar:
// impressora com problema NUNCA pode derrubar uma venda ja confirmada.
export async function printOrder(order, settings = getPrinterSettings()) {
  if (!isWebUsbSupported()) {
    return { printed: false, reason: unsupportedReason() }
  }
  try {
    const device = await getKnownPrinter()
    if (!device) {
      return { printed: false, reason: 'Nenhuma impressora conectada.' }
    }
    const { bytes } = buildReceiptOutput(order, settings)
    const copies = Math.min(3, Math.max(1, Number(settings.copies) || 1))
    for (let i = 0; i < copies; i += 1) {
      await sendBytes(bytes, device)
    }
    return { printed: true, reason: null }
  } catch (err) {
    return { printed: false, reason: err?.message || 'Falha ao imprimir.' }
  }
}
