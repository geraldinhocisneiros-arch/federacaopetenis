import { useState } from 'react'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../lib/auth'
import { chamarApi, gerarSenha } from '../../lib/api'
import type { Clube, Papel, Perfil } from '../../lib/types'
import { Aviso, Campo, Erro, Modal, Spinner } from '../../components/ui'

const ROTULO_PAPEL: Record<Papel, string> = { pendente: 'Pendente', clube: 'Clube', admin: 'Federação (admin)' }

export default function PainelUsuarios() {
  const { session } = useAuth()
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const [credencial, setCredencial] = useState<{ email: string; senha: string; titulo: string } | null>(null)
  const dados = useAsync(async () => {
    const [p, c] = await Promise.all([
      supabase.from('perfis').select('*').order('criado_em', { ascending: false }),
      supabase.from('clubes').select('id,nome').order('nome'),
    ])
    return { perfis: ok(p) as Perfil[], clubes: ok(c) as Clube[] }
  }, [])

  async function atualizar(id: string, mud: Partial<Perfil>) {
    setErro(null)
    const { error } = await supabase.from('perfis').update(mud).eq('id', id)
    if (error) setErro(msgErro(error)); else dados.reload(true)
  }

  async function redefinirSenha(p: Perfil) {
    if (!confirm(`Gerar uma nova senha para ${p.email}?`)) return
    const senha = gerarSenha()
    try {
      await chamarApi(`usuarios/${p.id}/senha`, 'PUT', { senha })
      setCredencial({ email: p.email ?? '', senha, titulo: 'Nova senha gerada' })
    } catch (e) { setErro(msgErro(e)) }
  }

  async function excluir(p: Perfil) {
    if (!confirm(`Excluir o acesso de ${p.email}? A pessoa não conseguirá mais entrar.`)) return
    try {
      await chamarApi(`usuarios/${p.id}`, 'DELETE')
      dados.reload(true)
    } catch (e) { setErro(msgErro(e)) }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h2 className="text-xl font-bold">Usuários</h2>
        <button className="btn-primary" onClick={() => setNovo(true)}>+ Cadastrar usuário</button>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Cadastre quem vai operar o sistema (equipe da federação e responsáveis dos clubes). Usuários “Clube” só gerem os torneios do próprio clube.
      </p>
      <Erro msg={erro ?? dados.error} />
      {dados.loading ? <Spinner /> : (
        <div className="card overflow-x-auto mt-2">
          <table className="table">
            <thead><tr><th>Usuário</th><th>Papel</th><th>Clube</th><th></th></tr></thead>
            <tbody>
              {dados.data?.perfis.map((p) => {
                const eu = p.id === session?.user.id
                return (
                  <tr key={p.id}>
                    <td><div className="font-medium">{p.nome || '—'}{eu && <span className="text-xs text-slate-400"> (você)</span>}</div><div className="text-xs text-slate-500">{p.email}</div></td>
                    <td>
                      <select className="input py-1" value={p.papel} disabled={eu} onChange={(e) => atualizar(p.id, { papel: e.target.value as Papel })}>
                        {(Object.keys(ROTULO_PAPEL) as Papel[]).map((k) => <option key={k} value={k}>{ROTULO_PAPEL[k]}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="input py-1" value={p.clube_id ?? ''} disabled={p.papel !== 'clube'} onChange={(e) => atualizar(p.id, { clube_id: e.target.value || null })}>
                        <option value="">—</option>
                        {dados.data!.clubes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button className="btn-ghost btn-sm" onClick={() => redefinirSenha(p)}>Nova senha</button>
                      {!eu && <button className="btn-danger btn-sm ml-1" onClick={() => excluir(p)}>Excluir</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {novo && (
        <NovoUsuario clubes={dados.data?.clubes ?? []} onFechar={() => setNovo(false)}
          onCriado={(email, senha) => { setNovo(false); setCredencial({ email, senha, titulo: 'Usuário cadastrado' }); dados.reload(true) }} />
      )}

      <Modal aberto={!!credencial} titulo={credencial?.titulo ?? ''} onFechar={() => setCredencial(null)}>
        {credencial && (
          <div className="space-y-3">
            <p className="text-sm">Envie estes dados para a pessoa. Ela pode trocar a senha em <b>Painel → Minha conta</b>.</p>
            <div className="rounded-lg bg-slate-50 p-4 font-mono text-sm space-y-1">
              <div>Site: {window.location.origin}</div>
              <div>E-mail: {credencial.email}</div>
              <div>Senha: <b>{credencial.senha}</b></div>
            </div>
            <button className="btn-primary w-full" onClick={() => {
              navigator.clipboard?.writeText(`Acesso ao sistema da FPET\nSite: ${window.location.origin}/entrar\nE-mail: ${credencial.email}\nSenha: ${credencial.senha}`)
            }}>Copiar mensagem</button>
            <Aviso>A senha não fica salva em lugar nenhum. Se perder, gere uma nova.</Aviso>
          </div>
        )}
      </Modal>
    </div>
  )
}

function NovoUsuario({ clubes, onFechar, onCriado }: { clubes: Clube[]; onFechar: () => void; onCriado: (email: string, senha: string) => void }) {
  const [f, setF] = useState({ nome: '', email: '', senha: gerarSenha(), papel: 'clube' as Papel, clube_id: '' })
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null); setEnviando(true)
    try {
      await chamarApi('usuarios', 'POST', { ...f, clube_id: f.clube_id || null })
      onCriado(f.email.trim().toLowerCase(), f.senha)
    } catch (e) { setErro(msgErro(e)) } finally { setEnviando(false) }
  }

  return (
    <Modal aberto titulo="Cadastrar usuário" onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-3">
        <Campo label="Nome"><input className="input" required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
        <Campo label="E-mail (login)"><input type="email" className="input" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Campo>
        <Campo label="Senha provisória" dica="Gerada automaticamente; você pode trocar.">
          <div className="flex gap-2">
            <input className="input font-mono" required minLength={6} value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} />
            <button type="button" className="btn-ghost btn-sm" onClick={() => setF({ ...f, senha: gerarSenha() })}>Gerar</button>
          </div>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Papel">
            <select className="input" value={f.papel} onChange={(e) => setF({ ...f, papel: e.target.value as Papel })}>
              <option value="clube">Clube</option>
              <option value="admin">Federação (admin)</option>
            </select>
          </Campo>
          {f.papel === 'clube' && (
            <Campo label="Clube">
              <select className="input" required value={f.clube_id} onChange={(e) => setF({ ...f, clube_id: e.target.value })}>
                <option value="">Selecione…</option>
                {clubes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
          )}
        </div>
        {f.papel === 'admin' && <Aviso>Administrador tem acesso total: homologa torneios, mexe no ranking e cadastra usuários.</Aviso>}
        <Erro msg={erro} />
        <button className="btn-primary w-full" disabled={enviando}>{enviando ? 'Cadastrando…' : 'Cadastrar'}</button>
      </form>
    </Modal>
  )
}
