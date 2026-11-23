import { useState } from 'react'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { GENERO } from '../../lib/tenis'
import type { Categoria } from '../../lib/types'
import { Campo, Erro, Modal, Spinner, Vazio } from '../../components/ui'

export default function PainelCategorias() {
  const [editando, setEditando] = useState<Partial<Categoria> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const lista = useAsync(async () => ok(await supabase.from('categorias').select('*').order('ordem').order('nome')) as Categoria[], [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const { id, ...dados } = editando!
    const res = id ? await supabase.from('categorias').update(dados).eq('id', id) : await supabase.from('categorias').insert(dados)
    if (res.error) setErro(msgErro(res.error)); else { setEditando(null); lista.reload() }
  }
  const f = editando ?? {}
  const set = (k: keyof Categoria, v: unknown) => setEditando({ ...f, [k]: v })

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">Categorias oficiais</h2>
        <button className="btn-primary" onClick={() => { setErro(null); setEditando({ genero: 'M', modalidade: 'simples', ordem: (lista.data?.length ?? 0) + 1, ativa: true }) }}>+ Nova categoria</button>
      </div>
      <p className="text-sm text-slate-500 mb-4">Cada categoria tem um ranking próprio. Os clubes escolhem quais delas abrir em cada torneio.</p>
      {lista.loading ? <Spinner /> : !lista.data?.length ? <div className="card"><Vazio>Nenhuma categoria. Cadastre a primeira.</Vazio></div> : (
        <div className="card divide-y divide-slate-100">
          {lista.data.map((c) => (
            <div key={c.id} className={`flex items-center gap-3 px-4 py-3 ${c.ativa ? '' : 'opacity-50'}`}>
              <span className="text-xs text-slate-400 w-6">{c.ordem}</span>
              <div className="flex-1">
                <div className="font-semibold">{c.nome}</div>
                <div className="text-xs text-slate-500">{GENERO[c.genero]} · {c.modalidade === 'duplas' ? 'Duplas' : 'Simples'}{c.ativa ? '' : ' · inativa'}</div>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => { setErro(null); setEditando(c) }}>Editar</button>
            </div>
          ))}
        </div>
      )}
      <Modal aberto={!!editando} titulo={f.id ? 'Editar categoria' : 'Nova categoria'} onFechar={() => setEditando(null)}>
        <form onSubmit={salvar} className="space-y-3">
          <Campo label="Nome"><input className="input" required value={f.nome ?? ''} onChange={(e) => set('nome', e.target.value)} placeholder="Ex.: 1ª Classe" /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Gênero">
              <select className="input" value={f.genero} onChange={(e) => set('genero', e.target.value)}>
                <option value="M">Masculino</option><option value="F">Feminino</option><option value="X">Misto</option>
              </select>
            </Campo>
            <Campo label="Modalidade">
              <select className="input" value={f.modalidade} onChange={(e) => set('modalidade', e.target.value)}>
                <option value="simples">Simples</option><option value="duplas">Duplas</option>
              </select>
            </Campo>
            <Campo label="Ordem de exibição"><input type="number" className="input" value={f.ordem ?? 0} onChange={(e) => set('ordem', Number(e.target.value))} /></Campo>
            <label className="flex items-center gap-2 text-sm font-medium mt-6"><input type="checkbox" checked={f.ativa ?? true} onChange={(e) => set('ativa', e.target.checked)} /> Ativa</label>
          </div>
          <Campo label="Descrição"><textarea className="input" rows={2} value={f.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} /></Campo>
          <Erro msg={erro} />
          <button className="btn-primary w-full">Salvar</button>
        </form>
      </Modal>
    </div>
  )
}
