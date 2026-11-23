import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTorneio } from '../lib/torneio'
import { GENERO, periodo } from '../lib/tenis'
import Chave from '../components/Chave'
import Programacao from '../components/Programacao'
import { AoVivo, Erro, Spinner, StatusBadge, Tabs, Vazio } from '../components/ui'
import { useAuth } from '../lib/auth'

type Aba = 'chaves' | 'programacao' | 'inscritos' | 'info'

export default function TorneioPagina() {
  const { id } = useParams()
  const { data, error, loading } = useTorneio(id)
  const { isAdmin, perfil } = useAuth()
  const [aba, setAba] = useState<Aba>('chaves')
  const [catSel, setCatSel] = useState<string | null>(null)

  if (loading) return <Spinner />
  if (error || !data) return <Erro msg={error ?? 'Torneio não encontrado.'} />

  const { torneio: t, categorias, partidas, inscricoes, inscricoesPorId } = data
  const tcId = catSel ?? categorias[0]?.id
  const tc = categorias.find((c) => c.id === tcId)
  const aoVivo = partidas.filter((p) => p.em_quadra).length
  const podeGerir = isAdmin || (perfil?.clube_id === t.clube_id && t.status !== 'homologado')
  const nomeCat = (p: { torneio_categoria_id: string }) => categorias.find((c) => c.id === p.torneio_categoria_id)?.categorias.nome ?? ''

  return (
    <div>
      <div className="card overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-navy-800 to-navy-700 text-white p-5 sm:p-6 relative">
          <div className="text-xs font-semibold uppercase tracking-widest text-wave-light">
            <Link to={`/clubes/${t.clube_id}`} className="hover:underline">{t.clubes?.nome}</Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">{t.nome}</h1>
          <div className="text-white/80 text-sm mt-1">{periodo(t.data_inicio, t.data_fim)}{t.local ? ` · ${t.local}` : ''}</div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <StatusBadge status={t.status} />
            {aoVivo > 0 && <AoVivo />}
            {!t.pontua_ranking && <span className="badge bg-white/15 text-white">Não vale ranking</span>}
            {podeGerir && <Link to={`/painel/torneios/${t.id}`} className="btn-ball btn-sm ml-auto">Gerenciar torneio</Link>}
          </div>
        </div>
      </div>

      <Tabs<Aba>
        valor={aba}
        onChange={setAba}
        itens={[
          { valor: 'chaves', rotulo: 'Chaves' },
          { valor: 'programacao', rotulo: 'Programação' },
          { valor: 'inscritos', rotulo: 'Inscritos' },
          { valor: 'info', rotulo: 'Informações' },
        ]}
      />

      <div className="mt-4">
        {(aba === 'chaves' || aba === 'inscritos') && categorias.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {categorias.map((c) => (
              <button key={c.id} onClick={() => setCatSel(c.id)}
                className={`tab border ${c.id === tcId ? 'tab-active border-navy-800' : 'border-slate-200 bg-white'}`}>
                {c.categorias.nome}
              </button>
            ))}
          </div>
        )}

        {!categorias.length && <Vazio>Nenhuma categoria cadastrada neste torneio.</Vazio>}

        {aba === 'chaves' && tc && (
          <div className="card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <h2 className="font-bold text-lg">{tc.categorias.nome}</h2>
              <span className="text-xs text-slate-500">{tc.formato_partida}</span>
            </div>
            {tc.chave_gerada_em ? (
              <Chave partidas={partidas.filter((p) => p.torneio_categoria_id === tc.id)} inscricoes={inscricoesPorId} />
            ) : (
              <Vazio>A chave desta categoria ainda não foi sorteada.</Vazio>
            )}
          </div>
        )}

        {aba === 'programacao' && (
          <Programacao partidas={partidas} inscricoes={inscricoesPorId} nomeCategoria={nomeCat} />
        )}

        {aba === 'inscritos' && tc && (
          <div className="card">
            {(() => {
              const lista = inscricoes
                .filter((i) => i.torneio_categoria_id === tc.id)
                .sort((a, b) => (a.cabeca ?? 999) - (b.cabeca ?? 999) || a.nome_exibicao.localeCompare(b.nome_exibicao))
              if (!lista.length) return <Vazio>Nenhum inscrito.</Vazio>
              return (
                <table className="table">
                  <thead><tr><th>Atleta</th><th>Clube</th><th className="text-right">Cabeça</th></tr></thead>
                  <tbody>
                    {lista.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <Link to={`/atletas/${i.atleta_id}`} className="font-semibold hover:underline">{i.atleta_nome}</Link>
                          {i.parceiro_id && <> / <Link to={`/atletas/${i.parceiro_id}`} className="font-semibold hover:underline">{i.parceiro_nome}</Link></>}
                        </td>
                        <td className="text-slate-500">{i.clube_nome ?? '—'}</td>
                        <td className="text-right">{i.cabeca ? <span className="badge bg-ball text-navy-900">{i.cabeca}</span> : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            })()}
          </div>
        )}

        {aba === 'info' && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h2 className="font-bold mb-3">Categorias</h2>
              <ul className="divide-y divide-slate-100">
                {categorias.map((c) => (
                  <li key={c.id} className="py-2 text-sm">
                    <div className="font-semibold">{c.categorias.nome} <span className="text-slate-400 font-normal">· {GENERO[c.categorias.genero]}</span></div>
                    <div className="text-slate-500">{c.formato_partida}{c.valor_inscricao ? ` · Inscrição: ${c.valor_inscricao}` : ''}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              {t.descricao && <div className="card p-5"><h2 className="font-bold mb-2">Sobre</h2><p className="text-sm whitespace-pre-line">{t.descricao}</p></div>}
              <div className="card p-5">
                <h2 className="font-bold mb-2">Inscrições</h2>
                <p className="text-sm whitespace-pre-line text-slate-700">{t.info_inscricao || 'Informações com o clube organizador.'}</p>
                {t.clubes?.telefone && <p className="text-sm mt-2">Contato: {t.clubes.telefone}</p>}
              </div>
              {t.regulamento && <div className="card p-5"><h2 className="font-bold mb-2">Regulamento</h2><p className="text-sm whitespace-pre-line">{t.regulamento}</p></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
