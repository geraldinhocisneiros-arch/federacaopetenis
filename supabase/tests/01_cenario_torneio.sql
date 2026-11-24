\set ON_ERROR_STOP 1
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000001','admin@x'),('00000000-0000-0000-0000-000000000002','royal@x'),('00000000-0000-0000-0000-000000000003','ace@x');
update perfis set papel='admin' where id='00000000-0000-0000-0000-000000000001';
update perfis set papel='clube', clube_id=(select id from clubes where sigla='Royal') where id='00000000-0000-0000-0000-000000000002';
update perfis set papel='clube', clube_id=(select id from clubes where sigla='ACE') where id='00000000-0000-0000-0000-000000000003';

set role authenticated;
set request.uid = '00000000-0000-0000-0000-000000000001';
insert into categorias(id,nome) values ('11111111-1111-1111-1111-111111111111','1ª Classe');
update tabela_pontuacao_itens set pontos = case fase when 'campeao' then 100 when 'final' then 70 when 'semifinal' then 50 when 'quartas' then 30 when 'oitavas' then 15 else 5 end;
insert into atletas(nome, sexo) select 'Atleta '||lpad(g::text,2,'0'), 'M' from generate_series(1,13) g;
insert into ranking_lancamentos(atleta_id,categoria_id,pontos,tipo,descricao,data_referencia)
  select id,'11111111-1111-1111-1111-111111111111', 1000 - (substr(nome,8)::int)*100, 'importacao','Ranking inicial', current_date - 30 from atletas where substr(nome,8)::int <= 6;
select publicar_ranking('11111111-1111-1111-1111-111111111111', null, 'Inicial');

-- Clube ACE cria torneio
set request.uid = '00000000-0000-0000-0000-000000000003';
insert into torneios(id,clube_id,nome,data_inicio,data_fim,status,tabela_pontuacao_id) values ('22222222-2222-2222-2222-222222222222',(select id from clubes where sigla='ACE'),'Open ACE',current_date-2,current_date,'inscricoes',(select id from tabelas_pontuacao limit 1));
insert into torneio_categorias(id,torneio_id,categoria_id) values ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111');
insert into inscricoes(torneio_categoria_id, atleta_id) select '33333333-3333-3333-3333-333333333333', id from atletas;
select gerar_chave('33333333-3333-3333-3333-333333333333');
\echo '--- Chave (linhas)'
select posicao_chave, cabeca, pontos_ranking, atleta_nome from inscricoes_detalhe where torneio_categoria_id='33333333-3333-3333-3333-333333333333' order by posicao_chave;
\echo '--- 1a rodada'
select ordem, jogador1, jogador2, tipo_resultado from partidas_detalhe where rodada=1 order by ordem;

-- Royal tenta mexer: deve falhar
set request.uid = '00000000-0000-0000-0000-000000000002';
\set ON_ERROR_STOP 0
select gerar_chave('33333333-3333-3333-3333-333333333333');
update torneios set nome='hack' where id='22222222-2222-2222-2222-222222222222';
select count(*) as hack_count from torneios where nome='hack';
update partidas set vencedor_id = inscricao1_id;
\set ON_ERROR_STOP 1

-- ACE lança resultados: vence sempre o jogador 1; um W.O. na 1a rodada
set request.uid = '00000000-0000-0000-0000-000000000003';
update partidas set horario='NÃO ANTES DAS 17h', quadra='Quadra 1', data=current_date where rodada=1;
do $$ declare p record; first boolean := true; begin
  for r in 1..4 loop
    for p in select * from partidas where rodada=r and vencedor_id is null order by ordem loop
      perform registrar_resultado(p.id, p.inscricao1_id, '[[6,4],[6,3]]'::jsonb, case when first and r=1 then 'wo' else 'normal' end);
      first := false;
    end loop;
  end loop; end $$;
\echo '--- teste desfazer final e relançar'
select desfazer_resultado((select id from partidas where rodada=4));
select registrar_resultado((select id from partidas where rodada=4),(select inscricao2_id from partidas where rodada=4),'[[6,4],[6,7],[8,10]]','normal');
select encerrar_torneio('22222222-2222-2222-2222-222222222222');
\set ON_ERROR_STOP 0
select homologar_torneio('22222222-2222-2222-2222-222222222222');
\set ON_ERROR_STOP 1
set request.uid = '00000000-0000-0000-0000-000000000001';
\echo '--- previa'
select * from previa_pontos_torneio('22222222-2222-2222-2222-222222222222');
select homologar_torneio('22222222-2222-2222-2222-222222222222');
\echo '--- ranking'
select posicao, nome, pontos, torneios, posicao_anterior from ranking_categoria('11111111-1111-1111-1111-111111111111');
select * from ranking_do_atleta((select id from atletas where nome='Atleta 01'));
