import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ok, useAsync } from '../lib/useAsync'
import { periodo } from '../lib/tenis'
import type { Clube, Torneio } from '../lib/types'
import { Erro, Spinner, StatusBadge, Titulo, Vazio } from '../components/ui'
import { useState } from 'react'

export type TorneioComClube = Torneio & { clubes: Pick<Clube, 'id' | 'nome' | 'sigla'> | null }

export function CardTorneio({ t }: { t: TorneioComClube }) {
  return (
    <Link to={`/torneios/${t.id}`} className="card p-4 hover:shadow-md hover:border-wave/50 transition block">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-wave">{t.clubes?.nome}</div>
        <StatusBadge status={t.status} />
      </div>
      <h3 className="font-bold text-lg mt-1">{t.nome}</h3>
      <div className="text-sm text-slate-500 mt-1">{periodo(t.data_inicio, t.data_fim)}{t.local ? ` · ${t.local}` : ''}</div>
    </Link>
  )
}

export default function Torneios() {
  const [clube, setClube] = useState('')
  const dados = useAsync(async () => {
    const [t, c] = await Promise.all([
      supabase.from('torneios').select('*, clubes(id,nome,sigla)').neq('status', 'rascunho').order('data_inicio', { ascending: false }),
      supabase.from('clubes').select('id,nome').eq('ativo', true).order('nome'),
    ])
    return { torneios: ok(t) as TorneioComClube[], clubes: ok(c) as Clube[] }
  }, [])

  const lista = (dados.data?.torneios ?? []).filter((t) => !clube || t.clube_id === clube)
  const ativos = lista.filter((t) => t.status === 'inscricoes' || t.status === 'em_andamento')
  const passados = lista.filter((t) => t.status === 'encerrado' || t.status === 'homologado')

  return (
    <div>
      <Titulo acoes={
        <select className="input w-auto" value={clube} onChange={(e) => setClube(e.target.value)}>
          <option value="">Todos os clubes</option>
          {dados.data?.clubes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      }>Torneios</Titulo>
      <Erro msg={dados.error} />
      {dados.loading ? <Spinner /> : (
        <>
          <h2 className="font-bold text-lg mb-3">Em andamento e inscrições abertas</h2>
          {ativos.length ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">{ativos.map((t) => <CardTorneio key={t.id} t={t} />)}</div>
          ) : <div className="mb-8"><Vazio>Nenhum torneio em andamento.</Vazio></div>}
          <h2 className="font-bold text-lg mb-3">Realizados</h2>
          {passados.length ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{passados.map((t) => <CardTorneio key={t.id} t={t} />)}</div>
          ) : <Vazio>Nenhum torneio realizado ainda.</Vazio>}
        </>
      )}
    </div>
  )
}
