import { useEffect, useState } from 'react'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../lib/auth'
import { CATEGORIAS_LANC, FORMAS, STATUS_LANC, anoAtual, hoje, lerValor, moeda } from '../../lib/financeiro'
import { formatarData } from '../../lib/tenis'
import type { Atleta, CategoriaLancamento, Clube, Configuracoes, LancamentoDetalhe, SaldoCredito, StatusLancamento, Voucher } from '../../lib/types'
import { Aviso, Campo, Erro, Modal, Spinner, Tabs, Vazio } from '../../components/ui'
import AtletaBusca from '../../components/AtletaBusca'
import LancamentoModal from './LancamentoModal'

type Aba = 'receber' | 'pagar' | 'creditos' | 'vouchers' | 'config'

export default function PainelFinanceiro() {
  const { isAdmin } = useAuth()
  const [aba, setAba] = useState<Aba>('receber')
  return (
    <div>
      <h2 className="text-xl font-bold mb-3">Financeiro</h2>
      <Tabs<Aba> valor={aba} onChange={setAba} itens={[
        { valor: 'receber', rotulo: 'Recebimentos' },
        ...(isAdmin ? [{ valor: 'pagar' as Aba, rotulo: 'Pagamentos' }] : []),
        { valor: 'creditos', rotulo: 'Créditos' },
        { valor: 'vouchers', rotulo: 'Vouchers' },
        ...(isAdmin ? [{ valor: 'config' as Aba, rotulo: 'Configurações' }] : []),
      ]} />
      <div className="mt-4">
        {(aba === 'receber' || aba === 'pagar') && <Lancamentos key={aba} natureza={aba} />}
        {aba === 'creditos' && <Creditos />}
        {aba === 'vouchers' && <Vouchers />}
        {aba === 'config' && <Config />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Recebimentos / Pagamentos
// ---------------------------------------------------------------------
function Lancamentos({ natureza }: { natureza: 'receber' | 'pagar' }) {
  const { isAdmin, perfil } = useAuth()
  const [status, setStatus] = useState<StatusLancamento | 'todos' | 'vencidos'>('aberto')
  const [categoria, setCategoria] = useState<CategoriaLancamento | ''>('')
  const [ano, setAno] = useState(anoAtual())
  const [busca, setBusca] = useState('')
  // Federação: 'federacao' = o que a FPET recebe; 'clubes' = recebido pelos clubes; '' = tudo
  // Clube: 'meu' = o que meu clube recebe; 'devo' = o que meu clube deve à federação
  const [escopo, setEscopo] = useState(isAdmin ? 'federacao' : 'meu')
  const [aberto, setAberto] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)

  const lista = useAsync(async () => {
    let q = supabase.from('fin_lancamentos_detalhe').select('*').eq('natureza', natureza)
      .gte('criado_em', `${ano}-01-01`).lt('criado_em', `${ano + 1}-01-01`)
      .order('vencimento', { ascending: true, nullsFirst: false }).limit(1000)
    if (status === 'vencidos') q = q.eq('status', 'aberto').lt('vencimento', hoje())
    else if (status !== 'todos') q = q.eq('status', status)
    if (categoria) q = q.eq('categoria', categoria)
    if (escopo === 'federacao') q = q.is('recebedor_clube_id', null)
    if (escopo === 'clubes') q = q.not('recebedor_clube_id', 'is', null)
    if (escopo === 'meu') q = q.eq('recebedor_clube_id', perfil!.clube_id!)
    if (escopo === 'devo') q = q.is('recebedor_clube_id', null).eq('clube_id', perfil!.clube_id!)
    return ok(await q) as LancamentoDetalhe[]
  }, [natureza, status, categoria, ano, escopo])

  const termo = busca.trim().toLowerCase()
  const linhas = (lista.data ?? []).filter((l) => !termo || `${l.descricao} ${l.pessoa ?? ''}`.toLowerCase().includes(termo))
  const total = linhas.reduce((s, l) => s + Number(l.status === 'pago' ? (l.valor_pago ?? 0) + l.credito_usado : l.status === 'aberto' ? l.valor_devido : 0), 0)

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <Campo label="Situação">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="aberto">Em aberto</option>
            <option value="vencidos">Vencidos</option>
            <option value="pago">Pagos</option>
            <option value="isento">Isentos</option>
            <option value="cancelado">Cancelados</option>
            <option value="todos">Todos</option>
          </select>
        </Campo>
        {natureza === 'receber' && (
          <Campo label={isAdmin ? 'Recebedor' : 'Visão'}>
            <select className="input" value={escopo} onChange={(e) => setEscopo(e.target.value)}>
              {isAdmin ? <>
                <option value="federacao">Federação</option>
                <option value="clubes">Clubes (inscrições)</option>
                <option value="">Todos</option>
              </> : <>
                <option value="meu">O que meu clube recebe</option>
                <option value="devo">O que meu clube deve à federação</option>
              </>}
            </select>
          </Campo>
        )}
        <Campo label="Categoria">
          <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaLancamento | '')}>
            <option value="">Todas</option>
            {Object.entries(CATEGORIAS_LANC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo label="Ano">
          <input type="number" className="input w-24" value={ano} onChange={(e) => setAno(Number(e.target.value) || anoAtual())} />
        </Campo>
        <div className="flex-1 min-w-40"><Campo label="Buscar"><input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou descrição" /></Campo></div>
        {(isAdmin || natureza === 'receber') && escopo !== 'devo' && (
          <button className="btn-primary" onClick={() => setNovo(true)}>+ Novo lançamento</button>
        )}
      </div>

      <Erro msg={lista.error} />
      {lista.loading ? <Spinner /> : !linhas.length ? <div className="card"><Vazio>Nenhum lançamento.</Vazio></div> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr>
              <th>Vencimento</th><th>Descrição</th><th className="hidden md:table-cell">{natureza === 'receber' ? 'Pagador' : 'Favorecido'}</th>
              {isAdmin && escopo !== 'federacao' && natureza === 'receber' && <th className="hidden md:table-cell">Recebedor</th>}
              <th className="text-right">Valor</th><th>Situação</th>
            </tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setAberto(l.id)}>
                  <td className={`whitespace-nowrap ${l.vencido ? 'text-red-700 font-semibold' : ''}`}>{formatarData(l.vencimento) || '—'}</td>
                  <td><div className="font-medium">{l.descricao}</div><div className="text-xs text-slate-500">{CATEGORIAS_LANC[l.categoria]}</div></td>
                  <td className="hidden md:table-cell text-slate-600">{l.pessoa ?? '—'}</td>
                  {isAdmin && escopo !== 'federacao' && natureza === 'receber' && <td className="hidden md:table-cell text-slate-600">{l.recebedor_nome ?? 'Federação'}</td>}
                  <td className="text-right tabular-nums whitespace-nowrap">
                    {l.status === 'pago' ? moeda(Number(l.valor_pago ?? 0) + Number(l.credito_usado)) : moeda(l.valor_devido)}
                    {l.desconto > 0 && <div className="text-xs text-slate-400 line-through">{moeda(l.valor)}</div>}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className={`badge ${STATUS_LANC[l.status].cls}`}>{STATUS_LANC[l.status].rotulo}</span>
                    {l.status === 'pago' && l.forma_pagamento && <div className="text-xs text-slate-500">{FORMAS[l.forma_pagamento]} · {formatarData(l.data_pagamento, { day: '2-digit', month: '2-digit' })}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={6} className="text-right font-semibold">{linhas.length} lançamento(s) · Total {moeda(total)}</td></tr></tfoot>
          </table>
        </div>
      )}
      {aberto && <LancamentoModal id={aberto} onFechar={() => setAberto(null)} onMudou={() => lista.reload(true)} />}
      {novo && <NovoLancamento natureza={natureza} onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); lista.reload(true) }} />}
    </div>
  )
}

function NovoLancamento({ natureza, onFechar, onSalvo }: { natureza: 'receber' | 'pagar'; onFechar: () => void; onSalvo: () => void }) {
  const { isAdmin, perfil, session } = useAuth()
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<CategoriaLancamento>(natureza === 'receber' ? 'outros' : 'administrativo')
  const [valor, setValor] = useState('')
  const [venc, setVenc] = useState(hoje())
  const [tipoPessoa, setTipoPessoa] = useState<'atleta' | 'academia' | 'livre'>(natureza === 'receber' ? 'atleta' : 'livre')
  const [atleta, setAtleta] = useState<Atleta | null>(null)
  const [clubeId, setClubeId] = useState('')
  const [favorecido, setFavorecido] = useState('')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const clubes = useAsync(async () => ok(await supabase.from('clubes').select('id,nome').order('nome')) as Clube[], [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (tipoPessoa === 'atleta' && !atleta) { setErro('Escolha o atleta.'); return }
    const { error } = await supabase.from('fin_lancamentos').insert({
      natureza, categoria, descricao, valor: lerValor(valor), vencimento: venc || null, observacoes: obs || null,
      recebedor_clube_id: isAdmin ? null : perfil!.clube_id,
      atleta_id: tipoPessoa === 'atleta' ? atleta!.id : null,
      clube_id: tipoPessoa === 'academia' ? clubeId || null : null,
      favorecido: tipoPessoa === 'livre' ? favorecido || null : null,
      criado_por: session?.user.id,
    })
    if (error) setErro(msgErro(error)); else onSalvo()
  }

  return (
    <Modal aberto titulo={natureza === 'receber' ? 'Nova cobrança' : 'Nova conta a pagar'} onFechar={onFechar} largo>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo label="Descrição"><input className="input" required value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Campo>
          <Campo label="Categoria">
            <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaLancamento)}>
              {Object.entries(CATEGORIAS_LANC).filter(([k]) => !k.startsWith('filiacao_')).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <Campo label="Valor (R$)"><input className="input" required inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" /></Campo>
          <Campo label="Vencimento"><input type="date" className="input" value={venc} onChange={(e) => setVenc(e.target.value)} /></Campo>
        </div>
        <div>
          <div className="label">{natureza === 'receber' ? 'Quem paga' : 'A quem pagar'}</div>
          <div className="flex gap-4 text-sm mb-2">
            {(['atleta', 'academia', 'livre'] as const).map((t) => (
              <label key={t} className="flex items-center gap-1">
                <input type="radio" checked={tipoPessoa === t} onChange={() => setTipoPessoa(t)} />
                {{ atleta: 'Atleta', academia: 'Academia', livre: 'Outro (nome livre)' }[t]}
              </label>
            ))}
          </div>
          {tipoPessoa === 'atleta' && (atleta
            ? <div className="flex items-center gap-2 text-sm"><b>{atleta.nome}</b><button type="button" className="link" onClick={() => setAtleta(null)}>trocar</button></div>
            : <AtletaBusca onEscolher={setAtleta} />)}
          {tipoPessoa === 'academia' && (
            <select className="input" required value={clubeId} onChange={(e) => setClubeId(e.target.value)}>
              <option value="">Selecione…</option>
              {clubes.data?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
          {tipoPessoa === 'livre' && <input className="input" value={favorecido} onChange={(e) => setFavorecido(e.target.value)} placeholder="Nome / empresa" />}
        </div>
        <Campo label="Observações"><textarea className="input" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
        <Erro msg={erro} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Créditos
// ---------------------------------------------------------------------
function Creditos() {
  const { isAdmin, perfil } = useAuth()
  const [novo, setNovo] = useState(false)
  const lista = useAsync(async () => {
    let q = supabase.from('fin_saldos_credito').select('*').order('nome')
    q = isAdmin ? q.is('emissor_clube_id', null) : q.eq('emissor_clube_id', perfil!.clube_id!)
    return (ok(await q) as SaldoCredito[]).filter((s) => Number(s.saldo) !== 0)
  }, [isAdmin])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 max-w-2xl">
          Crédito nasce de pagamento a maior, de inscrição paga e depois removida, ou de lançamento manual (bônus, devolução).
          Ele é abatido na baixa da próxima cobrança.
        </p>
        <button className="btn-primary" onClick={() => setNovo(true)}>+ Lançar crédito</button>
      </div>
      <Erro msg={lista.error} />
      {lista.loading ? <Spinner /> : !lista.data?.length ? <div className="card"><Vazio>Ninguém com saldo de crédito.</Vazio></div> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Titular</th><th>Tipo</th><th>Último movimento</th><th className="text-right">Saldo</th></tr></thead>
            <tbody>
              {lista.data.map((s) => (
                <tr key={`${s.atleta_id ?? s.clube_id}`}>
                  <td className="font-medium">{s.nome}</td>
                  <td className="text-slate-500">{s.atleta_id ? 'Atleta' : 'Academia'}</td>
                  <td className="text-slate-500">{formatarData(s.ultimo_movimento)}</td>
                  <td className={`text-right tabular-nums font-semibold ${s.saldo < 0 ? 'text-red-700' : ''}`}>{moeda(s.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {novo && <NovoCredito onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); lista.reload(true) }} />}
    </div>
  )
}

function NovoCredito({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [tipo, setTipo] = useState<'atleta' | 'academia'>('atleta')
  const [atleta, setAtleta] = useState<Atleta | null>(null)
  const [clubeId, setClubeId] = useState('')
  const [valor, setValor] = useState('')
  const [debito, setDebito] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const clubes = useAsync(async () => ok(await supabase.from('clubes').select('id,nome').order('nome')) as Clube[], [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const v = lerValor(valor)
    const { error } = await supabase.rpc('lancar_credito', {
      p_atleta: tipo === 'atleta' ? atleta?.id ?? null : null, p_clube: tipo === 'academia' ? clubeId || null : null,
      p_valor: debito ? -v : v, p_descricao: descricao,
    })
    if (error) setErro(msgErro(error)); else onSalvo()
  }

  return (
    <Modal aberto titulo="Lançar crédito" onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-3">
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1"><input type="radio" checked={tipo === 'atleta'} onChange={() => setTipo('atleta')} /> Atleta</label>
          <label className="flex items-center gap-1"><input type="radio" checked={tipo === 'academia'} onChange={() => setTipo('academia')} /> Academia</label>
        </div>
        {tipo === 'atleta' ? (atleta
          ? <div className="flex items-center gap-2 text-sm"><b>{atleta.nome}</b><button type="button" className="link" onClick={() => setAtleta(null)}>trocar</button></div>
          : <AtletaBusca onEscolher={setAtleta} />
        ) : (
          <select className="input" required value={clubeId} onChange={(e) => setClubeId(e.target.value)}>
            <option value="">Selecione…</option>
            {clubes.data?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Valor (R$)"><input className="input" required inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
          <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={debito} onChange={(e) => setDebito(e.target.checked)} /> Retirar crédito (débito)</label>
        </div>
        <Campo label="Motivo"><input className="input" required value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: devolução, bônus de campanha" /></Campo>
        <Erro msg={erro} />
        <button className="btn-primary w-full">Salvar</button>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Vouchers
// ---------------------------------------------------------------------
function Vouchers() {
  const { isAdmin, perfil } = useAuth()
  const [editando, setEditando] = useState<Partial<Voucher> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const lista = useAsync(async () => {
    let q = supabase.from('fin_vouchers').select('*').order('criado_em', { ascending: false })
    q = isAdmin ? q.is('emissor_clube_id', null) : q.eq('emissor_clube_id', perfil!.clube_id!)
    return ok(await q) as Voucher[]
  }, [isAdmin])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const { id, usos: _u, ...d } = editando!
    void _u
    const dados = { ...d, codigo: (d.codigo ?? '').trim().toUpperCase(), valor: lerValor(String(d.valor ?? '')), emissor_clube_id: isAdmin ? null : perfil!.clube_id,
      categorias: d.categorias?.length ? d.categorias : null }
    const res = id ? await supabase.from('fin_vouchers').update(dados).eq('id', id) : await supabase.from('fin_vouchers').insert(dados)
    if (res.error) setErro(res.error.code === '23505' ? 'Já existe um voucher com este código.' : msgErro(res.error))
    else { setEditando(null); lista.reload(true) }
  }
  const f = editando ?? {}
  const set = (k: keyof Voucher, v: unknown) => setEditando({ ...f, [k]: v })
  const cats = (isAdmin ? Object.keys(CATEGORIAS_LANC) : ['inscricao_torneio']) as CategoriaLancamento[]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 max-w-2xl">Cupons de desconto aplicados na cobrança (percentual ou valor fixo). Um voucher de 100% já dá baixa automaticamente.</p>
        <button className="btn-primary" onClick={() => { setErro(null); setEditando({ tipo: 'percentual', ativo: true }) }}>+ Novo voucher</button>
      </div>
      {lista.loading ? <Spinner /> : !lista.data?.length ? <div className="card"><Vazio>Nenhum voucher.</Vazio></div> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Código</th><th>Desconto</th><th className="hidden sm:table-cell">Vale para</th><th>Usos</th><th>Validade</th><th></th></tr></thead>
            <tbody>
              {lista.data.map((v) => (
                <tr key={v.id} className={v.ativo ? '' : 'opacity-50'}>
                  <td><div className="font-mono font-semibold">{v.codigo}</div><div className="text-xs text-slate-500">{v.descricao}</div></td>
                  <td>{v.tipo === 'percentual' ? `${Number(v.valor)}%` : moeda(v.valor)}</td>
                  <td className="hidden sm:table-cell text-xs text-slate-500">{v.categorias?.map((c) => CATEGORIAS_LANC[c]).join(', ') || 'Todas as cobranças'}</td>
                  <td className="tabular-nums">{v.usos}{v.usos_max ? ` / ${v.usos_max}` : ''}</td>
                  <td>{formatarData(v.validade) || '—'}</td>
                  <td className="text-right"><button className="btn-ghost btn-sm" onClick={() => { setErro(null); setEditando(v) }}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal aberto={!!editando} titulo={f.id ? 'Editar voucher' : 'Novo voucher'} onFechar={() => setEditando(null)}>
        <form onSubmit={salvar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Código"><input className="input font-mono" required minLength={3} value={f.codigo ?? ''} onChange={(e) => set('codigo', e.target.value.toUpperCase().replace(/\s/g, ''))} /></Campo>
            <Campo label="Tipo">
              <select className="input" value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
                <option value="percentual">Percentual (%)</option><option value="valor">Valor fixo (R$)</option>
              </select>
            </Campo>
            <Campo label={f.tipo === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)'}>
              <input className="input" required inputMode="decimal" value={f.valor ?? ''} onChange={(e) => set('valor', e.target.value)} />
            </Campo>
            <Campo label="Limite de usos" dica="Vazio = ilimitado"><input type="number" min={1} className="input" value={f.usos_max ?? ''} onChange={(e) => set('usos_max', e.target.value ? Number(e.target.value) : null)} /></Campo>
            <Campo label="Válido até"><input type="date" className="input" value={f.validade ?? ''} onChange={(e) => set('validade', e.target.value || null)} /></Campo>
            <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={f.ativo ?? true} onChange={(e) => set('ativo', e.target.checked)} /> Ativo</label>
          </div>
          <Campo label="Descrição"><input className="input" value={f.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} placeholder="Ex.: Campanha de filiação 2027" /></Campo>
          <div>
            <div className="label">Vale para (nenhum marcado = todas)</div>
            <div className="grid sm:grid-cols-2 gap-1 text-sm">
              {cats.map((c) => (
                <label key={c} className="flex items-center gap-2">
                  <input type="checkbox" checked={f.categorias?.includes(c) ?? false}
                    onChange={(e) => set('categorias', e.target.checked ? [...(f.categorias ?? []), c] : (f.categorias ?? []).filter((x) => x !== c))} />
                  {CATEGORIAS_LANC[c]}
                </label>
              ))}
            </div>
          </div>
          <Erro msg={erro} />
          <button className="btn-primary w-full">Salvar</button>
        </form>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------
// Configurações financeiras (federação)
// ---------------------------------------------------------------------
function Config() {
  const [f, setF] = useState<Configuracoes | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const dados = useAsync(async () => ok(await supabase.from('configuracoes').select('*').eq('id', 1).single()) as Configuracoes, [])
  useEffect(() => { if (dados.data) setF(dados.data) }, [dados.data])
  if (!f) return <Spinner />

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null); setErro(null)
    const { error } = await supabase.from('configuracoes').update({
      exigir_filiacao_inscricao: f!.exigir_filiacao_inscricao,
      taxa_federacao_inscricao: lerValor(String(f!.taxa_federacao_inscricao)),
      instrucoes_pagamento: f!.instrucoes_pagamento || null,
      atualizado_em: new Date().toISOString(),
    }).eq('id', 1)
    if (error) setErro(msgErro(error)); else setMsg('Configurações salvas.')
  }

  return (
    <div className="space-y-4">
      <form onSubmit={salvar} className="card p-5 space-y-4">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={f.exigir_filiacao_inscricao} onChange={(e) => setF({ ...f, exigir_filiacao_inscricao: e.target.checked })} />
          <span><b>Exigir filiação ativa para inscrição em torneio.</b><br />
            <span className="text-slate-500">O sistema bloqueia a inscrição de atleta sem anuidade paga (ou isenta) no ano do torneio.</span></span>
        </label>
        <Campo label="Taxa federativa por inscrição (R$)" dica="Cobrada do clube organizador ao gerar a taxa do torneio (Área ADM ou aba Encerramento).">
          <input className="input max-w-40" inputMode="decimal" value={String(f.taxa_federacao_inscricao).replace('.', ',')}
            onChange={(e) => setF({ ...f, taxa_federacao_inscricao: e.target.value as unknown as number })} />
        </Campo>
        <Campo label="Instruções de pagamento" dica="Chave PIX, dados bancários… Exibidas enquanto não há cobrança automática.">
          <textarea className="input" rows={3} value={f.instrucoes_pagamento ?? ''} onChange={(e) => setF({ ...f, instrucoes_pagamento: e.target.value })} />
        </Campo>
        <Erro msg={erro} />
        {msg && <div className="text-sm text-emerald-700">{msg}</div>}
        <button className="btn-primary">Salvar</button>
      </form>

      <div className="card p-5 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="font-bold">Pagamento online (PIX / Boleto)</h3>
          <span className="badge bg-slate-100 text-slate-600">Em breve</span>
        </div>
        <p className="text-sm text-slate-500">
          Aqui será configurada a conta (provedor, chave PIX, emissão de boleto) para gerar as cobranças automaticamente
          e dar baixa sozinho quando o pagamento cair. Até lá, as baixas são feitas manualmente nos Recebimentos.
        </p>
        <Aviso>Estrutura já preparada: cada cobrança tem campos reservados para o identificador e o link do PIX/boleto.</Aviso>
      </div>
    </div>
  )
}
