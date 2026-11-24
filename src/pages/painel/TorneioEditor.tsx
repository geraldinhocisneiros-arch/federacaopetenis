import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../lib/auth'
import { useTorneio, type DadosTorneio } from '../../lib/torneio'
import { rotuloFase } from '../../lib/tenis'
import type { StatusTorneio, TabelaPontuacao, Torneio } from '../../lib/types'
import { Aviso, Campo, Erro, Spinner, StatusBadge, Tabs } from '../../components/ui'
import EditorCategorias from './EditorCategorias'
import EditorInscricoes from './EditorInscricoes'
import EditorChave from './EditorChave'

type Aba = 'dados' | 'categorias' | 'inscricoes' | 'chave' | 'encerramento'

export default function TorneioEditor() {
  const { id } = useParams()
  const t = useTorneio(id)
  const [aba, setAba] = useState<Aba>('dados')

  if (t.loading && !t.data) return <Spinner />
  if (t.error || !t.data) return <Erro msg={t.error ?? 'Torneio não encontrado.'} />
  const d = t.data
  const bloqueado = d.torneio.status === 'homologado'

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <Link to="/painel/torneios" className="text-xs link">← Torneios</Link>
          <h2 className="text-xl font-bold">{d.torneio.nome}</h2>
          <div className="text-sm text-slate-500">{d.torneio.clubes?.nome}</div>
        </div>
        <StatusBadge status={d.torneio.status} />
        <Link to={`/torneios/${d.torneio.id}`} className="btn-ghost btn-sm" target="_blank">Ver página pública ↗</Link>
      </div>
      {bloqueado && <div className="mb-4"><Aviso>Torneio homologado: alterações bloqueadas. A federação pode desfazer a homologação na aba Encerramento.</Aviso></div>}

      <Tabs<Aba> valor={aba} onChange={setAba} itens={[
        { valor: 'dados', rotulo: '1. Dados' },
        { valor: 'categorias', rotulo: `2. Categorias (${d.categorias.length})` },
        { valor: 'inscricoes', rotulo: `3. Inscrições (${d.inscricoes.length})` },
        { valor: 'chave', rotulo: '4. Chaves e jogos' },
        { valor: 'encerramento', rotulo: '5. Encerramento' },
      ]} />
      <div className="mt-4">
        {aba === 'dados' && <Dados d={d} onSalvo={() => t.reload(true)} />}
        {aba === 'categorias' && <EditorCategorias d={d} onMudou={() => t.reload(true)} />}
        {aba === 'inscricoes' && <EditorInscricoes d={d} onMudou={() => t.reload(true)} />}
        {aba === 'chave' && <EditorChave d={d} onMudou={() => t.reload(true)} />}
        {aba === 'encerramento' && <Encerramento d={d} onMudou={() => t.reload(true)} />}
      </div>
    </div>
  )
}

function Dados({ d, onSalvo }: { d: DadosTorneio; onSalvo: () => void }) {
  const { isAdmin } = useAuth()
  const [f, setF] = useState<Torneio>(d.torneio)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => setF(d.torneio), [d.torneio])
  const extras = useAsync(async () => {
    const [tab, cl] = await Promise.all([
      supabase.from('tabelas_pontuacao').select('*').order('nome'),
      supabase.from('clubes').select('id,nome').order('nome'),
    ])
    return { tabelas: ok(tab) as TabelaPontuacao[], clubes: ok(cl) as { id: string; nome: string }[] }
  }, [])
  const set = (k: keyof Torneio, v: unknown) => setF({ ...f, [k]: v })
  const bloqueado = d.torneio.status === 'homologado'

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null); setMsg(null)
    const { error } = await supabase.from('torneios').update({
      nome: f.nome, descricao: f.descricao, local: f.local, data_inicio: f.data_inicio || null, data_fim: f.data_fim || null,
      status: f.status, pontua_ranking: f.pontua_ranking, tabela_pontuacao_id: f.tabela_pontuacao_id,
      info_inscricao: f.info_inscricao, regulamento: f.regulamento, inscricao_recebedor: f.inscricao_recebedor, ...(isAdmin ? { clube_id: f.clube_id } : {}),
    }).eq('id', f.id)
    if (error) setErro(msgErro(error))
    else { setMsg('Salvo.'); onSalvo() }
  }

  async function excluir() {
    if (!confirm('Excluir este torneio e tudo o que há nele?')) return
    const { error } = await supabase.from('torneios').delete().eq('id', f.id)
    if (error) setErro(msgErro(error))
    else window.location.href = '/painel/torneios'
  }

  const statusEditaveis: StatusTorneio[] = ['rascunho', 'inscricoes', 'em_andamento']

  return (
    <form onSubmit={salvar} className="card p-5 space-y-4">
      <fieldset disabled={bloqueado} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo label="Nome"><input className="input" required value={f.nome} onChange={(e) => set('nome', e.target.value)} /></Campo>
          <Campo label="Local"><input className="input" value={f.local ?? ''} onChange={(e) => set('local', e.target.value)} placeholder="Ex.: Quadras do ACE, Boa Viagem" /></Campo>
          <Campo label="Início"><input type="date" className="input" value={f.data_inicio ?? ''} onChange={(e) => set('data_inicio', e.target.value)} /></Campo>
          <Campo label="Término"><input type="date" className="input" value={f.data_fim ?? ''} onChange={(e) => set('data_fim', e.target.value)} /></Campo>
          <Campo label="Situação" dica="'Rascunho' não aparece no site. Encerramento é feito na aba 5.">
            <select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}
              disabled={!statusEditaveis.includes(d.torneio.status)}>
              {statusEditaveis.map((s) => <option key={s} value={s}>{{ rascunho: 'Rascunho', inscricoes: 'Inscrições abertas', em_andamento: 'Em andamento' }[s as 'rascunho']}</option>)}
              {!statusEditaveis.includes(d.torneio.status) && <option value={d.torneio.status}>{d.torneio.status}</option>}
            </select>
          </Campo>
          {isAdmin && (
            <Campo label="Clube organizador">
              <select className="input" value={f.clube_id} onChange={(e) => set('clube_id', e.target.value)}>
                {extras.data?.clubes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
          )}
          <Campo label="Tabela de pontuação" dica="Definida pela federação. Pode ser trocada por categoria.">
            <select className="input" value={f.tabela_pontuacao_id ?? ''} onChange={(e) => set('tabela_pontuacao_id', e.target.value || null)} disabled={!isAdmin && !!d.torneio.tabela_pontuacao_id}>
              <option value="">— nenhuma —</option>
              {extras.data?.tabelas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </Campo>
          <label className="flex items-center gap-2 text-sm font-medium mt-6">
            <input type="checkbox" checked={f.pontua_ranking} onChange={(e) => set('pontua_ranking', e.target.checked)} disabled={!isAdmin} />
            Vale pontos para o ranking
          </label>
          <Campo label="Quem recebe as inscrições" dica="Define quem dá baixa nas cobranças de inscrição geradas automaticamente.">
            <select className="input" value={f.inscricao_recebedor} onChange={(e) => set('inscricao_recebedor', e.target.value)} disabled={!isAdmin}>
              <option value="clube">O clube organizador</option>
              <option value="federacao">A federação</option>
            </select>
          </Campo>
        </div>
        <Campo label="Descrição"><textarea className="input" rows={2} value={f.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} /></Campo>
        <Campo label="Inscrições (valores, prazo, como pagar)" dica="Texto livre: prazo, chave PIX, dados para pagamento. A taxa de cada categoria é definida na aba 2.">
          <textarea className="input" rows={3} value={f.info_inscricao ?? ''} onChange={(e) => set('info_inscricao', e.target.value)} />
        </Campo>
        <Campo label="Regulamento"><textarea className="input" rows={4} value={f.regulamento ?? ''} onChange={(e) => set('regulamento', e.target.value)} /></Campo>
      </fieldset>
      <Erro msg={erro} />
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      {!bloqueado && (
        <div className="flex justify-between gap-2">
          <button type="button" className="btn-danger" onClick={excluir} disabled={!isAdmin && d.torneio.status !== 'rascunho'}>Excluir</button>
          <button className="btn-primary">Salvar</button>
        </div>
      )}
    </form>
  )
}

interface Previa { inscricao_id: string; categoria_nome: string; atleta_nome: string; fase: string | null; pontos: number }

function Encerramento({ d, onMudou }: { d: DadosTorneio; onMudou: () => void }) {
  const { isAdmin } = useAuth()
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const previa = useAsync(async () => ok(await supabase.rpc('previa_pontos_torneio', { p_torneio: d.torneio.id })) as Previa[], [d.torneio.id, d.torneio.status])
  const status = d.torneio.status

  async function rpc(fn: string, confirmar: string) {
    if (!confirm(confirmar)) return
    setErro(null); setOcupado(true)
    const { error } = await supabase.rpc(fn, { p_torneio: d.torneio.id })
    setOcupado(false)
    if (error) setErro(msgErro(error))
    else onMudou()
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-3">
        <h3 className="font-bold">Fluxo</h3>
        <ol className="text-sm text-slate-600 list-decimal ml-5 space-y-1">
          <li>O clube lança todos os resultados (a chave avança sozinha).</li>
          <li>O clube <b>encerra</b> o torneio quando todas as finais forem jogadas.</li>
          <li>A federação confere e <b>homologa</b>: os pontos entram no ranking e o histórico é registrado.</li>
        </ol>
        <Erro msg={erro} />
        <div className="flex flex-wrap gap-2">
          {['rascunho', 'inscricoes', 'em_andamento'].includes(status) && (
            <button className="btn-primary" disabled={ocupado} onClick={() => rpc('encerrar_torneio', 'Encerrar o torneio? Os resultados ficam aguardando homologação da federação.')}>
              Encerrar torneio
            </button>
          )}
          {status === 'encerrado' && (
            <button className="btn-ghost" disabled={ocupado} onClick={async () => {
              const { error } = await supabase.from('torneios').update({ status: 'em_andamento' }).eq('id', d.torneio.id)
              if (error) setErro(msgErro(error)); else onMudou()
            }}>Reabrir para correções</button>
          )}
          {isAdmin && status === 'encerrado' && (
            <button className="btn-ball" disabled={ocupado} onClick={() => rpc('homologar_torneio', 'Homologar e lançar os pontos no ranking?')}>
              Homologar e atualizar ranking
            </button>
          )}
          {isAdmin && ['encerrado', 'homologado'].includes(status) && (
            <button className="btn-ghost" disabled={ocupado} onClick={() => rpc('gerar_taxa_federacao_torneio', 'Gerar a cobrança da taxa federativa (nº de inscrições × taxa configurada no Financeiro) para o clube organizador?')}>
              Gerar taxa federativa
            </button>
          )}
          {isAdmin && status === 'homologado' && (
            <button className="btn-danger" disabled={ocupado} onClick={() => rpc('desfazer_homologacao', 'Desfazer a homologação? Os pontos deste torneio saem do ranking.')}>
              Desfazer homologação
            </button>
          )}
        </div>
        {!d.torneio.tabela_pontuacao_id && <Aviso>Este torneio não tem tabela de pontuação: todos receberão 0 pontos.</Aviso>}
      </div>

      <div className="card">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold">{status === 'homologado' ? 'Pontos lançados' : 'Prévia da pontuação'}</h3>
          <p className="text-xs text-slate-500">Calculada pela fase alcançada, aplicando as regras de bye e W.O. de cada categoria.</p>
        </div>
        {previa.loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Categoria</th><th>Atleta</th><th>Fase</th><th className="text-right">Pontos</th></tr></thead>
              <tbody>
                {previa.data?.map((p) => (
                  <tr key={p.inscricao_id}>
                    <td className="text-slate-500">{p.categoria_nome}</td>
                    <td>{p.atleta_nome}</td>
                    <td>{p.fase ? rotuloFase(p.fase) : <span className="text-slate-400">em jogo / sem pontos</span>}</td>
                    <td className="text-right font-semibold tabular-nums">{p.pontos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
