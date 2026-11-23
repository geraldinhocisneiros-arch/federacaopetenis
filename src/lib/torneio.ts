import { useEffect } from 'react'
import { supabase } from './supabase'
import { ok, useAsync } from './useAsync'
import type { Categoria, Clube, InscricaoDetalhe, Partida, Torneio, TorneioCategoria } from './types'

export type TCComCategoria = TorneioCategoria & { categorias: Categoria }

export interface DadosTorneio {
  torneio: Torneio & { clubes: Clube | null }
  categorias: TCComCategoria[]
  inscricoes: InscricaoDetalhe[]
  inscricoesPorId: Record<string, InscricaoDetalhe>
  partidas: Partida[]
}

/** Carrega tudo de um torneio e mantém as partidas atualizadas em tempo real */
export function useTorneio(id: string | undefined) {
  const res = useAsync(async (): Promise<DadosTorneio> => {
    const torneio = ok(await supabase.from('torneios').select('*, clubes(*)').eq('id', id!).single()) as DadosTorneio['torneio']
    const categorias = (ok(await supabase.from('torneio_categorias').select('*, categorias(*)').eq('torneio_id', id!)) as TCComCategoria[])
      .sort((a, b) => a.categorias.ordem - b.categorias.ordem || a.categorias.nome.localeCompare(b.categorias.nome))
    const ids = categorias.map((c) => c.id)
    const [insc, part] = ids.length
      ? await Promise.all([
          supabase.from('inscricoes_detalhe').select('*').in('torneio_categoria_id', ids).order('atleta_nome'),
          supabase.from('partidas').select('*').in('torneio_categoria_id', ids).order('rodada').order('ordem'),
        ])
      : [{ data: [], error: null }, { data: [], error: null }]
    const inscricoes = ok(insc) as InscricaoDetalhe[]
    return {
      torneio,
      categorias,
      inscricoes,
      inscricoesPorId: Object.fromEntries(inscricoes.map((i) => [i.id, i])),
      partidas: ok(part) as Partida[],
    }
  }, [id])

  const tcIds = res.data?.categorias.map((c) => c.id).join(',') ?? ''
  useEffect(() => {
    if (!id) return
    const ids = new Set(tcIds.split(','))
    const canal = supabase
      .channel(`torneio-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas' }, (payload) => {
        const row = (payload.new ?? payload.old) as Partial<Partida>
        if (!row?.torneio_categoria_id || ids.has(row.torneio_categoria_id)) res.reload(true)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tcIds])

  return res
}
