import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ok, useAsync } from '../lib/useAsync'
import { GENERO } from '../lib/tenis'
import type { Categoria, RankingLinha } from '../lib/types'
import { Erro, Spinner, Titulo, Variacao, Vazio } from '../components/ui'

export function useCategorias() {
  return useAsync(async () =>
    ok(await supabase.from('categorias').select('*').eq('ativa', true).order('ordem').order('nome')) as Categoria[], [])
}

export default function Ranking() {
  const [params, setParams] = useSearchParams()
  const [busca, setBusca] = useState('')
  const cats = useCategorias()
  const catId = params.get('cat') ?? cats.data?.[0]?.id ?? null
  const cat = cats.data?.find((c) => c.id === catId)

  const cfg = useAsync(async () => ok(await supabase.from('configuracoes').select('*').eq('id', 1).single()) as {
    janela_semanas: number | null; melhores_resultados: number | null; criterio_desempate: string | null
  }, [])

  const ranking = useAsync(async () => {
    if (!catId) return [] as RankingLinha[]
    return ok(await supabase.rpc('ranking_categoria', { p_categoria: catId })) as RankingLinha[]
  }, [catId])

  const linhas = useMemo(
    () => (ranking.data ?? []).filter((l) => l.nome.toLowerCase().includes(busca.toLowerCase())),
    [ranking.data, busca],
  )

  return (
    <div>
      <Titulo
        sub={
          cfg.data && (
            <>
              {cfg.data.janela_semanas ? `Pontos válidos por ${cfg.data.janela_semanas} semanas` : 'Pontos acumulados sem expiração'}
              {cfg.data.melhores_resultados ? ` · soma dos ${cfg.data.melhores_resultados} melhores resultados` : ''}
            </>
          )
        }
      >
        Ranking FPET
      </Titulo>

      {cats.loading ? <Spinner /> : !cats.data?.length ? (
        <Vazio>Nenhuma categoria cadastrada ainda.</Vazio>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {cats.data.map((c) => (
              <button
                key={c.id}
                onClick={() => setParams({ cat: c.id })}
                className={`tab border ${c.id === catId ? 'tab-active border-navy-800' : 'border-slate-200 bg-white'}`}
              >
                {c.nome}
              </button>
            ))}
          </div>

          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-lg">{cat?.nome}</h2>
                {cat && <p className="text-xs text-slate-500">{GENERO[cat.genero]} · {cat.modalidade === 'duplas' ? 'Duplas' : 'Simples'}</p>}
              </div>
              <input className="input sm:w-64" placeholder="Buscar atleta…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Erro msg={ranking.error} />
            {ranking.loading ? <Spinner /> : !linhas.length ? <Vazio>Sem atletas pontuando nesta categoria.</Vazio> : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-14 text-center">#</th>
                      <th className="w-14"></th>
                      <th>Atleta</th>
                      <th className="hidden sm:table-cell">Clube</th>
                      <th className="text-right">Pontos</th>
                      <th className="text-right hidden sm:table-cell">Torneios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => (
                      <tr key={l.atleta_id} className="hover:bg-slate-50">
                        <td className="text-center">
                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-bold text-xs ${
                            l.posicao <= 3 ? 'bg-ball text-navy-900' : 'bg-slate-100 text-slate-600'}`}>
                            {l.posicao}
                          </span>
                        </td>
                        <td><Variacao atual={l.posicao} anterior={l.posicao_anterior} /></td>
                        <td>
                          <Link to={`/atletas/${l.atleta_id}`} className="font-semibold text-navy-900 hover:underline">{l.nome}</Link>
                          <div className="sm:hidden text-xs text-slate-500">{l.clube_nome}</div>
                        </td>
                        <td className="hidden sm:table-cell text-slate-600">{l.clube_nome ?? '—'}</td>
                        <td className="text-right font-bold tabular-nums">{l.pontos}</td>
                        <td className="text-right hidden sm:table-cell text-slate-500">{l.torneios}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {cfg.data?.criterio_desempate && (
            <p className="text-xs text-slate-500 mt-3">Critério de desempate: {cfg.data.criterio_desempate}</p>
          )}
        </>
      )}
    </div>
  )
}
