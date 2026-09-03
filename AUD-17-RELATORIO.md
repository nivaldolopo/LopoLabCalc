# AUD-17 — laudo da varredura da FROTA (10ª varredura)

> Read-only. Nenhum arquivo-fonte foi tocado, nenhum commit, nenhum patch.
> Alvo: `git diff 92a1688..HEAD` (12 commits, 76 arquivos, 45 fontes nunca varridas).
> Baseline reconferido aqui: `npx vitest run` → **31 arquivos, 904/904 ✅**.

**Placar: 3 🔴 · 4 🟡 · 4 🟢.** Todos os achados têm sonda ou caminho de dados medido.
As sondas vivem no scratchpad (`e1/e2/e4/e6.probe.ts` + `vitest.probe.config.ts`) e rodam com:

```powershell
npx vitest run --silent=false --reporter=verbose --config "<scratchpad>/vitest.probe.config.ts"
```

---

## 🔴 [E1] — a encomenda parcialmente órfã devolve ao ROI 1/4 da depreciação que gastou

**`src/features/pricing-calculator/lib/saleReconciliation.ts:390-393`**
(contraste: a mesma coisa feita CERTO na linha `291`; consumidor: `machineRoi.ts:162`)

**O que quebra.** No caminho `encomenda`, o `machineUsage` é escalado por `1 / qty` (por unidade
VENDIDA), mas o ROI o lê como "por unidade ATRIBUÍDA" e o multiplica por `qty × coverage` — então a
depreciação recuperada sai multiplicada por `coverage` duas vezes.

**Como foi reproduzido.** Sonda `e1.probe.ts`, rodando `reconcileReciboWrite` real e
`computeMachineRoi` real. Produto com etapa principal ambígua (3 h, elegível a a1+x2d) + etapa
"Base" resolvida na X2D (1 h), `quantity: 2`, sem escolha de máquina:

```
qty=2, unattributedUnits = 1.5
machineUsage = [{"machineId":"x2d","hours":1,"depreciation":1.8665333333333334}]
depreciação REAL dos eventos da X2D (frozenBreakdown do lote) = 3.7330666666666668
ROI depreciationRecovered (X2D)                                = 0.9332666666666667
razão recuperada/real = 0.25
profit atribuído (X2D) = 10 de 40  ← este está CERTO (cobertura 1/4)
```

O lucro e a receita saem certos (a fatia é uma razão, e a escala se cancela). Só a **depreciação
recuperada** erra, porque é o único campo absoluto do `MachineUsage`.

**A invariante que não está nos testes.** `frotaFase1.test.ts:536-537` já checa
`Σ machineUsage.depreciation === cogsBreakdown.depreciation` — mas só no caso
`unattributedUnits === 0`, em que `1/qty` e `1/atribuídas` são o mesmo número. Falta a mesma
identidade com órfãs > 0.

**O que custa.** Número errado na `/maquinas` (`MachinesPage.tsx:347`, "R$ X de depreciação já
recuperada"). Subestima o quanto a impressora já se pagou — sempre para baixo, nunca para cima.
Não toca preço nem COGS.

**Correção sugerida.** Escalar por `1 / (qty − unattributedUnits)` como o caminho `acabado` faz,
guardando o caso zero.

---

## 🔴 [E2] — interseção de UMA máquina: existe uma resposta certa, e ela é jogada fora em silêncio

**`src/features/pricing-calculator/components/SaleModal.tsx:747-752` e `:1503`**
(o `> 1` que decide se o seletor aparece e se o botão trava)

**O que quebra.** Quando as etapas ambíguas têm **exatamente uma** impressora em comum, o seletor
não é renderizado, o botão não trava e ninguém preenche as linhas. O comentário do código assume
"uma candidata só não trava — o builder já preencheu", mas o `initialRowMachineId`
(`productionPlan.ts:250`) preenche pelo conjunto DA LINHA, não pela interseção do item: com 2
elegíveis por etapa ele devolve `""`.

**Como foi reproduzido.** Sonda `e2.probe.ts`. Produto: etapa principal `["a1","x2d"]`, etapa
"Acabamento" `["mini","x2d"]` — as duas ambíguas, interseção = `{x2d}`.

```
E2 rows.machineId = [ '', '' ]
E2 encomendaMachineOptions = [ 'x2d' ] -> seletor aparece? false
E2 machineUsage = []   unattributedUnits = 2   (de qty=2)
E2 eventos gravados machineId = [ '""', '""' ]
```

**O que custa.** Dado perdido. A venda grava `machineUsage: []` + `unattributedUnits = qty`, e os
dois eventos de produção vão para a coleção `producao` com `machineId: ""`. O ROI perde as horas
(`printedCount`/`printedHours` de `machineRoi.ts:124` não casam com id vazio), o lucro e a
depreciação — tudo isso quando havia **uma única resposta possível** (X2D). Custo permanece certo
(taxa de frota).

**Correção sugerida.** Com interseção de exatamente 1, preencher automaticamente
(`item.machineId = options[0].id`) em vez de esconder o seletor.

---

## 🔴 [E3] — o caso BOM (tudo atribuído) exibe o aviso do caso RUIM

**`src/features/pricing-calculator/components/SaleModal.tsx:1536-1546`** · origem em
**`src/features/pricing-calculator/lib/productionPlan.ts:276`**

**O que quebra.** `encomendaMachineOptions` devolve `[]` para **dois estados opostos**: "não há
nenhuma linha ambígua" (linha 276, `if (ambiguas.length === 0) return []`) e "as ambíguas não têm
interseção". O JSX só testa `length === 0`, então o produto **totalmente resolvido** — o melhor
caso, e o normal depois do recadastro do dono — recebe a frase:

> "As etapas deste produto não têm uma impressora em comum — não há uma máquina só para atribuir.
> (…) mas **o ROI não credita ninguém**. Para atribuir por etapa, registre em Produção e venda como
> peça pronta."

**Como foi reproduzido.** Sonda `e2.probe.ts`, caso E3. Produto: principal `["x2d"]`, etapa
"Acabamento" `["a1"]` (cada etapa com UMA elegível):

```
E3 rows.machineId = [ 'x2d', 'a1' ]
E3 encomendaMachineOptions = []  length === 0 -> true      ← dispara o aviso
E3 machineUsage = ["x2d","a1"]   unattributedUnits = 0     ← o ROI credita os dois, corretamente
```

Vale também para o caso mais comum de todos: produto de etapa única com uma máquina elegível.

**O que custa.** Não é o número: o documento gravado está certo. É **informação errada na tela de
dinheiro**, afirmando o oposto do que aconteceu, e mandando o dono fazer um retrabalho caro
(registrar na `/producao` e vender como peça pronta) que não é necessário. Classifiquei 🔴 por ser
afirmação falsa e reachable no caminho normal; quem consertar pode discordar da severidade sem
discordar do fato.

**Correção sugerida.** `encomendaMachineOptions` precisa distinguir "sem ambiguidade" de "sem
interseção" (devolver `null` num caso, `[]` no outro), e o JSX testar o segundo.

---

## 🟡 [E4] — conjunto só com id órfão: a tela diz "peso 0%" e esconde o "frota inteira"

**`src/features/pricing-calculator/components/MachineCheckboxes.tsx:34, 39-41, 92-104`**

**O que quebra.** `orphan` é `selectedIds.length === 0`. Um conjunto que só tem ids de máquinas
apagadas tem `length > 0`, então o aviso certo ("precificando pela frota inteira") não aparece; e
como nenhuma caixa casa, `pesoMarcado` dá 0 e dispara o aviso ERRADO ("as máquinas marcadas estão
todas com peso 0% → média simples"). O `resolveFleet` nesse mesmo dado devolve `missing: true` e
frota inteira — que é uma conta diferente de "média simples do marcado".

**Como foi reproduzido.** Sonda `e4.probe.ts`, executando o componente real (função pura, sem
hooks) e caminhando a árvore de elementos. `selectedIds = ["fantasma"]`, frota Mini/A1/X2D:

```
checked por caixa = [ false, false, false ]
avisos = [ '⚠ As máquinas marcadas estão todas com peso 0%, então a média está simples …' ]
```

Controle com `["a1"]`: `avisos = []` (correto).

**O que custa.** Só feio — mas é feiura que descreve a conta errada, no painel que existe para
explicar o preço. O badge do `PricingResultCard` continua certo.

**Correção sugerida.** Trocar `orphan` por "nenhum id marcado casa com a frota viva".

---

## 🟡 [E5] — o guarda "desmarcar a última é no-op" é furado por um id órfão

**`src/features/pricing-calculator/components/MachineCheckboxes.tsx:44-50`**

**O que quebra.** `if (!checked && selected.size <= 1) return;` conta o `Set` dos ids SALVOS, não
das caixas marcadas. Com `["fantasma", "a1"]` o tamanho é 2, o guarda deixa passar, e o `next`
(`machines.filter(...)`) descarta o órfão — devolvendo `[]`.

**Como foi reproduzido.** Sonda `e4.probe.ts`, caso E5: chamando o `onChange` real do `<input>` da
A1 com `{target:{checked:false}}`:

```
checked por caixa = [ false, true, false ]
onChange recebeu (esperado: NÃO esvaziar) = []
```

**O que custa.** O produto silenciosamente passa a ser precificado pela frota inteira (preço muda
no ato) e o Salvar passa a ser recusado pelo `validateProduct.ts:60` com uma mensagem que não
explica o clique que causou o estado. Reachable sempre que uma máquina é apagada em outro
dispositivo (o doc `config/machines` é compartilhado e realtime) e o produto é carregado depois.

**Correção sugerida.** Contar as marcadas VIVAS (`machines.filter(m => selected.has(m.id)).length`)
no guarda.

---

## 🟡 [E6] — id de máquina inexistente dentro do "Etapas JSON" entra sem um pio na importação

**`src/features/pricing-calculator/lib/productCsv.ts:686-706`** (`idsJson`) e **`:728`**

**O que quebra.** A coluna humana "Maquinas" ganhou quatro classes de aviso (`maquina-vazia`,
`maquina-nenhuma-casou`, `maquina-descartada`, `maquina-por-aproximacao`). O conjunto das ETAPAS,
que viaja por id dentro do JSON, não tem nenhuma: `idsJson` aceita qualquer string não-vazia e só
reporta o que **não é string**. Um id que não existe na frota entra inteiro, e a etapa passa a ser
precificada pela frota inteira.

**Como foi reproduzido.** Sonda `e6.probe.ts`: `exportProductsCsv` real do produto
(principal `["a1","x2d"]`, etapa "Base" `["x2d"]`), troca de `""machineIds"":[""x2d""]` por um id
inexistente, `parseProductsCsv` real:

```
E6 stages[0].machineIds importado = ["impressora_que_nao_existe"]
E6 warnings = []
E6 issues   = ["cor-sem-peso","cor-avulsa"]     ← nenhuma classe sobre máquina
E6 preço com id fantasma = 34.699…  | preço correto = 37.835…  | machineMissing = true
```

**O que custa.** R$ 37,83 → R$ 34,70 (−8,3%) sem aviso no diálogo de importação. O badge do
catálogo (`machineMissing`) acende depois, então não é totalmente calado — mas contraria o CSV-05
("coluna nova que possa falhar calada entra com a checagem dela no mesmo commit"). Caminho real:
exportar, apagar uma impressora, reimportar.

**Correção sugerida.** `idsJson` recebe a frota e reporta o id que não casa, na mesma classe
`maquina-descartada`.

---

## 🟡 [E7] — a `/producao` congela as linhas contra a frota do INSTANTE, e o instante pode ser `DEFAULT_MACHINES`

**`src/features/pricing-calculator/components/ProductionPage.tsx:221, 231, 246`** ·
**`src/features/pricing-calculator/hooks/useMachines.ts:52-54`** ·
**`src/features/pricing-calculator/lib/productionPlan.ts:243-251`**

**O que quebra.** `selectOption` grava as `EventRow` em **estado**; elas nunca são recalculadas
quando a frota chega. O `useMachines` começa em `DEFAULT_MACHINES` (2 máquinas: `a1`, `x2d`) e só
depois o snapshot do Firestore traz as reais. Contra a frota curta, `initialRowMachineId` pode
achar que há **uma** elegível onde há duas — e preencher a linha sozinho, exatamente o palpite que
a decisão do dono (2026-09-01, "vazia só quando há dúvida") recusa.

O gatilho mais concreto é o deep link do catálogo (`/producao?produto=…`): a semeadura de
`ProductionPage.tsx:246` só espera `products.length > 0`. Produtos e máquinas são **duas
assinaturas independentes**; nada garante que a das máquinas chegue primeiro.

**Como foi reproduzido.** Núcleo puro medido na sonda `e6.probe.ts`, caso E7:

```
DEFAULT_MACHINES = [ 'a1', 'x2d' ]
initialRowMachineId(['a1','mini'], FROTA real)        = ""     ← certo: há dúvida
initialRowMachineId(['a1','mini'], DEFAULT_MACHINES)  = "a1"   ← errado: preenche sozinho
initialRowMachineId(['mini'],      DEFAULT_MACHINES)  = ""
```

A janela temporal em si é hipótese de navegador (ver a seção abaixo).

**O que custa.** Atribuição errada e calada no ROI: horas, lucro e depreciação de uma impressão que
pode ter saído na Mini creditados à A1, sem que o dono tenha sido perguntado. É o mesmo defeito que
o `PricingCalculator.tsx` já conserta para o formulário (o `machinesTouched`, com a nota "Medido ao
vivo: produto novo abria com A1 e X2D marcadas e a Mini de fora") — a `/producao` é o irmão que
ficou.

**Correção sugerida.** Não semear/selecionar enquanto `machines` ainda for o fallback (ou
recomputar `machineId` das linhas quando a frota mudar e o dono não tiver escolhido).

---

## 🟢 Ressalvas (gosto / risco baixo, não são defeitos)

- **`ProductionPage.tsx:375-379`** — o `useMemo` do preview lista `[rows, plates, mode, stock,
  supplies, machines]` e **omite `dateStr`**, que agora é argumento do `planEvents` (o `at` do lote
  de acerto, AUD-16 [E7]). Hoje não morde: a data do lote de acerto não é exibida e o rolo é o único
  da cor, então a ordem FIFO não muda. Mas o comentário promete "a MESMA no preview e na gravação" e
  a lista de dependências não sustenta a promessa.
- **`productionPlan.ts:763`** — `machineId: e.machine?.id ?? e.row.machineId`. Se a linha carrega o
  id de uma máquina apagada, o evento é gravado com esse id morto e `machineName: ""`, enquanto o
  `machineUsage` o trata como órfão. O guarda de `ProductionPage.tsx:505` só checa vazio, não
  existência. Estado incoerente, mas exige apagar a máquina com a linha já montada.
- **`SaleModal.tsx` (CestaItem.machineId)** — a máquina escolhida na venda **não é gravada no doc**
  da venda. Ao EDITAR uma venda de encomenda, os eventos antigos são apagados e recriados e a
  escolha volta a zero; o bloqueio do botão protege contra a perda silenciosa, mas o dono é obrigado
  a reescolher e pode escolher outra impressora sem perceber que está reatribuindo.
- **`productCsv.ts:704`** — `idsJson` com `machineIds: []` EXPLÍCITO na etapa herda o conjunto do
  produto, em silêncio (o `ids.length > 0 ? ids : fallback` não distingue "veio vazio" de "veio
  ausente"). Sem consequência prática hoje porque o produto-fonte também cai na frota inteira.

---

## Hipóteses da camada C — para medir no navegador (com o dono logado)

Escritas como passos verificáveis. Não abri o app (há `AuthGate`; login é handshake com o dono).

1. **[E7] a corrida das duas assinaturas.** No `/catalogo`, clicar em "Produzir" num produto
   elegível a `A1 + Mini` (duas máquinas, uma delas FORA do `DEFAULT_MACHINES`). Com throttling de
   rede ("Slow 3G" no DevTools) ou logo após limpar o `localStorage`, conferir se o `<select>`
   "Máquina" da linha nasce **vazio** ("Escolha a máquina…") ou já preenchido com **A1**. Preenchido
   = defeito confirmado. Repetir com recarga normal para medir a frequência.
2. **[E7-b] a mesma corrida sem deep link.** Abrir `/producao` direto e, no primeiro segundo,
   selecionar o mesmo produto no seletor. Mesma conferência.
3. **[E2] a interseção de uma.** Cadastrar um produto com etapa principal `["A1","X2D"]` e etapa
   extra `["Mini","X2D"]`. Registrar venda como **encomenda**: confirmar que **nenhum** seletor
   "Máquina" aparece, que o botão "Registrar venda" fica **habilitado**, e que depois de salvar a
   `/maquinas` não credita hora nenhuma à X2D (e a `/producao` mostra os dois cards com a coluna
   Máquina em branco).
4. **[E3] o aviso no caso bom.** Registrar venda como encomenda de um produto de **uma etapa com uma
   única máquina elegível**. Confirmar que a caixa âmbar "As etapas deste produto não têm uma
   impressora em comum… o ROI não credita ninguém" aparece, e que a `/maquinas` **credita**
   normalmente aquela impressora.
5. **[E4]/[E5] o conjunto órfão.** Em dois dispositivos (ou duas abas): carregar na calculadora um
   produto com 2 máquinas marcadas; na outra aba, apagar uma delas em Gerenciar Máquinas; recarregar
   a primeira aba e carregar o produto de novo. Conferir (a) qual aviso aparece embaixo das caixas
   e (b) se desmarcar a única caixa marcada esvazia o conjunto (o preço deve pular na hora).
6. **[E1] o efeito visível.** Depois de uma encomenda parcialmente órfã, comparar o "R$ X de
   depreciação já recuperada" do cartão da máquina com a soma de `frozenBreakdown.depreciation` dos
   eventos daquela máquina (visível no console via a coleção `producao`). A razão deve ser 1; a
   sonda mediu 0,25.
7. **Reprecificação ao vivo.** Editar `weight` de uma máquina em Gerenciar e confirmar que o preço
   de um produto aberto muda no ato **e** que a tabela "Taxa de frota" da `/maquinas` muda junto (as
   duas leem a mesma `resolveFleet`; divergência aqui seria memo preso).

---

## Camadas varridas e sãs (resultado, não omissão)

- **A. Matemática pura.** `fleet.ts` resiste às entradas adversariais que testei: ids duplicados no
  conjunto (`Set` dedupe, `missing` não acende falso), pesos negativos (saneados), soma de pesos
  zero (média simples, sem `NaN`), lista de máquinas vazia (TD-024), `lifeHours <= 0` (depreciação
  0). `unionEligible` devolve a ordem do cadastro nos dois sentidos (principal restrita + extra
  órfã, e o inverso). `calculatePricing` não guardou nenhum resquício escalar. **Não achei defeito
  de conta.**
- **D. Semântica cruzada — "id vazio no `machineUsage`".** Varri os cinco produtores
  (`planEventRows`, `addProductionLayers`/`consumeFifo`, `machineUsageFromDocument`,
  `addMachineUsage`, o payload da `SaleModal`) e **nenhum caminho** consegue inserir uma entrada com
  `machineId` vazio: o `planEventRows` guarda com `if (e.machine)`, o leitor do Firestore filtra
  `typeof machineId === "string" && !== ""`, e as camadas só recebem o que veio guardado. O 🔴 do
  `CLAUDE.md` está honrado. O que escapou não foi o id vazio — foi a **escala** ([E1]) e a **oferta**
  ([E2]/[E3]).
- **B. Persistência.** `productPayload` ⇄ `toSavedProduct`, `productionToDocument` ⇄ `toProduction`
  (com `submissionId` caindo no próprio id para evento pré-Fase-1 — confere: a query volta vazia e o
  lote é ele mesmo), `saleToDocument` ⇄ `toSale` (`machineUsage`/`unattributedUnits` gravados
  SEMPRE, inclusive vazio/zero, como o AUD-02 pede), `layerToDocument` ⇄ `toLayer` (lista vazia não
  é gravada de propósito: ausência É o dado). O único buraco é o [E6], e ele é de AVISO, não de
  round-trip.
- **`grep` de máquina escalar.** Fora dos usos legítimos (evento, `MachineUsage`, `EventRow`,
  escolha da venda), **não sobrou** nenhum ponto de precificação lendo `machineId` escalar.

---

## O que a AUD-17 NÃO cobriu — a sombra desta varredura

1. **Nenhuma passada no navegador.** É o limite declarado no briefing. As sete hipóteses acima são
   dívida real: a camada C foi varrida por LEITURA e por execução de componentes puros fora do DOM,
   não por interação. Componentes com `useState`/`useEffect` (`ProductionPage`, `SaleModal`,
   `PricingCalculator`) não foram executados — só `MachineCheckboxes`, que não tem hooks.
2. **Timing e corridas de assinatura.** Só apontei a de `machines × products` na `/producao`. Não
   varri as outras (estoque × produtos na `SaleModal`, acabados × vendas na `/vendas`) com o mesmo
   olhar; o padrão "estado semeado a partir de uma lista que ainda vai mudar" aparece em mais
   lugares do que os que examinei.
3. **CSS e responsivo.** Os 8 arquivos de `styles/*.css` do diff (incluindo `machines.css`, 88
   linhas novas, e a `.machine-modal` de 680px) não foram olhados. Largura, quebra em cartão,
   contraste dos avisos novos — nada disso foi medido.
4. **Transações do Firestore.** Li `removeProduction` (agora apaga N docs) e `reconcileRecibo`, mas
   **não simulei** falha parcial, conflito de `rev`, nem o limite de 500 escritas por transação — um
   lote grande de produção + estoque + acabado pode se aproximar dele e eu não contei.
5. **AUD-16 lotes 2+.** O intervalo `92a1688..HEAD` inclui as correções da AUD-16 posteriores ao
   lote 1 (lote de acerto D4/E7, `sanitizeBlockForPdf` E6, `readFinishedColorEntry` E5). Li os
   diffs e não achei nada, mas gastei o esforço na FROTA — essa parte teve leitura, não sonda.
6. **A capacidade.** O `calculateCapacity` perdeu o `machineBreakdown` e voltou à soma em série. Isso
   está no `BACKLOG` como item aberto e o briefing o declara fora de escopo; não conferi se algum
   consumidor do `CapacityResult` ficou lendo um campo que não existe mais (o `typecheck` cobriria,
   e ele está verde).
7. **Concorrência entre dispositivos no `config/machines`.** `persistMachines` grava o documento
   inteiro sem `rev`. Dois donos editando ao mesmo tempo perdem uma das edições. É anterior ao
   intervalo varrido e não o investiguei — mas a Fase 2 aumentou a aposta, porque agora esse
   documento carrega os PESOS que precificam o catálogo inteiro.

---

# Reconferência (2026-09-03, turno seguinte)

Rito da casa: nenhum achado vira linha de código antes de ser reconferido com sonda por quem não
o escreveu. Todas as 8 sondas da varredura foram **re-executadas** e reproduzem número por número.
Além delas, sondas novas (`recheck.probe.ts`, `reach.probe.ts`) para responder o que o laudo não
respondia: **a correção proposta fecha?** e **isto alcança a frota de hoje?**

## Veredito por achado

| id | veredito | o que a reconferência mudou |
|---|---|---|
| **E1** | **confirmado — mas latente** | A conta erra mesmo; a razão é a **cobertura**, não fixo 0,25. Só que o botão trava toda encomenda parcialmente órfã na frota de 2 → **não é gravável hoje**. |
| **E2** | **confirmado — arma com 3ª máquina** | Impossível com frota de 2 (opções nunca dão 1). Reproduzido com 3. **Caso novo:** também arma com frota de **1**. |
| **E3** | **confirmado e AGRAVADO** | Não é "um caso"; na frota de hoje é **100% das encomendas que o app deixa salvar**. |
| **E4** | confirmado | `orphan = selectedIds.length === 0` e `pesoMarcado` sobre o marcado vivo: lido no fonte, medido no componente. |
| **E5** | confirmado | `selected.size <= 1` conta os ids SALVOS; o `next` filtra pela frota viva e devolve `[]`. |
| **E6** | confirmado | `idsJson` não recebe a frota; medido ponta a ponta (R$ 37,83 → R$ 34,70, `warnings = []`). |
| **E7** | confirmado — **inerte hoje** | `DEFAULT_MACHINES` = `a1`+`x2d`, os **mesmos ids** da frota real: durante a janela o `initialRowMachineId` dá o mesmo resultado. Arma na 3ª impressora. |
| 🟢 `CestaItem.machineId` | confirmado | `salesRepository.ts` não tem **nenhuma** ocorrência de `machineId`; `machineUsage`/`unattributedUnits` são gravados sempre (linhas 419-420). |

## As correções propostas fecham? (medido, não deduzido)

`recheck.probe.ts`, produto com principal ambígua + duas etapas resolvidas em máquinas diferentes,
`qty = 4`, órfãs 2:

```
R1 x2d: real=7.4661  hoje=3.7331 (razão 0.5000) | com 1/atribuídas = 7.4661 (razão 1.0000)
R1 mini: real=2.1333 hoje=1.0667 (razão 0.5000) | com 1/atribuídas = 2.1333 (razão 1.0000)
R2 controle (sem órfãs): razão 1.0000 já hoje
R3 E2 com a interseção preenchida: usage [] órfãs 2  →  usage ["x2d"] órfãs 0
```

**A razão errada é a `coverage`, não a constante 0,25** do laudo — com metade órfã dá 0,5. A
correção `1 / (qty − unattributedUnits)` fecha em 1 para **todas** as máquinas, e o preenchimento
automático da interseção de 1 recupera o lastro inteiro. Ambas verificadas antes de escrever código.

## O mapa de alcance — o que o dono consegue GRAVAR errado (`reach.probe.ts`)

8 formas de produto × 3 tamanhos de frota. `TRAVA` = o botão Registrar fica desabilitado
(`SaleModal.tsx:1025`, via `semMaquina`).

```
FROTA DE HOJE (a1+x2d)
  TRAVA  todas as 6 formas com ambiguidade  →  órfãs nunca chegam ao banco
  salva  resolvido x2d + etapa a1   órfãs=0  usage=[x2d,a1]   ← aviso E3 SIM (falso)
  salva  resolvido x2d, sem etapa   órfãs=0  usage=[x2d]      ← aviso E3 SIM (falso)

FROTA DE UMA (a1)
  salva  resolvido x2d + etapa a1   órfãs=1.5/2  usage=[a1]   ← E1 VIVO, sem trava
  salva  legado (conjunto vazio)    órfãs=2/2    usage=[]     ← E2 (opções=1, seletor escondido)
```

**A leitura:** na frota de 2 a trava do botão é o que segura E1 e E2 — eles existem na matemática
mas não têm porta. **E3 é o único que morde hoje**, e morde em tudo. A porta de E1/E2 abre em três
situações: **3ª impressora** (etapas com conjuntos cruzados), **frota de 1** (todo produto legado),
e **4ª impressora** (interseção vazia com etapa resolvida junto — E1 sem passar por E2).

⚠ Consequência para a ordem: corrigir E2 (preencher a interseção de 1) **fecha a porta principal de
E1**, mas não a de interseção vazia. Os dois andam no mesmo lote ou E1 fica meio consertado.

## Caso que a varredura não viu

**[E2-b] frota de UMA máquina + produto legado.** `machineIds: []` significa "frota inteira"; com
uma máquina só, a interseção tem exatamente 1 e cai no gate `> 1` do E2 — seletor escondido, botão
liberado, `machineUsage: []`, `unattributedUnits = qty`. Medido em `reach.probe.ts` (bloco
"FROTA DE UMA"). Como o `CLAUDE.md` registra que **todo produto anterior à fase entra sem
conjunto**, isto não é um caso de laboratório: basta o dono apagar uma das duas impressoras antes
de recadastrar. Mesma correção do E2 cobre.

## Ordem de lote sugerida

1. **E3** — morde hoje, em toda encomenda. `encomendaMachineOptions` devolve `null` para "sem
   ambiguidade"; o JSX testa o `[]`.
2. **E1 + E2 (+E2-b)** — mesma porta, mesmo lote: escala `1/atribuídas` e preenchimento automático
   da interseção de 1.
3. **E4 + E5** — o mesmo arquivo (`MachineCheckboxes.tsx`), as duas contas sobre "marcado vivo".
4. **E6 + E7** — aviso do CSV e a trava do seed da `/producao` enquanto a frota for fallback.

⚠ Nota para o lote 4: o `useMachines` **não pode** semear o estado inicial do `localStorage` (o
componente é `"use client"` mas ainda passa por SSR — o servidor leria `null` e a hidratação
divergiria no preço). A correção do E7 é expor um `ready` do hook e **não semear** enquanto ele for
falso, não trocar o valor inicial.
