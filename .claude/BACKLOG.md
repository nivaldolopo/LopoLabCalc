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

> **Reordenado em 2026-07-20** pelo dono; **FEAT-03 movido para penúltimo em 2026-07-31**;
> **UX-06 + UX-07(a) escolhidos como próxima em 2026-08-10** (dono), à frente do FEAT-03
> (ver "Porquês da ordem" abaixo).

1. ~~**UX / organização**~~ ✅ **FECHADA** — UX-01 · FEAT-07 · UX-02 · FEAT-08.
2. ~~**7e — Insumos/acessórios no estoque**~~ ✅ **FECHADO (2026-07-20)**.
3. ~~**FEAT-06** (aba Produtos rica / composição congelada)~~ ✅ **FECHADO (2026-07-20)**.
4. ~~**Tier 4 inteiro**~~ ✅ **FECHADO (2026-07-31)** — numeração atômica · DEC-01 renomeado · ROI real ·
   labor na reserva mantido.
5. ~~**TD-003** (capacidade por-máquina) · **UX-04** (catálogo multi-máquina)~~ ✅ **FECHADO (2026-08-04)**
   · ~~**TD-006** (paginação) + **UX-05 Fase 2/3** (busca em vendas/produção)~~ ✅ **FECHADO (2026-08-10)**.
6. ~~**Cluster "linha + dropdown de detalhe"**~~ ✅ **FECHADO (2026-08-10)** — **UX-06** (`/vendas` +
   `/producao`) **+ UX-07(a)** (aba Produtos do estoque) viraram linha + dropdown; o popover `CostDetail`
   virou a tabela compartilhada `CostBreakdownTable`. **UX-07(b)** segue adiado pro Dashboard.
7. **◀ PRÓXIMA — Tier 2 comerciais** — **FEAT-03** (PDF melhor) · **branding/logo real** no PDF.
   (~~**FEAT-09** desconto na venda~~ ✅ **FECHADO 2026-08-10**.)
8. **Dashboard** (`/painel`) — só com ~1-2 meses de venda real; absorve **UX-07(b)**.

### Porquês da ordem (decisões de 2026-07-20)

- **UX-02 subiu do Tier 4 pro 1º lugar:** não é cosmético — `DEFAULT_FIXED_COSTS` diz `machines: 2` e
  `DEFAULT_CAPACITY` diz `machines: 1` (`constants.ts:68-75`). Duas fontes de verdade discordando: o
  rateio de custo fixo (que entra no preço) assume 2 máquinas, o painel do catálogo assume 1. Com 2
  impressoras reais, o catálogo subestima peças/mês e dispara o alerta de capacidade cedo demais.
- **7e veio antes do FEAT-06 (e já fechou):** o FEAT-06 **congela a composição de custo inteira** na
  produção; com o 7e feito, ele congela o quadro completo (já com insumos) de uma vez. O buraco de
  COGS que motivava a ordem está fechado — o `frozenCost` soma insumos desde 2026-07-20.
- **TD-003/TD-006 antes do Dashboard:** TD-003 é a base da visão de "gargalo" — consertar antes evita
  construir o painel sobre conta errada e refazer. TD-006 sobe porque **o marco** (recadastro de tudo:
  produtos, filamentos, acessórios, impressões e vendas) chega como um volume grande de documentos de
  uma vez — paginação importa *no* marco, não meses depois.
- **NÃO confundir (verificado no código):** nem TD-003 nem TD-006 afetam a **gravação** dos dados. As
  horas de máquina do histórico vêm dos eventos de produção somados por `machineId`
  (`machineRoi.ts:87-89`) — dado real, já correto. TD-003 afeta só a **projeção** de capacidade na
  tela; TD-006 é custo/desempenho de **leitura**. O registro do `/maquinas` não está contaminado.
- **UX-06 + UX-07(a) viraram a próxima (dono, 2026-08-10):** os dois são o mesmo padrão "linha +
  dropdown de detalhe" e são só reempacotamento de apresentação (o dado já existe) — baratos e
  coerentes de fazer juntos. Ficam à frente do FEAT-03 (polimento comercial, sem bloquear nada).
  **UX-07(b) fica de fora do cluster** (decisão do dono, mesmo dia): as **informações de produção**
  na aba Produtos do estoque (ligar o acabado aos eventos que o geraram) **vão pro Dashboard** — é a
  mesma agregação server-side (buscar `producao` por `productId` sob demanda). O dropdown de Produtos
  entra só com o que já existe no card (composição do valor parado, custo/un, margem congelada).
- **FEAT-03 desceu pra penúltimo (dono, 2026-07-31):** o PDF/branding é comercial mas não bloqueia
  nada do fluxo de custo/estoque; o dono preferiu fechar a infra de cálculo (Tier 4 + TD-003/TD-006)
  antes de investir no acabamento do orçamento. Segue **antes** do Dashboard (que é sempre o último —
  só vale com venda real acumulada).

> Diretriz 7 (dados descartáveis, marco futuro) cobre o backlog inteiro → **nenhum item precisa de
> migração**. Não reordenar por causa disso.

## Itens abertos

### Bugs
- ~~**[BUG-05] Produto multi-etapa não aparece inteiro no estoque (mostra 0 un.)**~~ ✅ **FEITO
  (2026-08-10)** — era só na **venda** do inteiro (a aba Produtos já mostrava conjuntos = min das partes).
  A produção do inteiro-com-subitens credita as SKUs das **partes** (não uma SKU `__whole__`), então a
  venda do inteiro lia/consumia a SKU vazia → **0 disp.** e sem baixa. Nova primitiva **`consumeWholeFifo`**
  (`finishedGoods.ts`) drena uma de cada parte; a reconciliação (caminho `acabado`) e o saldo do `SaleModal`
  (`assemblableWholes`) passam a usá-la p/ o inteiro. +6 testes.
- ~~**[BUG-04] Métricas do card de ROI vazam pra fora da caixa**~~ ✅ **FEITO (2026-08-10)** — `.roi-metrics`
  passou de `repeat(4, 1fr)` (não cabia "R$ 861,92/mês" em card de 340px) p/ **2×2** + `min-width: 0` nas
  células. **Onde:** `machines.css`.
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
- ~~**[UX-03] Nome do produto truncado sem escape no catálogo**~~ ✅ **FEITO (2026-08-10)** — o painel
  expandido agora abre com o **nome inteiro** (`.cd-product-name`, `overflow-wrap: anywhere`), resolvendo
  o que o `title` não cobria (toque/mobile sem hover + o expandido não repetia o nome). `title` na linha
  fechada mantido pro hover no desktop. **Onde:** `ProductCatalog.tsx` + `catalog.css`.
- ~~**[UX-04] Catálogo mostra só a 1ª máquina em produto multi-etapa**~~ ✅ **FEITO (2026-08-04, junto do
  TD-003)** — `MachineCell` lista as máquinas distintas de `machineUsage` ("A1 +1" compacto na linha,
  lista inteira no painel expandido); mantém o `machine-missing-badge` (TD-009).
- ~~**[UX-05] Busca/filtro nas listas**~~ ✅ **FECHADO** *(guarda-chuva; pedido do dono, 2026-08-04)*.
  - ✅ **Fase 1 (2026-08-07)** — busca **client-side** nas listas de **teto natural**: catálogo + 3 abas do
    estoque. Helper `src/lib/text.ts` (`matchesQuery`) + `SearchBox.tsx`.
  - ✅ **Fase 2/3 = TD-006 (2026-08-10)** — vendas + produção **paginam** e a busca virou **filtro no
    Firestore** (produto por `where(==)` + período por range no mesmo campo do `orderBy` → sem índice
    composto) **+** caixa de nome que refina a janela (`HistoryFilterBar`). Detalhe em `HISTORICO.md`.
  ⚠ **Ressalva:** paginar resolve a **lista**, não a **análise** — ROI (`/maquinas`) e o Dashboard
  **agregam o histórico inteiro**; eliminar de vez exige agregação server-side (adiar pro Dashboard).
- ~~**[UX-06] Detalhe expansível por item em `/vendas` e `/producao`**~~ ✅ **FEITO (2026-08-10)** — item do
  recibo (`/vendas`) e produção recente (`/producao`) viraram **linha clicável + dropdown**; o dropdown
  **absorveu** o popover `CostDetail` (composição precificado × real inline) e ganhou máquina, horas,
  filamento por cor e desconto congelado. **Onde:** `SalesPage.tsx`/`ProductionPage.tsx` +
  `cesta-recibo.css`/`production.css`.
- ~~**[UX-07(a)] Aba Produtos do estoque em linha + dropdown**~~ ✅ **FEITO (2026-08-10)** — os cards em
  grade viraram **linhas + dropdown** (`.fg-list`/`.fg-head`/`.fg-details`); o "valor parado" saiu do
  popover pra linha e a composição (barras + `CostBreakdownTable`), partes e margem congelada desceram pro
  dropdown. **Onde:** `StockPage.tsx` (`renderProductCard`) + `stock.css`.
  - **[UX-07(b)] — produção do acabado:** ligar cada acabado aos eventos de `producao` que o geraram
    (camadas da SKU têm `sourceEventId`). Puxa buscar `producao` por `productId` sob demanda (pós-TD-006 a
    coleção não é assinada inteira) = a mesma agregação server-side do painel. **Adiado pro Dashboard**
    (dono, 2026-08-10) — ver o item [Dashboard].

- ~~**[UX-08] Vender direto do estoque**~~ ✅ **FEITO (2026-08-11)** — a aba **Produtos** ganhou ação
  **"Vender"** no topo do dropdown (`renderSellBar`, ícone `ShoppingCart`); semeia o `SaleModal` com o
  produto inteiro na cesta (`saleContextFromResult`, mesmo helper do catálogo) e o `defaultOrigin` já
  escolhe **"acabado"** por haver saldo. `StockPage` passou a computar o `PricingResult` completo
  (`pricingByProduct`, antes só `suggestedPrice`) e a fiar o `SaleFlow`. Botão só p/ produto vivo no
  catálogo (sem ele não há precificação p/ congelar a foto). **Onde:** `StockPage.tsx` + `stock.css`.

### Tier 2 — comerciais
- ~~**[FEAT-09] Desconto na venda**~~ ✅ **FEITO (2026-08-10)** — por item **XOR** no total do recibo, em
  **R$ ou %**, congelado no snapshot (`discountKind`/`discountInput`/`discountAmount`). Taxa incide sobre o
  valor COM desconto; rateio do total **proporcional à receita** da linha. Matemática em `paymentFees.ts`
  (`discountAmountOf`/`apportionDiscount`/`saleItemFinancials`), UI no `SaleModal`, exibição em `/vendas`+CSV.
  Writeup em `HISTORICO.md`. **≠ FEAT-03:** lá o desconto é semente do PDF do orçamento (proposta); aqui é a
  venda real (podem se conversar no futuro).
- **[FEAT-03] Melhorar o PDF do orçamento** *(guarda-chuva)*. Ideias-semente (o dono escolhe o que vira
  tarefa): prazo de entrega, foto/thumbnail do item, formas de pagamento/condições, termos/observações,
  QR code do WhatsApp, detalhar etapas/subitens (usa FEAT-01), desconto/acréscimo, branding real.
  **Onde:** `generateQuotePdf.ts` + `QuotePage`/`config/orcamento`. Lista completa em `HISTORICO.md`.
- **[branding/logo real]** trocar o logo placeholder (impressora) pela logo real no PDF — já há
  comentário no código. Overlap com FEAT-03.
- ~~**[FEAT-06] Aba Produtos rica / composição congelada**~~ ✅ **FEITO (2026-07-20)** — evento, camada
  do acabado e venda passaram a guardar o `FrozenCostBreakdown`; `CostDetail` ganhou o modo de 2 colunas
  (precificado × real); `/producao` rotulou os dois números órfãos; aba Produtos ganhou composição,
  custo/un, mini-barras e margem congelada. Writeup + as 3 decisões em `HISTORICO.md`.
  - ~~**Follow-up (ROI real)**~~ ✅ **FEITO (2026-07-31, Tier 4)** — ver abaixo.

### Tier 3 — infra de cálculo/leitura (TD-*) e, por último, o Dashboard
> Ordem interna: **TD-003 → TD-006 → Dashboard** (o Dashboard é o último item do backlog).

- **[Dashboard] (`/painel`)** — receita/custo/lucro do mês, lucro líquido (menos custos fixos),
  utilização das máquinas (comprar outra?), receita por máquina, lucro por material, produto mais
  lucrativo. Só vale com ~1-2 meses de vendas no banco.
  - **Perda por falha + taxa observada:** o `/producao` já grava os eventos `outcome: "falha"` (baixa
    de material/horas, sem creditar acabado — só histórico de uso). Consolidar aqui: material/horas/R$
    perdidos por período e a **taxa de falha OBSERVADA** (falhas ÷ total de impressões) — o número que
    embasa calibrar a taxa arbitrária da precificação. ⚠ **Só relatório** — NÃO realimentar a
    `failureRate` do preço automaticamente (dial manual desacoplado de propósito; ver memória).
  - **UX-07(b) — produção do acabado (movido pra cá, dono 2026-08-10):** ligar cada acabado aos
    eventos de `producao` que o geraram (as camadas da SKU têm `sourceEventId`). Puxa buscar `producao`
    por `productId` sob demanda (pós-TD-006 a coleção não é mais assinada inteira) = a mesma agregação
    server-side do painel. Sai da aba Produtos do estoque e entra aqui.
- ~~**[TD-003] Capacidade não é por-máquina**~~ ✅ **FEITO (2026-08-04)** — modelo do **gargalo**: máquinas
  distintas rodam em paralelo, quem limita é a mais ocupada (`max` das horas por máquina, não a soma).
  Mantém os dois botões (máquinas dedicadas + horas/dia) — é estimativa branda por decisão do dono.
  `machineBreakdown` no `CapacityResult` mostra gargalo × folga. Detalhe em `HISTORICO.md`.
- ~~**[TD-006] Paginação**~~ ✅ **FEITO (2026-08-10)** — /vendas e /produção paginam (limite crescente +
  realtime), totais via aggregation query, estorno resolve eventos por id, busca server-side (junto do
  UX-05 Fase 2/3). Produtos/estoque seguem inteiros (teto natural). Detalhe em `HISTORICO.md`.

### Tier 4 — menores/oportunistas ✅ FECHADO (2026-07-31)
- ~~**Numeração de orçamento derivada no browser**~~ ✅ **FEITO** — contador atômico `config/orcamentoSeq`
  (transação), reservado ANTES do PDF; `reserveQuoteNumber` em `quotesRepository.ts`. Efeito colateral
  aceito: offline não gera mais orçamento (o número precisa ser reservado no servidor).
- ~~**Labor incluído na reserva de falha**~~ ✅ **DECIDIDO: manter** (dono, 2026-07-31) — labor segue no
  `printingCost` e, portanto, na reserva de falha. Sem mudança de código.
- ~~**[ROI pela depreciação real]**~~ ✅ **FEITO** — `machineRoi.ts` usa `realCostBreakdown.depreciation`
  (FEAT-06) na depreciação recuperada, repartida entre máquinas na proporção da precificada; venda antiga
  (sem o campo) cai no fallback precificado. Payback/lucro não mudaram (seguem por horas).
- ~~**[DEC-01] Semântica do `contributionMargin`**~~ ✅ **FEITO: opção A (renomear)** (dono, 2026-07-31) —
  `contributionMargin` → `profitPerPiece`; cálculo e ponto de equilíbrio idênticos. Opção B (corrigir o
  break-even) descartada.

### 7e — Insumos no estoque
- ~~**[7e] Insumos no estoque**~~ ✅ **FEITO (2026-07-20)** — coleção `insumos` com FIFO por lote, 3ª
  aba na `/estoque`, `Accessory.supplyId` (avulso continua valendo) e baixa por unidade na produção.
  O `frozenCost` passou a somar insumos ⇒ **o lucro por peça de produções NOVAS caiu** (ficou
  correto); produções antigas não mudaram. Writeup em `HISTORICO.md`.
