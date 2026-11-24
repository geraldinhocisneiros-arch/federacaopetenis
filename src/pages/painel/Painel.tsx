import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { Aviso, Spinner } from '../../components/ui'
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

export default function Painel() {
  const { session, perfil, carregando, isAdmin, isGestor, sair } = useAuth()
  if (carregando) return <Spinner />
  if (!session) return <Navigate to="/entrar" replace />

  const itens = [
    { to: 'adm', rotulo: 'Área ADM', ok: isAdmin },
    { to: 'torneios', rotulo: 'Torneios', ok: isGestor },
    { to: 'atletas', rotulo: 'Atletas', ok: isGestor },
    { to: 'clubes', rotulo: isAdmin ? 'Academias' : 'Minha academia', ok: isGestor },
    { to: 'filiacao', rotulo: 'Filiação', ok: isGestor },
    { to: 'financeiro', rotulo: 'Financeiro', ok: isGestor },
    { to: 'publicacoes', rotulo: 'Publicações', ok: isAdmin },
    { to: 'categorias', rotulo: 'Categorias', ok: isAdmin },
    { to: 'pontuacao', rotulo: 'Pontuação', ok: isAdmin },
    { to: 'ranking', rotulo: 'Ranking', ok: isAdmin },
    { to: 'usuarios', rotulo: 'Usuários', ok: isAdmin },
    { to: 'conta', rotulo: 'Minha conta', ok: true },
  ].filter((i) => i.ok)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-extrabold">Painel</h1>
          <p className="text-sm text-slate-500">
            {perfil?.nome || session.user.email} · {isAdmin ? 'Federação' : perfil?.papel === 'clube' ? 'Clube' : 'Acesso pendente'}
          </p>
        </div>
        <button className="btn-ghost btn-sm" onClick={sair}>Sair</button>
      </div>

      {!isGestor ? (
        <Aviso>
          Seu cadastro foi recebido. A federação precisa vincular o seu usuário a um clube para liberar o acesso.
          Informe à FPET o e-mail <b>{session.user.email}</b>.
        </Aviso>
      ) : (
        <>
          <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 mb-6 -mx-1 px-1">
            {itens.map((i) => (
              <NavLink key={i.to} to={i.to}
                className={({ isActive }) => `px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px ${
                  isActive ? 'border-navy-800 text-navy-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                {i.rotulo}
              </NavLink>
            ))}
          </nav>
          <Routes>
            <Route index element={<Navigate to={isAdmin ? 'adm' : 'torneios'} replace />} />
            <Route path="torneios" element={<PainelTorneios />} />
            <Route path="torneios/:id" element={<TorneioEditor />} />
            <Route path="atletas" element={<PainelAtletas />} />
            <Route path="clubes" element={<PainelClubes />} />
            <Route path="conta" element={<MinhaConta />} />
            <Route path="filiacao" element={<PainelFiliacao />} />
            <Route path="financeiro" element={<PainelFinanceiro />} />
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
        </>
      )}
    </div>
  )
}
