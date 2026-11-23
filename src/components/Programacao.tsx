import { formatarData, formatarPlacar, nomeRodada } from '../lib/tenis'
import type { InscricaoDetalhe, Partida } from '../lib/types'
import { AoVivo, Vazio } from './ui'

/** Lista de jogos agrupada por dia (ordem de jogos) */
export default function Programacao({ partidas, inscricoes, nomeCategoria }: {
  partidas: Partida[]
  inscricoes: Record<string, InscricaoDetalhe>
  nomeCategoria?: (p: Partida) => string
}) {
  const total = (p: Partida) => Math.max(...partidas.filter((x) => x.torneio_categoria_id === p.torneio_categoria_id).map((x) => x.rodada))
  const jogos = partidas.filter((p) => p.tipo_resultado !== 'bye' && (p.inscricao1_id || p.inscricao2_id))
  if (!jogos.length) return <Vazio>Nenhum jogo programado ainda.</Vazio>

  const grupos = new Map<string, Partida[]>()
  for (const p of jogos) {
    const k = p.data ?? ''
    grupos.set(k, [...(grupos.get(k) ?? []), p])
  }
  const chaves = [...grupos.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))

  return (
    <div className="space-y-6">
      {chaves.map((k) => (
        <div key={k}>
          <h3 className="font-bold text-sm uppercase tracking-wide text-navy-700 mb-2">
            {k ? formatarData(k, { weekday: 'long', day: '2-digit', month: 'long' }) : 'Data a definir'}
          </h3>
          <div className="card divide-y divide-slate-100">
            {grupos
              .get(k)!
              .sort((a, b) => (a.horario ?? '~').localeCompare(b.horario ?? '~') || (a.quadra ?? '').localeCompare(b.quadra ?? '') || a.rodada - b.rodada)
              .map((p) => {
                const i1 = p.inscricao1_id ? inscricoes[p.inscricao1_id] : null
                const i2 = p.inscricao2_id ? inscricoes[p.inscricao2_id] : null
                const v1 = p.vencedor_id && p.vencedor_id === p.inscricao1_id
                const v2 = p.vencedor_id && p.vencedor_id === p.inscricao2_id
                return (
                  <div key={p.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="sm:w-48 shrink-0">
                      <div className="text-sm font-bold text-navy-800">{p.horario || 'Horário a definir'}</div>
                      <div className="text-xs text-slate-500">
                        {[p.quadra, nomeCategoria?.(p), nomeRodada(p.rodada, total(p))].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 text-sm">
                      <span className={v1 ? 'font-bold' : v2 ? 'text-slate-400' : ''}>{i1?.nome_exibicao ?? 'A definir'}</span>
                      <span className="mx-2 text-slate-400">x</span>
                      <span className={v2 ? 'font-bold' : v1 ? 'text-slate-400' : ''}>{i2?.nome_exibicao ?? 'A definir'}</span>
                    </div>
                    <div className="shrink-0 text-sm tabular-nums flex items-center gap-2">
                      {p.em_quadra && <AoVivo />}
                      {p.tipo_resultado === 'wo' ? <span className="badge bg-amber-100 text-amber-800">W.O.</span>
                        : p.vencedor_id ? <span className="font-semibold">{formatarPlacar(p.placar, !!v2)}{p.tipo_resultado === 'desistencia' ? ' (desist.)' : ''}</span>
                        : null}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
