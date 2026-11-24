import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { anoAtual, moeda } from '../../lib/financeiro'
import { periodo } from '../../lib/tenis'
import type { Torneio } from '../../lib/types'
import { Erro, Spinner } from '../../components/ui'

interface Resumo {
  atletas_filiados: number; atletas_pendentes: number; academias_filiadas: number; academias_pendentes: number; academias_ativas: number
  a_receber: number; vencido: number; recebido_mes: number; recebido_ano: number; a_pagar: number; pago_ano: number
  isencoes_ano: number; creditos_em_aberto: number; torneios_homologar: number; torneios_andamento: number; publicacoes_rascunho: number
}
type TorneioTaxa = Torneio & { clubes: { nome: string } | null }

/** Área ADM: visão geral da federação */
export default function PainelVisao() {
  const ano = anoAtual()
  const [erro, setErro] = useState<string | null>(null)
  const dados = useAsync(async () => {
    const [r, t, taxas] = await Promise.all([
      supabase.rpc('resumo_adm', { p_ano: ano }),
      supabase.from('torneios').select('*, clubes(nome)').in('status', ['encerrado', 'homologado'])
        .eq('pontua_ranking', true).gte('data_inicio', `${ano - 1}-01-01`).order('data_inicio', { ascending: false }),
      supabase.from('fin_lancamentos').select('torneio_id').eq('categoria', 'taxa_torneio').is('recebedor_clube_id', null).neq('status', 'cancelado'),
    ])
    const comTaxa = new Set((ok(taxas) as { torneio_id: string }[]).map((x) => x.torneio_id))
    return {
      r: ok(r) as Resumo,
      semTaxa: (ok(t) as TorneioTaxa[]).filter((x) => !comTaxa.has(x.id)),
      homologar: (ok(t) as TorneioTaxa[]).filter((x) => x.status === 'encerrado'),
    }
  }, [])

  async function gerarTaxa(t: TorneioTaxa) {
    setErro(null)
    const { error } = await supabase.rpc('gerar_taxa_federacao_torneio', { p_torneio: t.id })
    if (error) setErro(msgErro(error)); else dados.reload(true)
  }

  if (dados.loading) return <Spinner />
  if (!dados.data) return <Erro msg={dados.error} />
  const { r, semTaxa, homologar } = dados.data

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Área ADM · {ano}</h2>

      <section>
        <h3 className="label mb-2">Financeiro da federação</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi rotulo="Recebido no mês" valor={moeda(r.recebido_mes)} cls="text-emerald-700" to="/painel/financeiro" />
          <Kpi rotulo={`Recebido em ${ano}`} valor={moeda(r.recebido_ano)} to="/painel/financeiro" />
          <Kpi rotulo="A receber (em aberto)" valor={moeda(r.a_receber)} cls="text-amber-700" to="/painel/financeiro" />
          <Kpi rotulo="Vencido" valor={moeda(r.vencido)} cls={r.vencido > 0 ? 'text-red-700' : ''} to="/painel/financeiro" />
          <Kpi rotulo="A pagar" valor={moeda(r.a_pagar)} to="/painel/financeiro" />
          <Kpi rotulo={`Pago em ${ano}`} valor={moeda(r.pago_ano)} />
          <Kpi rotulo={`Isenções em ${ano}`} valor={moeda(r.isencoes_ano)} cls="text-sky-700" />
          <Kpi rotulo="Créditos a utilizar" valor={moeda(r.creditos_em_aberto)} />
        </div>
      </section>

      <section>
        <h3 className="label mb-2">Filiação {ano}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi rotulo="Atletas filiados" valor={r.atletas_filiados} cls="text-emerald-700" to="/painel/filiacao" />
          <Kpi rotulo="Atletas aguardando pagamento" valor={r.atletas_pendentes} cls="text-amber-700" to="/painel/filiacao" />
          <Kpi rotulo="Academias filiadas" valor={`${r.academias_filiadas} / ${r.academias_ativas}`} cls="text-emerald-700" to="/painel/filiacao" />
          <Kpi rotulo="Academias aguardando pagamento" valor={r.academias_pendentes} cls="text-amber-700" to="/painel/filiacao" />
        </div>
      </section>

      <section>
        <h3 className="label mb-2">Pendências</h3>
        <Erro msg={erro} />
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="px-4 py-3 border-b border-slate-100 font-bold">Torneios aguardando homologação ({homologar.length})</div>
            {homologar.length ? homologar.map((t) => (
              <Link key={t.id} to={`/painel/torneios/${t.id}`} className="flex justify-between px-4 py-2 text-sm hover:bg-slate-50">
                <span>{t.nome} <span className="text-slate-400">· {t.clubes?.nome}</span></span><span className="link">Homologar →</span>
              </Link>
            )) : <div className="px-4 py-3 text-sm text-slate-500">Nenhum.</div>}
          </div>
          <div className="card">
            <div className="px-4 py-3 border-b border-slate-100 font-bold">Torneios sem taxa federativa gerada ({semTaxa.length})</div>
            {semTaxa.length ? semTaxa.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                <span className="min-w-0 truncate">{t.nome} <span className="text-slate-400">· {t.clubes?.nome} · {periodo(t.data_inicio, t.data_fim)}</span></span>
                <button className="btn-ghost btn-sm" onClick={() => gerarTaxa(t)}>Gerar taxa</button>
              </div>
            )) : <div className="px-4 py-3 text-sm text-slate-500">Nenhum.</div>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-sm">
          <span className="badge bg-amber-100 text-amber-800">{r.torneios_andamento} torneio(s) com inscrições abertas / em andamento</span>
          {r.publicacoes_rascunho > 0 && <Link to="/painel/publicacoes" className="badge bg-slate-100 text-slate-700">{r.publicacoes_rascunho} publicação(ões) em rascunho</Link>}
        </div>
      </section>
    </div>
  )
}

function Kpi({ rotulo, valor, cls, to }: { rotulo: string; valor: React.ReactNode; cls?: string; to?: string }) {
  const corpo = (
    <>
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className={`text-xl sm:text-2xl font-extrabold tabular-nums ${cls ?? ''}`}>{valor}</div>
    </>
  )
  return to ? <Link to={to} className="card p-3 hover:border-wave">{corpo}</Link> : <div className="card p-3">{corpo}</div>
}
