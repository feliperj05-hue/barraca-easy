// Avisos sonoros para ações-chave do caixa (issue #42).
//
// Os sons são sintetizados via Web Audio API (osciladores) — nada de arquivos
// de áudio no repo nem dependências novas. Dois timbres CLARAMENTE distintos,
// para criar memória sonora (reconhecer a ação sem olhar a tela):
//   - addToCart      → um blip curto e leve (uma nota rápida).
//   - paymentDone    → um arpejo ascendente "de conclusão/sucesso".
//
// O som é COMPLEMENTO do feedback visual (toast), nunca substituto (acessib.).
//
// Autoplay policy dos navegadores: o AudioContext só é criado/retomado dentro
// de um gesto do usuário (os dois eventos partem de cliques no caixa), então o
// áudio destrava naturalmente. Tudo é defensivo: se a Web Audio API não existir
// ou algo falhar, a função vira no-op (nunca quebra o fluxo do caixa).

const PREF_KEY = 'barracaEasySoundEnabled'

let audioCtx = null

// Preferência de mudo — chave PRÓPRIA (não entra no objeto de settings, que é
// sobrescrito pelos presets de modo). Habilitado por padrão.
export function isSoundEnabled() {
  const saved = localStorage.getItem(PREF_KEY)
  return saved === null ? true : saved === 'true'
}

export function setSoundEnabled(enabled) {
  localStorage.setItem(PREF_KEY, enabled ? 'true' : 'false')
  return enabled
}

function getContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) {
    try {
      audioCtx = new Ctx()
    } catch {
      return null
    }
  }
  // Chamado dentro do gesto do usuário: destrava se o navegador suspendeu.
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

// Toca uma nota simples com envelope curto (attack rápido + decaimento suave),
// evitando cliques. `start` é o offset em segundos a partir de agora.
function tone(ctx, { freq, start = 0, duration = 0.12, type = 'sine', gain = 0.14 }) {
  const t0 = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  env.gain.setValueAtTime(0, t0)
  env.gain.linearRampToValueAtTime(gain, t0 + 0.012)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(env)
  env.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

// Item adicionado ao carrinho: um blip curto e leve (nota única, aguda).
export function playAddToCart() {
  if (!isSoundEnabled()) return
  const ctx = getContext()
  if (!ctx) return
  try {
    tone(ctx, { freq: 880, duration: 0.09, type: 'triangle', gain: 0.1 })
  } catch {
    // no-op: som é complemento, nunca bloqueia o caixa
  }
}

// Pagamento processado: arpejo ascendente (C5→E5→G5), timbre "de sucesso".
export function playPaymentDone() {
  if (!isSoundEnabled()) return
  const ctx = getContext()
  if (!ctx) return
  try {
    tone(ctx, { freq: 523.25, start: 0.0, duration: 0.13, type: 'sine', gain: 0.14 })
    tone(ctx, { freq: 659.25, start: 0.1, duration: 0.13, type: 'sine', gain: 0.14 })
    tone(ctx, { freq: 783.99, start: 0.2, duration: 0.22, type: 'sine', gain: 0.16 })
  } catch {
    // no-op
  }
}
