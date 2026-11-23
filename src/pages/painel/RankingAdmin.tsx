import { useEffect, useState } from 'react'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../lib/auth'
import { formatarData } from '../../lib/tenis'
import type { Atleta, Categoria } from '../../lib/types'
import { Campo, Erro, Spinner, Vazio } from '../../components/ui'
import AtletaBusca from '../../components/AtletaBusca'

interface Config { janela_semanas: number | null; melhores_resultados: number | null; criterio_desempate: string | null; observacoes: string | null }
interface Lanc { id: string; pontos: number; data_referencia: string; tipo: string; descricao: string | null; atletas: { nome: string }; categorias: { nome: string } }

const hoje = () => new Date().toISOString().slice(0, 10)

export default function PainelRanking() {
  const cats = useAsync(async () => ok(await supabase.from('categorias').select('*').order('ordem').order('nome')) as Categoria[], [])
  const lancs = useAsync(async () => ok(await supabase.from('ranking_lancamentos')
    .select('id,pontos,data_referencia,tipo,descricao,atletas(nome),categorias(nome)')
    .neq('tipo', 'torneio').order('criado_em', { ascending: false }).limit(100)) as unknown as Lanc[], [])

  return (
    <div className="space-y-6">
      <ConfigForm />
      <div className="grid lg:grid-cols-2 gap-6">
        <AjusteForm categorias={cats.data ?? []} onSalvo={() => lancs.reload(true)} />
        <Importacao categorias={cats.data ?? []} onSalvo={() => lancs.reload(true)} />
      </div>
      <Publicar categorias={cats.data ?? []} />
      <div className="card">
        <h3 className="font-bold p-4 border-b border-slate-100">Ajustes e importações (fora de torneios)</h3>
        {lancs.loading ? <Spinner /> : !lancs.data?.length ? <Vazio>Nenhum lançamento manual.</Vazio> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Data</th><th>Atleta</th><th>Categoria</th><th>Descrição</th><th className="text-right">Pontos</th><th></th></tr></thead>
              <tbody>
                {lancs.data.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap">{formatarData(l.data_referencia)}</td>
                    <td>{l.atletas.nome}</td>
                    <td className="text-slate-500">{l.categorias.nome}</td>
                    <td className="text-slate-500">{l.descricao}</td>
                    <td className="text-right tabular-nums font-semibold">{l.pontos}</td>
                    <td className="text-right">
                      <button className="btn-danger btn-sm" onClick={async () => {
                        if (!confirm('Excluir este lançamento?')) return
                        await supabase.from('ranking_lancamentos').delete().eq('id', l.id)
                        lancs.reload(true)
                      }}>Excluir</button>
                    </td>
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

function ConfigForm() {
  const [f, setF] = useState<Config | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { supabase.from('configuracoes').select('*').eq('id', 1).single().then(({ data }) => setF(data as Config)) }, [])
  if (!f) return <Spinner />
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('configuracoes').update({ ...f, atualizado_em: new Date().toISOString() }).eq('id', 1)
    setMsg(error ? msgErro(error) : 'Regras salvas. O ranking é recalculado automaticamente.')
  }
  return (
    <form onSubmit={salvar} className="card p-5 space-y-4">
      <h3 className="font-bold">Regras do ranking</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <Campo label="Validade dos pontos (semanas)" dica="52 = janela móvel de 12 meses. Vazio = pontos nunca expiram.">
          <input type="number" min={1} className="input" value={f.janela_semanas ?? ''} onChange={(e) => setF({ ...f, janela_semanas: e.target.value ? Number(e.target.value) : null })} />
        </Campo>
        <Campo label="Contar só os N melhores resultados" dica="Vazio = soma todos os torneios.">
          <input type="number" min={1} className="input" value={f.melhores_resultados ?? ''} onChange={(e) => setF({ ...f, melhores_resultados: e.target.value ? Number(e.target.value) : null })} />
        </Campo>
      </div>
      <Campo label="Critério de desempate (texto exibido no ranking)">
        <input className="input" value={f.criterio_desempate ?? ''} onChange={(e) => setF({ ...f, criterio_desempate: e.target.value })} placeholder="A definir" />
      </Campo>
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <button className="btn-primary">Salvar regras</button>
    </form>
  )
}

function AjusteForm({ categorias, onSalvo }: { categorias: Categoria[]; onSalvo: () => void }) {
  const { session } = useAuth()
  const [atleta, setAtleta] = useState<Atleta | null>(null)
  const [f, setF] = useState({ categoria_id: '', pontos: '', data: hoje(), descricao: '' })
  const [erro, setErro] = useState<string | null>(null)
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!atleta) return setErro('Escolha o atleta.')
    const { error } = await supabase.from('ranking_lancamentos').insert({
      atleta_id: atleta.id, categoria_id: f.categoria_id, pontos: Number(f.pontos), data_referencia: f.data,
      tipo: 'ajuste', descricao: f.descricao || 'Ajuste manual', criado_por: session?.user.id,
    })
    if (error) setErro(msgErro(error)); else { setErro(null); setAtleta(null); setF({ ...f, pontos: '', descricao: '' }); onSalvo() }
  }
  return (
    <form onSubmit={salvar} className="card p-5 space-y-3">
      <h3 className="font-bold">Ajuste manual de pontos</h3>
      {atleta ? (
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <b>{atleta.nome}</b><button type="button" className="link cursor-pointer" onClick={() => setAtleta(null)}>trocar</button>
        </div>
      ) : <AtletaBusca onEscolher={setAtleta} />}
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Categoria">
          <select className="input" required value={f.categoria_id} onChange={(e) => setF({ ...f, categoria_id: e.target.value })}>
            <option value="">…</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Pontos (negativo para retirar)"><input type="number" required className="input" value={f.pontos} onChange={(e) => setF({ ...f, pontos: e.target.value })} /></Campo>
        <Campo label="Data de referência"><input type="date" className="input" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
        <Campo label="Motivo"><input className="input" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
      </div>
      <Erro msg={erro} />
      <button className="btn-primary">Lançar</button>
    </form>
  )
}

function Importacao({ categorias, onSalvo }: { categorias: Categoria[]; onSalvo: () => void }) {
  const { session } = useAuth()
  const [cat, setCat] = useState('')
  const [data, setData] = useState(hoje())
  const [texto, setTexto] = useState('')
  const [criar, setCriar] = useState(true)
  const [log, setLog] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function importar() {
    if (!cat) return setLog('Escolha a categoria.')
    setOcupado(true); setLog(null)
    const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean)
      .map((l) => l.split(/[;\t]/).map((x) => x.trim()))
      .filter((p) => p.length >= 2 && p[0] && !isNaN(Number(p[1].replace(',', '.'))))
    const avisos: string[] = []
    let n = 0
    for (const [nome, pts] of linhas) {
      const { data: achados } = await supabase.from('atletas').select('id').ilike('nome', nome).limit(2)
      let id = achados?.length === 1 ? achados[0].id : null
      if (achados && achados.length > 1) { avisos.push(`“${nome}”: mais de um atleta com esse nome, ignorado.`); continue }
      if (!id && criar) {
        const { data: novo, error } = await supabase.from('atletas').insert({ nome, criado_por: session?.user.id }).select('id').single()
        if (error) { avisos.push(`“${nome}”: ${msgErro(error)}`); continue }
        id = novo.id
      }
      if (!id) { avisos.push(`“${nome}”: não encontrado.`); continue }
      const { error } = await supabase.from('ranking_lancamentos').insert({
        atleta_id: id, categoria_id: cat, pontos: Math.round(Number(pts.replace(',', '.'))), data_referencia: data,
        tipo: 'importacao', descricao: 'Ranking inicial (importação)', criado_por: session?.user.id,
      })
      if (error) avisos.push(`“${nome}”: ${msgErro(error)}`); else n++
    }
    setOcupado(false)
    setLog(`${n} atleta(s) importado(s).${avisos.length ? '\n' + avisos.join('\n') : ''}`)
    if (n) { setTexto(''); onSalvo() }
  }

  return (
    <div className="card p-5 space-y-3">
      <h3 className="font-bold">Importar ranking inicial</h3>
      <p className="text-xs text-slate-500">Cole uma linha por atleta no formato <code>Nome;Pontos</code> (ou copie duas colunas do Excel). Depois clique em “Publicar ranking” para registrar o ponto de partida do histórico.</p>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Categoria">
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">…</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Data dos pontos"><input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
      </div>
      <textarea className="input font-mono text-xs" rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'Geraldo Silva;1200\nJoão Souza;950'} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={criar} onChange={(e) => setCriar(e.target.checked)} /> Cadastrar atletas que não existirem</label>
      {log && <pre className="text-xs whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{log}</pre>}
      <button className="btn-primary" disabled={ocupado || !texto.trim()} onClick={importar}>{ocupado ? 'Importando…' : 'Importar'}</button>
    </div>
  )
}

function Publicar({ categorias }: { categorias: Categoria[] }) {
  const [msg, setMsg] = useState<string | null>(null)
  async function publicar(todas: boolean, id?: string) {
    const alvo = todas ? categorias : categorias.filter((c) => c.id === id)
    for (const c of alvo) {
      const { error } = await supabase.rpc('publicar_ranking', { p_categoria: c.id, p_descricao: 'Publicação manual' })
      if (error) return setMsg(msgErro(error))
    }
    setMsg(`Ranking publicado (${alvo.length} categoria(s)). A posição de hoje vira referência para “subiu/desceu”.`)
  }
  return (
    <div className="card p-5 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-60">
        <h3 className="font-bold">Publicar ranking</h3>
        <p className="text-xs text-slate-500">A homologação de torneio já publica automaticamente. Use após importações ou ajustes manuais.</p>
        {msg && <p className="text-sm text-emerald-700 mt-1">{msg}</p>}
      </div>
      <button className="btn-ball" onClick={() => publicar(true)}>Publicar todas as categorias</button>
    </div>
  )
}
