import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ok, useAsync } from '../lib/useAsync'
import { TIPOS_EVENTO, situacaoEvento } from '../lib/eventos'
import { moeda } from '../lib/financeiro'
import { periodo } from '../lib/tenis'
import type { EventoLista, TipoEvento } from '../lib/types'
import { Erro, Spinner, Tabs, Titulo, Vazio } from '../components/ui'

export function CardEvento({ e }: { e: EventoLista }) {
  const s = situacaoEvento(e)
  return (
    <Link to={`/eventos/${e.id}`} className="card overflow-hidden hover:border-wave flex flex-col">
      {e.imagem_url ? <img src={e.imagem_url} alt="" className="h-36 w-full object-cover" /> : <div className="h-2 bg-gradient-to-r from-ball via-wave-light to-wave" />}
      <div className="p-4 flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-wave">{TIPOS_EVENTO[e.tipo]}</span>
          <span className={`badge ${s.cls}`}>{s.rotulo}</span>
        </div>
        <h3 className="font-bold leading-snug">{e.titulo}</h3>
        <div className="text-sm text-slate-600">{periodo(e.data_inicio, e.data_fim)}{e.horario ? ` · ${e.horario}` : ''}</div>
        <div className="text-sm text-slate-500">{[e.local, e.cidade].filter(Boolean).join(' · ')}</div>
        <div className="mt-auto pt-2 flex items-center justify-between text-sm">
          <span className="text-slate-500">{e.organizador || e.organizador_nome}</span>
          <span className="font-semibold">{Number(e.valor) > 0 ? moeda(e.valor) : 'Gratuito'}</span>
        </div>
      </div>
    </Link>
  )
}

export default function Eventos() {
  const [quando, setQuando] = useState<'proximos' | 'realizados'>('proximos')
  const [tipo, setTipo] = useState<TipoEvento | ''>('')
  const hoje = new Date().toISOString().slice(0, 10)
  const lista = useAsync(async () => {
    let q = supabase.from('eventos_lista').select('*').neq('status', 'rascunho')
    q = quando === 'proximos'
      ? q.or(`data_fim.gte.${hoje},and(data_fim.is.null,data_inicio.gte.${hoje})`).order('data_inicio')
      : q.lt('data_inicio', hoje).order('data_inicio', { ascending: false }).limit(60)
    if (tipo) q = q.eq('tipo', tipo)
    return ok(await q) as EventoLista[]
  }, [quando, tipo])

  return (
    <div>
      <Titulo sub="Cursos, clínicas, capacitações e eventos de tênis em Pernambuco">Cursos e eventos</Titulo>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Tabs valor={quando} onChange={setQuando} itens={[{ valor: 'proximos', rotulo: 'Próximos' }, { valor: 'realizados', rotulo: 'Realizados' }]} />
        <select className="input w-auto" value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvento | '')}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS_EVENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Erro msg={lista.error} />
      {lista.loading ? <Spinner /> : !lista.data?.length ? <div className="card"><Vazio>Nenhum evento {quando === 'proximos' ? 'programado' : 'realizado'}.</Vazio></div> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{lista.data.map((e) => <CardEvento key={e.id} e={e} />)}</div>
      )}
    </div>
  )
}
