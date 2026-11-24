import { useState } from 'react'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { formatarData } from '../../lib/tenis'
import type { Atleta, SolicitacaoAtleta } from '../../lib/types'
import { Erro } from '../../components/ui'
import AtletaBusca from '../../components/AtletaBusca'

type Sol = SolicitacaoAtleta & { atletas: { nome: string; data_nascimento: string | null } | null; perfis: { email: string | null } | null }

/** Pedidos de acesso de atleta que a federação precisa conferir */
export default function SolicitacoesAtleta({ onMudou }: { onMudou?: () => void }) {
  const [erro, setErro] = useState<string | null>(null)
  const [escolhido, setEscolhido] = useState<Record<string, Atleta | null>>({})
  const lista = useAsync(async () => ok(await supabase.from('solicitacoes_atleta')
    .select('*, atletas(nome,data_nascimento), perfis(email)').eq('status', 'pendente').order('criado_em')) as Sol[], [])

  async function aprovar(s: Sol) {
    const alvo = escolhido[s.id] ?? null
    const msg = alvo ? `Vincular ${s.perfis?.email} ao atleta ${alvo.nome}?`
      : s.atleta_id ? `Vincular ${s.perfis?.email} ao cadastro existente de ${s.atletas?.nome}?`
      : `Criar um novo cadastro de atleta para ${s.nome}?`
    if (!confirm(msg)) return
    const { error } = await supabase.rpc('aprovar_solicitacao_atleta', { p_id: s.id, p_atleta: alvo?.id ?? null })
    if (error) setErro(msgErro(error)); else { lista.reload(true); onMudou?.() }
  }
  async function recusar(s: Sol) {
    const motivo = prompt('Motivo (o atleta verá esta mensagem):')
    if (motivo === null) return
    const { error } = await supabase.rpc('recusar_solicitacao_atleta', { p_id: s.id, p_motivo: motivo || null })
    if (error) setErro(msgErro(error)); else lista.reload(true)
  }

  if (!lista.data?.length) return null
  return (
    <div className="card border-amber-300 mb-6">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="font-bold">Pedidos de acesso de atleta ({lista.data.length})</h3>
        <p className="text-xs text-slate-500">CPF e nascimento não bateram com o cadastro, ou o atleta ainda não existe. Confira antes de aprovar: o atleta passa a ver as próprias cobranças.</p>
      </div>
      <Erro msg={erro} />
      <div className="divide-y divide-slate-100">
        {lista.data.map((s) => (
          <div key={s.id} className="p-4 space-y-2">
            <div className="flex flex-wrap justify-between gap-2">
              <div className="text-sm">
                <div className="font-semibold">{s.nome} <span className="text-slate-400 font-normal">· {s.perfis?.email}</span></div>
                <div className="text-slate-500">CPF {s.cpf} · nasc. {formatarData(s.data_nascimento) || '—'} · {s.telefone ?? 'sem telefone'}</div>
                {s.atleta_id && <div className="text-amber-800">CPF encontrado no cadastro de <b>{s.atletas?.nome}</b> (nasc. {formatarData(s.atletas?.data_nascimento) || 'não informado'})</div>}
              </div>
              <div className="flex gap-2 items-start">
                <button className="btn-primary btn-sm" onClick={() => aprovar(s)}>
                  {escolhido[s.id] ? `Vincular a ${escolhido[s.id]!.nome}` : s.atleta_id ? 'Aprovar vínculo' : 'Aprovar e criar cadastro'}
                </button>
                <button className="btn-danger btn-sm" onClick={() => recusar(s)}>Recusar</button>
              </div>
            </div>
            <details className="text-sm">
              <summary className="link cursor-pointer text-xs">Vincular a outro cadastro existente</summary>
              <div className="mt-2 max-w-md">
                {escolhido[s.id]
                  ? <span>{escolhido[s.id]!.nome} <button className="link" onClick={() => setEscolhido({ ...escolhido, [s.id]: null })}>trocar</button></span>
                  : <AtletaBusca onEscolher={(a) => setEscolhido({ ...escolhido, [s.id]: a })} />}
              </div>
            </details>
          </div>
        ))}
      </div>
    </div>
  )
}
