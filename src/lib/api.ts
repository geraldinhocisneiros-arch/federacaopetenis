import { supabase } from './supabase'

/** Chama a API do worker (/api/...) com a sessão do usuário logado */
export async function chamarApi<T = unknown>(caminho: string, metodo: string, corpo?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada. Entre novamente.')
  const res = await fetch(`/api/${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const txt = await res.text()
  let body: { erro?: string } = {}
  try { body = JSON.parse(txt) } catch { /* resposta não-JSON */ }
  if (!res.ok) throw new Error(body.erro || `Erro ${res.status} ao chamar o servidor.`)
  return body as T
}

/** Senha provisória fácil de ditar: ex. "Fpet-4827-kq" */
export function gerarSenha(): string {
  const n = Math.floor(1000 + Math.random() * 9000)
  const l = Array.from({ length: 2 }, () => 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 23)]).join('')
  return `Fpet-${n}-${l}`
}
