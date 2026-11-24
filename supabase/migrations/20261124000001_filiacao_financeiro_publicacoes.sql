-- =====================================================================
-- FPET - Filiação (atletas e academias), financeiro (recebimentos,
-- pagamentos, baixas, créditos, isenções, vouchers), cobrança de
-- inscrição em torneio e publicações.
--
-- PIX/Boleto: a estrutura já guarda o identificador da cobrança no
-- provedor (gateway_*), mas a integração será configurada depois.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ajustes em tabelas existentes
-- ---------------------------------------------------------------------
alter table clubes add column if not exists cnpj text;
alter table clubes add column if not exists razao_social text;

alter table configuracoes
  add column if not exists exigir_filiacao_inscricao boolean not null default false,
  -- Taxa que a federação cobra do clube organizador por inscrição em torneio que pontua no ranking
  add column if not exists taxa_federacao_inscricao numeric(10,2) not null default 0,
  -- Dados para pagamento exibidos enquanto não há PIX/boleto automático
  add column if not exists instrucoes_pagamento text;

-- Quem recebe o valor das inscrições do torneio
alter table torneios
  add column if not exists inscricao_recebedor text not null default 'clube'
    check (inscricao_recebedor in ('clube', 'federacao'));

-- Valor numérico da inscrição (o campo texto antigo continua como observação)
alter table torneio_categorias
  add column if not exists taxa_inscricao numeric(10,2) not null default 0 check (taxa_inscricao >= 0);

-- ---------------------------------------------------------------------
-- Anuidades: valores de filiação por ano
-- ---------------------------------------------------------------------
create table anuidades (
  id          uuid primary key default gen_random_uuid(),
  ano         int not null check (ano between 2000 and 2100),
  tipo        text not null check (tipo in ('atleta', 'academia')),
  nome        text not null,            -- ex.: 'Atleta adulto', 'Atleta até 18 anos', 'Academia'
  valor       numeric(10,2) not null check (valor >= 0),
  vencimento  date,
  ativa       boolean not null default true,
  criado_em   timestamptz not null default now(),
  unique (ano, tipo, nome)
);

-- ---------------------------------------------------------------------
-- Filiações (uma por atleta/academia por ano)
-- ---------------------------------------------------------------------
create table filiacoes (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null check (tipo in ('atleta', 'academia')),
  atleta_id    uuid references atletas(id) on delete cascade,
  clube_id     uuid references clubes(id) on delete cascade,
  anuidade_id  uuid references anuidades(id) on delete restrict,
  ano          int not null,
  numero       text,                     -- nº de registro na federação
  -- pendente: aguardando pagamento · ativa: paga · isenta · cancelada
  status       text not null default 'pendente' check (status in ('pendente', 'ativa', 'isenta', 'cancelada')),
  ativada_em   timestamptz,
  observacoes  text,
  criado_em    timestamptz not null default now(),
  criado_por   uuid references auth.users(id) on delete set null,
  check ((tipo = 'atleta' and atleta_id is not null and clube_id is null)
      or (tipo = 'academia' and clube_id is not null and atleta_id is null))
);
create unique index filiacoes_atleta_ano_uq on filiacoes (atleta_id, ano) where atleta_id is not null and status <> 'cancelada';
create unique index filiacoes_clube_ano_uq on filiacoes (clube_id, ano) where clube_id is not null and status <> 'cancelada';
create index filiacoes_ano_idx on filiacoes (ano, tipo, status);

create sequence filiacao_numero_seq;

-- ---------------------------------------------------------------------
-- Vouchers (cupons de desconto)
-- ---------------------------------------------------------------------
create table fin_vouchers (
  id                uuid primary key default gen_random_uuid(),
  codigo            text not null unique check (codigo = upper(codigo) and length(codigo) >= 3),
  descricao         text,
  tipo              text not null default 'percentual' check (tipo in ('percentual', 'valor')),
  valor             numeric(10,2) not null check (valor > 0),
  -- Categorias de lançamento em que vale (null = todas)
  categorias        text[],
  validade          date,
  usos_max          int check (usos_max is null or usos_max > 0),
  usos              int not null default 0,
  -- null = voucher da federação; preenchido = voucher do clube (vale nas inscrições que ele recebe)
  emissor_clube_id  uuid references clubes(id) on delete cascade,
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now(),
  check (tipo <> 'percentual' or valor <= 100)
);

-- ---------------------------------------------------------------------
-- Lançamentos financeiros (contas a receber e a pagar)
-- ---------------------------------------------------------------------
create table fin_lancamentos (
  id                   uuid primary key default gen_random_uuid(),
  natureza             text not null default 'receber' check (natureza in ('receber', 'pagar')),
  categoria            text not null default 'outros' check (categoria in (
                         'filiacao_atleta', 'filiacao_academia', 'inscricao_torneio', 'taxa_torneio',
                         'patrocinio', 'arbitragem', 'premiacao', 'estrutura', 'administrativo', 'outros')),
  descricao            text not null,
  -- Recebedor: null = federação; preenchido = clube (ex.: inscrições do torneio do clube)
  recebedor_clube_id   uuid references clubes(id) on delete cascade,
  -- Quem paga (receber) / a quem pagar (pagar)
  atleta_id            uuid references atletas(id) on delete set null,
  clube_id             uuid references clubes(id) on delete set null,
  favorecido           text,           -- nome livre (fornecedor, patrocinador…)
  -- Origem
  filiacao_id          uuid references filiacoes(id) on delete cascade,
  inscricao_id         uuid references inscricoes(id) on delete set null,
  torneio_id           uuid references torneios(id) on delete set null,
  -- Valores
  valor                numeric(10,2) not null check (valor >= 0),
  desconto             numeric(10,2) not null default 0 check (desconto >= 0),
  voucher_id           uuid references fin_vouchers(id) on delete set null,
  vencimento           date,
  status               text not null default 'aberto' check (status in ('aberto', 'pago', 'isento', 'cancelado')),
  -- Baixa
  valor_pago           numeric(10,2),
  credito_usado        numeric(10,2) not null default 0,
  data_pagamento       date,
  forma_pagamento      text check (forma_pagamento in ('pix', 'boleto', 'dinheiro', 'transferencia', 'cartao', 'credito', 'voucher', 'outro')),
  comprovante_url      text,
  motivo_isencao       text,
  observacoes          text,
  baixado_por          uuid references auth.users(id) on delete set null,
  baixado_em           timestamptz,
  -- Integração futura PIX/boleto
  gateway              text,
  gateway_id           text,
  gateway_status       text,
  gateway_url          text,
  criado_em            timestamptz not null default now(),
  criado_por           uuid references auth.users(id) on delete set null,
  check (desconto <= valor)
);
create index fin_lanc_status_idx on fin_lancamentos (natureza, status, vencimento);
create index fin_lanc_recebedor_idx on fin_lancamentos (recebedor_clube_id);
create index fin_lanc_atleta_idx on fin_lancamentos (atleta_id);
create index fin_lanc_clube_idx on fin_lancamentos (clube_id);
create index fin_lanc_inscricao_idx on fin_lancamentos (inscricao_id);
create index fin_lanc_filiacao_idx on fin_lancamentos (filiacao_id);

-- ---------------------------------------------------------------------
-- Créditos (livro-razão): + entra crédito, − crédito usado
-- ---------------------------------------------------------------------
create table fin_creditos (
  id                 uuid primary key default gen_random_uuid(),
  atleta_id          uuid references atletas(id) on delete cascade,
  clube_id           uuid references clubes(id) on delete cascade,
  -- Quem deve o crédito: null = federação; preenchido = clube
  emissor_clube_id   uuid references clubes(id) on delete cascade,
  valor              numeric(10,2) not null check (valor <> 0),
  descricao          text not null,
  lancamento_id      uuid references fin_lancamentos(id) on delete cascade,
  criado_em          timestamptz not null default now(),
  criado_por         uuid references auth.users(id) on delete set null,
  check ((atleta_id is null) <> (clube_id is null))
);
create index fin_cred_atleta_idx on fin_creditos (atleta_id);
create index fin_cred_clube_idx on fin_creditos (clube_id);

-- ---------------------------------------------------------------------
-- Publicações (notícias, comunicados, editais…)
-- ---------------------------------------------------------------------
create table publicacoes (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  tipo           text not null default 'noticia' check (tipo in ('noticia', 'comunicado', 'resultado', 'regulamento', 'edital')),
  resumo         text,
  conteudo       text,
  imagem_url     text,
  anexo_url      text,
  destaque       boolean not null default false,
  publicado      boolean not null default false,
  publicado_em   timestamptz,
  torneio_id     uuid references torneios(id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  autor_id       uuid references auth.users(id) on delete set null
);
create index publicacoes_pub_idx on publicacoes (publicado, publicado_em desc);

create or replace function publicacoes_datas() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  if new.publicado and new.publicado_em is null then new.publicado_em := now(); end if;
  return new;
end $$;
create trigger publicacoes_datas before insert or update on publicacoes
  for each row execute function publicacoes_datas();

-- =====================================================================
-- Funções de apoio
-- =====================================================================
-- Pode operar (baixar, isentar…) um lançamento: federação em todos;
-- clube apenas nos que ele mesmo recebe.
create or replace function pode_gerir_lancamento(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from fin_lancamentos l
    where l.id = p_id and l.recebedor_clube_id is not null and l.recebedor_clube_id = meu_clube_id()
  );
$$;

-- Saldo de crédito de um atleta/academia junto a um emissor (federação = null)
create or replace function saldo_credito(p_atleta uuid, p_clube uuid, p_emissor uuid default null)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(valor), 0) from fin_creditos
  where (atleta_id = p_atleta or (p_atleta is null and atleta_id is null))
    and (clube_id = p_clube or (p_clube is null and clube_id is null))
    and emissor_clube_id is not distinct from p_emissor;
$$;

-- Atleta está com filiação válida no ano?
create or replace function atleta_filiado(p_atleta uuid, p_ano int default extract(year from current_date)::int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from filiacoes where atleta_id = p_atleta and ano = p_ano and status in ('ativa', 'isenta'));
$$;

-- Atualiza a filiação ligada a um lançamento conforme a situação do pagamento
create or replace function _sincronizar_filiacao(p_lanc uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l fin_lancamentos;
begin
  select * into l from fin_lancamentos where id = p_lanc;
  if l.filiacao_id is null then return; end if;
  update filiacoes f set
    status = case l.status when 'pago' then 'ativa' when 'isento' then 'isenta'
                           when 'cancelado' then 'cancelada' else 'pendente' end,
    ativada_em = case when l.status in ('pago', 'isento') then coalesce(f.ativada_em, now()) else null end,
    numero = case when l.status in ('pago', 'isento') and f.numero is null
                  then f.ano || '-' || lpad(nextval('filiacao_numero_seq')::text, 5, '0') else f.numero end
  where f.id = l.filiacao_id;
end $$;
revoke execute on function _sincronizar_filiacao(uuid) from public;

-- =====================================================================
-- Filiação
-- =====================================================================
-- Cria a filiação e a cobrança da anuidade. Valor 0 => já fica isenta.
create or replace function gerar_filiacao(p_anuidade uuid, p_atleta uuid default null, p_clube uuid default null, p_observacoes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  a      anuidades;
  v_fil  uuid;
  v_lanc uuid;
  v_nome text;
begin
  if not is_admin() then raise exception 'Apenas a federação gera filiações.'; end if;
  select * into a from anuidades where id = p_anuidade;
  if not found then raise exception 'Anuidade não encontrada.'; end if;
  if a.tipo = 'atleta' and p_atleta is null then raise exception 'Escolha o atleta.'; end if;
  if a.tipo = 'academia' and p_clube is null then raise exception 'Escolha a academia.'; end if;

  if a.tipo = 'atleta' then
    select nome into v_nome from atletas where id = p_atleta;
    if exists (select 1 from filiacoes where atleta_id = p_atleta and ano = a.ano and status <> 'cancelada') then
      raise exception '% já tem filiação em %.', v_nome, a.ano;
    end if;
  else
    select nome into v_nome from clubes where id = p_clube;
    if exists (select 1 from filiacoes where clube_id = p_clube and ano = a.ano and status <> 'cancelada') then
      raise exception '% já tem filiação em %.', v_nome, a.ano;
    end if;
  end if;

  insert into filiacoes (tipo, atleta_id, clube_id, anuidade_id, ano, observacoes, criado_por)
  values (a.tipo, case when a.tipo = 'atleta' then p_atleta end, case when a.tipo = 'academia' then p_clube end,
          a.id, a.ano, p_observacoes, auth.uid())
  returning id into v_fil;

  insert into fin_lancamentos (natureza, categoria, descricao, atleta_id, clube_id, filiacao_id, valor, vencimento, criado_por,
                               status, motivo_isencao, baixado_em, baixado_por)
  values ('receber', 'filiacao_' || a.tipo, 'Anuidade ' || a.ano || ' · ' || a.nome || ' · ' || v_nome,
          case when a.tipo = 'atleta' then p_atleta end, case when a.tipo = 'academia' then p_clube end,
          v_fil, a.valor, coalesce(a.vencimento, current_date + 10), auth.uid(),
          case when a.valor = 0 then 'isento' else 'aberto' end,
          case when a.valor = 0 then 'Anuidade sem custo' end,
          case when a.valor = 0 then now() end, case when a.valor = 0 then auth.uid() end)
  returning id into v_lanc;

  perform _sincronizar_filiacao(v_lanc);
  return v_fil;
end $$;

-- Gera filiações em lote (todas as academias ativas, ou os atletas informados)
create or replace function gerar_filiacoes_lote(p_anuidade uuid, p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  a anuidades;
  x uuid;
  n int := 0;
begin
  if not is_admin() then raise exception 'Apenas a federação gera filiações.'; end if;
  select * into a from anuidades where id = p_anuidade;
  if not found then raise exception 'Anuidade não encontrada.'; end if;
  if a.tipo = 'academia' then
    for x in select c.id from clubes c
             where c.ativo and (p_ids is null or c.id = any (p_ids))
               and not exists (select 1 from filiacoes f where f.clube_id = c.id and f.ano = a.ano and f.status <> 'cancelada')
    loop
      perform gerar_filiacao(a.id, null, x); n := n + 1;
    end loop;
  else
    if p_ids is null then raise exception 'Informe os atletas.'; end if;
    for x in select t.id from atletas t
             where t.id = any (p_ids)
               and not exists (select 1 from filiacoes f where f.atleta_id = t.id and f.ano = a.ano and f.status <> 'cancelada')
    loop
      perform gerar_filiacao(a.id, x, null); n := n + 1;
    end loop;
  end if;
  return n;
end $$;

-- =====================================================================
-- Financeiro: baixa, estorno, isenção, voucher, cancelamento
-- =====================================================================
-- Baixa de recebimento. Se p_usar_credito, abate primeiro do saldo de
-- crédito; se pagar a mais e p_excedente_credito, a sobra vira crédito.
create or replace function baixar_lancamento(
  p_id uuid, p_valor_pago numeric, p_data date default current_date, p_forma text default 'pix',
  p_usar_credito boolean default false, p_excedente_credito boolean default false,
  p_comprovante text default null, p_observacoes text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  l        fin_lancamentos;
  v_devido numeric;
  v_saldo  numeric := 0;
  v_cred   numeric := 0;
  v_sobra  numeric;
begin
  if not pode_gerir_lancamento(p_id) then raise exception 'Sem permissão para baixar este lançamento.'; end if;
  select * into l from fin_lancamentos where id = p_id for update;
  if l.status <> 'aberto' then raise exception 'Só é possível baixar lançamentos em aberto.'; end if;
  if coalesce(p_valor_pago, 0) < 0 then raise exception 'Valor pago inválido.'; end if;
  v_devido := l.valor - l.desconto;

  if p_usar_credito and l.natureza = 'receber' then
    v_saldo := saldo_credito(l.atleta_id, case when l.atleta_id is null then l.clube_id end, l.recebedor_clube_id);
    v_cred := least(greatest(v_saldo, 0), v_devido);
    if v_cred > 0 then
      insert into fin_creditos (atleta_id, clube_id, emissor_clube_id, valor, descricao, lancamento_id, criado_por)
      values (l.atleta_id, case when l.atleta_id is null then l.clube_id end, l.recebedor_clube_id, -v_cred,
              'Usado em: ' || l.descricao, l.id, auth.uid());
    end if;
  end if;

  if coalesce(p_valor_pago, 0) + v_cred < v_devido then
    raise exception 'Valor insuficiente: devido R$ %, pago R$ % + crédito R$ %.', v_devido, coalesce(p_valor_pago, 0), v_cred;
  end if;

  v_sobra := coalesce(p_valor_pago, 0) + v_cred - v_devido;
  if v_sobra > 0 and p_excedente_credito and l.natureza = 'receber' and (l.atleta_id is not null or l.clube_id is not null) then
    insert into fin_creditos (atleta_id, clube_id, emissor_clube_id, valor, descricao, lancamento_id, criado_por)
    values (l.atleta_id, case when l.atleta_id is null then l.clube_id end, l.recebedor_clube_id, v_sobra,
            'Pagamento a maior: ' || l.descricao, l.id, auth.uid());
  end if;

  update fin_lancamentos set
    status = 'pago', valor_pago = coalesce(p_valor_pago, 0), credito_usado = v_cred, data_pagamento = coalesce(p_data, current_date),
    forma_pagamento = case when coalesce(p_valor_pago, 0) = 0 and v_cred > 0 then 'credito' else p_forma end,
    comprovante_url = coalesce(p_comprovante, comprovante_url),
    observacoes = coalesce(p_observacoes, observacoes),
    baixado_por = auth.uid(), baixado_em = now()
  where id = p_id;
  perform _sincronizar_filiacao(p_id);
end $$;

-- Desfaz a baixa/isenção: volta para "aberto" e devolve crédito/voucher usados
create or replace function estornar_lancamento(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l fin_lancamentos;
begin
  if not pode_gerir_lancamento(p_id) then raise exception 'Sem permissão.'; end if;
  select * into l from fin_lancamentos where id = p_id for update;
  if l.status not in ('pago', 'isento') then raise exception 'Só é possível estornar lançamentos pagos ou isentos.'; end if;
  delete from fin_creditos where lancamento_id = p_id;
  update fin_lancamentos set status = 'aberto', valor_pago = null, credito_usado = 0, data_pagamento = null,
    forma_pagamento = null, motivo_isencao = null, baixado_por = null, baixado_em = null
  where id = p_id;
  perform _sincronizar_filiacao(p_id);
end $$;

create or replace function isentar_lancamento(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare l fin_lancamentos;
begin
  if not pode_gerir_lancamento(p_id) then raise exception 'Sem permissão.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo da isenção.'; end if;
  select * into l from fin_lancamentos where id = p_id for update;
  if l.status <> 'aberto' then raise exception 'Só é possível isentar lançamentos em aberto.'; end if;
  update fin_lancamentos set status = 'isento', motivo_isencao = p_motivo, baixado_por = auth.uid(), baixado_em = now()
  where id = p_id;
  perform _sincronizar_filiacao(p_id);
end $$;

create or replace function cancelar_lancamento(p_id uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare l fin_lancamentos;
begin
  if not pode_gerir_lancamento(p_id) then raise exception 'Sem permissão.'; end if;
  select * into l from fin_lancamentos where id = p_id for update;
  if l.status <> 'aberto' then raise exception 'Estorne a baixa antes de cancelar.'; end if;
  if l.voucher_id is not null then update fin_vouchers set usos = greatest(usos - 1, 0) where id = l.voucher_id; end if;
  update fin_lancamentos set status = 'cancelado',
    observacoes = concat_ws(' · ', observacoes, 'Cancelado' || coalesce(': ' || p_motivo, ''))
  where id = p_id;
  perform _sincronizar_filiacao(p_id);
end $$;

-- Aplica um voucher a um lançamento em aberto. Se zerar o valor, já baixa.
create or replace function aplicar_voucher(p_id uuid, p_codigo text) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  l  fin_lancamentos;
  v  fin_vouchers;
  d  numeric;
begin
  if not pode_gerir_lancamento(p_id) then raise exception 'Sem permissão.'; end if;
  select * into l from fin_lancamentos where id = p_id for update;
  if l.status <> 'aberto' then raise exception 'O lançamento não está em aberto.'; end if;
  if l.natureza <> 'receber' then raise exception 'Voucher vale apenas para recebimentos.'; end if;
  if l.voucher_id is not null then raise exception 'Este lançamento já tem voucher.'; end if;
  select * into v from fin_vouchers where codigo = upper(trim(p_codigo)) for update;
  if not found or not v.ativo then raise exception 'Voucher inválido.'; end if;
  if v.validade is not null and v.validade < current_date then raise exception 'Voucher vencido.'; end if;
  if v.usos_max is not null and v.usos >= v.usos_max then raise exception 'Voucher esgotado.'; end if;
  if v.emissor_clube_id is distinct from l.recebedor_clube_id then raise exception 'Voucher não vale para esta cobrança.'; end if;
  if v.categorias is not null and not (l.categoria = any (v.categorias)) then raise exception 'Voucher não vale para esta categoria de cobrança.'; end if;

  d := case v.tipo when 'percentual' then round(l.valor * v.valor / 100, 2) else least(v.valor, l.valor) end;
  update fin_vouchers set usos = usos + 1 where id = v.id;
  update fin_lancamentos set desconto = d, voucher_id = v.id where id = p_id;
  if d >= l.valor then
    update fin_lancamentos set status = 'pago', valor_pago = 0, data_pagamento = current_date, forma_pagamento = 'voucher',
      baixado_por = auth.uid(), baixado_em = now() where id = p_id;
    perform _sincronizar_filiacao(p_id);
  end if;
  return d;
end $$;

create or replace function remover_voucher(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l fin_lancamentos;
begin
  if not pode_gerir_lancamento(p_id) then raise exception 'Sem permissão.'; end if;
  select * into l from fin_lancamentos where id = p_id for update;
  if l.status <> 'aberto' then raise exception 'Estorne a baixa antes de remover o voucher.'; end if;
  if l.voucher_id is null then return; end if;
  update fin_vouchers set usos = greatest(usos - 1, 0) where id = l.voucher_id;
  update fin_lancamentos set desconto = 0, voucher_id = null where id = p_id;
end $$;

-- Crédito manual (bônus, devolução…). Valor negativo debita.
create or replace function lancar_credito(p_atleta uuid, p_clube uuid, p_valor numeric, p_descricao text)
returns void language plpgsql security definer set search_path = public as $$
declare v_emissor uuid := case when is_admin() then null else meu_clube_id() end;
begin
  if not e_gestor() then raise exception 'Sem permissão.'; end if;
  if (p_atleta is null) = (p_clube is null) then raise exception 'Informe o atleta ou a academia.'; end if;
  if coalesce(p_valor, 0) = 0 then raise exception 'Informe o valor.'; end if;
  if p_valor < 0 and saldo_credito(p_atleta, p_clube, v_emissor) + p_valor < 0 then
    raise exception 'Saldo de crédito insuficiente.';
  end if;
  insert into fin_creditos (atleta_id, clube_id, emissor_clube_id, valor, descricao, criado_por)
  values (p_atleta, p_clube, v_emissor, p_valor, p_descricao, auth.uid());
end $$;

-- Taxa federativa: cobra do clube organizador (nº de inscrições × taxa)
create or replace function gerar_taxa_federacao_torneio(p_torneio uuid, p_valor_unit numeric default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  t      torneios;
  v_qtd  int;
  v_unit numeric;
  v_id   uuid;
begin
  if not is_admin() then raise exception 'Apenas a federação.'; end if;
  select * into t from torneios where id = p_torneio;
  if not found then raise exception 'Torneio não encontrado.'; end if;
  if exists (select 1 from fin_lancamentos where torneio_id = p_torneio and categoria = 'taxa_torneio'
             and recebedor_clube_id is null and status <> 'cancelado') then
    raise exception 'A taxa federativa deste torneio já foi gerada.';
  end if;
  v_unit := coalesce(p_valor_unit, (select taxa_federacao_inscricao from configuracoes where id = 1));
  select count(*) into v_qtd from inscricoes i join torneio_categorias tc on tc.id = i.torneio_categoria_id
  where tc.torneio_id = p_torneio;
  if v_unit <= 0 or v_qtd = 0 then raise exception 'Nada a cobrar (taxa R$ % × % inscrições).', v_unit, v_qtd; end if;
  insert into fin_lancamentos (natureza, categoria, descricao, clube_id, torneio_id, valor, vencimento, criado_por)
  values ('receber', 'taxa_torneio', 'Taxa federativa · ' || t.nome || ' · ' || v_qtd || ' inscrições × R$ ' || v_unit,
          t.clube_id, t.id, v_qtd * v_unit, current_date + 15, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- =====================================================================
-- Inscrições: exigência de filiação e cobrança automática
-- =====================================================================
create or replace function inscricao_validar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ano int;
  v_nome text;
begin
  if (select exigir_filiacao_inscricao from configuracoes where id = 1) then
    select extract(year from coalesce(t.data_inicio, current_date))::int into v_ano
    from torneio_categorias tc join torneios t on t.id = tc.torneio_id where tc.id = new.torneio_categoria_id;
    if not atleta_filiado(new.atleta_id, v_ano) then
      select nome into v_nome from atletas where id = new.atleta_id;
      raise exception '% não tem filiação ativa em %.', v_nome, v_ano;
    end if;
    if new.parceiro_id is not null and not atleta_filiado(new.parceiro_id, v_ano) then
      select nome into v_nome from atletas where id = new.parceiro_id;
      raise exception '% não tem filiação ativa em %.', v_nome, v_ano;
    end if;
  end if;
  return new;
end $$;
create trigger inscricoes_validar before insert on inscricoes
  for each row execute function inscricao_validar();

-- Gera a cobrança da inscrição (uma por atleta; em duplas, uma para cada)
create or replace function inscricao_cobranca() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tc   torneio_categorias;
  t    torneios;
  cat  categorias;
  a    uuid;
begin
  select * into tc from torneio_categorias where id = new.torneio_categoria_id;
  if tc.taxa_inscricao <= 0 then return new; end if;
  select * into t from torneios where id = tc.torneio_id;
  select * into cat from categorias where id = tc.categoria_id;
  foreach a in array array_remove(array[new.atleta_id, new.parceiro_id], null) loop
    insert into fin_lancamentos (natureza, categoria, descricao, recebedor_clube_id, atleta_id, inscricao_id, torneio_id,
                                 valor, vencimento, criado_por)
    values ('receber', 'inscricao_torneio',
            'Inscrição · ' || t.nome || ' · ' || cat.nome || ' · ' || (select nome from atletas where id = a),
            case when t.inscricao_recebedor = 'clube' then t.clube_id end, a, new.id, t.id,
            tc.taxa_inscricao, coalesce(t.data_inicio, current_date + 7), auth.uid());
  end loop;
  return new;
end $$;
create trigger inscricoes_cobranca after insert on inscricoes
  for each row execute function inscricao_cobranca();

-- Ao remover a inscrição: cobrança aberta é cancelada; paga vira crédito
create or replace function inscricao_remover_cobranca() returns trigger
language plpgsql security definer set search_path = public as $$
declare l fin_lancamentos;
begin
  for l in select * from fin_lancamentos where inscricao_id = old.id loop
    if l.status = 'aberto' then
      update fin_lancamentos set status = 'cancelado',
        observacoes = concat_ws(' · ', observacoes, 'Inscrição removida') where id = l.id;
    elsif l.status = 'pago' and (l.valor_pago + l.credito_usado) > 0 and l.atleta_id is not null then
      insert into fin_creditos (atleta_id, emissor_clube_id, valor, descricao, criado_por)
      values (l.atleta_id, l.recebedor_clube_id, l.valor_pago + l.credito_usado, 'Crédito por inscrição removida: ' || l.descricao, auth.uid());
      update fin_lancamentos set observacoes = concat_ws(' · ', observacoes, 'Inscrição removida: valor convertido em crédito')
      where id = l.id;
    end if;
  end loop;
  return old;
end $$;
create trigger inscricoes_remover_cobranca before delete on inscricoes
  for each row execute function inscricao_remover_cobranca();

-- =====================================================================
-- Visões
-- =====================================================================
create view fin_lancamentos_detalhe with (security_invoker = true) as
select l.*,
       l.valor - l.desconto as valor_devido,
       (l.status = 'aberto' and l.vencimento < current_date) as vencido,
       a.nome  as atleta_nome,
       c.nome  as clube_nome,
       r.nome  as recebedor_nome,
       t.nome  as torneio_nome,
       v.codigo as voucher_codigo,
       coalesce(a.nome, c.nome, l.favorecido) as pessoa
from fin_lancamentos l
left join atletas a on a.id = l.atleta_id
left join clubes c on c.id = l.clube_id
left join clubes r on r.id = l.recebedor_clube_id
left join torneios t on t.id = l.torneio_id
left join fin_vouchers v on v.id = l.voucher_id;

create view fin_saldos_credito with (security_invoker = true) as
select cr.atleta_id, cr.clube_id, cr.emissor_clube_id,
       coalesce(a.nome, c.nome) as nome,
       e.nome as emissor_nome,
       sum(cr.valor) as saldo,
       max(cr.criado_em) as ultimo_movimento
from fin_creditos cr
left join atletas a on a.id = cr.atleta_id
left join clubes c on c.id = cr.clube_id
left join clubes e on e.id = cr.emissor_clube_id
group by cr.atleta_id, cr.clube_id, cr.emissor_clube_id, a.nome, c.nome, e.nome;

create view filiacoes_detalhe with (security_invoker = true) as
select f.*,
       coalesce(a.nome, c.nome) as nome,
       a.clube_id as atleta_clube_id,
       ac.nome as atleta_clube_nome,
       an.nome as anuidade_nome,
       l.id as lancamento_id,
       l.valor - l.desconto as valor_devido,
       l.vencimento,
       l.status as status_pagamento
from filiacoes f
left join atletas a on a.id = f.atleta_id
left join clubes ac on ac.id = a.clube_id
left join clubes c on c.id = f.clube_id
left join anuidades an on an.id = f.anuidade_id
left join lateral (
  select * from fin_lancamentos x where x.filiacao_id = f.id order by x.criado_em desc limit 1
) l on true;

-- Resumo para a área ADM
create or replace function resumo_adm(p_ano int default extract(year from current_date)::int)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not is_admin() then null else jsonb_build_object(
    'atletas_filiados', (select count(*) from filiacoes where tipo = 'atleta' and ano = p_ano and status in ('ativa','isenta')),
    'atletas_pendentes', (select count(*) from filiacoes where tipo = 'atleta' and ano = p_ano and status = 'pendente'),
    'academias_filiadas', (select count(*) from filiacoes where tipo = 'academia' and ano = p_ano and status in ('ativa','isenta')),
    'academias_pendentes', (select count(*) from filiacoes where tipo = 'academia' and ano = p_ano and status = 'pendente'),
    'academias_ativas', (select count(*) from clubes where ativo),
    'a_receber', (select coalesce(sum(valor - desconto), 0) from fin_lancamentos where natureza = 'receber' and status = 'aberto' and recebedor_clube_id is null),
    'vencido', (select coalesce(sum(valor - desconto), 0) from fin_lancamentos where natureza = 'receber' and status = 'aberto' and recebedor_clube_id is null and vencimento < current_date),
    'recebido_mes', (select coalesce(sum(valor_pago), 0) from fin_lancamentos where natureza = 'receber' and status = 'pago' and recebedor_clube_id is null and date_trunc('month', data_pagamento) = date_trunc('month', current_date)),
    'recebido_ano', (select coalesce(sum(valor_pago), 0) from fin_lancamentos where natureza = 'receber' and status = 'pago' and recebedor_clube_id is null and extract(year from data_pagamento) = p_ano),
    'a_pagar', (select coalesce(sum(valor - desconto), 0) from fin_lancamentos where natureza = 'pagar' and status = 'aberto' and recebedor_clube_id is null),
    'pago_ano', (select coalesce(sum(valor_pago), 0) from fin_lancamentos where natureza = 'pagar' and status = 'pago' and recebedor_clube_id is null and extract(year from data_pagamento) = p_ano),
    'isencoes_ano', (select coalesce(sum(valor), 0) from fin_lancamentos where status = 'isento' and recebedor_clube_id is null and extract(year from baixado_em) = p_ano),
    'creditos_em_aberto', (select coalesce(sum(valor), 0) from fin_creditos where emissor_clube_id is null),
    'torneios_homologar', (select count(*) from torneios where status = 'encerrado'),
    'torneios_andamento', (select count(*) from torneios where status in ('inscricoes','em_andamento')),
    'publicacoes_rascunho', (select count(*) from publicacoes where not publicado)
  ) end;
$$;

-- =====================================================================
-- Segurança (RLS)
-- =====================================================================
alter table anuidades        enable row level security;
alter table filiacoes        enable row level security;
alter table fin_vouchers     enable row level security;
alter table fin_lancamentos  enable row level security;
alter table fin_creditos     enable row level security;
alter table publicacoes      enable row level security;

-- Anuidades e filiações: consulta pública (comprova se o atleta é filiado)
create policy leitura_publica on anuidades for select using (true);
create policy admin_escreve on anuidades for all using (is_admin()) with check (is_admin());
create policy leitura_publica on filiacoes for select using (true);
create policy admin_escreve on filiacoes for all using (is_admin()) with check (is_admin());

-- Vouchers: federação gere os seus; clube gere os dele
create policy gestor_le on fin_vouchers for select
  using (is_admin() or emissor_clube_id = meu_clube_id());
create policy gestor_escreve on fin_vouchers for all
  using (is_admin() or (emissor_clube_id is not null and emissor_clube_id = meu_clube_id()))
  with check (is_admin() or (emissor_clube_id is not null and emissor_clube_id = meu_clube_id()));

-- Lançamentos: federação vê tudo; clube vê o que recebe e o que deve
create policy gestor_le on fin_lancamentos for select
  using (is_admin() or recebedor_clube_id = meu_clube_id() or clube_id = meu_clube_id());
create policy gestor_insere on fin_lancamentos for insert
  with check (is_admin() or (recebedor_clube_id is not null and recebedor_clube_id = meu_clube_id()));
create policy gestor_edita on fin_lancamentos for update
  using (pode_gerir_lancamento(id)) with check (is_admin() or recebedor_clube_id = meu_clube_id());
create policy admin_apaga on fin_lancamentos for delete using (is_admin());
-- Situação/valores só mudam pelas funções (baixa, estorno, isenção, voucher)
revoke update on fin_lancamentos from anon, authenticated;
grant update (descricao, categoria, atleta_id, clube_id, favorecido, valor, vencimento, comprovante_url, observacoes)
  on fin_lancamentos to authenticated;

create or replace function fin_lancamento_proteger() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.status <> 'aberto' and (new.valor <> old.valor) then
    raise exception 'Estorne a baixa antes de alterar o valor.';
  end if;
  if new.valor < old.desconto then raise exception 'Valor menor que o desconto aplicado.'; end if;
  return new;
end $$;
create trigger fin_lancamentos_proteger before update on fin_lancamentos
  for each row execute function fin_lancamento_proteger();

-- Créditos: só por funções; leitura para gestores envolvidos
create policy gestor_le on fin_creditos for select
  using (is_admin() or emissor_clube_id = meu_clube_id() or clube_id = meu_clube_id());
revoke insert, update, delete on fin_creditos from anon, authenticated;

-- Publicações
create policy leitura on publicacoes for select using (publicado or is_admin());
create policy admin_escreve on publicacoes for all using (is_admin()) with check (is_admin());

revoke execute on function gerar_filiacao(uuid, uuid, uuid, text), gerar_filiacoes_lote(uuid, uuid[]),
  baixar_lancamento(uuid, numeric, date, text, boolean, boolean, text, text), estornar_lancamento(uuid),
  isentar_lancamento(uuid, text), cancelar_lancamento(uuid, text), aplicar_voucher(uuid, text), remover_voucher(uuid),
  lancar_credito(uuid, uuid, numeric, text), gerar_taxa_federacao_torneio(uuid, numeric), resumo_adm(int)
  from anon;
