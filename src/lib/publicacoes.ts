import type { Publicacao } from './types'

export const TIPOS_PUB: Record<Publicacao['tipo'], string> = {
  noticia: 'Notícia', comunicado: 'Comunicado', resultado: 'Resultado', regulamento: 'Regulamento', edital: 'Edital',
}

export function dataPub(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}
