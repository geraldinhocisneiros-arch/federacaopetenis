import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../lib/auth'
import { TIPOS_EVENTO, situacaoEvento } from '../../lib/eventos'
import { STATUS_LANC, lerValor, moeda } from '../../lib/financeiro'
import { periodo } from '../../lib/tenis'
import type { Clube, Evento, EventoInscricao, EventoLista, Lancamento } from '../../lib/types'
import { Campo, Erro, Modal, Spinner, Vazio } from '../../components/ui'
import LancamentoModal from './LancamentoModal'
import EnviarArquivo from '../../components/EnviarArquivo'

export default function PainelEventos() {
  const { isAdmin, perfil } = useAuth()
  const [editando, setEditando] = useState<Partial<Evento> | null>(null)
  const [inscritos, setInscritos] = useState<EventoLista | null>(null)
  const lista = useAsync(async () => {
    let q = supabase.from('eventos_lista').select('*').order('data_inicio', { ascending: false }).limit(200)
    if (!isAdmin) q = q.eq('clube_id', perfil!.clube_id!)
    return ok(await q) as EventoLista[]
  }, [isAdmin])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">Cursos e eventos</h2>
        <button className="btn-primary" onClick={() => setEditando({
          tipo: 'curso', status: 'publicado', inscricao_modo: 'sistema', cidade: 'Recife', valor: 0,
          clube_id: isAdmin ? null : perfil!.clube_id,
        })}>+ Novo evento</button>
      </div>
      <p className="text-sm text-slate-500 mb-4">Aparecem para todos em <Link to="/eventos" className="link">Cursos e eventos</Link>. {isAdmin ? 'A federação vê e edita os eventos de todas as academias.' : 'Você gerencia os eventos da sua academia.'}</p>
      {lista.loading ? <Spinner /> : !lista.data?.length ? <div className="card"><Vazio>Nenhum evento cadastrado.</Vazio></div> : (
        <div className="card divide-y divide-slate-100">
          {lista.data.map((e) => {
            const s = situacaoEvento(e)
            return (
              <div key={e.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${e.status === 'rascunho' ? 'opacity-60' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{e.titulo}</div>
                  <div className="text-xs text-slate-500">
                    {TIPOS_EVENTO[e.tipo]} · {periodo(e.data_inicio, e.data_fim)} · {e.organizador_nome}
                    {e.status === 'rascunho' ? ' · rascunho' : ''}
                  </div>
                </div>
                <span className={`badge ${s.cls}`}>{s.rotulo}</span>
                {e.inscricao_modo === 'sistema' && (
                  <button className="btn-ghost btn-sm" onClick={() => setInscritos(e)}>Inscritos ({e.inscritos}{e.vagas ? `/${e.vagas}` : ''})</button>
                )}
                <button className="btn-ghost btn-sm" onClick={() => setEditando(e)}>Editar</button>
              </div>
            )
          })}
        </div>
      )}
      {editando && <EventoForm ev={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); lista.reload(true) }} />}
      {inscritos && <Inscritos e={inscritos} onFechar={() => { setInscritos(null); lista.reload(true) }} />}
    </div>
  )
}

function EventoForm({ ev, onFechar, onSalvo }: { ev: Partial<Evento>; onFechar: () => void; onSalvo: () => void }) {
  const { isAdmin, session } = useAuth()
  const [f, setF] = useState<Partial<Evento>>(ev)
  const [erro, setErro] = useState<string | null>(null)
  const clubes = useAsync(async () => ok(await supabase.from('clubes').select('id,nome').eq('ativo', true).order('nome')) as Clube[], [])
  const set = (k: keyof Evento, v: unknown) => setF({ ...f, [k]: v })
  const txt = (k: keyof Evento) => ({ className: 'input', value: (f[k] as string) ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value || null) })

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const { id, ...d } = f as Evento & { organizador_nome?: string; inscritos?: number }
    delete d.organizador_nome; delete d.inscritos
    const dados = { ...d, valor: lerValor(String(d.valor ?? 0)), vagas: d.vagas ? Number(d.vagas) : null, ...(id ? {} : { criado_por: session?.user.id }) }
    const res = id ? await supabase.from('eventos').update(dados).eq('id', id) : await supabase.from('eventos').insert(dados)
    if (res.error) setErro(msgErro(res.error)); else onSalvo()
  }
  async function excluir() {
    if (!confirm('Excluir este evento e as inscrições?')) return
    const { error } = await supabase.from('eventos').delete().eq('id', f.id!)
    if (error) setErro(msgErro(error)); else onSalvo()
  }

  return (
    <Modal aberto titulo={f.id ? 'Editar evento' : 'Novo evento'} onFechar={onFechar} largo>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Campo label="Título"><input {...txt('titulo')} required /></Campo></div>
          <Campo label="Tipo">
            <select className="input" value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
              {Object.entries(TIPOS_EVENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <Campo label="Organização">
            <select className="input" value={f.clube_id ?? ''} disabled={!isAdmin} onChange={(e) => set('clube_id', e.target.value || null)}>
              <option value="">Federação (FPET)</option>
              {clubes.data?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Início"><input type="date" className="input" required value={f.data_inicio ?? ''} onChange={(e) => set('data_inicio', e.target.value)} /></Campo>
          <Campo label="Término"><input type="date" className="input" value={f.data_fim ?? ''} onChange={(e) => set('data_fim', e.target.value || null)} /></Campo>
          <Campo label="Horário"><input {...txt('horario')} placeholder="Ex.: 8h às 12h" /></Campo>
          <Campo label="Público-alvo"><input {...txt('publico_alvo')} placeholder="Ex.: professores, juvenis 12-16" /></Campo>
          <Campo label="Local"><input {...txt('local')} placeholder="Ex.: Quadras do Royal" /></Campo>
          <Campo label="Cidade"><input {...txt('cidade')} /></Campo>
          <div className="sm:col-span-2"><Campo label="Endereço"><input {...txt('endereco')} /></Campo></div>
          <Campo label="Organizador (nome exibido)" dica="Opcional, ex.: nome do professor."><input {...txt('organizador')} /></Campo>
          <Campo label="Contato"><input {...txt('contato')} placeholder="WhatsApp, e-mail…" /></Campo>
        </div>
        <Campo label="Descrição"><textarea {...txt('descricao')} rows={5} /></Campo>
        <div><span className="label">Imagem de divulgação</span><EnviarArquivo pasta="eventos" valor={f.imagem_url} onChange={(u) => set('imagem_url', u)} /></div>

        <fieldset className="rounded-lg border border-slate-200 p-4 grid sm:grid-cols-2 gap-4">
          <legend className="label px-1">Inscrições</legend>
          <Campo label="Como se inscrever">
            <select className="input" value={f.inscricao_modo} onChange={(e) => set('inscricao_modo', e.target.value)}>
              <option value="sistema">Pelo site da FPET</option>
              <option value="externo">Link externo</option>
              <option value="sem">Só divulgação (sem inscrição)</option>
            </select>
          </Campo>
          {f.inscricao_modo === 'externo' && <Campo label="Link de inscrição"><input {...txt('link_externo')} required placeholder="https://…" /></Campo>}
          {f.inscricao_modo === 'sistema' && <>
            <Campo label="Valor (R$)" dica="0 = gratuito. Gera cobrança no Financeiro."><input className="input" inputMode="decimal" value={String(f.valor ?? 0).replace('.', ',')} onChange={(e) => set('valor', e.target.value)} /></Campo>
            <Campo label="Vagas" dica="Vazio = sem limite. Excedentes vão para lista de espera."><input type="number" min={1} className="input" value={f.vagas ?? ''} onChange={(e) => set('vagas', e.target.value || null)} /></Campo>
            <Campo label="Inscrições até"><input type="date" className="input" value={f.inscricoes_ate ?? ''} onChange={(e) => set('inscricoes_ate', e.target.value || null)} /></Campo>
          </>}
          <Campo label="Situação">
            <select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>
              <option value="publicado">Publicado</option><option value="rascunho">Rascunho (não aparece)</option><option value="cancelado">Cancelado</option>
            </select>
          </Campo>
        </fieldset>
        <Erro msg={erro} />
        <div className="flex justify-between gap-2">
          {f.id ? <button type="button" className="btn-danger" onClick={excluir}>Excluir</button> : <span />}
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button>
            <button className="btn-primary">Salvar</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

type InscricaoComLanc = EventoInscricao & { fin_lancamentos: Pick<Lancamento, 'status' | 'valor' | 'desconto'> | null }

function Inscritos({ e, onFechar }: { e: EventoLista; onFechar: () => void }) {
  const [lanc, setLanc] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const lista = useAsync(async () => ok(await supabase.from('evento_inscricoes')
    .select('*, fin_lancamentos(status,valor,desconto)').eq('evento_id', e.id).order('criado_em')) as InscricaoComLanc[], [e.id])

  async function cancelar(i: EventoInscricao) {
    if (!confirm(`Cancelar a inscrição de ${i.nome}?`)) return
    const { error } = await supabase.rpc('cancelar_inscricao_evento', { p_inscricao: i.id })
    if (error) setErro(msgErro(error)); else lista.reload(true)
  }
  function exportar() {
    const linhas = [['Nome', 'E-mail', 'Telefone', 'Situação', 'Pagamento', 'Observação'],
      ...(lista.data ?? []).map((i) => [i.nome, i.email ?? '', i.telefone ?? '', i.status, i.fin_lancamentos?.status ?? '', i.observacao ?? ''])]
    const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `inscritos-${e.titulo}.csv`
    a.click()
  }

  return (
    <Modal aberto titulo={`Inscritos · ${e.titulo}`} onFechar={onFechar} largo>
      <div className="flex justify-between items-center mb-3 text-sm text-slate-500">
        <span>{e.inscritos} confirmado(s){e.vagas ? ` de ${e.vagas} vagas` : ''}{Number(e.valor) > 0 ? ` · ${moeda(e.valor)} cada` : ''}</span>
        <button className="btn-ghost btn-sm" onClick={exportar}>Exportar planilha</button>
      </div>
      <Erro msg={erro ?? lista.error} />
      {lista.loading ? <Spinner /> : !lista.data?.length ? <Vazio>Ninguém inscrito ainda.</Vazio> : (
        <table className="table">
          <thead><tr><th>Nome</th><th className="hidden sm:table-cell">Contato</th><th>Situação</th><th>Pagamento</th><th></th></tr></thead>
          <tbody>
            {lista.data.map((i) => (
              <tr key={i.id} className={i.status === 'cancelada' ? 'opacity-50' : ''}>
                <td className="font-medium">{i.nome}{i.observacao && <div className="text-xs text-slate-500">{i.observacao}</div>}</td>
                <td className="hidden sm:table-cell text-xs text-slate-500">{[i.telefone, i.email].filter(Boolean).join(' · ')}</td>
                <td className="text-xs">{{ confirmada: 'Confirmada', lista_espera: 'Lista de espera', cancelada: 'Cancelada' }[i.status]}</td>
                <td>{i.lancamento_id && i.fin_lancamentos
                  ? <button className={`badge ${STATUS_LANC[i.fin_lancamentos.status].cls} cursor-pointer`} onClick={() => setLanc(i.lancamento_id)}>{STATUS_LANC[i.fin_lancamentos.status].rotulo}</button>
                  : <span className="text-xs text-slate-400">—</span>}</td>
                <td className="text-right">{i.status !== 'cancelada' && <button className="btn-danger btn-sm" onClick={() => cancelar(i)}>Cancelar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {lanc && <LancamentoModal id={lanc} onFechar={() => setLanc(null)} onMudou={() => lista.reload(true)} />}
    </Modal>
  )
}
