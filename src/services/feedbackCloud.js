import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { notasNaoEnviadas, marcarEnviada } from './pilotLog.js'

// Envio do "Fale com o desenvolvedor" (#85).
//
// POR QUE SUPABASE E NAO OUTRA COISA
//
// A mensagem precisa sair do aparelho e chegar em mim. As opcoes na mesa eram
// e-mail (`mailto:`), WhatsApp (`wa.me`) e a nuvem que o app ja usa.
//
// - `mailto:` depende de haver app de e-mail configurado no tablet e de a
//   pessoa apertar "enviar" numa segunda tela, fora do app. Metade das
//   mensagens morre ali.
// - `wa.me` exige um numero fixo no codigo e tambem joga a pessoa pra fora do
//   app.
// - Supabase e o caminho que pedido, produto e fechamento ja fazem. Nao pede
//   credencial nova (a publishable key ja esta no build), nao depende de nada
//   instalado no aparelho, e chega sozinho: o operador toca em Enviar e acabou.
//
// A REGRA QUE MANDA AQUI: **local primeiro, nuvem depois.**
//
// Quem escreve uma reclamacao esta, por definicao, num momento em que alguma
// coisa nao esta indo bem — inclusive a internet. Entao a mensagem e gravada no
// aparelho ANTES de qualquer tentativa de rede, e o envio e so uma segunda
// etapa que pode falhar sem prejuizo. Se falhar, a nota fica marcada como nao
// enviada, entra no relatorio do piloto do mesmo jeito e tenta subir de novo na
// proxima abertura do app. Feedback perdido e pior que feedback atrasado.
//
// Enquanto a tabela nao existir no banco (a migration e aplicada a mao pelo
// dono do projeto — o agente nao tem DDL, ver supabase/README.md), todo envio
// falha de forma limpa e tudo fica guardado local. A tela funciona igual.

const TABELA = 'feedback'

// Erros que significam "essa tabela ainda nao existe" ou "voce nao tem
// permissao". Nao adianta reenviar em loop: e problema de configuracao, nao de
// rede. Guardar local e seguir a vida.
const CODIGOS_DEFINITIVOS = ['42P01', '42501', 'PGRST205', 'PGRST301']

export function podeEnviar() {
  return isSupabaseConfigured && Boolean(supabase)
}

// Monta a linha. Nada aqui e sensivel: sem senha, sem token, sem chave. O
// e-mail e o do proprio operador logado, que o dono da barraca ja conhece.
function linha(nota, contexto) {
  const c = contexto || {}
  return {
    id_local: nota.id,
    tipo: nota.categoria,
    texto: nota.texto || null,
    tela: nota.tela || null,
    online: nota.online,
    pendentes: nota.pendentes,
    tenant_id: c.tenantId || null,
    tenant_nome: c.tenantNome || null,
    user_email: c.userEmail || null,
    papel: c.role || null,
    modo: c.modo || null,
    app_url: typeof location !== 'undefined' ? location.href : null,
    navegador: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    instalado: Boolean(c.standalone),
    criado_em: nota.ts,
  }
}

// Devolve { ok, motivo }. Nunca joga excecao: quem chama esta no meio de uma
// interacao do operador e nao pode quebrar por causa de rede.
export async function enviarFeedback(nota, contexto) {
  if (!podeEnviar()) return { ok: false, motivo: 'sem-nuvem' }
  try {
    const { error } = await supabase.from(TABELA).insert(linha(nota, contexto))
    if (!error) return { ok: true }
    const definitivo = CODIGOS_DEFINITIVOS.includes(error.code)
    return { ok: false, motivo: definitivo ? 'sem-tabela' : 'rede', erro: error.message }
  } catch (e) {
    return { ok: false, motivo: 'rede', erro: String((e && e.message) || e) }
  }
}

// Segunda chance pro que ficou no aparelho. Roda quando o app abre e quando um
// recado novo e enviado com sucesso — ou seja, quando ja se sabe que a rede
// esta de pe. Sem timer, sem retentativa agressiva: recado nao e venda, pode
// esperar o proximo momento bom.
//
// Para no primeiro erro de rede de proposito. Se a internet caiu, insistir nos
// outros 10 so gasta bateria e enche o log de erro.
export async function reenviarPendentes(contexto) {
  if (!podeEnviar()) return { enviados: 0, restantes: notasNaoEnviadas().length }
  const pendentes = notasNaoEnviadas()
  let enviados = 0
  for (const nota of pendentes) {
    const r = await enviarFeedback(nota, contexto)
    if (r.ok) {
      marcarEnviada(nota.id)
      enviados += 1
    } else if (r.motivo === 'sem-tabela' || r.motivo === 'rede') {
      break
    }
  }
  return { enviados, restantes: notasNaoEnviadas().length }
}
