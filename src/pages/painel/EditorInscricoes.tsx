import { useState } from 'react'
import { supabase, msgErro } from '../../lib/supabase'
import type { DadosTorneio } from '../../lib/torneio'
import type { Atleta } from '../../lib/types'
import { Aviso, Erro, Vazio } from '../../components/ui'
import AtletaBusca from '../../components/AtletaBusca'
import AtletaForm from './AtletaForm'

export default function EditorInscricoes({ d, onMudou }: { d: DadosTorneio; onMudou: () => void }) {
  const [sel, setSel] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [primeiro, setPrimeiro] = useState<Atleta | null>(null) // duplas: 1º atleta escolhido
  const [novoNome, setNovoNome] = useState<string | null>(null)
  const tc = d.categorias.find((c) => c.id === (sel ?? d.categorias[0]?.id))
  if (!tc) return <div className="card"><Vazio>Cadastre as categorias do torneio primeiro.</Vazio></div>

  const duplas = tc.categorias.modalidade === 'duplas'
  const lista = d.inscricoes.filter((i) => i.torneio_categoria_id === tc.id)
  const jaInscritos = lista.flatMap((i) => [i.atleta_id, i.parceiro_id ?? ''])
  const travado = !!tc.chave_gerada_em || d.torneio.status === 'homologado' || d.torneio.status === 'encerrado'

  async function inscrever(a: Atleta) {
    setErro(null)
    if (duplas && !primeiro) { setPrimeiro(a); return }
    const reg = duplas ? { atleta_id: primeiro!.id, parceiro_id: a.id } : { atleta_id: a.id }
    const { error } = await supabase.from('inscricoes').insert({ torneio_categoria_id: tc!.id, ...reg })
    setPrimeiro(null)
    if (error) setErro(error.code === '23505' ? 'Atleta já inscrito nesta categoria.' : msgErro(error))
    else onMudou()
  }

  async function remover(id: string) {
    const { error } = await supabase.from('inscricoes').delete().eq('id', id)
    if (error) setErro(msgErro(error)); else onMudou()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {d.categorias.map((c) => (
          <button key={c.id} onClick={() => { setSel(c.id); setPrimeiro(null) }}
            className={`tab border ${c.id === tc.id ? 'tab-active border-navy-800' : 'border-slate-200 bg-white'}`}>
            {c.categorias.nome} ({d.inscricoes.filter((i) => i.torneio_categoria_id === c.id).length})
          </button>
        ))}
      </div>

      {travado ? (
        <Aviso>{tc.chave_gerada_em ? 'A chave desta categoria já foi sorteada. Para mudar inscrições, apague a chave na aba 4 (só é possível antes de haver resultados).' : 'Torneio encerrado.'}</Aviso>
      ) : (
        <div className="card p-4 space-y-2">
          <div className="label">{duplas ? (primeiro ? `Parceiro(a) de ${primeiro.nome}` : 'Inscrever dupla: escolha o 1º atleta') : 'Inscrever atleta'}</div>
          <AtletaBusca onEscolher={inscrever} onNovo={setNovoNome} excluir={[...jaInscritos, primeiro?.id ?? '']} />
          {primeiro && <button className="link text-xs cursor-pointer" onClick={() => setPrimeiro(null)}>cancelar dupla</button>}
          <p className="text-xs text-slate-500">Os cabeças de chave são definidos automaticamente pelo ranking no momento do sorteio.</p>
        </div>
      )}
      <Erro msg={erro} />

      <div className="card">
        {!lista.length ? <Vazio>Nenhum inscrito nesta categoria.</Vazio> : (
          <table className="table">
            <thead><tr><th>#</th><th>{duplas ? 'Dupla' : 'Atleta'}</th><th className="hidden sm:table-cell">Clube</th><th>Cabeça</th><th></th></tr></thead>
            <tbody>
              {lista.map((i, n) => (
                <tr key={i.id}>
                  <td className="text-slate-400 w-8">{n + 1}</td>
                  <td className="font-medium">{i.nome_exibicao}</td>
                  <td className="hidden sm:table-cell text-slate-500">{i.clube_nome ?? '—'}</td>
                  <td>{i.cabeca ? <span className="badge bg-ball text-navy-900">{i.cabeca}</span> : ''}</td>
                  <td className="text-right">{!travado && <button className="btn-danger btn-sm" onClick={() => remover(i.id)}>Remover</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {novoNome !== null && (
        <AtletaForm nomeInicial={novoNome} onFechar={() => setNovoNome(null)}
          onSalvo={(a) => { setNovoNome(null); inscrever(a) }} />
      )}
    </div>
  )
}
