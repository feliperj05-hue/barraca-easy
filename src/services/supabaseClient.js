// Cliente Supabase (Fase 1 do SaaS — ver issue #27 / epic #26).
//
// As credenciais vem de variaveis de ambiente Vite (prefixo VITE_,
// expostas via import.meta.env). Em dev, defina-as em `.env.local`
// (nao versionado); ver `.env.example`. A publishable key e publica
// por design e protegida por Row-Level Security no Supabase.
import { createClient } from "@supabase/supabase-js"

// O supabase-js espera a URL BASE do projeto (https://<ref>.supabase.co) e
// monta os caminhos /rest/v1, /auth/v1 etc. por conta propria. Se a variavel
// chegar com "/rest/v1" ou barra(s) no fim (engano comum ao copiar da tela
// "API" do Supabase), aparamos aqui pra nao gerar URL duplicada (.../rest/v1//rest/v1).
function normalizeSupabaseUrl(url) {
  if (!url) return url
  let u = url.trim().replace(/\/+$/, "")
  const stripped = u.replace(/\/rest\/v1$/i, "")
  if (stripped !== u) {
    console.warn(
      "[supabase] VITE_SUPABASE_URL veio com \"/rest/v1\" no fim; usando a URL " +
        "base. Ajuste a variavel para so \"https://<ref>.supabase.co\".",
    )
    u = stripped
  }
  return u
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Sem credenciais o app continua funcionando 100% offline (localStorage);
// apenas os recursos de nuvem ficam indisponiveis. Avisamos de forma clara.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

if (!isSupabaseConfigured) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL e/ou VITE_SUPABASE_PUBLISHABLE_KEY ausentes. " +
      "Copie .env.example para .env.local e preencha as credenciais. " +
      "Recursos de nuvem ficarao desativados ate la.",
  )
}

// Exporta null quando nao configurado, para o chamador decidir o fallback.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null

// Health-check basico: confirma que o app consegue falar com o projeto.
// Nesta fase ainda nao ha tabelas (schema/RLS chega na #28), entao um erro
// de "tabela inexistente" ainda conta como conexao OK (o endpoint respondeu).
export async function checkSupabaseConnection() {
  if (!supabase) {
    return { ok: false, reason: "not-configured" }
  }
  try {
    const { error } = await supabase.from("tenants").select("id").limit(1)
    if (error && !/does not exist|schema cache|relation/i.test(error.message)) {
      return { ok: false, reason: error.message }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err?.message ?? String(err) }
  }
}
