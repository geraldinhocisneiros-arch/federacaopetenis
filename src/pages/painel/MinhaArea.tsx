import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../lib/auth'
import { STATUS_FIL, STATUS_LANC, moeda } from '../../lib/financeiro'
import { formatarData, periodo } from '../../lib/tenis'
import type { Atleta, AtletaContato, Clube, LancamentoDetalhe, SolicitacaoAtleta, StatusFiliacao } from '../../lib/types'
import { Aviso, Avatar, Campo, Erro, Spinner, Tabs, Vazio } from '../../components/ui'
import EstatisticasAtleta from '../../components/EstatisticasAtleta'
import EnviarArquivo from '../../components/EnviarArquivo'

type Aba = 'estatisticas' | 'dados' | 'cobrancas' | 'eventos'

/** Área de quem joga: vínculo com o cadastro de atleta, estatísticas, cobranças e eventos */
export default function MinhaArea() {
  const { perfil, isAtleta } = useAuth()
  const [aba, setAba] = useState<Aba>(isAtleta ? 'estatisticas' : 'cobrancas')
  const atleta = useAsync(async () => perfil?.atleta_id
    ? ok(await supabase.from('atletas').select('*, clubes(nome)').eq('id', perfil.atleta_id).single()) as Atleta & { clubes: { nome: string } | null }
    : null, [perfil?.atleta_id])

  return (
    <div className="space-y-4">
      {!isAtleta ? <Vincular /> : atleta.data && (
        <div className="card p-4 flex flex-wrap items-center gap-4">
          <Avatar nome={atleta.data.nome} url={atleta.data.foto_url} tamanho={56} />
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold">{atleta.data.nome}</div>
            <div className="text-sm text-slate-500">{atleta.data.clubes?.nome ?? 'Sem academia'}</div>
          </div>
          <Link to={`/atletas/${atleta.data.id}`} className="btn-ghost btn-sm">Meu perfil público ↗</Link>
        </div>
      )}

      <Tabs<Aba> valor={aba} onChange={setAba} itens={[
        ...(isAtleta ? [{ valor: 'estatisticas' as Aba, rotulo: 'Minhas estatísticas' }, { valor: 'dados' as Aba, rotulo: 'Meus dados' }] : []),
        { valor: 'cobrancas', rotulo: 'Filiação e cobranças' },
        { valor: 'eventos', rotulo: 'Meus eventos' },
      ]} />
      {aba === 'estatisticas' && perfil?.atleta_id && <EstatisticasAtleta atletaId={perfil.atleta_id} />}
      {aba === 'dados' && atleta.data && <MeusDados a={atleta.data} onSalvo={() => atleta.reload(true)} />}
      {aba === 'cobrancas' && <Cobrancas />}
      {aba === 'eventos' && <MeusEventos />}
    </div>
  )
}

function Vincular() {
  const { perfil, session, recarregarPerfil } = useAuth()
  const [f, setF] = useState({ nome: perfil?.nome ?? '', cpf: '', nasc: '', sexo: '', tel: '', clube: '' })
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const dados = useAsync(async () => {
    const [s, c] = await Promise.all([
      supabase.from('solicitacoes_atleta').select('*').eq('perfil_id', session!.user.id).order('criado_em', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('clubes').select('id,nome').eq('ativo', true).order('nome'),
    ])
    return { sol: s.data as SolicitacaoAtleta | null, clubes: ok(c) as Clube[] }
  }, [])
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null); setOcupado(true)
    const { data, error } = await supabase.rpc('solicitar_vinculo_atleta', {
      p_nome: f.nome, p_cpf: f.cpf, p_data_nascimento: f.nasc, p_sexo: f.sexo || null, p_telefone: f.tel || null, p_clube: f.clube || null,
    })
    setOcupado(false)
    if (error) { setErro(msgErro(error)); return }
    if (data === 'vinculado') await recarregarPerfil()
    else dados.reload(true)
  }

  if (dados.loading) return <Spinner />
  const sol = dados.data?.sol
  if (sol?.status === 'pendente') {
    return <Aviso>Recebemos seu pedido de acesso como atleta ({sol.nome}). A federação vai conferir os dados e liberar. Enquanto isso, você já pode se inscrever em cursos e eventos.</Aviso>
  }
  return (
    <form onSubmit={enviar} className="card p-5 space-y-4">
      <div>
        <h3 className="font-bold">Você é atleta? Acesse seus resultados e estatísticas</h3>
        <p className="text-sm text-slate-500">Se o seu CPF e a data de nascimento já estiverem no cadastro da federação, o acesso é liberado na hora. Senão, a FPET confere e libera.</p>
      </div>
      {sol?.status === 'recusada' && <Aviso>Seu pedido anterior não foi aprovado{sol.motivo ? `: ${sol.motivo}` : ''}. Confira os dados e envie de novo.</Aviso>}
      <div className="grid sm:grid-cols-2 gap-4">
        <Campo label="Nome completo"><input className="input" required value={f.nome} onChange={(e) => set('nome', e.target.value)} /></Campo>
        <Campo label="CPF"><input className="input" required inputMode="numeric" value={f.cpf} onChange={(e) => set('cpf', e.target.value)} placeholder="000.000.000-00" /></Campo>
        <Campo label="Data de nascimento"><input type="date" className="input" required value={f.nasc} onChange={(e) => set('nasc', e.target.value)} /></Campo>
        <Campo label="Sexo">
          <select className="input" value={f.sexo} onChange={(e) => set('sexo', e.target.value)}>
            <option value="">—</option><option value="M">Masculino</option><option value="F">Feminino</option>
          </select>
        </Campo>
        <Campo label="WhatsApp"><input className="input" value={f.tel} onChange={(e) => set('tel', e.target.value)} /></Campo>
        <Campo label="Academia onde treina">
          <select className="input" value={f.clube} onChange={(e) => set('clube', e.target.value)}>
            <option value="">Nenhuma / não sei</option>
            {dados.data?.clubes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
      </div>
      <Erro msg={erro} />
      <button className="btn-primary" disabled={ocupado}>{ocupado ? 'Enviando…' : 'Solicitar acesso de atleta'}</button>
    </form>
  )
}

function MeusDados({ a, onSalvo }: { a: Atleta; onSalvo: () => void }) {
  const [f, setF] = useState({ apelido: a.apelido ?? '', cidade: a.cidade ?? '', foto: a.foto_url ?? '', tel: '', email: '' })
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('atletas_contato').select('*').eq('atleta_id', a.id).maybeSingle()
      .then(({ data }) => { const c = data as AtletaContato | null; if (c) setF((x) => ({ ...x, tel: c.telefone ?? '', email: c.email ?? '' })) })
  }, [a.id])
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null); setErro(null)
    const { error } = await supabase.rpc('atualizar_meus_dados', { p_apelido: f.apelido, p_cidade: f.cidade, p_foto_url: f.foto, p_telefone: f.tel, p_email: f.email })
    if (error) setErro(msgErro(error)); else { setMsg('Dados atualizados.'); onSalvo() }
  }
  return (
    <form onSubmit={salvar} className="card p-5 space-y-4 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <div><div className="label">Nome</div>{a.nome}</div>
        <div><div className="label">Nascimento</div>{formatarData(a.data_nascimento) || '—'}</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Campo label="Apelido"><input className="input" value={f.apelido} onChange={(e) => set('apelido', e.target.value)} /></Campo>
        <Campo label="Cidade"><input className="input" value={f.cidade} onChange={(e) => set('cidade', e.target.value)} /></Campo>
        <Campo label="WhatsApp"><input className="input" value={f.tel} onChange={(e) => set('tel', e.target.value)} /></Campo>
        <Campo label="E-mail de contato"><input type="email" className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></Campo>
        <div className="sm:col-span-2"><span className="label">Foto</span><EnviarArquivo pasta="atletas" redondo tamanhoMax={600} valor={f.foto} onChange={(u) => set('foto', u ?? '')} /></div>
      </div>
      <p className="text-xs text-slate-500">Nome, nascimento, CPF e academia só a federação ou a sua academia alteram.</p>
      <Erro msg={erro} />
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <button className="btn-primary">Salvar</button>
    </form>
  )
}

function Cobrancas() {
  const { perfil, session } = useAuth()
  const dados = useAsync(async () => {
    const filtros = [`perfil_id.eq.${session!.user.id}`]
    if (perfil?.atleta_id) filtros.push(`atleta_id.eq.${perfil.atleta_id}`)
    const [l, f, c] = await Promise.all([
      supabase.from('fin_lancamentos_detalhe').select('*').eq('natureza', 'receber').or(filtros.join(','))
        .neq('status', 'cancelado').order('vencimento', { ascending: false }),
      perfil?.atleta_id ? supabase.from('filiacoes').select('ano,numero,status').eq('atleta_id', perfil.atleta_id).order('ano', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.from('configuracoes').select('instrucoes_pagamento').eq('id', 1).single(),
    ])
    return {
      lanc: ok(l) as LancamentoDetalhe[],
      fil: (f.data ?? []) as { ano: number; numero: string | null; status: StatusFiliacao }[],
      instrucoes: (c.data as { instrucoes_pagamento: string | null } | null)?.instrucoes_pagamento,
    }
  }, [perfil?.atleta_id])
  if (dados.loading) return <Spinner />
  if (!dados.data) return <Erro msg={dados.error} />
  const { lanc, fil, instrucoes } = dados.data
  const abertos = lanc.filter((l) => l.status === 'aberto')

  return (
    <div className="space-y-4">
      {fil.length > 0 && (
        <div className="card p-4 flex flex-wrap gap-2 items-center">
          <span className="label mb-0">Filiação</span>
          {fil.map((f) => <span key={f.ano} className={`badge ${STATUS_FIL[f.status].cls}`}>{f.ano}: {STATUS_FIL[f.status].rotulo}{f.numero ? ` · nº ${f.numero}` : ''}</span>)}
        </div>
      )}
      {abertos.length > 0 && (
        <Aviso>
          <b>Em aberto: {moeda(abertos.reduce((s, l) => s + Number(l.valor_devido), 0))}.</b>
          {instrucoes ? <span className="block whitespace-pre-line mt-1">{instrucoes}</span> : ' Fale com quem organiza para pagar.'}
          <span className="block text-xs mt-1">Pagamento online por PIX/boleto em breve.</span>
        </Aviso>
      )}
      {!lanc.length ? <div className="card"><Vazio>Nenhuma cobrança.</Vazio></div> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Vencimento</th><th>Descrição</th><th className="hidden sm:table-cell">Recebedor</th><th className="text-right">Valor</th><th>Situação</th></tr></thead>
            <tbody>
              {lanc.map((l) => (
                <tr key={l.id}>
                  <td className={l.vencido ? 'text-red-700 font-semibold' : ''}>{formatarData(l.vencimento)}</td>
                  <td>{l.descricao}</td>
                  <td className="hidden sm:table-cell text-slate-500">{l.recebedor_nome ?? 'FPET'}</td>
                  <td className="text-right tabular-nums">{moeda(l.status === 'pago' ? Number(l.valor_pago) + Number(l.credito_usado) : l.valor_devido)}</td>
                  <td><span className={`badge ${STATUS_LANC[l.status].cls}`}>{STATUS_LANC[l.status].rotulo}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface MinhaInsc { id: string; status: string; eventos: { id: string; titulo: string; data_inicio: string; data_fim: string | null; local: string | null } }

function MeusEventos() {
  const { session } = useAuth()
  const lista = useAsync(async () => ok(await supabase.from('evento_inscricoes').select('id,status,eventos(id,titulo,data_inicio,data_fim,local)')
    .eq('perfil_id', session!.user.id).neq('status', 'cancelada').order('criado_em', { ascending: false })) as unknown as MinhaInsc[], [])
  if (lista.loading) return <Spinner />
  if (!lista.data?.length) return <div className="card"><Vazio>Você não está inscrito em nenhum evento. <Link to="/eventos" className="link">Ver cursos e eventos</Link></Vazio></div>
  return (
    <div className="card divide-y divide-slate-100">
      {lista.data.map((i) => (
        <Link key={i.id} to={`/eventos/${i.eventos.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
          <div><div className="font-semibold">{i.eventos.titulo}</div><div className="text-xs text-slate-500">{periodo(i.eventos.data_inicio, i.eventos.data_fim)}{i.eventos.local ? ` · ${i.eventos.local}` : ''}</div></div>
          <span className={`badge ${i.status === 'confirmada' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{i.status === 'confirmada' ? 'Confirmada' : 'Lista de espera'}</span>
        </Link>
      ))}
    </div>
  )
}
