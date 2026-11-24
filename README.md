# FPET · Federação Pernambucana de Tênis

Sistema de ranking, torneios e chaves da FPET.

- **Frontend:** React + Vite + Tailwind, hospedado no **Cloudflare Pages**
- **Backend:** **Supabase** (Postgres, autenticação, tempo real). Toda a regra de negócio (sorteio da chave, avanço dos vencedores, pontuação e ranking) está no banco, em `supabase/migrations/`.

## O que o sistema faz

| Área | Quem usa | O quê |
|---|---|---|
| Site público | Qualquer pessoa | Ranking por categoria (com ▲▼), torneios, chaves e programação ao vivo, perfil do atleta (posição, gráfico de evolução, resultados), clubes |
| Painel do clube | Usuário vinculado a um clube | Cria torneios do clube, escolhe categorias, inscreve atletas, sorteia a chave, define horários ("NÃO ANTES DAS 17h"), lança resultados, encerra o torneio |
| Painel da federação | Admin | Tudo acima para todos os clubes + categorias oficiais, tabelas de pontuação, regras do ranking, importação do ranking inicial, homologação, usuários |
| Área ADM | Admin | Visão geral: recebido/a receber/vencido, filiações do ano, torneios a homologar, taxas federativas pendentes |
| Filiação | Admin (clubes consultam) | Anuidades por ano (atleta/academia), filiação individual ou em lote, nº de registro, situação pública no perfil do atleta |
| Financeiro | Admin e clubes | Recebimentos, pagamentos, baixa (com crédito e pagamento a maior), estorno, isenção, vouchers, créditos. Clube dá baixa nas inscrições que ele recebe |
| Publicações | Admin | Notícias, comunicados, resultados, regulamentos e editais em `/noticias` |
| Estatísticas | Qualquer pessoa | `/estatisticas`: líderes por vitórias, aproveitamento, títulos, games, tiebreaks (por ano/categoria/modalidade). No perfil do atleta, aba com filtros por ano, torneio e categoria, resultado por torneio, games vencidos/perdidos, confronto direto |
| Área do atleta | Atleta | Cria o acesso no site e se vincula ao cadastro com CPF + nascimento (na hora, se bater; senão a federação aprova). Vê estatísticas, filiação, cobranças e eventos; atualiza contato e foto |
| Cursos e eventos | Todos (federação e academias publicam) | `/eventos`: agenda de cursos, clínicas, capacitações. Inscrição pelo site com vagas, lista de espera e cobrança, link externo ou só divulgação |

### Fluxo de um torneio
1. Clube cria o torneio e adiciona as categorias (da lista oficial da federação).
2. Inscreve os atletas (ou duplas).
3. **Sorteia a chave**: os cabeças vêm do ranking atualizado (1 no topo, 2 no pé, 3-4 sorteados entre topo do 2º quarto e pé do 3º, 5-8 entre as posições seguintes, padrão ITF). Os byes vão primeiro para os cabeças e o restante é sorteio.
4. Define data, horário e quadra de cada jogo e lança os resultados. O vencedor avança sozinho, e quem acompanha o site vê em tempo real.
5. Clube **encerra** o torneio.
6. A federação **homologa**: os pontos entram no ranking e o histórico (subiu/desceu) é registrado.

### Regras configuráveis (a definir pela federação)
- **Tabela de pontos por fase** (campeão, vice, semi, quartas…). Pode haver várias tabelas, para torneios de pesos diferentes.
- **Validade dos pontos** (padrão: janela móvel de 52 semanas) e **N melhores resultados**.
- Por categoria de torneio: **W.O.** (a partir de qual fase vale como vitória, e se o perdedor pontua), **bye** (conta ou não como vitória), número de cabeças e formato da partida.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com URL e chave anon do Supabase
npm run dev
```

## Publicação

### 1. Supabase
1. Crie o projeto (região `sa-east-1`, São Paulo).
2. Aplique as migrações de `supabase/migrations/` em ordem (pelo SQL Editor ou com `supabase db push`).
3. Em *Authentication → URL Configuration*, coloque a URL do site do Cloudflare.
4. Cadastre-se no site e torne-se administrador:
   ```sql
   update perfis set papel = 'admin' where email = 'seu-email@exemplo.com';
   ```

### 2. Cloudflare (Workers)
1. *Workers & Pages → Create → Import a repository* e escolha este repositório.
2. Build command: `npm run build`. Deploy command: `npx wrangler deploy`.
3. Não precisa de variáveis de ambiente: a URL e a chave pública do Supabase já estão em `.env.production`.
4. O `wrangler.jsonc` publica a pasta `dist` e faz as rotas do app (SPA) funcionarem.
5. **Cadastro de usuários pelo painel:** em *Settings → Variables and Secrets*, adicione `SUPABASE_SECRET_KEY` (tipo **Secret**) com a chave `sb_secret_...` do Supabase (*Project Settings → API Keys*). Ela fica só no servidor (`worker/index.ts`), nunca no navegador.

## Estrutura

```
supabase/migrations/   esquema, regras (RLS), sorteio, ranking
src/pages/             páginas públicas
src/pages/painel/      painel do clube/federação
src/components/        Chave (bracket), Programação, gráfico, UI
src/lib/               cliente Supabase, auth, tipos, utilidades de tênis
```

### Financeiro e inscrições
- A taxa de inscrição (R$) é definida por categoria do torneio (aba 2). Cada atleta inscrito gera uma cobrança; em duplas, uma para cada.
- Quem recebe (clube organizador ou federação) é definido no torneio. Quem recebe dá a baixa.
- Inscrição removida: cobrança em aberto é cancelada; cobrança paga vira crédito do atleta.
- Opcional (Financeiro → Configurações): exigir filiação ativa para inscrever e taxa federativa por inscrição.
- **PIX/Boleto automático:** ainda não configurado. As cobranças já têm campos reservados (`gateway_*`) para a integração.
