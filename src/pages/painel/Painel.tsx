import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Spinner } from '../../components/ui'
import PainelTorneios from './Torneios'
import TorneioEditor from './TorneioEditor'
import PainelAtletas from './Atletas'
import PainelClubes from './Clubes'
import PainelCategorias from './Categorias'
import PainelPontuacao from './Pontuacao'
import PainelRanking from './RankingAdmin'
import PainelUsuarios from './Usuarios'
import MinhaConta from './MinhaConta'
import PainelVisao from './Visao'
import PainelFiliacao from './Filiacao'
import PainelFinanceiro from './Financeiro'
import PainelPublicacoes from './Publicacoes'
import PainelEventos from './Eventos'
import MinhaArea from './MinhaArea'

interface Item { to: string; rotulo: string; ok: boolean; icone: string; badge?: number }
interface Grupo { titulo: string; itens: Item[] }

// Ícones simples (traço), 20x20
const ICONES: Record<string, string> = {
  painel: 'M3 3h6v8H3zM11 3h6v5h-6zM11 10h6v7h-6zM3 13h6v4H3z',
  trofeu: 'M6 3h8v4a4 4 0 0 1-8 0zM6 5H3a3 3 0 0 0 3 3M14 5h3a3 3 0 0 1-3 3M10 11v3M7 17h6M8 14h4v3H8z',
  pessoas: 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 17a5 5 0 0 1 10 0M13 4a3 3 0 0 1 0 5M15 12a5 5 0 0 1 3 5',
  predio: 'M3 17V7l7-4 7 4v10M7 17v-5h6v5M2 17h16',
  cartao: 'M3 5h14v10H3zM3 8h14M6 12h4',
  dinheiro: 'M2 5h16v10H2zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 8v4M15 8v4',
  calendario: 'M3 5h14v12H3zM3 9h14M7 3v4M13 3v4',
  jornal: 'M3 4h11v13H5a2 2 0 0 1-2-2zM14 8h3v7a2 2 0 0 1-2 2M6 7h5M6 10h5M6 13h3',
  lista: 'M7 5h10M7 10h10M7 15h10M3 5h1M3 10h1M3 15h1',
  estrela: 'M10 2l2.5 5 5.5.8-4 3.9.9 5.5L10 14.6 5.1 17.2 6 11.7 2 7.8l5.5-.8z',
  ranking: 'M3 17V11h4v6M8 17V5h4v12M13 17v-8h4v8',
  usuarios: 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17a6 6 0 0 1 12 0',
  raquete: 'M12 3a5 5 0 0 1 0 10 5 5 0 0 1 0-10zM8.5 11.5 3 17',
  engrenagem: 'M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10 1v3M10 16v3M1 10h3M16 10h3M3.6 3.6l2.1 2.1M14.3 14.3l2.1 2.1M3.6 16.4l2.1-2.1M14.3 5.7l2.1-2.1',
}

function Icone({ nome }: { nome: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={ICONES[nome]} />
    </svg>
  )
}

export default function Painel() {
  const { session, perfil, carregando, isAdmin, isGestor, isAtleta, sair } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const local = useLocation()
  const [pendentes, setPendentes] = useState(0)
  useEffect(() => setMenuAberto(false), [local.pathname])
  useEffect(() => {
    if (!isAdmin) return
    supabase.rpc('solicitacoes_pendentes').then(({ data }) => setPendentes(Number(data ?? 0)))
  }, [isAdmin, local.pathname])

  if (carregando) return <Spinner />
  if (!session) return <Navigate to="/entrar" replace />

  const grupos: Grupo[] = [
    { titulo: '', itens: [{ to: 'adm', rotulo: 'Área ADM', ok: isAdmin, icone: 'painel' }] },
    { titulo: 'Competições', itens: [
      { to: 'torneios', rotulo: 'Torneios', ok: isGestor, icone: 'trofeu' },
      { to: 'atletas', rotulo: 'Atletas', ok: isGestor, icone: 'pessoas' },
      { to: 'ranking', rotulo: 'Ranking', ok: isAdmin, icone: 'ranking' },
      { to: 'categorias', rotulo: 'Categorias', ok: isAdmin, icone: 'lista' },
      { to: 'pontuacao', rotulo: 'Pontuação', ok: isAdmin, icone: 'estrela' },
    ] },
    { titulo: 'Gestão', itens: [
      { to: 'clubes', rotulo: isAdmin ? 'Academias' : 'Minha academia', ok: isGestor, icone: 'predio' },
      { to: 'filiacao', rotulo: 'Filiação', ok: isGestor, icone: 'cartao' },
      { to: 'financeiro', rotulo: 'Financeiro', ok: isGestor, icone: 'dinheiro' },
    ] },
    { titulo: 'Comunicação', itens: [
      { to: 'eventos', rotulo: 'Cursos e eventos', ok: isGestor, icone: 'calendario' },
      { to: 'publicacoes', rotulo: 'Notícias', ok: isAdmin, icone: 'jornal' },
    ] },
    { titulo: 'Sistema', itens: [
      { to: 'usuarios', rotulo: 'Usuários', ok: isAdmin, icone: 'usuarios', badge: pendentes },
    ] },
    { titulo: 'Pessoal', itens: [
      { to: 'minha-area', rotulo: isAtleta ? 'Minha área de atleta' : 'Área do atleta', ok: true, icone: 'raquete' },
      { to: 'conta', rotulo: 'Minha conta', ok: true, icone: 'engrenagem' },
    ] },
  ].map((g) => ({ ...g, itens: g.itens.filter((i) => i.ok) })).filter((g) => g.itens.length)

  const atual = grupos.flatMap((g) => g.itens).find((i) => local.pathname.startsWith(`/painel/${i.to}`))
  const papel = [isAdmin ? 'Federação' : perfil?.papel === 'clube' ? 'Academia' : null, isAtleta ? 'Atleta' : null].filter(Boolean).join(' · ') || 'Usuário'

  const menu = (
    <nav className="space-y-4">
      {grupos.map((g) => (
        <div key={g.titulo || 'topo'}>
          {g.titulo && <div className="px-3 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g.titulo}</div>}
          <ul className="space-y-0.5">
            {g.itens.map((i) => (
              <li key={i.to}>
                <NavLink to={i.to}
                  className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    isActive ? 'bg-navy-800 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-navy-900'}`}>
                  <Icone nome={i.icone} />
                  <span className="flex-1">{i.rotulo}</span>
                  {!!i.badge && <span className="badge bg-red-600 text-white">{i.badge}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700 cursor-pointer" onClick={sair}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 3H4v14h4M13 6l4 4-4 4M17 10H8" /></svg>
        Sair
      </button>
    </nav>
  )

  return (
    <div className="lg:grid lg:grid-cols-[230px_1fr] lg:gap-8">
      {/* Lateral (computador) */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-4 max-h-[calc(100vh-7rem)] overflow-y-auto pb-4">
          <div className="px-3">
            <div className="font-extrabold text-navy-900 truncate">{perfil?.nome || session.user.email}</div>
            <div className="text-xs text-slate-500">{papel}</div>
          </div>
          {menu}
        </div>
      </aside>

      {/* Celular: botão que abre o menu */}
      <div className="lg:hidden mb-4">
        <button className="card w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer" onClick={() => setMenuAberto(!menuAberto)}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          <span className="flex-1 font-semibold">{atual?.rotulo ?? 'Painel'}</span>
          <span className="text-xs text-slate-500">{papel}</span>
        </button>
        {menuAberto && <div className="card mt-2 p-3">{menu}</div>}
      </div>

      <div className="min-w-0">
        {perfil?.papel === 'clube' && !perfil.clube_id && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4">
            Seu usuário de academia ainda não foi vinculado a uma academia. Informe à FPET o e-mail <b>{session.user.email}</b>.
          </p>
        )}
        <Routes>
          <Route index element={<Navigate to={isAdmin ? 'adm' : isGestor ? 'torneios' : 'minha-area'} replace />} />
          <Route path="minha-area" element={<MinhaArea />} />
          <Route path="conta" element={<MinhaConta />} />
          {isGestor && (
            <>
              <Route path="torneios" element={<PainelTorneios />} />
              <Route path="torneios/:id" element={<TorneioEditor />} />
              <Route path="atletas" element={<PainelAtletas />} />
              <Route path="clubes" element={<PainelClubes />} />
              <Route path="filiacao" element={<PainelFiliacao />} />
              <Route path="financeiro" element={<PainelFinanceiro />} />
              <Route path="eventos" element={<PainelEventos />} />
            </>
          )}
          {isAdmin && (
            <>
              <Route path="adm" element={<PainelVisao />} />
              <Route path="publicacoes" element={<PainelPublicacoes />} />
              <Route path="categorias" element={<PainelCategorias />} />
              <Route path="pontuacao" element={<PainelPontuacao />} />
              <Route path="ranking" element={<PainelRanking />} />
              <Route path="usuarios" element={<PainelUsuarios />} />
            </>
          )}
        </Routes>
      </div>
    </div>
  )
}
