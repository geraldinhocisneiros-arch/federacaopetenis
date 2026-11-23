import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Atleta } from '../lib/types'

type Resultado = Atleta & { clubes: { nome: string } | null }

/** Campo de busca de atleta com sugestões; permite cadastrar novo */
export default function AtletaBusca({ onEscolher, onNovo, excluir = [], placeholder = 'Buscar atleta pelo nome…' }: {
  onEscolher: (a: Atleta) => void
  onNovo?: (nome: string) => void
  excluir?: string[]
  placeholder?: string
}) {
  const [termo, setTermo] = useState('')
  const [res, setRes] = useState<Resultado[]>([])
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (termo.trim().length < 2) { setRes([]); return }
    const h = setTimeout(async () => {
      const { data } = await supabase.from('atletas').select('*, clubes(nome)').ilike('nome', `%${termo.trim()}%`).order('nome').limit(10)
      setRes((data as Resultado[]) ?? [])
    }, 250)
    return () => clearTimeout(h)
  }, [termo])

  const lista = res.filter((a) => !excluir.includes(a.id))

  return (
    <div className="relative">
      <input className="input" placeholder={placeholder} value={termo}
        onChange={(e) => { setTermo(e.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 200)} />
      {aberto && termo.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full card shadow-lg max-h-72 overflow-y-auto">
          {lista.map((a) => (
            <button key={a.id} type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm cursor-pointer"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onEscolher(a); setTermo(''); setAberto(false) }}>
              <span className="font-medium">{a.nome}</span>
              <span className="text-xs text-slate-500 ml-2">{a.clubes?.nome ?? ''}</span>
            </button>
          ))}
          {!lista.length && <div className="px-3 py-2 text-sm text-slate-500">Nenhum atleta encontrado.</div>}
          {onNovo && (
            <button type="button" className="w-full text-left px-3 py-2 text-sm font-semibold text-wave border-t border-slate-100 hover:bg-sky-50 cursor-pointer"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onNovo(termo.trim()); setTermo(''); setAberto(false) }}>
              + Cadastrar “{termo.trim()}” como novo atleta
            </button>
          )}
        </div>
      )}
    </div>
  )
}
