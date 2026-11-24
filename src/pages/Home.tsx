import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ok, useAsync } from '../lib/useAsync'
import type { Categoria, PartidaDetalhe, Publicacao, RankingLinha } from '../lib/types'
import { CardPublicacao } from './Noticias'
import { AoVivo, Spinner, Vazio } from '../components/ui'
import { CardTorneio, type TorneioComClube } from './Torneios'

export default function Home() {
  const dados = useAsync(async () => {
    const [t, c, v, n] = await Promise.all([
      supabase.from('torneios').select('*, clubes(id,nome,sigla)').in('status', ['inscricoes', 'em_andamento']).order('data_inicio'),
      supabase.from('categorias').select('*').eq('ativa', true).order('ordem').order('nome').limit(4),
      supabase.from('partidas_detalhe').select('*').eq('em_quadra', true).limit(12),
      supabase.from('publicacoes').select('*').eq('publicado', true)
        .order('destaque', { ascending: false }).order('publicado_em', { ascending: false }).limit(3),
    ])
    const cats = ok(c) as Categoria[]
    const rankings = await Promise.all(cats.map(async (cat) => ({
      cat,
      linhas: (ok(await supabase.rpc('ranking_categoria', { p_categoria: cat.id })) as RankingLinha[]).slice(0, 5),
    })))
    return { torneios: ok(t) as TorneioComClube[], rankings, aoVivo: ok(v) as PartidaDetalhe[], noticias: ok(n) as Publicacao[] }
  }, [])

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl bg-navy-800 text-white px-6 py-10 sm:px-10 sm:py-14">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-ball/90" />
        <div className="absolute -right-24 top-24 h-72 w-[28rem] rounded-full border-[18px] border-wave/60" />
        <div className="relative max-w-xl">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-wave-light">Federação Pernambucana de Tênis</div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white mt-3 leading-tight">Ranking, chaves e resultados oficiais</h1>
          <p className="text-white/80 mt-3">Acompanhe os torneios dos clubes de Pernambuco em tempo real.</p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link to="/ranking" className="btn-ball">Ver ranking</Link>
            <Link to="/torneios" className="btn bg-white/10 text-white hover:bg-white/20">Torneios</Link>
          </div>
        </div>
      </section>

      {dados.loading ? <Spinner /> : dados.data && (
        <>
          {dados.data.aoVivo.length > 0 && (
            <section>
              <h2 className="font-bold text-xl mb-3 flex items-center gap-2">Em quadra agora <AoVivo /></h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dados.data.aoVivo.map((p) => (
                  <Link key={p.id} to={`/torneios/${p.torneio_id}`} className="card p-3 hover:border-red-300">
                    <div className="text-xs text-slate-500">{p.torneio_nome} · {p.categoria_nome}{p.quadra ? ` · ${p.quadra}` : ''}</div>
                    <div className="font-semibold mt-1">{p.jogador1} <span className="text-slate-400">x</span> {p.jogador2}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {dados.data.noticias.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-bold text-xl">Notícias</h2>
                <Link to="/noticias" className="link text-sm">Todas →</Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{dados.data.noticias.map((p) => <CardPublicacao key={p.id} p={p} />)}</div>
            </section>
          )}

          <section>
            <h2 className="font-bold text-xl mb-3">Torneios em andamento</h2>
            {dados.data.torneios.length ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{dados.data.torneios.map((t) => <CardTorneio key={t.id} t={t} />)}</div>
            ) : <div className="card"><Vazio>Nenhum torneio em andamento no momento.</Vazio></div>}
          </section>

          {dados.data.rankings.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-bold text-xl">Top 5 do ranking</h2>
                <Link to="/ranking" className="link text-sm">Ranking completo →</Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {dados.data.rankings.map(({ cat, linhas }) => (
                  <div key={cat.id} className="card">
                    <Link to={`/ranking?cat=${cat.id}`} className="block px-4 py-3 border-b border-slate-100 font-bold hover:underline">{cat.nome}</Link>
                    {linhas.length ? (
                      <ol className="divide-y divide-slate-50">
                        {linhas.map((l) => (
                          <li key={l.atleta_id} className="flex items-center gap-2 px-4 py-2 text-sm">
                            <span className={`w-6 text-center font-bold ${l.posicao <= 3 ? 'text-ball-dark' : 'text-slate-400'}`}>{l.posicao}</span>
                            <Link to={`/atletas/${l.atleta_id}`} className="flex-1 truncate hover:underline">{l.nome}</Link>
                            <span className="tabular-nums font-semibold">{l.pontos}</span>
                          </li>
                        ))}
                      </ol>
                    ) : <Vazio>Sem pontuação.</Vazio>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
