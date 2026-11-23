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
2. Aplique a migração `supabase/migrations/20261123000001_esquema_inicial.sql`, pelo SQL Editor ou com `supabase db push`.
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

## Estrutura

```
supabase/migrations/   esquema, regras (RLS), sorteio, ranking
src/pages/             páginas públicas
src/pages/painel/      painel do clube/federação
src/components/        Chave (bracket), Programação, gráfico, UI
src/lib/               cliente Supabase, auth, tipos, utilidades de tênis
```
