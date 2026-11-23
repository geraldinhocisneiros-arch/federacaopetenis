import { useState } from 'react'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../lib/auth'
import { FASES, GENERO } from '../../lib/tenis'
import type { DadosTorneio, TCComCategoria } from '../../lib/torneio'
import type { Categoria, TabelaPontuacao, TorneioCategoria } from '../../lib/types'
import { Campo, Erro, Modal, Vazio } from '../../components/ui'

export default function EditorCategorias({ d, onMudou }: { d: DadosTorneio; onMudou: () => void }) {
  const { isAdmin } = useAuth()
  const [nova, setNova] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState<TCComCategoria | null>(null)
  const bloqueado = d.torneio.status === 'homologado'
  const extras = useAsync(async () => {
    const [c, t] = await Promise.all([
      supabase.from('categorias').select('*').eq('ativa', true).order('ordem').order('nome'),
      supabase.from('tabelas_pontuacao').select('*').order('nome'),
    ])
    return { categorias: ok(c) as Categoria[], tabelas: ok(t) as TabelaPontuacao[] }
  }, [])
  const disponiveis = (extras.data?.categorias ?? []).filter((c) => !d.categorias.some((tc) => tc.categoria_id === c.id))

  async function adicionar() {
    if (!nova) return
    setErro(null)
    const { error } = await supabase.from('torneio_categorias').insert({ torneio_id: d.torneio.id, categoria_id: nova })
    if (error) setErro(msgErro(error)); else { setNova(''); onMudou() }
  }
  async function remover(tc: TorneioCategoria) {
    if (!confirm('Remover esta categoria do torneio?')) return
    const { error } = await supabase.from('torneio_categorias').delete().eq('id', tc.id)
    if (error) setErro(msgErro(error).includes('foreign key') ? 'Remova antes as inscrições desta categoria.' : msgErro(error))
    else onMudou()
  }

  return (
    <div className="space-y-4">
      {!bloqueado && (
        <div className="card p-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-48">
            <Campo label="Adicionar categoria" dica="As categorias oficiais são cadastradas pela federação.">
              <select className="input" value={nova} onChange={(e) => setNova(e.target.value)}>
                <option value="">Selecione…</option>
                {disponiveis.map((c) => <option key={c.id} value={c.id}>{c.nome} · {GENERO[c.genero]}{c.modalidade === 'duplas' ? ' · Duplas' : ''}</option>)}
              </select>
            </Campo>
          </div>
          <button className="btn-primary" onClick={adicionar} disabled={!nova}>Adicionar</button>
        </div>
      )}
      <Erro msg={erro} />
      {!d.categorias.length ? <div className="card"><Vazio>Nenhuma categoria. Adicione acima.</Vazio></div> : (
        <div className="card divide-y divide-slate-100">
          {d.categorias.map((tc) => {
            const n = d.inscricoes.filter((i) => i.torneio_categoria_id === tc.id).length
            return (
              <div key={tc.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{tc.categorias.nome} <span className="text-xs text-slate-400">{GENERO[tc.categorias.genero]}</span></div>
                  <div className="text-xs text-slate-500">
                    {tc.formato === 'eliminatoria' ? 'Eliminatória simples' : tc.formato === 'grupos' ? 'Fase de grupos' : 'Eliminatória + consolação'}
                    {' · '}{tc.formato_partida}{tc.valor_inscricao ? ` · ${tc.valor_inscricao}` : ''} · {n} inscrito(s)
                  </div>
                </div>
                {!bloqueado && (
                  <>
                    <button className="btn-ghost btn-sm" onClick={() => setEditando(tc)}>Configurar</button>
                    <button className="btn-danger btn-sm" onClick={() => remover(tc)}>Remover</button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
      {editando && (
        <ConfigTC tc={editando} tabelas={extras.data?.tabelas ?? []} isAdmin={isAdmin}
          onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); onMudou() }} />
      )}
    </div>
  )
}

function ConfigTC({ tc, tabelas, isAdmin, onFechar, onSalvo }: {
  tc: TCComCategoria; tabelas: TabelaPontuacao[]; isAdmin: boolean; onFechar: () => void; onSalvo: () => void
}) {
  const [f, setF] = useState<TorneioCategoria>(tc)
  const [erro, setErro] = useState<string | null>(null)
  const set = (k: keyof TorneioCategoria, v: unknown) => setF({ ...f, [k]: v })

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('torneio_categorias').update({
      formato: f.formato, formato_partida: f.formato_partida, valor_inscricao: f.valor_inscricao || null,
      num_cabecas: f.num_cabecas, bye_conta_vitoria: f.bye_conta_vitoria,
      wo_vitoria_conta_a_partir: f.wo_vitoria_conta_a_partir, wo_perdedor_pontua: f.wo_perdedor_pontua,
      ...(isAdmin ? { tabela_pontuacao_id: f.tabela_pontuacao_id } : {}),
    }).eq('id', f.id)
    if (error) setErro(msgErro(error)); else onSalvo()
  }

  return (
    <Modal aberto titulo={`Configurar · ${tc.categorias.nome}`} onFechar={onFechar} largo>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo label="Formato da chave">
            <select className="input" value={f.formato} onChange={(e) => set('formato', e.target.value)}>
              <option value="eliminatoria">Eliminatória simples</option>
              <option value="eliminatoria_consolacao" disabled>Eliminatória + consolação (em breve)</option>
              <option value="grupos" disabled>Fase de grupos (em breve)</option>
            </select>
          </Campo>
          <Campo label="Formato da partida">
            <input className="input" list="formatos" value={f.formato_partida} onChange={(e) => set('formato_partida', e.target.value)} />
            <datalist id="formatos">
              <option value="2 sets + super tiebreak de 10" />
              <option value="Pro set de 8 games" />
              <option value="Melhor de 3 sets" />
            </datalist>
          </Campo>
          <Campo label="Valor da inscrição" dica="Apenas informativo.">
            <input className="input" value={f.valor_inscricao ?? ''} onChange={(e) => set('valor_inscricao', e.target.value)} placeholder="Ex.: R$ 120,00" />
          </Campo>
          <Campo label="Cabeças de chave" dica="Vazio = automático pelo tamanho da chave (8→2, 16→4, 32→8, 64→16).">
            <input type="number" min={0} className="input" value={f.num_cabecas ?? ''} onChange={(e) => set('num_cabecas', e.target.value === '' ? null : Number(e.target.value))} />
          </Campo>
        </div>
        <fieldset className="rounded-lg border border-slate-200 p-4 space-y-3">
          <legend className="label px-1">Regras de pontuação (W.O. e bye)</legend>
          <Campo label="Vitória por W.O. vale como vitória a partir de" dica="Antes dessa fase, quem avança por W.O. e perde em seguida pontua como se tivesse parado na rodada do W.O.">
            <select className="input" value={f.wo_vitoria_conta_a_partir ?? ''} onChange={(e) => set('wo_vitoria_conta_a_partir', e.target.value || null)}>
              <option value="">Sempre conta</option>
              {FASES.filter((x) => x.valor !== 'campeao').map((x) => <option key={x.valor} value={x.valor}>{x.rotulo}</option>)}
            </select>
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.wo_perdedor_pontua} onChange={(e) => set('wo_perdedor_pontua', e.target.checked)} />
            Quem perde por W.O. na estreia recebe os pontos da rodada
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.bye_conta_vitoria} onChange={(e) => set('bye_conta_vitoria', e.target.checked)} />
            Bye conta como vitória (quem passa de bye e perde recebe pontos da 2ª rodada)
          </label>
          {isAdmin && (
            <Campo label="Tabela de pontuação específica desta categoria">
              <select className="input" value={f.tabela_pontuacao_id ?? ''} onChange={(e) => set('tabela_pontuacao_id', e.target.value || null)}>
                <option value="">Usar a do torneio</option>
                {tabelas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </Campo>
          )}
        </fieldset>
        <Erro msg={erro} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}
