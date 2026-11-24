import { useRef, useState } from 'react'
import { supabase, msgErro } from '../lib/supabase'

export type PastaArquivo = 'publicacoes' | 'eventos' | 'atletas' | 'clubes'

const BUCKET = 'imagens'
const LIMITE_MB = 10

/** Reduz a imagem no navegador (lado maior até `max` px, JPEG/WebP) antes de enviar */
async function reduzirImagem(arquivo: File, max: number): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) return arquivo
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => erro(new Error('Não foi possível ler a imagem.'))
      i.src = url
    })
    const escala = Math.min(1, max / Math.max(img.width, img.height))
    if (escala === 1 && arquivo.size < 600_000) return arquivo
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * escala)
    canvas.height = Math.round(img.height * escala)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const tipo = arquivo.type === 'image/png' ? 'image/webp' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, 0.85))
    return blob && blob.size < arquivo.size ? blob : arquivo
  } finally {
    URL.revokeObjectURL(url)
  }
}

const extensao = (tipo: string) =>
  ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' } as Record<string, string>)[tipo] ?? 'bin'

/**
 * Campo de imagem/anexo: envia o arquivo para o Storage do Supabase e devolve
 * o link público. Também aceita colar um link pronto.
 */
export default function EnviarArquivo({ valor, onChange, pasta, tipo = 'imagem', tamanhoMax = 1600, redondo }: {
  valor: string | null | undefined
  onChange: (url: string | null) => void
  pasta: PastaArquivo
  tipo?: 'imagem' | 'pdf' | 'qualquer'
  tamanhoMax?: number
  redondo?: boolean
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [colar, setColar] = useState(false)
  const aceita = tipo === 'imagem' ? 'image/jpeg,image/png,image/webp,image/gif'
    : tipo === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp,image/gif,application/pdf'
  const ehImagem = !!valor && !/\.pdf($|\?)/i.test(valor)

  async function enviar(arquivo: File) {
    setErro(null)
    if (!aceita.split(',').includes(arquivo.type)) { setErro('Tipo de arquivo não aceito.'); return }
    setEnviando(true)
    try {
      const corpo = arquivo.type.startsWith('image/') ? await reduzirImagem(arquivo, tamanhoMax) : arquivo
      if (corpo.size > LIMITE_MB * 1024 * 1024) throw new Error(`Arquivo maior que ${LIMITE_MB} MB.`)
      const caminho = `${pasta}/${new Date().getFullYear()}/${crypto.randomUUID()}.${extensao(corpo.type || arquivo.type)}`
      const { error } = await supabase.storage.from(BUCKET).upload(caminho, corpo, {
        contentType: corpo.type || arquivo.type, cacheControl: '31536000', upsert: false,
      })
      if (error) throw error
      onChange(supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl)
    } catch (e) {
      const m = msgErro(e)
      setErro(/row-level security|unauthorized|403/i.test(m) ? 'Você não tem permissão para enviar arquivos aqui.'
        : /bucket not found/i.test(m) ? 'Envio de arquivos ainda não configurado no banco (falta rodar o SQL).' : m)
    } finally {
      setEnviando(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {valor && (ehImagem
          ? <img src={valor} alt="" className={`h-16 w-16 object-cover border border-slate-200 ${redondo ? 'rounded-full' : 'rounded-lg'}`} />
          : <a href={valor} target="_blank" rel="noreferrer" className="link text-sm">📄 Ver arquivo</a>)}
        <input ref={entrada} type="file" accept={aceita} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f) }} />
        <button type="button" className="btn-ghost btn-sm" disabled={enviando} onClick={() => entrada.current?.click()}>
          {enviando ? 'Enviando…' : valor ? 'Trocar' : tipo === 'pdf' ? 'Enviar PDF' : tipo === 'imagem' ? 'Enviar foto' : 'Enviar arquivo'}
        </button>
        {valor && <button type="button" className="btn-danger btn-sm" onClick={() => onChange(null)}>Remover</button>}
        <button type="button" className="link text-xs cursor-pointer" onClick={() => setColar(!colar)}>{colar ? 'fechar' : 'ou colar um link'}</button>
      </div>
      {colar && <input className="input" value={valor ?? ''} onChange={(e) => onChange(e.target.value || null)} placeholder="https://…" />}
      {erro && <p className="text-xs text-red-700">{erro}</p>}
    </div>
  )
}
