import { useEffect, useState } from 'react'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { FASES } from '../../lib/tenis'
import type { TabelaPontuacao } from '../../lib/types'
import { Campo, Erro, Spinner } from '../../components/ui'

export default function PainelPontuacao() {
  const [sel, setSel] = useState<string | null>(null)
  const tabelas = useAsync(async () => ok(await supabase.from('tabelas_pontuacao').select('*').order('nome')) as TabelaPontuacao[], [])
  const atual = tabelas.data?.find((t) => t.id === (sel ?? tabelas.data?.[0]?.id))

  async function nova() {
    const nome = prompt('Nome da nova tabela (ex.: "Torneio Estadual", "Torneio de clube")')
    if (!nome) return
    const { data, error } = await supabase.from('tabelas_pontuacao').insert({ nome }).select().single()
    if (error) return alert(msgErro(error))
    await supabase.from('tabela_pontuacao_itens').insert(FASES.map((f) => ({ tabela_id: data.id, fase: f.valor, pontos: 0 })))
    await tabelas.reload()
    setSel(data.id)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">Tabelas de pontuação</h2>
        <button className="btn-primary" onClick={nova}>+ Nova tabela</button>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Pontos pela fase alcançada. Você pode ter tabelas diferentes para torneios de pesos diferentes e escolher a tabela em cada torneio.
      </p>
      {tabelas.loading ? <Spinner /> : (
        <div className="grid md:grid-cols-[220px_1fr] gap-4">
          <div className="card p-2 h-fit">
            {tabelas.data?.map((t) => (
              <button key={t.id} onClick={() => setSel(t.id)} className={`tab w-full text-left ${t.id === atual?.id ? 'tab-active' : ''}`}>{t.nome}</button>
            ))}
          </div>
          {atual && <EditorTabela key={atual.id} tabela={atual} onMudou={() => tabelas.reload(true)} />}
        </div>
      )}
    </div>
  )
}

function EditorTabela({ tabela, onMudou }: { tabela: TabelaPontuacao; onMudou: () => void }) {
  const [nome, setNome] = useState(tabela.nome)
  const [pontos, setPontos] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('tabela_pontuacao_itens').select('*').eq('tabela_id', tabela.id).then(({ data }) =>
      setPontos(Object.fromEntries((data ?? []).map((i: { fase: string; pontos: number }) => [i.fase, String(i.pontos)]))))
  }, [tabela.id])

  async function salvar() {
    setErro(null); setMsg(null)
    const r1 = await supabase.from('tabelas_pontuacao').update({ nome }).eq('id', tabela.id)
    const r2 = await supabase.from('tabela_pontuacao_itens').upsert(
      FASES.map((f) => ({ tabela_id: tabela.id, fase: f.valor, pontos: Number(pontos[f.valor] || 0) })))
    if (r1.error || r2.error) setErro(msgErro(r1.error || r2.error))
    else { setMsg('Tabela salva. Vale para os próximos torneios homologados.'); onMudou() }
  }

  return (
    <div className="card p-5 space-y-4">
      <Campo label="Nome da tabela"><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
      <table className="table">
        <thead><tr><th>Fase alcançada</th><th className="w-32">Pontos</th></tr></thead>
        <tbody>
          {FASES.map((f) => (
            <tr key={f.valor}>
              <td>{f.rotulo}{f.valor !== 'campeao' && f.valor !== 'final' ? <span className="text-xs text-slate-400"> (perdeu nesta fase)</span> : ''}</td>
              <td><input type="number" className="input" value={pontos[f.valor] ?? ''} onChange={(e) => setPontos({ ...pontos, [f.valor]: e.target.value })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Erro msg={erro} />
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <button className="btn-primary" onClick={salvar}>Salvar</button>
    </div>
  )
}
