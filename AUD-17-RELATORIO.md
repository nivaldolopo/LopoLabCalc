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

---

# Passada no navegador (2026-09-03) — a camada C deixou de ser hipótese

Feita no Chrome do dono, **com a sessão Google que já estava aberta**: nenhuma credencial foi
digitada por mim. App rodando local (`.claude/launch.json`, `localhost:3000`) contra o Firestore de
produção. **Nada foi vendido**: o modal de venda foi aberto, medido e cancelado.

## O fato que derruba metade das ressalvas de alcance

**A frota tem TRÊS máquinas: A1 Combo (40%), X2D Combo (40%), A1 Mini (20%).** A reconferência
tinha assumido duas (a memória do projeto dizia A1 + X2D). Com três, tudo que a reconferência
classificou como "latente, arma na 3ª impressora" **já está armado**:

- **E2 é alcançável hoje.** Basta um produto cujas etapas ambíguas cruzem conjuntos.
- **E7 é alcançável hoje.** A Mini **não está** em `DEFAULT_MACHINES` (que tem só `a1` e `x2d`),
  então a frota do primeiro render é de fato diferente da real.

## E3 — medido na tela, e é pior do que o laudo dizia

Produto `AUD17 E3 so x2d`, criado para o teste com **uma única máquina elegível** (X2D):

> "As etapas deste produto não têm uma impressora em comum — não há uma máquina só para atribuir.
> A venda entra normalmente (o custo usa a média da frota), mas **o ROI não credita ninguém**.
> Para atribuir por etapa, registre em Produção e venda como peça pronta."

Está errado nas duas afirmações: há uma impressora, e o ROI credita ela. Medido no DOM do diálogo:
`avisosAmbar = 1`, `seletoresDeMaquina = 0`, botão `"Registrar venda (2 itens)"` **habilitado**.

⚠ **Por que ainda não incomodou o dono:** nenhum dos 103 produtos do catálogo tem conjunto restrito
— todos são legados (`machineIds` vazio → frota inteira → 3 opções → seletor aparece e o botão
trava). O aviso falso **começa a aparecer no recadastro**, exatamente quando o dono passar a dizer
em que máquina cada produto roda. É um defeito que espera pelo trabalho dele.

## E2 — medido na mesma tela, e é silencioso

Produto `AUD17 E2 intersecao 1`: principal `{A1, X2D}` + etapa "Acabamento" `{X2D, Mini}` →
interseção `{X2D}`, uma só. No modal esse item não mostra **nem seletor nem aviso** — nada. E o
botão fica habilitado. Salvar gravaria `machineUsage: []` e `unattributedUnits = qty` num item cuja
resposta certa (X2D) era única e conhecida.

## O que ficou provado de bom

- A **taxa de frota reprecifica ao vivo**: o mesmo produto saiu de **R$ 31,00** (frota inteira, 3
  máquinas) para **R$ 39,05** ao deixar só a X2D marcada. Fase 2 funcionando na tela.
- A **trava do botão funciona** onde ela é acionada (produto legado, 3 candidatas): seletor
  "Escolha a máquina…" aparece e "Registrar venda" fica cinza.

## Limpeza

Os dois produtos de teste foram **excluídos** ao fim (catálogo de volta a **103**). Nenhuma venda,
nenhum evento de produção, nenhuma baixa de estoque.

## O que a passada no navegador ainda NÃO cobriu

- **E7 (a corrida)** — precisa de throttling e recarga repetida para medir frequência; não fiz.
- **E4/E5 (conjunto órfão)** — exigiriam apagar uma impressora do doc compartilhado
  `config/machines`, o que reprecifica o catálogo inteiro. Não toquei sem o dono pedir.
- **E1 no cartão da máquina** — exigiria gravar uma venda de encomenda parcialmente órfã. Não
  gravei; a sonda já mede a razão com o código real.

---

# E1 medido no app real (2026-09-03) — o cartão da máquina

Com autorização do dono para criar e apagar dado. Produto de teste `AUD17 E1 parcial`, desenhado
para abrir a porta do E2 e produzir órfãs parciais:

- etapa principal `{A1, X2D}` 3 h → **ambígua**
- etapa "Acabamento" `{X2D, Mini}` 1 h → **ambígua** · interseção das duas = `{X2D}`, **uma só** →
  o gate `> 1` esconde o seletor e libera o botão (E2 na prática)
- etapa "Base" `{Mini}` 2 h → **resolvida na Mini**

Venda de **3 unidades**, sob encomenda, sem escolha de máquina (a tela não a ofereceu). Os três
eventos gravados, lidos na `/producao`:

```
AUD17 E1 parcial — Base         A1 Mini · 6 h · custo real R$ 2,49   ← atribuída
AUD17 E1 parcial — etapa 1      —       · 9 h · custo real R$ 42,10  ← órfã
AUD17 E1 parcial — Acabamento   —       · 3 h · custo real R$ 4,79   ← órfã
```

12 h órfãs de 18 h → cobertura **1/3**, como projetado.

## O número errado, na tela do dono

Cartão da **A1 Mini** em `/maquinas`, antes e depois da venda:

| | antes | depois | delta |
|---|---|---|---|
| horas impressas | 13,98 h | 19,98 h | **+6,00 h** ✓ correto |
| impressões | 4 | 5 | +1 ✓ (um evento de 6 h) |
| **depreciação recuperada** | R$ 1,16 | R$ 1,69 | **+R$ 0,53** |
| receita | R$ 72,58 | R$ 113,17 | +R$ 40,59 ✓ correto (1/3 de R$ 121,77) |

A depreciação REAL das 6 h na Mini é `6 h × R$ 0,27/h` = **R$ 1,60** (taxa da própria tabela "Taxa
de frota" da página). Recuperou **R$ 0,53 = exatamente 1/3** — a cobertura aplicada duas vezes.
**Faltam R$ 1,07 (67%) na conta de quanto a impressora já se pagou.**

E a receita entrou CERTA no mesmo cartão, o que confirma o diagnóstico: a fatia proporcional está
boa; só o campo absoluto (`depreciation`) erra. Fim da cadeia: sonda → fonte → tela.

## E2 também se confirmou aqui

Esse mesmo produto é o caso do E2: a venda foi gravada **sem que a tela oferecesse a escolha** e sem
aviso nenhum, com 2 das 3 unidades sem lastro — quando `{X2D}` era a única resposta possível para as
etapas ambíguas.

## E7 — NÃO reproduzido (3 tentativas)

Deep link `/producao?produto=…` num produto elegível a `{A1, Mini}` (a Mini está fora do
`DEFAULT_MACHINES`). Em **3 cargas** a linha nasceu **vazia** ("Escolha a máquina…"), que é o
comportamento certo. Hipótese para a diferença: `config/machines` é **um documento**, e os produtos
são uma coleção de 104 — o doc único chega primeiro quase sempre. **O núcleo puro erra** (medido em
`e6.probe.ts`), mas a janela não se manifestou. Rebaixar E7 de 🟡 para 🟢 é defensável; a correção
continua barata.

## Observação nova, a decidir (não classifiquei)

Na `/producao`, o `<select>` "Máquina" da linha oferece **as três** impressoras, mesmo num produto
elegível a duas. Se isso é de propósito ("o que RODOU manda, não o que PODE"), é coerente com a
regra da casa — mas então o conjunto elegível não restringe nada ali, e vale dizer isso no
comentário. Não medi as consequências.

## ⚠ Dado de teste que ficou no banco

Interrompi a limpeza: ao limpar o IndexedDB para forçar a carga fria do E7, a **sessão do Firebase
caiu** (é lá que ela mora) e o app voltou ao `AuthGate`. Ficaram para apagar, assim que houver
sessão:

1. venda **"AUD17 TESTE E1"** — 3 × R$ 40,59 (apagá-la reverte os 3 eventos de produção)
2. produto **"AUD17 E1 parcial"**
3. produto **"AUD17 E7 a1 mini"**

Enquanto ela existir, o cartão da A1 Mini mostra 19,98 h e R$ 1,69 — os números do teste.

---

# E4 e E5 medidos no app (2026-09-03)

**Montagem sem tocar nas três impressoras reais:** criei uma quarta máquina, `AUD17 FANTASMA`, com
**peso 0** — que por definição não entra na média ponderada, então **nenhum preço do catálogo mudou**
(conferido: o produto padrão continuou em R$ 31,00 com ela na frota). Salvei dois produtos apontando
para ela e **apaguei a máquina**. Os dois ficaram com id órfão, que é a condição do E4/E5, sem que a
frota real fosse alterada em momento algum.

## 🔴 [E4] confirmado — e a mensagem mente duas vezes

Produto `AUD17 E4 so orfa` (conjunto = só o id morto), carregado no formulário:

```
caixas:  A1 Combo false · X2D Combo false · A1 Mini false      ← nada marcado
aviso:   "⚠ As máquinas MARCADAS estão todas com peso 0%,
          então a média está SIMPLES (todas pesam igual)."
preço:   R$ 31,00
```

As duas afirmações são falsas: **não há máquina marcada**, e a média **não é simples** — R$ 31,00 é
exatamente o preço da frota inteira **ponderada** 40/40/20 (o mesmo número que o produto padrão dá
com as três marcadas; a média simples daria outro, porque o desgaste ponderado é R$ 1,08/h contra
R$ 0,95/h da simples). E o aviso certo — "precificando pela frota inteira" — **não aparece**.

⚠ **A frase certa já existe no app**, no badge do `PricingResultCard`, e apareceu na mesma tela:
"⚠ Sem máquinas elegíveis válidas — precificando pela frota inteira (A1 Combo, X2D Combo, A1 Mini)".
O defeito é só o galho errado escolhido em `MachineCheckboxes`. Isso **sobe o E4 de 🟡 para 🔴**: não
é lacuna de prova, é afirmação falsa na tela que explica o preço, com a redação correta a três
componentes de distância.

## 🔴 [E5] confirmado — um clique que deveria ser no-op mexe no preço

Produto `AUD17 E5 orfa mais a1` (conjunto = id morto + A1). Só a A1 aparece marcada. Cliquei para
desmarcá-la — o guarda "desmarcar a última é no-op" deveria recusar:

| | antes do clique | depois |
|---|---|---|
| marcadas | A1 (a única) | **nenhuma** |
| preço | **R$ 27,14** | **R$ 31,00** (+13,5%) |
| aviso | — | "⚠ Nenhuma máquina marcada — precificando pela frota inteira" |

O guarda contou os ids **salvos** (2: morto + A1), deixou o clique passar, e a reconstrução filtrou
o morto e devolveu `[]`. Em seguida o Salvar é **recusado**: "⚠️ Marque ao menos uma máquina onde o
produto pode ser impresso" — sem nenhuma pista de que o clique esvaziou um conjunto que tinha um id
fantasma. **Sobe de 🟡 para 🔴**: muda preço na tela e trava o salvamento, por um clique que a
própria regra escrita diz que não faz nada.

## O que também ficou provado — e é bom

- **O estorno da venda é exato.** Apagada a venda `AUD17 TESTE E1`, o cartão da A1 Mini voltou
  a **13,98 h · 4 impressões · R$ 1,16 · R$ 72,58** — idêntico, dígito por dígito, ao baseline de
  antes do teste. A fundação (transação + reverse) está sólida.
- **Peso 0 não contamina a frota:** somar uma máquina com peso 0 deixou todos os preços intactos,
  como o `fleet.ts` promete.
- **O fallback de conjunto órfão funciona no número:** os dois produtos foram precificados pela
  frota inteira (TD-009), como desenhado. O defeito é de TEXTO, não de conta.

## Limpeza final (conferida)

`Catálogo (103)` · `3 MÁQUINAS` · **0** eventos AUD17 na `/producao` · A1 Mini em 13,98 h.
Nada meu ficou no banco.

## Placar depois de tudo

**5 🔴 · 1 🟡 · 5 🟢** — E1, E2, E3 confirmados na tela; E4 e E5 promovidos a 🔴 por medição;
E7 rebaixado a 🟢 (não reproduziu em 3 cargas frias); E6 segue 🟡 (medido só por sonda ponta a
ponta, não pela tela de importação).

---

# ✅ Lote 1 corrigido (2026-09-03) — [E3] + [E4] + [E5]

Os três eram **texto de tela** com a redação certa já existindo no app. A correção não reescreveu
frase nenhuma: tirou a decisão de **qual** frase mostrar de dentro do JSX e a pôs em função pura,
onde ela pôde ser travada por teste.

| | antes | depois |
|---|---|---|
| **[E3]** | `encomendaMachineOptions` → `Machine[]`, e `[]` significava as duas coisas | → `Machine[] \| null`. `null` = nada ambíguo (caso BOM) · `[]` = sem interseção. O JSX testa `?.length === 0` |
| **[E4]** | `orphan = selectedIds.length === 0` (conta o fantasma) | `machineSelectionNote(machines, ids)` → `"orfa"` \| `"peso-zero"` \| `null`, decidido pelo mesmo `selectedLive` que o `resolveFleet` usa |
| **[E5]** | `if (!checked && selected.size <= 1) return` (ids SALVOS) | `toggleSelection(...)` → `string[] \| null`; o `null` é o no-op, e ele conta as marcadas **VIVAS** |

**Onde a lógica passou a morar:** `lib/fleet.ts` ganhou `selectedLive`, `machineSelectionNote` e
`toggleSelection`; `MachineCheckboxes.tsx` ficou só com a redação e as caixas.

**As invariantes (8 novas em `frotaFase2.test.ts`), conferidas do jeito que vale:** cada uma foi
rodada contra a lógica ANTIGA antes de passar com a nova — 3 testes falharam na restauração de
`selectedIds.length === 0`, `selected.size <= 1` e `return []`, e voltaram a passar depois. As que
mais interessam:

- `nada ambíguo devolve null — não o [] de 'sem interseção'` e o par dele, `sem interseção devolve
  [] — e o [] não é null`: os dois estados opostos do [E3], agora indistinguíveis só se alguém
  desfizer o tipo.
- `o aviso descreve a conta que o resolveFleet de fato faz`: prende o texto do [E4] à conta —
  `missing: true`, `machines` = a frota inteira, `weighted: true` (ponderada, não simples).
- `o conjunto que sai do seletor nunca esvazia`: varre 5 conjuntos × cada marcada viva e exige que
  todo clique de desmarcar ou seja recusado ou devolva lista não-vazia. É a promessa que o
  `validateProduct` só cobrava na hora de salvar, feita agora no ato do clique.

**Verificado:** `pnpm test` 913 passando (31 arquivos) · `pnpm typecheck` · `pnpm lint` ·
`pnpm build`. **Não** houve nova passada no navegador: reproduzir [E4]/[E5] na tela exige apagar uma
impressora do doc compartilhado `config/machines` (reprecifica o catálogo inteiro do dono), e [E3]
exige criar um produto de conjunto restrito — os mesmos motivos pelos quais a varredura parou ali.

**Restam:** lote 2 ([E1]+[E2], a matemática) e lote 3 ([E6], o aviso do CSV).

## Passada no navegador do lote 1 (2026-09-03, autorizada pelo dono)

Com "pode criar maquina e apagar". Chrome do dono, sessão já aberta, app local contra o Firestore de
produção. **Nenhuma venda registrada.**

⚠ **O que a reprodução ensinou de novo:** apagar a máquina **na mesma aba** NÃO reproduz E4/E5 —
o `handleSaveMachines` (`PricingCalculator.tsx:357`) já podava o id morto do formulário. O fantasma
só sobrevive quando a exclusão chega pelo **realtime de outro dispositivo**, exatamente como o laudo
descrevia. Por isso a passada usou **duas abas**: a A segurando a seleção, a B apagando.

**[E5] — o clique voltou a ser no-op.** Aba A com `[A1, ZZ TESTE]`; aba B apaga a ZZ TESTE. O badge
`machine-missing` apareceu, provando o fantasma no estado (`eligible 1 ≠ wanted 2`):

| | antes da correção (medido em 2026-09-03) | agora |
|---|---|---|
| marcadas depois do clique | **nenhuma** | **A1 Combo** (inalterada) |
| preço | R$ 27,14 → **R$ 31,00** | R$ 27,14 → **R$ 27,14** |
| Salvar | recusado sem explicar | segue válido |

**[E4] — o aviso trocou de galho, e os dois textos passaram a concordar.** Conjunto só com o id
morto: `⚠ Nenhuma máquina marcada — precificando pela frota inteira`, e o de "peso 0%" sumiu. O badge
do `PricingResultCard` diz o mesmo: `frota inteira (A1 Combo, X2D Combo, A1 Mini)`, preço R$ 31,00 —
o ponderado 40/40/20. **Controle**: com a ZZ TESTE viva e marcada sozinha (peso 0), o aviso de
"peso 0% → média simples" aparece — ele não foi desligado, só deixou de ser o galho errado.

**[E3] — os dois estados opostos se separaram na tela.** Medido no DOM do diálogo de venda:

| produto | `avisosAmbar` | seletores | botão |
|---|---|---|---|
| `AUD17 L1 E3 so x2d` (nada ambíguo, o caso BOM) | **0** (era **1**, a frase falsa) | 0 | habilitado |
| `AUD17 L1 E3 sem intersecao` (principal `{A1,Mini}` + etapas `{A1,X2D}` e `{X2D,Mini}`) | **1**, a frase correta | 0 | habilitado |

**Limpeza conferida:** `3 MÁQUINAS`, frota inteira de volta a `R$ 1,08 · R$ 0,15 · 110,00 · R$ 1,23`
(idêntica à foto do começo) · A1 Mini em `13,98 h · 4 impressões · R$ 1,16` (idêntica) · nenhum
`AUD17` no catálogo, nas vendas ou na produção · nenhuma `ZZ TESTE` na frota. A máquina de teste foi
criada com **peso 0%** nas duas voltas, então nenhum preço do catálogo se moveu enquanto ela existiu
(R$ 31,00 antes, durante e depois).


---

# ✅ Lote 2 corrigido (2026-09-04) — [E1] + [E2]

Os dois moram na **mesma porta** (a encomenda que a venda planeja sozinha) e por isso fecharam
juntos: o [E2] deixava a venda ficar órfã quando não precisava, e o [E1] errava a conta de quem
ficou órfã de verdade. Fechar só o [E2] esconderia o [E1] no caminho mais comum sem corrigi-lo.

| | antes | depois |
|---|---|---|
| **[E2]** interseção de UMA | ninguém preenche: `machineUsage: []`, `unattributedUnits = qty`, eventos com `machineId: ""` | `unicaCandidata` carimba a única possível, na RECONCILIAÇÃO |
| **[E1]** escala do `machineUsage` | `1 / qty` (por unidade VENDIDA) | `1 / (qty − órfãs)` (por unidade ATRIBUÍDA), como o caminho `acabado` |

**[E2] — resolver na tela ou na reconciliação.** O laudo sugeria preencher `item.machineId` no
modal. A correção foi um degrau abaixo, no `saleReconciliation.ts`: *quem grava é quem garante*, e a
mesma dedução passa a valer para o preview, para a **edição** do recibo e para qualquer chamador que
não seja este modal. O gate `> 1` do `SaleModal` fica como está — com uma candidata não há o que
perguntar, e a regra do dono ("vazia só quando há dúvida") continua de pé. O que mudou na tela: nada.
O que mudou nos comentários: os dois que afirmavam "com uma candidata só o builder já preencheu",
que era a premissa falsa do defeito.

⚠ **O limite da dedução é explícito**: DUAS candidatas continuam órfãs. Chutar a de maior peso é o
palpite que a Fase 2 recusa — o peso diz com que frequência a frota roda, não quem rodou esta peça.

**[E1] — a razão de a Fase 1 não ter pego.** `frotaFase1.test.ts:536` já checava
`Σ machineUsage.depreciation === cogsBreakdown.depreciation`, mas só com `unattributedUnits === 0`,
onde `1/qty` e `1/atribuídas` são o **mesmo número**. A invariante nova é a mesma identidade com
órfãs > 0, e ela reproduz na bancada o número que a tela mostrou:

```
Σ depreciação × atribuídas  = 0.9332666666666667   (esperado 3.7330666666666668)  ← razão 0.25
```

— os mesmos dois números da sonda `e1.probe.ts` e a mesma razão de 1/4 do cartão da A1 Mini
(R$ 0,53 de R$ 1,60).

**13 invariantes novas** em `frotaFase2.test.ts`, todas conferidas **falhando contra a lógica
antiga** antes de passar com a nova: revertendo só o [E1], caem 3 (as identidades da depreciação);
revertendo só o [E2], caem 3 (atribuição, eventos e custo real). As demais são guardas de regressão
e passam nos dois mundos — de propósito: são elas que provam que lucro, receita e o caso sem órfãs
**não** se mexeram.

**Verificado:** `pnpm test` **926 passando** (31 arquivos) · `pnpm typecheck` · `pnpm lint` ·
`pnpm build` — **e medido na tela** (abaixo). ⚠ `machineUsage` é **congelado no documento da
venda**: as vendas já gravadas seguem com a escala antiga até serem reeditadas e salvas. A
`/maquinas` só se move em venda **nova ou re-salva** (Diretriz 7: nada a migrar).

**Resta:** lote 3 ([E6], o aviso do CSV).

## Passada no navegador do lote 2 (2026-09-04, autorizada pelo dono)

Com "pode fazer com permissão para alterar dados". Chrome do dono, sessão aberta, **site de
produção** (deploy `fcbf045` no ar). Duas vendas registradas e depois apagadas; a limpeza está
conferida no fim.

**Linha de base (foto do início):** X2D `113,30 h · 26 impressões · R$ 130,00` · A1
`131,68 h · 34 · R$ 32,94` · Mini `13,98 h · 4 · R$ 1,16` · investimento R$ 21.298,00 · lucro
acumulado R$ 1.851,55. A taxa de desgaste da X2D, publicada na mesma página: **R$ 1,87/h**.

### [E2] — produto de interseção ÚNICA

`AUD17 L2 E2 intersecao unica`: principal `{A1, X2D}` 2 h + etapa "Acabamento" `{X2D, Mini}` 1 h.
As duas nascem ambíguas; a interseção é só a X2D. Vendido 1, sob encomenda.

No diálogo: **0 seletores de máquina, 0 avisos, botão habilitado** — a tela não mudou, como
projetado. O que mudou foi o que ela gravou:

| | antes da correção | medido agora |
|---|---|---|
| eventos na `/producao` | `machineId: ""` (sem máquina) | **X2D Combo · 2 h** e **X2D Combo · 1 h** |
| X2D: horas / impressões | inalteradas | 113,30 → **116,30 h** · 26 → **28** |
| X2D: depreciação recuperada | R$ 130,00 (nada) | **R$ 135,60** (+R$ 5,60 = 3 h × R$ 1,8665) |

### [E1] — encomenda PARCIALMENTE órfã

`AUD17 L2 E1 sem intersecao`: principal `{A1, Mini}` 2 h + `Topo {A1, X2D}` 1 h +
`Lado {X2D, Mini}` 1 h + `Base {X2D}` 1 h. As três primeiras são ambíguas e **não têm impressora em
comum**; a Base é a única resolvida. 4 das 5 horas ficam órfãs → cobertura de **1/5**.

No diálogo: 0 seletores e **1 aviso — o correto** (é o caso de interseção vazia; o [E3] mandando a
frase para o galho certo). Botão habilitado, venda registrada. No cartão da X2D:

| | esperado com a escala ANTIGA (`1/qty`) | medido agora (`1/atribuídas`) |
|---|---|---|
| depreciação recuperada | R$ 135,60 → R$ 135,97 (**+R$ 0,37**) | R$ 135,60 → **R$ 137,47** (**+R$ 1,87**) |

**+R$ 1,87 é exatamente 1 h × R$ 1,87/h**, a taxa que a tabela de frota exibe três parágrafos acima
no mesmo cartão — a hora que a X2D de fato imprimiu, inteira. Os R$ 0,37 são essa hora dividida
pela cobertura de 1/5 que já tinha sido aplicada uma vez: **a razão de 1/5 aqui é a mesma razão de
1/4 medida no cartão da A1 Mini** que abriu o [E1].

### 🟡 Ressalva NOVA, vista na tela (não estava no laudo)

O aviso de interseção vazia afirma "**o ROI não credita ninguém**" — e nesta venda ele creditou: a
X2D levou 1 h e R$ 1,87. A frase é verdadeira para as etapas AMBÍGUAS e falsa para o item quando há
uma etapa resolvida junto (o caso `PARCIAL`, que é justamente o do [E1]). Mesmo espírito do [E3]:
texto de tela afirmando mais do que o dado. Está no `BACKLOG.md`.

### Limpeza conferida

Vendas 53 → **51** · produções 66 → **64** · catálogo de volta a **104** · nenhum `AUD17` em
catálogo, vendas ou produção. Os três cartões voltaram idênticos à foto do início (X2D
`113,30 h · 26 · R$ 130,00`; A1 `131,68 h · 34 · R$ 32,94`; Mini `13,98 h · 4 · R$ 1,16`;
investimento R$ 21.298,00; lucro acumulado R$ 1.851,55). O filamento das duas vendas (1 g de Bege
cada) voltou pelo estorno que a exclusão do recibo faz na mesma transação.

---

# Lote 3 — [E6] corrigido e medido na tela (2026-09-04)

> Site local (`pnpm dev`) contra o Firestore de produção, com a autorização do dono para criar e
> apagar dados. Três produtos importados e apagados depois; catálogo 104 → 107 → **104**.

**A correção.** `idsJson` (`productCsv.ts`) passou a receber a **frota** e a descartar o id que não
existe nela, reportando na classe **própria** `maquina-etapa-descartada` — não na
`maquina-descartada` da coluna humana, porque o conselho é outro (lá se corrige um NOME na planilha;
aqui um id que o dono apagou do cadastro, dentro de um JSON que ninguém edita à mão) e o desfecho
também: a etapa que fica sem nenhum id **herda o conjunto do produto**, não a frota. Guarda para
frota vazia — sem cadastro não há com quem conferir, e a etapa não pode perder o conjunto por falta
de dado NOSSO.

⚠ **Uma correção ao próprio laudo.** O dano no PREÇO é do descarte **TOTAL**, não do parcial: o
`resolveFleet:57-65` já filtra a lista pelas máquinas VIVAS, então `["x2d","fantasma"]` custa x2d de
qualquer jeito (o fantasma só acende o `missing`). Quem caía na frota inteira era a etapa que ficava
**só** com o fantasma — o caso que o laudo mediu (R$ 37,83 → R$ 34,70) e o que os testes medem.

## As 3 linhas do CSV, e por que são essas

Todas as 10 h de impressão na etapa "Base"; a principal fica com 1 g e 0 h, para o conjunto do
produto não entrar na conta por outro caminho.

| linha | coluna `Maquinas` | `machineIds` da etapa | o que prova |
|---|---|---|---|
| **A fantasma** | `X2D Combo` | `["impressora_que_nao_existe"]` | o caso |
| **B controle** | `X2D Combo` | *ausente* | o destino de quem herda o produto |
| **C frota** | *vazia* | *ausente* | o que a A valia ANTES (frota inteira) |

## Medido

**No diálogo de importação**, no topo, com a linha nomeada:

> ⚠️ 1 linha — Id de impressora dentro de "Etapas JSON" que não existe no cadastro — foi DESCARTADO.
> A etapa que ficar sem nenhum id herda o conjunto do produto (coluna "Maquinas"), e é ele que passa
> a definir a média do preço dessa etapa:
> · Linha 2 ("ZZ AUD17 E6 A fantasma"): Etapas JSON — etapa 2 → machineIds = "impressora_que_nao_existe"

**No catálogo**, depois de importar:

| produto | preço/peça | custo/peça |
|---|---|---|
| A fantasma | **R$ 75,36** | R$ 30,27 |
| B controle | **R$ 75,36** | R$ 30,27 |
| C frota | R$ 48,51 | R$ 21,33 |

**A = B**, e as duas ≠ C. Antes da correção a A valeria o número da C: **R$ 75,36 → R$ 48,51
(−36%)**, calada. É a mesma razão do laudo (−8,3%), ampliada porque aqui *todas* as horas estão na
etapa do fantasma.

O cartão expandido da A fecha a conta por dentro: **"PODE RODAR EM: X2D Combo"** (sem badge de órfão,
sem "frota inteira") e **Desgaste R$ 18,67**, que é `10 h × R$ 1,87/h` — a taxa da X2D publicada na
tabela de frota da `/maquinas`. Pela frota inteira seriam `10 h × R$ 1,08/h = R$ 10,80`.

## Invariantes

**9 novas** em `productCsvIssues.test.ts` — **6 conferidas FALHANDO** contra o `idsJson` antigo
(descarte, parcial, total, preço, contagem por linha, classe separada). As outras 3 são controles
que passam nas duas lógicas de propósito: ids todos vivos, item que nem string é (fica na classe
VELHA), e frota vazia. Suíte: **935/935 ✅** (eram 926).

## Limpeza conferida

Catálogo de volta a **104**, nenhum `ZZ AUD17 E6` em lugar nenhum. Nada além do catálogo foi tocado:
não houve venda, produção nem baixa de estoque.
