import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Ranking from './pages/Ranking'
import Torneios from './pages/Torneios'
import TorneioPagina from './pages/Torneio'
import Atletas from './pages/Atletas'
import AtletaPagina from './pages/Atleta'
import Clubes from './pages/Clubes'
import ClubePagina from './pages/Clube'
import Entrar from './pages/Entrar'
import Noticias from './pages/Noticias'
import Noticia from './pages/Noticia'
import Estatisticas from './pages/Estatisticas'
import Eventos from './pages/Eventos'
import EventoPagina from './pages/Evento'
import Painel from './pages/painel/Painel'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="ranking" element={<Ranking />} />
        <Route path="torneios" element={<Torneios />} />
        <Route path="torneios/:id" element={<TorneioPagina />} />
        <Route path="atletas" element={<Atletas />} />
        <Route path="atletas/:id" element={<AtletaPagina />} />
        <Route path="clubes" element={<Clubes />} />
        <Route path="clubes/:id" element={<ClubePagina />} />
        <Route path="estatisticas" element={<Estatisticas />} />
        <Route path="eventos" element={<Eventos />} />
        <Route path="eventos/:id" element={<EventoPagina />} />
        <Route path="noticias" element={<Noticias />} />
        <Route path="noticias/:id" element={<Noticia />} />
        <Route path="entrar" element={<Entrar />} />
        <Route path="painel/*" element={<Painel />} />
        <Route path="*" element={<div className="py-20 text-center text-slate-500">Página não encontrada.</div>} />
      </Route>
    </Routes>
  )
}
