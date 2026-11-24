\set ON_ERROR_STOP 1
-- Roda depois de 01 e 02
set role authenticated;
set request.uid = '00000000-0000-0000-0000-000000000001';
update atletas set data_nascimento = '2000-05-10' where nome = 'Atleta 01';
insert into atletas_contato(atleta_id, cpf) select id, '123.456.789-01' from atletas where nome = 'Atleta 01'
  on conflict (atleta_id) do update set cpf = excluded.cpf;
reset role;
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000010','a01@x'),('00000000-0000-0000-0000-000000000011','novo@x'),('00000000-0000-0000-0000-000000000012','golpe@x');
set role authenticated;

-- Atleta 01 vincula sozinho (CPF + nascimento batem)
set request.uid = '00000000-0000-0000-0000-000000000010';
select solicitar_vinculo_atleta('Atleta 01', '12345678901', '2000-05-10');
select p.email, a.nome from perfis p join atletas a on a.id = p.atleta_id where p.id = auth.uid();
-- Alguém com o CPF certo mas nascimento errado: vira solicitação, não vincula
set request.uid = '00000000-0000-0000-0000-000000000012';
select solicitar_vinculo_atleta('Golpista', '12345678901', '1999-01-01');
-- Atleta novo, sem cadastro
set request.uid = '00000000-0000-0000-0000-000000000011';
select solicitar_vinculo_atleta('Atleta Novo', '98765432100', '2005-01-01', 'M');
select count(*) as minhas_solicitacoes from solicitacoes_atleta;
-- Admin aprova o novo (cria cadastro) e recusa o golpe
set request.uid = '00000000-0000-0000-0000-000000000001';
select aprovar_solicitacao_atleta((select id from solicitacoes_atleta where nome='Atleta Novo')) is not null as criado;
select recusar_solicitacao_atleta((select id from solicitacoes_atleta where nome='Golpista'), 'Dados não conferem');
select nome, status from solicitacoes_atleta order by nome;
select solicitacoes_pendentes();

-- Estatísticas do Atleta 01 (campeão do Open ACE no cenário 01? venceu jogos como jogador 1)
set role anon; set request.uid = '';
select torneio_nome, rodada, total_rodadas, adversario, venceu, tipo_resultado, sets_pro, sets_contra, games_pro, games_contra
from partidas_atleta where atleta_id = (select id from atletas where nome='Atleta 01') order by rodada;
select nome, jogos, vitorias, derrotas, aproveitamento, games_pro, games_contra, titulos, finais
from estatisticas_lideres(extract(year from current_date)::int) order by vitorias desc, games_pro desc limit 5;

-- Eventos
set role authenticated;
set request.uid = '00000000-0000-0000-0000-000000000002';  -- clube Royal
insert into eventos(id, titulo, tipo, data_inicio, clube_id, valor, vagas)
values ('77777777-7777-7777-7777-777777777777', 'Clínica de saque', 'clinica', current_date + 10, (select id from clubes where sigla='Royal'), 80, 1);
-- ACE não pode editar evento do Royal
set request.uid = '00000000-0000-0000-0000-000000000003';
update eventos set titulo = 'hack' where id = '77777777-7777-7777-7777-777777777777';
select titulo from eventos where id = '77777777-7777-7777-7777-777777777777';
-- Inscrições: 1ª confirmada (com cobrança), 2ª lista de espera
set request.uid = '00000000-0000-0000-0000-000000000010';
select inscrever_evento('77777777-7777-7777-7777-777777777777', 'Atleta 01');
set request.uid = '00000000-0000-0000-0000-000000000011';
select inscrever_evento('77777777-7777-7777-7777-777777777777', 'Atleta Novo');
select nome, status from evento_inscricoes;  -- só vê a própria
-- Atleta 01 cancela -> Atleta Novo é promovido e ganha cobrança
set request.uid = '00000000-0000-0000-0000-000000000010';
select descricao, status from fin_lancamentos where categoria='evento';
select cancelar_inscricao_evento((select id from evento_inscricoes where perfil_id = auth.uid()));
set request.uid = '00000000-0000-0000-0000-000000000002';
select nome, status, lancamento_id is not null as tem_cobranca from evento_inscricoes order by criado_em;
select titulo, inscritos, organizador_nome from eventos_lista;
