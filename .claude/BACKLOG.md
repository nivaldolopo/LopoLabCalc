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
> (ver "Porquês da ordem" abaixo). **Cluster da auditoria acrescentado em 2026-08-13** —
> entrou no fim da lista **sem ordem interna definida** (a priorização é do dono).
> **Ordem interna do cluster UI/UX definida em 2026-08-15** (dono) — ver "Porquês da ordem do
> cluster" abaixo.

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
7. **⏸ Tier 2 comerciais — ADIADO (dono, 2026-08-12)** — **FEAT-03** (PDF melhor) · **branding/logo real**.
   **Bloqueado por dado externo: a marca ainda não existe.** Fazer o PDF antes da logo obriga a refazer o
   cabeçalho depois. Destrava quando o dono avisar que a identidade visual está pronta.
   (~~**FEAT-09** desconto na venda~~ ✅ **FECHADO 2026-08-10**.)
8. ~~**Achados da auditoria (2026-08-13)**~~ ✅ **FECHADO (2026-08-13)** — ~~**UX-09**~~ · ~~**UX-10**~~ ·
   ~~**TD-010**~~ · ~~**TD-011**~~ · ~~**TD-012**~~ **FEITOS** · ~~**DEC-02**~~ · ~~**DEC-03**~~
   **DECIDIDAS**.
9. ~~**Cluster da calculadora (dono, 2026-08-13)**~~ ✅ **FECHADO (2026-08-13)** — **FEAT-10** ·
   **UX-12** · **UX-11** feitos.
10. ~~**FEAT-11 — trocar a cor na hora de produzir/vender**~~ ✅ **FECHADO (2026-08-13)** — opção
   **A + C** (dono): troca pontual na `/producao` **e** cor como dimensão da SKU do acabado.
11. **▶ Cluster UI/UX (auditoria de 2026-08-15)** — **UX-13 → UX-19 + TD-013**. Nasceu de uma auditoria
   com o site rodando (desktop 1280 + celular 375), com medições; as decisões de escopo **já foram
   tomadas pelo dono** no mesmo dia. **Ordem de execução (2026-08-15)** — 7 passos:
   ~~① TD-013 + UX-17a (tokens)~~ ✅ **FEITO (2026-08-15)** → **▶ ② UX-13a (desktop)** → ③ UX-13b +
   UX-14 (chrome mobile juntos) → ④ UX-15 → ⑤ UX-16 → ⑥ UX-19 → ⑦ UX-17b (conversão dos 16 CSS).
   ✅ **As 2 decisões saíram junto com o passo ①** (dono, 2026-08-15): **[DEC-04]** (faixas de margem,
   destravou o ⑥) e **[DEC-05]** (lucide nos controles; volta como tarefa de código, fora da fila) —
   **o cluster não tem mais bloqueio nenhum**, os 6 passos restantes são só código.
   **UX-16 é o item de folga:** mecânico, zero mudança visual, não colide com nada — pode subir pra
   qualquer posição.
12. **Dashboard** (`/painel`) — só com ~1-2 meses de venda real; absorve **UX-07(b)**.
   ⚠ **Continua sendo o último.** Fora o cluster UI/UX (item 11, codificável hoje), o que resta é o
   Dashboard (só vale com venda real acumulada) e o Tier 2 comercial, **bloqueado pela marca**.

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

### Porquês da ordem do cluster UI/UX (2026-08-15)

> A ordem por número (13→19) era só a ordem em que a auditoria achou os problemas. Estes são os
> porquês da ordem de **execução** — todos verificados no código, não impressão de leitura.

- **① TD-013 e os tokens vêm ANTES, não depois.** Os dois são pré-condição do resto:
  - **TD-013** é um seletor de **elemento** (`table`) global morando no CSS de uma página
    (`catalog.css:72`) e **já obrigou um antídoto** (`cesta-recibo.css:330`). Normalizar o visual com
    ele mentindo por baixo é caçar fantasma em 16 arquivos. Correção de 2 linhas.
  - **UX-17a** (só declarar `--space-*`/`--radius-*`/`--text-*` no `base.css`) é barato, mexe em **1**
    arquivo e **não quebra nada** porque ninguém consome os tokens ainda. Feito antes, os passos
    ②–⑥ **já nascem usando token** e a conversão do ⑦ encolhe.
- **② UX-17b (conversão) fica por ÚLTIMO, e é por isso que o UX-17 foi partido.** Medido: **5.055
  linhas de CSS em 16 arquivos e 219 declarações de `font-size`**. Os passos ②–⑥ escrevem CSS novo
  (colapso do card, navbar→painel lateral, botões de 32px, cor por faixa). Converter antes = reescrever
  duas vezes; converter tudo depois **sem** os tokens existirem = escrever com valores velhos e refazer.
  Partir em `17a` (tokens) + `17b` (conversão) resolve os dois lados. **Metade do CSS da navbar vai ser
  jogada fora pelo UX-14** — não faz sentido normalizá-la antes disso.
- **③ UX-13b e UX-14 são a MESMA tarefa e devem ir juntos.** Os dois disputam o chrome do celular: o
  UX-13b põe barra fixa no rodapé com requisito explícito de **não cobrir nada** (`padding-bottom` no
  `.wrap` + convivência com o `.back-to-top`), e o UX-14 reconstrói o topo. Separados, a conta de
  espaço vertical e o `.back-to-top` são reavaliados duas vezes.
- **④ Mas o UX-13a (desktop) vai sozinho ANTES.** É só o `<details>` — isolado, não toca mobile e
  resolve o item **mais grave** do lote (o preço sumindo ao mexer no markup) já no passo ②.
- **⑤ UX-18 e UX-19 não eram tarefas de código.** O UX-18 diz no próprio texto que "precisa do martelo
  do dono" e tem overlap com o branding, que está **⏸ por tempo indeterminado** — na posição 6 da fila
  antiga ele **travaria** o UX-19 e o UX-17 atrás de uma decisão que pode não vir tão cedo. Virou
  **[DEC-05]**. O UX-19 precisa das faixas de margem (**[DEC-04]**): o código continua na fila, só a
  pergunta saiu na frente.

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

- ~~**[UX-08] Vender + produzir direto do estoque**~~ ✅ **FEITO (2026-08-11)** — a aba **Produtos** ganhou,
  por linha (grid alinhado + rótulos de seção), **"Vender"** e **"Produzir"** pro inteiro/conjunto E por
  subitem: "Vender conjunto (N)" + "Produzir conjunto" no topo, "Vender"/"Produzir" em cada peça (o Produzir
  da parte **fecha conjunto** — imprime só a que falta). Vender semeia o `SaleModal`
  (`saleContextFromResult`/`FromSubitem`); Produzir roteia pra `/producao?produto=&subitem=` (FEAT-08, default
  1 placa) e **"Ver no catálogo"** abre o produto expandido lá (`/catalogo?produto=`; `ProductCatalog` ganhou
  `initialOpenId` + scroll; página em `<Suspense>`). `StockPage` computa o `PricingResult` completo
  (`pricingByProduct`) e fia o `SaleFlow`. Só p/ produto vivo no catálogo. **Correções no polimento:** botão
  não estica (especificidade `.fg-details .btn.fg-sell-btn` vs `flex:1` do `.btn.primary`) + **bug do origem**
  que abria como "encomenda" (`SaleModal` abre com `goods=[]`; `useEffect` reavalia quando os acabados chegam,
  `touchedOrigem` preserva escolha manual). **Onde:** `StockPage.tsx` + `SaleModal.tsx` + `CatalogPage.tsx` +
  `ProductCatalog.tsx` + `catalogo/page.tsx` + `stock.css`.

- ~~**[UX-09] Rótulo do payback em `/maquinas`**~~ ✅ **FEITO (2026-08-13)** — aviso em 3 pontos: nota
  no topo (`.roi-note.roi-warn`), linha por card sob a barra de payback (`.roi-caveat`, viaja junto do
  número) e o sub do "Lucro acumulado" ("líquido de taxas · bruto de custo fixo"). **Paliativo por
  design** — o número honesto (menos fixo, menos perdas) só existe no [Dashboard], que deve virar a
  fonte do payback. **Onde:** `MachinesPage.tsx` + `machines.css`.
- ~~**[UX-10] Margem líquida no catálogo**~~ ✅ **FEITO (2026-08-13)** — `worstPaymentFee` +
  `netMarginPct` (puras, em `paymentFees.ts`; a segunda delega ao **mesmo** `saleItemFinancials` da
  venda real) + componente `NetMarginHint` em 3 superfícies: célula "Margem" da tabela (compacta),
  card expandido do catálogo e card de preço da **calculadora** (onde o markup é decidido). Some
  quando toda taxa é 0. `CatalogPage`/`PricingCalculator` passaram a chamar `useFees()` — só
  exibição, nenhuma taxa entra no preço. +7 testes. Writeup em `HISTORICO.md`.

- ~~**[UX-11] Ações da calculadora no painel da direita**~~ ✅ **FEITO (2026-08-13)** — o `.btn-row` e o
  erro de validação saíram do `ProductForm` e viraram o bloco **`.result-actions`** no **topo** do card
  (Salvar largura total · Vender/Produzir/Orçar em 3 colunas · Cancelar/Salvar como novo ao editar);
  esquerda = só input. **Decisão do dono (a mais importante):** as **4** ações exigem produto salvo —
  vender sem id caía em `missingProduct` e gravava receita **sem** evento de produção, **sem** baixa de
  filamento/insumo e **sem** horas no ROI. `ensureSavedProductId` valida → salva (update ou create) →
  age, e **mantém o form editando** o produto (não limpa, ao contrário do botão Salvar). `createProduct`
  passou a devolver o id do `addDoc`. **Onde:** `ProductForm`/`PricingResultCard`/`PricingCalculator` +
  `usePricingForm` (expõe `setEditingProductId`) + `productsRepository`/`useProducts` + `sections.css`.
- ~~**[UX-12] Break-even abaixo do custo total**~~ ✅ **FEITO (2026-08-13)** — o balão desceu pra
  depois do `breakdown-total` (e da linha "Total da impressão", pra não partir o bloco de custo em
  produto multi-peça); `.break-even-box` ganhou `margin-top`. Só JSX + CSS, cálculo intacto.

### Cluster UI/UX — auditoria de 2026-08-15 (UX-13→17 + UX-19 + TD-013; o UX-18 virou DEC-05)

> **Origem:** auditoria de UI/UX pedida pelo dono, feita com o site **rodando** (`pnpm dev`, login real),
> em **1280×900** e **375×838**, com medições no DOM — não é impressão de leitura de código. As decisões
> de escopo abaixo (marcadas **Decidido**) são do **dono, 2026-08-15**, no mesmo chat da auditoria.
> **Nada foi alterado no site** — o cluster inteiro está aberto.
> **Os blocos seguem em ordem de ID** (fácil de achar pelo número); a **ordem de execução** é o
> `①②③…` marcado em cada um — ver "Ordem de prioridade" item 11 e os porquês acima.

- **[UX-13] O preço some justo quando se mexe no markup** — *o mais grave do lote.*
  **▸ Passo ② = UX-13a (desktop, sozinho) · Passo ③ = UX-13b (celular, junto do UX-14).**
  **Medido:** `.result-card` é `position: sticky; top: 20px`, mas mede **1286px** de altura contra uma
  viewport de **910px**. Um `sticky` mais alto que a tela **nunca prende no topo** — rola junto até o
  próprio fim. Com o slider de markup à vista, o `R$ 27,14` estava **403px acima** da borda superior.
  No celular é pior: `responsive.css:26` força `position: static`, a página vai a **3314px** e o preço
  (offset 2080px) fica **569px abaixo** do slider (1511px). Ou seja: a interação central de uma
  calculadora de preço — mexer no dial e ver o número — **não funciona em nenhum dos dois tamanhos**.
  **Decidido (dono):**
  - **[UX-13a] Desktop — colapso, sem código novo de layout:** pôr em `<details>` ("ver informações avançadas")
    **tudo que vem depois do "Custo total"**: break-even, rentabilidade e capacidade produtiva.
    **Medido:** do topo do card até o fim do `.breakdown-total` são **493px**; o que vem depois são
    **794px = 62% do card**. Com o colapso o card cai pra ~493px, cabe folgado na viewport e **o
    `sticky` que já existe passa a funcionar sozinho**.
    ⚠ **Ressalva de implementação:** os 493px valem com o `<details>` **fechado**. Aberto, o card
    volta a passar da viewport e o `sticky` volta a falhar — precisa **nascer fechado**, e vale
    conferir se o preço segue visível mesmo com ele aberto.
  - **[UX-13b] Celular — barra fina fixa:** o colapso não basta (o card é `static` e mora **depois** do
    formulário inteiro). Faixa de ~56px no **rodapé** (onde o polegar está) com preço/peça · margem ·
    markup. ⚠ **Requisito explícito do dono: a barra NÃO pode cobrir nada** — reservar o espaço
    (`padding-bottom` no `.wrap`) e conferir a convivência com o `.back-to-top`, que já ocupa o canto
    inferior direito (`base.css:120`, `bottom: 14px` no mobile).
  - **Junto (mesmo tema "colapsar o que não está em uso"):** o painel **"Custos fixos mensais do
    quiosque" desativado** mantém 6 campos + linha de resumo renderizados em cinza (~120px mortos no
    fim do formulário). Desativado deve colapsar.
  **Onde:** `PricingResultCard.tsx` · `FixedCostsPanel.tsx` · `forms.css` (`.result-card`) · `responsive.css`.

- **[UX-14] No celular, metade da tela é cabeçalho**
  **▸ Passo ③ — fazer JUNTO do UX-13b** (os dois mexem no chrome do celular: um no topo, outro no
  rodapé, e ambos na conta de espaço vertical do `.wrap` + `.back-to-top`).
  **Medido em 375×838, na calculadora:** o primeiro campo ("Nome do produto") começa em **421px** —
  **50,2% da tela**. A `.navbar` sozinha tem **227px**: os 7 destinos quebram em 4 linhas de 2 (com
  "Produção" sozinha na quarta) e "Claro"/"Sair" caem numa quinta.
  **Decidido (dono): menu lateral.** Abaixo do breakpoint mobile a nav vira **painel lateral**; fechado,
  o topo mostra **o nome da página + o botão de abrir** (ícone), no canto superior direito. Tema e Sair
  entram no painel. Estimativa: `.navbar` de **227px → ~44px** (recupera ~180px).
  **Junto:** os 7 destinos são `<Link>` **sem reset de `text-decoration`** — estão todos sublinhados, e
  no celular isso vira um bloco de texto sublinhado ocupando ~27% da tela.
  **Onde:** `NavBar.tsx` (68 linhas) · `header.css` (`.navbar*`) · `responsive.css`.
  ⚠ Alternativa **descartada** pelo dono: barra fixa no rodapé com os 4 mais usados + "•••".

- **[UX-15] Alvos de ação minúsculos no catálogo + `window.confirm` genérico**
  **▸ Passo ④.**
  **Medido:** cada uma das **95 linhas** do catálogo termina em 5 botões de ícone **sem rótulo**, de
  **24×24px**, colados. Ordem: Vender · Produzir · Orçar · Carregar no formulário · **Excluir** — o
  destrutivo é vizinho imediato do mais clicado. A linha tem **61px** de altura: cabe 32px com folga.
  ⚠ **Verificado — o susto é menor do que parece:** `removeProduct` é um `deleteDoc` simples, **sem
  cascata** (`productsRepository.ts:128`). Vendas guardam `productName` + custo congelado
  (`salesRepository.ts:93`) e os acabados guardam o próprio `productName` (`StockPage.tsx:816`) → o
  **histórico e os números de dinheiro sobrevivem**. Perde-se só a **receita** do produto (peso, horas,
  cores, subitens, acessórios), sem desfazer nem lixeira.
  **A fazer:** alvos de **32px**, **afastar o Excluir** dos outros quatro, e trocar o
  *"Deseja realmente excluir este produto?"* por um que **nomeie o produto e diga o que NÃO é afetado**.
  Estender o modal próprio aos outros **7** `window.confirm` (**contados no código, 2026-08-15: são 8
  no total**, em 7 arquivos) — `ProductCatalog.tsx:214` (import CSV), `LogoutButton`, `ProductionPage`,
  `QuotePage`, `SalesPage`, `StockPage`, `SuppliesTab`.
  ⚠ **Correção de rastreamento (2026-08-15): isto NÃO "fecha o resto do TD-004".** O TD-004 está
  **fechado** (`HISTORICO.md`) e a decisão registrada nele foi **manter nativos** os `confirm`
  destrutivos (excluir, sair) *por escolha* — o `window.alert` é que virou aviso inline. Ou seja, o
  UX-15 **reverte** uma decisão antiga, não completa uma pendência. Vale o dono saber que está
  mudando de ideia (é legítimo: o TD-004 decidiu sobre *feedback de escrita*, e o problema aqui é
  **alvo de 24px com o Excluir colado no mais clicado** — contexto que não estava na mesa lá).
  **Onde:** `ProductCatalog.tsx:411` (o `confirm` do excluir) · `catalog.css` (`.icon-button`) +
  os 7 pontos acima.

- **[UX-16] Rótulo não foca o campo (44 `<label>`, **1** com `htmlFor`)**
  **▸ Passo ⑤ — e é o ITEM DE FOLGA do cluster:** mecânico, zero mudança visual, não colide com
  nenhum outro item. Pode subir pra qualquer posição se as decisões (DEC-04/05) demorarem.
  **Medido:** 44 `<label>` nos componentes, **1** com `htmlFor`; 77 `<input>/<select>`, **0** com `id`.
  O navegador não sabe que um é o nome do outro → clicar em "Mão de obra (min)" não faz nada, e o alvo
  de clique é só a caixinha. Num formulário de ~20 campos numéricos é atrito em toda sessão.
  **Correção:** aninhar o input **dentro** do `<label>` (dispensa `id`) ou `useId()`.
  ⚠ **Visualmente muda ZERO** — é ganho puro (alvo de clique triplica + leitor de tela passa a anunciar
  o campo). Mecânico, risco baixíssimo. **Decidido (dono): fazer.**
  **Onde:** `ProductForm.tsx` e os demais componentes de formulário.

- **[UX-17] Sistema visual: escala uniforme (sem perder densidade) + tokens**
  **▸ PARTIDO EM DOIS (2026-08-15), e é a mudança de ordem mais importante do cluster:**
  - ~~**[UX-17a] — passo ①: só DECLARAR os tokens**~~ ✅ **FEITO (2026-08-15)** — bloco `:root` próprio
    no `base.css` (separado das cores, que mudam com o tema): **12** `--space-*` (nomeados pelo valor em
    px, pra conversão mecânica), **8** `--radius-*` (+`pill`/`circle`) e **9** de tipografia
    (`--text-2xs`…`--text-xl` + 3 `--display-*`). Escala **extraída do inventário real**, não inventada —
    os dominantes (font 11/12/13, espaço 8/10/12, raio 8/10/12) foram preservados, então converter **não
    deve mexer no visual**. Os órfãos (9.5/11.5/12.5px, raio 2/5/7/9/14/20…) **não ganharam token de
    propósito** — a lista deles está no comentário do `base.css` e eles morrem no UX-17b.
    Zero consumidor ainda ⇒ zero mudança visual neste passo.
  - **[UX-17b] — passo ⑦ (último): CONVERTER** os 16 arquivos de `styles/`. **Medido no código
    (2026-08-15): 5.055 linhas de CSS em 16 arquivos, 219 declarações de `font-size`.** Vai por
    último porque os passos ②–⑥ escrevem CSS novo — converter antes é reescrever duas vezes, e
    **metade do CSS da navbar vai ser jogada fora pelo UX-14** de qualquer jeito.
  **Medido:** das ~220 declarações de `font-size`, **155 estão entre 10 e 13px** (65× `12px`, 50× `11px`,
  40× `13px`) — e existem **23 tamanhos distintos**, incluindo `11.5px`, `12.5px` e `9.5px`. Idem
  `border-radius`: **15 valores** (2, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 20, 999px…). O `base.css` tem 19
  variáveis, **todas de cor** — não há `--space-*`, `--radius-*`, `--text-*`.
  ⚠ **Decidido (dono): manter DENSO, mas UNIFORME.** Ou seja **não** é para aumentar o corpo do texto
  (a proposta original de subir pra 13–14px foi **recusada** — o dono prefere ver mais linhas por tela).
  O trabalho é **normalizar**: colapsar os 23 tamanhos numa escala curta (ex.: 11/12/13/14 + os títulos),
  matar os órfãos (`11.5`/`12.5`/`9.5`), e fazer o mesmo com raio e espaçamento via tokens.
  **Junto:** o app tem **dois paradigmas de aba** — chips arredondados na `NavBar` e abas sublinhadas na
  `/estoque` (Filamentos/Insumos/Produtos). Unificar.
  **Onde:** `base.css` (tokens) + conversão gradual dos **16** arquivos de `styles/`.

> **[UX-18] saiu daqui em 2026-08-15** → virou **[DEC-05]**, na seção "Decisões em aberto (DEC-*)".
> Motivo: o próprio item dizia "precisa do martelo do dono" e tem overlap com o branding (⏸ sem data);
> deixá-lo na fila de código travaria por tempo indeterminado tudo que viesse depois dele.

- **[UX-19] Números sem gradação + ênfase no lugar errado**
  **▸ Passo ⑥ — depende da [DEC-04]** (faixas de margem). Perguntar cedo, não na hora de codar.
  O catálogo mostra margens de **49% a 72%** todas em cinza; a `/vendas` mostra lucros de **61% a 100%**
  todos no mesmo verde. Num app cuja função é dizer se o preço está bom, **a cor não está trabalhando**.
  Pintar por faixa é quase uma linha de CSS e faz a tela responder sozinha.
  **Junto:** em `/vendas`, **"Sem cliente" aparece em negrito em toda venda** — um campo vazio ocupando a
  posição de maior ênfase da linha. Deve ser mudo (`--muted2`) ou sumir.
  ⚠ As faixas (o que é margem ruim/ok/boa) são a **[DEC-04]** — decisão do dono, não código.
  **Onde:** `ProductCatalog.tsx` + `catalog.css` · `SalesPage.tsx` + `cesta-recibo.css`.

- ~~**[TD-013] `table { min-width: 600px }` é seletor global morando no CSS do catálogo**~~ ✅ **FEITO
  (2026-08-15, passo ①)** — os 3 seletores de elemento (`table`/`th`/`td`) viraram `.catalog-card *` e o
  antídoto do `.cost-detail-table` (`cesta-recibo.css`) saiu junto. **Achado na execução:** o
  `min-width: 600px` foi **apagado**, não escopado — o próprio catálogo já o anulava mais abaixo
  (`.catalog-card table { min-width: 0 }`, do bloco "cartões também no desktop"), ou seja era regra
  **morta no catálogo e viva em todo mundo**. A especificidade subiu 0,0,1 → 0,1,1 e passou a empatar
  com `.main-row td`/`.details-row td`/`td.col-name`, todos posteriores na cascata → seguem vencendo.
  ⚠ **Um efeito colateral pego na verificação visual:** o `border-top` do `td` global era o que separava
  o 1º item do cabeçalho do recibo em `/vendas` — e em recibo de UM item era a **única** borda da linha
  (o `border-bottom` cai no `tr:last-child`). Foi **reposto explicitamente** em `.recibo-items td`, o
  dono legítimo da regra. **Medido no site rodando:** com isso a altura da página de `/vendas` voltou a
  **3975px**, byte a byte igual ao estado anterior, e catálogo (desktop e mobile) mediu **idêntico**.
  **Ganho real, não só higiene:** no celular o recibo era forçado a **600px** (255px de scroll lateral
  dentro do card) e agora mede **453px** (108px) — o global estava apertando uma tabela que não era dele.

### Tier 2 — comerciais
- ~~**[FEAT-09] Desconto na venda**~~ ✅ **FEITO (2026-08-10)** — por item **XOR** no total do recibo, em
  **R$ ou %**, congelado no snapshot (`discountKind`/`discountInput`/`discountAmount`). Taxa incide sobre o
  valor COM desconto; rateio do total **proporcional à receita** da linha. Matemática em `paymentFees.ts`
  (`discountAmountOf`/`apportionDiscount`/`saleItemFinancials`), UI no `SaleModal`, exibição em `/vendas`+CSV.
  Writeup em `HISTORICO.md`. **≠ FEAT-03:** lá o desconto é semente do PDF do orçamento (proposta); aqui é a
  venda real (podem se conversar no futuro).
- ~~**[FEAT-10] Arredondamento "final 4,90 ou 9,90"**~~ ✅ **FEITO (2026-08-13)** — nasceu como "final
  X9,90" e o **dono ampliou pra 4,90 OU 9,90** (passo **5**, não 10), o que suaviza o salto: R$ 21 para
  em R$ 24,90 em vez de R$ 29,90. **Um** modo novo no seletor. Os dois modos psicológicos viraram a
  tabela `NINETY_STEP` + um bloco só (`"0.90"` inalterado). +3 testes (**329**).
  ⚠ **Piso assumido:** não há degrau abaixo de R$ 4,90 — preço menor sobe pra lá (travado em teste).
- ~~**[FEAT-11] Trocar a cor/filamento na hora de produzir ou vender**~~ ✅ **FEITO (2026-08-13)** —
  escopo **A + C** (dono). O `<select>` de cor da `/producao` vale para **qualquer** linha (não só
  avulso), com "avulso livre" mantido; e a **cor virou dimensão da SKU** do acabado
  (`skuKey(subitemId, colorKey)`), com `colorKeyOf` (chave **composta** em peça multicor) no
  `filaments.ts`. **A montagem do conjunto IGNORA a cor** — corpo azul + tampa vermelha é um produto
  legítimo, e cada parte tem a sua (`FilRow.stageKey` + `Subitem.stageKeys` levam a cor da linha até
  a parte certa). A venda de peça pronta ganhou **seletor de cor por parte** (só quando há 2+ cores
  com saldo), congelado no recibo; a **encomenda** segue na cor do cadastro. **Aviso ativo** na
  `/producao`: quanto a troca custou por peça e a margem resultante. +40 testes (**369**).
  ⚠ Diretriz 7: o saldo de acabados anterior vira o balde **"Sem cor"** e não se mistura com o novo.
  Writeup + as 5 decisões em `HISTORICO.md`.
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
> Ordem interna: **TD-003 → TD-006 → TD-010/011 → TD-012 → Dashboard** (o Dashboard é o último item
> do backlog). **TD-001 a TD-012 fechados**; nesta seção só o **Dashboard** segue aberto.
> ⚠ **Correção 2026-08-15:** a linha antiga dizia "todos os TD-* fechados" — **falso desde 2026-08-15**,
> quando a auditoria abriu o **[TD-013]**, que mora na seção do cluster UI/UX (é o passo ① dele).
> **Sobre o [TD-004]:** está fechado (`HISTORICO.md`), **não** parcialmente aberto — mas a decisão
> registrada nele ("os `window.confirm` destrutivos seguem nativos por escolha") é **revertida pelo
> [UX-15]**. Quem for pegar o UX-15 deve saber que está mudando uma decisão, não completando uma.

- **[Dashboard] (`/painel`)** — receita/custo/lucro do mês, lucro líquido (menos custos fixos),
  utilização das máquinas (comprar outra?), receita por máquina, lucro por material, produto mais
  lucrativo. Só vale com ~1-2 meses de vendas no banco.
  - **Perda por falha + taxa observada:** o `/producao` já grava os eventos `outcome: "falha"` (baixa
    de material/horas, sem creditar acabado — só histórico de uso). Consolidar aqui: material/horas/R$
    perdidos por período e a **taxa de falha OBSERVADA** (falhas ÷ total de impressões) — o número que
    embasa calibrar a taxa arbitrária da precificação. ⚠ **Só relatório** — NÃO realimentar a
    `failureRate` do preço automaticamente (dial manual desacoplado de propósito; ver memória).
  - **Fecha o UX-09 de vez:** o rótulo do payback é paliativo. O lucro **de verdade** (menos fixo, menos
    perda de produção) só existe quando este painel consolidar as duas coisas — e é ele quem deve virar a
    fonte do payback em `/maquinas`, hoje calculado sobre lucro bruto de vendas.
  - **UX-07(b) — produção do acabado (movido pra cá, dono 2026-08-10):** ligar cada acabado aos
    eventos de `producao` que o geraram (as camadas da SKU têm `sourceEventId`). Puxa buscar `producao`
    por `productId` sob demanda (pós-TD-006 a coleção não é mais assinada inteira) = a mesma agregação
    server-side do painel. Sai da aba Produtos do estoque e entra aqui.
- ~~**[TD-010] Capacidade: os dois restos do UX-02**~~ ✅ **FEITO (2026-08-13)** — `CapacitySettings`
  ganhou `daysMonth` (subconjunto exato do `FixedCostRate`) e o horizonte virou `hoursDay × daysMonth`;
  a calculadora derivou o painel de `config/negocio` e o literal `DEFAULT_CAPACITY` foi **apagado**. Os
  campos do painel viraram **simulação local** (decisão do dono: não persistem, com aviso + "voltar ao
  padrão") + 3º campo "Dias de impressão/mês". Detalhe em `HISTORICO.md`.
- ~~**[TD-011] Capacidade ignora a própria taxa de falha**~~ ✅ **FEITO (2026-08-13)** — `piecesMonth`/
  `piecesDay` (e o breakdown por máquina) passaram por `× (1 − falha)`; `cyclesMonth` **não** mudou (a
  impressão que falha ocupa a máquina). O clamp da taxa virou `failureFractionOf` compartilhada com o
  `calculatePricing` — o mesmo número que infla o custo deflaciona o volume. Detalhe em `HISTORICO.md`.
- ~~**[TD-012] Teste do `chargedWithFee` + comentário da tarifa**~~ ✅ **FEITO (2026-08-13)** — novo
  `saleContext.test.ts` (10 casos, 326 no total) trava a composição `grossUp → roundPrice → round2`:
  idempotência sem taxa, os 6 modos de arredondamento sobre o preço inflado, "nunca abaixo do exato",
  bordas (preço 0/NaN, taxa negativa, clamp de 95%) e monotonicidade. Documenta a borda do `round2`
  final (corta até R$ 0,005). Comentário da `energyTariff` reescrito (o valor R$ 0,80 **fica**).
  Detalhe em `HISTORICO.md`.
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

### Decisões em aberto (DEC-*) — martelo do dono, não tarefa de código
> Molde do `DEC-01` e do "labor na reserva de falha" (Tier 4): o trabalho aqui é **decidir**, não
> implementar. **2 em aberto (2026-08-15)** — as duas saíram do cluster UI/UX e devem ser perguntadas
> **em paralelo com o passo ①**, pra não virarem bloqueio lá na frente.

- ~~**[DEC-04] Faixas de margem**~~ ✅ **DECIDIDO (dono, 2026-08-15): `< 50%` ruim · `50–65%` ok ·
  `> 65%` bom.** Cortes centrados na realidade atual (o catálogo varia de 49% a 72%, então a régua
  distribui o catálogo inteiro nas 3 faixas em vez de pintar tudo de uma cor só). **Mesma régua nas
  duas telas** — a opção "régua diferente por tela" foi oferecida e **não** escolhida. ⚠ Quem
  implementar o **UX-19** (passo ⑥) deve saber que os números medem coisas diferentes: catálogo =
  margem **precificada**; `/vendas` = lucro **realizado**, já líquido de taxa. **Destravou o passo ⑥.**

- ~~**[DEC-05] Dois sistemas de ícone competindo**~~ ✅ **DECIDIDO (dono, 2026-08-15): lucide em tudo
  que é CONTROLE**, emoji só como decoração deliberada (era o **[UX-18]**). Motivo do problema: emoji
  não herda `currentColor` (não responde ao tema), renderiza diferente em cada SO e desalinha ao lado
  de um lucide — hoje convivem em **9 componentes** (🧮 📚 🧾 📄 🖨️ 📦 🏭 · 🏷️ ⚡ 🔢 🎲 📈 🎯).
  ⚠ **Ressalva do dono, registrada:** **a marca está chegando** — fazer a troca já, mas contando com
  **um ajuste depois**, quando a identidade visual existir (overlap com **[branding/logo real]**);
  não tratar o resultado como final. **Volta como tarefa de código** — sem posição na fila do cluster
  (o dono decide quando entra; não bloqueia nenhum dos passos ②–⑦).

- ~~**[DEC-02] `lifeHours` = 10.000 h**~~ ✅ **DECIDIDO: 7.500 h** (dono, 2026-08-13) — meio da faixa;
  A1 passa de R$ 0,65/h a R$ 0,83/h e o cenário base sobe R$ 35,81 → R$ 37,45 (+4,6%) isoladamente.
  ⚠ O constante só **semeia** — as 2 máquinas salvas precisam ser editadas à mão em `/maquinas`.
  Detalhe em `HISTORICO.md`.
- ~~**[DEC-03] Markup incide sobre a mão de obra**~~ ✅ **DECIDIDO: NÃO incide mais** (dono, 2026-08-13) —
  adotada a fórmula de referência `(custo sem labor) × markup + labor + fixo`. A reserva de falha **continua
  cobrindo o labor** (preserva a decisão irmã do Tier 4), então o repasse é `labor × (1 + failureK)`.
  Cenário base: R$ 35,81 → **R$ 27,14** com as duas decisões juntas. Detalhe em `HISTORICO.md`.

### 7e — Insumos no estoque
- ~~**[7e] Insumos no estoque**~~ ✅ **FEITO (2026-07-20)** — coleção `insumos` com FIFO por lote, 3ª
  aba na `/estoque`, `Accessory.supplyId` (avulso continua valendo) e baixa por unidade na produção.
  O `frozenCost` passou a somar insumos ⇒ **o lucro por peça de produções NOVAS caiu** (ficou
  correto); produções antigas não mudaram. Writeup em `HISTORICO.md`.
