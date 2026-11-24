import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../lib/auth'
import { STATUS_FIL, anoAtual, lerValor, moeda } from '../../lib/financeiro'
import { formatarData } from '../../lib/tenis'
import type { Anuidade, Atleta, FiliacaoDetalhe, StatusFiliacao, TipoFiliacao } from '../../lib/types'
import { Campo, Erro, Modal, Spinner, Tabs, Vazio } from '../../components/ui'
import AtletaBusca from '../../components/AtletaBusca'
import LancamentoModal from './LancamentoModal'

type Aba = 'atleta' | 'academia' | 'anuidades'

export default function PainelFiliacao() {
  const { isAdmin } = useAuth()
  const [aba, setAba] = useState<Aba>('atleta')
  const [ano, setAno] = useState(anoAtual())
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <h2 className="text-xl font-bold">Filiação</h2>
        <Campo label="Ano">
          <select className="input" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {[anoAtual() + 1, anoAtual(), anoAtual() - 1, anoAtual() - 2].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Campo>
      </div>
      <Tabs<Aba> valor={aba} onChange={setAba} itens={[
        { valor: 'atleta', rotulo: 'Atletas' },
        { valor: 'academia', rotulo: 'Academias' },
        ...(isAdmin ? [{ valor: 'anuidades' as Aba, rotulo: 'Anuidades (valores)' }] : []),
      ]} />
      <div className="mt-4">
        {aba === 'anuidades' ? <Anuidades ano={ano} /> : <Lista key={aba + ano} tipo={aba} ano={ano} />}
      </div>
    </div>
  )
}

function Lista({ tipo, ano }: { tipo: TipoFiliacao; ano: number }) {
  const { isAdmin, perfil } = useAuth()
  const [status, setStatus] = useState<StatusFiliacao | ''>('')
  const [busca, setBusca] = useState('')
  const [nova, setNova] = useState(false)
  const [lanc, setLanc] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const dados = useAsync(async () => {
    let q = supabase.from('filiacoes_detalhe').select('*').eq('tipo', tipo).eq('ano', ano).order('nome')
    if (!isAdmin) q = tipo === 'atleta' ? q.eq('atleta_clube_id', perfil!.clube_id!) : q.eq('clube_id', perfil!.clube_id!)
    const fil = ok(await q) as FiliacaoDetalhe[]
    // Quem ainda não tem filiação no ano
    let semQ = tipo === 'atleta'
      ? supabase.from('atletas').select('id,nome,clube_id').eq('ativo', true).order('nome').limit(2000)
      : supabase.from('clubes').select('id,nome').eq('ativo', true).order('nome')
    if (!isAdmin) semQ = semQ.eq(tipo === 'atleta' ? 'clube_id' : 'id', perfil!.clube_id!)
    const todos = ok(await semQ) as { id: string; nome: string }[]
    const com = new Set(fil.filter((f) => f.status !== 'cancelada').map((f) => f.atleta_id ?? f.clube_id))
    return { fil, sem: todos.filter((x) => !com.has(x.id)) }
  }, [tipo, ano])

  const termo = busca.trim().toLowerCase()
  const linhas = (dados.data?.fil ?? []).filter((f) => (!status || f.status === status) && (!termo || f.nome.toLowerCase().includes(termo)))
  const cont = (s: StatusFiliacao) => dados.data?.fil.filter((f) => f.status === s).length ?? 0

  async function cancelar(f: FiliacaoDetalhe) {
    if (!f.lancamento_id || !confirm(`Cancelar a filiação de ${f.nome} em ${ano}?`)) return
    const { error } = await supabase.rpc('cancelar_lancamento', { p_id: f.lancamento_id, p_motivo: 'Filiação cancelada' })
    if (error) setErro(msgErro(error)); else dados.reload(true)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi rotulo="Ativas" valor={cont('ativa')} cls="text-emerald-700" />
        <Kpi rotulo="Isentas" valor={cont('isenta')} cls="text-sky-700" />
        <Kpi rotulo="Aguardando pagamento" valor={cont('pendente')} cls="text-amber-700" />
        <Kpi rotulo={tipo === 'atleta' ? 'Atletas ativos sem filiação' : 'Academias sem filiação'} valor={dados.data?.sem.length ?? 0} cls="text-slate-700" />
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <Campo label="Situação">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as StatusFiliacao | '')}>
            <option value="">Todas</option>
            {Object.entries(STATUS_FIL).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </select>
        </Campo>
        <div className="flex-1 min-w-40"><Campo label="Buscar"><input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} /></Campo></div>
        {isAdmin && <button className="btn-primary" onClick={() => setNova(true)}>+ Nova filiação</button>}
      </div>

      <Erro msg={erro ?? dados.error} />
      {dados.loading ? <Spinner /> : !linhas.length ? <div className="card"><Vazio>Nenhuma filiação em {ano}.</Vazio></div> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr>
              <th>Nº</th><th>{tipo === 'atleta' ? 'Atleta' : 'Academia'}</th>
              {tipo === 'atleta' && <th className="hidden md:table-cell">Academia</th>}
              <th className="hidden sm:table-cell">Anuidade</th><th className="text-right">Valor</th><th>Situação</th><th></th>
            </tr></thead>
            <tbody>
              {linhas.map((f) => (
                <tr key={f.id} className={f.status === 'cancelada' ? 'opacity-50' : ''}>
                  <td className="font-mono text-xs text-slate-500">{f.numero ?? '—'}</td>
                  <td className="font-medium">
                    {f.atleta_id ? <Link to={`/atletas/${f.atleta_id}`} className="hover:underline">{f.nome}</Link> : f.nome}
                  </td>
                  {tipo === 'atleta' && <td className="hidden md:table-cell text-slate-500">{f.atleta_clube_nome ?? '—'}</td>}
                  <td className="hidden sm:table-cell text-slate-500">{f.anuidade_nome}</td>
                  <td className="text-right tabular-nums">{f.valor_devido != null ? moeda(f.valor_devido) : '—'}</td>
                  <td className="whitespace-nowrap">
                    <span className={`badge ${STATUS_FIL[f.status].cls}`}>{STATUS_FIL[f.status].rotulo}</span>
                    {f.status === 'pendente' && f.vencimento && <div className="text-xs text-slate-500">vence {formatarData(f.vencimento)}</div>}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {f.lancamento_id && <button className="btn-ghost btn-sm" onClick={() => setLanc(f.lancamento_id)}>{isAdmin && f.status === 'pendente' ? 'Receber' : 'Cobrança'}</button>}
                    {isAdmin && f.status === 'pendente' && <button className="btn-danger btn-sm ml-1" onClick={() => cancelar(f)}>Cancelar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nova && <NovaFiliacao tipo={tipo} ano={ano} sem={dados.data?.sem ?? []} onFechar={() => setNova(false)}
        onSalvo={() => { setNova(false); dados.reload(true) }} />}
      {lanc && <LancamentoModal id={lanc} onFechar={() => setLanc(null)} onMudou={() => dados.reload(true)} />}
    </div>
  )
}

function Kpi({ rotulo, valor, cls }: { rotulo: string; valor: React.ReactNode; cls?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className={`text-2xl font-extrabold tabular-nums ${cls ?? ''}`}>{valor}</div>
    </div>
  )
}

function NovaFiliacao({ tipo, ano, sem, onFechar, onSalvo }: {
  tipo: TipoFiliacao; ano: number; sem: { id: string; nome: string }[]; onFechar: () => void; onSalvo: () => void
}) {
  const [anuidade, setAnuidade] = useState('')
  const [atleta, setAtleta] = useState<Atleta | null>(null)
  const [clubeId, setClubeId] = useState('')
  const [lote, setLote] = useState(false)
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const anuidades = useAsync(async () =>
    ok(await supabase.from('anuidades').select('*').eq('ano', ano).eq('tipo', tipo).eq('ativa', true).order('nome')) as Anuidade[], [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (lote && !confirm(`Gerar a cobrança da anuidade para ${tipo === 'academia' ? 'todas as academias ativas' : sem.length + ' atletas'} sem filiação em ${ano}?`)) return
    setErro(null); setOcupado(true)
    const res = lote
      ? await supabase.rpc('gerar_filiacoes_lote', { p_anuidade: anuidade, p_ids: tipo === 'academia' ? null : sem.map((s) => s.id) })
      : await supabase.rpc('gerar_filiacao', {
          p_anuidade: anuidade, p_atleta: tipo === 'atleta' ? atleta?.id ?? null : null,
          p_clube: tipo === 'academia' ? clubeId || null : null, p_observacoes: obs || null,
        })
    setOcupado(false)
    if (res.error) setErro(msgErro(res.error))
    else {
      if (lote) alert(`${res.data} filiação(ões) gerada(s).`)
      onSalvo()
    }
  }

  return (
    <Modal aberto titulo={`Nova filiação ${tipo === 'atleta' ? 'de atleta' : 'de academia'} · ${ano}`} onFechar={onFechar}>
      {anuidades.loading ? <Spinner /> : !anuidades.data?.length ? (
        <Vazio>Cadastre antes o valor da anuidade de {ano} ({tipo === 'atleta' ? 'atleta' : 'academia'}) na aba Anuidades.</Vazio>
      ) : (
        <form onSubmit={salvar} className="space-y-3">
          <Campo label="Anuidade">
            <select className="input" required value={anuidade} onChange={(e) => setAnuidade(e.target.value)}>
              <option value="">Selecione…</option>
              {anuidades.data.map((a) => <option key={a.id} value={a.id}>{a.nome} · {moeda(a.valor)}</option>)}
            </select>
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={lote} onChange={(e) => setLote(e.target.checked)} />
            Gerar para {tipo === 'atleta' ? 'todos os atletas ativos' : 'todas as academias ativas'} sem filiação ({sem.length})
          </label>
          {!lote && (tipo === 'atleta' ? (atleta
            ? <div className="flex items-center gap-2 text-sm"><b>{atleta.nome}</b><button type="button" className="link" onClick={() => setAtleta(null)}>trocar</button></div>
            : <AtletaBusca onEscolher={setAtleta} />
          ) : (
            <select className="input" required value={clubeId} onChange={(e) => setClubeId(e.target.value)}>
              <option value="">Selecione a academia…</option>
              {sem.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          ))}
          {!lote && <Campo label="Observações"><input className="input" value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>}
          <p className="text-xs text-slate-500">A cobrança da anuidade é criada no Financeiro. A filiação fica ativa quando for dada a baixa (ou isenção).</p>
          <Erro msg={erro} />
          <button className="btn-primary w-full" disabled={ocupado || !anuidade || (!lote && tipo === 'atleta' && !atleta)}>
            {ocupado ? 'Gerando…' : lote ? 'Gerar em lote' : 'Gerar filiação'}
          </button>
        </form>
      )}
    </Modal>
  )
}

function Anuidades({ ano }: { ano: number }) {
  const [editando, setEditando] = useState<Partial<Anuidade> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const lista = useAsync(async () => ok(await supabase.from('anuidades').select('*').eq('ano', ano).order('tipo').order('nome')) as Anuidade[], [ano])
  const f = editando ?? {}
  const set = (k: keyof Anuidade, v: unknown) => setEditando({ ...f, [k]: v })

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const { id, ...d } = editando!
    const dados = { ...d, valor: lerValor(String(d.valor ?? '0')), vencimento: d.vencimento || null }
    const res = id ? await supabase.from('anuidades').update(dados).eq('id', id) : await supabase.from('anuidades').insert(dados)
    if (res.error) setErro(res.error.code === '23505' ? 'Já existe uma anuidade com este nome neste ano.' : msgErro(res.error))
    else { setEditando(null); lista.reload(true) }
  }

  async function copiarAnoAnterior() {
    const ant = ok(await supabase.from('anuidades').select('*').eq('ano', ano - 1)) as Anuidade[]
    if (!ant.length) { setErro(`Não há anuidades em ${ano - 1}.`); return }
    const { error } = await supabase.from('anuidades').insert(ant.map((a) => ({
      ano, tipo: a.tipo, nome: a.nome, valor: a.valor, ativa: true,
      vencimento: a.vencimento ? `${ano}${a.vencimento.slice(4)}` : null,
    })))
    if (error) setErro(msgErro(error)); else lista.reload(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 max-w-xl">Valores da anuidade de {ano}. Pode haver mais de um valor por tipo (ex.: adulto e infantojuvenil). Valor zero gera filiação já isenta.</p>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={copiarAnoAnterior}>Copiar de {ano - 1}</button>
          <button className="btn-primary" onClick={() => { setErro(null); setEditando({ ano, tipo: 'atleta', ativa: true }) }}>+ Nova anuidade</button>
        </div>
      </div>
      <Erro msg={erro} />
      {lista.loading ? <Spinner /> : !lista.data?.length ? <div className="card"><Vazio>Nenhuma anuidade em {ano}.</Vazio></div> : (
        <div className="card divide-y divide-slate-100">
          {lista.data.map((a) => (
            <div key={a.id} className={`flex items-center gap-3 px-4 py-3 ${a.ativa ? '' : 'opacity-50'}`}>
              <span className="badge bg-slate-100 text-slate-600">{a.tipo === 'atleta' ? 'Atleta' : 'Academia'}</span>
              <div className="flex-1">
                <div className="font-semibold">{a.nome}</div>
                <div className="text-xs text-slate-500">{a.vencimento ? `Vencimento ${formatarData(a.vencimento)}` : 'Sem vencimento fixo (10 dias após gerar)'}</div>
              </div>
              <span className="font-bold tabular-nums">{moeda(a.valor)}</span>
              <button className="btn-ghost btn-sm" onClick={() => { setErro(null); setEditando(a) }}>Editar</button>
            </div>
          ))}
        </div>
      )}
      <Modal aberto={!!editando} titulo={f.id ? 'Editar anuidade' : `Nova anuidade · ${ano}`} onFechar={() => setEditando(null)}>
        <form onSubmit={salvar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Tipo">
              <select className="input" value={f.tipo} disabled={!!f.id} onChange={(e) => set('tipo', e.target.value)}>
                <option value="atleta">Atleta</option><option value="academia">Academia</option>
              </select>
            </Campo>
            <Campo label="Nome"><input className="input" required value={f.nome ?? ''} onChange={(e) => set('nome', e.target.value)} placeholder="Ex.: Atleta adulto" /></Campo>
            <Campo label="Valor (R$)"><input className="input" required inputMode="decimal" value={f.valor ?? ''} onChange={(e) => set('valor', e.target.value)} /></Campo>
            <Campo label="Vencimento"><input type="date" className="input" value={f.vencimento ?? ''} onChange={(e) => set('vencimento', e.target.value)} /></Campo>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.ativa ?? true} onChange={(e) => set('ativa', e.target.checked)} /> Ativa</label>
          <Erro msg={erro} />
          <button className="btn-primary w-full">Salvar</button>
        </form>
      </Modal>
    </div>
  )
}

