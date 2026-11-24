import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ok, useAsync } from '../lib/useAsync'
import { TIPOS_PUB, dataPub } from '../lib/publicacoes'
import type { Publicacao } from '../lib/types'
import { Erro, Spinner } from '../components/ui'

export default function Noticia() {
  const { id } = useParams()
  const dados = useAsync(async () => ok(await supabase.from('publicacoes').select('*').eq('id', id!).single()) as Publicacao, [id])
  if (dados.loading) return <Spinner />
  if (dados.error || !dados.data) return <Erro msg="Publicação não encontrada." />
  const p = dados.data
  return (
    <article className="max-w-3xl mx-auto">
      <Link to="/noticias" className="link text-sm">← Notícias</Link>
      <div className="text-xs font-semibold uppercase tracking-wide text-wave mt-4">{TIPOS_PUB[p.tipo]} · {dataPub(p.publicado_em)}</div>
      <h1 className="text-3xl font-extrabold mt-1 leading-tight">{p.titulo}</h1>
      {p.resumo && <p className="text-lg text-slate-600 mt-2">{p.resumo}</p>}
      {p.imagem_url && <img src={p.imagem_url} alt="" className="w-full rounded-xl mt-5" />}
      <div className="mt-5 space-y-4 leading-relaxed text-slate-800">
        {(p.conteudo ?? '').split(/\n\s*\n/).filter(Boolean).map((par, i) => <p key={i} className="whitespace-pre-line">{par}</p>)}
      </div>
      {p.anexo_url && <a href={p.anexo_url} target="_blank" rel="noreferrer" className="btn-primary mt-6">Abrir anexo ↗</a>}
    </article>
  )
}
