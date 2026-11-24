import { useState } from 'react'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../lib/auth'
import { CATEGORIAS_LANC, FORMAS, STATUS_LANC, hoje, lerValor, moeda } from '../../lib/financeiro'
import { formatarData } from '../../lib/tenis'
import type { FormaPagamento, LancamentoDetalhe } from '../../lib/types'
import { Campo, Erro, Modal, Spinner } from '../../components/ui'

type Acao = null | 'baixa' | 'isencao' | 'voucher' | 'editar'

/** Detalhe de um lançamento com as operações: baixa, isenção, voucher, estorno, cancelamento */
export default function LancamentoModal({ id, onFechar, onMudou }: { id: string; onFechar: () => void; onMudou: () => void }) {
  const { isAdmin, perfil } = useAuth()
  const [acao, setAcao] = useState<Acao>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const dados = useAsync(async () => {
    const l = ok(await supabase.from('fin_lancamentos_detalhe').select('*').eq('id', id).single()) as LancamentoDetalhe
    const { data: saldo } = await supabase.rpc('saldo_credito', {
      p_atleta: l.atleta_id, p_clube: l.atleta_id ? null : l.clube_id, p_emissor: l.recebedor_clube_id,
    })
    return { l, saldo: Number(saldo ?? 0) }
  }, [id])

  const l = dados.data?.l
  const podeGerir = !!l && (isAdmin || (!!l.recebedor_clube_id && l.recebedor_clube_id === perfil?.clube_id))

  async function rpc(nome: string, args: Record<string, unknown>, confirmar?: string) {
    if (confirmar && !confirm(confirmar)) return
    setErro(null); setOcupado(true)
    const { error } = await supabase.rpc(nome, args)
    setOcupado(false)
    if (error) { setErro(msgErro(error)); return }
    setAcao(null); dados.reload(true); onMudou()
  }

  return (
    <Modal aberto titulo="Lançamento" onFechar={onFechar} largo>
      {dados.loading || !l ? <Spinner /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500">{l.natureza === 'receber' ? 'A receber' : 'A pagar'} · {CATEGORIAS_LANC[l.categoria]}</div>
              <div className="font-semibold">{l.descricao}</div>
              {l.pessoa && <div className="text-sm text-slate-600">{l.natureza === 'receber' ? 'Pagador' : 'Favorecido'}: {l.pessoa}</div>}
              <div className="text-xs text-slate-500">Recebedor: {l.recebedor_nome ?? 'Federação'}</div>
            </div>
            <span className={`badge ${STATUS_LANC[l.status].cls}`}>{STATUS_LANC[l.status].rotulo}{l.vencido ? ' · vencido' : ''}</span>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Info k="Valor" v={moeda(l.valor)} />
            <Info k="Desconto" v={l.desconto > 0 ? `${moeda(l.desconto)}${l.voucher_codigo ? ` (${l.voucher_codigo})` : ''}` : '—'} />
            <Info k="Devido" v={<b>{moeda(l.valor_devido)}</b>} />
            <Info k="Vencimento" v={formatarData(l.vencimento) || '—'} />
            {l.status === 'pago' && <>
              <Info k="Pago" v={moeda(l.valor_pago)} />
              <Info k="Crédito usado" v={l.credito_usado > 0 ? moeda(l.credito_usado) : '—'} />
              <Info k="Data" v={formatarData(l.data_pagamento)} />
              <Info k="Forma" v={l.forma_pagamento ? FORMAS[l.forma_pagamento] : '—'} />
            </>}
            {l.status === 'isento' && <Info k="Motivo da isenção" v={l.motivo_isencao} />}
            {dados.data!.saldo !== 0 && <Info k="Saldo de crédito" v={moeda(dados.data!.saldo)} />}
          </dl>
          {l.observacoes && <p className="text-sm text-slate-600 whitespace-pre-line">{l.observacoes}</p>}
          {l.comprovante_url && <a href={l.comprovante_url} target="_blank" rel="noreferrer" className="link text-sm">Ver comprovante ↗</a>}

          <Erro msg={erro ?? dados.error} />

          {podeGerir && acao === null && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              {l.status === 'aberto' && <>
                <button className="btn-primary" onClick={() => setAcao('baixa')}>Dar baixa</button>
                {l.natureza === 'receber' && !l.voucher_id && <button className="btn-ghost" onClick={() => setAcao('voucher')}>Aplicar voucher</button>}
                {l.voucher_id && <button className="btn-ghost" disabled={ocupado} onClick={() => rpc('remover_voucher', { p_id: l.id })}>Remover voucher</button>}
                <button className="btn-ghost" onClick={() => setAcao('isencao')}>Isentar</button>
                <button className="btn-ghost" onClick={() => setAcao('editar')}>Editar</button>
                <button className="btn-danger" disabled={ocupado}
                  onClick={() => rpc('cancelar_lancamento', { p_id: l.id, p_motivo: prompt('Motivo do cancelamento (opcional):') || null })}>Cancelar</button>
              </>}
              {(l.status === 'pago' || l.status === 'isento') && (
                <button className="btn-danger" disabled={ocupado}
                  onClick={() => rpc('estornar_lancamento', { p_id: l.id }, 'Estornar? O lançamento volta para "em aberto" e créditos gerados/usados nesta baixa são desfeitos.')}>
                  Estornar {l.status === 'pago' ? 'baixa' : 'isenção'}
                </button>
              )}
            </div>
          )}

          {acao === 'baixa' && <FormBaixa l={l} saldo={dados.data!.saldo} ocupado={ocupado} onCancelar={() => setAcao(null)}
            onConfirmar={(args) => rpc('baixar_lancamento', { p_id: l.id, ...args })} />}
          {acao === 'isencao' && <FormTexto rotulo="Motivo da isenção" botao="Confirmar isenção" ocupado={ocupado} onCancelar={() => setAcao(null)}
            onConfirmar={(t) => rpc('isentar_lancamento', { p_id: l.id, p_motivo: t })} />}
          {acao === 'voucher' && <FormTexto rotulo="Código do voucher" botao="Aplicar" maiusculo ocupado={ocupado} onCancelar={() => setAcao(null)}
            onConfirmar={(t) => rpc('aplicar_voucher', { p_id: l.id, p_codigo: t })} />}
          {acao === 'editar' && <FormEditar l={l} onCancelar={() => setAcao(null)}
            onSalvo={() => { setAcao(null); dados.reload(true); onMudou() }} />}
        </div>
      )}
    </Modal>
  )
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="text-xs text-slate-500">{k}</dt><dd>{v}</dd></div>
}

function FormBaixa({ l, saldo, ocupado, onCancelar, onConfirmar }: {
  l: LancamentoDetalhe; saldo: number; ocupado: boolean; onCancelar: () => void; onConfirmar: (a: Record<string, unknown>) => void
}) {
  const temCredito = l.natureza === 'receber' && saldo > 0
  const [usarCredito, setUsarCredito] = useState(temCredito)
  const creditoAplicado = usarCredito ? Math.min(saldo, l.valor_devido) : 0
  const [valor, setValor] = useState(String((l.valor_devido - creditoAplicado).toFixed(2)).replace('.', ','))
  const [data, setData] = useState(hoje())
  const [forma, setForma] = useState<FormaPagamento>('pix')
  const [excedente, setExcedente] = useState(true)
  const [comprovante, setComprovante] = useState('')
  const [obs, setObs] = useState('')
  const pago = lerValor(valor)
  const sobra = pago + creditoAplicado - l.valor_devido

  return (
    <form className="rounded-lg border border-slate-200 p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        onConfirmar({ p_valor_pago: pago, p_data: data, p_forma: forma, p_usar_credito: usarCredito,
          p_excedente_credito: excedente, p_comprovante: comprovante || null, p_observacoes: obs || null })
      }}>
      <div className="font-semibold">{l.natureza === 'receber' ? 'Baixa de recebimento' : 'Baixa de pagamento'}</div>
      {temCredito && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={usarCredito} onChange={(e) => {
            setUsarCredito(e.target.checked)
            const c = e.target.checked ? Math.min(saldo, l.valor_devido) : 0
            setValor((l.valor_devido - c).toFixed(2).replace('.', ','))
          }} />
          Usar saldo de crédito ({moeda(saldo)})
        </label>
      )}
      <div className="grid sm:grid-cols-3 gap-3">
        <Campo label="Valor pago (R$)"><input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
        <Campo label="Data"><input type="date" className="input" required value={data} onChange={(e) => setData(e.target.value)} /></Campo>
        <Campo label="Forma">
          <select className="input" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
            {(['pix', 'boleto', 'dinheiro', 'transferencia', 'cartao', 'outro'] as FormaPagamento[]).map((f) => <option key={f} value={f}>{FORMAS[f]}</option>)}
          </select>
        </Campo>
      </div>
      {sobra > 0.004 && l.natureza === 'receber' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={excedente} onChange={(e) => setExcedente(e.target.checked)} />
          Pagou {moeda(sobra)} a mais: guardar como crédito para a próxima cobrança
        </label>
      )}
      {sobra < -0.004 && <p className="text-sm text-red-700">Faltam {moeda(-sobra)} para quitar.</p>}
      <Campo label="Link do comprovante (opcional)"><input className="input" value={comprovante} onChange={(e) => setComprovante(e.target.value)} placeholder="https://…" /></Campo>
      <Campo label="Observação (opcional)"><input className="input" value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancelar}>Voltar</button>
        <button className="btn-primary" disabled={ocupado || sobra < -0.004}>Confirmar baixa</button>
      </div>
    </form>
  )
}

function FormTexto({ rotulo, botao, maiusculo, ocupado, onCancelar, onConfirmar }: {
  rotulo: string; botao: string; maiusculo?: boolean; ocupado: boolean; onCancelar: () => void; onConfirmar: (t: string) => void
}) {
  const [t, setT] = useState('')
  return (
    <form className="rounded-lg border border-slate-200 p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); onConfirmar(t.trim()) }}>
      <Campo label={rotulo}>
        <input className="input" required autoFocus value={t} onChange={(e) => setT(maiusculo ? e.target.value.toUpperCase() : e.target.value)} />
      </Campo>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancelar}>Voltar</button>
        <button className="btn-primary" disabled={ocupado || !t.trim()}>{botao}</button>
      </div>
    </form>
  )
}

function FormEditar({ l, onCancelar, onSalvo }: { l: LancamentoDetalhe; onCancelar: () => void; onSalvo: () => void }) {
  const [descricao, setDescricao] = useState(l.descricao)
  const [valor, setValor] = useState(String(l.valor).replace('.', ','))
  const [venc, setVenc] = useState(l.vencimento ?? '')
  const [obs, setObs] = useState(l.observacoes ?? '')
  const [erro, setErro] = useState<string | null>(null)
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('fin_lancamentos')
      .update({ descricao, valor: lerValor(valor), vencimento: venc || null, observacoes: obs || null }).eq('id', l.id)
    if (error) setErro(msgErro(error)); else onSalvo()
  }
  return (
    <form className="rounded-lg border border-slate-200 p-4 space-y-3" onSubmit={salvar}>
      <Campo label="Descrição"><input className="input" required value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Valor (R$)"><input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
        <Campo label="Vencimento"><input type="date" className="input" value={venc} onChange={(e) => setVenc(e.target.value)} /></Campo>
      </div>
      <Campo label="Observações"><textarea className="input" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      <Erro msg={erro} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancelar}>Voltar</button>
        <button className="btn-primary">Salvar</button>
      </div>
    </form>
  )
}
