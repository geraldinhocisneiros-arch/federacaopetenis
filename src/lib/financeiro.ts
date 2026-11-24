import type { CategoriaLancamento, FormaPagamento, StatusFiliacao, StatusLancamento } from './types'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const moeda = (v: number | string | null | undefined) => brl.format(Number(v ?? 0))

/** "120,50" ou "120.50" -> 120.5 */
export function lerValor(txt: string): number {
  const limpo = txt.replace(/[^\d,.-]/g, '')
  const n = limpo.includes(',') ? Number(limpo.replace(/\./g, '').replace(',', '.')) : Number(limpo)
  return Number.isFinite(n) ? n : 0
}

export const anoAtual = () => new Date().getFullYear()
export const hoje = () => new Date().toISOString().slice(0, 10)

export const CATEGORIAS_LANC: Record<CategoriaLancamento, string> = {
  filiacao_atleta: 'Filiação de atleta',
  filiacao_academia: 'Filiação de academia',
  inscricao_torneio: 'Inscrição em torneio',
  taxa_torneio: 'Taxa federativa de torneio',
  patrocinio: 'Patrocínio',
  arbitragem: 'Arbitragem',
  premiacao: 'Premiação',
  estrutura: 'Estrutura / eventos',
  administrativo: 'Administrativo',
  outros: 'Outros',
}

export const FORMAS: Record<FormaPagamento, string> = {
  pix: 'PIX', boleto: 'Boleto', dinheiro: 'Dinheiro', transferencia: 'Transferência', cartao: 'Cartão',
  credito: 'Crédito', voucher: 'Voucher', outro: 'Outro',
}

export const STATUS_LANC: Record<StatusLancamento, { rotulo: string; cls: string }> = {
  aberto: { rotulo: 'Em aberto', cls: 'bg-amber-100 text-amber-800' },
  pago: { rotulo: 'Pago', cls: 'bg-emerald-100 text-emerald-800' },
  isento: { rotulo: 'Isento', cls: 'bg-sky-100 text-sky-800' },
  cancelado: { rotulo: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
}

export const STATUS_FIL: Record<StatusFiliacao, { rotulo: string; cls: string }> = {
  pendente: { rotulo: 'Aguardando pagamento', cls: 'bg-amber-100 text-amber-800' },
  ativa: { rotulo: 'Ativa', cls: 'bg-emerald-100 text-emerald-800' },
  isenta: { rotulo: 'Isenta', cls: 'bg-sky-100 text-sky-800' },
  cancelada: { rotulo: 'Cancelada', cls: 'bg-slate-100 text-slate-500' },
}
