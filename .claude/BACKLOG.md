# LopoLabCalc — Backlog (a fazer)

> **Roadmap dos itens ABERTOS + ordem de prioridade.** Curto de propósito — é o que se lê pra
> escolher/rever a próxima tarefa (não precisa do histórico pesado pra isso).
> O *porquê* / detalhe de design (D1–D8, auditoria, writeups do que já foi feito) vive em
> [`.claude/HISTORICO.md`](HISTORICO.md) — abra sob demanda ao pegar o item.
> A foto do AGORA + a próxima tarefa sugerida vivem no `CLAUDE.md`.
>
> **Tier 0 e Tier 1 ✅ FECHADOS** (calculadora, venda/histórico, orçamento PDF, ROI, Estoque de
> filamento, FEAT-01/02/04/05, passo 8 = reconciliação). Detalhe de tudo isso: `HISTORICO.md`.

## Ordem de prioridade

1. **UX / organização** *(barato, alto valor diário; atacar 1º)*: ~~UX-01~~ ✅ → ~~FEAT-07~~ ✅ →
   **FEAT-08** (ações "Produzir"/"Orçar" no card). O padrão de seed cross-page (`?param=<id>` +
   `<Suspense>`) já existe desde o FEAT-07 — o FEAT-08 só o reusa.
2. **Tier 2** (features comerciais, independentes): **FEAT-03** (PDF melhor) · **branding/logo real**
   no PDF · **FEAT-06** (aba Produtos rica).
3. **Tier 3** (adiar até ter volume de vendas): **Dashboard** (`/painel`) + **TD-003** · **TD-006**.
4. **Tier 4** (menores/oportunistas): **UX-02** (capacidade congelada no catálogo) · numeração de
   orçamento no browser · labor na reserva de falha · **DEC-01 pendência** (semântica do
   `contributionMargin`).
5. **Item próprio (quando o dono quiser):** **7e — Insumos** no estoque.

> Diretriz 7 (dados descartáveis, marco futuro) cobre o backlog inteiro → **nenhum item precisa de
> migração**. Não reordenar por causa disso.

## Itens abertos

### Bugs
- ~~**[BUG-03]** Histórico de vendas e extrato de rolos fora de ordem~~ **✅ FEITO (2026-07-19)** — `Recibo`
  ganhou `createdAt` (max dos itens) e os sorts por data usam `(saleDate, createdAt)`; `colorStatement`
  desempata por `seq` (createdAt do evento no consumo). Rolos/ajustes seguem só com o dia.
- ~~**[BUG-02]** Produção/estoque ignoravam o `piecesCount`~~ **✅ FEITO (2026-07-19)** — 1 evento = 1
  placa credita N acabados a custo÷N; encomenda ÷pieces; `/producao` com campo "Quantas placas". Detalhe
  em `HISTORICO.md`.

### UX / navegação e organização
- ~~**[UX-01] Barra de navegação unificada**~~ **✅ FEITO (2026-07-19)** — componente `NavBar.tsx`
  (6 destinos fixos + tema + logout; rota ativa via `usePathname`/`aria-current`) reusado pelo `Header`
  e pelos 5 headers de página; "Início/Calculadora" = navegação limpa. Detalhe em `HISTORICO.md`.
- ~~**[FEAT-07] Página de catálogo dedicada**~~ **✅ FEITO (2026-07-20)** — rota `/catalogo` +
  `CatalogPage`; "editar" navega pra `/?load=<id>` (ajuste no render + `replaceState`; `<Suspense>` na
  raiz p/ o `useSearchParams`, `/` seguiu estática). `SaleFlow` extraído p/ não duplicar a fiação do
  `SaleModal`. **Sobrou pra decidir:** ver **UX-02** abaixo (capacidade congelada no catálogo).
  **Habilitado por ele (não feito):** reorganizar o form da principal e enriquecer o card do catálogo
  com mais dados (composição, margem…).
- **[UX-02] Capacidade do catálogo ficou congelada em `DEFAULT_CAPACITY`** *(pequeno; herança do
  FEAT-07)*. **O que é:** ao expandir a linha de um produto no catálogo, o painel de capacidade cruza as
  horas de impressão com **horas/dia** e **nº de máquinas** (`calculateCapacity.ts`) e mostra peças/dia,
  peças/mês, bruto/lucro e o alerta "⚠️ Acima da capacidade (N pçs/mês)" do ponto de equilíbrio.
  **O que mudou:** essas 2 variáveis eram estado da página principal — ajustadas no card de resultado da
  calculadora, o catálogo logo abaixo recalculava junto. Com o catálogo em rota própria não há esse
  controle: usa fixo **20h/dia · 1 máquina**. **Atenuante:** o painel *exibe* os parâmetros que usou
  ("20h/dia · 1 máquina"), então nada fica silenciosamente errado — só congelado; quem roda 2 máquinas
  vê números subestimados, mas rotulados. **Duas saídas:** (a) replicar o controle no `/catalogo`, ou
  (b) **provavelmente melhor** — persistir horas/dia e nº de máquinas junto com os custos fixos, já que
  o `useBusinessSettings`/`FixedCostRate` **já guarda `machines` e `hoursDay`** pro rateio de custo
  fixo; vale checar se dá pra reusar em vez de ter dois lugares dizendo a mesma coisa. **Onde:**
  `CatalogPage` (hoje passa `DEFAULT_CAPACITY` literal), `ProductCatalog`/`CatalogDetails`,
  `PricingResultCard` (controle atual).
- **[FEAT-08] Ações "Produzir" e "Orçar" no card do catálogo** *(pequeno; mesmo card do FEAT-07)*. Hoje
  cada item só tem **Editar / Excluir / Registrar venda** — a venda era o único destino quando o app
  era só calculadora. Com produção e orçamento já existindo, adicionar **"Produzir item"** (→
  `/producao` com o produto pré-selecionado) e **"Orçar item"** (→ `/orcamento` com o produto já como
  linha). **Wrinkle:** ambos são **cross-page com seed do produto** (mesmo padrão do "editar" do
  FEAT-07 — query `?...=<id>` ou store compartilhado); "Registrar venda" continua abrindo o modal na
  própria página. **Onde:** `ProductCatalog` (card), `ProductionPage`/`QuotePage` pra receber o seed.

### Tier 2 — comerciais
- **[FEAT-03] Melhorar o PDF do orçamento** *(guarda-chuva)*. Ideias-semente (o dono escolhe o que vira
  tarefa): prazo de entrega, foto/thumbnail do item, formas de pagamento/condições, termos/observações,
  QR code do WhatsApp, detalhar etapas/subitens (usa FEAT-01), desconto/acréscimo, branding real.
  **Onde:** `generateQuotePdf.ts` + `QuotePage`/`config/orcamento`. Lista completa em `HISTORICO.md`.
- **[branding/logo real]** trocar o logo placeholder (impressora) pela logo real no PDF — já há
  comentário no código. Overlap com FEAT-03.
- **[FEAT-06] Aba Produtos rica** — cada card da aba Produtos (`/estoque`) mostra os dados completos do
  produto (composição de custo, margem, subitens, etapas…) mas com os **custos CONGELADOS** da
  fabricação. **Decisão do dono: opção (b)** — o acabado passa a guardar a **composição inteira
  congelada na produção** (`FinishedLayer`/evento `producao` ganham um `SaleCostBreakdown`), não puxa do
  produto vivo. Consequência: o `costBreakdown` da venda de peça pronta passa a vir da camada congelada
  (hoje é stopgap do snapshot do catálogo). **Onde:** `StockPage` + reusar `CostBars`/`ProfitSummary`.
  Contexto completo em `HISTORICO.md`.

### Tier 3 — só com volume de vendas
- **[Dashboard] (`/painel`)** — receita/custo/lucro do mês, lucro líquido (menos custos fixos),
  utilização das máquinas (comprar outra?), receita por máquina, lucro por material, produto mais
  lucrativo. Só vale com ~1-2 meses de vendas no banco.
- **[TD-003] Capacidade não é por-máquina** em produto multi-etapa (`calculateCapacity.ts` soma horas e
  multiplica por `machines` genérico). Atacar **junto do Dashboard** — é a base do "gargalo".
- **[TD-006] Paginação** — `subscribeProducts`/`useSales` assinam a coleção inteira. Ok hoje; revisitar
  quando `/vendas` acumular meses.

### Tier 4 — menores/oportunistas
- **Numeração de orçamento derivada no browser** — 2 abas/2 cliques podem repetir o número.
- **Labor incluído na reserva de falha** — impacto de centavos.
- **[DEC-01 pendência] Semântica do `contributionMargin`** — hoje é o **LUCRO por peça**, não a margem
  de contribuição clássica; alimenta só o ponto de equilíbrio. **Decisão que falta:** corrigir o
  cálculo do break-even (muda comportamento — o ponto diminui) ou só renomear a variável. Ver a NOTA no
  `calculatePricing.ts` e o detalhe em `HISTORICO.md`.

### Item próprio (depois do filamento)
- **[7e] Insumos no estoque** — `supplyId` no `Accessory`, cadastro de insumos (ímãs, parafusos,
  embalagem…) na `/estoque`, baixa por unidade (`kind: 'supply'`, **já previsto** no `stockMoves` desde
  a 7a). Enquanto não existir, **acessórios ficam fora do COGS**. Ver D1 em `HISTORICO.md`.
