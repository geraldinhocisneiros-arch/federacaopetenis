import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabaseConfigurado } from '../lib/supabase'

const links = [
  { to: '/ranking', rotulo: 'Ranking' },
  { to: '/estatisticas', rotulo: 'Estatísticas' },
  { to: '/torneios', rotulo: 'Torneios' },
  { to: '/atletas', rotulo: 'Atletas' },
  { to: '/clubes', rotulo: 'Academias' },
  { to: '/eventos', rotulo: 'Cursos e eventos' },
  { to: '/noticias', rotulo: 'Notícias' },
]

export default function Layout() {
  const { session, isGestor, isAtleta } = useAuth()
  const [menu, setMenu] = useState(false)
  const noPainel = useLocation().pathname.startsWith('/painel')

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-semibold transition ${isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'}`

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-navy-800 text-white sticky top-0 z-40 shadow">
        <div className="h-1 bg-gradient-to-r from-wave via-wave-light to-ball" />
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3 shrink-0" onClick={() => setMenu(false)}>
            <img src="/emblema-fpet.png" alt="" className="h-11 w-11 rounded-full bg-white" />
            <div className="leading-tight">
              <div className="font-extrabold italic tracking-wider text-lg">FPET</div>
              <div className="text-[10px] uppercase tracking-widest text-white/70 hidden sm:block">Federação Pernambucana de Tênis</div>
            </div>
          </Link>
          <nav className="hidden lg:flex items-center gap-1 ml-auto">
            {links.map((l) => <NavLink key={l.to} to={l.to} className={navCls}>{l.rotulo}</NavLink>)}
            {session ? (
              <NavLink to="/painel" className={navCls}>{isGestor ? 'Painel' : isAtleta ? 'Minha área' : 'Minha conta'}</NavLink>
            ) : (
              <Link to="/entrar" className="btn-ball btn-sm ml-2">Entrar</Link>
            )}
          </nav>
          <button className="lg:hidden ml-auto p-2 cursor-pointer" onClick={() => setMenu(!menu)} aria-label="Menu">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
        {menu && (
          <nav className="lg:hidden border-t border-white/10 px-4 py-2 flex flex-col">
            {links.map((l) => <NavLink key={l.to} to={l.to} className={navCls} onClick={() => setMenu(false)}>{l.rotulo}</NavLink>)}
            <NavLink to={session ? '/painel' : '/entrar'} className={navCls} onClick={() => setMenu(false)}>
              {session ? 'Painel' : 'Entrar'}
            </NavLink>
          </nav>
        )}
      </header>

      {!supabaseConfigurado && (
        <div className="bg-amber-100 text-amber-900 text-sm text-center px-4 py-2">
          Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
        </div>
      )}

      <main className={`flex-1 w-full ${noPainel ? 'max-w-7xl' : 'max-w-6xl'} mx-auto px-4 py-6 sm:py-8`}>
        <Outlet />
      </main>

      <footer className="bg-navy-900 text-white/70 text-sm">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} Federação Pernambucana de Tênis</span>
          <span className="text-white/50">Ranking, torneios e chaves oficiais</span>
        </div>
      </footer>
    </div>
  )
}
