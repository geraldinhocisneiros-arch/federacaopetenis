import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../lib/auth'
import type { Atleta } from '../../lib/types'
import { Erro, Spinner, Vazio } from '../../components/ui'
import AtletaForm from './AtletaForm'

type Linha = Atleta & { clubes: { nome: string } | null }

export default function PainelAtletas() {
  const { isAdmin, perfil } = useAuth()
  const [busca, setBusca] = useState('')
  const [soMeuClube, setSoMeuClube] = useState(!isAdmin)
  const [editando, setEditando] = useState<Atleta | null | 'novo'>(null)
  const [erro, setErro] = useState<string | null>(null)
  const lista = useAsync(async () => {
    let q = supabase.from('atletas').select('*, clubes(nome)').order('nome').limit(300)
    if (busca.trim()) q = q.ilike('nome', `%${busca.trim()}%`)
    if (soMeuClube && perfil?.clube_id) q = q.eq('clube_id', perfil.clube_id)
    return ok(await q) as Linha[]
  }, [busca, soMeuClube])

  async function excluir(a: Atleta) {
    if (!confirm(`Excluir ${a.nome}? Só é possível se não tiver inscrições.`)) return
    const { error } = await supabase.from('atletas').delete().eq('id', a.id)
    if (error) setErro(msgErro(error).includes('foreign key') ? 'Atleta tem inscrições: marque como inativo em vez de excluir.' : msgErro(error))
    else lista.reload()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold">Atletas</h2>
        <button className="btn-primary" onClick={() => setEditando('novo')}>+ Novo atleta</button>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input className="input max-w-sm" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {perfil?.clube_id && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={soMeuClube} onChange={(e) => setSoMeuClube(e.target.checked)} /> Só do meu clube</label>
        )}
      </div>
      <Erro msg={erro ?? lista.error} />
      {lista.loading ? <Spinner /> : !lista.data?.length ? <div className="card"><Vazio>Nenhum atleta.</Vazio></div> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Nome</th><th className="hidden sm:table-cell">Clube</th><th className="hidden sm:table-cell">Sexo</th><th></th></tr></thead>
            <tbody>
              {lista.data.map((a) => (
                <tr key={a.id} className={a.ativo ? '' : 'opacity-50'}>
                  <td><Link to={`/atletas/${a.id}`} className="font-medium hover:underline">{a.nome}</Link></td>
                  <td className="hidden sm:table-cell text-slate-500">{a.clubes?.nome ?? '—'}</td>
                  <td className="hidden sm:table-cell text-slate-500">{a.sexo ?? '—'}</td>
                  <td className="text-right whitespace-nowrap">
                    <button className="btn-ghost btn-sm" onClick={() => setEditando(a)}>Editar</button>
                    {isAdmin && <button className="btn-danger btn-sm ml-1" onClick={() => excluir(a)}>Excluir</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <AtletaForm atleta={editando === 'novo' ? null : editando} onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); lista.reload() }} />
      )}
    </div>
  )
}
