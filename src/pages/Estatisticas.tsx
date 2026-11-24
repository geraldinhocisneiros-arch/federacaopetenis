import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ok, useAsync } from '../lib/useAsync'
import type { Categoria, LiderEstatistica } from '../lib/types'
import { Campo, Erro, Spinner, Titulo, Vazio } from '../components/ui'

type Metrica = 'vitorias' | 'aproveitamento' | 'titulos' | 'jogos' | 'games_pro' | 'saldo_games' | 'tiebreaks_vencidos' | 'torneios'

const METRICAS: Record<Metrica, { rotulo: string; valor: (l: LiderEstatistica) => number; fmt?: (n: number) => string }> = {
  vitorias: { rotulo: 'Vitórias', valor: (l) => l.vitorias },
  aproveitamento: { rotulo: 'Aproveitamento (mín. 5 jogos)', valor: (l) => (l.jogos >= 5 ? Number(l.aproveitamento ?? 0) : -1), fmt: (n) => `${n}%` },
  titulos: { rotulo: 'Títulos', valor: (l) => l.titulos },
  jogos: { rotulo: 'Jogos disputados', valor: (l) => l.jogos },
  games_pro: { rotulo: 'Games vencidos', valor: (l) => l.games_pro },
  saldo_games: { rotulo: 'Saldo de games', valor: (l) => l.games_pro - l.games_contra, fmt: (n) => (n > 0 ? `+${n}` : String(n)) },
  tiebreaks_vencidos: { rotulo: 'Tiebreaks vencidos', valor: (l) => l.tiebreaks_vencidos },
  torneios: { rotulo: 'Torneios disputados', valor: (l) => l.torneios },
}

export default function Estatisticas() {
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState<number | ''>(anoAtual)
  const [categoria, setCategoria] = useState('')
  const [modalidade, setModalidade] = useState('')
  const [metrica, setMetrica] = useState<Metrica>('vitorias')

  const cats = useAsync(async () => ok(await supabase.from('categorias').select('*').eq('ativa', true).order('ordem').order('nome')) as Categoria[], [])
  const dados = useAsync(async () => ok(await supabase.rpc('estatisticas_lideres', {
    p_ano: ano || null, p_categoria: categoria || null, p_modalidade: modalidade || null,
  })) as LiderEstatistica[], [ano, categoria, modalidade])

  const lista = dados.data ?? []
  const m = METRICAS[metrica]
  const ordenada = [...lista].filter((l) => m.valor(l) >= 0).sort((a, b) => m.valor(b) - m.valor(a) || b.vitorias - a.vitorias).slice(0, 50)

  const destaques: [string, LiderEstatistica | undefined, string][] = [
    ['Mais vitórias', [...lista].sort((a, b) => b.vitorias - a.vitorias)[0], 'vitorias'],
    ['Mais títulos', [...lista].filter((l) => l.titulos > 0).sort((a, b) => b.titulos - a.titulos)[0], 'titulos'],
    ['Melhor aproveitamento', [...lista].filter((l) => l.jogos >= 5).sort((a, b) => Number(b.aproveitamento) - Number(a.aproveitamento))[0], 'aproveitamento'],
    ['Mais games vencidos', [...lista].sort((a, b) => b.games_pro - a.games_pro)[0], 'games_pro'],
  ]

  return (
    <div>
      <Titulo sub="Números dos torneios oficiais. Jogos em simples e duplas contam para cada atleta.">Estatísticas</Titulo>

      <div className="card p-4 flex flex-wrap gap-3 items-end mb-6">
        <Campo label="Ano">
          <select className="input" value={ano} onChange={(e) => setAno(e.target.value ? Number(e.target.value) : '')}>
            {[anoAtual, anoAtual - 1, anoAtual - 2, anoAtual - 3].map((a) => <option key={a} value={a}>{a}</option>)}
            <option value="">Todos os anos</option>
          </select>
        </Campo>
        <Campo label="Categoria">
          <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas</option>
            {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Modalidade">
          <select className="input" value={modalidade} onChange={(e) => setModalidade(e.target.value)}>
            <option value="">Simples e duplas</option><option value="simples">Simples</option><option value="duplas">Duplas</option>
          </select>
        </Campo>
      </div>

      <Erro msg={dados.error} />
      {dados.loading ? <Spinner /> : !lista.length ? <div className="card"><Vazio>Sem partidas no período.</Vazio></div> : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {destaques.map(([rot, l, k]) => (
              <div key={rot} className="card p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-wave">{rot}</div>
                {l ? <>
                  <Link to={`/atletas/${l.atleta_id}`} className="block font-bold mt-1 hover:underline truncate">{l.nome}</Link>
                  <div className="text-2xl font-extrabold text-navy-900">{METRICAS[k as Metrica].fmt?.(METRICAS[k as Metrica].valor(l)) ?? METRICAS[k as Metrica].valor(l)}</div>
                </> : <div className="text-sm text-slate-400 mt-1">—</div>}
              </div>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
              <h2 className="font-bold">Ranking por</h2>
              <select className="input w-auto" value={metrica} onChange={(e) => setMetrica(e.target.value as Metrica)}>
                {Object.entries(METRICAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr>
                  <th className="w-10">#</th><th>Atleta</th><th className="text-right">{m.rotulo.replace(/ \(.*\)/, '')}</th>
                  <th className="text-right hidden sm:table-cell">J</th><th className="text-right hidden sm:table-cell">V-D</th>
                  <th className="text-right hidden md:table-cell">Sets</th><th className="text-right hidden md:table-cell">Games</th>
                  <th className="text-right hidden md:table-cell">Títulos</th>
                </tr></thead>
                <tbody>
                  {ordenada.map((l, i) => (
                    <tr key={l.atleta_id}>
                      <td className={`font-bold ${i < 3 ? 'text-ball-dark' : 'text-slate-400'}`}>{i + 1}</td>
                      <td><Link to={`/atletas/${l.atleta_id}`} className="font-medium hover:underline">{l.nome}</Link>{l.clube_nome && <span className="text-xs text-slate-400"> · {l.clube_nome}</span>}</td>
                      <td className="text-right tabular-nums font-bold">{m.fmt?.(m.valor(l)) ?? m.valor(l)}</td>
                      <td className="text-right tabular-nums hidden sm:table-cell">{l.jogos}</td>
                      <td className="text-right tabular-nums hidden sm:table-cell">{l.vitorias}-{l.derrotas}</td>
                      <td className="text-right tabular-nums hidden md:table-cell">{l.sets_pro}-{l.sets_contra}</td>
                      <td className="text-right tabular-nums hidden md:table-cell">{l.games_pro}-{l.games_contra}</td>
                      <td className="text-right tabular-nums hidden md:table-cell">{l.titulos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
