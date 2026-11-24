import { useEffect, useState } from 'react'
import { supabase, msgErro } from '../../lib/supabase'
import { ok, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../lib/auth'
import type { Atleta, AtletaContato, Clube } from '../../lib/types'
import { Campo, Erro, Modal } from '../../components/ui'
import EnviarArquivo from '../../components/EnviarArquivo'

type Form = Partial<Atleta> & { contato: Partial<AtletaContato> }

/** Cadastro/edição de atleta (dados públicos + contato restrito) */
export default function AtletaForm({ atleta, nomeInicial, onFechar, onSalvo }: {
  atleta?: Atleta | null; nomeInicial?: string; onFechar: () => void; onSalvo: (a: Atleta) => void
}) {
  const { perfil, session } = useAuth()
  const [f, setF] = useState<Form>({ nome: nomeInicial ?? '', clube_id: perfil?.clube_id ?? null, ativo: true, contato: {} })
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const clubes = useAsync(async () => ok(await supabase.from('clubes').select('id,nome').order('nome')) as Clube[], [])

  useEffect(() => {
    if (!atleta) return
    supabase.from('atletas_contato').select('*').eq('atleta_id', atleta.id).maybeSingle()
      .then(({ data }) => setF({ ...atleta, contato: (data as AtletaContato) ?? {} }))
  }, [atleta])

  const set = (k: keyof Atleta, v: unknown) => setF({ ...f, [k]: v })
  const setC = (k: keyof AtletaContato, v: string) => setF({ ...f, contato: { ...f.contato, [k]: v } })

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null); setSalvando(true)
    try {
      const dados = {
        nome: f.nome!.trim(), apelido: f.apelido || null, sexo: f.sexo || null, data_nascimento: f.data_nascimento || null,
        cidade: f.cidade || null, clube_id: f.clube_id || null, foto_url: f.foto_url || null, ativo: f.ativo ?? true,
      }
      const salvo = (atleta
        ? ok(await supabase.from('atletas').update(dados).eq('id', atleta.id).select().single())
        : ok(await supabase.from('atletas').insert({ ...dados, criado_por: session?.user.id }).select().single())) as Atleta
      const c = f.contato
      if (c.cpf || c.telefone || c.email || c.observacoes || atleta) {
        ok(await supabase.from('atletas_contato').upsert({
          atleta_id: salvo.id, cpf: c.cpf || null, telefone: c.telefone || null, email: c.email || null, observacoes: c.observacoes || null,
        }))
      }
      onSalvo(salvo)
    } catch (e) {
      setErro(msgErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal aberto titulo={atleta ? 'Editar atleta' : 'Novo atleta'} onFechar={onFechar} largo>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo label="Nome completo"><input className="input" required value={f.nome ?? ''} onChange={(e) => set('nome', e.target.value)} /></Campo>
          <Campo label="Apelido"><input className="input" value={f.apelido ?? ''} onChange={(e) => set('apelido', e.target.value)} /></Campo>
          <Campo label="Sexo">
            <select className="input" value={f.sexo ?? ''} onChange={(e) => set('sexo', e.target.value)}>
              <option value="">—</option><option value="M">Masculino</option><option value="F">Feminino</option>
            </select>
          </Campo>
          <Campo label="Nascimento"><input type="date" className="input" value={f.data_nascimento ?? ''} onChange={(e) => set('data_nascimento', e.target.value)} /></Campo>
          <Campo label="Clube">
            <select className="input" value={f.clube_id ?? ''} onChange={(e) => set('clube_id', e.target.value || null)}>
              <option value="">Sem clube</option>
              {clubes.data?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Cidade"><input className="input" value={f.cidade ?? ''} onChange={(e) => set('cidade', e.target.value)} /></Campo>
          <div><span className="label">Foto</span><EnviarArquivo pasta="atletas" redondo tamanhoMax={600} valor={f.foto_url} onChange={(u) => set('foto_url', u)} /></div>
          <label className="flex items-center gap-2 text-sm font-medium mt-6">
            <input type="checkbox" checked={f.ativo ?? true} onChange={(e) => set('ativo', e.target.checked)} /> Ativo
          </label>
        </div>
        <fieldset className="rounded-lg border border-slate-200 p-4">
          <legend className="label px-1">Contato (visível só para clubes e federação)</legend>
          <div className="grid sm:grid-cols-3 gap-4">
            <Campo label="CPF"><input className="input" value={f.contato.cpf ?? ''} onChange={(e) => setC('cpf', e.target.value)} /></Campo>
            <Campo label="Telefone"><input className="input" value={f.contato.telefone ?? ''} onChange={(e) => setC('telefone', e.target.value)} /></Campo>
            <Campo label="E-mail"><input type="email" className="input" value={f.contato.email ?? ''} onChange={(e) => setC('email', e.target.value)} /></Campo>
          </div>
          <div className="mt-3"><Campo label="Observações"><textarea className="input" rows={2} value={f.contato.observacoes ?? ''} onChange={(e) => setC('observacoes', e.target.value)} /></Campo></div>
        </fieldset>
        <Erro msg={erro} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  )
}
