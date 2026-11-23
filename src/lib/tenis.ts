import type { Fase, Placar, StatusTorneio } from './types'

export const FASES: { valor: Fase; rotulo: string }[] = [
  { valor: 'campeao', rotulo: 'Campeão' },
  { valor: 'final', rotulo: 'Vice-campeão' },
  { valor: 'semifinal', rotulo: 'Semifinal' },
  { valor: 'quartas', rotulo: 'Quartas de final' },
  { valor: 'oitavas', rotulo: 'Oitavas de final' },
  { valor: 'r32', rotulo: 'Rodada de 32' },
  { valor: 'r64', rotulo: 'Rodada de 64' },
  { valor: 'r128', rotulo: 'Rodada de 128' },
]

export function rotuloFase(f: string | null | undefined): string {
  return FASES.find((x) => x.valor === f)?.rotulo ?? '—'
}

/** Nome da rodada a partir do número de jogadores restantes */
export function nomeRodada(rodada: number, totalRodadas: number): string {
  const jogadores = 2 ** (totalRodadas - rodada + 1)
  switch (jogadores) {
    case 2: return 'Final'
    case 4: return 'Semifinal'
    case 8: return 'Quartas de final'
    case 16: return 'Oitavas de final'
    default: return `Rodada de ${jogadores}`
  }
}

export const STATUS_TORNEIO: Record<StatusTorneio, { rotulo: string; cls: string }> = {
  rascunho: { rotulo: 'Rascunho', cls: 'bg-slate-100 text-slate-600' },
  inscricoes: { rotulo: 'Inscrições abertas', cls: 'bg-sky-100 text-sky-800' },
  em_andamento: { rotulo: 'Em andamento', cls: 'bg-amber-100 text-amber-800' },
  encerrado: { rotulo: 'Encerrado · aguardando homologação', cls: 'bg-violet-100 text-violet-800' },
  homologado: { rotulo: 'Homologado', cls: 'bg-emerald-100 text-emerald-800' },
}

export const GENERO: Record<string, string> = { M: 'Masculino', F: 'Feminino', X: 'Misto' }

/** "6/4 3/6 [10/8]" — o 3º set aparece entre colchetes quando é super tiebreak */
export function formatarPlacar(placar: Placar | null | undefined, inverter = false): string {
  if (!placar || placar.length === 0) return ''
  return placar
    .map(([a, b], i) => {
      const [x, y] = inverter ? [b, a] : [a, b]
      const stb = i === 2 && Math.max(a, b) >= 10
      return stb ? `[${x}/${y}]` : `${x}/${y}`
    })
    .join(' ')
}

/** Descobre o vencedor (1 ou 2) pelo placar, se possível */
export function vencedorPeloPlacar(placar: Placar): 1 | 2 | null {
  let s1 = 0
  let s2 = 0
  for (const [a, b] of placar) {
    if (a > b) s1++
    else if (b > a) s2++
  }
  if (s1 === s2) return null
  return s1 > s2 ? 1 : 2
}

export function formatarData(d: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!d) return ''
  const [y, m, dia] = d.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, dia).toLocaleDateString('pt-BR', opts ?? { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function periodo(inicio: string | null, fim: string | null): string {
  if (!inicio) return 'Data a definir'
  if (!fim || fim === inicio) return formatarData(inicio)
  return `${formatarData(inicio, { day: '2-digit', month: '2-digit' })} a ${formatarData(fim)}`
}

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}
