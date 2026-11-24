import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../lib/auth'
import { TIPOS_PUB, dataPub } from '../../lib/publicacoes'
import type { Publicacao } from '../../lib/types'
import { Campo, Erro, Modal, Spinner, Vazio } from '../../components/ui'

export default function PainelPublicacoes() {
  const { session } = useAuth()
  const [editando, setEditando] = useState<Partial<Publicacao> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const lista = useAsync(async () => ok(await supabase.from('publicacoes').select('*')
    .order('publicado').order('publicado_em', { ascending: false, nullsFirst: true }).order('criado_em', { ascending: false })) as Publicacao[], [])

  const f = editando ?? {}
  const set = (k: keyof Publicacao, v: unknown) => setEditando({ ...f, [k]: v })

  async function salvar(publicar?: boolean) {
    setErro(null)
    if (!f.titulo?.trim()) { setErro('Informe o título.'); return }
    const { id, criado_em: _c, ...d } = f
    void _c
    const dados = { ...d, publicado: publicar ?? d.publicado ?? false, autor_id: d.autor_id ?? session?.user.id }
    const res = id ? await supabase.from('publicacoes').update(dados).eq('id', id) : await supabase.from('publicacoes').insert(dados)
    if (res.error) setErro(msgErro(res.error)); else { setEditando(null); lista.reload(true) }
  }

  async function excluir(p: Publicacao) {
    if (!confirm(`Excluir "${p.titulo}"?`)) return
    const { error } = await supabase.from('publicacoes').delete().eq('id', p.id)
    if (error) setErro(msgErro(error)); else lista.reload(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">Notícias e publicações</h2>
        <button className="btn-primary" onClick={() => { setErro(null); setEditando({ tipo: 'noticia', publicado: false, destaque: false }) }}>+ Nova notícia</button>
      </div>
      <p className="text-sm text-slate-500 mb-4">Notícias, comunicados, resultados, regulamentos e editais exibidos no site em <Link to="/noticias" className="link">Notícias</Link>.</p>
      <Erro msg={!editando ? erro : null} />
      {lista.loading ? <Spinner /> : !lista.data?.length ? <div className="card"><Vazio>Nenhuma publicação.</Vazio></div> : (
        <div className="card divide-y divide-slate-100">
          {lista.data.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {p.imagem_url && <img src={p.imagem_url} alt="" className="h-12 w-16 rounded object-cover" />}
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{p.titulo}{p.destaque && <span className="badge bg-ball text-navy-900 ml-2">Destaque</span>}</div>
                <div className="text-xs text-slate-500">{TIPOS_PUB[p.tipo]} · {p.publicado ? `Publicado em ${dataPub(p.publicado_em)}` : 'Rascunho'}</div>
              </div>
              {p.publicado
                ? <Link to={`/noticias/${p.id}`} target="_blank" className="btn-ghost btn-sm">Ver ↗</Link>
                : <span className="badge bg-slate-100 text-slate-600">Rascunho</span>}
              <button className="btn-ghost btn-sm" onClick={() => { setErro(null); setEditando(p) }}>Editar</button>
              <button className="btn-danger btn-sm" onClick={() => excluir(p)}>Excluir</button>
            </div>
          ))}
        </div>
      )}

      <Modal aberto={!!editando} titulo={f.id ? 'Editar publicação' : 'Nova publicação'} onFechar={() => setEditando(null)} largo>
        <form onSubmit={(e) => { e.preventDefault(); salvar() }} className="space-y-3">
          <Campo label="Título"><input className="input" required value={f.titulo ?? ''} onChange={(e) => set('titulo', e.target.value)} /></Campo>
          <div className="grid sm:grid-cols-2 gap-3">
            <Campo label="Tipo">
              <select className="input" value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
                {Object.entries(TIPOS_PUB).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={f.destaque ?? false} onChange={(e) => set('destaque', e.target.checked)} /> Destaque na página inicial</label>
          </div>
          <Campo label="Resumo" dica="Aparece na lista e na página inicial."><textarea className="input" rows={2} value={f.resumo ?? ''} onChange={(e) => set('resumo', e.target.value)} /></Campo>
          <Campo label="Texto" dica="Linhas em branco separam parágrafos."><textarea className="input" rows={10} value={f.conteudo ?? ''} onChange={(e) => set('conteudo', e.target.value)} /></Campo>
          <div className="grid sm:grid-cols-2 gap-3">
            <Campo label="URL da imagem"><input className="input" value={f.imagem_url ?? ''} onChange={(e) => set('imagem_url', e.target.value || null)} placeholder="https://…" /></Campo>
            <Campo label="URL do anexo (PDF, regulamento…)"><input className="input" value={f.anexo_url ?? ''} onChange={(e) => set('anexo_url', e.target.value || null)} placeholder="https://…" /></Campo>
          </div>
          <Erro msg={erro} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
            {f.publicado
              ? <button type="button" className="btn-ghost" onClick={() => salvar(false)}>Despublicar</button>
              : <button className="btn-ghost">Salvar rascunho</button>}
            <button type="button" className="btn-primary" onClick={() => salvar(true)}>{f.publicado ? 'Salvar' : 'Publicar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
