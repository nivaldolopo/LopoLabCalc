# AUD-17 — briefing da varredura da FROTA (10ª varredura)

> **Arquivo temporário.** Sai do repo quando o cluster fechar, como todas as varreduras
> anteriores. Existe para que a auditoria possa ser disparada de um **chat novo**.

## Seu papel

Você é o **auditor**. Trabalha **read-only**: não edita arquivo, não faz commit, não escreve
correção. Entrega um **laudo**. Quem conserta é outro turno, depois de reconferir cada achado.

O alvo é o **[FROTA]** — as duas fases que mudaram a precificação de "a máquina que estava livre"
para "a média ponderada da frota elegível". É código de **dinheiro**: erro aqui sai como preço
errado no catálogo inteiro ou como COGS errado na venda.

## Baseline medido (2026-09-03, antes de você começar)

`lint` ✅ · `typecheck` ✅ · **904/904 testes em 31 arquivos** ✅ · `build` ✅

**Tudo está verde.** Logo: você não está procurando o que o CI pega. Está procurando o que passa
verde e mesmo assim está errado.

## Alvo

```
git diff 92a1688..HEAD
```

`92a1688` é o lote 1 da AUD-16, a última varredura. São **12 commits, 76 arquivos,
+7806 / −3043**, dos quais **45 fontes** (sem teste, doc e CSS). Tudo que nasceu depois disso
**nunca foi varrido**. O que é anterior já passou por 9 varreduras e zerou — não gaste esforço lá,
a não ser que o [FROTA] tenha mexido.

## As quatro camadas — onde gastar o esforço

| Camada | Cobertura hoje | O que fazer |
|---|---|---|
| **A. Matemática pura** — `fleet.ts`, `calculatePricing`, `machineRoi`, `calculateCapacity` | ~70 casos nomeados em `frotaFase1.test.ts`, `frotaFase2.test.ts` | **Não re-verifique a conta.** Leia os NOMES dos testes e procure a invariante que **não está lá**. Entrada adversarial, não regressão. |
| **B. Persistência** — `productPayload`, `productCsv`, `frozenCost`, os 5 repositórios | round-trip campo a campo; `machineIds` coberto no payload, no CSV e nos issues | Idem: o buraco é o que um diff de documento não enxerga (ex.: id que aponta para máquina que não existe mais, entrando pela importação). |
| **C. Fiação e estado React** — 18 componentes + 4 hooks | **NENHUMA** | 🎯 **O grosso do seu esforço.** Foi daqui que saíram os 3 defeitos do commit `0f93993` ("três defeitos que só o navegador pegaria"). |
| **D. Semântica cruzada** | por construção | "PODE rodar ≠ RODOU" em cada borda. Sobrou lugar assumindo máquina **escalar**? Algum caminho consegue pôr **id vazio** no `machineUsage`? |

## Escopo nominal

`fleet.ts` · `calculatePricing.ts` · `calculateCapacity.ts` (perdeu o `machineBreakdown`) ·
`machineRoi.ts` · `productionPlan.ts` · `saleContext.ts` · `saleReconciliation.ts` ·
`production.ts` · `finishedGoods.ts` · `validateProduct.ts` · `productPayload.ts` ·
`productCsv.ts` · `types.ts` · `constants.ts` ·
`MachineCheckboxes.tsx` · `MachineSelector.tsx` (**ainda existe e ainda lê `machineIds` — por quê?**)
· `ProductForm.tsx` · `PricingCalculator.tsx` · `ProductionPage.tsx` · `SaleModal.tsx` ·
`MachineManagerModal.tsx` · `MachinesPage.tsx` · `PricingResultCard.tsx` · `CapacityPanel.tsx` ·
`ExtraStagesSection.tsx` · `SubitemsSection.tsx` ·
`usePricingForm.ts` · `useMachines.ts` · `useProductionPage.ts` · `useProduction.ts` ·
`frozenCost.ts` · `machinesRepository.ts` · `productionRepository.ts` · `salesRepository.ts` ·
`productsRepository.ts` · `finishedGoodsRepository.ts`

## As quatro regras de conduta

Elas vêm do que deu errado na AUD-16 — a varredura anterior, feita por outra IA sobre um ZIP.
Um terço do relatório dela era ruído, e por estas quatro causas:

1. **MEDIR, NÃO AFIRMAR.** Todo achado precisa de reprodução: uma sonda rodando a função real
   (`pnpm vitest run <arquivo>`, ou um script `tsx`/`node` no scratchpad), ou `arquivo:linha` com o
   caminho de dados escrito passo a passo. A AUD-16 declarou que `name: 2` estourava; **não
   estourava** — entrava gravado como número num campo `string`, que é pior porque é calado. Ela
   deduziu do fonte. Não deduza.
2. **REGRA DA CASA VENCE PREFERÊNCIA.** Discordar de uma decisão registrada é **ressalva**, nunca
   defeito. A AUD-16 gastou um lote inteiro pedindo para *bloquear* a importação com erro de
   domínio — contra o **TD-009**, que está escrito no próprio tipo: "Nada disso bloqueia".
3. **CLASSIFICAR SEM MISTURAR.** 🔴 defeito (número errado, dado perdido, crash) · 🟡 lacuna de
   prova · 🟢 ressalva/gosto. Se não souber classificar, é 🟡.
4. **NÃO ESCREVER CÓDIGO.** Laudo, não patch. A correção sugerida cabe em uma linha.

## O que NÃO é defeito (não repropor — já decidido)

- **`lifeHours` por máquina** (DEC-02), **`residualValue`**, **peso em horas/dia** (D6.1) e
  **chutar a máquina de maior peso na `/producao`**: avaliados e **descartados** pelo dono.
- **Diretriz 7 — dado atual é descartável.** O dono vai recadastrar tudo. Falta de migração,
  documento antigo sem campo novo, badge de dado órfão: **não são defeitos, são o desenho**.
- **TD-009 — o app avisa, não bloqueia.**
- **A `/producao` e a venda perguntarem a máquina** quando há 2+ elegíveis: decisão do dono
  (2026-09-01), *"vazia só quando há dúvida"*.
- **Conjunto vazio/órfão cair na frota inteira**, e **soma de pesos 0 virar média simples**: são os
  guardas escritos de propósito no `fleet.ts`. Achar um caminho em que eles produzem número
  **errado** é defeito; achar que eles não deviam existir é ressalva.
- **Custo fixo desligado** e a **capacidade somar as horas em série** (o pior caso honesto): estão
  no `BACKLOG.md` como itens abertos, não como bug.

## O limite que você tem — e o que fazer com ele

A camada C é a mais promissora e **você não consegue abrir o app**: há um `AuthGate` com login
Google, e login é handshake com o dono. **Não tente logar. Não peça senha.**

Então, para a camada C, entregue **hipóteses a medir no navegador**: "abrir `/producao` com um
produto elegível a 2 máquinas e conferir X". A passada visual acontece depois, com o dono logado.
Uma hipótese bem escrita da camada C vale mais que um achado 🟢 da camada A.

## O laudo

Arquivo `AUD-17-RELATORIO.md`. Por achado:

- **id** (`[E1]`, `[E2]`…), **severidade** (🔴/🟡/🟢), **`arquivo:linha`**
- **o que quebra** — em uma frase
- **como foi reproduzido** — o comando, a sonda ou o caminho de dados. Sem isto o achado não conta.
- **o que custa** — R$ errado? dado sumido? só feio?
- **correção sugerida** — uma linha, não um patch

E feche com **"o que a AUD-17 NÃO cobriu"**, que é tradição aqui: toda varredura declara a própria
sombra. Se você não achar nada em alguma camada, **diga isso** — "varri e está são" é resultado,
inventar achado para encher o laudo não é.

## Depois de você

Cada achado é **reconferido com sonda** antes de virar linha de código. Depois vira lote, e cada
lote vira um commit. Foi a reconferência que corrigiu o relatório da AUD-16 em 3 pontos e achou um
caso que ela não tinha visto.
