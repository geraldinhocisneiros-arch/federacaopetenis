-- =====================================================================
-- FPET - Placar obrigatório no lançamento de resultado
--   Jogo normal: ao menos 1 set, nenhum set empatado, e o vencedor
--                informado precisa ter vencido mais sets.
--   Desistência: ao menos 1 set (o placar no momento da desistência).
--   W.O.: sem placar.
-- =====================================================================

create or replace function validar_placar(p_placar jsonb, p_tipo text, p_vencedor_lado int)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  e   jsonb;
  a   int;
  b   int;
  s1  int := 0;
  s2  int := 0;
  n   int := 0;
begin
  if p_tipo = 'wo' then return '[]'::jsonb; end if;
  if p_placar is null or jsonb_typeof(p_placar) <> 'array' or jsonb_array_length(p_placar) = 0 then
    raise exception 'Informe o placar do jogo (só W.O. pode ficar sem placar).';
  end if;
  for e in select * from jsonb_array_elements(p_placar) loop
    n := n + 1;
    if jsonb_typeof(e) <> 'array' or jsonb_array_length(e) <> 2
       or jsonb_typeof(e->0) <> 'number' or jsonb_typeof(e->1) <> 'number' then
      raise exception 'Placar inválido no %º set.', n;
    end if;
    a := (e->>0)::int; b := (e->>1)::int;
    if a < 0 or b < 0 or a > 99 or b > 99 then raise exception 'Placar inválido no %º set.', n; end if;
    if p_tipo = 'normal' and a = b then raise exception 'O %º set está empatado (%-%).', n, a, b; end if;
    if a > b then s1 := s1 + 1; elsif b > a then s2 := s2 + 1; end if;
  end loop;
  if n > 5 then raise exception 'Placar com sets demais.'; end if;
  if p_tipo = 'normal' then
    if s1 = s2 then raise exception 'O placar está empatado em sets (% a %): falta o set decisivo.', s1, s2; end if;
    if (s1 > s2 and p_vencedor_lado <> 1) or (s2 > s1 and p_vencedor_lado <> 2) then
      raise exception 'O placar não confere com o vencedor escolhido.';
    end if;
  end if;
  return p_placar;
end $$;

create or replace function registrar_resultado(
  p_partida uuid, p_vencedor uuid, p_placar jsonb default '[]'::jsonb, p_tipo text default 'normal'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  p       partidas;
  v_prox  partidas;
  v_t     torneios;
  v_placar jsonb;
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

  v_placar := validar_placar(p_placar, p_tipo, case when p_vencedor = p.inscricao1_id then 1 else 2 end);

  -- Corrigindo o vencedor: a partida seguinte não pode ter sido jogada
  if p.vencedor_id is not null and p.vencedor_id <> p_vencedor then
    select * into v_prox from partidas
     where torneio_categoria_id = p.torneio_categoria_id and rodada = p.rodada + 1 and ordem = p.ordem / 2;
    if v_prox.vencedor_id is not null then
      raise exception 'Desfaça primeiro o resultado da partida seguinte.';
    end if;
  end if;

  perform _finalizar_partida(p.id, p_vencedor, v_placar, p_tipo);

  select t.* into v_t from torneios t join torneio_categorias tc on tc.torneio_id = t.id
   where tc.id = p.torneio_categoria_id;
  if v_t.status in ('rascunho', 'inscricoes') then
    update torneios set status = 'em_andamento' where id = v_t.id;
  end if;
end $$;
