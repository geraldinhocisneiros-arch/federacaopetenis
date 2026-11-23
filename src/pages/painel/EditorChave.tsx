import { useEffect, useState } from 'react'
import { supabase, msgErro } from '../../lib/supabase'
import type { DadosTorneio } from '../../lib/torneio'
import { formatarPlacar, nomeRodada, vencedorPeloPlacar } from '../../lib/tenis'
import type { InscricaoDetalhe, Partida, Placar } from '../../lib/types'
import { Aviso, Campo, Erro, Modal, Vazio } from '../../components/ui'
import Chave from '../../components/Chave'

export default function EditorChave({ d, onMudou }: { d: DadosTorneio; onMudou: () => void }) {
  const [sel, setSel] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [partidaSel, setPartidaSel] = useState<Partida | null>(null)
  const [visao, setVisao] = useState<'chave' | 'lista'>('chave')
  const tc = d.categorias.find((c) => c.id === (sel ?? d.categorias[0]?.id))
  if (!tc) return <div className="card"><Vazio>Cadastre as categorias do torneio primeiro.</Vazio></div>

  const partidas = d.partidas.filter((p) => p.torneio_categoria_id === tc.id)
  const inscritos = d.inscricoes.filter((i) => i.torneio_categoria_id === tc.id)
  const temResultado = partidas.some((p) => p.vencedor_id && p.tipo_resultado !== 'bye')
  const fechado = d.torneio.status === 'encerrado' || d.torneio.status === 'homologado'
  const total = Math.max(0, ...partidas.map((p) => p.rodada))

  async function rpc(fn: string, msg?: string) {
    if (msg && !confirm(msg)) return
    setErro(null); setOcupado(true)
    const { error } = await supabase.rpc(fn, { p_tc: tc!.id })
    setOcupado(false)
    if (error) setErro(msgErro(error)); else onMudou()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {d.categorias.map((c) => (
          <button key={c.id} onClick={() => setSel(c.id)}
            className={`tab border ${c.id === tc.id ? 'tab-active border-navy-800' : 'border-slate-200 bg-white'}`}>
            {c.categorias.nome}
          </button>
        ))}
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0 text-sm">
          <b>{inscritos.length}</b> inscritos
          {tc.tamanho_chave ? <> · chave de <b>{tc.tamanho_chave}</b> · {inscritos.filter((i) => i.cabeca).length} cabeças · {tc.tamanho_chave - inscritos.length} bye(s)</> : ''}
        </div>
        {!fechado && !tc.chave_gerada_em && (
          <button className="btn-ball" disabled={ocupado || inscritos.length < 2} onClick={() => rpc('gerar_chave')}>Sortear chave</button>
        )}
        {!fechado && tc.chave_gerada_em && !temResultado && (
          <>
            <button className="btn-ghost btn-sm" disabled={ocupado} onClick={() => rpc('gerar_chave', 'Sortear novamente? A chave atual será descartada.')}>Sortear novamente</button>
            <button className="btn-danger btn-sm" disabled={ocupado} onClick={() => rpc('apagar_chave', 'Apagar a chave para alterar inscrições?')}>Apagar chave</button>
          </>
        )}
      </div>
      {!tc.chave_gerada_em && (
        <Aviso>
          O sorteio coloca os cabeças pelo <b>ranking atualizado</b> da categoria (1 no topo, 2 no pé, 3-4 sorteados entre os quartos…),
          dá os byes aos cabeças e sorteia os demais. Confira as inscrições antes.
        </Aviso>
      )}
      <Erro msg={erro} />

      {tc.chave_gerada_em && (
        <>
          <div className="flex gap-2">
            <button className={`tab ${visao === 'chave' ? 'tab-active' : ''}`} onClick={() => setVisao('chave')}>Chave</button>
            <button className={`tab ${visao === 'lista' ? 'tab-active' : ''}`} onClick={() => setVisao('lista')}>Lista de jogos</button>
          </div>
          <p className="text-xs text-slate-500">Clique em um jogo para definir horário/quadra ou lançar o resultado.</p>
          {visao === 'chave' ? (
            <div className="card p-4">
              <Chave partidas={partidas} inscricoes={d.inscricoesPorId} onClickPartida={fechado && d.torneio.status === 'homologado' ? undefined : setPartidaSel} />
            </div>
          ) : (
            <div className="card divide-y divide-slate-100">
              {partidas.filter((p) => p.tipo_resultado !== 'bye').map((p) => (
                <button key={p.id} className="w-full text-left p-3 flex flex-wrap items-center gap-3 hover:bg-slate-50 cursor-pointer" onClick={() => setPartidaSel(p)}>
                  <span className="w-32 text-xs font-semibold text-navy-700">{nomeRodada(p.rodada, total)}</span>
                  <span className="flex-1 min-w-0 text-sm">
                    {(p.inscricao1_id && d.inscricoesPorId[p.inscricao1_id]?.nome_exibicao) || 'A definir'}
                    <span className="text-slate-400 mx-2">x</span>
                    {(p.inscricao2_id && d.inscricoesPorId[p.inscricao2_id]?.nome_exibicao) || 'A definir'}
                  </span>
                  <span className="text-xs text-slate-500">{[p.horario, p.quadra].filter(Boolean).join(' · ')}</span>
                  <span className="text-sm font-semibold tabular-nums w-28 text-right">
                    {p.tipo_resultado === 'wo' ? 'W.O.' : p.vencedor_id ? formatarPlacar(p.placar) : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {partidaSel && (
        <PartidaModal
          p={d.partidas.find((x) => x.id === partidaSel.id) ?? partidaSel}
          inscricoes={d.inscricoesPorId}
          rotuloRodada={nomeRodada(partidaSel.rodada, total)}
          onFechar={() => setPartidaSel(null)}
          onMudou={onMudou}
        />
      )}
    </div>
  )
}

const HORAS = Array.from({ length: 17 }, (_, i) => i + 6)

function PartidaModal({ p, inscricoes, rotuloRodada, onFechar, onMudou }: {
  p: Partida; inscricoes: Record<string, InscricaoDetalhe>; rotuloRodada: string; onFechar: () => void; onMudou: () => void
}) {
  const i1 = p.inscricao1_id ? inscricoes[p.inscricao1_id] : null
  const i2 = p.inscricao2_id ? inscricoes[p.inscricao2_id] : null
  const [data, setData] = useState(p.data ?? '')
  const [horario, setHorario] = useState(p.horario ?? '')
  const [quadra, setQuadra] = useState(p.quadra ?? '')
  const [sets, setSets] = useState<string[][]>(() => {
    const base = p.placar.map(([a, b]) => [String(a), String(b)])
    while (base.length < 3) base.push(['', ''])
    return base
  })
  const [tipo, setTipo] = useState<'normal' | 'wo' | 'desistencia'>((p.tipo_resultado as 'normal') ?? 'normal')
  const [vencedor, setVencedor] = useState<string | null>(p.vencedor_id)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const placar: Placar = sets.filter(([a, b]) => a !== '' && b !== '').map(([a, b]) => [Number(a), Number(b)])
  useEffect(() => {
    if (tipo !== 'normal') return
    const v = vencedorPeloPlacar(placar)
    if (v) setVencedor(v === 1 ? p.inscricao1_id : p.inscricao2_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets.flat().join(','), tipo])

  async function salvarAgenda(emQuadra?: boolean) {
    setErro(null); setOk(null)
    const { error } = await supabase.from('partidas').update({
      data: data || null, horario: horario || null, quadra: quadra || null,
      ...(emQuadra !== undefined ? { em_quadra: emQuadra } : {}), atualizado_em: new Date().toISOString(),
    }).eq('id', p.id)
    if (error) setErro(msgErro(error)); else { setOk('Programação salva.'); onMudou() }
  }

  async function salvarResultado() {
    setErro(null); setOk(null)
    if (!vencedor) { setErro('Informe o vencedor.'); return }
    if (tipo === 'normal' && placar.length < 2) { setErro('Informe o placar (ao menos 2 sets).'); return }
    const { error } = await supabase.rpc('registrar_resultado', {
      p_partida: p.id, p_vencedor: vencedor, p_placar: tipo === 'wo' ? [] : placar, p_tipo: tipo,
    })
    if (error) setErro(msgErro(error)); else { onMudou(); onFechar() }
  }

  async function desfazer() {
    if (!confirm('Desfazer o resultado deste jogo?')) return
    const { error } = await supabase.rpc('desfazer_resultado', { p_partida: p.id })
    if (error) setErro(msgErro(error)); else { onMudou(); setVencedor(null) }
  }

  const prontos = !!(i1 && i2)

  return (
    <Modal aberto titulo={rotuloRodada} onFechar={onFechar} largo>
      <div className="space-y-5">
        <div className="text-center font-bold text-lg">
          {i1?.nome_exibicao ?? 'A definir'} <span className="text-slate-400 font-normal mx-2">x</span> {i2?.nome_exibicao ?? 'A definir'}
        </div>

        <section className="rounded-lg border border-slate-200 p-4 space-y-3">
          <h3 className="label">Programação</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <Campo label="Data"><input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
            <Campo label="Horário"><input className="input" value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="NÃO ANTES DAS 17h" /></Campo>
            <Campo label="Quadra"><input className="input" value={quadra} onChange={(e) => setQuadra(e.target.value)} placeholder="Quadra 1" /></Campo>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">NÃO ANTES DAS:</span>
            <select className="input w-auto py-1" value="" onChange={(e) => e.target.value && setHorario(`NÃO ANTES DAS ${e.target.value}h`)}>
              <option value="">hora…</option>
              {HORAS.map((h) => <option key={h} value={h}>{h}h</option>)}
            </select>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setHorario('A SEGUIR')}>A SEGUIR</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary btn-sm" onClick={() => salvarAgenda()}>Salvar programação</button>
            {prontos && !p.vencedor_id && (
              p.em_quadra
                ? <button className="btn-ghost btn-sm" onClick={() => salvarAgenda(false)}>Tirar de “ao vivo”</button>
                : <button className="btn-danger btn-sm" onClick={() => salvarAgenda(true)}>● Marcar “em quadra agora”</button>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 p-4 space-y-3">
          <h3 className="label">Resultado</h3>
          {!prontos ? <p className="text-sm text-slate-500">Aguardando definição dos dois jogadores.</p> : (
            <>
              <div className="flex flex-wrap gap-2">
                {(['normal', 'desistencia', 'wo'] as const).map((t) => (
                  <button key={t} type="button" className={`tab border ${tipo === t ? 'tab-active border-navy-800' : 'border-slate-200'}`} onClick={() => setTipo(t)}>
                    {{ normal: 'Jogo normal', desistencia: 'Desistência durante o jogo', wo: 'W.O.' }[t]}
                  </button>
                ))}
              </div>
              {tipo !== 'wo' && (
                <div className="overflow-x-auto">
                  <table className="text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500"><th></th><th className="px-1">1º set</th><th className="px-1">2º set</th><th className="px-1">Super TB</th></tr>
                    </thead>
                    <tbody>
                      {[0, 1].map((lado) => (
                        <tr key={lado}>
                          <td className="pr-3 py-1 font-medium max-w-40 truncate">{(lado ? i2 : i1)?.nome_exibicao}</td>
                          {[0, 1, 2].map((s) => (
                            <td key={s} className="px-1 py-1">
                              <input inputMode="numeric" className="input w-14 text-center" value={sets[s][lado]}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/\D/g, '').slice(0, 2)
                                  setSets(sets.map((x, i) => (i === s ? (lado ? [x[0], v] : [v, x[1]]) : x)))
                                }} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div>
                <div className="label">Vencedor</div>
                <div className="flex flex-wrap gap-2">
                  {[i1!, i2!].map((i) => (
                    <button key={i.id} type="button" onClick={() => setVencedor(i.id)}
                      className={`btn btn-sm border ${vencedor === i.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-300'}`}>
                      {i.nome_exibicao}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-ball" onClick={salvarResultado}>Salvar resultado e avançar na chave</button>
                {p.vencedor_id && <button className="btn-danger btn-sm" onClick={desfazer}>Desfazer resultado</button>}
              </div>
            </>
          )}
        </section>
        <Erro msg={erro} />
        {ok && <p className="text-sm text-emerald-700">{ok}</p>}
      </div>
    </Modal>
  )
}
