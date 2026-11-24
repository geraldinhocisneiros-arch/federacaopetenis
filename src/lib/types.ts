export type Papel = 'pendente' | 'clube' | 'admin'
export type StatusTorneio = 'rascunho' | 'inscricoes' | 'em_andamento' | 'encerrado' | 'homologado'
export type Fase = 'campeao' | 'final' | 'semifinal' | 'quartas' | 'oitavas' | 'r32' | 'r64' | 'r128'

export interface Perfil {
  id: string
  nome: string | null
  email: string | null
  papel: Papel
  clube_id: string | null
}

export interface Clube {
  id: string
  nome: string
  sigla: string | null
  cidade: string | null
  bairro: string | null
  endereco: string | null
  telefone: string | null
  email: string | null
  instagram: string | null
  site: string | null
  responsavel: string | null
  num_quadras: number | null
  tipo_piso: string | null
  logo_url: string | null
  observacoes: string | null
  cnpj: string | null
  razao_social: string | null
  ativo: boolean
}

export interface Atleta {
  id: string
  nome: string
  apelido: string | null
  sexo: 'M' | 'F' | null
  data_nascimento: string | null
  cidade: string | null
  clube_id: string | null
  foto_url: string | null
  ativo: boolean
}

export interface AtletaContato {
  atleta_id: string
  cpf: string | null
  telefone: string | null
  email: string | null
  observacoes: string | null
}

export interface Categoria {
  id: string
  nome: string
  genero: 'M' | 'F' | 'X'
  modalidade: 'simples' | 'duplas'
  descricao: string | null
  ordem: number
  ativa: boolean
}

export interface TabelaPontuacao {
  id: string
  nome: string
  descricao: string | null
  ativa: boolean
}

export interface Torneio {
  id: string
  clube_id: string
  nome: string
  descricao: string | null
  local: string | null
  data_inicio: string | null
  data_fim: string | null
  status: StatusTorneio
  pontua_ranking: boolean
  tabela_pontuacao_id: string | null
  info_inscricao: string | null
  inscricao_recebedor: 'clube' | 'federacao'
  regulamento: string | null
  homologado_em: string | null
}

export interface TorneioCategoria {
  id: string
  torneio_id: string
  categoria_id: string
  formato: 'eliminatoria' | 'eliminatoria_consolacao' | 'grupos'
  formato_partida: string
  valor_inscricao: string | null
  taxa_inscricao: number
  num_cabecas: number | null
  bye_conta_vitoria: boolean
  wo_vitoria_conta_a_partir: Fase | null
  wo_perdedor_pontua: boolean
  tabela_pontuacao_id: string | null
  tamanho_chave: number | null
  chave_gerada_em: string | null
}

export interface InscricaoDetalhe {
  id: string
  torneio_categoria_id: string
  atleta_id: string
  parceiro_id: string | null
  pontos_ranking: number | null
  posicao_ranking: number | null
  cabeca: number | null
  posicao_chave: number | null
  atleta_nome: string
  parceiro_nome: string | null
  nome_exibicao: string
  clube_nome: string | null
}

export type Placar = [number, number][]

export interface Partida {
  id: string
  torneio_categoria_id: string
  rodada: number
  ordem: number
  inscricao1_id: string | null
  inscricao2_id: string | null
  vencedor_id: string | null
  placar: Placar
  tipo_resultado: 'normal' | 'wo' | 'desistencia' | 'bye' | null
  data: string | null
  horario: string | null
  quadra: string | null
  em_quadra: boolean
  atualizado_em: string
}

export interface PartidaDetalhe extends Partida {
  torneio_id: string
  categoria_id: string
  tamanho_chave: number | null
  torneio_nome: string
  clube_id: string
  torneio_status: StatusTorneio
  categoria_nome: string
  jogador1: string | null
  cabeca1: number | null
  atleta1_id: string | null
  parceiro1_id: string | null
  jogador2: string | null
  cabeca2: number | null
  atleta2_id: string | null
  parceiro2_id: string | null
}

export interface RankingLinha {
  posicao: number
  atleta_id: string
  nome: string
  clube_id: string | null
  clube_nome: string | null
  pontos: number
  torneios: number
  posicao_anterior: number | null
}

// ---------------------------------------------------------------------
// Filiação, financeiro e publicações
// ---------------------------------------------------------------------
export type TipoFiliacao = 'atleta' | 'academia'
export type StatusFiliacao = 'pendente' | 'ativa' | 'isenta' | 'cancelada'
export type StatusLancamento = 'aberto' | 'pago' | 'isento' | 'cancelado'
export type FormaPagamento = 'pix' | 'boleto' | 'dinheiro' | 'transferencia' | 'cartao' | 'credito' | 'voucher' | 'outro'
export type CategoriaLancamento =
  | 'filiacao_atleta' | 'filiacao_academia' | 'inscricao_torneio' | 'taxa_torneio' | 'patrocinio'
  | 'arbitragem' | 'premiacao' | 'estrutura' | 'administrativo' | 'outros'

export interface Configuracoes {
  id: number
  janela_semanas: number | null
  melhores_resultados: number | null
  criterio_desempate: string | null
  observacoes: string | null
  exigir_filiacao_inscricao: boolean
  taxa_federacao_inscricao: number
  instrucoes_pagamento: string | null
}

export interface Anuidade {
  id: string
  ano: number
  tipo: TipoFiliacao
  nome: string
  valor: number
  vencimento: string | null
  ativa: boolean
}

export interface FiliacaoDetalhe {
  id: string
  tipo: TipoFiliacao
  atleta_id: string | null
  clube_id: string | null
  anuidade_id: string | null
  ano: number
  numero: string | null
  status: StatusFiliacao
  ativada_em: string | null
  observacoes: string | null
  nome: string
  atleta_clube_id: string | null
  atleta_clube_nome: string | null
  anuidade_nome: string | null
  lancamento_id: string | null
  valor_devido: number | null
  vencimento: string | null
  status_pagamento: StatusLancamento | null
}

export interface Lancamento {
  id: string
  natureza: 'receber' | 'pagar'
  categoria: CategoriaLancamento
  descricao: string
  recebedor_clube_id: string | null
  atleta_id: string | null
  clube_id: string | null
  favorecido: string | null
  filiacao_id: string | null
  inscricao_id: string | null
  torneio_id: string | null
  valor: number
  desconto: number
  voucher_id: string | null
  vencimento: string | null
  status: StatusLancamento
  valor_pago: number | null
  credito_usado: number
  data_pagamento: string | null
  forma_pagamento: FormaPagamento | null
  comprovante_url: string | null
  motivo_isencao: string | null
  observacoes: string | null
  baixado_em: string | null
  gateway_url: string | null
  criado_em: string
}

export interface LancamentoDetalhe extends Lancamento {
  valor_devido: number
  vencido: boolean
  atleta_nome: string | null
  clube_nome: string | null
  recebedor_nome: string | null
  torneio_nome: string | null
  voucher_codigo: string | null
  pessoa: string | null
}

export interface Voucher {
  id: string
  codigo: string
  descricao: string | null
  tipo: 'percentual' | 'valor'
  valor: number
  categorias: CategoriaLancamento[] | null
  validade: string | null
  usos_max: number | null
  usos: number
  emissor_clube_id: string | null
  ativo: boolean
}

export interface SaldoCredito {
  atleta_id: string | null
  clube_id: string | null
  emissor_clube_id: string | null
  nome: string
  emissor_nome: string | null
  saldo: number
  ultimo_movimento: string
}

export interface Publicacao {
  id: string
  titulo: string
  tipo: 'noticia' | 'comunicado' | 'resultado' | 'regulamento' | 'edital'
  resumo: string | null
  conteudo: string | null
  imagem_url: string | null
  anexo_url: string | null
  destaque: boolean
  publicado: boolean
  publicado_em: string | null
  torneio_id: string | null
  autor_id: string | null
  criado_em: string
}
