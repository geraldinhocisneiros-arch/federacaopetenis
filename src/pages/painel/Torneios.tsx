import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../lib/auth'
import { periodo } from '../../lib/tenis'
import type { Clube } from '../../lib/types'
import { Campo, Erro, Modal, Spinner, StatusBadge, Vazio } from '../../components/ui'
import type { TorneioComClube } from '../Torneios'

export default function PainelTorneios() {
  const { isAdmin, perfil, session } = useAuth()
  const nav = useNavigate()
  const [novo, setNovo] = useState(false)
  const [form, setForm] = useState({ nome: '', clube_id: '', data_inicio: '', data_fim: '' })
  const [erro, setErro] = useState<string | null>(null)

  const dados = useAsync(async () => {
    let q = supabase.from('torneios').select('*, clubes(id,nome,sigla)').order('data_inicio', { ascending: false, nullsFirst: true })
    if (!isAdmin && perfil?.clube_id) q = q.eq('clube_id', perfil.clube_id)
    const [t, c, tab] = await Promise.all([
      q,
      supabase.from('clubes').select('id,nome').order('nome'),
      supabase.from('tabelas_pontuacao').select('id').eq('ativa', true).limit(1),
    ])
    return { torneios: ok(t) as TorneioComClube[], clubes: ok(c) as Clube[], tabelaPadrao: (ok(tab) as { id: string }[])[0]?.id ?? null }
  }, [isAdmin, perfil?.clube_id])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    try {
      const { data, error } = await supabase.from('torneios').insert({
        nome: form.nome,
        clube_id: isAdmin ? form.clube_id : perfil!.clube_id,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || form.data_inicio || null,
        tabela_pontuacao_id: dados.data?.tabelaPadrao,
        criado_por: session?.user.id,
      }).select('id').single()
      if (error) throw error
      nav(`/painel/torneios/${data.id}`)
    } catch (e) { setErro(msgErro(e)) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Torneios</h2>
        <button className="btn-primary" onClick={() => setNovo(true)}>+ Novo torneio</button>
      </div>
      <Erro msg={dados.error} />
      {dados.loading ? <Spinner /> : !dados.data?.torneios.length ? <div className="card"><Vazio>Nenhum torneio cadastrado.</Vazio></div> : (
        <div className="card divide-y divide-slate-100">
          {dados.data.torneios.map((t) => (
            <Link key={t.id} to={`/painel/torneios/${t.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{t.nome}</div>
                <div className="text-xs text-slate-500">{t.clubes?.nome} · {periodo(t.data_inicio, t.data_fim)}</div>
              </div>
              <StatusBadge status={t.status} />
            </Link>
          ))}
        </div>
      )}

      <Modal aberto={novo} titulo="Novo torneio" onFechar={() => setNovo(false)}>
        <form onSubmit={criar} className="space-y-3">
          <Campo label="Nome do torneio"><input className="input" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Campo>
          {isAdmin && (
            <Campo label="Clube organizador">
              <select className="input" required value={form.clube_id} onChange={(e) => setForm({ ...form, clube_id: e.target.value })}>
                <option value="">Selecione…</option>
                {dados.data?.clubes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Início"><input type="date" className="input" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></Campo>
            <Campo label="Término"><input type="date" className="input" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></Campo>
          </div>
          <Erro msg={erro} />
          <button className="btn-primary w-full">Criar e configurar</button>
        </form>
      </Modal>
    </div>
  )
}
