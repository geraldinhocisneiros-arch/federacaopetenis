import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigurado } from './supabase'
import type { Perfil } from './types'

interface AuthCtx {
  session: Session | null
  perfil: Perfil | null
  carregando: boolean
  isAdmin: boolean
  isGestor: boolean
  isAtleta: boolean
  recarregarPerfil: () => Promise<void>
  sair: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)

  async function carregarPerfil(s: Session | null) {
    if (!s) {
      setPerfil(null)
      return
    }
    const { data } = await supabase.from('perfis').select('*').eq('id', s.user.id).maybeSingle()
    setPerfil((data as Perfil) ?? null)
  }

  useEffect(() => {
    if (!supabaseConfigurado) {
      setCarregando(false)
      return
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await carregarPerfil(data.session)
      setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setTimeout(() => carregarPerfil(s), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const isAdmin = perfil?.papel === 'admin'
  const isGestor = isAdmin || (perfil?.papel === 'clube' && !!perfil.clube_id)

  return (
    <Ctx.Provider
      value={{
        session,
        perfil,
        carregando,
        isAdmin,
        isGestor,
        isAtleta: !!perfil?.atleta_id,
        recarregarPerfil: () => carregarPerfil(session),
        sair: async () => {
          await supabase.auth.signOut()
        },
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
