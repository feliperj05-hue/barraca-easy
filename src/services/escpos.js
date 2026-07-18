// Camada ESC/POS pura (issue #63).
//
// Aqui NAO tem nada de navegador, USB ou React: entra um "documento" (lista de
// blocos) e sai ou os bytes que a impressora termica entende, ou o texto
// equivalente para pre-visualizacao. Isso e de proposito — sem impressora na
// mesa, a unica forma de validar o cupom e conseguir olhar o resultado sem
// hardware nenhum.
//
// Modelo de documento (o receiptLayout.js monta isso):
//   { type: 'text', value, align: 'left|center|right', size: 1|2|3, bold }
//   { type: 'columns', left, right, bold }   -> "2x Coxinha        12,00"
//   { type: 'divider', char: '-' }
//   { type: 'feed', lines: n }
//
// Perfil assumido: impressora termica generica compativel com ESC/POS
// (padrao Epson TM-T20 / clones chineses). Os comandos usados sao o
// subconjunto que praticamente todo clone implementa.

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

// Colunas de texto por largura de papel, na fonte A (padrao).
export const COLUMNS_BY_WIDTH = { 58: 32, 80: 48 }

export function columnsFor(paperWidth) {
  return COLUMNS_BY_WIDTH[Number(paperWidth)] || COLUMNS_BY_WIDTH[58]
}

// --- Acentuacao -------------------------------------------------------
//
// TextEncoder so fala UTF-8, e impressora termica nao entende UTF-8. As duas
// saidas suportadas:
//  - 'cp850': tabela Latin-1 (ESC t 2). Cobre o portugues inteiro.
//  - 'ascii': tira o acento antes de mandar. Feio, mas NUNCA sai lixo — e o
//    plano B para clone que ignora ESC t e vive preso na CP437.
const CP850 = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'ç': 0x87,
  'ê': 0x88, 'ë': 0x89, 'è': 0x8a, 'ï': 0x8b, 'î': 0x8c, 'ì': 0x8d, 'Ä': 0x8e,
  'É': 0x90, 'ô': 0x93, 'ö': 0x94, 'ò': 0x95, 'û': 0x96, 'ù': 0x97, 'ÿ': 0x98,
  'Ö': 0x99, 'Ü': 0x9a, 'ø': 0x9b, 'á': 0xa0, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3,
  'ñ': 0xa4, 'Ñ': 0xa5, 'ª': 0xa6, 'º': 0xa7, 'Á': 0xb5, 'Â': 0xb6, 'À': 0xb7,
  'ã': 0xc6, 'Ã': 0xc7, 'Ê': 0xd2, 'Ë': 0xd3, 'È': 0xd4, 'Í': 0xd6, 'Î': 0xd7,
  'Ì': 0xde, 'Ó': 0xe0, 'Ô': 0xe2, 'Ò': 0xe3, 'õ': 0xe4, 'Õ': 0xe5, 'Ú': 0xe9,
  'Û': 0xea, 'Ù': 0xeb, '°': 0xf8,
}

// Codigo do comando ESC t (select character code table) por encoding.
const CODEPAGE_CMD = { cp850: 2, ascii: null }

// Tira acento mantendo a letra base (para o modo 'ascii' e para qualquer
// caractere que a CP850 nao tenha).
function deaccent(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function encodeText(str, encoding = 'cp850') {
  const out = []
  const source = encoding === 'ascii' ? deaccent(String(str)) : String(str)
  for (const ch of source) {
    const code = ch.codePointAt(0)
    if (code < 0x80) {
      out.push(code)
      continue
    }
    if (encoding !== 'ascii' && CP850[ch] != null) {
      out.push(CP850[ch])
      continue
    }
    // Fora da tabela: cai para a letra base; se nem isso der, vira '?'.
    const fallback = deaccent(ch).codePointAt(0)
    out.push(fallback != null && fallback < 0x80 ? fallback : 0x3f)
  }
  return out
}

// --- Helpers de texto -------------------------------------------------

export function padColumns(left, right, width) {
  const l = String(left)
  const r = String(right)
  const space = width - l.length - r.length
  if (space >= 1) return l + ' '.repeat(space) + r
  // Nao coube: corta a descricao (nunca o valor — dinheiro nao se trunca).
  const room = Math.max(0, width - r.length - 1)
  return l.slice(0, room) + ' ' + r
}

// Quebra por palavra respeitando a largura efetiva.
export function wrapText(text, width) {
  const lines = []
  for (const raw of String(text).split('\n')) {
    if (!raw.trim()) {
      lines.push('')
      continue
    }
    let current = ''
    for (const word of raw.trim().split(/\s+/)) {
      if (!current.length) {
        current = word
      } else if (current.length + 1 + word.length <= width) {
        current += ' ' + word
      } else {
        lines.push(current)
        current = word
      }
      while (current.length > width) {
        lines.push(current.slice(0, width))
        current = current.slice(width)
      }
    }
    lines.push(current)
  }
  return lines
}

// Alinhamento para a PREVIA em texto. `size` importa: a impressora alinha o
// texto ampliado dentro da largura total do papel, e cada letra ocupa `size`
// colunas. Sem levar isso em conta, a previa mostraria a senha fora do lugar
// e a conferencia do layout mentiria.
function alignLine(text, align, width, size = 1) {
  const footprint = text.length * size
  if (align === 'center') {
    return ' '.repeat(Math.max(0, Math.floor((width - footprint) / 2))) + text
  }
  if (align === 'right') {
    return ' '.repeat(Math.max(0, width - footprint)) + text
  }
  return text
}

// Largura util quando o texto esta ampliado (size 2 ocupa 2 colunas por letra).
function effectiveWidth(width, size) {
  return Math.max(1, Math.floor(width / (size || 1)))
}

// --- Bytes ------------------------------------------------------------

const ALIGN_CODE = { left: 0, center: 1, right: 2 }

function sizeByte(size) {
  const n = Math.min(8, Math.max(1, size || 1)) - 1
  return (n << 4) | n // mesma ampliacao em largura e altura
}

// Converte o documento nos bytes ESC/POS.
export function renderBytes(blocks, options = {}) {
  const { paperWidth = 58, encoding = 'cp850', cut = true, feedBeforeCut = 4 } = options
  const width = columnsFor(paperWidth)
  const out = []

  out.push(ESC, 0x40) // ESC @ — reset da impressora
  const cp = CODEPAGE_CMD[encoding]
  if (cp != null) out.push(ESC, 0x74, cp) // ESC t n — tabela de caracteres

  const writeLine = (text, { align = 'left', size = 1, bold = false } = {}) => {
    out.push(ESC, 0x61, ALIGN_CODE[align] ?? 0) // ESC a n — alinhamento
    out.push(GS, 0x21, sizeByte(size)) // GS ! n — tamanho do caractere
    if (bold) out.push(ESC, 0x45, 1) // ESC E n — negrito
    out.push(...encodeText(text, encoding), LF)
    if (bold) out.push(ESC, 0x45, 0)
    out.push(GS, 0x21, 0)
  }

  for (const block of blocks) {
    if (!block) continue
    if (block.type === 'text') {
      const size = block.size || 1
      for (const line of wrapText(block.value, effectiveWidth(width, size))) {
        writeLine(line, { align: block.align || 'left', size, bold: block.bold })
      }
    } else if (block.type === 'columns') {
      writeLine(padColumns(block.left, block.right, width), { bold: block.bold })
    } else if (block.type === 'divider') {
      writeLine((block.char || '-').repeat(width))
    } else if (block.type === 'feed') {
      out.push(ESC, 0x64, Math.min(255, Math.max(1, block.lines || 1))) // ESC d n
    }
  }

  if (cut) {
    out.push(ESC, 0x64, feedBeforeCut) // sobe o papel acima da guilhotina
    out.push(GS, 0x56, 66, 0) // GS V 66 0 — corte parcial
  }

  return new Uint8Array(out)
}

// --- Pre-visualizacao sem impressora ----------------------------------

// Mesmo documento, saida em texto puro. E o que permite conferir o layout com
// zero hardware — a impressora vai imprimir exatamente estas colunas.
export function renderPlainText(blocks, options = {}) {
  const width = columnsFor(options.paperWidth || 58)
  const lines = []
  for (const block of blocks) {
    if (!block) continue
    if (block.type === 'text') {
      const size = block.size || 1
      const w = effectiveWidth(width, size)
      for (const line of wrapText(block.value, w)) {
        lines.push(alignLine(line, block.align || 'left', width, size))
      }
    } else if (block.type === 'columns') {
      lines.push(padColumns(block.left, block.right, width))
    } else if (block.type === 'divider') {
      lines.push((block.char || '-').repeat(width))
    } else if (block.type === 'feed') {
      for (let i = 0; i < (block.lines || 1); i += 1) lines.push('')
    }
  }
  return lines.join('\n')
}

// Dump hex dos bytes, para conferir os comandos sem impressora na mao.
export function toHexDump(bytes, perLine = 16) {
  const rows = []
  for (let i = 0; i < bytes.length; i += perLine) {
    const chunk = Array.from(bytes.slice(i, i + perLine))
    const hex = chunk.map((b) => b.toString(16).padStart(2, '0')).join(' ')
    const ascii = chunk.map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('')
    rows.push(i.toString(16).padStart(4, '0') + '  ' + hex.padEnd(perLine * 3 - 1) + '  ' + ascii)
  }
  return rows.join('\n')
}
