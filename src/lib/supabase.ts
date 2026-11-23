import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigurado = Boolean(url && key)

export const supabase = createClient(url || 'http://localhost', key || 'anon', {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** Mensagem de erro legível vinda do Supabase/Postgres */
export function msgErro(e: unknown): string {
  if (!e) return ''
  if (typeof e === 'string') return e
  const anyE = e as { message?: string; details?: string }
  return anyE.message || anyE.details || 'Erro inesperado.'
}
