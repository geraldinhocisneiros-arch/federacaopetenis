import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase, msgErro } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Aviso, Campo, Erro } from '../components/ui'

export default function Entrar() {
  const { session } = useAuth()
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (session) return <Navigate to="/painel" replace />

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null); setAviso(null); setEnviando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome } } })
        if (error) throw error
        if (!data.session) setAviso('Cadastro feito. Confirme pelo link enviado ao seu e-mail e depois entre.')
      }
    } catch (e) {
      setErro(msgErro(e) === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : msgErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card p-6">
        <div className="flex justify-center mb-4"><img src="/logo-fpet.jpg" alt="FPET" className="h-16 object-contain" /></div>
        <h1 className="text-xl font-bold text-center mb-1">{modo === 'entrar' ? 'Acesso dos clubes e da federação' : 'Criar acesso'}</h1>
        <p className="text-sm text-slate-500 text-center mb-5">
          {modo === 'entrar' ? 'Para acompanhar ranking e chaves não é preciso entrar.' : 'Após o cadastro, a federação libera o seu acesso ao clube.'}
        </p>
        <form onSubmit={enviar} className="space-y-3">
          {modo === 'cadastrar' && <Campo label="Nome"><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} required /></Campo>}
          <Campo label="E-mail"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Campo>
          <Campo label="Senha"><input className="input" type="password" minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} required /></Campo>
          <Erro msg={erro} />
          {aviso && <Aviso>{aviso}</Aviso>}
          <button className="btn-primary w-full" disabled={enviando}>{enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Cadastrar'}</button>
        </form>
        <button className="link text-sm mt-4 block mx-auto cursor-pointer" onClick={() => setModo(modo === 'entrar' ? 'cadastrar' : 'entrar')}>
          {modo === 'entrar' ? 'Ainda não tem acesso? Cadastre-se' : 'Já tenho acesso'}
        </button>
      </div>
    </div>
  )
}
