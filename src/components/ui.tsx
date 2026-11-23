import { type ReactNode, useEffect } from 'react'
import { STATUS_TORNEIO, iniciais } from '../lib/tenis'
import type { StatusTorneio } from '../lib/types'

export function Spinner({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-500 text-sm">
      <span className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-navy-800 animate-spin" />
      {texto}
    </div>
  )
}

export function Erro({ msg }: { msg: string | null | undefined }) {
  if (!msg) return null
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{msg}</div>
}

export function Aviso({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{children}</div>
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-slate-500">{children}</div>
}

export function StatusBadge({ status }: { status: StatusTorneio }) {
  const s = STATUS_TORNEIO[status]
  return <span className={`badge ${s.cls}`}>{s.rotulo}</span>
}

export function AoVivo() {
  return (
    <span className="badge bg-red-600 text-white gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> AO VIVO
    </span>
  )
}

/** Seta de subida/descida no ranking */
export function Variacao({ atual, anterior }: { atual: number; anterior: number | null }) {
  if (anterior == null) return <span className="badge bg-sky-100 text-sky-700">novo</span>
  const d = anterior - atual
  if (d > 0) return <span className="text-emerald-600 font-semibold text-xs">▲ {d}</span>
  if (d < 0) return <span className="text-red-600 font-semibold text-xs">▼ {-d}</span>
  return <span className="text-slate-400 text-xs">=</span>
}

export function Avatar({ nome, url, tamanho = 40 }: { nome: string; url?: string | null; tamanho?: number }) {
  if (url) return <img src={url} alt={nome} className="rounded-full object-cover" style={{ width: tamanho, height: tamanho }} />
  return (
    <div
      className="rounded-full bg-navy-800 text-ball font-bold flex items-center justify-center shrink-0"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.38 }}
    >
      {iniciais(nome)}
    </div>
  )
}

export function Titulo({ children, sub, acoes }: { children: ReactNode; sub?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{children}</h1>
        {sub && <p className="text-slate-500 mt-1 text-sm">{sub}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  )
}

export function Modal({ aberto, titulo, onFechar, children, largo }: {
  aberto: boolean; titulo: string; onFechar: () => void; children: ReactNode; largo?: boolean
}) {
  useEffect(() => {
    if (!aberto) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [aberto, onFechar])
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-navy-950/50 p-4 overflow-y-auto" onMouseDown={onFechar}>
      <div
        className={`card w-full ${largo ? 'max-w-3xl' : 'max-w-lg'} my-8 p-5`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button className="text-slate-400 hover:text-slate-700 text-xl leading-none cursor-pointer" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Campo({ label, children, dica }: { label: string; children: ReactNode; dica?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {dica && <span className="block text-xs text-slate-500 mt-1">{dica}</span>}
    </label>
  )
}

export function Tabs<T extends string>({ itens, valor, onChange }: {
  itens: { valor: T; rotulo: ReactNode }[]; valor: T; onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
      {itens.map((i) => (
        <button key={i.valor} className={`tab ${valor === i.valor ? 'tab-active' : ''}`} onClick={() => onChange(i.valor)}>
          {i.rotulo}
        </button>
      ))}
    </div>
  )
}
