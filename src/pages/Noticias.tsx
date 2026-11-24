import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ok, useAsync } from '../lib/useAsync'
import { TIPOS_PUB, dataPub } from '../lib/publicacoes'
import type { Publicacao } from '../lib/types'
import { Erro, Spinner, Titulo, Vazio } from '../components/ui'

export function CardPublicacao({ p }: { p: Publicacao }) {
  return (
    <Link to={`/noticias/${p.id}`} className="card overflow-hidden hover:border-wave flex flex-col">
      {p.imagem_url
        ? <img src={p.imagem_url} alt="" className="h-40 w-full object-cover" />
        : <div className="h-2 bg-gradient-to-r from-wave via-wave-light to-ball" />}
      <div className="p-4 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-wave">{TIPOS_PUB[p.tipo]} · {dataPub(p.publicado_em)}</div>
        <h3 className="font-bold mt-1 leading-snug">{p.titulo}</h3>
        {p.resumo && <p className="text-sm text-slate-600 mt-1 line-clamp-3">{p.resumo}</p>}
      </div>
    </Link>
  )
}

export default function Noticias() {
  const lista = useAsync(async () => ok(await supabase.from('publicacoes').select('*').eq('publicado', true)
    .order('publicado_em', { ascending: false }).limit(60)) as Publicacao[], [])
  return (
    <div>
      <Titulo sub="Notícias, comunicados, resultados e editais da FPET">Notícias</Titulo>
      <Erro msg={lista.error} />
      {lista.loading ? <Spinner /> : !lista.data?.length ? <div className="card"><Vazio>Nenhuma publicação ainda.</Vazio></div> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{lista.data.map((p) => <CardPublicacao key={p.id} p={p} />)}</div>
      )}
    </div>
  )
}
