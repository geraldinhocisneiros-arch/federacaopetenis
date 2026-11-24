import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ok, useAsync } from '../lib/useAsync'
import { formatarData, formatarPlacar, nomeRodada, rotuloFase } from '../lib/tenis'
import type { Atleta, Clube, PartidaDetalhe } from '../lib/types'
import { Avatar, Erro, Spinner, Variacao, Vazio } from '../components/ui'
import GraficoPosicao, { type PontoHist } from '../components/GraficoPosicao'

interface RankAtleta { categoria_id: string; categoria_nome: string; posicao: number; pontos: number; posicao_anterior: number | null; total: number }
interface Hist { posicao: number; pontos: number; ranking_publicacoes: { data: string; criado_em: string; categoria_id: string; descricao: string | null } }
interface Lanc { torneio_categoria_id: string | null; pontos: number; fase: string | null }
interface InscTorneio {
  id: string
  torneio_categoria_id: string
  torneio_categorias: {
    tamanho_chave: number | null
    categorias: { nome: string }
    torneios: { id: string; nome: string; data_inicio: string | null; status: string; clubes: { nome: string } | null }
  }
}

export default function AtletaPagina() {
  const { id } = useParams()
  const dados = useAsync(async () => {
    const atleta = ok(await supabase.from('atletas').select('*, clubes(*)').eq('id', id!).single()) as Atleta & { clubes: Clube | null }
    const [rank, hist, insc, lanc, fil] = await Promise.all([
      supabase.rpc('ranking_do_atleta', { p_atleta: id }),
      supabase.from('ranking_historico').select('posicao,pontos,ranking_publicacoes(data,criado_em,categoria_id,descricao)').eq('atleta_id', id!),
      supabase.from('inscricoes')
        .select('id, torneio_categoria_id, torneio_categorias(tamanho_chave, categorias(nome), torneios(id,nome,data_inicio,status,clubes(nome)))')
        .or(`atleta_id.eq.${id},parceiro_id.eq.${id}`),
      supabase.from('ranking_lancamentos').select('torneio_categoria_id,pontos,fase').eq('atleta_id', id!).eq('tipo', 'torneio'),
      supabase.from('filiacoes').select('ano,numero,status').eq('atleta_id', id!).in('status', ['ativa', 'isenta'])
        .eq('ano', new Date().getFullYear()).maybeSingle(),
    ])
    const inscricoes = (ok(insc) as unknown as InscTorneio[]).filter((i) => i.torneio_categorias.torneios.status !== 'rascunho')
    const ids = inscricoes.map((i) => i.id)
    const partidas = ids.length
      ? (ok(await supabase.from('partidas_detalhe').select('*')
          .or(`inscricao1_id.in.(${ids.join(',')}),inscricao2_id.in.(${ids.join(',')})`)
          .order('rodada')) as PartidaDetalhe[])
      : []
    return {
      atleta,
      ranking: ok(rank) as RankAtleta[],
      historico: ok(hist) as unknown as Hist[],
      inscricoes: inscricoes.sort((a, b) =>
        (b.torneio_categorias.torneios.data_inicio ?? '').localeCompare(a.torneio_categorias.torneios.data_inicio ?? '')),
      partidas,
      lancamentos: ok(lanc) as Lanc[],
      filiacao: fil.data as { ano: number; numero: string | null } | null,
    }
  }, [id])

  if (dados.loading) return <Spinner />
  if (dados.error || !dados.data) return <Erro msg={dados.error ?? 'Atleta não encontrado.'} />
  const { atleta, ranking, historico, inscricoes, partidas, lancamentos, filiacao } = dados.data
  const idsInsc = new Set(inscricoes.map((i) => i.id))

  const jogos = partidas.filter((p) => p.vencedor_id && p.tipo_resultado !== 'bye')
  const vitorias = jogos.filter((p) => idsInsc.has(p.vencedor_id!)).length
  const titulos = lancamentos.filter((l) => l.fase === 'campeao').length

  const histPorCat = (catId: string): PontoHist[] =>
    historico
      .filter((h) => h.ranking_publicacoes.categoria_id === catId)
      .sort((a, b) => a.ranking_publicacoes.criado_em.localeCompare(b.ranking_publicacoes.criado_em))
      .map((h) => ({ data: h.ranking_publicacoes.data, posicao: h.posicao, pontos: h.pontos, descricao: h.ranking_publicacoes.descricao }))

  return (
    <div className="space-y-6">
      <div className="card p-5 flex flex-wrap items-center gap-4">
        <Avatar nome={atleta.nome} url={atleta.foto_url} tamanho={72} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold">{atleta.nome}</h1>
          {filiacao && (
            <span className="badge bg-emerald-100 text-emerald-800 mt-1">
              ✓ Filiado FPET {filiacao.ano}{filiacao.numero ? ` · nº ${filiacao.numero}` : ''}
            </span>
          )}
          <div className="text-sm text-slate-500">
            {atleta.clubes ? <Link className="link" to={`/clubes/${atleta.clube_id}`}>{atleta.clubes.nome}</Link> : 'Sem clube'}
            {atleta.cidade ? ` · ${atleta.cidade}` : ''}
          </div>
        </div>
        <div className="flex gap-6 text-center">
          <Stat valor={titulos} rotulo="Títulos" />
          <Stat valor={`${vitorias}-${jogos.length - vitorias}`} rotulo="V-D" />
          <Stat valor={inscricoes.length} rotulo="Torneios" />
        </div>
      </div>

      <section>
        <h2 className="font-bold text-lg mb-3">Ranking</h2>
        {!ranking.length ? <div className="card"><Vazio>Ainda sem pontuação no ranking.</Vazio></div> : (
          <div className="grid md:grid-cols-2 gap-4">
            {ranking.map((r) => (
              <div key={r.categoria_id} className="card p-4">
                <div className="flex items-center justify-between gap-2">
                  <Link to={`/ranking?cat=${r.categoria_id}`} className="font-semibold hover:underline">{r.categoria_nome}</Link>
                  <Variacao atual={r.posicao} anterior={r.posicao_anterior} />
                </div>
                <div className="flex items-baseline gap-2 mt-1 mb-3">
                  <span className="text-3xl font-extrabold text-navy-900">{r.posicao}º</span>
                  <span className="text-sm text-slate-500">de {r.total} · {r.pontos} pontos</span>
                </div>
                <GraficoPosicao pontos={histPorCat(r.categoria_id)} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-bold text-lg mb-3">Resultados em torneios</h2>
        {!inscricoes.length ? <div className="card"><Vazio>Nenhuma participação registrada.</Vazio></div> : (
          <div className="space-y-3">
            {inscricoes.map((i) => {
              const tc = i.torneio_categorias
              const lanc = lancamentos.find((l) => l.torneio_categoria_id === i.torneio_categoria_id)
              const meus = partidas.filter((p) => p.inscricao1_id === i.id || p.inscricao2_id === i.id)
              const total = tc.tamanho_chave ? Math.log2(tc.tamanho_chave) : 1
              return (
                <div key={i.id} className="card">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-100">
                    <div>
                      <Link to={`/torneios/${tc.torneios.id}`} className="font-bold hover:underline">{tc.torneios.nome}</Link>
                      <div className="text-xs text-slate-500">
                        {tc.categorias.nome} · {tc.torneios.clubes?.nome} · {formatarData(tc.torneios.data_inicio)}
                      </div>
                    </div>
                    {lanc ? (
                      <div className="text-right">
                        <div className={`badge ${lanc.fase === 'campeao' ? 'bg-ball text-navy-900' : 'bg-slate-100 text-slate-700'}`}>{rotuloFase(lanc.fase)}</div>
                        <div className="text-xs text-slate-500 mt-1">+{lanc.pontos} pts</div>
                      </div>
                    ) : <span className="text-xs text-slate-400">{tc.torneios.status === 'homologado' ? '' : 'Aguardando homologação'}</span>}
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {meus.filter((p) => p.tipo_resultado !== 'bye').map((p) => {
                      const souUm = p.inscricao1_id === i.id
                      const adv = souUm ? p.jogador2 : p.jogador1
                      const advId = souUm ? p.atleta2_id : p.atleta1_id
                      const venci = p.vencedor_id === i.id
                      return (
                        <li key={p.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                          <span className="w-32 shrink-0 text-xs text-slate-500">{nomeRodada(p.rodada, total)}</span>
                          <span className="flex-1 min-w-0 truncate">
                            vs {adv ? (advId && !(souUm ? p.parceiro2_id : p.parceiro1_id)
                              ? <Link to={`/atletas/${advId}`} className="hover:underline">{adv}</Link> : adv) : 'A definir'}
                          </span>
                          {p.vencedor_id ? (
                            <>
                              <span className="tabular-nums text-slate-600">{p.tipo_resultado === 'wo' ? 'W.O.' : formatarPlacar(p.placar, !souUm)}</span>
                              <span className={`badge ${venci ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>{venci ? 'V' : 'D'}</span>
                            </>
                          ) : <span className="text-xs text-slate-400">{p.horario ?? 'A jogar'}</span>}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ valor, rotulo }: { valor: number | string; rotulo: string }) {
  return (
    <div>
      <div className="text-2xl font-extrabold text-navy-900">{valor}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{rotulo}</div>
    </div>
  )
}
