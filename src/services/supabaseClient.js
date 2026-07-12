// Cliente Supabase (Fase 1 do SaaS — ver issue #27 / epic #26).
//
// As credenciais vem de variaveis de ambiente Vite (prefixo VITE_,
// expostas via import.meta.env). Em dev, defina-as em `.env.local`
// (nao versionado); ver `.env.example`. A publishable key e publica
// por design e protegida por Row-Level Security no Supabase.
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
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
