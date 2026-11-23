-- =====================================================================
-- FPET - Federação Pernambucana de Tênis
-- Esquema inicial: clubes, atletas, categorias, torneios, chaves,
-- partidas e ranking.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type papel_usuario as enum ('pendente', 'clube', 'admin');
create type status_torneio as enum ('rascunho', 'inscricoes', 'em_andamento', 'encerrado', 'homologado');

-- Fases possíveis de um atleta em uma chave eliminatória.
-- 'campeao' = venceu a final; 'final' = vice; 'semifinal' = perdeu na semi; etc.
create or replace function fases_validas() returns text[]
language sql immutable set search_path = public as $$
  select array['campeao','final','semifinal','quartas','oitavas','r32','r64','r128']
$$;

-- ---------------------------------------------------------------------
-- Clubes / academias
-- ---------------------------------------------------------------------
create table clubes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  sigla         text,
  cidade        text default 'Recife',
  bairro        text,
  endereco      text,
  telefone      text,
  email         text,
  instagram     text,
  site          text,
  responsavel   text,
  num_quadras   int,
  tipo_piso     text,
  logo_url      text,
  observacoes   text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Usuários do sistema (federação e clubes)
-- ---------------------------------------------------------------------
create table perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text,
  email      text,
  papel      papel_usuario not null default 'pendente',
  clube_id   uuid references clubes(id) on delete set null,
  criado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Atletas (clientes). Dados públicos aqui; contato em tabela separada.
-- ---------------------------------------------------------------------
create table atletas (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  apelido          text,
  sexo             char(1) check (sexo in ('M','F')),
  data_nascimento  date,
  cidade           text,
  clube_id         uuid references clubes(id) on delete set null,
  foto_url         text,
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  criado_por       uuid references auth.users(id) on delete set null
);
create index atletas_nome_idx on atletas (lower(nome));
create index atletas_clube_idx on atletas (clube_id);

-- Dados sensíveis: visíveis apenas para federação e clubes.
create table atletas_contato (
  atleta_id    uuid primary key references atletas(id) on delete cascade,
  cpf          text,
  telefone     text,
  email        text,
  observacoes  text
);

-- ---------------------------------------------------------------------
-- Categorias oficiais (definidas pela federação)
-- ---------------------------------------------------------------------
create table categorias (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  genero      char(1) not null default 'M' check (genero in ('M','F','X')), -- X = misto
  modalidade  text not null default 'simples' check (modalidade in ('simples','duplas')),
  descricao   text,
  ordem       int not null default 0,
  ativa       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tabelas de pontuação (pontos por fase alcançada)
-- ---------------------------------------------------------------------
create table tabelas_pontuacao (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  descricao  text,
  ativa      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create table tabela_pontuacao_itens (
  tabela_id  uuid not null references tabelas_pontuacao(id) on delete cascade,
  fase       text not null check (fase = any (fases_validas())),
  pontos     int not null default 0,
  primary key (tabela_id, fase)
);

-- ---------------------------------------------------------------------
-- Configurações gerais do ranking (linha única)
-- ---------------------------------------------------------------------
create table configuracoes (
  id                    int primary key default 1 check (id = 1),
  -- Janela de validade dos pontos em semanas (null = pontos não expiram)
  janela_semanas        int default 52 check (janela_semanas is null or janela_semanas > 0),
  -- Considerar apenas os N melhores resultados em torneios (null = todos)
  melhores_resultados   int check (melhores_resultados is null or melhores_resultados > 0),
  criterio_desempate    text,
  observacoes           text,
  atualizado_em         timestamptz not null default now()
);
insert into configuracoes (id) values (1);

-- ---------------------------------------------------------------------
-- Torneios
-- ---------------------------------------------------------------------
create table torneios (
  id                   uuid primary key default gen_random_uuid(),
  clube_id             uuid not null references clubes(id) on delete restrict,
  nome                 text not null,
  descricao            text,
  local                text,
  data_inicio          date,
  data_fim             date,
  status               status_torneio not null default 'rascunho',
  pontua_ranking       boolean not null default true,
  tabela_pontuacao_id  uuid references tabelas_pontuacao(id) on delete set null,
  info_inscricao       text,   -- valores, prazos, forma de pagamento (texto livre do clube)
  regulamento          text,
  criado_em            timestamptz not null default now(),
  criado_por           uuid references auth.users(id) on delete set null,
  homologado_em        timestamptz,
  homologado_por       uuid references auth.users(id) on delete set null
);
create index torneios_clube_idx on torneios (clube_id);
create index torneios_data_idx on torneios (data_inicio desc);

-- Categorias disputadas em cada torneio + regras específicas
create table torneio_categorias (
  id                         uuid primary key default gen_random_uuid(),
  torneio_id                 uuid not null references torneios(id) on delete cascade,
  categoria_id               uuid not null references categorias(id) on delete restrict,
  formato                    text not null default 'eliminatoria'
                               check (formato in ('eliminatoria','eliminatoria_consolacao','grupos')),
  formato_partida            text not null default '2 sets + super tiebreak de 10',
  valor_inscricao            text,
  -- null = automático pelo tamanho da chave
  num_cabecas                int check (num_cabecas is null or num_cabecas >= 0),
  -- Regras de pontuação de W.O. / bye (a definir por torneio)
  bye_conta_vitoria          boolean not null default false,
  -- A partir de qual fase uma vitória por W.O. conta como vitória para pontuação.
  -- null = sempre conta. Ex.: 'semifinal' = W.O. só conta na semi e na final.
  wo_vitoria_conta_a_partir  text check (wo_vitoria_conta_a_partir is null or wo_vitoria_conta_a_partir = any (fases_validas())),
  wo_perdedor_pontua         boolean not null default false,
  -- Sobrescreve a tabela de pontuação do torneio, se preenchida
  tabela_pontuacao_id        uuid references tabelas_pontuacao(id) on delete set null,
  -- Preenchidos ao gerar a chave
  tamanho_chave              int,
  chave_gerada_em            timestamptz,
  criado_em                  timestamptz not null default now(),
  unique (torneio_id, categoria_id)
);

-- Inscrições (atleta, ou dupla)
create table inscricoes (
  id                    uuid primary key default gen_random_uuid(),
  torneio_categoria_id  uuid not null references torneio_categorias(id) on delete cascade,
  atleta_id             uuid not null references atletas(id) on delete restrict,
  parceiro_id           uuid references atletas(id) on delete restrict,
  -- Preenchidos no sorteio
  pontos_ranking        int,
  posicao_ranking       int,
  cabeca                int,
  posicao_chave         int,
  criado_em             timestamptz not null default now(),
  unique (torneio_categoria_id, atleta_id),
  check (parceiro_id is null or parceiro_id <> atleta_id)
);
create index inscricoes_atleta_idx on inscricoes (atleta_id);
create index inscricoes_parceiro_idx on inscricoes (parceiro_id);

-- Partidas da chave. rodada 1 = primeira rodada; ordem começa em 0.
create table partidas (
  id                    uuid primary key default gen_random_uuid(),
  torneio_categoria_id  uuid not null references torneio_categorias(id) on delete cascade,
  rodada                int not null,
  ordem                 int not null,
  inscricao1_id         uuid references inscricoes(id) on delete restrict,
  inscricao2_id         uuid references inscricoes(id) on delete restrict,
  vencedor_id           uuid references inscricoes(id) on delete restrict,
  -- Ex.: [[6,4],[3,6],[10,8]]  (o 3º item é o super tiebreak)
  placar                jsonb not null default '[]'::jsonb,
  tipo_resultado        text check (tipo_resultado in ('normal','wo','desistencia','bye')),
  data                  date,
  horario               text,   -- Ex.: 'NÃO ANTES DAS 17h'
  quadra                text,
  em_quadra             boolean not null default false,  -- jogo acontecendo agora
  atualizado_em         timestamptz not null default now(),
  unique (torneio_categoria_id, rodada, ordem)
);
create index partidas_insc1_idx on partidas (inscricao1_id);
create index partidas_insc2_idx on partidas (inscricao2_id);
create index partidas_data_idx on partidas (data);

-- ---------------------------------------------------------------------
-- Ranking
-- ---------------------------------------------------------------------
-- Livro-razão de pontos. Cada linha é um resultado em torneio ou um ajuste
-- manual (ex.: importação do ranking inicial).
create table ranking_lancamentos (
  id                    uuid primary key default gen_random_uuid(),
  atleta_id             uuid not null references atletas(id) on delete cascade,
  categoria_id          uuid not null references categorias(id) on delete cascade,
  pontos                int not null,
  data_referencia       date not null default current_date,
  tipo                  text not null default 'ajuste' check (tipo in ('torneio','ajuste','importacao')),
  torneio_id            uuid references torneios(id) on delete cascade,
  torneio_categoria_id  uuid references torneio_categorias(id) on delete cascade,
  fase                  text check (fase is null or fase = any (fases_validas())),
  descricao             text,
  criado_em             timestamptz not null default now(),
  criado_por            uuid references auth.users(id) on delete set null
);
create index ranking_lanc_cat_idx on ranking_lancamentos (categoria_id, data_referencia);
create index ranking_lanc_atleta_idx on ranking_lancamentos (atleta_id);

-- Fotografias do ranking (para histórico e "subiu/desceu")
create table ranking_publicacoes (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  uuid not null references categorias(id) on delete cascade,
  data          date not null default current_date,
  torneio_id    uuid references torneios(id) on delete cascade,
  descricao     text,
  criado_em     timestamptz not null default now()
);
create index ranking_pub_cat_idx on ranking_publicacoes (categoria_id, criado_em desc);

create table ranking_historico (
  publicacao_id  uuid not null references ranking_publicacoes(id) on delete cascade,
  atleta_id      uuid not null references atletas(id) on delete cascade,
  posicao        int not null,
  pontos         int not null,
  primary key (publicacao_id, atleta_id)
);
create index ranking_hist_atleta_idx on ranking_historico (atleta_id);

-- =====================================================================
-- Funções de apoio / permissões
-- =====================================================================
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'admin');
$$;

create or replace function meu_clube_id() returns uuid
language sql stable security definer set search_path = public as $$
  select clube_id from perfis where id = auth.uid() and papel = 'clube';
$$;

create or replace function e_gestor() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or meu_clube_id() is not null;
$$;

create or replace function pode_gerir_torneio(p_torneio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from torneios t
    where t.id = p_torneio
      and t.clube_id = meu_clube_id()
      and t.status <> 'homologado'
  );
$$;

create or replace function pode_gerir_tc(p_tc uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select pode_gerir_torneio((select torneio_id from torneio_categorias where id = p_tc));
$$;

-- Perfil criado automaticamente no cadastro
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nome', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Apenas a federação altera/desfaz homologação
create or replace function proteger_status_torneio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and not is_admin() then
    if new.status = 'homologado' and old.status <> 'homologado' then
      raise exception 'Apenas a federação pode homologar um torneio.';
    end if;
    if old.status = 'homologado' then
      raise exception 'Torneio homologado não pode ser alterado.';
    end if;
  end if;
  return new;
end $$;

create trigger torneios_proteger_status
  before update on torneios
  for each row execute function proteger_status_torneio();

-- =====================================================================
-- Utilidades de chave
-- =====================================================================
-- Fase correspondente a quantos jogadores restam na rodada
create or replace function fase_por_jogadores(n int) returns text
language sql immutable set search_path = public as $$
  select case n
    when 1 then 'campeao' when 2 then 'final' when 4 then 'semifinal'
    when 8 then 'quartas' when 16 then 'oitavas' when 32 then 'r32'
    when 64 then 'r64' when 128 then 'r128' end
$$;

create or replace function jogadores_por_fase(f text) returns int
language sql immutable set search_path = public as $$
  select case f
    when 'campeao' then 1 when 'final' then 2 when 'semifinal' then 4
    when 'quartas' then 8 when 'oitavas' then 16 when 'r32' then 32
    when 'r64' then 64 when 'r128' then 128 end
$$;

-- Número padrão de cabeças de chave pelo tamanho da chave (padrão ITF/CBT)
create or replace function cabecas_padrao(p_tamanho int) returns int
language sql immutable set search_path = public as $$
  select case
    when p_tamanho <= 2 then 0
    when p_tamanho <= 8 then 2
    when p_tamanho = 16 then 4
    when p_tamanho = 32 then 8
    when p_tamanho = 64 then 16
    else 32 end
$$;

-- Ordem das linhas da chave reservadas para cabeças de chave (uma por jogo
-- da 1ª rodada), seguindo a regra ITF:
--   cabeça 1 -> linha 1; cabeça 2 -> última linha;
--   cabeças 3-4 sorteados entre topo do 2º quarto e pé do 3º quarto;
--   cabeças 5-8 sorteados entre as linhas restantes dos quartos, etc.
-- As posições excedentes servem também para distribuir os byes.
create or replace function ordem_slots_chave(p_s int) returns int[]
language plpgsql volatile set search_path = public as $$
declare
  v      int[] := '{}';
  pos    int[];
  t      int;
  tmax   int;
  l      int;
  i      int;
  q      int;
  ocup   boolean;
begin
  if p_s < 2 then return v; end if;
  v := array[1];
  if p_s >= 4 then v := v || p_s; end if;
  tmax := round(log(2, p_s::numeric))::int - 1;
  for t in 2..tmax loop
    pos := '{}';
    if t = 2 then
      pos := array[p_s / 4 + 1, 3 * p_s / 4];
    elsif t = 3 then
      pos := array[p_s / 4, p_s / 2, p_s / 2 + 1, 3 * p_s / 4 + 1];
    elsif t = 4 then
      for q in 0..3 loop
        pos := pos || array[q * p_s / 4 + p_s / 8, q * p_s / 4 + p_s / 8 + 1];
      end loop;
    else
      l := p_s / (1 << t);
      for i in 0..((1 << t) - 1) loop
        select exists (select 1 from unnest(v) x where x > i * l and x <= (i + 1) * l) into ocup;
        if not ocup then
          if (i + 1) * l <= p_s / 2 then pos := pos || ((i + 1) * l);
          else pos := pos || (i * l + 1);
          end if;
        end if;
      end loop;
    end if;
    v := v || (select array_agg(x order by random()) from unnest(pos) x);
  end loop;
  return v;
end $$;

-- =====================================================================
-- Ranking
-- =====================================================================
-- Pontos válidos de cada atleta numa categoria, numa data.
create or replace function ranking_pontuacao(p_categoria uuid, p_data date default current_date)
returns table (atleta_id uuid, pontos bigint, torneios bigint)
language sql stable set search_path = public as $$
  with cfg as (
    select janela_semanas, melhores_resultados from configuracoes where id = 1
  ),
  l as (
    select r.atleta_id, r.pontos, r.tipo, r.torneio_id,
           row_number() over (partition by r.atleta_id, (r.tipo = 'torneio') order by r.pontos desc) as rn
    from ranking_lancamentos r cross join cfg
    where r.categoria_id = p_categoria
      and r.data_referencia <= p_data
      and (cfg.janela_semanas is null or r.data_referencia > p_data - (cfg.janela_semanas * 7))
  )
  select l.atleta_id,
         coalesce(sum(l.pontos) filter (
           where l.tipo <> 'torneio' or cfg.melhores_resultados is null or l.rn <= cfg.melhores_resultados
         ), 0)::bigint,
         count(distinct l.torneio_id)
  from l cross join cfg
  group by l.atleta_id
$$;

-- Ranking completo de uma categoria, com posição anterior (última publicação
-- antes da mais recente) para indicar se o atleta subiu ou desceu.
create or replace function ranking_categoria(p_categoria uuid, p_data date default current_date)
returns table (
  posicao int, atleta_id uuid, nome text, clube_id uuid, clube_nome text,
  pontos bigint, torneios bigint, posicao_anterior int
)
language sql stable set search_path = public as $$
  with p as (
    select * from ranking_pontuacao(p_categoria, p_data) where pontos <> 0
  ),
  pubs as (
    select id, row_number() over (order by criado_em desc) as rn
    from ranking_publicacoes where categoria_id = p_categoria
  ),
  ant as (
    select h.atleta_id, h.posicao
    from ranking_historico h join pubs on pubs.id = h.publicacao_id and pubs.rn = 2
  )
  select (rank() over (order by p.pontos desc))::int,
         a.id, a.nome, a.clube_id, coalesce(c.sigla, c.nome),
         p.pontos, p.torneios, ant.posicao
  from p
  join atletas a on a.id = p.atleta_id
  left join clubes c on c.id = a.clube_id
  left join ant on ant.atleta_id = a.id
  order by 1, a.nome
$$;

-- Posição atual do atleta em cada categoria em que pontua
create or replace function ranking_do_atleta(p_atleta uuid)
returns table (categoria_id uuid, categoria_nome text, posicao int, pontos bigint, posicao_anterior int, total int)
language sql stable set search_path = public as $$
  select c.id, c.nome, r.posicao, r.pontos, r.posicao_anterior,
         (select count(*)::int from ranking_categoria(c.id))
  from categorias c
  cross join lateral ranking_categoria(c.id) r
  where r.atleta_id = p_atleta
    and exists (select 1 from ranking_lancamentos l where l.categoria_id = c.id and l.atleta_id = p_atleta)
  order by c.ordem, c.nome
$$;

-- Registra uma "foto" do ranking atual de uma categoria
create or replace function publicar_ranking(p_categoria uuid, p_torneio uuid default null, p_descricao text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_pub uuid;
begin
  if not is_admin() then raise exception 'Apenas a federação pode publicar o ranking.'; end if;
  insert into ranking_publicacoes (categoria_id, torneio_id, descricao)
  values (p_categoria, p_torneio, p_descricao)
  returning id into v_pub;
  insert into ranking_historico (publicacao_id, atleta_id, posicao, pontos)
  select v_pub, r.atleta_id, r.posicao, r.pontos from ranking_categoria(p_categoria) r;
  return v_pub;
end $$;

-- =====================================================================
-- Chave: sorteio, resultados e avanço
-- =====================================================================
create or replace function _finalizar_partida(p_partida uuid, p_vencedor uuid, p_placar jsonb, p_tipo text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  p        partidas;
  v_max    int;
begin
  update partidas
     set vencedor_id = p_vencedor, placar = coalesce(p_placar, '[]'::jsonb),
         tipo_resultado = p_tipo, em_quadra = false, atualizado_em = now()
   where id = p_partida
  returning * into p;

  select max(rodada) into v_max from partidas where torneio_categoria_id = p.torneio_categoria_id;
  if p.rodada < v_max then
    if p.ordem % 2 = 0 then
      update partidas set inscricao1_id = p_vencedor, atualizado_em = now()
       where torneio_categoria_id = p.torneio_categoria_id and rodada = p.rodada + 1 and ordem = p.ordem / 2;
    else
      update partidas set inscricao2_id = p_vencedor, atualizado_em = now()
       where torneio_categoria_id = p.torneio_categoria_id and rodada = p.rodada + 1 and ordem = p.ordem / 2;
    end if;
  end if;
end $$;

-- Sorteia a chave: cabeças pelo ranking atualizado, byes para os cabeças,
-- restante por sorteio.
create or replace function gerar_chave(p_tc uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tc         torneio_categorias;
  v_t          torneios;
  v_ordem      uuid[];
  v_resto      uuid[];
  v_slots      int[];
  v_linhas     uuid[];
  v_bye        boolean[];
  v_n          int;
  v_s          int;
  v_rodadas    int;
  v_cabecas    int;
  v_ranqueados int;
  v_byes       int;
  k            int;
  j            int;
  r            int;
  m            int;
  p            partidas;
begin
  select * into v_tc from torneio_categorias where id = p_tc;
  if not found then raise exception 'Categoria do torneio não encontrada.'; end if;
  if not pode_gerir_torneio(v_tc.torneio_id) then raise exception 'Sem permissão para gerir este torneio.'; end if;
  select * into v_t from torneios where id = v_tc.torneio_id;
  if v_t.status in ('encerrado', 'homologado') then
    raise exception 'Torneio encerrado: não é possível sortear a chave.';
  end if;
  if v_tc.formato <> 'eliminatoria' then
    raise exception 'Por enquanto só o formato eliminatória simples gera chave automaticamente.';
  end if;
  if exists (select 1 from partidas where torneio_categoria_id = p_tc
             and vencedor_id is not null and tipo_resultado <> 'bye') then
    raise exception 'Já existem resultados lançados nesta chave. Desfaça-os antes de sortear novamente.';
  end if;

  delete from partidas where torneio_categoria_id = p_tc;

  -- Pontuação atual no ranking (dupla = soma dos dois)
  with rk as (
    select rp.atleta_id, rp.pontos, rank() over (order by rp.pontos desc) as pos
    from ranking_pontuacao(v_tc.categoria_id) rp where rp.pontos <> 0
  )
  update inscricoes i set
    pontos_ranking  = coalesce((select pontos from rk where rk.atleta_id = i.atleta_id), 0)
                    + coalesce((select pontos from rk where rk.atleta_id = i.parceiro_id), 0),
    posicao_ranking = (select pos from rk where rk.atleta_id = i.atleta_id),
    cabeca = null,
    posicao_chave = null
  where i.torneio_categoria_id = p_tc;

  select array_agg(id order by pontos_ranking desc, random()) into v_ordem
  from inscricoes where torneio_categoria_id = p_tc;
  v_n := coalesce(array_length(v_ordem, 1), 0);
  if v_n < 2 then raise exception 'São necessários ao menos 2 inscritos para gerar a chave.'; end if;

  v_s := 2;
  while v_s < v_n loop v_s := v_s * 2; end loop;
  if v_s > 128 then raise exception 'Chave limitada a 128 jogadores.'; end if;
  v_rodadas := round(log(2, v_s::numeric))::int;

  select count(*) into v_ranqueados from inscricoes where torneio_categoria_id = p_tc and pontos_ranking > 0;
  v_cabecas := least(coalesce(v_tc.num_cabecas, cabecas_padrao(v_s)), v_s / 2, v_ranqueados);

  v_slots  := ordem_slots_chave(v_s);
  v_linhas := array_fill(null::uuid, array[v_s]);
  v_bye    := array_fill(false, array[v_s]);

  -- Cabeças de chave
  for k in 1..v_cabecas loop
    v_linhas[v_slots[k]] := v_ordem[k];
    update inscricoes set cabeca = k where id = v_ordem[k];
  end loop;

  -- Byes: primeiro contra os cabeças, depois distribuídos pela chave
  v_byes := v_s - v_n;
  for k in 1..v_byes loop
    j := v_slots[k];
    j := case when j % 2 = 1 then j + 1 else j - 1 end;
    v_bye[j] := true;
  end loop;

  -- Demais jogadores: sorteio
  select array_agg(x order by random()) into v_resto from unnest(v_ordem[v_cabecas + 1 : v_n]) x;
  k := 1;
  for j in 1..v_s loop
    if v_linhas[j] is null and not v_bye[j] then
      v_linhas[j] := v_resto[k];
      k := k + 1;
    end if;
  end loop;

  for j in 1..v_s loop
    if v_linhas[j] is not null then
      update inscricoes set posicao_chave = j where id = v_linhas[j];
    end if;
  end loop;

  -- Cria todas as partidas da chave
  for r in 1..v_rodadas loop
    for m in 0..((v_s >> r) - 1) loop
      insert into partidas (torneio_categoria_id, rodada, ordem) values (p_tc, r, m);
    end loop;
  end loop;

  for m in 0..(v_s / 2 - 1) loop
    update partidas
       set inscricao1_id = v_linhas[2 * m + 1], inscricao2_id = v_linhas[2 * m + 2]
     where torneio_categoria_id = p_tc and rodada = 1 and ordem = m
    returning * into p;
    if v_bye[2 * m + 1] then
      perform _finalizar_partida(p.id, v_linhas[2 * m + 2], '[]'::jsonb, 'bye');
    elsif v_bye[2 * m + 2] then
      perform _finalizar_partida(p.id, v_linhas[2 * m + 1], '[]'::jsonb, 'bye');
    end if;
  end loop;

  update torneio_categorias set tamanho_chave = v_s, chave_gerada_em = now() where id = p_tc;
end $$;

-- Apaga a chave (antes de haver resultados)
create or replace function apagar_chave(p_tc uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pode_gerir_tc(p_tc) then raise exception 'Sem permissão para gerir este torneio.'; end if;
  if exists (select 1 from partidas where torneio_categoria_id = p_tc
             and vencedor_id is not null and tipo_resultado <> 'bye') then
    raise exception 'Já existem resultados lançados nesta chave. Desfaça-os antes de apagar.';
  end if;
  delete from partidas where torneio_categoria_id = p_tc;
  update inscricoes set cabeca = null, posicao_chave = null where torneio_categoria_id = p_tc;
  update torneio_categorias set tamanho_chave = null, chave_gerada_em = null where id = p_tc;
end $$;

-- Lança (ou corrige) o resultado de uma partida e avança o vencedor
create or replace function registrar_resultado(
  p_partida uuid, p_vencedor uuid, p_placar jsonb default '[]'::jsonb, p_tipo text default 'normal'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  p       partidas;
  v_prox  partidas;
  v_t     torneios;
begin
  select * into p from partidas where id = p_partida for update;
  if not found then raise exception 'Partida não encontrada.'; end if;
  if not pode_gerir_tc(p.torneio_categoria_id) then raise exception 'Sem permissão para gerir este torneio.'; end if;
  if p_tipo not in ('normal', 'wo', 'desistencia') then raise exception 'Tipo de resultado inválido.'; end if;
  if p.tipo_resultado = 'bye' then raise exception 'Partida com bye não recebe resultado.'; end if;
  if p.inscricao1_id is null or p.inscricao2_id is null then
    raise exception 'A partida ainda não tem os dois jogadores definidos.';
  end if;
  if p_vencedor not in (p.inscricao1_id, p.inscricao2_id) then
    raise exception 'O vencedor precisa ser um dos jogadores da partida.';
  end if;

  -- Corrigindo o vencedor: a partida seguinte não pode ter sido jogada
  if p.vencedor_id is not null and p.vencedor_id <> p_vencedor then
    select * into v_prox from partidas
     where torneio_categoria_id = p.torneio_categoria_id and rodada = p.rodada + 1 and ordem = p.ordem / 2;
    if v_prox.vencedor_id is not null then
      raise exception 'Desfaça primeiro o resultado da partida seguinte.';
    end if;
  end if;

  perform _finalizar_partida(p.id, p_vencedor, p_placar, p_tipo);

  select t.* into v_t from torneios t join torneio_categorias tc on tc.torneio_id = t.id
   where tc.id = p.torneio_categoria_id;
  if v_t.status in ('rascunho', 'inscricoes') then
    update torneios set status = 'em_andamento' where id = v_t.id;
  end if;
end $$;

-- Desfaz o resultado de uma partida (se a seguinte ainda não foi jogada)
create or replace function desfazer_resultado(p_partida uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p       partidas;
  v_prox  partidas;
begin
  select * into p from partidas where id = p_partida for update;
  if not found then raise exception 'Partida não encontrada.'; end if;
  if not pode_gerir_tc(p.torneio_categoria_id) then raise exception 'Sem permissão para gerir este torneio.'; end if;
  if p.tipo_resultado = 'bye' then raise exception 'Não é possível desfazer um bye. Sorteie a chave novamente.'; end if;
  if p.vencedor_id is null then return; end if;

  select * into v_prox from partidas
   where torneio_categoria_id = p.torneio_categoria_id and rodada = p.rodada + 1 and ordem = p.ordem / 2;
  if v_prox.id is not null then
    if v_prox.vencedor_id is not null then
      raise exception 'Desfaça primeiro o resultado da partida seguinte.';
    end if;
    if p.ordem % 2 = 0 then
      update partidas set inscricao1_id = null, atualizado_em = now() where id = v_prox.id;
    else
      update partidas set inscricao2_id = null, atualizado_em = now() where id = v_prox.id;
    end if;
  end if;

  update partidas set vencedor_id = null, placar = '[]'::jsonb, tipo_resultado = null, atualizado_em = now()
   where id = p.id;
end $$;

-- Fase efetivamente alcançada por uma inscrição, aplicando as regras de
-- bye e W.O. da categoria do torneio. Retorna null se não pontua.
create or replace function calcular_fase_inscricao(p_inscricao uuid) returns text
language plpgsql stable set search_path = public as $$
declare
  v_tc       torneio_categorias;
  v_rodadas  int;
  v_ultima   partidas;
  m          partidas;
  v_e        int;
  v_corte    int;
begin
  select tc.* into v_tc from torneio_categorias tc
    join inscricoes i on i.torneio_categoria_id = tc.id where i.id = p_inscricao;
  select max(rodada) into v_rodadas from partidas where torneio_categoria_id = v_tc.id;
  if v_rodadas is null then return null; end if;

  select * into v_ultima from partidas
   where torneio_categoria_id = v_tc.id and p_inscricao in (inscricao1_id, inscricao2_id)
   order by rodada desc limit 1;
  if v_ultima.id is null or v_ultima.vencedor_id is null then return null; end if;

  if v_ultima.vencedor_id = p_inscricao then
    if v_ultima.rodada < v_rodadas then return null; end if;  -- ainda vivo na chave
    v_e := v_rodadas + 1;                                      -- campeão
  else
    v_e := v_ultima.rodada;
  end if;

  -- Vitórias que "não contam" (bye / W.O. antes da fase de corte) fazem o
  -- atleta pontuar como se tivesse parado na rodada anterior.
  v_corte := jogadores_por_fase(v_tc.wo_vitoria_conta_a_partir);
  while v_e > 1 loop
    select * into m from partidas
     where torneio_categoria_id = v_tc.id and rodada = v_e - 1 and vencedor_id = p_inscricao;
    exit when m.id is null;
    if m.tipo_resultado = 'bye' and not v_tc.bye_conta_vitoria then
      v_e := v_e - 1;
    elsif m.tipo_resultado = 'wo' and v_corte is not null
          and (1 << (v_rodadas - m.rodada + 1)) > v_corte then
      v_e := v_e - 1;
    else
      exit;
    end if;
  end loop;

  -- Perdeu por W.O. sem nenhuma vitória válida
  if v_ultima.vencedor_id <> p_inscricao and v_ultima.tipo_resultado = 'wo'
     and not v_tc.wo_perdedor_pontua and v_e <= 1 then
    return null;
  end if;

  return fase_por_jogadores(1 << (v_rodadas - v_e + 1));
end $$;

-- Encerra o torneio (todas as finais jogadas)
create or replace function encerrar_torneio(p_torneio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_pend text;
begin
  if not pode_gerir_torneio(p_torneio) then raise exception 'Sem permissão para gerir este torneio.'; end if;
  select string_agg(c.nome, ', ') into v_pend
  from torneio_categorias tc join categorias c on c.id = tc.categoria_id
  where tc.torneio_id = p_torneio
    and (tc.chave_gerada_em is null or exists (
      select 1 from partidas p where p.torneio_categoria_id = tc.id and p.vencedor_id is null));
  if v_pend is not null then
    raise exception 'Ainda há partidas sem resultado (ou chave não sorteada) em: %', v_pend;
  end if;
  update torneios set status = 'encerrado' where id = p_torneio;
end $$;

-- Homologa: calcula pontos de todos os inscritos e atualiza o ranking
create or replace function homologar_torneio(p_torneio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t         torneios;
  tc        torneio_categorias;
  i         inscricoes;
  v_fase    text;
  v_pontos  int;
  v_tabela  uuid;
  v_data    date;
begin
  if not is_admin() then raise exception 'Apenas a federação pode homologar torneios.'; end if;
  select * into t from torneios where id = p_torneio for update;
  if not found then raise exception 'Torneio não encontrado.'; end if;
  if t.status <> 'encerrado' then raise exception 'O torneio precisa estar encerrado para ser homologado.'; end if;

  v_data := coalesce(t.data_fim, t.data_inicio, current_date);
  delete from ranking_lancamentos where torneio_id = p_torneio;
  delete from ranking_publicacoes where torneio_id = p_torneio;

  if t.pontua_ranking then
    for tc in select * from torneio_categorias where torneio_id = p_torneio loop
      v_tabela := coalesce(tc.tabela_pontuacao_id, t.tabela_pontuacao_id);
      for i in select * from inscricoes where torneio_categoria_id = tc.id loop
        v_fase := calcular_fase_inscricao(i.id);
        continue when v_fase is null;
        v_pontos := coalesce((select pontos from tabela_pontuacao_itens
                               where tabela_id = v_tabela and fase = v_fase), 0);
        insert into ranking_lancamentos
          (atleta_id, categoria_id, pontos, data_referencia, tipo, torneio_id, torneio_categoria_id, fase, descricao, criado_por)
        values (i.atleta_id, tc.categoria_id, v_pontos, v_data, 'torneio', p_torneio, tc.id, v_fase, t.nome, auth.uid());
        if i.parceiro_id is not null then
          insert into ranking_lancamentos
            (atleta_id, categoria_id, pontos, data_referencia, tipo, torneio_id, torneio_categoria_id, fase, descricao, criado_por)
          values (i.parceiro_id, tc.categoria_id, v_pontos, v_data, 'torneio', p_torneio, tc.id, v_fase, t.nome, auth.uid());
        end if;
      end loop;
      perform publicar_ranking(tc.categoria_id, p_torneio, t.nome);
    end loop;
  end if;

  update torneios set status = 'homologado', homologado_em = now(), homologado_por = auth.uid()
   where id = p_torneio;
end $$;

create or replace function desfazer_homologacao(p_torneio uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Apenas a federação pode desfazer homologação.'; end if;
  delete from ranking_lancamentos where torneio_id = p_torneio;
  delete from ranking_publicacoes where torneio_id = p_torneio;
  update torneios set status = 'encerrado', homologado_em = null, homologado_por = null where id = p_torneio;
end $$;

-- Prévia dos pontos (antes de homologar)
create or replace function previa_pontos_torneio(p_torneio uuid)
returns table (inscricao_id uuid, categoria_nome text, atleta_nome text, fase text, pontos int)
language sql stable set search_path = public as $$
  select i.id, c.nome,
         a.nome || coalesce(' / ' || pa.nome, ''),
         f.fase,
         coalesce((select it.pontos from tabela_pontuacao_itens it
                    where it.tabela_id = coalesce(tc.tabela_pontuacao_id, t.tabela_pontuacao_id)
                      and it.fase = f.fase), 0)
  from torneios t
  join torneio_categorias tc on tc.torneio_id = t.id
  join categorias c on c.id = tc.categoria_id
  join inscricoes i on i.torneio_categoria_id = tc.id
  join atletas a on a.id = i.atleta_id
  left join atletas pa on pa.id = i.parceiro_id
  cross join lateral (select calcular_fase_inscricao(i.id) as fase) f
  where t.id = p_torneio
  order by c.ordem, c.nome, jogadores_por_fase(f.fase) nulls last, a.nome
$$;

revoke execute on function _finalizar_partida(uuid, uuid, jsonb, text) from public;

-- =====================================================================
-- Views de leitura
-- =====================================================================
create view inscricoes_detalhe with (security_invoker = true) as
select i.*,
       a.nome  as atleta_nome,
       pa.nome as parceiro_nome,
       a.nome || coalesce(' / ' || pa.nome, '') as nome_exibicao,
       coalesce(c.sigla, c.nome) as clube_nome
from inscricoes i
join atletas a on a.id = i.atleta_id
left join atletas pa on pa.id = i.parceiro_id
left join clubes c on c.id = a.clube_id;

create view partidas_detalhe with (security_invoker = true) as
select p.*,
       tc.torneio_id, tc.categoria_id, tc.tamanho_chave,
       t.nome as torneio_nome, t.clube_id, t.status as torneio_status,
       cat.nome as categoria_nome,
       i1.nome_exibicao as jogador1, i1.cabeca as cabeca1, i1.atleta_id as atleta1_id, i1.parceiro_id as parceiro1_id,
       i2.nome_exibicao as jogador2, i2.cabeca as cabeca2, i2.atleta_id as atleta2_id, i2.parceiro_id as parceiro2_id
from partidas p
join torneio_categorias tc on tc.id = p.torneio_categoria_id
join torneios t on t.id = tc.torneio_id
join categorias cat on cat.id = tc.categoria_id
left join inscricoes_detalhe i1 on i1.id = p.inscricao1_id
left join inscricoes_detalhe i2 on i2.id = p.inscricao2_id;

-- =====================================================================
-- Segurança (RLS)
-- =====================================================================
alter table clubes                 enable row level security;
alter table perfis                 enable row level security;
alter table atletas                enable row level security;
alter table atletas_contato        enable row level security;
alter table categorias             enable row level security;
alter table tabelas_pontuacao      enable row level security;
alter table tabela_pontuacao_itens enable row level security;
alter table configuracoes          enable row level security;
alter table torneios               enable row level security;
alter table torneio_categorias     enable row level security;
alter table inscricoes             enable row level security;
alter table partidas               enable row level security;
alter table ranking_lancamentos    enable row level security;
alter table ranking_publicacoes    enable row level security;
alter table ranking_historico      enable row level security;

-- Leitura pública
create policy leitura_publica on clubes                 for select using (true);
create policy leitura_publica on atletas                for select using (true);
create policy leitura_publica on categorias             for select using (true);
create policy leitura_publica on tabelas_pontuacao      for select using (true);
create policy leitura_publica on tabela_pontuacao_itens for select using (true);
create policy leitura_publica on configuracoes          for select using (true);
create policy leitura_publica on torneio_categorias     for select using (true);
create policy leitura_publica on inscricoes             for select using (true);
create policy leitura_publica on partidas               for select using (true);
create policy leitura_publica on ranking_lancamentos    for select using (true);
create policy leitura_publica on ranking_publicacoes    for select using (true);
create policy leitura_publica on ranking_historico      for select using (true);
create policy leitura on torneios for select
  using (status <> 'rascunho' or is_admin() or clube_id = meu_clube_id());

-- Clubes
create policy admin_escreve on clubes for all using (is_admin()) with check (is_admin());
create policy clube_edita_proprio on clubes for update using (id = meu_clube_id()) with check (id = meu_clube_id());

-- Perfis
create policy ver_proprio on perfis for select using (id = auth.uid() or is_admin());
create policy admin_edita on perfis for update using (is_admin()) with check (is_admin());
create policy admin_apaga on perfis for delete using (is_admin());

-- Atletas: federação e clubes cadastram/editam
create policy gestor_insere on atletas for insert with check (e_gestor());
create policy gestor_edita  on atletas for update using (e_gestor()) with check (e_gestor());
create policy admin_apaga   on atletas for delete using (is_admin());
create policy gestor_tudo on atletas_contato for all using (e_gestor()) with check (e_gestor());

-- Cadastros da federação
create policy admin_escreve on categorias             for all using (is_admin()) with check (is_admin());
create policy admin_escreve on tabelas_pontuacao      for all using (is_admin()) with check (is_admin());
create policy admin_escreve on tabela_pontuacao_itens for all using (is_admin()) with check (is_admin());
create policy admin_escreve on configuracoes          for update using (is_admin()) with check (is_admin());
create policy admin_escreve on ranking_lancamentos    for all using (is_admin()) with check (is_admin());

-- Torneios: clube gere os próprios; federação gere todos
create policy gestor_insere on torneios for insert
  with check (is_admin() or clube_id = meu_clube_id());
create policy gestor_edita on torneios for update
  using (pode_gerir_torneio(id)) with check (is_admin() or clube_id = meu_clube_id());
create policy gestor_apaga on torneios for delete
  using (is_admin() or (clube_id = meu_clube_id() and status = 'rascunho'));

create policy gestor_escreve on torneio_categorias for all
  using (pode_gerir_torneio(torneio_id)) with check (pode_gerir_torneio(torneio_id));
create policy gestor_escreve on inscricoes for all
  using (pode_gerir_tc(torneio_categoria_id)) with check (pode_gerir_tc(torneio_categoria_id));

-- Partidas: resultado só via funções; direto apenas data/horário/quadra
create policy gestor_agenda on partidas for update
  using (pode_gerir_tc(torneio_categoria_id)) with check (pode_gerir_tc(torneio_categoria_id));
revoke insert, update, delete on partidas from anon, authenticated;
grant update (data, horario, quadra, em_quadra, atualizado_em) on partidas to authenticated;

-- =====================================================================
-- Tempo real (acompanhamento ao vivo das chaves)
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table partidas, torneios;
  end if;
end $$;

-- =====================================================================
-- Dados iniciais
-- =====================================================================
insert into clubes (nome, sigla) values
  ('Squash Tennis Center', 'STC'),
  ('ACE', 'ACE'),
  ('Royal', 'Royal'),
  ('Nacional', 'Nacional'),
  ('Lagoa Azul', 'Lagoa Azul');

with t as (
  insert into tabelas_pontuacao (nome, descricao)
  values ('Tabela padrão', 'Pontuação a definir pela federação.')
  returning id
)
insert into tabela_pontuacao_itens (tabela_id, fase, pontos)
select t.id, f, 0 from t, unnest(fases_validas()) f;
