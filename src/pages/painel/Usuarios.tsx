import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import type { Clube, Perfil } from '../../lib/types'
import { Erro, Spinner } from '../../components/ui'
import { useState } from 'react'

export default function PainelUsuarios() {
  const [erro, setErro] = useState<string | null>(null)
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

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Usuários</h2>
      <p className="text-sm text-slate-500 mb-4">
        Quem se cadastra no site fica “pendente”. Vincule o usuário a um clube para ele gerir os torneios desse clube.
      </p>
      <Erro msg={erro ?? dados.error} />
      {dados.loading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Usuário</th><th>Papel</th><th>Clube</th></tr></thead>
            <tbody>
              {dados.data?.perfis.map((p) => (
                <tr key={p.id}>
                  <td><div className="font-medium">{p.nome || '—'}</div><div className="text-xs text-slate-500">{p.email}</div></td>
                  <td>
                    <select className="input py-1" value={p.papel} onChange={(e) => atualizar(p.id, { papel: e.target.value as Perfil['papel'] })}>
                      <option value="pendente">Pendente</option>
                      <option value="clube">Clube</option>
                      <option value="admin">Federação (admin)</option>
                    </select>
                  </td>
                  <td>
                    <select className="input py-1" value={p.clube_id ?? ''} disabled={p.papel !== 'clube'} onChange={(e) => atualizar(p.id, { clube_id: e.target.value || null })}>
                      <option value="">—</option>
                      {dados.data!.clubes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
