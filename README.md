# Investidor Novo

Plataforma educacional em português para quem está começando a investir na B3. O app reúne análise explicável de ações e FIIs, carteira, movimentações, importação CSV e planejamento financeiro mensal.

> Os scores organizam indicadores e não constituem recomendação de compra. Dados ausentes nunca são preenchidos com estimativas silenciosas.

## Tecnologias

- Next.js 16 App Router, React 19 e TypeScript estrito
- Tailwind CSS, shadcn/ui, Radix, Lucide, Geist e Recharts
- Neon PostgreSQL com Drizzle ORM
- Better Auth com e-mail e senha
- React Hook Form, Zod e formatos brasileiros
- Vitest para cálculos e parsers

## Configuração local

1. Copie `.env.example` para `.env.local`.
2. Preencha as variáveis sem usar prefixo `NEXT_PUBLIC_`:

```dotenv
DATABASE_URL=
NEON_API_KEY=
BRAPI_TOKEN=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
CRON_SECRET=
```

`BRAPI_TOKEN` habilita os fundamentos das ações (histórico de preço, proventos, balanço e DRE), carregados sob demanda ao abrir cada ativo. Sem ele, as listagens de ações e FIIs continuam funcionando com preço, variação e volume da lista pública da brapi, e os FIIs mantêm P/VP, rendimentos e idade vindos do informe mensal da CVM. Cadastre um token gratuito em [brapi.dev](https://brapi.dev) (plano grátis: 15.000 requisições/mês).

3. Instale, migre, carregue o universo de ativos e inicie:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

O app estará disponível em `http://localhost:3000`.

## Rotinas e dados

- brapi (lista pública): catálogo completo de ações e FIIs da B3 com preço, variação e volume. Não consome cota de token.
- brapi (cotação por ativo): fundamentos das ações — histórico, proventos, balanço, DRE e estatísticas. Requer `BRAPI_TOKEN`.
- CVM Informe Mensal FII: P/VP, dividend yield, patrimônio, idade e composição da carteira dos fundos.
- B3 COTAHIST: código ISIN, que liga o ticker da B3 ao CNPJ da CVM.
- CVM DFP/ITR: arquivos estruturados de companhias abertas, versionados como fonte auditável.

As rotas de cron exigem `Authorization: Bearer <CRON_SECRET>`:

- `GET /api/cron/refresh-quotes`: a cada 15 min no pregão; sincroniza preço e variação de todos os ativos.
- `GET /api/cron/refresh-market`: dias úteis; sincroniza o universo, os códigos ISIN e os snapshots das carteiras.
- `GET /api/cron/refresh-fundamentals`: semanal; deriva as métricas de FII da CVM e preenche os fundamentos das ações mais líquidas.

A listagem se atualiza sozinha enquanto a aba está aberta, via `GET /api/market/assets`, que lê do banco (o polling não toca na brapi). O dado gratuito da B3 tem atraso de aproximadamente 15 minutos, exibido na tela.

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

O modelo de importação está em `public/modelo-movimentacoes.csv`. O formato é UTF-8, separado por `;`, com decimal brasileiro.

As três planilhas originais permanecem na raiz apenas como referência funcional; valores pessoais não são importados automaticamente.
