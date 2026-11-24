import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ok, useAsync } from '../lib/useAsync'
import { formatarData, formatarPlacar, nomeRodada } from '../lib/tenis'
import type { PartidaAtleta } from '../lib/types'
import { Campo, Erro, Spinner, Vazio } from './ui'

interface Totais {
  jogos: number; v: number; d: number; setsP: number; setsC: number; gamesP: number; gamesC: number
  tb: number; tbV: number; woV: number; woD: number; titulos: number; finais: number; torneios: number
}

function somar(ps: PartidaAtleta[]): Totais {
  const t: Totais = { jogos: 0, v: 0, d: 0, setsP: 0, setsC: 0, gamesP: 0, gamesC: 0, tb: 0, tbV: 0, woV: 0, woD: 0, titulos: 0, finais: 0, torneios: 0 }
  const tcs = new Set<string>()
  for (const p of ps) {
    t.jogos++
    if (p.venceu) t.v++; else t.d++
    t.setsP += p.sets_pro; t.setsC += p.sets_contra; t.gamesP += p.games_pro; t.gamesC += p.games_contra
    t.tb += p.tiebreaks; t.tbV += p.tiebreaks_vencidos
    if (p.tipo_resultado === 'wo') { if (p.venceu) t.woV++; else t.woD++ }
    if (p.rodada === p.total_rodadas) { t.finais++; if (p.venceu) t.titulos++ }
    tcs.add(p.torneio_categoria_id)
  }
  t.torneios = tcs.size
  return t
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '—')
const saldo = (n: number) => (n > 0 ? `+${n}` : String(n))

/** Sequência atual (V ou D) e maior sequência de vitórias, em ordem cronológica */
function sequencias(ps: PartidaAtleta[]) {
  const ord = [...ps].sort((a, b) => (a.data ?? '').localeCompare(b.data ?? '') || a.rodada - b.rodada)
  let maior = 0, corrente = 0
  for (const p of ord) { corrente = p.venceu ? corrente + 1 : 0; maior = Math.max(maior, corrente) }
  let atual = 0
  const ult = ord[ord.length - 1]
  for (let i = ord.length - 1; i >= 0 && ult && ord[i].venceu === ult.venceu; i--) atual++
  return { maior, atual: ult ? `${atual}${ult.venceu ? 'V' : 'D'}` : '—' }
}

export default function EstatisticasAtleta({ atletaId }: { atletaId: string }) {
  const dados = useAsync(async () => ok(await supabase.from('partidas_atleta').select('*').eq('atleta_id', atletaId)
    .order('data', { ascending: false }).order('rodada', { ascending: false })) as PartidaAtleta[], [atletaId])
  const [ano, setAno] = useState<number | ''>('')
  const [tc, setTc] = useState('')
  const [categoria, setCategoria] = useState('')
  const [modalidade, setModalidade] = useState('')

  const todas = dados.data ?? []
  const anos = useMemo(() => [...new Set(todas.map((p) => p.ano).filter(Boolean))].sort((a, b) => b! - a!) as number[], [todas])
  const categorias = useMemo(() => [...new Map(todas.map((p) => [p.categoria_id, p.categoria_nome])).entries()], [todas])
  const filtradasSemTorneio = todas.filter((p) => (!ano || p.ano === ano) && (!categoria || p.categoria_id === categoria) && (!modalidade || p.modalidade === modalidade))
  const torneios = [...new Map(filtradasSemTorneio.map((p) => [p.torneio_categoria_id, p])).values()]
  const ps = filtradasSemTorneio.filter((p) => !tc || p.torneio_categoria_id === tc)
  const t = somar(ps)
  const seq = sequencias(ps)

  if (dados.loading) return <Spinner />
  if (dados.error) return <Erro msg={dados.error} />
  if (!todas.length) return <div className="card"><Vazio>Ainda não há partidas disputadas para gerar estatísticas.</Vazio></div>

  // Agrupamentos
  const porAno = anos.map((a) => ({ ano: a, t: somar(filtradasSemTorneio.filter((p) => p.ano === a)) })).filter((x) => x.t.jogos)
  const porTorneio = torneios.map((x) => {
    const jogos = ps.filter((p) => p.torneio_categoria_id === x.torneio_categoria_id)
    const max = Math.max(...jogos.map((p) => p.rodada))
    const ultimo = jogos.find((p) => p.rodada === max)
    const fase = ultimo?.venceu && max === x.total_rodadas ? 'Campeão' : ultimo?.venceu ? `Venceu ${nomeRodada(max, x.total_rodadas).toLowerCase()}` : nomeRodada(max, x.total_rodadas)
    return { x, t: somar(jogos), fase }
  }).filter((r) => r.t.jogos)
  const adversarios = [...ps.reduce((m, p) => {
    const k = p.adversario
    const cur = m.get(k) ?? { nome: k, id: p.adversario_parceiro_id ? null : p.adversario_id, ps: [] as PartidaAtleta[] }
    cur.ps.push(p); m.set(k, cur); return m
  }, new Map<string, { nome: string; id: string | null; ps: PartidaAtleta[] }>()).values()]
    .map((a) => ({ ...a, t: somar(a.ps) })).sort((a, b) => b.t.jogos - a.t.jogos || b.t.v - a.t.v)

  return (
    <div className="space-y-6">
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <Campo label="Ano">
          <select className="input" value={ano} onChange={(e) => { setAno(e.target.value ? Number(e.target.value) : ''); setTc('') }}>
            <option value="">Todos</option>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Campo>
        <Campo label="Categoria">
          <select className="input" value={categoria} onChange={(e) => { setCategoria(e.target.value); setTc('') }}>
            <option value="">Todas</option>
            {categorias.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </Campo>
        <Campo label="Modalidade">
          <select className="input" value={modalidade} onChange={(e) => { setModalidade(e.target.value); setTc('') }}>
            <option value="">Simples e duplas</option><option value="simples">Simples</option><option value="duplas">Duplas</option>
          </select>
        </Campo>
        <div className="flex-1 min-w-48">
          <Campo label="Torneio">
            <select className="input" value={tc} onChange={(e) => setTc(e.target.value)}>
              <option value="">Todos os torneios</option>
              {torneios.map((x) => <option key={x.torneio_categoria_id} value={x.torneio_categoria_id}>{x.torneio_nome} · {x.categoria_nome}</option>)}
            </select>
          </Campo>
        </div>
        {(ano || tc || categoria || modalidade) && (
          <button className="btn-ghost btn-sm" onClick={() => { setAno(''); setTc(''); setCategoria(''); setModalidade('') }}>Limpar filtros</button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi rotulo="Jogos" valor={t.jogos} sub={`${t.torneios} torneio(s)`} />
        <Kpi rotulo="Vitórias" valor={t.v} cls="text-emerald-700" sub={`${t.d} derrota(s)`} />
        <Kpi rotulo="Aproveitamento" valor={pct(t.v, t.jogos)} />
        <Kpi rotulo="Títulos" valor={t.titulos} cls="text-ball-dark" sub={`${t.finais} final(is)`} />
        <Kpi rotulo="Sequência atual" valor={seq.atual} sub={`Maior: ${seq.maior} vitória(s)`} />
        <Kpi rotulo="W.O." valor={`${t.woV} / ${t.woD}`} sub="a favor / contra" />
        <Kpi rotulo="Games vencidos" valor={t.gamesP} cls="text-emerald-700" sub={`${pct(t.gamesP, t.gamesP + t.gamesC)} dos games`} />
        <Kpi rotulo="Games perdidos" valor={t.gamesC} cls="text-red-700" sub={`Saldo ${saldo(t.gamesP - t.gamesC)}`} />
        <Kpi rotulo="Sets vencidos" valor={t.setsP} sub={`${t.setsC} perdidos`} />
        <Kpi rotulo="Saldo de sets" valor={saldo(t.setsP - t.setsC)} sub={pct(t.setsP, t.setsP + t.setsC)} />
        <Kpi rotulo="Tiebreaks" valor={`${t.tbV} / ${t.tb}`} sub={`${pct(t.tbV, t.tb)} vencidos`} />
        <Kpi rotulo="Games por jogo" valor={t.jogos ? (t.gamesP / Math.max(1, t.jogos - t.woV - t.woD)).toFixed(1) : '—'} sub="média vencidos" />
      </div>

      {!ano && !tc && porAno.length > 1 && (
        <Bloco titulo="Por ano">
          <table className="table">
            <thead><tr><th>Ano</th><th className="text-right">Torneios</th><th className="text-right">J</th><th className="text-right">V</th><th className="text-right">D</th><th className="text-right">%</th><th className="text-right">Títulos</th><th className="text-right hidden sm:table-cell">Games +/−</th></tr></thead>
            <tbody>
              {porAno.map(({ ano: a, t: x }) => (
                <tr key={a} className="cursor-pointer hover:bg-slate-50" onClick={() => setAno(a)}>
                  <td className="font-semibold">{a}</td>
                  <td className="text-right tabular-nums">{x.torneios}</td>
                  <td className="text-right tabular-nums">{x.jogos}</td>
                  <td className="text-right tabular-nums text-emerald-700">{x.v}</td>
                  <td className="text-right tabular-nums text-red-700">{x.d}</td>
                  <td className="text-right tabular-nums">{pct(x.v, x.jogos)}</td>
                  <td className="text-right tabular-nums">{x.titulos}</td>
                  <td className="text-right tabular-nums hidden sm:table-cell">{x.gamesP} / {x.gamesC}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Bloco>
      )}

      {!tc && (
        <Bloco titulo="Resultado por torneio">
          <table className="table">
            <thead><tr><th>Torneio</th><th>Resultado</th><th className="text-right">V-D</th><th className="text-right hidden sm:table-cell">Sets</th><th className="text-right">Games</th><th className="text-right hidden sm:table-cell">Saldo</th></tr></thead>
            <tbody>
              {porTorneio.map(({ x, t: s, fase }) => (
                <tr key={x.torneio_categoria_id} className="cursor-pointer hover:bg-slate-50" onClick={() => setTc(x.torneio_categoria_id)}>
                  <td><div className="font-medium">{x.torneio_nome}</div><div className="text-xs text-slate-500">{x.categoria_nome} · {formatarData(x.data)}</div></td>
                  <td><span className={`badge ${fase === 'Campeão' ? 'bg-ball text-navy-900' : 'bg-slate-100 text-slate-700'}`}>{fase}</span></td>
                  <td className="text-right tabular-nums">{s.v}-{s.d}</td>
                  <td className="text-right tabular-nums hidden sm:table-cell">{s.setsP}-{s.setsC}</td>
                  <td className="text-right tabular-nums">{s.gamesP}-{s.gamesC}</td>
                  <td className={`text-right tabular-nums hidden sm:table-cell ${s.gamesP >= s.gamesC ? 'text-emerald-700' : 'text-red-700'}`}>{saldo(s.gamesP - s.gamesC)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Bloco>
      )}

      <Bloco titulo="Confronto direto">
        <table className="table">
          <thead><tr><th>Adversário</th><th className="text-right">J</th><th className="text-right">V</th><th className="text-right">D</th><th className="text-right">Games</th></tr></thead>
          <tbody>
            {adversarios.slice(0, 30).map((a) => (
              <tr key={a.nome}>
                <td>{a.id ? <Link to={`/atletas/${a.id}`} className="hover:underline">{a.nome}</Link> : a.nome}</td>
                <td className="text-right tabular-nums">{a.t.jogos}</td>
                <td className="text-right tabular-nums text-emerald-700">{a.t.v}</td>
                <td className="text-right tabular-nums text-red-700">{a.t.d}</td>
                <td className="text-right tabular-nums">{a.t.gamesP}-{a.t.gamesC}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>

      <Bloco titulo={`Partidas (${ps.length})`}>
        <table className="table">
          <thead><tr><th className="hidden sm:table-cell">Data</th><th>Torneio / fase</th><th>Adversário</th><th>Placar</th><th></th></tr></thead>
          <tbody>
            {ps.map((p) => (
              <tr key={p.partida_id}>
                <td className="hidden sm:table-cell text-slate-500 whitespace-nowrap">{formatarData(p.data, { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                <td><div className="font-medium">{p.torneio_nome}</div><div className="text-xs text-slate-500">{p.categoria_nome} · {nomeRodada(p.rodada, p.total_rodadas)}</div></td>
                <td>{p.adversario}</td>
                <td className="tabular-nums whitespace-nowrap">{p.tipo_resultado === 'wo' ? 'W.O.' : formatarPlacar(p.placar, p.lado === 2)}{p.tipo_resultado === 'desistencia' ? ' (desist.)' : ''}</td>
                <td><span className={`badge ${p.venceu ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>{p.venceu ? 'V' : 'D'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>
      <p className="text-xs text-slate-500">Super tiebreak conta como 1 game para quem venceu. W.O. entra em vitórias/derrotas, mas não soma sets nem games.</p>
    </div>
  )
}

function Kpi({ rotulo, valor, sub, cls }: { rotulo: string; valor: React.ReactNode; sub?: string; cls?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className={`text-2xl font-extrabold tabular-nums ${cls ?? 'text-navy-900'}`}>{valor}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <h3 className="px-4 py-3 border-b border-slate-100 font-bold">{titulo}</h3>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}
