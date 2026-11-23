import { useState } from 'react'
import { formatarData } from '../lib/tenis'

export interface PontoHist {
  data: string
  posicao: number
  pontos: number
  descricao: string | null
}

/** Evolução da posição no ranking (1º lugar no topo). Uma série por gráfico. */
export default function GraficoPosicao({ pontos }: { pontos: PontoHist[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (pontos.length < 2) {
    return <p className="text-xs text-slate-500">O gráfico aparece a partir da 2ª atualização do ranking.</p>
  }
  const W = 560, H = 160, padL = 32, padR = 12, padT = 12, padB = 24
  const maxPos = Math.max(...pontos.map((p) => p.posicao), 2)
  const x = (i: number) => padL + (i * (W - padL - padR)) / (pontos.length - 1)
  const y = (pos: number) => padT + ((pos - 1) * (H - padT - padB)) / (maxPos - 1)
  const ticks = Array.from(new Set([1, Math.ceil(maxPos / 2), maxPos]))
  const d = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.posicao)}`).join(' ')
  const h = hover != null ? pontos[hover] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Evolução da posição no ranking"
        onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#64748b">{t}º</text>
          </g>
        ))}
        <path d={d} fill="none" stroke="#2f7fd0" strokeWidth={2} strokeLinejoin="round" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#94a3b8" strokeDasharray="3 3" />}
        {pontos.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.posicao)} r={hover === i ? 6 : 4.5} fill="#2f7fd0" stroke="#fff" strokeWidth={2} />
            <rect x={x(i) - 14} y={0} width={28} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
          </g>
        ))}
        <text x={padL} y={H - 6} fontSize={10} fill="#64748b">{formatarData(pontos[0].data)}</text>
        <text x={W - padR} y={H - 6} fontSize={10} fill="#64748b" textAnchor="end">{formatarData(pontos[pontos.length - 1].data)}</text>
      </svg>
      {h && (
        <div className="absolute top-0 right-0 card px-3 py-2 text-xs pointer-events-none">
          <div className="font-bold text-navy-900">{h.posicao}º lugar · {h.pontos} pts</div>
          <div className="text-slate-500">{formatarData(h.data)}{h.descricao ? ` · ${h.descricao}` : ''}</div>
        </div>
      )}
    </div>
  )
}
