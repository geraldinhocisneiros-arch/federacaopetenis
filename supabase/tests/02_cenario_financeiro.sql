\set ON_ERROR_STOP 1
-- Roda depois de 01_cenario_torneio.sql (mesmos usuários e torneio)
set role authenticated;
set request.uid = '00000000-0000-0000-0000-000000000001';

-- Anuidades e filiação
insert into anuidades(id, ano, tipo, nome, valor, vencimento) values
  ('44444444-4444-4444-4444-444444444441', extract(year from current_date)::int, 'atleta', 'Atleta adulto', 150, current_date + 30),
  ('44444444-4444-4444-4444-444444444442', extract(year from current_date)::int, 'academia', 'Academia', 600, current_date - 1);
select gerar_filiacoes_lote('44444444-4444-4444-4444-444444444442') as academias_geradas;
select gerar_filiacao('44444444-4444-4444-4444-444444444441', (select id from atletas where nome='Atleta 01'));
select gerar_filiacao('44444444-4444-4444-4444-444444444441', (select id from atletas where nome='Atleta 02'));

-- Baixa com pagamento a maior -> crédito
select baixar_lancamento((select lancamento_id from filiacoes_detalhe where nome='Atleta 01'), 200, current_date, 'pix', false, true);
select nome, status, numero is not null as tem_numero, status_pagamento from filiacoes_detalhe where nome='Atleta 01';
select nome, saldo from fin_saldos_credito;

-- Voucher 100% no Atleta 02 -> baixa automática
insert into fin_vouchers(codigo, tipo, valor, usos_max) values ('CORTESIA', 'percentual', 100, 1);
select aplicar_voucher((select lancamento_id from filiacoes_detalhe where nome='Atleta 02'), 'cortesia');
select nome, status, status_pagamento from filiacoes_detalhe where nome='Atleta 02';
-- esgotado
do $$ begin
  perform aplicar_voucher((select lancamento_id from filiacoes_detalhe where nome='Royal'), 'CORTESIA');
  raise exception 'deveria falhar';
exception when others then if sqlerrm = 'deveria falhar' then raise; end if; raise notice 'ok: %', sqlerrm; end $$;

-- Isenção de academia
select isentar_lancamento((select lancamento_id from filiacoes_detalhe where nome='Royal'), 'Parceria');
-- Estorno
select estornar_lancamento((select lancamento_id from filiacoes_detalhe where nome='Atleta 01'));
select nome, status from filiacoes_detalhe where nome in ('Atleta 01','Royal') order by nome;
select count(*) as creditos_apos_estorno from fin_creditos;

-- Inscrição com taxa (clube recebe) e exigência de filiação
update configuracoes set exigir_filiacao_inscricao = true;
insert into torneios(id,clube_id,nome,data_inicio,status) values ('55555555-5555-5555-5555-555555555555',(select id from clubes where sigla='Royal'),'Royal Open',current_date+5,'inscricoes');
insert into torneio_categorias(id,torneio_id,categoria_id,taxa_inscricao) values ('66666666-6666-6666-6666-666666666666','55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111', 120);
do $$ begin
  insert into inscricoes(torneio_categoria_id, atleta_id) select '66666666-6666-6666-6666-666666666666', id from atletas where nome='Atleta 03';
  raise exception 'deveria falhar';
exception when others then if sqlerrm = 'deveria falhar' then raise; end if; raise notice 'ok: %', sqlerrm; end $$;
insert into inscricoes(torneio_categoria_id, atleta_id) select '66666666-6666-6666-6666-666666666666', id from atletas where nome='Atleta 02';

-- Clube Royal dá baixa na inscrição que ele recebe
set request.uid = '00000000-0000-0000-0000-000000000002';
select descricao, recebedor_nome, valor_devido, status from fin_lancamentos_detalhe where categoria='inscricao_torneio';
select baixar_lancamento((select id from fin_lancamentos where categoria='inscricao_torneio'), 120, current_date, 'dinheiro');
-- Clube ACE não pode
set request.uid = '00000000-0000-0000-0000-000000000003';
select count(*) as ace_ve_inscricao_royal from fin_lancamentos where categoria='inscricao_torneio';
-- Remover inscrição paga -> crédito emitido pelo Royal
set request.uid = '00000000-0000-0000-0000-000000000002';
delete from inscricoes where torneio_categoria_id='66666666-6666-6666-6666-666666666666';
select nome, emissor_nome, saldo from fin_saldos_credito;

-- Taxa federativa do torneio do ACE (13 inscrições × 10)
set request.uid = '00000000-0000-0000-0000-000000000001';
select gerar_taxa_federacao_torneio('22222222-2222-2222-2222-222222222222', 10);
select descricao, valor from fin_lancamentos where categoria='taxa_torneio';

-- Publicações
insert into publicacoes(titulo, publicado) values ('Abertas as filiações', true), ('Rascunho', false);
set role anon; set request.uid = '';
select titulo, publicado_em is not null from publicacoes;
select count(*) as anon_ve_lancamentos from fin_lancamentos;
reset role;
set role authenticated; set request.uid = '00000000-0000-0000-0000-000000000001';
select resumo_adm();
