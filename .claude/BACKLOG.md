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

> **Reordenado em 2026-07-20** pelo dono (ver "Porquês da ordem" abaixo).

1. ~~**UX / organização**~~ ✅ **FECHADA** — UX-01 · FEAT-07 · UX-02 · FEAT-08.
2. **7e — Insumos/acessórios no estoque** *(promovido; era "item próprio")* — **◀ PRÓXIMA**.
3. **FEAT-06** (aba Produtos rica / composição congelada) — **depois do 7e, de propósito.**
4. **FEAT-03** (PDF melhor) · **branding/logo real** no PDF.
5. **Tier 4 inteiro** *(antecipado)*: numeração de orçamento no browser · labor na reserva de falha ·
   **DEC-01 pendência** (semântica do `contributionMargin`).
6. **TD-003** (capacidade por-máquina) · **TD-006** (paginação) — **antes** do Dashboard.
7. **Dashboard** (`/painel`) — só com ~1-2 meses de venda real.

### Porquês da ordem (decisões de 2026-07-20)

- **UX-02 subiu do Tier 4 pro 1º lugar:** não é cosmético — `DEFAULT_FIXED_COSTS` diz `machines: 2` e
  `DEFAULT_CAPACITY` diz `machines: 1` (`constants.ts:68-75`). Duas fontes de verdade discordando: o
  rateio de custo fixo (que entra no preço) assume 2 máquinas, o painel do catálogo assume 1. Com 2
  impressoras reais, o catálogo subestima peças/mês e dispara o alerta de capacidade cedo demais.
- **7e antes do FEAT-06:** o FEAT-06 **congela a composição de custo inteira** na produção. Se o 7e
  vier depois, congela-se um quadro que ainda não soma acessórios e mexe-se na estrutura de novo.
  7e primeiro ⇒ FEAT-06 congela o quadro completo de uma vez.
- **7e é prioritário porque há um buraco real de COGS:** acessórios **JÁ entram no preço**
  (`calculatePricing.ts:325`, `variableCost = printing + failureReserve + accessoriesCost`, com rateio
  por subitem), mas **NÃO entram no `frozenCost` da produção** (`production.ts:146-148`, decisão
  explícita: "provisão de pricing, não custo físico"). Resultado: o ímã é cobrado do cliente e nunca
  debitado como custo realizado ⇒ **o lucro por peça no histórico aparece maior do que é**.
- **TD-003/TD-006 antes do Dashboard:** TD-003 é a base da visão de "gargalo" — consertar antes evita
  construir o painel sobre conta errada e refazer. TD-006 sobe porque **o marco** (recadastro de tudo:
  produtos, filamentos, acessórios, impressões e vendas) chega como um volume grande de documentos de
  uma vez — paginação importa *no* marco, não meses depois.
- **NÃO confundir (verificado no código):** nem TD-003 nem TD-006 afetam a **gravação** dos dados. As
  horas de máquina do histórico vêm dos eventos de produção somados por `machineId`
  (`machineRoi.ts:87-89`) — dado real, já correto. TD-003 afeta só a **projeção** de capacidade na
  tela; TD-006 é custo/desempenho de **leitura**. O registro do `/maquinas` não está contaminado.

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
  `SaleModal`. **Habilitado por ele (não feito):** reorganizar o form da principal e enriquecer o card
  do catálogo com mais dados (composição, margem…).
- ~~**[UX-02] Capacidade do catálogo congelada**~~ **✅ FEITO (2026-07-20)** — `capacitySettings` virou
  derivação (`useMemo`) do `fixedCostRate` persistido, mesma fonte do rateio de custo fixo.
- ~~**[FEAT-08] Ações "Produzir"/"Orçar" no card**~~ **✅ FEITO (2026-07-20)** — as 3 ações (vender,
  produzir, orçar) na coluna Ações e no painel expandido, **para o inteiro e por subitem**; seed
  `?produto=&subitem=`. Detalhe (inclusive por que a "derivação pura" não servia) em `HISTORICO.md`.
- **[UX-03] Nome do produto truncado sem escape no catálogo** *(reportado pelo dono, 2026-07-20 — efeito
  colateral aceito do FEAT-08)*. A faixa de "Ações" foi de 76px pra 146px (`catalog.css`) e, abaixo de
  ~860px, o `.col-name` corta com reticências — **e não há como ler o nome inteiro**: a célula não tem
  `title` e o painel expandido também não repete o nome.
  **Paliativo APLICADO (2026-07-20):** `title={product.name}` na célula ⇒ o nome inteiro aparece ao
  passar o mouse. **Continua aberto** o que o `title` NÃO resolve: **toque/mobile não tem hover**, e o
  painel expandido segue sem repetir o nome. Saídas restantes: nome no cabeçalho do painel expandido,
  ou repensar a grade (nome em 2 linhas / ações compactadas em menu).
  **Onde:** `ProductCatalog.tsx` + `catalog.css`.
  ⚠ Lembrete: a linha **não é tabela**, é `display: grid`; as regras `sticky` de `col-actions` (~536)
  são mortas.
- **[UX-04] Catálogo mostra só a 1ª máquina em produto multi-etapa** *(reportado pelo dono, 2026-07-20)*.
  A coluna "Máquina" renderiza `result.machine.name` (`ProductCatalog.tsx:264-275`), que é a impressora
  **principal** do produto — etapas extras com `machineId` próprio ficam invisíveis. Opções: listar as
  máquinas distintas (ou "A1 +1") na coluna e detalhar no painel expandido. **Parente do TD-003**
  (capacidade não é por-máquina) — vale conferir se sai junto.

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

### Tier 3 — infra de cálculo/leitura (TD-*) e, por último, o Dashboard
> Ordem interna: **TD-003 → TD-006 → Dashboard** (o Dashboard é o último item do backlog).

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

### 7e — Insumos no estoque *(prioridade 2; pré-requisito do FEAT-06)*
- **[7e] Insumos no estoque** — `supplyId` no `Accessory`, cadastro de insumos (ímãs, parafusos,
  embalagem…) na `/estoque`, baixa por unidade (`kind: 'supply'`, **já previsto** no `stockMoves` desde
  a 7a). Ver D1 em `HISTORICO.md`.
  **Precisão importante (verificada no código):** acessórios **NÃO** estão fora do custo em geral —
  entram no **preço** (`calculatePricing.ts:325`). O que falta é entrarem no **custo realizado**: o
  `frozenCost` da produção os exclui de propósito (`production.ts:146-148`). Portanto o 7e fecha o
  buraco do **COGS do acabado**, onde hoje o lucro por peça sai superestimado.
