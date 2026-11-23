import { Link } from 'react-router-dom'
import { formatarData, nomeRodada } from '../lib/tenis'
import type { InscricaoDetalhe, Partida } from '../lib/types'
import { AoVivo } from './ui'

const ALTURA_BASE = 96 // altura de um jogo da 1ª rodada (px)

interface Props {
  partidas: Partida[]
  inscricoes: Record<string, InscricaoDetalhe>
  onClickPartida?: (p: Partida) => void
}

/** Chave eliminatória com linhas de ligação entre as rodadas */
export default function Chave({ partidas, inscricoes, onClickPartida }: Props) {
  const total = Math.max(0, ...partidas.map((p) => p.rodada))
  if (!total) return null
  const porRodada = Array.from({ length: total }, (_, i) =>
    partidas.filter((p) => p.rodada === i + 1).sort((a, b) => a.ordem - b.ordem),
  )
  const final = porRodada[total - 1][0]
  const campeao = final?.vencedor_id ? inscricoes[final.vencedor_id] : null
  const alturaTotal = porRodada[0].length * ALTURA_BASE

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max">
        {porRodada.map((jogos, i) => (
          <div key={i} className="w-60 shrink-0">
            <div className="text-xs font-bold uppercase tracking-wide text-navy-700 mb-2 text-center">
              {nomeRodada(i + 1, total)}
            </div>
            <div style={{ height: alturaTotal }} className="flex flex-col">
              {jogos.map((p) => (
                <div key={p.id} className="relative flex items-center" style={{ height: ALTURA_BASE * 2 ** i }}>
                  <JogoBox p={p} inscricoes={inscricoes} onClick={onClickPartida} />
                  {i < total - 1 && (
                    <div
                      className={`absolute -right-4 w-4 border-r-2 border-slate-300 ${
                        p.ordem % 2 === 0 ? 'top-1/2 h-1/2 border-t-2 rounded-tr' : 'bottom-1/2 h-1/2 border-b-2 rounded-br'
                      }`}
                    />
                  )}
                  {i > 0 && <div className="absolute -left-4 w-4 top-1/2 border-t-2 border-slate-300" />}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="w-48 shrink-0 flex flex-col">
          <div className="text-xs font-bold uppercase tracking-wide text-navy-700 mb-2 text-center">Campeão</div>
          <div style={{ height: alturaTotal }} className="flex items-center">
            <div className={`w-full rounded-xl p-4 text-center ${campeao ? 'bg-ball text-navy-900' : 'bg-slate-100 text-slate-400'}`}>
              <div className="text-3xl">🏆</div>
              <div className="font-extrabold mt-1 text-sm">{campeao ? campeao.nome_exibicao : 'A definir'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function JogoBox({ p, inscricoes, onClick }: {
  p: Partida; inscricoes: Record<string, InscricaoDetalhe>; onClick?: (p: Partida) => void
}) {
  const i1 = p.inscricao1_id ? inscricoes[p.inscricao1_id] : null
  const i2 = p.inscricao2_id ? inscricoes[p.inscricao2_id] : null
  const bye = p.tipo_resultado === 'bye'
  const clicavel = !!onClick && !bye
  const agenda = [p.data ? formatarData(p.data, { weekday: 'short', day: '2-digit', month: '2-digit' }) : '', p.horario, p.quadra]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className={`w-full rounded-lg border bg-white shadow-sm overflow-hidden ${
        p.em_quadra ? 'border-red-400 ring-2 ring-red-200' : 'border-slate-200'
      } ${clicavel ? 'cursor-pointer hover:border-wave hover:shadow' : ''}`}
      onClick={() => clicavel && onClick!(p)}
    >
      <div className="flex items-center justify-between gap-1 px-2 h-5 bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500">
        <span className="truncate">{bye ? '' : agenda || (p.vencedor_id ? '' : 'Horário a definir')}</span>
        {p.em_quadra && <AoVivo />}
        {p.tipo_resultado === 'wo' && <span className="font-bold text-amber-700">W.O.</span>}
        {p.tipo_resultado === 'desistencia' && <span className="font-bold text-amber-700">Desist.</span>}
      </div>
      <Linha insc={i1} lado={0} p={p} bye={bye && !i1} />
      <div className="border-t border-slate-100" />
      <Linha insc={i2} lado={1} p={p} bye={bye && !i2} />
    </div>
  )
}

function Linha({ insc, lado, p, bye }: { insc: InscricaoDetalhe | null; lado: 0 | 1; p: Partida; bye: boolean }) {
  const venceu = !!insc && p.vencedor_id === insc.id
  const perdeu = !!insc && !!p.vencedor_id && !venceu
  return (
    <div className={`flex items-center gap-1 px-2 h-[30px] text-[13px] ${venceu ? 'font-bold text-navy-900' : perdeu ? 'text-slate-400' : 'text-slate-700'}`}>
      {insc?.cabeca && <span className="text-[10px] font-bold text-wave w-5 shrink-0">({insc.cabeca})</span>}
      <span className="truncate flex-1">
        {bye ? (
          <em className="text-slate-400 font-normal">bye</em>
        ) : insc ? (
          insc.parceiro_id ? insc.nome_exibicao : (
            <Link to={`/atletas/${insc.atleta_id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
              {insc.nome_exibicao}
            </Link>
          )
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </span>
      {venceu && <span className="text-ball-dark text-xs">●</span>}
      <span className="flex gap-1 tabular-nums">
        {p.placar.map((s, i) => (
          <span key={i} className={`w-5 text-center ${s[lado] > s[1 - lado] ? 'font-bold' : 'font-normal'}`}>
            {s[lado]}
          </span>
        ))}
      </span>
    </div>
  )
}
