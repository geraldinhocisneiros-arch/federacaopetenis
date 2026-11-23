import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ok, useAsync } from '../lib/useAsync'
import type { Atleta, Clube } from '../lib/types'
import { Avatar, Erro, Spinner, Titulo, Vazio } from '../components/ui'

type AtletaComClube = Atleta & { clubes: Pick<Clube, 'nome' | 'sigla'> | null }

export default function Atletas() {
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const lista = useAsync(async () => {
    let q = supabase.from('atletas').select('*, clubes(nome,sigla)').eq('ativo', true).order('nome').limit(200)
    if (termo) q = q.ilike('nome', `%${termo}%`)
    return ok(await q) as AtletaComClube[]
  }, [termo])

  return (
    <div>
      <Titulo sub="Clique no atleta para ver ranking, histórico e resultados.">Atletas</Titulo>
      <form className="flex gap-2 mb-4" onSubmit={(e) => { e.preventDefault(); setTermo(busca.trim()) }}>
        <input className="input" placeholder="Buscar pelo nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="btn-primary">Buscar</button>
      </form>
      <Erro msg={lista.error} />
      {lista.loading ? <Spinner /> : !lista.data?.length ? <Vazio>Nenhum atleta encontrado.</Vazio> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lista.data.map((a) => (
            <Link key={a.id} to={`/atletas/${a.id}`} className="card p-3 flex items-center gap-3 hover:border-wave/50 hover:shadow transition">
              <Avatar nome={a.nome} url={a.foto_url} />
              <div className="min-w-0">
                <div className="font-semibold truncate">{a.nome}</div>
                <div className="text-xs text-slate-500 truncate">{a.clubes?.nome ?? 'Sem clube'}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
