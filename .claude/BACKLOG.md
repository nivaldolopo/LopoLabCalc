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

1. **Bugs de teste visual** (antes do Tier 2): **BUG-03** → **BUG-02**.
2. **Tier 2** (features comerciais, independentes): **FEAT-03** (PDF melhor) · **branding/logo real**
   no PDF · **FEAT-06** (aba Produtos rica).
3. **Tier 3** (adiar até ter volume de vendas): **Dashboard** (`/painel`) + **TD-003** · **TD-006**.
4. **Tier 4** (menores/oportunistas): numeração de orçamento no browser · labor na reserva de falha ·
   **DEC-01 pendência** (semântica do `contributionMargin`).
5. **Item próprio (quando o dono quiser):** **7e — Insumos** no estoque.

> Diretriz 7 (dados descartáveis, marco futuro) cobre o backlog inteiro → **nenhum item precisa de
> migração**. Não reordenar por causa disso.

## Itens abertos

### Bugs
- **[BUG-03] Histórico de vendas e extrato de rolos fora de ordem** *(barato, atacar 1º)*. Só guardam
  **dia**, não hora → eventos do mesmo dia empatam. Alavanca: venda e evento de produção **já gravam
  `createdAt`** (timestamp cheio) → usar como desempate. **Onde:** `SalesPage` (sort por `saleDate`),
  `stock.ts` `colorStatement` (sort por `at`). Detalhe/diagnóstico em `HISTORICO.md`.
- **[BUG-02] Produção só registra UMA unidade por vez** *(médio; é quiosque de mall)*. Falta campo
  "quantidade (N)": incremento do acabado × N + baixa de filamento/hora × N (FIFO consome N× o peso) +
  estorno devolve N. **Onde:** `ProductionPage`, `buildProductionPayloads`/`finishedForSave`,
  `planProduction`. Detalhe em `HISTORICO.md`.

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
