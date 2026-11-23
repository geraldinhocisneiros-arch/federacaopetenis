import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ok, useAsync } from '../lib/useAsync'
import type { Clube } from '../lib/types'
import { Avatar, Erro, Spinner, Titulo } from '../components/ui'

export default function Clubes() {
  const lista = useAsync(async () => ok(await supabase.from('clubes').select('*').eq('ativo', true).order('nome')) as Clube[], [])
  return (
    <div>
      <Titulo sub="Academias e clubes filiados à FPET">Clubes</Titulo>
      <Erro msg={lista.error} />
      {lista.loading ? <Spinner /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.data?.map((c) => (
            <Link key={c.id} to={`/clubes/${c.id}`} className="card p-4 flex items-center gap-3 hover:border-wave/50 hover:shadow transition">
              <Avatar nome={c.nome} url={c.logo_url} tamanho={52} />
              <div className="min-w-0">
                <div className="font-bold truncate">{c.nome}</div>
                <div className="text-xs text-slate-500 truncate">{[c.bairro, c.cidade].filter(Boolean).join(' · ') || '—'}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
