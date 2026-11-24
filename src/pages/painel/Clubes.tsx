import { useState } from 'react'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../lib/auth'
import type { Clube } from '../../lib/types'
import { Campo, Erro, Modal, Spinner } from '../../components/ui'
import EnviarArquivo from '../../components/EnviarArquivo'

const CAMPOS: [keyof Clube, string, string?][] = [
  ['nome', 'Nome'], ['sigla', 'Sigla'], ['razao_social', 'Razão social'], ['cnpj', 'CNPJ'], ['responsavel', 'Responsável'], ['telefone', 'Telefone'],
  ['email', 'E-mail'], ['instagram', 'Instagram'], ['site', 'Site'], ['endereco', 'Endereço'],
  ['bairro', 'Bairro'], ['cidade', 'Cidade'], ['tipo_piso', 'Tipo de piso', 'Saibro, rápida…'],
]

export default function PainelClubes() {
  const { isAdmin, perfil } = useAuth()
  const [editando, setEditando] = useState<Partial<Clube> | null>(null)
  const lista = useAsync(async () => {
    let q = supabase.from('clubes').select('*').order('nome')
    if (!isAdmin) q = q.eq('id', perfil!.clube_id!)
    return ok(await q) as Clube[]
  }, [isAdmin])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">{isAdmin ? 'Academias' : 'Minha academia'}</h2>
        {isAdmin && <button className="btn-primary" onClick={() => setEditando({ ativo: true, cidade: 'Recife' })}>+ Nova academia</button>}
      </div>
      {lista.loading ? <Spinner /> : (
        <div className="card divide-y divide-slate-100">
          {lista.data?.map((c) => (
            <div key={c.id} className={`flex items-center gap-3 px-4 py-3 ${c.ativo ? '' : 'opacity-50'}`}>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{c.nome}</div>
                <div className="text-xs text-slate-500">{[c.responsavel, c.telefone, c.bairro].filter(Boolean).join(' · ') || 'Cadastro incompleto'}</div>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => setEditando(c)}>Editar</button>
            </div>
          ))}
        </div>
      )}
      {editando && <ClubeForm c={editando} isAdmin={isAdmin} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); lista.reload() }} />}
    </div>
  )
}

function ClubeForm({ c, isAdmin, onFechar, onSalvo }: { c: Partial<Clube>; isAdmin: boolean; onFechar: () => void; onSalvo: () => void }) {
  const [f, setF] = useState<Partial<Clube>>(c)
  const [erro, setErro] = useState<string | null>(null)
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const { id, ...dados } = f
    const res = id ? await supabase.from('clubes').update(dados).eq('id', id) : await supabase.from('clubes').insert(dados)
    if (res.error) setErro(msgErro(res.error)); else onSalvo()
  }
  return (
    <Modal aberto titulo={c.id ? 'Editar academia' : 'Nova academia'} onFechar={onFechar} largo>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {CAMPOS.map(([k, rot, ph]) => (
            <Campo key={k} label={rot}>
              <input className="input" required={k === 'nome'} placeholder={ph} value={(f[k] as string) ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value || null })} />
            </Campo>
          ))}
          <div><span className="label">Logo</span><EnviarArquivo pasta="clubes" tamanhoMax={600} valor={f.logo_url} onChange={(u) => setF({ ...f, logo_url: u })} /></div>
          <Campo label="Nº de quadras">
            <input type="number" className="input" value={f.num_quadras ?? ''} onChange={(e) => setF({ ...f, num_quadras: e.target.value ? Number(e.target.value) : null })} />
          </Campo>
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm font-medium mt-6">
              <input type="checkbox" checked={f.ativo ?? true} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Ativo
            </label>
          )}
        </div>
        <Campo label="Observações"><textarea className="input" rows={2} value={f.observacoes ?? ''} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Campo>
        <Erro msg={erro} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}
