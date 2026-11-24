import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, msgErro } from '../lib/supabase'
import { ok, useAsync } from '../lib/useAsync'
import { useAuth } from '../lib/auth'
import { TIPOS_EVENTO, situacaoEvento } from '../lib/eventos'
import { moeda } from '../lib/financeiro'
import { formatarData, periodo } from '../lib/tenis'
import type { EventoInscricao, EventoLista } from '../lib/types'
import { Aviso, Campo, Erro, Spinner } from '../components/ui'

export default function EventoPagina() {
  const { id } = useParams()
  const { session, perfil } = useAuth()
  const dados = useAsync(async () => {
    const e = ok(await supabase.from('eventos_lista').select('*').eq('id', id!).single()) as EventoLista
    const minha = session
      ? ((await supabase.from('evento_inscricoes').select('*').eq('evento_id', id!).eq('perfil_id', session.user.id).neq('status', 'cancelada').maybeSingle()).data as EventoInscricao | null)
      : null
    return { e, minha }
  }, [id, session?.user.id])

  if (dados.loading) return <Spinner />
  if (dados.error || !dados.data) return <Erro msg="Evento não encontrado." />
  const { e, minha } = dados.data
  const s = situacaoEvento(e)
  const hoje = new Date().toISOString().slice(0, 10)
  const aberto = e.status === 'publicado' && e.inscricao_modo === 'sistema' && (e.inscricoes_ate ?? e.data_inicio) >= hoje

  const info: [string, React.ReactNode][] = [
    ['Quando', `${periodo(e.data_inicio, e.data_fim)}${e.horario ? ` · ${e.horario}` : ''}`],
    ['Onde', [e.local, e.endereco, e.cidade].filter(Boolean).join(', ') || null],
    ['Organização', e.organizador || e.organizador_nome],
    ['Público', e.publico_alvo],
    ['Investimento', Number(e.valor) > 0 ? moeda(e.valor) : 'Gratuito'],
    ['Vagas', e.vagas ? `${Math.max(0, e.vagas - e.inscritos)} de ${e.vagas} disponíveis` : null],
    ['Inscrições até', e.inscricoes_ate ? formatarData(e.inscricoes_ate) : null],
    ['Contato', e.contato],
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link to="/eventos" className="link text-sm">← Cursos e eventos</Link>
      {e.imagem_url && <img src={e.imagem_url} alt="" className="w-full max-h-80 object-cover rounded-xl" />}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-wave">{TIPOS_EVENTO[e.tipo]}</span>
          <span className={`badge ${s.cls}`}>{s.rotulo}</span>
        </div>
        <h1 className="text-3xl font-extrabold mt-1">{e.titulo}</h1>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-4">
          {e.descricao ? e.descricao.split(/\n\s*\n/).map((p, i) => <p key={i} className="whitespace-pre-line leading-relaxed">{p}</p>)
            : <p className="text-slate-500">Mais informações com a organização.</p>}
        </div>
        <aside className="space-y-4">
          <div className="card p-4 space-y-2 text-sm">
            {info.filter(([, v]) => v).map(([k, v]) => <div key={k}><div className="text-xs text-slate-500">{k}</div><div className="font-medium">{v}</div></div>)}
          </div>
          {e.inscricao_modo === 'externo' && e.link_externo && <a href={e.link_externo} target="_blank" rel="noreferrer" className="btn-ball w-full">Inscrever-se ↗</a>}
          {e.inscricao_modo === 'sistema' && (
            minha ? <MinhaInscricao i={minha} onMudou={() => dados.reload(true)} />
              : !aberto ? <Aviso>Inscrições encerradas.</Aviso>
              : !session ? <Link to="/entrar" className="btn-ball w-full">Entre para se inscrever</Link>
              : <Inscrever eventoId={e.id} nome={perfil?.nome ?? ''} lotado={!!e.vagas && e.inscritos >= e.vagas} onFeito={() => dados.reload(true)} />
          )}
        </aside>
      </div>
    </div>
  )
}

function Inscrever({ eventoId, nome: nomeInicial, lotado, onFeito }: { eventoId: string; nome: string; lotado: boolean; onFeito: () => void }) {
  const [nome, setNome] = useState(nomeInicial)
  const [tel, setTel] = useState('')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    setErro(null); setOcupado(true)
    const { error } = await supabase.rpc('inscrever_evento', { p_evento: eventoId, p_nome: nome, p_telefone: tel || null, p_observacao: obs || null })
    setOcupado(false)
    if (error) setErro(msgErro(error)); else onFeito()
  }
  return (
    <form onSubmit={enviar} className="card p-4 space-y-3">
      <div className="font-bold">{lotado ? 'Entrar na lista de espera' : 'Inscrição'}</div>
      <Campo label="Nome"><input className="input" required value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
      <Campo label="WhatsApp"><input className="input" value={tel} onChange={(e) => setTel(e.target.value)} /></Campo>
      <Campo label="Observação"><input className="input" value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      <Erro msg={erro} />
      <button className="btn-ball w-full" disabled={ocupado}>{ocupado ? 'Enviando…' : 'Confirmar inscrição'}</button>
    </form>
  )
}

function MinhaInscricao({ i, onMudou }: { i: EventoInscricao; onMudou: () => void }) {
  const [erro, setErro] = useState<string | null>(null)
  async function cancelar() {
    if (!confirm('Cancelar sua inscrição?')) return
    const { error } = await supabase.rpc('cancelar_inscricao_evento', { p_inscricao: i.id })
    if (error) setErro(msgErro(error)); else onMudou()
  }
  return (
    <div className="card p-4 space-y-2 text-sm">
      <div className="font-bold">{i.status === 'confirmada' ? '✓ Você está inscrito' : 'Você está na lista de espera'}</div>
      {i.lancamento_id && <p className="text-slate-600">O pagamento aparece em <Link to="/painel/minha-area" className="link">Minha área → Cobranças</Link>.</p>}
      <Erro msg={erro} />
      <button className="btn-danger btn-sm" onClick={cancelar}>Cancelar inscrição</button>
    </div>
  )
}
