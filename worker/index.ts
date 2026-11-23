/**
 * Worker da FPET: serve o site (arquivos estáticos) e a API de gestão de
 * usuários, que precisa da chave secreta do Supabase (nunca vai ao navegador).
 *
 * Segredo necessário no Cloudflare: SUPABASE_SECRET_KEY (sb_secret_...)
 */
interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> }
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  SUPABASE_SECRET_KEY?: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

const erro = (msg: string, status = 400) => json({ erro: msg }, status)

const PAPEIS = ['pendente', 'clube', 'admin']

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)
    try {
      return await api(req, url, env)
    } catch (e) {
      return erro(e instanceof Error ? e.message : 'Erro inesperado.', 500)
    }
  },
}

async function api(req: Request, url: URL, env: Env): Promise<Response> {
  if (!env.SUPABASE_SECRET_KEY) {
    return erro('Chave secreta do Supabase não configurada no Cloudflare (SUPABASE_SECRET_KEY).', 500)
  }
  const admin = (path: string, init: RequestInit = {}) =>
    fetch(`${env.SUPABASE_URL}${path}`, {
      ...init,
      headers: { apikey: env.SUPABASE_SECRET_KEY!, 'content-type': 'application/json', ...(init.headers ?? {}) },
    })

  // 1) Quem está chamando? Valida o token de sessão do usuário.
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return erro('Não autenticado.', 401)
  const quem = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}` },
  })
  if (!quem.ok) return erro('Sessão inválida. Entre novamente.', 401)
  const usuario = (await quem.json()) as { id: string }

  // 2) Só a federação (admin) gerencia usuários.
  const perfil = await admin(`/rest/v1/perfis?id=eq.${usuario.id}&select=papel`)
  const linhas = (await perfil.json()) as { papel: string }[]
  if (linhas[0]?.papel !== 'admin') return erro('Apenas a federação pode gerenciar usuários.', 403)

  const partes = url.pathname.replace(/^\/api\/usuarios\/?/, '').split('/').filter(Boolean)

  // POST /api/usuarios  -> cria usuário já confirmado, com senha provisória
  if (req.method === 'POST' && partes.length === 0) {
    const b = (await req.json()) as { nome?: string; email?: string; senha?: string; papel?: string; clube_id?: string | null }
    const email = (b.email ?? '').trim().toLowerCase()
    if (!email.includes('@')) return erro('E-mail inválido.')
    if (!b.senha || b.senha.length < 6) return erro('A senha precisa ter ao menos 6 caracteres.')
    const papel = PAPEIS.includes(b.papel ?? '') ? b.papel! : 'pendente'
    if (papel === 'clube' && !b.clube_id) return erro('Escolha o clube do usuário.')

    const cria = await admin('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password: b.senha, email_confirm: true, user_metadata: { nome: b.nome ?? '' } }),
    })
    const criado = (await cria.json()) as { id?: string; msg?: string; message?: string; error_description?: string }
    if (!cria.ok || !criado.id) {
      const m = criado.msg || criado.message || criado.error_description || 'Não foi possível criar o usuário.'
      return erro(/already|registered|exists/i.test(m) ? 'Já existe um usuário com este e-mail.' : m)
    }

    const upd = await admin(`/rest/v1/perfis?id=eq.${criado.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ nome: b.nome ?? '', papel, clube_id: papel === 'clube' ? b.clube_id : null }),
    })
    if (!upd.ok) return erro('Usuário criado, mas não foi possível definir o papel. Ajuste na lista.', 500)
    return json({ id: criado.id }, 201)
  }

  const alvo = partes[0]
  if (!alvo || !/^[0-9a-f-]{36}$/.test(alvo)) return erro('Rota não encontrada.', 404)

  // PUT /api/usuarios/:id/senha  -> redefine a senha
  if (req.method === 'PUT' && partes[1] === 'senha') {
    const b = (await req.json()) as { senha?: string }
    if (!b.senha || b.senha.length < 6) return erro('A senha precisa ter ao menos 6 caracteres.')
    const r = await admin(`/auth/v1/admin/users/${alvo}`, { method: 'PUT', body: JSON.stringify({ password: b.senha }) })
    return r.ok ? json({ ok: true }) : erro('Não foi possível alterar a senha.')
  }

  // DELETE /api/usuarios/:id  -> remove o acesso
  if (req.method === 'DELETE' && partes.length === 1) {
    if (alvo === usuario.id) return erro('Você não pode excluir o seu próprio usuário.')
    const r = await admin(`/auth/v1/admin/users/${alvo}`, { method: 'DELETE' })
    return r.ok ? json({ ok: true }) : erro('Não foi possível excluir o usuário.')
  }

  return erro('Rota não encontrada.', 404)
}
