-- =====================================================================
-- FPET - Área do atleta (login vinculado ao cadastro), estatísticas
-- de partidas e cursos/eventos.
-- =====================================================================

-- =====================================================================
-- 1. Login do atleta
-- =====================================================================
-- Um usuário pode estar vinculado a um atleta (a pessoa é o próprio atleta).
alter table perfis add column if not exists atleta_id uuid unique references atletas(id) on delete set null;

create or replace function meu_atleta_id() returns uuid
language sql stable security definer set search_path = public as $$
  select atleta_id from perfis where id = auth.uid();
$$;

create or replace function so_digitos(t text) returns text
language sql immutable set search_path = public as $$
  select nullif(regexp_replace(coalesce(t, ''), '\D', '', 'g'), '');
$$;

-- Pedidos de vínculo/cadastro feitos pelo próprio atleta
create table solicitacoes_atleta (
  id               uuid primary key default gen_random_uuid(),
  perfil_id        uuid not null references perfis(id) on delete cascade,
  nome             text not null,
  cpf              text not null,
  data_nascimento  date,
  sexo             char(1) check (sexo in ('M', 'F')),
  telefone         text,
  clube_id         uuid references clubes(id) on delete set null,
  -- Cadastro existente encontrado pelo CPF (se houver)
  atleta_id        uuid references atletas(id) on delete set null,
  status           text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  motivo           text,
  criado_em        timestamptz not null default now(),
  resolvido_em     timestamptz,
  resolvido_por    uuid references auth.users(id) on delete set null
);
create unique index solicitacoes_atleta_pendente_uq on solicitacoes_atleta (perfil_id) where status = 'pendente';

-- O atleta informa CPF e nascimento. Se baterem com um cadastro existente
-- (e ninguém estiver vinculado a ele), o vínculo é imediato. Senão, vira
-- uma solicitação para a federação aprovar.
create or replace function solicitar_vinculo_atleta(
  p_nome text, p_cpf text, p_data_nascimento date, p_sexo text default null,
  p_telefone text default null, p_clube uuid default null
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_cpf    text := so_digitos(p_cpf);
  v_atleta atletas;
  v_qtd    int;
begin
  if auth.uid() is null then raise exception 'Entre para continuar.'; end if;
  if (select atleta_id from perfis where id = auth.uid()) is not null then
    raise exception 'Seu usuário já está vinculado a um atleta.';
  end if;
  if v_cpf is null or length(v_cpf) <> 11 then raise exception 'Informe um CPF válido (11 dígitos).'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe seu nome completo.'; end if;

  select count(*) into v_qtd from atletas_contato where so_digitos(cpf) = v_cpf;
  if v_qtd = 1 then
    select a.* into v_atleta from atletas a join atletas_contato c on c.atleta_id = a.id where so_digitos(c.cpf) = v_cpf;
    if not exists (select 1 from perfis where atleta_id = v_atleta.id)
       and v_atleta.data_nascimento is not null and v_atleta.data_nascimento = p_data_nascimento then
      update perfis set atleta_id = v_atleta.id, nome = coalesce(nullif(nome, ''), v_atleta.nome) where id = auth.uid();
      return 'vinculado';
    end if;
  end if;

  delete from solicitacoes_atleta where perfil_id = auth.uid() and status = 'pendente';
  insert into solicitacoes_atleta (perfil_id, nome, cpf, data_nascimento, sexo, telefone, clube_id, atleta_id)
  values (auth.uid(), trim(p_nome), v_cpf, p_data_nascimento, nullif(p_sexo, ''), p_telefone, p_clube,
          case when v_qtd = 1 then v_atleta.id end);
  return 'pendente';
end $$;

-- Federação aprova: vincula ao atleta informado/encontrado ou cria um novo cadastro
create or replace function aprovar_solicitacao_atleta(p_id uuid, p_atleta uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s solicitacoes_atleta;
  v_atleta uuid;
begin
  if not is_admin() then raise exception 'Apenas a federação.'; end if;
  select * into s from solicitacoes_atleta where id = p_id for update;
  if not found or s.status <> 'pendente' then raise exception 'Solicitação não está pendente.'; end if;
  v_atleta := coalesce(p_atleta, s.atleta_id);
  if v_atleta is null then
    insert into atletas (nome, sexo, data_nascimento, clube_id, criado_por)
    values (s.nome, s.sexo, s.data_nascimento, s.clube_id, auth.uid()) returning id into v_atleta;
    insert into atletas_contato (atleta_id, cpf, telefone, email)
    values (v_atleta, s.cpf, s.telefone, (select email from perfis where id = s.perfil_id));
  else
    if exists (select 1 from perfis where atleta_id = v_atleta and id <> s.perfil_id) then
      raise exception 'Este atleta já está vinculado a outro usuário.';
    end if;
    insert into atletas_contato (atleta_id, cpf, telefone)
    values (v_atleta, s.cpf, s.telefone)
    on conflict (atleta_id) do update set cpf = coalesce(atletas_contato.cpf, excluded.cpf),
                                         telefone = coalesce(atletas_contato.telefone, excluded.telefone);
    update atletas set data_nascimento = coalesce(data_nascimento, s.data_nascimento), sexo = coalesce(sexo, s.sexo)
    where id = v_atleta;
  end if;
  update perfis set atleta_id = v_atleta, nome = coalesce(nullif(nome, ''), s.nome) where id = s.perfil_id;
  update solicitacoes_atleta set status = 'aprovada', atleta_id = v_atleta, resolvido_em = now(), resolvido_por = auth.uid()
  where id = p_id;
  return v_atleta;
end $$;

create or replace function recusar_solicitacao_atleta(p_id uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Apenas a federação.'; end if;
  update solicitacoes_atleta set status = 'recusada', motivo = p_motivo, resolvido_em = now(), resolvido_por = auth.uid()
  where id = p_id and status = 'pendente';
end $$;

-- O próprio atleta atualiza alguns dados
create or replace function atualizar_meus_dados(
  p_apelido text, p_cidade text, p_foto_url text, p_telefone text, p_email text
) returns void language plpgsql security definer set search_path = public as $$
declare v_atleta uuid := meu_atleta_id();
begin
  if v_atleta is null then raise exception 'Seu usuário não está vinculado a um atleta.'; end if;
  update atletas set apelido = nullif(trim(p_apelido), ''), cidade = nullif(trim(p_cidade), ''),
                     foto_url = nullif(trim(p_foto_url), '')
  where id = v_atleta;
  insert into atletas_contato (atleta_id, telefone, email) values (v_atleta, p_telefone, p_email)
  on conflict (atleta_id) do update set telefone = excluded.telefone, email = excluded.email;
end $$;

alter table solicitacoes_atleta enable row level security;
create policy ver on solicitacoes_atleta for select using (perfil_id = auth.uid() or is_admin());
create policy admin_apaga on solicitacoes_atleta for delete using (is_admin());

-- O atleta vê os próprios dados de contato
create policy atleta_le_proprio on atletas_contato for select using (atleta_id = meu_atleta_id());

-- =====================================================================
-- 2. Estatísticas: uma linha por atleta por partida disputada
-- =====================================================================
-- Games: super tiebreak (3º set com 10+ pontos) conta como 1 game para
-- quem venceu. W.O. não soma sets nem games.
create view partidas_atleta with (security_invoker = true) as
with base as (
  select p.id as partida_id, p.rodada, p.placar, coalesce(p.tipo_resultado, 'normal') as tipo_resultado,
         p.vencedor_id, p.inscricao1_id, p.inscricao2_id,
         coalesce(p.data, t.data_inicio) as data,
         tc.id as torneio_categoria_id, tc.torneio_id, tc.categoria_id, tc.tamanho_chave,
         t.nome as torneio_nome, t.status as torneio_status, t.clube_id as organizador_id,
         cat.nome as categoria_nome, cat.modalidade
  from partidas p
  join torneio_categorias tc on tc.id = p.torneio_categoria_id
  join torneios t on t.id = tc.torneio_id
  join categorias cat on cat.id = tc.categoria_id
  where p.vencedor_id is not null and p.inscricao1_id is not null and p.inscricao2_id is not null
    and coalesce(p.tipo_resultado, 'normal') <> 'bye' and t.status <> 'rascunho'
),
lados as (
  select b.*, 1 as lado, b.inscricao1_id as minha, b.inscricao2_id as dele from base b
  union all
  select b.*, 2 as lado, b.inscricao2_id as minha, b.inscricao1_id as dele from base b
)
select x.atleta_id,
       l.partida_id, l.torneio_id, l.torneio_nome, l.torneio_status, l.organizador_id,
       l.torneio_categoria_id, l.categoria_id, l.categoria_nome, l.modalidade,
       l.rodada,
       case when l.tamanho_chave > 1 then round(log(2, l.tamanho_chave::numeric))::int else 1 end as total_rodadas,
       l.data, extract(year from l.data)::int as ano,
       l.lado, l.minha as inscricao_id,
       (l.vencedor_id = l.minha) as venceu,
       l.tipo_resultado,
       l.placar,
       case when x.atleta_id = mi.atleta_id then mi.parceiro_id else mi.atleta_id end as parceiro_id,
       di.nome_exibicao as adversario,
       di.atleta_id as adversario_id,
       di.parceiro_id as adversario_parceiro_id,
       coalesce(g.sets_pro, 0) as sets_pro, coalesce(g.sets_contra, 0) as sets_contra,
       coalesce(g.games_pro, 0) as games_pro, coalesce(g.games_contra, 0) as games_contra,
       coalesce(g.tiebreaks, 0) as tiebreaks, coalesce(g.tiebreaks_vencidos, 0) as tiebreaks_vencidos,
       coalesce(g.super_tiebreak, false) as super_tiebreak
from lados l
join inscricoes mi on mi.id = l.minha
join inscricoes_detalhe di on di.id = l.dele
cross join lateral unnest(array_remove(array[mi.atleta_id, mi.parceiro_id], null)) as x(atleta_id)
left join lateral (
  select count(*) filter (where m > o)::int as sets_pro,
         count(*) filter (where o > m)::int as sets_contra,
         sum(case when stb then (m > o)::int else m end)::int as games_pro,
         sum(case when stb then (o > m)::int else o end)::int as games_contra,
         count(*) filter (where not stb and greatest(m, o) = 7 and least(m, o) = 6)::int as tiebreaks,
         count(*) filter (where not stb and m = 7 and o = 6)::int as tiebreaks_vencidos,
         bool_or(stb) as super_tiebreak
  from (
    select case when l.lado = 1 then (e->>0)::int else (e->>1)::int end as m,
           case when l.lado = 1 then (e->>1)::int else (e->>0)::int end as o,
           (n = 3 and greatest((e->>0)::int, (e->>1)::int) >= 10) as stb
    from jsonb_array_elements(case when jsonb_typeof(l.placar) = 'array' then l.placar else '[]'::jsonb end) with ordinality as s(e, n)
  ) z
  where l.tipo_resultado <> 'wo'
) g on true;

-- Líderes do ano (ou de todos os anos, com p_ano nulo)
create or replace function estatisticas_lideres(p_ano int default null, p_categoria uuid default null, p_modalidade text default null)
returns table (
  atleta_id uuid, nome text, clube_nome text, torneios bigint, jogos bigint, vitorias bigint, derrotas bigint,
  aproveitamento numeric, sets_pro bigint, sets_contra bigint, games_pro bigint, games_contra bigint,
  tiebreaks_vencidos bigint, tiebreaks bigint, titulos bigint, finais bigint, vitorias_wo bigint
) language sql stable security definer set search_path = public as $$
  select pa.atleta_id, a.nome, coalesce(c.sigla, c.nome),
         count(distinct pa.torneio_categoria_id),
         count(*),
         count(*) filter (where pa.venceu),
         count(*) filter (where not pa.venceu),
         round(100.0 * count(*) filter (where pa.venceu) / nullif(count(*), 0), 1),
         sum(pa.sets_pro), sum(pa.sets_contra), sum(pa.games_pro), sum(pa.games_contra),
         sum(pa.tiebreaks_vencidos), sum(pa.tiebreaks),
         count(*) filter (where pa.venceu and pa.rodada = pa.total_rodadas),
         count(*) filter (where pa.rodada = pa.total_rodadas),
         count(*) filter (where pa.venceu and pa.tipo_resultado = 'wo')
  from partidas_atleta pa
  join atletas a on a.id = pa.atleta_id
  left join clubes c on c.id = a.clube_id
  where (p_ano is null or pa.ano = p_ano)
    and (p_categoria is null or pa.categoria_id = p_categoria)
    and (p_modalidade is null or pa.modalidade = p_modalidade)
  group by pa.atleta_id, a.nome, c.sigla, c.nome;
$$;

-- =====================================================================
-- 3. Cursos e eventos
-- =====================================================================
create table eventos (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  tipo            text not null default 'evento' check (tipo in (
                    'curso', 'clinica', 'capacitacao', 'arbitragem', 'palestra', 'festival', 'torneio_social', 'evento')),
  descricao       text,
  publico_alvo    text,
  local           text,
  endereco        text,
  cidade          text default 'Recife',
  data_inicio     date not null,
  data_fim        date,
  horario         text,
  -- Organizador: clube (null = federação) e/ou nome livre
  clube_id        uuid references clubes(id) on delete set null,
  organizador     text,
  contato         text,
  imagem_url      text,
  valor           numeric(10,2) not null default 0 check (valor >= 0),
  vagas           int check (vagas is null or vagas > 0),
  inscricoes_ate  date,
  -- sistema: inscrição aqui · externo: link de fora · sem: apenas divulgação
  inscricao_modo  text not null default 'sistema' check (inscricao_modo in ('sistema', 'externo', 'sem')),
  link_externo    text,
  status          text not null default 'publicado' check (status in ('rascunho', 'publicado', 'cancelado')),
  criado_em       timestamptz not null default now(),
  criado_por      uuid references auth.users(id) on delete set null
);
create index eventos_data_idx on eventos (data_inicio);

create table evento_inscricoes (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null references eventos(id) on delete cascade,
  perfil_id      uuid references perfis(id) on delete set null,
  atleta_id      uuid references atletas(id) on delete set null,
  nome           text not null,
  email          text,
  telefone       text,
  observacao     text,
  status         text not null default 'confirmada' check (status in ('confirmada', 'lista_espera', 'cancelada')),
  lancamento_id  uuid references fin_lancamentos(id) on delete set null,
  criado_em      timestamptz not null default now()
);
create unique index evento_inscricoes_uq on evento_inscricoes (evento_id, perfil_id) where perfil_id is not null and status <> 'cancelada';

-- Financeiro: categoria de evento e pagador por usuário
alter table fin_lancamentos drop constraint if exists fin_lancamentos_categoria_check;
alter table fin_lancamentos add constraint fin_lancamentos_categoria_check check (categoria in (
  'filiacao_atleta', 'filiacao_academia', 'inscricao_torneio', 'taxa_torneio', 'evento',
  'patrocinio', 'arbitragem', 'premiacao', 'estrutura', 'administrativo', 'outros'));
alter table fin_lancamentos add column if not exists perfil_id uuid references perfis(id) on delete set null;
create index if not exists fin_lanc_perfil_idx on fin_lancamentos (perfil_id);

create or replace function pode_gerir_evento(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (select 1 from eventos where id = p_evento and clube_id is not null and clube_id = meu_clube_id());
$$;

create or replace function evento_inscritos(p_evento uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from evento_inscricoes where evento_id = p_evento and status = 'confirmada';
$$;

create view eventos_lista with (security_invoker = true) as
select e.*, coalesce(c.nome, 'FPET') as organizador_nome, evento_inscritos(e.id) as inscritos
from eventos e left join clubes c on c.id = e.clube_id;

-- Inscrição pelo próprio usuário logado
create or replace function inscrever_evento(p_evento uuid, p_nome text, p_telefone text default null, p_observacao text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  e       eventos;
  v_stat  text := 'confirmada';
  v_insc  uuid;
  v_lanc  uuid;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Entre para se inscrever.'; end if;
  select * into e from eventos where id = p_evento for update;
  if not found or e.status <> 'publicado' then raise exception 'Evento indisponível.'; end if;
  if e.inscricao_modo <> 'sistema' then raise exception 'As inscrições deste evento não são feitas por aqui.'; end if;
  if coalesce(e.inscricoes_ate, e.data_inicio) < current_date then raise exception 'Inscrições encerradas.'; end if;
  if exists (select 1 from evento_inscricoes where evento_id = p_evento and perfil_id = auth.uid() and status <> 'cancelada') then
    raise exception 'Você já está inscrito neste evento.';
  end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome.'; end if;
  if e.vagas is not null and evento_inscritos(p_evento) >= e.vagas then v_stat := 'lista_espera'; end if;
  select email into v_email from perfis where id = auth.uid();

  insert into evento_inscricoes (evento_id, perfil_id, atleta_id, nome, email, telefone, observacao, status)
  values (p_evento, auth.uid(), meu_atleta_id(), trim(p_nome), v_email, p_telefone, p_observacao, v_stat)
  returning id into v_insc;

  if e.valor > 0 and v_stat = 'confirmada' then
    insert into fin_lancamentos (natureza, categoria, descricao, recebedor_clube_id, atleta_id, perfil_id, favorecido,
                                 valor, vencimento, criado_por)
    values ('receber', 'evento', 'Evento · ' || e.titulo || ' · ' || trim(p_nome), e.clube_id, meu_atleta_id(), auth.uid(),
            trim(p_nome), e.valor, least(coalesce(e.inscricoes_ate, e.data_inicio), e.data_inicio), auth.uid())
    returning id into v_lanc;
    update evento_inscricoes set lancamento_id = v_lanc where id = v_insc;
  end if;
  return v_stat;
end $$;

-- Cancelamento (pelo inscrito ou pelo organizador). Cobrança aberta é cancelada;
-- a primeira pessoa da lista de espera é confirmada.
create or replace function cancelar_inscricao_evento(p_inscricao uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  i  evento_inscricoes;
  e  eventos;
  w  evento_inscricoes;
  v_lanc uuid;
begin
  select * into i from evento_inscricoes where id = p_inscricao for update;
  if not found then raise exception 'Inscrição não encontrada.'; end if;
  if not (i.perfil_id = auth.uid() or pode_gerir_evento(i.evento_id)) then raise exception 'Sem permissão.'; end if;
  if i.status = 'cancelada' then return; end if;
  update evento_inscricoes set status = 'cancelada' where id = i.id;
  update fin_lancamentos set status = 'cancelado', observacoes = concat_ws(' · ', observacoes, 'Inscrição cancelada')
  where id = i.lancamento_id and status = 'aberto';

  if i.status = 'confirmada' then
    select * into e from eventos where id = i.evento_id;
    select * into w from evento_inscricoes where evento_id = i.evento_id and status = 'lista_espera' order by criado_em limit 1;
    if found then
      update evento_inscricoes set status = 'confirmada' where id = w.id;
      if e.valor > 0 then
        insert into fin_lancamentos (natureza, categoria, descricao, recebedor_clube_id, atleta_id, perfil_id, favorecido,
                                     valor, vencimento)
        values ('receber', 'evento', 'Evento · ' || e.titulo || ' · ' || w.nome, e.clube_id, w.atleta_id, w.perfil_id,
                w.nome, e.valor, e.data_inicio)
        returning id into v_lanc;
        update evento_inscricoes set lancamento_id = v_lanc where id = w.id;
      end if;
    end if;
  end if;
end $$;

alter table eventos           enable row level security;
alter table evento_inscricoes enable row level security;

create policy leitura on eventos for select
  using (status <> 'rascunho' or is_admin() or clube_id = meu_clube_id());
create policy gestor_insere on eventos for insert
  with check (is_admin() or (clube_id is not null and clube_id = meu_clube_id()));
create policy gestor_edita on eventos for update
  using (pode_gerir_evento(id)) with check (is_admin() or (clube_id is not null and clube_id = meu_clube_id()));
create policy gestor_apaga on eventos for delete using (pode_gerir_evento(id));

create policy ver on evento_inscricoes for select
  using (perfil_id = auth.uid() or pode_gerir_evento(evento_id));
-- Organizador pode inscrever manualmente (ex.: quem pagou no balcão)
create policy gestor_insere on evento_inscricoes for insert with check (pode_gerir_evento(evento_id));
create policy gestor_edita on evento_inscricoes for update
  using (pode_gerir_evento(evento_id)) with check (pode_gerir_evento(evento_id));
create policy gestor_apaga on evento_inscricoes for delete using (pode_gerir_evento(evento_id));

-- =====================================================================
-- 4. O atleta/usuário vê as próprias cobranças e créditos
-- =====================================================================
drop policy if exists gestor_le on fin_lancamentos;
create policy gestor_le on fin_lancamentos for select
  using (is_admin() or recebedor_clube_id = meu_clube_id() or clube_id = meu_clube_id()
         or atleta_id = meu_atleta_id() or perfil_id = auth.uid());

drop policy if exists gestor_le on fin_creditos;
create policy gestor_le on fin_creditos for select
  using (is_admin() or emissor_clube_id = meu_clube_id() or clube_id = meu_clube_id() or atleta_id = meu_atleta_id());

-- Resumo ADM passa a contar solicitações de atletas pendentes
create or replace function solicitacoes_pendentes() returns int
language sql stable security definer set search_path = public as $$
  select case when is_admin() then (select count(*)::int from solicitacoes_atleta where status = 'pendente') else 0 end;
$$;
