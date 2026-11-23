import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ok, useAsync } from '../lib/useAsync'
import type { Atleta, Clube } from '../lib/types'
import { Avatar, Erro, Spinner, Vazio } from '../components/ui'
import { CardTorneio, type TorneioComClube } from './Torneios'

export default function ClubePagina() {
  const { id } = useParams()
  const dados = useAsync(async () => {
    const [c, t, a] = await Promise.all([
      supabase.from('clubes').select('*').eq('id', id!).single(),
      supabase.from('torneios').select('*, clubes(id,nome,sigla)').eq('clube_id', id!).neq('status', 'rascunho').order('data_inicio', { ascending: false }),
      supabase.from('atletas').select('*').eq('clube_id', id!).eq('ativo', true).order('nome'),
    ])
    return { clube: ok(c) as Clube, torneios: ok(t) as TorneioComClube[], atletas: ok(a) as Atleta[] }
  }, [id])

  if (dados.loading) return <Spinner />
  if (dados.error || !dados.data) return <Erro msg={dados.error} />
  const { clube: c, torneios, atletas } = dados.data
  const info: [string, string | number | null][] = [
    ['Endereço', [c.endereco, c.bairro, c.cidade].filter(Boolean).join(', ') || null],
    ['Telefone', c.telefone], ['E-mail', c.email], ['Instagram', c.instagram], ['Site', c.site],
    ['Responsável', c.responsavel], ['Quadras', c.num_quadras], ['Piso', c.tipo_piso],
  ]

  return (
    <div className="space-y-6">
      <div className="card p-5 flex flex-wrap items-center gap-4">
        <Avatar nome={c.nome} url={c.logo_url} tamanho={72} />
        <div>
          <h1 className="text-2xl font-extrabold">{c.nome}</h1>
          {c.sigla && c.sigla !== c.nome && <div className="text-sm text-slate-500">{c.sigla}</div>}
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-5 h-fit">
          <h2 className="font-bold mb-3">Informações</h2>
          <dl className="space-y-2 text-sm">
            {info.filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <div key={k}><dt className="text-xs text-slate-500 uppercase tracking-wide">{k}</dt><dd className="break-words">{v}</dd></div>
            ))}
          </dl>
          {c.observacoes && <p className="text-sm text-slate-600 mt-3 whitespace-pre-line">{c.observacoes}</p>}
        </div>
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="font-bold text-lg mb-3">Torneios</h2>
            {torneios.length ? <div className="grid sm:grid-cols-2 gap-4">{torneios.map((t) => <CardTorneio key={t.id} t={t} />)}</div>
              : <div className="card"><Vazio>Nenhum torneio publicado.</Vazio></div>}
          </section>
          <section>
            <h2 className="font-bold text-lg mb-3">Atletas ({atletas.length})</h2>
            {atletas.length ? (
              <div className="card divide-y divide-slate-100">
                {atletas.map((a) => (
                  <Link key={a.id} to={`/atletas/${a.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
                    <Avatar nome={a.nome} url={a.foto_url} tamanho={32} />
                    <span className="font-medium">{a.nome}</span>
                  </Link>
                ))}
              </div>
            ) : <div className="card"><Vazio>Nenhum atleta vinculado.</Vazio></div>}
          </section>
        </div>
      </div>
    </div>
  )
}
