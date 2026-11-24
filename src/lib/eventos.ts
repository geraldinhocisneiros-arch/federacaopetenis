import type { EventoLista, TipoEvento } from './types'

export const TIPOS_EVENTO: Record<TipoEvento, string> = {
  curso: 'Curso', clinica: 'Clínica', capacitacao: 'Capacitação de treinadores', arbitragem: 'Arbitragem',
  palestra: 'Palestra', festival: 'Festival', torneio_social: 'Torneio social', evento: 'Evento',
}

export function situacaoEvento(e: EventoLista): { rotulo: string; cls: string } {
  const hoje = new Date().toISOString().slice(0, 10)
  if (e.status === 'cancelado') return { rotulo: 'Cancelado', cls: 'bg-slate-100 text-slate-500' }
  if ((e.data_fim ?? e.data_inicio) < hoje) return { rotulo: 'Realizado', cls: 'bg-slate-100 text-slate-600' }
  if (e.inscricao_modo === 'sem') return { rotulo: 'Divulgação', cls: 'bg-sky-100 text-sky-800' }
  if ((e.inscricoes_ate ?? e.data_inicio) < hoje) return { rotulo: 'Inscrições encerradas', cls: 'bg-violet-100 text-violet-800' }
  if (e.vagas && e.inscritos >= e.vagas) return { rotulo: 'Lotado · lista de espera', cls: 'bg-amber-100 text-amber-800' }
  return { rotulo: 'Inscrições abertas', cls: 'bg-emerald-100 text-emerald-800' }
}
