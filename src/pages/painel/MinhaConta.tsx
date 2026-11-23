import { useState } from 'react'
import { supabase, msgErro } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Campo, Erro } from '../../components/ui'

export default function MinhaConta() {
  const { session, perfil } = useAuth()
  const [senha, setSenha] = useState('')
  const [conf, setConf] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function trocar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null); setMsg(null)
    if (senha !== conf) return setErro('As senhas não conferem.')
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) setErro(msgErro(error))
    else { setMsg('Senha alterada.'); setSenha(''); setConf('') }
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="card p-5 text-sm space-y-1">
        <div><span className="text-slate-500">Nome:</span> {perfil?.nome || '—'}</div>
        <div><span className="text-slate-500">E-mail:</span> {session?.user.email}</div>
      </div>
      <form onSubmit={trocar} className="card p-5 space-y-3">
        <h3 className="font-bold">Trocar senha</h3>
        <Campo label="Nova senha"><input type="password" className="input" minLength={6} required value={senha} onChange={(e) => setSenha(e.target.value)} /></Campo>
        <Campo label="Repita a nova senha"><input type="password" className="input" minLength={6} required value={conf} onChange={(e) => setConf(e.target.value)} /></Campo>
        <Erro msg={erro} />
        {msg && <p className="text-sm text-emerald-700">{msg}</p>}
        <button className="btn-primary">Salvar nova senha</button>
      </form>
    </div>
  )
}
