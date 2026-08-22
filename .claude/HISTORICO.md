# LopoLabCalc — Histórico & decisões de design

> **Arquivo pesado, lido SÓ sob demanda** — o *porquê* de cada decisão: design do Estoque
> (D1–D8), auditoria (TD-*), e os writeups completos de tudo que já foi **feito** (7a–7c,
> FEAT-01/02/04/05, passo 8, UX-*, DEC-01, bugs). Abra este arquivo quando um item precisar da
> justificativa/detalhe de implementação de algo já concluído.
>
> **Para escolher a PRÓXIMA tarefa, não é aqui** — o que falta fazer vive em
> [`.claude/BACKLOG.md`](BACKLOG.md) (a-fazer, curto). E a foto do AGORA vive no `CLAUDE.md`.
> Referências a "item 3", "FEAT-04", etc. resolvem dentro deste arquivo.

## ✅ CSV-05 — a importação parou de engolir erro em silêncio (2026-08-21)

> Nasceu de uma correção de rumo do dono: ele **não** vai exportar-editar-reimportar. Vai exportar
> só para ver quais são os campos e **gerar o CSV do zero**. Ou seja: o caminho provado no RT-01b
> (arquivo que o próprio app gerou) não é o caminho que ele vai usar.

**O import estava pronto para o arquivo dele mesmo, e cru para um arquivo escrito fora.** Só duas
coisas eram ditas: máquina que não casou e preço/custo divergente (CSV-03) — e esta segunda **fica
desligada** numa planilha do zero, que não traz as colunas calculadas. Todo o resto era silêncio:
JSON quebrado virava lista vazia, coluna com nome errado sumia, arredondamento inválido caía em
`exact`, referência inexistente virava avulso.

**O pior deles era assimétrico** — e foi o que o dono perguntou primeiro, ao ver que o "atalho sem
JSON" não liga no Estoque. Em `resolveFilamentPrices`: `filamentId` **errado** marca `missing` e
rende o badge "⚠ cor removida" no catálogo; `filamentId` **ausente** retorna antes de qualquer
checagem (`if (!f.filamentId) return f`) — é avulso legítimo, e **nada** na tela o distingue de uma
cor ligada. O erro mais provável numa planilha gerada (esquecer o id numa coluna inteira) era
justamente o invisível, e só apareceria na `/producao`, quando a baixa não acontecesse.

**Nove classes, agrupadas por tipo** (a planilha erra em série: 40 linhas sem id são UM recado, não
40) — cada uma com a contagem total e até 3 exemplos, no molde do CSV-03. Nada bloqueia:
`json-invalido` · `arredondamento-invalido` · `markup-invalido` · `cor-avulsa` · `cor-inexistente` ·
`insumo-inexistente` · `etapa-inexistente` (subitem → etapa) · `subitem-inexistente` (acessório →
subitem) · `nome-duplicado` (no arquivo **e** contra o catálogo) · `linha-invalida`. Esta última
roda o **mesmo `validateProduct` do formulário**, que a importação nunca tinha chamado — linha sem
peso e sem tempo entrava como produto de custo zero.

**Coluna de cabeçalho não reconhecida** virou aviso de arquivo (`"Etapas"` em vez de `"Etapas
JSON"`). As 12 colunas calculadas não contam como surpresa — são ignoradas de propósito.

**O que a checagem precisou de fora:** `supplies` e `existingNames` entraram no `CsvParseOptions`
(o `CatalogPage` passou a assinar `useSupplies` só para isso). Sem eles, as checagens
correspondentes simplesmente não rodam — o parsing puro dos testes continua sem dependência.

**Medido no app real** com uma planilha de 7 linhas com defeitos plantados: as 9 classes acenderam,
cada uma na linha certa. E o export do catálogo real reimportado a seco revelou dois números que
valem por si: **84 das 97 linhas têm filamento avulso** (o catálogo está 86% desligado do Estoque) e
**97 nomes repetidos** — a importação nunca substitui, sempre cria.

`lint` ✅ · **455/455** ✅ · `build` ✅

## ✅ RT-01b — re-auditoria independente, e a semente da planilha ficou limpa (2026-08-21)

> Pedido do dono: refazer a auditoria do RT-01 **do zero, por outra cabeça**, tratando cada
> afirmação anterior como hipótese a derrubar — "quem escreveu a mudança é a pior pessoa para julgar
> se ela está certa". Harness próprio, sem reaproveitar `productCsvRoundTrip.test.ts` nem
> `productPayload.test.ts`.

**As 3 mudanças do RT-01/CSV-03 se sustentaram** (`delete base.id`, export normalizado, aviso do
recálculo) — mas **uma afirmação caiu**: reimportar um arquivo recém-exportado **não** dava zero
avisos. Dava 2 em 97 linhas, e o aviso estava certo.

**O defeito que ele apontava era anterior aos 3 commits:** o export montava as etapas de
`product.stages ?? []`, enquanto o preço da MESMA linha vinha de `calculatePricing` →
`normalizeStages`, que migra o `stage2` legado quando `stages` está vazio. Resultado: a linha
afirmava `Etapas (R$) 16,64` ao lado de `Etapas JSON []`. Reimportar derrubava o custo de 35,85 para
10,63 (**3,4×**) — em silêncio, se o CSV-03 não existisse.

**Corrigido no DADO, não no código** (decisão do dono, Diretriz 7): os 2 produtos legados
(`Caixa uno`, `livro torre dados`) foram abertos e salvos no formulário, que migra `stage2 → stages`
e zera `combineEnabled`/`fixedCostPerHour`. Custo idêntico antes/depois. **Zero produto legado
no catálogo** — e, com isso, o export do catálogo (a semente da planilha do recadastro) reimporta
com **nenhum aviso**.

**Uma mudança de código saiu daqui, e é sobre a forma do dado NOVO:** `parseProductsCsv` gravava
`weightG`/`filamentPricePerKg` no produto **mesmo com o `Filamentos JSON` presente**. Todo produto
da carga em massa nasceria com os dois escalares que o formulário parou de persistir — inertes no
custo (por isso ninguém veria) até alguém abrir e salvar. Agora eles entram **só** quando a linha
não traz as cores, que é quando são o peso/preço de verdade (CSV escrito à mão).

**O que foi medido no catálogo real** (97 produtos, via estado do React + export capturado):
- export real: 39.699 bytes, 98 linhas, 34 colunas, **0 ocorrências** de
  `energyTariff`/`laborRate`/`weightG`/`filamentPricePerKg` (A4 confirmada);
- inventário de chaves das 47 etapas: nenhuma chave desconhecida sendo descartada pelo export;
- **P1 (o risco nunca medido):** 85 filamentos, 4 com detalhamento, **todos coerentes**
  (`totalG` == soma) — o recálculo do `makeFilament` não altera nada hoje, e nunca alterou custo
  (o `calculateStageCost` já normalizava antes);
- 15 etapas legadas só com escalares: custo **exatamente** igual depois do export normalizado;
- 26 etapas sem `id` em 14 produtos, nenhum com subitens → RT-02 no BACKLOG;
- 97 linhas pelo fluxo real de importação: parse de poucos ms; o recálculo do CSV-03 não pesa.

**Ciclos A e B provados em dado real**, sem canário e sem depender de preço: 4 documentos reais de
classes diferentes + 1 produto **criado à mão no formulário** (P3, o buraco que a auditoria anterior
admitia) → 0 campos divergentes, custo idêntico com 6–9 casas. Um produto real foi aberto e salvo no
app (`Insert Hitster`): saíram só `energyTariff`/`laborRate` da etapa; todo o resto intacto.

**Duas armadilhas de método que ficaram registradas:** (1) o CSV **não** é byte-a-byte igual na 1ª
volta — mapa do Firestore não preserva ordem de chave, e a comparação exige stringify canônico
(estável a partir da 2ª volta); (2) `saveProduct` usa `updateDoc`, que **mescla** — parar de gravar
um campo não o apaga dos documentos que já o têm (vale para o `id` do RT-01).

**O que continua no escuro:** ninguém leu o **documento cru** do Firestore. Tentei patch de
XHR/fetch, `offline`/`online` para forçar re-listen e o registro de módulos do Turbopack — o cliente
usa cache em memória e nada trafegou. O caminho por token de auth foi recusado.

`lint` ✅ · **442/442** ✅ · `build` ✅

## ✅ CSV-03 — a importação parou de ignorar preço/custo em silêncio (2026-08-21)

> Achado na auditoria RT-01, na pergunta do dono: *"por que o import/export trabalha com valores que
> serão recalculados de qualquer forma?"*

**O CSV tem dois públicos.** Para o dono é um relatório (abre no Excel e mostra onde o dinheiro do
produto está); para o app, 12 das 34 colunas — material, energia, desgaste, manutenção, mão de obra,
etapas, acessórios, reserva de falha, fixo, custo total, preço sugerido e margem — são **calculadas**
e não têm `findColumn`.

**Recalcular é o comportamento certo, e continua.** O preço não é dado do produto: é consequência de
markup, peso, horas, arredondamento e da config da MÁQUINA, que vive num doc compartilhado
(`config/machines`) e pode mudar depois do export. Se a importação confiasse no preço exportado,
bastaria ajustar os watts da A1 para o catálogo voltar com preço velho discordando das próprias
entradas — e sem nada indicando qual dos dois números vale.

**O defeito era o SILÊNCIO.** Quem abrisse o CSV, corrigisse o "Preço Sugerido" e reimportasse não
recebia aviso nenhum: a edição sumia e a pessoa achava que tinha definido o preço. Armadilha real na
carga em massa.

**A correção.** `parseProductsCsv` ganhou um 3º parâmetro OPCIONAL (`{ fixedCosts, stock }`) e, quando
ele vem, recalcula cada linha com a **mesma chamada do export** (`calculatePricing` com as mesmas
máquinas/taxa/estoque) e compara contra o que o arquivo afirma. Divergiu → conta e devolve em
`recalc: { divergentes, comparadas, exemplos }`, que a confirmação da importação mostra antes de
gravar. **Não bloqueia** — mesmo molde do aviso de máquina não reconhecida (TD-009).

**Decisões de escopo:**
- **Só `Preço Sugerido` e `Custo Total`.** São as duas que alguém tentaria editar para "definir" o
  preço; as outras 10 são detalhamento (ninguém mexe no "Desgaste (R$)" esperando mudar o resultado),
  e avisar sobre 12 colunas × N linhas viraria parede de texto.
- **Tolerância de R$ 0,02** — o export grava com 2 casas (`formatDecimal`), então centavo é ruído do
  próprio arredondamento, não edição.
- **Célula vazia/ausente não conta.** Um CSV enxuto escrito à mão não tem essas colunas, e isso é uso
  legítimo — não é divergência.
- **Máximo 3 exemplos**, mas o total conta todas ("6 de 6 linhas").
- **Parâmetro opcional** porque sem a taxa de custo fixo o número literalmente não é comparável.
  Sem ele a checagem não roda (é o caso dos testes de parsing puro).
- `Peso (g)` e `Filamento (R$/kg)` ficaram **de fora**: são inertes quando o `Filamentos JSON` está
  presente, mas ESSENCIAIS num CSV enxuto mono-cor. Avisar sobre elas puniria o uso legítimo.

**Efeito colateral útil:** o aviso também acende quando a configuração (máquina/tarifa/taxa do fixo)
mudou entre o export e o import — que é a outra coisa que o dono quer saber antes de gravar.

**433 → 439 testes.**

## ✅ RT-01 — round-trip auditado campo a campo, e o par virou função pura (2026-08-20)

> **Pedido do dono antes da carga em massa**, com uma regra explícita: **nada de canário**. O teste
> anterior usara o preço sugerido como prova de igualdade e deixara passar o FORM-01 — o `supplyId`
> sumia sem mover um centavo.

**Dois ciclos, porque são caminhos de código diferentes.** Ciclo A = `exportProductsCsv →
parseProductsCsv` (nunca passa pelo formulário). Ciclo B = `loadProduct → buildPayload` (abrir e
salvar sem tocar em nada) — o que produziu o FORM-01.

**Como foi medido.** Uma cobaia exercitando todo campo ao mesmo tempo (2 cores ligadas ao Estoque com
detalhamento model/suporte/purga/torre · 2 etapas extras, uma em outra máquina · 3 acessórios:
ligado a insumo, avulso e atribuído a subitem · `sellBySubitems` on com override de markup em 1 de 2
subitens · todos os escalares fora do padrão · os 3 links · `;` e `"` no nome e em 2 cores), rodada
**no app real contra o Firestore**: export A → import → export B → abrir a cópia e salvar → export C.
Comparação por código, **83 valores por linha** (30 células escalares + 53 folhas dentro das 4
colunas JSON, em profundidade). **Zero divergências em A×B e em B×C.**

**⚠ A armadilha de método.** A primeira rodada acusou 3 colunas divergentes que **não eram perda de
dado** — era **ordem de chave**: o Firestore não preserva ordem de inserção em mapa, então a cópia
volta com as chaves embaralhadas. Comparar o **texto** da célula JSON dá falso positivo; o diff
precisa de **stringify canônico** (chaves ordenadas, arrays na ordem). Quem repetir este teste
precisa disso.

**O quase-defeito que não era.** Ao carregar, o form exibe o preço/kg **vivo** do Estoque (R$ 85,00)
enquanto o documento guarda o salvo (R$ 118,90) — D3/7c. A suspeita era que o save escrevesse o
exibido por cima. **Não escreve.** Teria sido o molde exato do FORM-01: tela ≠ documento, sem aviso.

**As 3 mudanças que saíram:**

1. **`buildPayload` gravava `id` DENTRO do documento.** Ele fazia `{...form.product}`, e depois do
   `loadProduct` esse estado carrega o `id` do `SavedProduct`. O id de um doc é o **caminho** no
   Firestore — `toSavedProduct(item.id, item.data())` nunca lê `data.id` —, então era uma cópia que
   ninguém consulta. Inerte, **exceto em "salvar como novo"**: o doc novo nascia com o `id` do
   produto **ORIGINAL** (o `createdAt` era corrigido pelo spread final, o `id` não). Errado e
   silencioso — qualquer script/migração futura que confiasse em `data.id` mapearia a cópia no
   original. → `delete base.id`. O `createdAt` fica: vem de carona com o **mesmo valor**, no-op.

2. **O export dumpava `product.stages` cru.** Medido no catálogo real: **47 das 51 etapas**, em 24
   produtos, ainda carregam `energyTariff`/`laborRate` legados (0,8/0,9 e 30/31) — lixo inerte que
   o `parseStages` descarta na volta, mas que **saía no CSV**. Passa a exportar **normalizado** (a
   mesma forma que a importação produz), pra planilha da carga em massa ser autoconsistente.
   Varredura confirmou que acessórios, subitens e cores estão **limpos** nos 99 produtos — só as
   etapas tinham lixo.

3. **O par virou função pura e exportada.** `buildLoadedProduct` (em `usePricingForm.ts`) e
   `buildProductPayload` (em `lib/productPayload.ts`). Antes o `buildPayload` era closure dentro do
   componente, e **não dava pra testar sem React** (o projeto não tem testing-library) — o que
   obrigava a testar uma **cópia** do literal, que apodrece calada no dia em que o original ganha um
   campo. Que é exatamente a falha que o teste existe pra pegar. Cobertura nova:
   `productPayload.test.ts` (diff do documento) + `productCsvRoundTrip.test.ts` (34 colunas + bordas).
   **414 → 433 testes.**

**Bordas confirmadas:** `sellBySubitems` on com zero subitens volta ligado · máquina inexistente
**avisa** na tela antes de gravar, não engole · arrays vazios voltam vazios (não ausentes) · escape
de `;` e `"` sobrevive · `energyTariff`/`laborRate` escritos à mão dentro de uma etapa **não** viram
override.

**Não é perda de dado:** `material`/`brand` sumirem de uma cor do produto. Nada nunca os escreveu
lá — só o `StockColorModal` (na COR) e o `freezeFilaments` (no snapshot da VENDA, D7). O produto
guarda só o `filamentId`; guardar cópia criaria uma 2ª fonte da verdade que envelhece.

## ✅ FORM-01 — o formulário parou de comer campo ao salvar (2026-08-20)

> **Continuação do CSV-01, e achado pelo DONO**, não pelo diagnóstico: ao abrir o produto-cobaia na
> calculadora, o acessório aparecia como **avulso**. O CSV estava são; o vazamento era outro.

**Dois caminhos, não um.** O CSV vai `Firestore → export → parser → createProductsBatch → Firestore`
e **nunca passa pelo formulário**. O form é `Firestore → loadProduct → estado → buildPayload →
Firestore`. Por isso o round-trip do CSV passou limpo e ainda assim havia perda.

### Defeito 1 — `supplyId` morria no carregar+salvar
`createAccessory` (`usePricingForm.ts`) remontava o acessório campo a campo e **esquecia o
`supplyId`**. Não era só exibição: `buildPayload` grava `supplyId: accessory.supplyId ?? null`, então
**abrir um produto e salvar sem tocar em nada apagava o vínculo** — provado em produção (o export
saiu com `"supplyId":null`). A produção parava de dar baixa do insumo. Atinge também **Vender /
Produzir / Orçar** do form, que passam pelo `ensureSavedProductId` → mesmo `buildPayload`; ou seja,
"Produzir" destruía justamente o que dá baixa.

**Por que passou despercebido no CSV-01:** a checagem-mestra era o **preço**, e o `supplyId` não move
preço — o `unitPrice` sobrevive. R$ 55,80 continuava R$ 55,80. **Lição: o teste de integridade de um
snapshot é diff CAMPO A CAMPO do documento, não comparação de preço.**

### Defeito 2 (virou remoção) — tarifa/valor-hora por ETAPA
`buildPayload` escrevia o valor do produto em toda etapa, achatando qualquer override. Provado:
produto importado com `energyTariff 2,0`/`laborRate 90` entrou a **R$ 92,38** e virou **R$ 82,96** só
por carregar e salvar.

Mas a auditoria mostrou **quatro módulos discordando** do mesmo campo: o parser do CSV preservava, o
`calculatePricing` honrava (`stage.energyTariff ?? product`), o form destruía, e a **produção
ignorava** (`wholeEventRows` congela a tarifa do produto). Preço e custo real divergiriam por
construção — na comparação que o `CostDetail` existe para mostrar.

**Decisão do dono:** o campo **não deve existir** — não há input para ele. Então em vez de consertar o
achatamento, o override foi **removido** de `PrintStage`, do parser, do cálculo, da validação e do
`stageLabor`. **Medido antes:** dos 29 produtos com etapa extra, **zero** divergiam do valor do
produto → remoção neutra no preço do catálogo inteiro. Docs antigos seguem com as chaves: lixo
inerte, ignorado (Diretriz 7, sem migração). Import que traga tarifa na etapa a **ignora calado**
(decisão do dono — o aviso não pagava o código).

### O que a auditoria NÃO achou (varredura dos outros round-trips)
`toSale`/`saleToDocument` cobrem todos os campos de `Sale` e leem `filaments` crus;
`productionToDocument`↔`toProduction`, `usageToDocument`↔`usageFromDocument`,
`supplyUsageToDocument`↔`...FromDocument` e `moveToDocument`↔`moveFromDocument` são **pares
simétricos** com `filamentId`/`material`/`brand`/`supplyId` preservados; `finishedGoods` idem;
`QuoteItemSnapshot` é `{descrição, qtd, preço}` por design. O `createAccessory` era o fora-da-curva.

Testes: `usePricingForm.test.ts` (novo, 4 casos — a função virou `export` só para isso) + o caso do
`productCsv` que agora exige que a tarifa da etapa seja ignorada + um do `calculatePricing` que fixa
que doc antigo com a chave repetida **não** muda preço. `lint` ✅ · **414/414** ✅ · `build` ✅.

## ✅ CSV-01 — o round-trip do catálogo virou exato (2026-08-20)

> **Pedido como diagnóstico, não como tarefa.** O dono vai recadastrar o catálogo do zero a partir
> de um CSV **gerado fora do app**, e quis provar antes que `exportar → importar` devolve o produto
> íntegro. O momento foi escolhido de propósito: o dado de hoje é descartável (Diretriz 7), então um
> import ruim agora não custa nada — depois do recadastro, custaria.

### O que o diagnóstico achou (round-trip em produção, 2 produtos reais)

**O que JÁ funcionava** — e era a pergunta principal: o **`filamentId` sobrevive**. Confirmado por
três caminhos independentes: a coluna `Filamentos JSON` saiu byte-idêntica; as colunas de custo
recalcularam iguais (cor órfã cairia no preço congelado e mudaria o número); e o form carregou a
cópia com os selects em `PLA · Bege · Bambu` / `PLA · Laranja · Bambu`, na etapa principal **e** na
extra. O `supplyId` idem. **Armadilha de leitura:** `stripFilamentIds` **não** tira o `filamentId` —
tira o `id` de estado do formulário. O nome faz concluir o contrário de quem só lê a chamada.

**O achado que mudou o escopo:** perder os subitens **muda o PREÇO**, não só o modo de venda. No
"Teste 4b produção", custo idêntico (R$ 32,66) e preço **R$ 72,58 → 74,92** (+3,2%), porque as partes
tinham override de markup (`3.2x · 3.0x · 1.9x`) e a cópia caiu no 3,0x liso. "Subitens somem" soa
como perda de *modo de venda*; era perda de *dinheiro*. Foi isso que fez o dono pedir a correção.

### A ordem de dependência que não dá para furar

`subitems[].stageKeys` referencia as etapas por `"main"` (sentinela) + `PrintStage.id`. Se o
`stages[].id` não voltar, **todo subitem importado nasce apontando para o vazio** — pior que não
importar. Por isso o `id` da etapa não é um extra do item: é pré-requisito dele.

E o que **simplificou** a implementação: o export **já escrevia** `stages[].id` e
`accessories[].subitemId` (o JSON é `JSON.stringify` cru do documento). Quem jogava fora era o
**parser**. Então só os subitens precisaram de coluna nova — o resto foi parar de descartar.

### Os 3 defeitos que só o CSV escrito à mão dispara

Nenhum aparecia no round-trip do próprio app, e é exatamente por isso que nunca tinham surgido: o
export escreve número de JS (com **ponto**) e sempre preenche os campos opcionais da etapa.

| # | defeito | como falha |
|---|---|---|
| A | `markup` era o **único** número por `parseFloat`, que **para na vírgula** | `2,8` → **2**. Silencioso: grava o catálogo inteiro precificado abaixo |
| B | `roundingMode` são tokens com ponto (`0.90`) comparados por igualdade | `0,90` → `exact`. Silencioso |
| C | `Number(ausente) \|\| undefined` gravava `undefined` literal | Firestore recusa, `batch.set` é atômico → **o lote inteiro morre**. Barulhento |

Os três são a **mesma causa de fundo**: formato decimal pt-BR. Basta abrir o CSV uma vez no Excel
para ele reescrever as vírgulas — e dois dos três falham calados.

### Decisões de design

- **Colunas novas vão no FIM** (`Vende por Subitens`, `Subitens JSON`). O `findColumn` casa por
  **nome**, não por posição, então CSV exportado antes disto continua importando — sem as colunas o
  produto entra como só-inteiro, o default de sempre. Nenhuma migração.
- **A flag vai SEPARADA do array.** Desligar a venda por subitens não apaga os subitens salvos, então
  "desligado com partes guardadas" é um estado real que inferir de `subitems.length` perderia.
- **Campo opcional ausente é CHAVE AUSENTE, nunca `undefined`** (`...(x > 0 ? { x } : {})`) — o
  mesmo padrão que o `buildPayload` já usava para o markup do subitem. É a lição do defeito C.
- **Máquina que não casa AVISA** em vez de escolher calada (`CsvImportResult.warnings`, mostrado na
  confirmação antes de gravar). Cair na 1ª máquina em silêncio põe o produto na impressora errada, e
  energia/desgaste saem de lá. Mesma disciplina do TD-009/`filamentMissing`.

### Verificação

`productCsv.ts` era o **único parser sem arquivo de teste** (16 `.test.ts` em `lib/`, nenhum para
ele) — e os 3 defeitos são justamente o que um teste de round-trip pega sozinho. Ganhou **19
testes**: round-trip campo a campo de um produto rico (multicolor com cor do estoque + avulsa, 2
etapas extras em máquinas diferentes, acessório com `supplyId` + `subitemId`, subitens com override
de markup, `;` e aspas no texto), um caso por defeito corrigido, o CSV antigo sem as colunas novas, e
uma varredura que **falha se qualquer `undefined` sobrar** no payload. `lint` ✅ · **408/408** ✅ ·
`build` ✅.

## ✅ UX-38 + UX-40 + A11Y-01 — a linha do celular vira cartão (2026-08-18)

> **Os 3 últimos itens do cluster da auditoria de layout.** Os dois primeiros são **a mesma forma de
> problema em telas diferentes**: uma fileira horizontal com mais colunas do que cabem em 375px, em
> que o dado que se quer conferir (ou o alvo que se quer tocar) fica do lado de fora. O terceiro é
> independente e saiu de carona por ser barato.

### UX-38 — o lucro do recibo estava atrás de uma rolagem por venda

**Medido antes (375×812):** tabela de **453px** dentro de um cartão de **345px**. O excedente de
**108px** é exatamente onde moram o **lucro** (faixa de 86px, visível só até a 30ª) e o **excluir**
(401→453px, fora da tela inteiro). Como cada recibo é uma `<table>` própria com o seu scroller
(BUG-06), conferir o lucro exigia **rolar cada venda para o lado, uma por uma** — e o lucro é o
número que se abre a página para ver.

**O achado que corrigiu o próprio item:** a auditoria anotou que a coluna do *custo real* estava
"espremida a zero". Não estava — estava **escondida**. A regra `.recibo-items .ri-cost {display:
none}` morava no **`quote.css`**, o CSS da página de **orçamento** (o mesmo defeito de escopo do
TD-013), e por isso nenhuma busca no arquivo do recibo a encontrava. Escondia porque não cabia.

**A saída:** sete colunas não cabem em 375px — nenhuma repartição faz caber. Então a linha **deixa
de ser linha** e vira cartão de 3 faixas, a mesma receita do `.fg-part` (estoque) e do `.main-row`
(catálogo), com o par que se confere encostado na direita, um sob o outro:

```
▼ Nome do produto                  [excluir 44px]
  material
2×  R$ 33,50                               R$ 33,50
custo real R$ 8,04                         R$ 25,46
```

A grade tem **4 pistas** porque `qtd` e `preço unitário` precisam ficar **colados** — é o
"2× R$ 33,50" que se lê como uma coisa só e dispensa rótulo. As faixas que atravessam a linha (nome,
custo) **cruzam a pista flexível** e por isso não entram no dimensionamento intrínseco das pistas
`auto`: é o que impede um nome comprido de empurrar a coluna do preço. O custo real **volta** (a
regra do `quote.css` não migrou de arquivo: deixou de existir).

**Depois:** rolagem horizontal **108 → 0** (página e cartão), 7 de 7 células visíveis, altura da
linha **102px**, excluir a **44px** (UX-36 — e sem custo de largura: a pista da direita já é
dimensionada pelo lucro, ~86px).

**Três armadilhas de cascata/escopo, todas medidas, nenhuma óbvia:**
1. **Ordem, não especificidade.** O bloco `@media` escrito ANTES de `.recibo-items td` perdia o
   desempate (0,1,1 contra 0,1,1 — `@media` não soma nada) e o recuo de tabela seguia valendo: cada
   faixa ia a **38px** em vez de 21. → o bloco mora no **FIM do arquivo**, com o aviso escrito lá.
2. **`> td`, não `td`.** Dentro do dropdown do UX-06 mora **outra tabela** (a `CostBreakdownTable`
   de precificado × real). O `display: block` descia até as células dela e as duas colunas de número
   viravam uma pilha.
3. **`> tbody`, não `tbody`** — a mesma armadilha, mais sutil: o `<tbody>` da tabela de dentro
   também virava bloco, cada linha remontava uma tabela anônima própria e as colunas paravam de se
   alinhar **entre si** (medido: cabeçalho em 121/96/96px contra corpo em 76/63/62). → **todo**
   seletor de elemento do bloco usa combinador de filho.

De quebra: o ▼ é `inline` e o nome é um `inline-flex` ao lado — com o nome em duas linhas (e no
celular ele fica em duas), a seta sobrava **sozinha numa linha só dela**. Os dois viraram itens de
flex.

### UX-40 — alvo E grade ao mesmo tempo

As 3 ações por **subitem** (vender/produzir/orçar só esta parte) mediam **24×24px**. Crescer sozinhas
era impossível, e a conta é o motivo: medido a 375, a linha tem **297px úteis** e as 4 faixas já os
consomem inteiros — **nome 32 · meta 101 · preço 58 · ações 76**, mais 3 folgas de 10. Ir a 44px pedia
136px de ações: o nome, **já espremido em 32px**, ia a zero.

Por ser alvo **e** grade, a saída é a mesma do UX-38: **a linha vira duas**. Em cima o nome (agora
**151px**, quase 5× o que tinha) e as ações — que é o par que se lê junto, o botão ao lado do que ele
opera; embaixo a meta e o preço, alinhado à direita sob os botões. Botões a **44px** (3×44 + 2 folgas
= 136 numa faixa de 297). A linha do total ("Produto inteiro") não tem ação nem meta, então o preço
**sobe para a 1ª faixa** — sem isso ela gastaria duas linhas para dizer nome + preço.

**No desktop nada muda** (24px, uma linha só) — mesma lógica do UX-36: o painel expandido não tem
faixa sobrando ali. E o `1fr` puro do `catalog.css` ganhou a guarda `minmax(0, …)` que a auditoria de
2026-08-17 tornou regra; a versão do celular **reescreve a linha inteira com a guarda junto**, porque
dentro de `@media` ela não se herda.

### A11Y-01 — `title` não é rótulo

Tema e Sair, no cabeçalho, tinham **só** `title`. Ele é o **último recurso** do cálculo do nome
acessível, não sai em toque nenhum e alguns leitores de tela o ignoram por configuração. E aqui o
caso é pior que o genérico: no celular o `.header-utils-label` **some por CSS** (UX-33), então
sobrava um emoji `aria-hidden` e mais nada. Os dois ganharam `aria-label` — nomeando a **ação**
("mudar para tema claro"), não o estado, e contendo a palavra do rótulo visível do desktop (WCAG
2.5.3). Os botões da `NavBar` (☰, ✕) já tinham o seu; o emoji ☀️/🌙 continua sendo **[DEC-05]**, que
sai junto do rebrand.

### Verificação

Medição no DOM em 375, 700 e 961px, nas duas telas, com o dropdown do recibo aberto. `lint` ✅ ·
**389/389** ✅ · `build` ✅. Efeito colateral registrado: entre **641 e 760px** o custo real volta a
aparecer no recibo (o `col` de 184px já estava reservado, então a rolagem da faixa não mudou — só
deixou de haver uma coluna vazia).

## ✅ UX-36 + UX-37 — alvo de toque e o peso do destrutivo (2026-08-17)

> **Os 2 itens** saíram do cluster da auditoria de layout do mesmo dia. O fio comum: **controle
> importante em alvo pequeno demais**. Decisões do dono nesta rodada: o Excluir ganha **separação
> E cor**, "normalizado com o que aparece no resto do site"; e o **[UX-39] é lixo de teste** que
> some no recadastro (fechado sem código — ver abaixo).

### O que a medição corrigiu no próprio item

O backlog dizia "as 5 ações do catálogo medem **24×24px**". **Medido no DOM, elas medem 32×32** —
os 24px são de OUTRO grupo, os 3 ícones por subitem (`.sp-actions`), que ficam no mesmo painel
expandido. A auditoria juntou as duas fileiras numa frase só. Os 32px vieram do UX-15 e continuam
abaixo dos 44px, então o item vale — só não pela largura que estava escrita.

### UX-36 — o alvo cresce onde é dedo, não onde é ponteiro

| Onde | Antes | Depois | Por quê |
|---|---|---|---|
| Celular (`.main-row.open td.col-actions`) | 32×32 | **44×44** | Cabe: a faixa mede **317px** e 5×44 + 4 folgas de 8 + o divisor pedem **265px**. E é a **única** forma de agir sobre o produto ali — a linha fechada esconde a coluna inteira |
| Desktop (`td.col-actions`) | 32×32 | **32×32** (fica) | "Ações" é pista **FIXA de 196px**; 5×44 pediriam ~250px, e os 54px sairiam das faixas flexíveis que a **826px já estão no piso** (sobram 33px na linha). Crescer aqui reabriria o corte que o UX-21 fechou |

**O Excluir sai do repouso neutro.** O UX-25 acertou o diagnóstico — **cinco** cores não
hierarquizam nada — mas **uma** hierarquiza. Agora ele usa o vocabulário que a página inteira já
tem para "cuidado", o do `.btn.danger`: `--danger` + `--danger-soft` + `--danger-line`, com
`--danger-tint` no hover. **Vale no app inteiro** (as 9 telas com `.icon-button.danger` excluem
algo); os outros quatro seguem neutros, então a fileira continua parecendo uma fileira.

⚠ O contorno é `box-shadow: inset`, **não** `border` — 1px de borda somaria 2px à caixa e o ícone
pularia de tamanho no meio da fileira (mesma razão do UX-32).

**Medido — 375×812, linha aberta:** os 5 botões em **44×44** · folga Editar→Excluir **29px** contra
**8px** entre os demais · `scrollWidth 375 = clientWidth` (sem rolagem lateral). **1280×900:**
botões **32×32**, pistas **idênticas** (`259,9 / 119,1 / 65 / 108,3 / 75,8 / 130 / 196px`), linha
em **62px** — zero regressão.
**Contraste do Excluir sobre o fundo composto** (transições mortas antes de ler): claro
`rgb(198,40,40)` sobre `rgb(249,234,234)` = **4,81** · escuro `rgb(232,96,96)` sobre
`rgb(47,33,51)` = **4,53**. Passa o AA de texto nos dois — e ícone é objeto gráfico, que pede 3.

### UX-37 — o gatilho da composição, pela receita do UX-28

`.cost-detail-trigger` media **15–17px**: metade do alvo, num controle que abre a composição inteira
do custo. Cresceu pela **mesma receita do UX-28** (`.link-button`) — o alvo sobe, a caixa no fluxo
não: `padding-block: 8px` + `margin-block: -8px` + `min-height: 32px`.

⚠ **Por que não virou `inline-flex`** (que seria o jeito óbvio de centralizar): o conteúdo é texto +
`<strong>` + `<span>` com **espaços significativos** entre eles; em flex cada um vira item próprio e
os espaços somem — o rótulo colaria no número.

**Medido:** `/estoque` **15 → 32px** (linha-mãe `.sales-total-sub` segue em **16px**) · `/producao`
**17 → 33px** (`.prod-summary-line` segue em **17px**) · SaleModal **→ 32px**. O texto do gatilho
continua com os espaços (`"custo real gasto R$ 10,88 · composição ▾"`).
**Sondagem de sobreposição** (`elementFromPoint` nas bordas): a 4px acima e abaixo do alvo só há
`div` não-interativo (`.prod-summary`/`.prod-note`, `strong`/`.sales-total-card`, `.cesta-item`) —
**o alvo maior não rouba clique de vizinho**.

### UX-39 — fechado sem código

O dono confirmou: os "coffee prank coffee part" ×4 e "Arraia Flexível" ×2 são **lixo de teste**, e
somem no recadastro (Diretriz 7). Nada a desempatar no seletor.

### O achado que ficou aberto

Os **24px dos `.sp-actions`** (as 3 ações por subitem) **não** foram tocados: a 375px a linha já
está espremida — o nome do subitem ocupa **37,6px** de 297px úteis — e crescer os ícones de 76 para
136px o mataria de vez. É alvo **e** grade ao mesmo tempo, então virou item próprio: **[UX-40]** no
backlog.

**Verificação:** `lint` ✅ · `test` **389/389** ✅ · `build` ✅ · medições acima nos dois temas.

## 🔍 Auditoria de layout responsivo (2026-08-17) — o LEVANTAMENTO + os 4 consertos

> **Gatilho:** o dono mandou um print do `/estoque` → aba Produtos, no celular: num produto com mais
> de um subitem, o nome da peça aparecia **quebrado letra por letra, na vertical**. O pedido foi uma
> auditoria nova do site inteiro — "tudo que dá pra abrir, interagir" — porque uma falha assim
> sugeria outras iguais.

**Método:** servidor local, dados reais, **medição no DOM** (não olhômetro). Um auditor injetado
varreu cada rota classificando 5 sintomas — `W-ZERO` (elemento com texto e 0px de largura),
`ESMAGADO` (largura < 40px e altura > 2,2× a largura), `ESTOURA` (borda direita além da viewport),
`CORTADO` (`scrollWidth > clientWidth` sem `overflow` declarado) e `ALVO-MINI` (< 28px). Rodou nas
**7 rotas**, em **375px e 1280px**, com os acordeões abertos **um a um** (o do `/estoque` é
exclusivo: abrir o segundo fecha o primeiro, então varrer "tudo aberto" não enxerga nada).
Depois, um segundo passe mediu **contraste WCAG** de todo texto folha, compondo o fundo real camada
a camada (alfa incluído) e **matando `transition` antes de ler**, conforme a regra do `CLAUDE.md`.

### A causa raiz — uma só, em três lugares: `1fr` sem `minmax(0, …)`

O mínimo implícito de `1fr` é `auto`, ou seja, o **min-content** da célula. Quando a célula guarda
algo que não quebra — um `<select>` cujas options são longas, um `<input type="date">` (widget
nativo de largura fixa) — a coluna **cresce além do container** em vez de encolher.

| # | Onde | Sintoma medido | Conserto |
|---|---|---|---|
| 1 | `stock.css` `.fg-part` | Coluna do nome a **0px**, linha de **80 a 294px** de altura | Media query < 620px: a linha vira **duas** (nome em cima; saldo/custo/ação embaixo) |
| 2 | `responsive.css` `.grid` | Home **rolava 14px de lado** a 375px, no carregamento limpo. Trilha da grade a **374,9px** dentro de 347px — piso vindo do `<select>` de cor (min-content 200px) | `1fr` → `minmax(0, 1fr)` |
| 3 | `forms.css` `.two-col` | `input[type=date]` (177px intrínsecos) tomava a linha: no SaleModal o par virava **119px + 177px** (placeholder "Nome do cliente" cortado); a `/producao` rolava de lado | `1fr 1fr` → `minmax(0,1fr) minmax(0,1fr)` + `min-width: 0` no date |
| 4 | `forms.css` / `responsive.css` | Canal × Forma de pagamento **15px fora de linha** (rótulo de 2 linhas empurra o select); e o date a **38px** contra 42px do vizinho no celular | `align-items: end` no `.two-col`; e a compensação do UX-22 recalibrada sobre o recuo de 10px da faixa móvel |

⚠ **O caso 2 é o mais instrutivo:** o `forms.css:3` **já declarava** `minmax(0, 1fr)` na versão de
desktop. A guarda se perdia no override do `responsive.css`, ou seja, **exatamente onde o espaço é
apertado e ela importa**. Ao sobrescrever `grid-template-columns` numa media query, reescreva a
guarda junto — ela não é herdada.

⚠ **O caso 4 tem a mesma forma:** o UX-22 devolvia 1px por lado ao controle de data assumindo o
recuo base de **8px**; no celular o `.field-input` sobe pra 10px e o seletor do date, mais
específico, continuava em 7px. **Compensação calibrada sobre um token tem de acompanhar o token.**

### Medições — antes → depois

| Item | Antes | Depois |
|---|---|---|
| `.fg-part-name` (largura / altura) | **0px / 80–294px** | **313px / 16px** |
| Linha da peça (altura) | 80px | **62px** |
| Home a 375px (`scrollWidth`) | **389px** (rola de lado) | **375px** |
| Trilha da `.grid` no celular | 374,9px em 347px | **347px** |
| SaleModal — par Cliente/Data | 119px + 177px | **138px + 138px** |
| SaleModal — Canal × Pagamento (topo dos selects) | 318px × 333px | **333px × 333px** |
| Campo de data no celular (altura) | 38px | **42px** (= o vizinho) |

**Cards do `/estoque` varridos um a um: 15/15 sem achado.** `lint` ✅ · **389/389** ✅ · `build` ✅.
Sem regressão em desktop: `/orcamento` manteve os dois cartões na mesma altura e no mesmo `y`
(UX-22 intacto), e todos os `.two-col` da calculadora seguem em colunas iguais (307/307).

### O que a auditoria descartou (para não voltar como achado novo)

- **`mm/dd/yyyy` nos campos de data** — é o locale do NAVEGADOR de teste (`navigator.language` =
  `en-US`), não do código: o `<html lang>` está correto em `pt-BR`. No Chrome pt-BR do dono sai
  `dd/mm/aaaa`.
- **Círculo escuro com "N" no canto inferior** — overlay de desenvolvimento do Next; não existe em
  produção.
- **Nomes com reticências no `/catalogo`** — é o UX-21 funcionando (faixa de nome trunca, faixa de
  número tem piso).
- **Rolagem horizontal da tabela de recibo em `/vendas`** — é a "válvula" `min-width` prevista no
  `CLAUDE.md`. Continua **aberto como leitura ruim no celular** (ver `BACKLOG.md`), não como bug.
- **Contraste** — **zero** falhas WCAG AA nos dois temas, em todas as telas medidas. O TD-014 e o
  UX-19 se sustentaram sob medição independente.

## ✅ [micro] O botão do celular volta a 14px (2026-08-17)

> Resíduo do UX-17b, fora de qualquer onda: lá, **campo e botão** subiram pra 16px no celular. O
> campo **precisa** (abaixo de 16px o iOS dá zoom ao focar); o botão só acompanhou "pra não
> destoar do campo ao lado". **Martelo do dono (2026-08-17): 14px.**

**A mudança é uma remoção:** o `.btn` do `responsive.css` perdeu a linha `font-size` e volta a
herdar o `--text-lg` (14px) do `forms.css` — o `padding` continua igual. O comentário do bloco foi
reescrito pra registrar que o campo sobe **sozinho**, e por quê.

**Medido no DOM (375px, tema escuro, servidor local, `transition` morta antes de ler — sem isso a
leitura pega a fonte no meio da animação do `transition: all` do `.btn` e mede 14px mesmo com
`!important` inline):**

| Botão | Antes | Depois |
|---|---|---|
| `Salvar` (calculadora) | 48px | **45px** |
| `Registrar produção` | 48px | **45px** |
| `Carregar mais …` (/vendas, /producao) | 50px | **47px** |

Página inteira: `/` −7px · `/producao` −6px · `/vendas` −3px. **Bem menos que os +57/+70px que o
UX-17b tinha somado** — aquele ganho era quase todo do CAMPO (há muitos por tela), não do botão,
que aparece 1–2 vezes por rota. O item valia pela coerência, não pelo pixel.

⚠ **Alvo de toque preservado:** o menor ficou em **45px**, acima do mínimo de 44px do UX-30.

ℹ️ **Não afetados** (e nunca estiveram em 16px): os três `.btn.btn-secondary` do card de resultado
(`Vender`/`Produzir`/`Orçar`) medem **34px** com fonte 13px — quem manda neles é uma regra mais
específica, que sempre venceu o `.btn` do `responsive.css`. Ficam **abaixo dos 44px**; é anterior a
esta mudança e não foi tocado aqui.

**Verificação:** `lint` ✅ · `test` **389/389** ✅ · `build` ✅ · medição no DOM acima.

## ✅ Onda 5 do backlog — matemática e leitura (2026-08-17) — **a ÚLTIMA da fila**

> **Os 3 itens:** `UX-26` (a matemática das barras de custo) · `TD-016` (o ritmo de lucro do ROI) ·
> `UX-34` (a ressalva do payback). O fio comum: **número que engana o olho** — nos três, o dado
> estava certo e a APRESENTAÇÃO dele respondia outra pergunta.
> **Decisões do dono nesta rodada:** UX-26 vira **barra empilhada 100%** (o desenho do `/estoque`),
> mas com a legenda mostrando **R$ e %** — não só a % · TD-016 usa janela de **90 dias** · UX-34
> vira **`<details>` fechado**, não ícone com dica.

### UX-26 — a barra mentia porque a régua era o maior item

**O estado:** `maxValue = Math.max(...items)` — o MAIOR custo sempre desenhava barra inteira.
Medido no cenário base (custo total R$ 12,48): mão de obra R$ 5,00 desenhava **100%** sendo **40%**;
material R$ 4,40 desenhava **88%** sendo **35%**. Como o bloco termina em "Custo total", o olho lia
fatia do total. A parte de COR já tinha saído na onda 2 (`--cost-*`); sobrou a régua.

**O que mudou:** as 8 categorias somam **exatamente** `result.totalCost` (`stagesCost` é subtotal
informativo, já dobrado dentro das categorias) — então empilhar sobre o total é exato, não
aproximação. As 8 barras viraram **uma faixa empilhada** com legenda `● Material R$ 4,40 35%`.
Medido no DOM depois: material **109,3px de 310** = 35,3% e mão de obra **124,2 de 310** = 40,1%.

**A reutilização que o item destravou:** o `/estoque` já desenhava esse mesmo conceito
(`.fg-comp`, faixa `flex-grow` proporcional) desde o FEAT-06 — o TD-014 tinha unificado a PALETA e
deixado dois DESENHOS. O `.fg-comp` virou o componente **`CostStack`** (exportado do `CostBars.tsx`)
e o CSS virou `.cost-stack*` no `sections.css`, com as duas chaves que faltavam (`failure`,
`fixed`). O `StockPage` passou a consumi-lo **sem `showValue`** — a aba Produtos ficou pixel a pixel
igual (conferido: legenda "Material 33% … Desgaste 50%", 6 segmentos, `.cost-stack-val` = 0).
O bloco `.hbar-*` foi **removido**.

**Altura (com margens, medida no DOM):** desktop **120px → 108px**; celular 375 **120px → 90px**.
A economia é modesta porque o card do resultado é estreito e a legenda quebra em 3 linhas — o ganho
do item é a **honestidade da largura**, não a tela.

### TD-016 — o ritmo respondia "quanto rendeu", não "quanto rende"

**O estado:** `profitPerMonth = lucro ÷ (agora − 1ª venda)` — média de vida inteira. Um mês forte
seguido de período parado fazia a média **decair sozinha**, e a projeção de payback afastar a data.

**O que mudou:** janela móvel de **90 dias** (e não 60: no volume de vendas de hoje, a janela curta
deixa um mês vazio zerar a projeção). Só o RITMO usa a janela — `profit`, `revenue`,
`paybackFraction`, `surplus` e `remaining` continuam acumulados de vida inteira, porque é o
acumulado que paga a máquina. Dois detalhes que o desenho exigiu:
- **A janela encurta quando o histórico é menor que ela** (`min(elapsed, 90d)`) — senão uma máquina
  com 30 dias de vida teria o ritmo diluído por 3 meses que não existiram.
- **Ritmo 0 é resposta legítima**, não ausência de dado: máquina lucrativa mas parada há mais de 90
  dias mostra `R$ 0,00/mês` e **nenhuma data**. Isso criou uma 2ª causa para "sem projeção", e a
  frase do cartão distingue as duas (histórico curto × parada) — dizer "junte 2 semanas" para quem
  já tem 8 meses de histórico seria mentira.
- O KPI virou **"Ritmo (90d)"**, com o número saindo de `recentWindowDays` (a UI não crava "90").

**Nos dados de hoje o número não mudou** — e isso é o esperado: as vendas de teste têm ~36 dias de
histórico, ou seja **tudo cabe dentro da janela** e ela encurta para o histórico. Quem prova o
comportamento são os 3 testes novos (venda fora da janela ignorada · máquina parada → ritmo 0 sem
projeção · histórico curto divide pelo histórico). **389/389.**

### UX-34 — a ressalva ocupava mais tela que o dado

O UX-09 pôs o aviso do payback em 3 pontos **de propósito**, e funcionou. O efeito colateral era o
do topo: um parágrafo antes do 1º cartão. Virou `<details>` fechado, no mesmo padrão do
`.result-advanced`/`.stock-spent` (marcador nativo fora, chevron lucide que gira). **`<details>` e
não dica por hover** porque hover não existe no toque — e é justamente no celular que a caixa doía.
Os outros 2 pontos (sub-linha do KPI e a linha italic por cartão) **não foram tocados**.

**Medido no DOM:** desktop **36px → 18px**; celular 375 **108px → 36px** (6 linhas → 2). Aberto,
60px. Foco por teclado confere: Tab chega no `summary` logo depois da navegação e ele casa
`:focus-visible` com `outline: 2px solid rgb(255,107,53)` + offset 2px (UX-31, sem nada declarado).

### Verificação

`lint` ✅ · **389/389** ✅ (386 + 3 do TD-016) · `build` ✅. No navegador, com dado real e nos dois
temas: `/` (soma das % fecha com o "Custo total" logo abaixo) · `/catalogo` (faixa dentro do
`.cd-cost`, 423px de 423px — sem estouro; material 63% = R$ 7,04 de R$ 11,21) · `/estoque` aba
Produtos (idêntica) · `/maquinas` (`<details>` abre/fecha por clique e por teclado; "Ritmo (90d)").
375×812 sem rolagem horizontal.

## ✅ Onda 4 do backlog — sistema (2026-08-17)

> **Os 5 itens + 1 de carona:** `TD-015` (casca de modal) · `UX-29` (semântica) · `UX-31` (foco) ·
> `UX-28` (alvo de toque) · `UX-32` (primário desabilitado) · `UX-35` (contraste, que não estava
> em onda nenhuma). O fio comum: **em todos, o padrão certo já existia em algum canto do app e
> nunca tinha sido propagado.**
> **Decisões do dono nesta rodada:** a onda inteira, em **2 pushes** (TD-015 sozinho, depois o
> resto) · o UX-32 vira **contorno + linha do que falta** (e não só o conserto de contraste) · o
> UX-35 **entra junto**, no mesmo trabalho de cor.

### TD-015 — a casca de modal (push 1)

**O estado:** 8 dos 9 modais eram `<div>` sobre `<div>` — sem `role="dialog"`, sem `aria-modal`,
sem nome acessível, sem Escape, sem ✕, e nenhum travava a rolagem do fundo. O padrão certo estava
escrito em dois lugares e nunca saiu de lá: o `ConfirmDialog` (UX-15) já fazia papel/Escape/foco,
e a gaveta da nav (UX-14) já travava o fundo.

**O que entrou:** `Modal.tsx`. Papel + `aria-modal` + `aria-labelledby` (id do `useId`), Escape,
trava de rolagem **com salvar-e-restaurar** do `overflow` anterior (copiado da gaveta — zerar
direto destravaria a página que ela quer travada), foco inicial no primeiro focável do **corpo**
(não do box: o primeiro nó do box é o ✕) com o ✕ de reserva, armadilha de Tab consultada **no
momento da tecla** (o corpo do SaleModal muda de tamanho conforme a cesta cresce), e o ✕.

**A grade de 3 faixas.** O `overflow-y: auto` estava no `.modal-box` inteiro, então os botões
rolavam junto do formulário. `grid-template-rows: auto 1fr auto` + `min-height: 0` no corpo:
cabeçalho e rodapé param de rolar. **Medido no `SaleModal` em edição, a 1280×900:** o corpo pede
**812px** e mostra **580** — rola por dentro — e o rodapé fica em **745–832** numa viewport de
**900**. A 375×812, rodapé em **656–750**, sem rolagem horizontal.

O `ConfirmDialog` virou consumidor e ficou só com o que é decisão do UX-15: a ordem dos botões e o
foco no *Cancelar*. É por causa dele que o `Modal` aceita `initialFocusRef` — no resto do app o
foco vai pro primeiro controle, que ali seria o botão que APAGA.

**Verificado nos 9:** 1 `role="dialog"` por modal aberto, nome acessível igual ao título,
`body.style.overflow` travado e **restaurado** no Escape, ✕ presente, rodapé acima da dobra.

### UX-29 — o documento ganha sumário e marcos (push 2)

⚠ **Duas correções ao achado da auditoria (F3):** o **`<nav>` JÁ EXISTIA** (`NavBar.tsx:55`, com
`aria-label`) — o levantamento errou nesse ponto. E o `/catalogo` **já tinha** `h2` + 93 `h3`
(`.cd-product-name`) corretamente aninhados; o "h3 10×, todos `.modal-title`" era a contagem com
um modal aberto, não o estado da rota.

**O que faltava de verdade e entrou:** `<header>` (o `div.header` do `PageHeader` — um arquivo só,
porque o UX-33 já unificou as 7 cópias) · **skip-link** no `layout.tsx` apontando pro
`<main id="conteudo">` das 7 rotas (medido: é o **primeiro focável** da página; sem ele o teclado
atravessava as 7 abas + 2 utilitários em toda troca de rota) · e os títulos de seção viraram
`<h2>`: **calculadora 0 → 5**, **/orcamento 0 → 4**, **/vendas 0 → 1**. O `.modal-title` desceu de
`h3` para `h2` — era ele o salto h1→h3, e dentro de um `role="dialog"` é o heading do topo.

**O mecanismo do "zero pixel":** um reset no `base.css` (`h1..h4 { font-size: inherit;
font-weight: inherit; margin: 0 }`). Sem ele o `<h2>` traria a margem de `0.83em` do navegador.
Quem manda no tamanho continua sendo a classe — que já mandava quando o elemento era `<div>`.
**Medido:** todos os headings novos com `margin 0px/0px` e a fonte da classe (12px/600 etc.).
Junto veio a higiene do TD-013: o `h1 { }` **cru** que morava no `header.css` (regra de elemento
global no CSS de uma área) virou `.header h1`.

**O que NÃO foi promovido, de propósito:** as linhas de lista (`.stock-title` do /estoque,
`.roi-title` do /maquinas, `.prod-card` do /producao). São dezenas por página: virariam ruído no
sumário em vez de estrutura. Essas 3 rotas ficam com `h1` só — o que é um documento plano, não um
salto. E a **marca continua sendo o `<h1>` da calculadora**: trocá-la pelo nome da rota mudaria a
identidade da home, e `<h1>` = nome do site é correto numa página inicial.

### UX-31 — o foco vira sistema

Token novo `--focus-ring` no `base.css` (próprio, e não `var(--accent)` direto: o anel tem de
aparecer sobre qualquer superfície, e a marca não tem essa obrigação — o rebrand pode precisar
separá-los). Regra `:focus-visible` global, **sem `border-radius`** (cada controle já tem o seu;
um raio comum deformaria o anel do `.btn` e do `.icon-button`). Os dois focos que já existiam
(`.back-to-top`, `.brand-reset`) passaram a consumir o token.

⚠ **A armadilha que a verificação pegou:** a devolução do anel aos campos **não pode morar no
`base.css`**. `.field-input:focus` e `.field-input:focus-visible` têm a MESMA especificidade
(0,2,0) — quem vence é a ordem dos `@import`, e o `base.css` é o primeiro. Medido: com a regra lá,
o campo focado por Tab lia `outline: none`. A correção ficou **colada em cada `outline: none`**,
no arquivo dele (`forms.css`, `fees.css`, `sections.css`). Depois: campo focado por Tab lê
`outline: rgb(255,107,53) solid 2px` **e** a borda laranja — os dois indicadores juntos.

### UX-28 · UX-32 · UX-35

**UX-28 (alvo).** `min-height: 32px` no `.link-button` + `margin-block: -8px` — o alvo cresce, a
caixa no fluxo não. Sem a margem negativa o `.section-head` de cada seção subiria de ~16px para
32px só porque o botão ao lado do título ficou mais alto. **Medido a 375×812:** "Gerenciar"
`79×15 → 79×32`, "detalhar refugo" `286×15 → 287×32`, `.section-head` do "Máquina" segue em 16px.
⚠ **O que mudou de verdade:** `.link-button.bordered`/`.add-line` **crescem 2px** (30 → 32) — eles
são caixas visíveis e devem crescer mesmo.

**UX-32 (desabilitado).** Contorno em vez de preenchimento. O contorno é `box-shadow: inset`, e
**não** `border`: 1.5px de borda somaria 3px à altura e o botão **pularia** no instante em que o
formulário fica válido. **Medido:** contraste `4,43 → 5,61` no tema claro, e altura **41 → 41** ao
digitar o nome (não pula). A linha do que falta entrou nas 3 rotas: *"dê um nome ao produto para
salvar"* · *"adicione ao menos um item para gerar o PDF"* · *"escolha o que foi impresso para
registrar"* — só quando é FALTA; `saving` não conta, porque o próprio rótulo já diz "Gerando...".

**UX-35 (contraste).** O `--danger-rgb` do tema escuro era `224, 82, 82` = **4,47** contra 4,5 —
e o `base.css` documentava esse 0,03 como aceito de propósito, herdado do UX-19. Subiu para
`232, 96, 96`: **5,10** no card sólido (na faixa do claro, 5,38/5,62) e **4,79** sobre o
tingimento, que a auditoria não tinha medido e também passava raspando.

**Varredura final:** 7 rotas × 2 temas, com `*{transition:none}` injetado e reflow forçado antes
de ler (sem isso a leitura pega a cor no meio da transição do `body` e inventa reprovação) →
**zero elemento reprovando AA**. `lint` ✅ · **386/386** ✅ · `build` ✅.

## ✅ Onda 3 do backlog — grade e alinhamento (2026-08-16)

> **Os 4 itens:** `UX-21` (o resto — uma grade só nas listas) · `UX-22` (linha de base do
> /orcamento) · `UX-23` (`PageIntro`) · `UX-33` (hierarquia de navegação + `PageHeader`).
> É o bloco que o dono viu com os próprios olhos — *"textos descentralizados"*.
> **Decisões dele nesta rodada:** o UX-33 vai **completo** (inclui extrair o `PageHeader` e subir
> Escuro/Sair) · o UX-23 **não inventa texto** para /catalogo e /vendas · o UX-22 resolve com
> **rótulo visível**, não com compensação de CSS.

### UX-21 — as listas não tinham UMA grade só

**(a) Catálogo, a deriva.** Cabeçalho e linhas eram duas grades independentes: o `thead tr` tinha
recuo de **20px**, a `.main-row` tem **16px + 1px de borda = 17px efetivos**. Os 3px de cada lado
viravam 6px de largura útil a mais no cabeçalho e, como as faixas são `fr`, a diferença se
redistribuía e acumulava até "AÇÕES". O cabeçalho passou a `calc(var(--space-16) + 1px)`.
**Medido depois, a 1280 e a 826:** `left` de cada `th` contra o `td` correspondente → **deriva 0
nas 7 colunas** (não "1px": zero).

**(b) Catálogo, o número cortado — pior do que a auditoria tinha visto.** A auditoria registrou a
coluna de preço transbordando. Medido no DOM com os 93 produtos a **826px de viewport (737px de
largura útil)**, o `overflow: hidden` do `.main-row td` cortava:

| Coluna | Faixa | Linhas cortadas |
|---|---|---|
| Margem | 52,78px | **93 de 93** |
| Máquina | 77px | 13 |
| Preço/peça | 70,58px | 9 |
| Custo/peça | 75,98px | 1 |

**A descoberta que mudou o conserto:** em 4 colunas quem define a largura mínima é o **RÓTULO**, não
o dado — "Custo/peça" mede **93px** de cabeçalho contra 88,4px do maior valor. E o `th` **não** tem
`overflow: hidden`: sem piso ele não cortava, **invadia o vizinho**. Por isso os pisos são
`max(rótulo, conteúdo)` medidos, e não "o maior número + folga".

O critério do que ganha piso: **um número cortado vira outro número** (`R$ 617,90` → `R$ 617,9`),
então coluna de valor tem piso obrigatório; **nome e máquina continuam com reticências**, porque
nome cortado continua sendo o nome. A rolagem horizontal voltou ao `.table-scroll` como *válvula*:
`min-width: 740px` = a soma das faixas + folgas + recuo. Acima disso nada rola e o desktop é
idêntico ao de antes (medido a 1280: as 7 faixas com os MESMOS valores de antes da mudança).
**Depois: zero número cortado nas duas larguras.**

**(c) /vendas, cada recibo com colunas próprias.** Cada recibo é uma `<table>` independente em
layout automático → as colunas se dimensionavam pelo nome mais longo *daquele* recibo. A auditoria
mediu 8px entre dois vizinhos; **medido com os 23 recibos na tela, o desalinhamento chega a 39px**.
Conserto: `table-layout: fixed` + `<colgroup>` — a mesma receita que a `.cost-detail-table` já usava
no próprio arquivo. **Depois: spread 0,00 nas 7 colunas.** No celular (≤640px) o recibo volta ao
layout automático: ali a comparação entre recibos não acontece (cabe um por tela) e a grade fixa
custaria ~450px de rolagem contra os ~126px de hoje.

### UX-22 — os dois cartões do /orcamento

Duas causas, não uma. **(1)** O 1º campo da esquerda ("Nome do negócio") era o único da tela **sem
rótulo visível** — só `aria-label` — enquanto o da direita começa com rótulo: daí o Δ15. **(2)** Os
dois cartões tinham **duas réguas verticais** para o mesmo tipo de conteúdo: `.field-block.compact`
= 12px contra `.two-col` = 20px. Corrigido na régua (um valor para os dois seletores, escopado ao
/orcamento porque `.two-col` é compartilhado com a calculadora, o SaleModal e a /producao), e não
empurrando um cartão com número fixo.

**(3) O campo de data.** Media 37px contra 35px do vizinho: o Chrome dá 18px de conteúdo ao
`::-webkit-datetime-edit` onde o texto recebe 16. `line-height` **não resolve** (testado: 36 contra
34 — a diferença sobrevive). Como o `box-sizing` é `border-box`, devolver 1px em cada lado do recuo
vertical dá os 35px exatos. Vale para os **9** `type="date"` do app, todos em `.field-input`.

**Medido depois:** topo dos campos — esquerda `[67, 133, 199]`, direita `[67, 133]` → **Δ0** nas
duas linhas compartilhadas (era Δ15 e Δ35). Alturas: `text`, `number` e `date` **todas 35px**.

### UX-23 — `PageIntro`

Eram **seis** introduções (a auditoria contou 4 tratamentos; a 5ª e a 6ª estavam nas abas do
estoque) com três CSS diferentes: `.subtitle` (14px/560px), `.stock-intro` (**12px**/640px, e
espremido ao lado do botão dentro da `.stock-bar`), `.roi-note`. Viraram um componente com **uma**
medida de linha (`70ch`), uma posição e um espaçamento. **Medido: `max-width` computada de
618,2px, idêntica nas 6.**

Duas consequências registradas: no /estoque a `.stock-bar` ficou só com a ação (numa das duas
ocorrências ela não tinha nem botão — era invólucro só para carregar o parágrafo); e a regra do
UX-14 que escondia o texto no celular valia só para a calculadora porque só ela tinha `.subtitle`
— com o componente, ela passa a valer para as 6. É o mesmo conteúdo pelo mesmo motivo (o texto do
/estoque tinha 4 linhas), e reverter é uma regra só.
**/catalogo e /vendas seguem sem introdução** — decisão do dono: texto de produto é a voz dele.

### UX-33 — os dois níveis de navegação

**(a) Hierarquia.** O UX-17b deixou as abas do estoque byte a byte iguais às da NavBar: resolveu o
*estilo* e criou um problema de *hierarquia*. A resposta não foi voltar a dois estilos, e sim
**mesma família com pesos diferentes** — a NavBar mantém o chip **preenchido**
(`--chip-active-bg`), a aba interna fica só com contorno e letra em accent. O terceiro paradigma (o
segmentado de desconto do `SaleModal`) **não entrou**: é controle de formulário, não navegação —
fica registrado em comentário para não voltar como achado novo.

**(b) `PageHeader`.** O bloco `.header` estava **copiado em 7 arquivos**, junto com o mapa
`statusLabel`, variando só em título, meta, ícone e presença do chip de status. Virou um componente
com `{title, meta, status?, icon?, theme, onToggleTheme}`. O `Header.tsx` da calculadora virou
invólucro fino (o que sobrou de próprio é o título ser o botão da marca).

**(c) A faixa de utilitários.** "Escuro" e "Sair" saíram da `.navbar-utils` para a linha do título.
**Medido:** a 1024 de viewport a `.navbar-bar` tinha **98px** e passou a **53px** — **45px** de
faixa devolvidos em toda página (a auditoria estimou "~40px"). ⚠ **A 1280 a economia é 0** — ali os
7 destinos + 2 utilitários já cabiam numa linha; o ganho é da faixa 761–1100, e a 1280 o que muda é
só a hierarquia. No celular os dois viram ícone puro de 40px e se juntam ao ☰ no canto (o rótulo
sai por CSS, não por renderização condicional, para não haver dois nós disputando a ordem de
tabulação); a reserva do `.header` subiu de 52px para 144px. **Medido a 375×812 com o título mais
longo:** sem colisão brand↔utils, sem sobreposição utils↔☰, 8px entre eles, 43px de folga abaixo,
rolagem horizontal 0.

### Verificação e as duas ressalvas honestas

`pnpm lint` ✅ · `pnpm test` **386/386** ✅ · `pnpm build` ✅.

**Varredura de contraste (não-regressão da onda 2): 3.610 textos, 7 rotas × 2 temas.** Duas
reprovações sobreviveram, **ambas anteriores a esta onda e em cores que ela não tocou** (conferido
no `git diff`: nenhuma linha de `margin-bad`/`--danger` mudou):
- **escuro, /catalogo:** `.margin-bad` a **4,47** contra 4,5 — `rgb(224,82,82)` sobre o card sólido
  `rgb(26,26,46)`, **sem tingimento no meio**, então 4,47 é o valor exato, não erro de medida. É a
  cor da régua da DEC-04.
- **claro, 3 rotas:** o `.btn.primary` **desabilitado** a **4,43** — que é exatamente o
  **[UX-32]** da onda 4.

⚠ **Armadilha de medição, para a próxima varredura:** o `body` tem `transition: background 0.2s`.
Medir contraste logo após trocar de tema lê a cor **no meio da transição** e produz reprovação
fantasma — na primeira passada apareceram 9 falsos positivos, incluindo um texto a "1,02". A
varredura precisa injetar `*{transition:none}` e forçar um reflow antes de ler.

⚠ **O ambiente ficou sem memória** (7,7 GB de RAM, ~1,2 GB livres): `lint`, `test` e `build`
abortaram com OOM várias vezes antes de passarem, e o renderizador de screenshot travou no fim. Não
tem relação com o código — o primeiro `pnpm lint` já abortava assim antes das mudanças.

## ✅ Onda 2 do backlog — o bloco COR (2026-08-16)

> **Os 5 itens:** `TD-014` (tokenizar a cor) · `UX-20` (a cor do lucro) · `UX-24` (contraste AA) ·
> `UX-25` (as 5 ações) · a **parte de cor** do `UX-26`. A matemática das barras do `UX-26` **não**
> foi tocada — segue na onda 5.
>
> **Por que esta onda primeiro:** era a única com prazo externo (a marca). Com a cor tokenizada, o
> rebrand vira troca de paleta; sem ela, eram 14 edições à mão em literais que fixam o RGB do laranja.

### A descoberta que organizou o TD-014

O `UX-19` **já tinha construído a paleta semântica sem saber**. As três cores da faixa de margem
(`bad`/`ok`/`good`) eram as únicas do app medidas com cuidado — 5,07–5,62 no claro — e estavam
presas dentro do nome "margem". Elas subiram para `--danger` / `--warn` / `--success`, e
`--margin-*` passou a apontar de volta. **Nenhum tom novo foi inventado**: é a cor que já tinha
passado no teste, agora com o nome do que ela significa.

Junto veio uma separação que não existia: `--danger` (erro, prejuízo, falha, destrutivo) × `--warn`
(atenção que **não** é erro: estoque baixo, cor sumida, saída de material). Antes os dois eram o
mesmo terracota `#c4836b`, e não dava para distinguir "deu ruim" de "olha isso".

**A escada de opacidade:** as 13 opacidades soltas (`.05 .06 .08 .1 .12 .14 .15 .16 .2 .22 .24 .3
.35 .4 .5`) viraram 3 degraus — `-soft` (.10, fundo) · `-tint` (.20, fundo forte/hover/borda sutil)
· `-line` (.35, borda). Órfãos colapsam pro vizinho, mesma política do `UX-17b`.

**A tinta mora no `-rgb`; o resto deriva.** `--danger: rgb(var(--danger-rgb))` e os três alfas saem
do mesmo `-rgb`, e `var()` resolve na hora do uso — por isso o tema escuro redeclara **só** o
`-rgb`. Trocar a marca = trocar uma linha por cor.

**Números:** 49 hex distintos + 8 bases `rgba()` → **~80 literais convertidos** em 15 arquivos.
Sobraram de propósito os `#fff` de texto sobre preenchimento e as 7 sombras `rgba(0,0,0,·)` — não
são cor de marca e não travam o rebrand.

### Três defeitos achados na passada (nenhum estava no backlog)

1. **Duas paletas independentes para o MESMO conceito.** `.fg-comp` (stock.css, 6 cores, com
   variante escura) e `CostBars.tsx` (8 cores cravadas no JSX, **sem** variante escura) pintavam a
   composição de custo — e discordavam: energia `#d9a021` × `#E0A96D`, manutenção `#a8617a` ×
   `#5FA8A0`. Venceu a do `.fg-comp`, que já tinha sido pensada para os dois temas; virou `--cost-*`
   no `base.css` e as duas passaram a consumir. As 2 categorias que só o CostBars tinha entraram
   agora — e é aí que a **parte-cor do UX-26** se resolveu: reserva de falha (`#D2726B`) e custo
   fixo (`#C4836B`) eram quase a mesma tinta em linhas vizinhas → falha virou o vermelho semântico
   (é risco) e custo fixo virou o neutro (é o balde do não-atribuível).
2. **`--surface-2` nunca existiu.** `production.css` usava `var(--surface-2, rgba(127,127,127,.08))`
   — o fallback cinza **era** o valor real, em todo tema.
3. **O trilho do interruptor não respondia ao tema.** `#d8d4c8` cru no `sections.css`: o mesmo
   cinza claro no escuro. Virou `--toggle-off`, com valor por tema.

### UX-24 — o AA, e por que a auditoria subestimou

A auditoria tinha listado **3** reprovações. Medindo a paleta inteira, eram **12** — as que faltavam
eram justamente as mais usadas: `.sale-neg` (`#e05252` = **3,65/3,82**, o vermelho do prejuízo no app
inteiro), o terracota do erro de formulário (**2,95/3,09**) e o verde do "salvo" (**3,12/3,26**).
Quase todas se resolveram sozinhas ao herdar a semântica, porque a semântica veio do UX-19.

**Decisão do dono: separar marca de texto** (em vez de escurecer a marca). Três papéis:
`--accent` = a marca em tudo que **não** carrega letra · `--accent-strong` = o que carrega texto
**branco** em cima (botão primário; não muda com o tema, porque branco-sobre-cor não depende do
fundo da página) · `--accent-text` = o laranja que **é** texto (no escuro aponta pro `--accent`, que
lá já passa em 6,71/6,02).

**⚠ A lição que custou duas iterações: o tom tem de sobreviver ao PRÓPRIO tingimento.** As primeiras
escolhas foram feitas contra o card branco e **passavam** ali — e reprovavam nos fundos que a mesma
cor pinta. O `--accent-text` a `#c74a0b` media 4,76 no card e **4,29** no `.prod-badge` (que é
`--accent-soft`, laranja 10%); o `--muted2` a `#767263` media 4,82 no card e **4,22** no painel de
capacidade (verde 10%); o `--success` a `#2e7d32` media 4,90 e **4,49** no mesmo painel — reprovava
por um centésimo. Os três foram reescolhidos **medindo no DOM o pior fundo real**, não o card.
Por isso o `--success` desceu 2 pontos em relação ao valor do UX-19 (e o `--margin-good` junto).

**Custo assumido e registrado no código:** o degrau `--muted` → `--muted2` quase sumiu nos dois
temas. A saída melhor seria o texto de 11px crescer, mas "não aumentar o texto" é instrução do dono
desde o `UX-17a` — então quem cede é o degrau.

**Medição final** (varredura de nós de TEXTO, com composição de alfa, 7 rotas × 2 temas):
**4.561 textos medidos, ZERO reprovações**, exceto o `.margin-bad` em 4,47 no escuro — que é a
exceção **deliberada** herdada do UX-19 e já documentada no `base.css`.
⚠ O primeiro script de medição dava 1,34 num ponto: era **bug do script** (ignorava o alfa de um
fundo `rgba`), não do app. Quem repetir a medição precisa compor as camadas.

### UX-20 — a cor mora na %

Regra do app inteiro, escrita num bloco no `auth-sale.css` (o dono do `.sale-pos`): **a cor mora na
%; sem % companheira, mora no R$.** Reverte o UX-19, e os **dois** comentários que registravam a
decisão antiga (`SalesPage` e `StockPage`) foram reescritos junto.

- **Aplica em 4 pontos** (têm % ao lado): KPI e cabeçalho do recibo em `/vendas`, total do
  `SaleModal`, `fg-margin-val` no `/estoque`.
- **⚠ Exceção deliberada em 5**, cada uma com o motivo escrito no TSX ao lado: linha do item em
  `/vendas`, lucro do item no `SaleModal`, `ProfitSummary`, os 2 cartões do `/maquinas`.
  **O dono tinha enumerado 3** — o do `SaleModal` foi achado conferindo ponto a ponto se havia %; o
  comentário no código diz isso e pede confirmação.
- **⚠ Buraco que o item não previa:** o total do `SaleModal` era a única "(NN%)" do app **sem** a
  régua da DEC-04 (saía em `--muted`). Tirar o verde do R$ ali teria **apagado** o sinal em vez de
  mudá-lo de lugar — a % teve de ganhar `marginTierClass` antes.
- **A armadilha da cascata:** a faixa vai num `<span>` PRÓPRIO por dentro, nunca junto de uma classe
  que já declara `color` e mora num CSS importado depois do `base.css` — na mesma especificidade o
  último vence. A regra já estava escrita no `base.css`, acima do `.margin-bad`.
- **Terceira implementação unificada:** `.fg-margin-val` tirava o verde da própria classe e pintava
  o prejuízo de **laranja** contra o vermelho do resto do app. Duas cores para o mesmo significado.
- `.sale-neg` **fica** em todo valor negativo (guarda do caso receita = 0, em que `marginTier`
  devolve `null`), e os 3 usos que **não** são lucro/prejuízo (entrada×saída de material, preço
  acima×abaixo do sugerido) ficaram intactos.

**Prova nos dados reais:** o caso que motivou o item — `R$ 20,11 (61%)` — agora tem o R$ em `--ink`
e só a % em âmbar. Antes eram R$ **verde** ao lado de % **âmbar**, dois recados opostos.

### UX-25 — as 5 ações

`sale #5faa80 · produce #b8925a · quote #8f6bc4 · edit #6b88c4 · danger #c4836b` (todas entre 2,66 e
4,14 no AA). Repouso agora é **neutro** para as cinco — a fileira volta a parecer uma fileira e quem
diferencia é a forma do ícone; a cor entra no **hover**, que é quando ela informa. O Excluir é o
único com cor própria ali (o vermelho semântico), porque é o único irreversível.
Junto, `sale`/`produce`/`quote` saíram do `catalog.css` — era CSS de UMA página estilizando classe
global (o defeito do `TD-013`), e por isso a busca por `icon-button` nunca achava as 5 juntas.

### Verificação

`pnpm lint` limpo · **386 testes intactos** · `pnpm build` ok · varredura de contraste no DOM nas 7
rotas × 2 temas · capturas a 1280×900 e 375×812.

---

## ✅ Ondas 0 e 1 do backlog — as 2 decisões + os 5 consertos (2026-08-16)

> **Contexto:** primeira execução depois que o backlog ganhou ORDEM. A **onda 0 eram perguntas ao
> dono** (não código) e a **onda 1** era o lote "quebra, ou é conserto de 1 linha". Saíram juntas,
> no mesmo dia e no mesmo commit.

### As duas decisões da onda 0

**[DEC-06] — `machines` = N cópias idênticas do conjunto; a conta FICA, o aviso ENTRA.**
A pergunta era se `× machines` deveria continuar multiplicando sobre produto multi-máquina, já que o
gargalo (TD-003) **já** credita o paralelismo entre máquinas distintas. As opções eram (a) barato —
`machines` = cópias idênticas, e (b) caro — `machines` vira a lista de máquinas físicas da oficina.
**O dono escolheu (a), mas recusou a parte em que o multiplicador "deixaria de funcionar"**: em vez
de silenciar o campo em produto multi-máquina, o app passa a **dizer o que ele significa**.

O ponto fino: com a definição (a), os **400 ciclos** travados em `calculateCapacity.test.ts:103`
(A1 3h + X2D 2h, `machines: 2`) estão **certos** — pressupõem 2 A1 e 2 X2D. O problema nunca foi a
conta, foi ela ser **muda**: a oficina real tem 2 máquinas, uma de cada, e `DEFAULT_FIXED_COSTS.
machines = 2`, então quem preenche o campo pensando "tenho 2 impressoras" projeta o dobro sem que
nada na tela avise. A saída escolhida ataca exatamente isso — e **não conserta** o número de quem
preencheu errado; devolve a informação para o dono decidir o valor certo.

Onde caiu: o aviso reaproveita a condição que o `CapacityPanel` **já** usava para o bloco do
gargalo (`machineBreakdown.length > 1`), somada a `machines > 1` — só aparece quando as duas
coexistem, que é quando a premissa deixa de ser óbvia. O `calculateCapacity.ts` e o teste ganharam o
comentário que registra a intenção; **nenhum número mudou** (386 testes passando, intactos).

**[UX-20] — sub-decisão (c): a cor mora na %; sem % companheira, mora no R$.**
Em 3 pontos (linha do item em `/vendas`, `ProfitSummary`, cards do `/maquinas`) o valor não tem %
ao lado. As opções eram (a) passar a exibir a % ali, (b) aceitar o número neutro, (c) manter a cor
onde não há %. O dono escolheu **(c)**. ⚠ Isso cria uma **exceção deliberada** à regra do UX-20, e
ela **tem de ficar escrita no código** quando a onda 2 executar — senão o próximo a passar por ali
"conserta" a exceção e apaga a leitura desses três pontos. **O UX-20 segue aberto na onda 2**; o que
fechou aqui foi só a pergunta.

### Os 5 consertos da onda 1

| Item | O que era | O que entrou | Prova medida |
|---|---|---|---|
| **BUG-06** | `.recibo-card` tem `overflow: hidden` e a tabela é mais larga → o excedente **não rolava, era cortado** | `div.recibo-items-scroll` com `overflow-x: auto` (mesmo padrão do `.table-scroll` do catálogo); o `overflow: hidden` do cartão fica, é ele que arredonda | 375×812: **23/23** recibos com `client 345px` × `scroll 445…471px`. O botão de excluir estava em **x=456** com a borda do cartão em **x=360**; rolando 108px vai pra **x=348** — alcançável |
| **BUG-07** | o reset cobria `button, input, select` e esquecia `textarea` → observações em `monospace` | uma palavra no `base.css` | `/orcamento`: textarea agora `Inter 16px`, **idêntico** ao input vizinho |
| **UX-27** | `tabular-nums` em 3 declarações locais, num app inteiro de números | subiu pro `body`; as 3 locais saíram | `getComputedStyle(body).fontVariantNumeric === "tabular-nums"` |
| **UX-21 (só o `text-align`)** | colunas de dinheiro do catálogo em `start` → a vírgula nunca alinhava | `.num` — a convenção que `sales.css` e `cesta-recibo.css` já usavam — chegou ao catálogo | 1280×900: **um único x** (`485.28`) para `R$ 33,64` e `R$ 617,90`; custo em `684.33/684.34` (0,01px de arredondamento) |
| **UX-30** | o preço mudava em silêncio | `role="status"` + `aria-live="polite"` no `.result-price` (**só** ali — a `MobilePriceBar` espelha o mesmo número e duplicaria a fala) + `aria-valuetext` nos 2 dials de markup | DOM: `aria-valuetext="3.0x"`, igual ao rótulo visível |

⚠ **Achado NOVO que a verificação levantou e foi PRO BACKLOG (onda 3, dentro do UX-21):** a 1280 a
coluna de preço do catálogo cabe, mas a **826px de largura útil não** — `R$ 617,90` mede 75,61px numa
faixa de 73,7px (`1.1fr`), o texto transborda e o `overflow: hidden` do `.main-row td` **corta**.
É defeito de **grade**, pré-existente: com o alinhamento à esquerda ele cortava igual, só não
aparecia. Não é regressão do `text-align`.

## 🔍 Auditoria de UI/UX + cálculo (2026-08-16) — o LEVANTAMENTO

> **O que é:** o *porquê* e a MEDIÇÃO dos **33 achados** da auditoria pedida pelo dono depois do
> fechamento do cluster UI/UX. Os itens **abertos** que saíram daqui vivem no
> [`BACKLOG.md`](BACKLOG.md), seção "Cluster da auditoria de 2026-08-16" — **21 itens**
> (`UX-21…UX-34`, `TD-014…TD-016`, `BUG-06/07`, `DEC-06`), porque vários achados eram o **mesmo
> defeito em lugares diferentes** e foram consolidados. Este arquivo guarda o número medido; o
> backlog guarda a tarefa. **O código-referência antigo (A1…I3) está anotado em cada item** — é
> como o relatório original numerava.
>
> **Método (o mesmo do cluster anterior, e vale repetir):** site **rodando** com dados reais
> (93 produtos, 47 vendas, 53 produções), **7 rotas + 9 modais**, em **1280×900** e **375×812**,
> nos **dois temas**, com medição no DOM — não é leitura de código. `pnpm test`: **386 passando**
> antes e depois (nada foi alterado).
>
> ⚠ **Um erro de método que quase virou achado falso, registrado para não se repetir:** a
> primeira sonda de foco chamou `el.focus()` e comparou o estilo antes/depois — deu "nenhum
> controle tem indicador de foco", o que era **falso**. O painel do navegador não estava em
> primeiro plano, então `document.hasFocus()` era `false` e **`:focus` não casa**. A conclusão
> certa veio de ler as regras do CSS, não o estado vivo. Sonda de estado só vale com a janela
> focada.

### A — Alinhamento (o que o dono viu como "textos descentralizados")

**→ `UX-21` (A1+A2+A3) · `UX-22` (A4) · `UX-23` (A5)**

**A1 — no catálogo, cabeçalho e linhas são duas grades independentes.** O `<tr>` do cabeçalho e
o `.main-row` são dois `display: grid` com caixas de conteúdo **diferentes**, e o erro **acumula
da esquerda para a direita**:

| | padding | borda | conteúdo | trilhas |
|---|---|---|---|---|
| cabeçalho | `0 20px 8px` | 0 | **906px** | `205.0 \| 94.0 \| 51.3 \| 85.4 \| 59.8 \| 102.5 \| 196` |
| linha | `14px 16px` | 1px | **904px** | `207.1 \| 94.9 \| 51.8 \| 86.3 \| 60.4 \| 103.5 \| 196` |

Deriva medida: PRODUTO **3px** · PREÇO 1px · MÁQUINA **2px** · AÇÕES **3px**.

**A2 — as colunas de dinheiro são `text-align: start`.** `R$ 33,64`, `R$ 617,90` e `R$ 141,30`
começam **todos** em `x=256` → a vírgula decimal nunca alinha. A fonte já é **JetBrains Mono**
(dígito de largura fixa), então `text-align: right` faz as vírgulas se empilharem sozinhas. É a
mudança de **maior retorno visual por linha de CSS** do lote inteiro.

**A3 — em `/vendas` cada recibo é uma `<table>` própria em layout automático**
(`grid-template-columns: none`), então as colunas se dimensionam pelo **nome de produto mais
longo daquele recibo**. Dois recibos vizinhos, medidos:

```
recibo 1   qtd 410–449   preço 449–536   total 536–622
recibo 2   qtd 402–442   preço 442–528   total 528–614
                 −8px           −8px           −8px
```

A última coluna não escorrega porque está presa à coluna de ações, à direita — o que faz o miolo
parecer "solto". Rolando o histórico, os números balançam de recibo em recibo.

**A4 — no `/orcamento` os dois cartões lado a lado nunca compartilham linha de base.** O da
esquerda abre com um campo de largura inteira; o da direita, com uma linha de dois. Topo de cada
linha de campo: esquerda `235 · 297 · 379`, direita `250 · 250 · 332 · 332` → **Δ15** e **Δ35**.
Junto: o campo `type="date"` mede **37px** contra **35px** do vizinho na mesma linha (altura do
controle nativo).

**A5 — o texto de introdução de página tem 4 tratamentos.** `/estoque` espreme o parágrafo à
esquerda do botão "Nova cor"; `/producao` usa largura inteira acima do cartão; `/maquinas`
empilha **dois** (~120px antes do primeiro dado); `/catalogo` e `/vendas` não têm nenhum. O
conceito nunca virou componente, então cada página inventou o seu.

### B — Cor: o buraco que o UX-17 deixou

**→ `TD-014` (B2+B3+C3) · `UX-24` (B1) · `UX-25` (B4)**

O UX-17 tokenizou **espaço, raio e tipografia** e parou antes da **cor**. É a maior lacuna
estrutural que sobrou — e ela tem **prazo**, porque cada literal vira edição manual quando a
marca chegar.

**B1 — contrastes medidos (calculados da paleta viva, WCAG AA pede 4,5 para texto normal):**

```
                         claro   escuro
branco sobre --accent     2.84    2.84   ← BOTÃO PRIMÁRIO, reprova nos dois
--muted2 sobre cartão     2.93    3.18   ← 52 usos, e é o texto de 10–11px
--accent como texto       2.84    6.02   ← 57 usos; só reprova no claro
--muted  sobre cartão     5.61    6.01     ok
--ink    sobre cartão    17.06   14.56     ok
```

⚠ **O ponto que dói:** o **UX-19 mediu com todo cuidado** as três cores de margem (5,13 a 5,62)
— mas **a paleta em que elas vivem nunca foi auditada**. O rigor existiu no item novo e não na
base. E `--muted2` é justamente o texto **menor** do app.

**B2 — 51 hex distintos + 8 bases `rgba()`, e nenhuma cor SEMÂNTICA.** O `base.css` declara ~23
cores de superfície; as outras ~28 são literais espalhados. Não existe token para os papéis que o
app mais usa: **perigo, aviso, sucesso, informação**. `#c4836b` aparece **11×** e `#e05252` **5×**
— os dois fazendo o papel de "perigo/aviso", sem nome.

**B3 — a mesma tinta em 6 opacidades.** É o problema dos **órfãos** do UX-17b, de novo, agora em
cor: `rgba(255,107,53, ·)` em `0.08 · 0.1 · 0.12 · 0.2 · 0.22 · 0.3` e
`rgba(196,131,107, ·)` em `0.1 · 0.14 · 0.24 · 0.35 · 0.5`. **0,2 e 0,22 são indistinguíveis.**
⚠ **E o argumento de prazo:** esses literais **fixam o RGB do laranja**. Trocar a marca obriga a
editar os 14 na mão. Tokenizar **antes** transforma o rebrand em troca de paleta.

**B4 — cinco ações, cinco cores.** Na linha do catálogo: vender `#5faa80` · produzir `#b8925a` ·
orçar `#8f6bc4` · editar `#6b88c4` · excluir `#c4836b`. Quando tudo está destacado, nada está — e
o Excluir não se distingue por cor, só por posição.

### C — Gráficos e números

**→ `UX-26` (C1+C2) · `UX-27` (C4) · C3 vai no `TD-014` · C5 já é o `UX-20`**

**C1 — as barras de custo são escaladas pelo MAIOR item, não pelo total.**
`maxValue = Math.max(...items)`, então o maior custo **sempre** desenha barra de largura inteira.
O bloco termina em "Custo total", então o olho lê as barras como fatia dele — e não são. Medido no
cenário base da tela:

```
                valor    barra   fatia real
mão de obra    R$ 5,00    100%       40%
material       R$ 4,40     88%       35%
desgaste       R$ 2,12     42%       17%
custo total   R$ 12,48
```

Todas as fatias aparecem **maiores do que são**. Ou normalizar pelo total, ou virar barra
empilhada 100% (que ainda devolve as 6 linhas que o bloco ocupa).

**C2 — duas cores do gráfico são praticamente a mesma:** reserva de falha `#D2726B` e custo fixo
`#C4836B` → Δ `14/17/0` em RGB. São **linhas vizinhas do mesmo gráfico**.

**C3 — a paleta do gráfico não responde ao tema:** 6 hex crus dentro do `CostBars.tsx`, misturados
com `var(--accent)` e `var(--green)`. As duas primeiras cores mudam com o tema; as seis seguintes
não.

**C4 — `tabular-nums` aparece em 3 lugares** de um app inteiro de números. Onde o valor é
monoespaçado os dígitos já alinham; onde não é (cartões de KPI, margens, os `(76%)`) cada
algarismo tem largura própria e a coluna treme.

**C5 — virou o [UX-20]** (cor do lucro × faixa de margem), já no backlog e **decidido** pelo dono
no mesmo dia. Detalhe lá.

### D — Celular

**→ `BUG-06` (D1) · `UX-28` (D2)**

**D1 — em `/vendas`, parte de cada recibo é CORTADA e fica inalcançável.** `.recibo-card` tem
`overflow: hidden` (provavelmente para arredondar o cabeçalho), mas a tabela de itens é mais larga
que o cartão — então o excedente **não rola, é cortado**. Medido a 375×812, **todos** os recibos da
1ª página: `clientWidth 345px`, `scrollWidth 414…471px`, ou seja **69 a 126px cortados**. A coluna
de lucro e o botão de excluir **não existem no telefone**.
⚠ **O TD-013 encostou nisso e leu ao contrário:** ele registrou que o recibo caiu de 600px para
"453px (108px)" e tratou como ganho. Os 108px são **exatamente o pedaço cortado** — o problema
encolheu, não sumiu.

**D2 — os `.link-button` inline têm 15px de altura.** O UX-15 subiu os alvos do catálogo para
32px e deixou esses de fora: "Gerenciar" `79×15`, "detalhar refugo (…)" `286×15` (contra
"Adicionar cor" `127×29`). São ações reais em alvos de menos de metade do mínimo confortável.

### E — Modais

**→ `TD-015` (E1+E2+E3)**

**O padrão certo JÁ EXISTE no projeto** — o `ConfirmDialog` (UX-15) e a gaveta da nav (UX-14)
fazem tudo direito. Ele só **nunca foi propagado** para os modais que já existiam. Levantado nos
9 componentes com `.modal-overlay`:

```
                       role  Escape  nome acessível
ConfirmDialog            ok     ok        ok
SaleModal               não    não       não
MachineManagerModal     não    não       não
StockColorModal         não    não       não
StockRollModal          não    não       não
StockAdjustModal        não    não       não
SupplyModal             não    não       não
SupplyLotModal          não    não       não
SupplyAdjustModal       não    não       não
```

**E2 — nenhum modal trava a rolagem do fundo.** Com o `SaleModal` aberto, `document.body` segue
com `overflow: visible` e a página atrás rola junto. A gaveta do UX-14 **já faz** o
`body.style.overflow = "hidden"`; os modais não herdaram.

**E3 — no `SaleModal` os botões ficam abaixo da dobra.** Medido: modal de **774px** numa viewport
de **910px**, `max-height: 85vh` com `overflow-y: auto` — o rodapé rola junto do miolo, então
"Registrar venda"/"Cancelar" só aparecem depois de rolar. E **não há ✕ no cabeçalho**: sem Escape
(E1) e sem ✕, a única saída visível exige rolar até o fim.

### F — Estrutura e semântica

**→ `UX-29` (F1+F2+F3) · `UX-30` (F4)**

O **UX-16** ligou rótulo a campo em 15 componentes — trabalho sério. A camada de cima, a que dá
**estrutura ao documento**, não foi tocada.

**F1 — na calculadora o único título é a MARCA.** O `<h1>` da rota `/` é "Lopo Lab" (vem do
`Header`), e **não há mais nenhum título na página**: `h1=1, h2=0, h3=0`. Todos os nomes de seção
("Filamento por cor", "Acessórios", "Preço sugerido") são `<div>`. Quem navega por títulos não tem
para onde ir. As outras 6 rotas **já** têm `<h1>` de página — só a calculadora não.

**F2 — os modais pulam de h1 para h3.** No app inteiro: `h1` 10× (páginas + AuthGate), `h2` **1×**
(só `ProductCatalog`), `h3` 10× (todos `.modal-title`).

**F3 — não existe `<nav>` nem `<header>`.** As 8 rotas têm `<main>` (isso está certo), mas a
NavBar e o Header são `<div>` → os 7 destinos não estão num marco de navegação, e não há link
para pular ao conteúdo.

**F4 — o preço muda em silêncio.** A interação central do app (mexer no dial e ver o número) não
anuncia nada. O `FeedbackNote` **já estabeleceu** `role="status"` no projeto — o preço é o caso
óbvio para o mesmo recurso. Junto: o `<input type="range">` deveria ter `aria-valuetext` com o
preço resultante, senão o valor falado é "54" e não "R$ 27,14".

### G — Formulários e controles

**→ `BUG-07` (G1) · `UX-31` (G3) · `UX-32` (G4) · G2 anexado à `DEC-05`**

**G1 — `textarea` não é estilizado em NENHUM arquivo do app.** O reset do `base.css` cobre
`button, input, select` e **esquece dele**; e o `.field-input` define `font-size` mas **não**
`font-family`. Resultado medido em `/orcamento`: todos os campos em **Inter 14px** e o de
observações em **`monospace` 14px**. Atinge os 2 textarea do sistema (orçamento e `SaleModal`).
**Conserto de uma palavra.**

**G2 — os emoji nos rótulos não seguem regra nenhuma.** A DEC-05 já decidiu "lucide no que é
controle", mas o argumento mais forte é anterior ao sistema de ícones: **dentro do mesmo
formulário**, metade dos rótulos tem emoji e metade não, sem nada que distinga os grupos —
`🏷️ nome da etapa`, `🎨 filamento`, `⏱ tempo`, `⚡ tarifa`, `🔢 peças`, `🎲 taxa de falha` têm;
`nome do produto`, `máquina`, `cor`, `filamento (R$/kg)`, `total (g)`, `mão de obra`,
`seu valor-hora` não têm. **Não é decoração deliberada, é acaso** — o emoji só marca quando
alguém lembrou de pôr.

**G3 — o foco de teclado não tem tratamento próprio.** Nos 16 arquivos de estilo: `:focus-visible`
**2×** (`.back-to-top`, `.brand-reset`) · `:focus` 6× (campos e selects, **todos** com
`outline: none` + troca de cor da borda) · **botões: nenhum**, então ficam com o anel padrão do
navegador, que não combina com nada. Os dois que têm foco decente são recentes — a intenção
existe, só não virou sistema.

**G4 — o primário desabilitado parece defeito.** `background: var(--border)` + `color:
var(--muted2)`, largura inteira, 45px. Na calculadora sem nome e em `/producao` sem produto, é o
**maior elemento da tela** e lê como erro, não como "ainda não".

### H — Hierarquia de navegação

**→ `UX-33` (H1+H2+H3)**

**H1 — navegação de página e abas internas usam o MESMO chip.** O UX-17b deixou as abas do estoque
"byte a byte iguais" às da NavBar. Resolveu a inconsistência de **estilo** e criou uma de
**hierarquia**: "em que página estou" e "em que aba estou" passaram a ter a mesma aparência, a
poucos pixels de distância.

**H2 — existe um TERCEIRO paradigma de seleção:** no `SaleModal`, o desconto
(Nenhum/Por item/No total) é um controle segmentado preenchido e emendado — diferente dos dois
chips. Três formas de dizer "escolha uma destas".

**H3 — "Escuro" e "Sair" ocupam uma faixa inteira sozinhos** no desktop: os 7 destinos preenchem
a 1ª linha e os 2 utilitários caem numa 2ª, alinhados à direita (~40px de altura em todas as
páginas, para dois botões).

### I — Matemática

**→ `DEC-06` (I1) · `TD-016` (I2) · `UX-34` (I3)**

O núcleo de cálculo é **a parte mais sólida do sistema**: 386 testes, decisões documentadas no
ponto de uso, efeito de cada mudança de fórmula rastreado em reais. Sobraram três pontos.

**I1 — a capacidade conta as máquinas DUAS VEZES em produto multi-máquina.** O modelo do gargalo
(TD-003) já credita o paralelismo entre máquinas **distintas**: quem limita é a mais ocupada.
Depois disso, `× machines` multiplica **de novo** — e isso só é correto com N cópias do conjunto
inteiro. **Travado em teste** (`calculateCapacity.test.ts:103`):

```
produto   A1 3h  +  X2D 2h     (um ciclo usa as DUAS)
gargalo   3h → 200 ciclos/mês
machines  2
esperado  400 ciclos

400 ciclos exige 2 A1 E 2 X2D = 4 máquinas.
A oficina tem 2, uma de cada. E DEFAULT_FIXED_COSTS.machines = 2.
```

⚠ Ou seja: **todo produto que roda nas duas impressoras projeta o dobro** do que cabe no mês. Não
é bug de digitação — é ambiguidade do que `machines` significa, e por isso virou **DEC-06**
(decisão antes de código).

**I2 — o ritmo de lucro do ROI é média de vida inteira.**
`profitPerMonth = lucro ÷ (agora − primeira venda)`. Um mês forte no começo seguido de período
parado faz a média **decair sozinha**, e a projeção de payback afasta a data mesmo com ritmo
recente bom (ou o contrário). Responde a "quanto rendeu até aqui", não a "quanto rende agora".
Janela móvel de 60–90 dias resolve, **sem depender do Dashboard**.

**I3 — a ressalva do payback aparece 3× na mesma tela.** O UX-09 pôs o aviso em três pontos de
propósito e **funcionou** — a informação está clara. O efeito colateral é visual: em `/maquinas` a
ressalva ocupa mais área que o número que ela ressalva (subtítulo do KPI + caixa de aviso no topo
+ linha italic em cada um dos 2 cartões).

### O que a auditoria confirmou que está BEM resolvido (não mexer)

- **O núcleo de cálculo** — 386 testes, DEC-01/DEC-03/TD-011 documentadas onde a fórmula mora, e o
  efeito de cada mudança medido em reais. É raro e vale proteger.
- **O modelo de gargalo do TD-003** — máquinas distintas em paralelo é a modelagem certa; o
  problema do I1 é o multiplicador que veio **depois**, não o modelo.
- **A régua de margem do UX-19** — módulo puro, testado, com contraste medido **antes** de escolher
  o tom. Foi assim que a paleta inteira deveria ter sido feita (ver B1).
- **O UX-16** — rótulo ligado a campo em 15 componentes, com a distinção correta entre rótulo de
  campo, cabeçalho e grupo.
- **Os snapshots congelados** — custo congelado na produção, na camada do acabado e na venda é a
  fundação que faz o custo real ser decomponível ponta a ponta.
- **Os tokens de escala (UX-17)** — consumidos pelos 16 arquivos, órfãos mortos, prova por
  medição. O `TD-014` é literalmente "fazer isso de novo, para cor".

---

## ✅ Cluster UI/UX passo ⑦ — UX-17b: os 16 CSS passam a consumir os tokens (2026-08-16)

**Fecha o cluster UI/UX.** O passo ① tinha **declarado** os tokens no `base.css` e parado ali de
propósito; este é o outro lado — **875 declarações trocadas** nos 16 arquivos de `styles/`.

**A contradição que a medição expôs, e o martelo do dono.** O `base.css` prometia *"converter não
deve mexer no visual"* e o item do backlog mandava *"matar os órfãos"*. Medido antes de começar:
**~70 declarações caem fora da escala** (o número final foi **96**). **As duas coisas não podem ser
verdade.** O dono escolheu a **escala curta**, aceitando o drift de 1–2px — e a promessa foi
**retirada** do comentário do `base.css`, que hoje registra o que de fato aconteceu. Placar:
**779 trocas literais** (zero pixel) + **96 órfãos colapsados**; tipografia de **23 tamanhos → 9**,
raio de **15 → 8**.

**A conversão foi feita por script, não à mão** (`tokenize.mjs`, no scratchpad): ele só mexe nas
propriedades de escala (`font-size`, `border-radius`, `padding*`, `margin*`, `gap*`), pula linha com
`var()`/`calc()`, e **qualquer valor sem token é deixado intacto e REPORTADO** — nada é adivinhado em
silêncio. Sobraram 7 valores crus, todos de propósito: margem negativa de ajuste fino (`-1/-2/-6/-12`)
e reserva de espaço (`60px` do rodapé do `.wrap`, `52px` que segura o botão ☰).
⚠ **Armadilha que quase passou batido:** metade dos arquivos está em **CRLF** e em JS o `.` do regex
**não casa `\r`** — a primeira rodada converteu 539 declarações e deixou 6 arquivos inteiros intactos
(`header.css`, `forms.css`, `sections.css`, `responsive.css`, `quote.css`, `base.css`) **sem erro
nenhum**. Só apareceu porque o relatório por arquivo não batia com o inventário.

**O medo herdado do TD-013 quase não se aplicou.** O aviso do backlog mandava tratar todo seletor de
elemento nu como suspeito. Levantamento: o app inteiro tem **4** (`button, input, select { font:
inherit }`, `button { color: inherit }` e `h1` em dois arquivos) — e **nenhum** declara espaço, raio
ou tamanho arbitrário além do `font-size` do `h1`, que tem dono claro. O risco real era outro.

**Como a prova foi feita (o que dá pra reusar).** `lint`/`test`/`build` não veem CSS. A sonda mede
cada elemento (`getBoundingClientRect` + `font-size`/raio/padding/margin/gap/cor computados) e
**guarda a linha de base no `localStorage` da própria página** — sobrevive ao reload e ao HMR, e o
diff roda dentro do navegador, então o relatório que sai é só o agrupamento. Dois ajustes que a
prática exigiu: (a) a 1ª versão gastou **2,7 MB só no catálogo** e ia estourar a cota — os estilos
viram **dicionário** (15.508 elementos, só **173** estilos distintos) e caiu para 1,1 MB; (b) o diff
**agrupa** por mudança em vez de listar elemento a elemento, senão o `.wrap` de 28→24px sozinho
produziria milhares de linhas de "moveu 4px".

**Resultado: 25 estados medidos** (7 rotas × 2 tamanhos + as 3 abas do estoque, 3 modais e a gaveta
aberta). **Toda** diferença de estilo, em todos eles, cai na lista de órfãos ou nas 2 mudanças
deliberadas — e **`sumiram: []` em todos**. Altura das páginas: `/` 1384→1368 · `/catalogo`
6984→6974 · `/vendas` 3442→3431 · `/orcamento` 2082→2067 · `/producao` 2438→2422 · `/maquinas` e
`/estoque` **idênticas**.

**Duas exceções deliberadas, com o motivo:**
- **`15px → 16px` (e não 14) em `.field-input`/`.btn` no celular** — abaixo de 16px o **iOS dá zoom
  automático ao focar o campo**, e o zoom desfaz o espaço vertical que o UX-13b/14 acabou de ganhar.
  ⚠ **Custo medido, e é o maior do lote:** `/vendas` **+57px** e `/producao` **+70px**; no catálogo o
  bump pega **1.674 elementos** (todo botão dos 93 cards, com os `svg`/`path` que herdam). O `.btn`
  acompanha o campo só para não destoar — se o dono preferir 14px (= igual ao desktop), é **uma
  linha** no `responsive.css`.
- **`0.78rem` → `--text-xs`** — era o único valor em `rem` do app e dava 12.48px: o órfão `12.5px`
  disfarçado.

**As duas faxinas que viajaram junto:**
- **`.btn:disabled` saiu do `stock.css` para o `forms.css`** — era a última regra global de `.btn`
  morando no CSS de uma página (o defeito do TD-013; o `.btn.danger` já tinha saído no UX-15).
  Cascata conferida: os únicos outros `:disabled` são `.fee-toggle:disabled` (outra classe) e
  `.btn.primary:disabled` (0,3,0), que segue vencendo o fundo.
- **As abas da `/estoque` viraram chip** (decisão do dono: a NavBar aparece em toda página, então é
  ela que define a linguagem de "escolher 1 de N"). Só CSS — o `StockPage.tsx` já usava
  `role="tablist"` + `.stock-tab`/`.active`. Medido: `radius 0→8` · `padding 9px 16px → 8px 12px` ·
  `margin-bottom -1px → 0` · inativa passa a ter fundo e borda. **Verificado nos 2 temas: aba e chip
  da NavBar saem byte a byte idênticos** (claro e escuro).
  - ➕ **Achado ao ler o chip pra copiar:** `.icon-label-button[aria-current="page"]` pintava o fundo
    com `rgba(74, 158, 118, 0.12)` — **verde cru**, ao lado de borda e texto em `--accent` (laranja),
    e sem responder ao tema. Existia token exato (`--chip-active-bg`, definido nos dois temas). Não
    dava pra copiar o bug pra dentro da `/estoque`.

**Dois falsos positivos que a medição levantou e que NÃO são bugs** (registrados pra não serem
"redescobertos"): (1) na `/` o `innerWidth` mede **388** contra `clientWidth` 375 — parece overflow
horizontal, mas `scrollX` não sai de 0; é contabilidade de barra de rolagem do navegador embutido.
(2) `.capacity-box` tem retângulo **fora da área rolável** — está dentro do `<details>` **fechado**,
onde o Chrome usa `content-visibility`, então o box existe geometricamente mas não é renderizado.
Ambos idênticos antes e depois.

**Conferido no fim:** a corrente do UX-13b sobreviveu à tokenização — `.wrap.has-price-bar` mantém
`calc(60px + var(--price-bar-h))` (o script pula `calc`), a folga do último card até a barra mede
**60px** (o número exato da entrega do UX-13b) e o `.back-to-top` continua subindo os 56px da barra.
386 testes, `lint` e `build` limpos.

## ✅ Cluster UI/UX passo ⑥ — UX-19: a cor passa a trabalhar (2026-08-16)

**O problema.** Num app cuja função é dizer se o preço está bom, todo número de margem saía da
mesma cor: catálogo em cinza (49% a 72%), `/vendas` em verde (61% a 100%). A régua era a
**[DEC-04]** (`< 50` ruim · `50–65` ok · `> 65` bom, a mesma nas duas telas), decidida em 2026-08-15.

**A régua virou código, não CSS.** `lib/marginTier.ts` (novo, puro, 12 testes — molde do
`roundPrice.ts`): `MARGIN_TIER_CUTS` guarda os dois cortes num lugar só, `marginTier()` devolve a
faixa e `marginTierClass()`/`marginTierTitle()` são o que os componentes chamam. O `title` existe
pra faixa **não ser transmitida só por cor**.

**Escopo dobrou de 2 para 4 superfícies (dono aprovou no plano):** o item citava catálogo e
`/vendas`, mas o mesmo número mora também no **card de preço da calculadora** (onde o dial de markup
é mexido — o lugar mais útil de todos) e na **margem congelada da aba Produtos do estoque**.

**A regra de cascata que evitou retrabalho.** `base.css` é o **1º `@import`**, então classe declarada
lá **perde todo empate de especificidade** com os 15 CSS de área (`.muted` mora no `catalog.css`;
`.cd-ph-margin`, `.result-margin`, `.fg-margin-val`, `.sales-total-sub` declaram cor na própria
classe). Por isso a faixa vai sempre num **`<span>` próprio** em volta do número — e o resultado é
que **nenhuma regra CSS existente precisou ser editada**.

**Duas coisas que só apareceram MEDINDO** (método do TD-013 — as duas eram invisíveis no diff):
1. **`.sale-pos`/`.sale-neg` estavam MORTOS no cabeçalho do recibo.** `.recibo-head-totals strong`
   (0,1,1) vencia as classes (0,1,0) desde sempre: o lucro saía cor de `--ink` e **a Taxa nunca ficou
   vermelha**. Ou seja, o "todos no mesmo verde" que a auditoria viu era das **linhas de item**, não
   do cabeçalho — lá não havia cor nenhuma. Consertado com `:not(.sale-pos):not(.sale-neg)` no
   seletor base, no **dono legítimo** da regra e **sem repetir valor de cor** em arquivo alheio.
2. **`65%` aparecia âmbar E verde na mesma tela.** A faixa lia o valor cru (65,4 × 65,6) e a tela
   mostra o `toFixed(0)`. `marginTier` passou a arredondar **antes** de comparar: a cor explica o
   número escrito, não um decimal invisível. Depois disso: **0 conflitos** em 93 produtos.

**Contraste medido, não estimado.** O âmbar claro nasceu `#b26a00` e mediu **4,24/4,05** contra o
card e o fundo — abaixo do AA (4,5). Escureceu pra `#a05a00` = **5,31/5,07**, alinhado com o vermelho
(5,62/5,38) e o verde (5,13/4,90). No escuro: 4,47 · 7,69 · 6,14 — o vermelho fica 0,03 abaixo **de
propósito**, é o `#e05252` que o app inteiro já usa pra prejuízo.

**Medido no site rodando (1280, tema claro e escuro, dados reais):**
- Catálogo, 93 produtos: **20 bom · 63 ok · 10 ruim** — a régua da DEC-04 distribui o catálogo
  inteiro nas 3 faixas, que era exatamente o motivo dos cortes escolhidos.
- Calculadora, mexendo o dial ao vivo: markup 2,4 → **45% vermelho**; 3,0 → **54% âmbar**;
  4,2 → **65% verde**. A tela responde sozinha.
- **Zero mudança de geometria, provado**: clonando o `<main>` e desfazendo os 372 `<span>` no clone,
  no mesmo instante — página **7114px idêntica**, 187 linhas comparadas, **0 diferenças**. Em
  `/vendas` (incluindo o "Sem cliente" voltando a negrito no clone): **3674px idêntica**, 23
  cabeçalhos, 0 diferenças.

**Junto:** "Sem cliente" — um campo **vazio** em negrito/`--ink` em 17 das 23 vendas, ocupando a
posição de maior ênfase da linha — ficou mudo (`.recibo-customer.is-empty`: `--muted2`, peso 400).
Continua escrito: a ausência do nome sozinha não diria que o campo existe.

**Ficou de fora de propósito:** a linha de item do recibo (`ri-profit`) mostra **só R$, sem %** —
pintar por faixa ali seria informação transmitida **apenas por cor**. Segue `sale-pos`/`sale-neg`.

**Onde:** `lib/marginTier.ts` (+teste) · `base.css` (3 tokens × 2 temas + 3 classes) ·
`ProductCatalog.tsx` · `PricingResultCard.tsx` · `StockPage.tsx` · `SalesPage.tsx` ·
`cesta-recibo.css`. **386 testes.**

## ✅ Cluster UI/UX passo ④ — UX-15: alvos de ação + como o app confirma e avisa (2026-08-16)

**Alvo de 32px no catálogo.** As 95 linhas terminavam em 5 ícones de 24px colados, com o **Excluir**
vizinho imediato do mais clicado. Agora: `td.col-actions .icon-button` = **32px**, o divisor mudou de
lugar (era entre *orçar* e *editar*; virou o separador **antes do Excluir**) e ganhou margem de 6px de
cada lado. A faixa "Ações" do grid foi de **146 → 196px**. **Medido a 1280×900:** botões 32×32, folga
*Carregar → Excluir* **4 → 21px**, e a coluna Nome caiu de 276 → 259px **sem truncar nada a mais** —
os mesmos **3 de 95** nomes truncam antes e depois, e a página mede os mesmos 7128px (comparação feita
injetando a geometria antiga na página ao vivo, não lendo o diff). A 375×838 os 5 alvos medem 32px numa
linha só, com 29px de folga antes do Excluir.

**`ConfirmDialog` + `useConfirm`.** Os **8** `window.confirm` de 7 arquivos viraram modal próprio,
reusando a casca do `modal.css` (nada de segundo sistema de diálogo). O hook devolve
`ask(): Promise<boolean>` **de propósito**: o formato do `window.confirm` preservado deixou os 8
handlers inteiros (`if (!(await ask({...}))) return;`) — estado por call-site partiria cada um em dois.
Fecha no Escape, no fundo e no Cancelar; **o foco nasce no Cancelar** e o destrutivo é o **segundo**
botão. O texto passou a nomear o alvo e a dizer **o que NÃO é afetado** (venda e acabado guardam nome +
custo congelados ⇒ o histórico sobrevive a excluir um produto).

⚠ **Isto REVERTE a decisão do [TD-004]** de manter nativos os `confirm` destrutivos. Legítimo e
consciente (o dono decidiu na sessão): o TD-004 decidiu sobre *feedback de escrita*, e o problema aqui
era **alvo de 24px com o Excluir colado no mais clicado** — contexto que não estava na mesa lá.

**Os avisos viraram um só componente** (`FeedbackNote` + `useFeedback`). Levantado no código: já **não
existia nenhum `window.alert`** (o TD-004 os matou) — o defeito estava nos substitutos. O estado
`{kind,msg}` + o `<div>` estavam copiados em **5** telas, `guardOnline`/`errorMessage` em **4** (3
cópias idênticas + uma inline na QuotePage, agora em `src/lib/errors.ts`), o ✓ era **emoji dentro da
string** (virou ícone lucide, resíduo da DEC-05) e nada sumia nem fechava. Agora **sucesso some sozinho
em 5s, erro persiste com ✕** (decisão do dono).

**O buraco real que isso fechou:** a `/vendas` **não tinha aviso nenhum** — `handleDelete` estornava
acabado + filamento e chamava `reconcileRecibo` **sem `try/catch`, sem `guardOnline` e sem mensagem**.
Falha de estorno era silenciosa: a linha só não sumia. **Verificado no site rodando** (com
`navigator.onLine` forçado a false): antes, nada; agora o aviso nomeia a venda e o motivo, persiste
além de 6s e fecha no ✕ — e nada foi gravado, porque o guarda dispara antes do primeiro `await`.

**Faxina junto (TD-013):** `.btn.danger` morava no `stock.css` — regra global no CSS de uma página, e
**sem consumidor nenhum**; foi pro `forms.css` (dono do `.btn`) e ganhou corpo, porque virou a ação
afirmativa do diálogo. O `.btn:disabled` ao lado tem o mesmo defeito mas **tem** consumidores → anotado
no BACKLOG para o UX-17b.

**Onde:** `ConfirmDialog.tsx` · `FeedbackNote.tsx` · `src/lib/errors.ts` (novos) · `ProductCatalog` ·
`SalesPage` · `StockPage` · `SuppliesTab` · `ProductionPage` · `QuotePage` · `LogoutButton` ·
`catalog.css` · `modal.css` · `forms.css` · `stock.css`. 376 testes (a matemática não foi tocada).

## ✅ Cluster UI/UX passo ③ — UX-13b + UX-14: o chrome do celular (2026-08-15)

Os dois itens foram juntos porque disputavam o mesmo espaço vertical (um o topo, outro o rodapé) e a
conta do `.back-to-top` teria de ser refeita duas vezes se fossem separados.

**UX-14 — a navbar virou gaveta.** Abaixo de 760px a **mesma** `.navbar-bar` sai do fluxo e vira painel
de 280px que entra pela direita; no lugar dela fica a `.navbar-mobile-head` (nome da página + ☰). Sem
markup duplicado — é CSS sobre o nó que já existia. Três detalhes que não são cosméticos:
- fechada, a gaveta é `visibility: hidden` (e não só `translateX(100%)`), senão os 7 links continuariam
  **focáveis fora da tela** na ordem de tabulação;
- fecha no ✕, no fundo escuro, no **Escape** e no `onClick` de cada `<Link>`. O caminho óbvio seria um
  `useEffect` no `pathname`, mas `setState` dentro de effect é **erro de lint** neste repo
  (`react-hooks/set-state-in-effect`). Efeito colateral aceito: com a gaveta aberta, o **botão voltar**
  do navegador não a fecha (o toque no fundo resolve);
- o backdrop tem `z-index: 80` — acima do `.back-to-top` (50) e da `.price-bar` (40), abaixo do overlay
  de modal (100). Com isso ele cobre e bloqueia os dois **sem regra extra**.

**UX-13b — a barra fixa.** `MobilePriceBar.tsx`, 56px no rodapé, com preço/peça · margem · markup ao
vivo; um toque rola até o `.result-card`. O requisito do dono ("não pode cobrir nada") virou **três
regras amarradas ao mesmo token `--price-bar-h`**: a barra, o `padding-bottom` do `.wrap.has-price-bar`
(60 → 116px) e o `.back-to-top`, que sobe a altura da barra via `body:has(.price-bar)` — regra posta no
**dono legítimo** do botão (base.css), não como antídoto no CSS de outra área. Se algum dia faltar
`:has()`, perde-se só o deslocamento.

**A faxina que veio no caminho.** O bloco mobile da navbar morava no **`quote.css`** — CSS de outra
área no arquivo da página de orçamento, o mesmo defeito do TD-013. Como o `quote.css` é o 12º `@import`
e o `header.css` o 2º, ele **venceria** o CSS novo na cascata: foi apagado, não sobrescrito.

**Medido no site rodando, antes × depois na mesma sessão** (o "antes" veio de `git stash`, para as duas
medições saírem do mesmo navegador e do mesmo produto):

| | antes | depois |
|---|---|---|
| `.navbar` (375×838) | 227px | **46px** |
| 1º campo do formulário | 421px (48,7% da tela) | **172px (19,9%)** |
| `.wrap` padding-bottom | 60px | **116px** (60 + 56) |
| desktop 1280×900 (navbar · 1º campo · página) | 53 · 240 · 1384 | **53 · 240 · 1384** |

Com a página rolada até o fim sobram **60px** entre o último card e o topo da barra, e o `.back-to-top`
para 2px acima dela. Junto saíram o sublinhado dos 7 `<Link>` (`text-decoration: none` na **classe**,
nunca num seletor `a` nu) e o `.subtitle` no celular (~60px de texto decorativo; decisão do dono).

## Infra — domínio e DNS (detalhe que saiu do `CLAUDE.md`)

`lopolab.com.br` é registrado no **registro.br**, mas a gestão de DNS foi **migrada para o Cloudflare**
(nameservers do registro.br apontando pra lá; o motivo foi o e-mail no domínio). Por isso **nada** de
DNS se mexe no registro.br — CNAME, MX e o resto vivem no painel do Cloudflare.
`calculadora.lopolab.com.br` está no ar: CNAME → `e5d09afaf3e58d32.vercel-dns-017.com`, **"DNS only" /
nuvem cinza** (nunca proxied), SSL Let's Encrypt emitido pela Vercel, domínio nos Authorized domains do
Firebase. O contexto de domínio/e-mail vive em outro projeto de chat do dono ("abertura da loja").

## ✅ FEAT-11 — Trocar a cor na produção, e a cor como dimensão do acabado (2026-08-13)

O pedido do dono era simples de enunciar: *"a mesma peça é impressa em outra cor o tempo todo, e só
dá pra trocar editando o produto no catálogo"*. O que ele destravou não foi.

### As 5 decisões do dono

1. **Escopo: A + C** — liberar a troca pontual na `/producao` **e** fazer a cor virar dimensão da SKU
   do acabado. A opção B (variantes pré-aprovadas no produto) ficou de fora.
2. **Encomenda não escolhe cor** — a venda sob encomenda produz na cor do cadastro. Coerente com o
   código: a encomenda **não credita** o acabado (produz e sai pela porta), então nunca toca uma SKU
   colorida. Trocar cor é na `/producao`.
3. **O seletor aceita avulso livre** — cores do Estoque **+** filamento fora dele (texto + R$/kg).
4. **Chave composta** em peça multicor: "Azul + Branco" é saldo próprio, não "a cor dominante".
5. **Seletor de cor por item na venda de peça pronta**, listando só cores com saldo, default = a de
   maior saldo.

### A correção que veio no meio (e que mudou o desenho)

O plano inicial avisava que "3 corpos azuis + 2 tampas vermelhas = 0 conjuntos". **Estava errado** —
e errado de um jeito que teria quebrado o produto multicor **de projeto** (corpo azul + tampa
vermelha), que é comum. O achado: **subitem é um grupo de etapas** (`Subitem.stageKeys`) e
`SubitemPrice.filaments` são as cores daquelas etapas — ou seja, **o app já sabe a cor de cada
parte**. Daí a regra final:

- **A montagem IGNORA a cor** (`assemblableWholes` soma as cores via `partBalance`). Um conjunto é
  corpo azul + tampa vermelha quando é assim que ele é; exigir cor única zeraria esse produto.
- **A cor vive na PARTE**, e a venda escolhe por parte (um seletor por peça, só quando aquela peça
  tem 2+ cores com saldo — no caso normal a tela não muda).

### O fio que liga a cor à parte certa

A `/producao` agrupa as linhas por **máquina**, mas o acabado é creditado por **subitem**. Sem
ligação entre os dois, produzir o inteiro carimbaria "Azul + Vermelho" nas duas partes. Conserto:
`FilRow` ganhou `stageKey` (as MESMAS chaves do `stageDetails` — `MAIN_STAGE_KEY` / `stageKeyFor`,
que virou exportada), e `submissionColors` recorta as cores por `Subitem.stageKeys`. Resultado:
corpo=Azul, tampa=Vermelho num evento só, **e a troca feita na tela cai na parte certa**.

### O núcleo

- **`colorKeyOf`** (`filaments.ts`, ao lado do `materialsLabel`): cores de uma peça → `{key, label}`.
  Identidade = `filamentId` (renomear a cor **não** parte o saldo) ou `livre:<slug>` no avulso;
  gramas 0 não pintam; ordem canônica (azul+branco ≡ branco+azul); repetida colapsa. Sentinela
  `NO_COLOR` para o que não tem cor.
- **`skuKey(subitemId, colorKey)`** — a chave da SKU virou 2D. Junto vieram `partBalance` (soma as
  cores), `skusOfPart`, `colorsWithBalance` (opções do seletor, maior saldo primeiro, esconde zerada
  e **mostra negativa** — D4) e `WholePart` no `consumeWholeFifo` (cada parte com a sua cor).
- **Estorno não mudou**: `shiftLayers` casa por `layerId`, que já era único por evento+SKU.

### O aviso ATIVO (pedido do dono)

Trocar a cor muda o custo real (FIFO da cor escolhida), mas **não** muda o preço — ele vem do
cadastro. Sem aviso, a margem menor só apareceria depois, congelada na venda. Então `FilRow` guarda
a `origin` (a cor com que o produto foi precificado) e a `/producao` mostra, **por linha**, "trocou
X por Y: R$ 128/kg vs R$ 110/kg do cadastro → +R$ 0,90 por peça"; e **no resumo**, o efeito somado
com a margem resultante ("fica em 36%, precificada 42%"). O `origin` é só para o aviso — o cálculo
usa sempre a cor escolhida.

### Consequências no dado (Diretriz 7 — sem migração)

- SKU sem `colorKey` (tudo que existe hoje) vira o balde **"Sem cor"**, normalizado no `toSku` do
  repositório — um ponto só, para o núcleo puro não carregar `??` em cada função. O saldo velho
  **não** se mistura com o das produções novas.
- **Borda documentada em teste:** cor apagada do Estoque cai no caminho avulso e a SKU passa a ser
  chaveada pelo NOME (`livre:azul`). Recadastrar a cor não junta os dois saldos — mesmo sintoma que
  o badge de cor removida (TD-009) já avisa.

### O que o teste manual pegou (2026-08-15)

Dois dias depois, revisão + teste do dono acharam **dois** problemas — os dois de classes que
lint/build/teste unitário não pegam sozinhos:

1. **A venda estourava no Firestore.** `finishedColors` era um mapa `parte → cor`, e mapa vira **nome
   de campo** no documento; a sentinela do produto sem partes é `__whole__`, exatamente o formato
   reservado que o Firestore recusa (*"Document fields cannot begin and end with `__`"*). O batch é
   atômico, então nada foi gravado pela metade. **Conserto:** o campo persistido virou **lista** de
   `{part, colorKey}` — a sentinela passa a ser um VALOR, e os únicos nomes de campo são `part` e
   `colorKey`. Trocar a sentinela resolveria o caso, não a classe: id de subitem esquisito reabriria
   o furo. Em memória segue `Record`; converte só na fronteira da gravação.
   ⚠ Venda de **subitem** (não do inteiro) chegava a salvar antes do conserto — `subitemId` é nome de
   campo válido. Essas ficam sem a cor congelada ao reeditar (cai no default). Diretriz 7: não migrar.
2. **A aba Produtos mostrava contagem de CORES no lugar do saldo.** Num produto sem subitens, a linha
   exibia `rows.length` com o rótulo "SKUs" — antes do FEAT-11 esse produto tinha sempre UMA SKU, então
   o ramo quase nunca disparava; com a cor na chave ele virou o caso normal, e quem tinha 5 peças em 2
   cores lia "2". Voltou a ser o total de peças ("em N cores"), e a margem do dropdown — que também
   sumia com 2+ cores — voltou pelo custo médio ponderado entre elas.

**Onde:** `filaments.ts` (+`colorKeyOf`) · `finishedGoods.ts` (chave 2D) · `productionPlan.ts`
(`stageKey`, `origin`, `submissionColors`) · `calculatePricing.ts` (exporta `stageKeyFor`) ·
`ProductionPage` (seletor liberado + aviso) · `SaleModal` (cor por parte, congelada) ·
`saleReconciliation` (`ReconItem.colors`) · `StockPage` (saldo por cor na parte) · `SalesPage`
("Cor vendida") · repositórios de acabados e vendas. **+47 testes (376).**

## ✅ FEAT-10 + UX-12 — Arredondamento de varejo e a ordem do card (2026-08-13)

Os dois primeiros do cluster da calculadora. Baratos, mesma tela, sem dependência entre si.

### FEAT-10 — final 4,90 **ou** 9,90

O pedido nasceu como "final X9,90" e o **dono ampliou para 4,90 OU 9,90** no mesmo turno — o que
troca o passo de **10 para 5** e derruba o problema que o backlog levantava: com degraus só de
9,90 o cenário base R$ 27,14 saltava pra R$ 29,90 (+10%) e um preço de R$ 21 ia pra R$ 29,90
(+42%); com passo 5 esse R$ 21 para em **R$ 24,90**. É **um único modo** no seletor (não dois) —
"ou" aqui é o conjunto de finais permitidos, não uma escolha do usuário.

**Implementação:** os dois modos psicológicos viraram a tabela `NINETY_STEP` (`"0.90"` → passo 1,
`"4.90"` → passo 5) e um bloco só: desce ao múltiplo do passo, soma `passo − 0,10`, e se o valor já
passou disso pula um degrau. O `"0.90"` mantém o comportamento anterior byte a byte (passo 1 ⇒
`base + 0,90` / `base + 1,90`). Nada mais mudou: o seletor renderiza `ROUNDING_OPTIONS` sozinho, o
CSV valida contra a mesma lista e o `chargedWithFee` chama o `roundPrice` genérico — o modo novo já
entrou na varredura `ALL_MODES` do `saleContext.test.ts` de graça.

**A regra "nunca pra baixo" vale aqui também**, e ela tem uma consequência assumida: **não existe
degrau abaixo de R$ 4,90**, então qualquer preço menor que isso vira R$ 4,90 (R$ 1,00 → R$ 4,90).
Está travado em teste em vez de virar surpresa. +3 casos (**329 testes**).

### UX-12 — o break-even desceu

O balão "🎯 Meta de Break-Even" estava **entre o preço e as barras de composição**, separando causa
de efeito. Passou pra depois do `breakdown-total` — mais precisamente **depois da linha "Total da
impressão (N peças)"**, pra não partir o bloco de custo ao meio em produto multi-peça. Só ordem de
JSX; nenhum cálculo mudou. O CSS precisou de um `margin-top: 14px` no `.break-even-box` (o
`breakdown-total` não tem margem inferior — sem isso o balão encostava na linha); o catálogo não é
afetado porque `.cd-breakeven` sobrescreve as duas margens e `catalog.css` é importado depois.

## ✅ TD-012 — Rede do `chargedWithFee` + comentário da tarifa (2026-08-13)

Último achado da auditoria. **Nenhuma mudança de comportamento** — teste e comentário.

`chargedWithFee` (`saleContext.ts`) era a única função de dinheiro-que-o-cliente-paga sem teste:
a composição `grossUpForFee → roundPrice → round2`. Novo `saleContext.test.ts` (10 casos, 326
testes no total) trava as propriedades: idempotência sem taxa, o arredondamento do produto
reaplicado sobre o preço inflado (os 6 modos), "nunca abaixo do exato / nunca abaixo do base",
bordas (preço 0/negativo/NaN, taxa negativa/NaN, clamp de 95% ⇒ 20× e não infinito) e
monotonicidade na taxa.

**A borda que o teste documenta:** o `roundPrice` sempre sobe, mas o `round2` que fecha a conta
arredonda ao centavo **mais próximo** — pode cortar até R$ 0,005. No modo `exact`, 100 @ 4,5% cobra
R$ 104,71 (não 104,7120), deixando o líquido R$ 0,002 abaixo dos R$ 100. Irrelevante em R$, mas
agora está travado em teste em vez de ser folclore.

**Comentário da `energyTariff`** (`constants.ts`): dizia "média nacional ~R$0,68" e chamava R$ 0,80
de conservador. Com a projeção ANEEL de ~R$ 0,849/kWh pro fim de 2026 a frase inverteu de sentido —
R$ 0,80 está **abaixo** da média. O valor **fica** (energia é ~1,9% do custo; ir a R$ 0,95 move o
cenário base ~R$ 0,13); só a justificativa foi reescrita.

## ✅ TD-010 + TD-011 — A capacidade produtiva (2026-08-13)

Os dois moram em `calculateCapacity.ts` e **não mudam preço nenhum** — só a projeção de volume e o
faturamento/lucro derivados dela.

### TD-010 — o mês tinha 26 dias de um lado e 30 do outro

`CapacitySettings` ganhou `daysMonth` e virou **subconjunto exato do `FixedCostRate`** — é esse o
ponto: o horizonte que projeta a capacidade e o que rateia o custo fixo passaram a ser o mesmo mês.
Antes o `horizon` era `hoursDay × 30` fixo enquanto o rateio usava `daysMonth` (26), e o fixo/h saía
~13% maior que a capacidade que o justificava.

A **média diária não muda** com isso (numerador e denominador escalam juntos: 200/30 ≈ 173/26); só a
mensal cai. Há um teste travando exatamente essa propriedade.

A segunda metade era a divergência entre páginas: a calculadora semeava o painel com o literal
`DEFAULT_CAPACITY` (1 máquina) enquanto o `/catalogo` já derivava do rate salvo (2). O literal foi
**apagado** do `constants.ts` — as duas páginas derivam de `config/negocio`.

**Decisão do dono (o painel da calculadora):** semear do rate salvo **e permitir simular**. Os campos
seguem editáveis, mas a edição vira um **override local** (`capacityOverride`, não persiste, não toca
no preço) com aviso "simulando — voltar ao padrão". Descartadas: travar o painel (perderia o "e se eu
dedicasse 3 máquinas?") e write-through pro Firestore (mexer em "máquinas dedicadas" pra simular
mudaria o rateio do fixo e, portanto, o preço de **todo o catálogo** em silêncio). O override existe
em vez de um `useState(semente)` porque o `fixedCostRate` chega **assíncrono** do Firestore — semear
no estado inicial congelaria o default.

Ganhou também o 3º campo "Dias de impressão/mês" (sem ele o número mensal fica inexplicável) e o
rótulo `📅 Mensal (26d)` no lugar do `(30d)` cravado.

### TD-011 — ciclo ≠ peça vendável

`piecesMonth`/`piecesDay` (e o `piecesMonth` de cada máquina no breakdown) passaram por
`× (1 − falha)`, com `floor`. `cyclesMonth`/`cyclesDay` **não** mudaram: a máquina roda a impressão
que falha do mesmo jeito — é justamente por isso que sobra menos peça boa no mês.

**Não há dupla contagem** com a reserva de falha do preço: a reserva paga o **material** perdido,
este fator conta a **máquina ocupada**. Eram os dois lados da mesma moeda, e só um estava
implementado — a falha inflava o preço e deixava a receita projetada intacta.

O clamp da taxa (percentual → fração, teto de 95%, default `DEFAULT_FAILURE_RATE`) foi extraído pra
`failureFractionOf`, exportada do `calculatePricing.ts` e usada pelos dois: o mesmo número que infla
o custo deflaciona o volume, não dois clamps parecidos. O `CapacityResult` carrega `failureRatePct`
para a UI poder dizer que "peças" são peças **boas** (mesma disciplina de rótulo do UX-09/UX-10).

**Efeito no cenário base** (40g/3h/A1, 20h/dia): a capacidade por máquina cai de 200 para **167**
peças/mês (−13% dos 26 dias, −3% da falha); na calculadora o painel passa a usar as **2 máquinas**
do negócio, então o número na tela vai de 200 pra ~334 — e agora bate com o `/catalogo`.

## ✅ UX-09 + UX-10 — Os dois rótulos honestos da auditoria (2026-08-13)

Dupla de "o número não está errado, está **incompleto no lugar onde a decisão acontece**".
Nenhuma mudança de cálculo em nenhum dos dois — só exibição.

**UX-09 (`/maquinas`)** — o payback soma `sale.profit` (receita − COGS real − taxa), que **não**
desconta custo fixo (aluguel) nem as impressões `outcome: "falha"` (queimam filamento e horas sem
abater nada em lugar nenhum) ⇒ a barra enche mais rápido que o caixa, e a decisão que ela alimenta
é "compro outra máquina?". Guarda-rail em 3 pontos: nota de aviso no topo (`.roi-note.roi-warn`,
filete no accent), uma linha por card sob a barra de payback (`.roi-caveat` — viaja junto do número
pra quem rolou e não vê mais a nota), e o `sales-total-sub` do "Lucro acumulado" virou "líquido de
taxas · bruto de custo fixo". **Paliativo por design:** o número honesto só existe quando o
[Dashboard] consolidar fixo + perdas — e é ele quem deve virar a fonte do payback.

**UX-10 (catálogo + calculadora)** — `PricingResult.margin` é **bruta, pré-taxa**: mostra 54% (base
pós-DEC-03) onde o crédito 3× Amex/Elo rende 46,8%. O `SaleModal` sempre calculou certo, mas aí a
venda já está acontecendo; **a decisão de preço acontece antes**. Duas funções puras novas em
`paymentFees.ts` — `worstPaymentFee(fees)` (varre forma × bandeira × parcela e devolve a maior taxa
+ rótulo legível; `null` quando tudo é isento, aí não há contraponto) e `netMarginPct(preço, custo,
taxa)` (delega ao **mesmo** `saleItemFinancials` da venda real, pra os dois números não divergirem).
Componente `NetMarginHint` em 3 superfícies: célula "Margem" da tabela (modo `compact`: "47% líq."),
card expandido do catálogo e card de preço da calculadora (modo cheio, nomeia o meio de pagamento).
`title` em todas com a taxa exata. +7 testes (311 no total).

**Por que a matemática é trivial e ainda assim virou função:** sem repasse, margem líquida =
margem bruta − taxa (em pontos). O valor de `netMarginPct` não é a conta, é a **fonte única** — se o
repasse ou o desconto mudarem o cálculo da venda, o catálogo acompanha de graça.

**Fiação:** `CatalogPage` e `PricingCalculator` passaram a chamar `useFees()` (só exibição — nenhuma
taxa entra no preço; o repasse continua escolha da venda). CSS compartilhado `.margin-net-hint` em
`base.css` porque as 3 superfícies moram em arquivos de área diferentes.

## ✅ DEC-02 + DEC-03 — As duas decisões da auditoria (2026-08-13)

Vieram da auditoria técnica de 2026-08-13. **Nenhuma era bug** — a matemática do app estava correta;
eram escolhas de negócio parametrizadas em código. O dono martelou as duas no mesmo dia.

### DEC-02 — `lifeHours` 10.000 h → **7.500 h**

O único parâmetro que movia o preço em dois dígitos. O argumento original do código estava **certo**
(bico, placa PEI e filtro saíram para o `maintenancePerHour`, então a vida *estrutural* deve mesmo ser
maior que as 5.000 h das calculadoras de referência) — só que 10.000 h era o **extremo** dele, não o
centro. Deixava a A1 a R$ 0,65/h de depreciação + manutenção contra R$ 1,06/h da referência (−39%).

| `lifeHours` | Custo/h da A1 | Preço do cenário base (40 g / 3 h / A1) |
|---|---|---|
| 10.000 (antes) | R$ 0,65/h | R$ 35,81 |
| **7.500 (escolhido)** | **R$ 0,83/h** | **R$ 37,45** (+4,6%) |
| 5.000 (referência) | R$ 1,18/h | R$ 40,72 (+13,7%) |

**Onde:** `constants.ts` (`DEFAULT_MACHINES` + o comentário auditado) e `MachineManagerModal.tsx`
(padrão de máquina nova). ⚠ **Esses valores só SEMEIAM o doc `config/machines`** — as máquinas já
cadastradas guardam o próprio `lifeHours`, então a mudança **não** as alcança: o dono edita as duas à
mão em `/maquinas` (2 campos). Não foi escrita migração — Diretriz 7, e a alternativa (código que
sobrescreve máquina salva) apagaria edição legítima do dono.

### DEC-03 — markup **deixa de incidir** sobre a mão de obra

Mudança de fórmula, escolhida pelo dono contra a recomendação de manter:

- **Antes:** `(material + energia + depreciação + manutenção + labor + falha) × markup + fixo`
- **Agora:** `(mesma base, SEM labor) × markup + labor + fixo`

**Por quê:** labor é **~42% do custo** do cenário base (mais que o material, 37%) e o markup o
amplificava — a fórmula antiga tratava hora de trabalho como produto de prateleira. A de referência
trata como repasse (serviço sob encomenda). Nenhuma das duas é errada; o dono escolheu a segunda.
Efeito isolado no cenário base: **R$ 35,81 → R$ 25,50 (−29%)**. Combinado com o DEC-02:
**R$ 27,14** (−24% contra o preço de antes das duas decisões).

**A reserva de falha continua cobrindo o labor.** Isto é deliberado e preserva a decisão irmã do
Tier 4 ("labor na reserva de falha: **manter**"): uma impressão perdida também perde a hora de
trabalho. O que sai da base do markup é `labor × (1 + failureK)`, não o labor puro — por isso o
número dá **R$ 25,50** e não os R$ 25,34 citados na auditoria, que tirava o labor da reserva também.
A diferença é R$ 0,16; a coerência entre as duas decisões vale mais.

**Onde:** `calculatePricing.ts` nos **dois** caminhos — o produto inteiro (`failureK` +
`laborPassThrough`) e o rateio por subitem (`computeSubitems`, que passou a receber `failureK`).
A aditividade **Σ subitens = inteiro** continua valendo: Σ labor dos subitens = labor total e o
coeficiente da reserva é o mesmo, então o repasse soma exato. O label do slider virou
"📈 Markup sobre o custo (sem mão de obra)" (`ProductForm.tsx`).

**O que NÃO mudou:** `totalCost`, `variableCost`, `profitPerPiece` e a fórmula da `margin` são os
mesmos — custo é custo, independente de como o preço é montado. A margem apenas **cai** (66,7% →
54,0% no cenário base sem falha), porque a mão de obra agora entra a preço de custo e dilui.
**+2 testes** (o repasse de +R$ 5 de labor vira +R$ 5 no preço, e +R$ 6,25 a 20% de falha).

## ✅ UX-06 + UX-07(a) — Cluster "linha + dropdown de detalhe" (2026-08-10)

Pedido do dono (2026-08-10): unificar o padrão de "abrir detalhe" do catálogo nas outras listas. Três
superfícies viraram **linha clicável + dropdown**: o item do recibo em `/vendas`, a produção recente em
`/producao` e a aba **Produtos** do estoque. Só **apresentação** — dado intacto, matemática inalterada
(294 testes seguem verdes); build/lint limpos.

**Decisão-chave — o dropdown absorve o `CostDetail`.** O popover de composição de custo saiu dessas
listas. Para não duplicar a tabela (precificado × real, provisões, totais, nota), extraí a parte interna
do `CostDetail` num subcomponente exportado **`CostBreakdownTable`** (`CostDetail.tsx`), renderizado
**inline** dentro de cada dropdown. O `CostDetail` (gatilho + Popover API na top-layer) passou a reusar
esse mesmo subcomponente e **continua como popover** só onde o popover faz sentido: a venda **VIVA** do
`SaleModal` (modal com scroll) e o **tile de totais** da aba Produtos (agregado, não é linha).

**CSS reescopado:** as regras da tabela mudaram de `.cost-detail-pop .cost-detail-table` para
**`.cost-detail-body`** — o wrapper que agora envolve a tabela nos dois contextos (dentro do popover E
inline). O prefixo continua blindando contra `.recibo-items td` (nowrap/padding/borda) por
especificidade, e o `table-layout: fixed` + `min-width: 0` seguem anulando o `table { min-width: 600px }`
global.

**Por superfície:**
- **`/producao`** (fácil, lista plana): `.prod-card` empilhou head (linha) + `.prod-card-details`; o custo
  na linha virou texto simples e a composição desceu pro dropdown, junto de máquina, tempo, desfecho/modo,
  filamento por cor e observações.
- **aba Produtos (UX-07a)**: os cards saíram da grade `.stock-list` pra uma coluna `.fg-list`; a linha
  (`.fg-head`) mostra nome + valor parado (texto) + saldo, e o `.fg-details` carrega avisos, partes,
  barras (`renderCostBars`), margem congelada e o `CostBreakdownTable`.
- **`/vendas`** (aninhado): cada item da `.recibo-items` ganhou um `<tr className="ri-details-row">` irmão
  (Fragment), aberto por `openSaleId`; o dropdown traz máquina, tempo, qtd, **desconto congelado**
  (FEAT-09), filamento por cor e a tabela precificado × real.

**UX-07(b) ficou de fora** (ligar o acabado aos eventos de `producao` que o geraram): puxa buscar
`producao` por `productId` sob demanda (pós-TD-006 a coleção não é assinada inteira) — a mesma agregação
server-side do painel, adiada pro **Dashboard**.

## ✅ FEAT-09 — Desconto na venda (2026-08-10)

Pedido do dono (2026-08-07): dar desconto ao registrar a venda, com lucro/margem recalculando **sobre o
preço COM desconto** (não o de tabela). **Escopo (decisão do dono):** por **item** _XOR_ no **total** do
recibo — um modo ou o outro por venda, nunca os dois. **Formato:** R$ ou %.

**Modelo (congelado, Diretriz 7):** `SaleInput` ganhou `discountKind` (`"item"|"total"`), `discountInput`
(`{mode:"abs"|"pct", value}` — o que o dono digitou, p/ exibir "10%") e `discountAmount` (o **R$ efetivo**
da linha; no modo total, já a fatia rateada). Congelados no snapshot; `profit`/`margin`/`feeAmount` já
entram líquidos. Custo real **não muda** → lucro = preço_com_desconto − custo real.

**Matemática (`paymentFees.ts`, testada):** `discountAmountOf(base, discount)` (clamp: nunca <0 nem >base,
% até 100%, round2); `saleItemFinancials` ganhou `discountAmount` — receita = bruto − desconto e a **taxa
incide sobre o valor JÁ com desconto** (é o que a maquininha cobra); `apportionDiscount(lineGross, total)`
rateia o desconto-total **proporcional à receita bruta** de cada linha, com o resíduo de arredondamento na
última linha (Σ fatias = desconto total). **Duas decisões confirmadas pelo dono (2026-08-10):** taxa sobre
o valor com desconto; rateio proporcional à receita.

**UI (`SaleModal`):** seletor de modo (Nenhum/Por item/No total) reforça o XOR; campo `DiscountInput`
(número + toggle R$/%) por item ou no total; resumo mostra Subtotal/Desconto/Receita quando há desconto.
Round-trip na edição (reconstrói o modo do recibo salvo). Exibição em `/vendas` (nota "−R$X" na linha,
"(rateado)" no modo total) + coluna no CSV. `toSale`/`saleToDocument` (salesRepository) leem/gravam os 3
campos. Sem migração de venda antiga (Diretriz 7): sem os campos, a tela mostra a venda como sempre.

## ✅ UX-03 (nome do produto truncado no catálogo) — 2026-08-10

Efeito colateral do FEAT-08 (a faixa de Ações cresceu p/ 146px): o `.col-name` corta com reticências e o
`title` só se lê no hover — inútil em toque/mobile, e o painel expandido não repetia o nome. **Fix:** o
painel expandido (`CatalogDetails`) abre com o **nome inteiro** num `<h3 class="cd-product-name">`
(`overflow-wrap: anywhere`, quebra em várias linhas). `title` na linha fechada mantido pro hover no
desktop. Só `ProductCatalog.tsx` + `catalog.css`.

## ✅ TD-006 (paginação) + UX-05 Fase 2/3 (busca em vendas/produção) — 2026-08-10

**O problema:** `/vendas` e `/produção` assinavam a **coleção inteira** (`onSnapshot` sem limite). Ok
com dados de teste, mas o **marco** (recadastro de tudo de uma vez — Diretriz 7) chega como um volume
grande; paginar importa *no* marco. UX-05 (busca por nome) foi acoplada porque tem a mesma raiz: ao
paginar, a busca client-side da Fase 1 só varreria o que está carregado — precisa virar query no banco.

**Fase 2 — paginação (limite crescente + realtime):** hooks novos `useSalesPage`/`useProductionPage`
substituem `useSales`/`useProduction` nas duas listas. Assinam `query(orderBy(saleDate|at desc),
limit(pageLimit+1))` — o `+1` diz se há mais (`hasMore`) sem uma contagem à parte; "carregar mais"
re-assina com limite maior (padrão **limite crescente**, não cursor `startAfter` — a query roda do topo
de novo, então empates no limite nunca pulam doc). **Um `orderBy` só ⇒ dispensa índice composto** (o
Firestore auto-indexa cada campo nas duas ordens). Os `useSales`/`useProduction` cheios **continuam** —
o ROI (`/maquinas`) os usa (agrega o histórico inteiro; a ressalva registra que isso só some com
agregação server-side no Dashboard).

- **Totais server-side:** os cards de /vendas passaram a somar o histórico INTEIRO via **aggregation
  query** (`fetchSalesTotals` — `sum`/`count`, 1 leitura, não baixa docs). A /produção usa
  `fetchProductionCount` p/ "X de N". Decidido com o dono (a alternativa "só do carregado" foi descartada).
- **Estorno desacoplado da janela (bug latente consertado):** o estorno de venda/edição resolvia os
  eventos de produção da encomenda pela **lista em memória** (`production.find(id)`); com a janela
  paginada, um evento antigo fora dela não seria achado e **o estoque não estornaria**.
  `fetchProductionEventsByIds` resolve por id direto no banco. `SaleFlow`/nova venda passam
  `production=[]` (venda nova não estorna); a edição em `SalesPage` busca os eventos por id ao abrir.
- **Export CSV** lê tudo sob demanda (`fetchAllSales`) p/ não truncar.
- ⚠ **Recibo no limite:** itens do mesmo dia não são contíguos (empate por `__name__`), então um recibo
  pode aparecer partido no limite da página até "carregar mais". Os cards não erram (vêm da agregação).

**Fase 3 — busca ("os dois juntos", decisão do dono):** o Firestore **não faz substring de texto**
server-side. Então: **filtro produto + período** vai ao banco, **caixa de nome** refina no cliente.
- **Produto:** `where("productId","==",X)` — **equality-only, sem orderBy** → traz o conjunto todo do
  produto (naturalmente limitado), refina período **no cliente** e não pagina. Evita de propósito o
  índice composto equality+range.
- **Período:** range em `saleDate`/`at` — **mesmo campo do `orderBy`** → sem índice composto. Como
  `toTimestamp` ancora ao **meio-dia**, toda venda/evento do dia tem o mesmo timestamp e `>= start && <=
  end` (ambos meio-dia) fica exato e inclusivo, sem off-by-one.
- **Totais/contagem respeitam o filtro:** agregação recebe o período; no caminho de produto soma-se
  local (`totalsOfSales`) sobre o conjunto carregado.
- **Nome:** `matchesQuery` (helper da Fase 1) sobre a janela — casa produto/cliente (vendas) ou
  nome/observações (produção). Não mexe nos totais (que refletem o filtro server-side).
- **UI:** `HistoryFilterBar` (novo) compartilhado — seletor de produto + datas de/até + `SearchBox`. O
  reset da janela ao trocar filtro usa o padrão do React de **ajustar estado no render** (chave derivada),
  não `setState` em effect (o lint proíbe).

## ✅ TD-003 (capacidade pelo gargalo) + UX-04 (catálogo multi-máquina) — 2026-08-04

**O defeito:** `calculateCapacity` **somava** as horas de todas as etapas e dividia o horizonte
mensal por esse total — como se uma única máquina ficasse ocupada a soma inteira. Num produto que
imprime em duas impressoras (A1 3h + X2D 2h/peça) isso **subestima**: as máquinas rodam em
**paralelo**, e quem limita o ritmo é a mais ocupada (o gargalo), não os 5h somados.

**Decisão do dono (neste chat):** o painel é uma **estimativa branda** ("quanto consigo fazer e qual
faturamento") — por isso os dois botões (máquinas dedicadas + horas/dia) **ficam**. Modelo escolhido:
**gargalo/paralelo**. O número muda **só** em produto multi-máquina; produto de 1 máquina fica
idêntico (`max === soma`), então os testes antigos seguem verdes (o teste da "etapa extra" usava duas
etapas na MESMA `a1`).

- **De onde vêm as horas por máquina:** `PricingResult.machineUsage` já existia (FEAT-04c/TD-003 base).
  Ele é **por peça** (dividido por `pieces` em `calculatePricing.ts`), então `calculateCapacity`
  multiplica de volta por `result.pieces` para voltar ao tempo por **impressão/ciclo**. `bottleneckHours
  = max(cycleHours)`; `cyclesMonth = floor(horizonte / bottleneckHours) × máquinas`.
- **`CapacityResult.machineBreakdown`** (campo novo): uma entrada por máquina distinta, ordenada da
  mais ocupada; `piecesMonth` = capacidade SE aquela máquina fosse o único limite. A do gargalo bate
  com o total; as outras aparecem como **folga** no `CapacityPanel` (linha só visível se >1 máquina).
- **UX-04:** `MachineCell` (novo, em `ProductCatalog.tsx`) lista as máquinas distintas de
  `machineUsage` — "A1 +1" compacto na linha (com `title` da lista inteira), lista completa no painel
  expandido. Mantém o `machine-missing-badge` (TD-009). Substituiu os dois pontos que mostravam só
  `result.machine.name` (a principal).

## ✅ FEAT-06 — Composição de custo congelada na produção (2026-07-20)

Matou o **stopgap do COGS**: até aqui a venda de peça pronta gravava `costBreakdown` = snapshot do
catálogo **vivo** enquanto o `unitCost` vinha do FIFO real — os dois não somavam o mesmo número, e
detalhar a venda mostrava a estimativa fingindo ser o gasto. A causa era só uma: `productionCost()`
já devolvia 6 componentes, mas o save guardava só o `.total`. Entregue em 7 commits.

**Por que não dava para reconstruir depois** (o argumento que definiu a prioridade): material e
insumos até sairiam dos arrays `filaments`/`supplies` congelados, mas energia/desgaste/manutenção
teriam que ser recalculados da **máquina viva** (editar watts faria os componentes pararem de somar o
total gravado) e a **mão de obra não estava gravada em lugar nenhum** do evento. Cada impressão
registrada sem o breakdown é uma composição perdida para sempre — daí os passos 1-5 (o dado) virem
antes dos 6-7 (a tela).

- **`FrozenCostBreakdown` (tipo novo, não `SaleCostBreakdown`).** Reusar o da venda obrigaria a gravar
  `failureReserve: 0`/`fixed: 0` (zeros indistinguíveis de "não houve", e provisão zerada num quadro
  de custo **real** é ruído) e a renomear `supplies`→`accessories`, batendo em `calculatePricing`,
  `saleContext`, `salesRepository` e 6 asserts. `ProductionCostBreakdown` passou a **derivar** dele
  (`& { total }`), então os 6 componentes têm uma definição só. Sem `total` no tipo persistido: é
  derivável (`sumFrozen`) e dois campos que precisam bater são convite a drift.
- **A regra que sustenta o invariante `Σ componentes === total`:** nunca calcular total e componentes
  por caminhos diferentes. `submissionEntries` foi reescrita para derivar **um fator escalar**
  (`share / units`) e aplicá-lo aos dois — antes o rateio e a divisão por unidades eram duas
  expressões que precisavam concordar.
- **Overdraft (D4) foi o ponto nº 1 de bug.** O breakdown do `consumeFifo` **não pode** ser acumulado
  dentro do laço FIFO: as linhas que engrossam o move da camada mais nova rodam **depois** dele, e a
  fatia excedente ficaria de fora, deixando os componentes menores que o `cost`. É calculado no final,
  a partir dos moves já fechados, com `Map<layerId, layer>`. Há teste dedicado.
- **`costUnknown`/`unknown` em vez de zeros sintéticos.** Camada anterior ao FEAT-06 não vira
  `{material: 0, …}` — isso mentiria na tela ("Material R$ 0,00"). Vai para um campo separado, exibido
  como "não detalhado", e `sumFrozen(breakdown) + unknown === total` continua valendo.
- **A venda guarda os DOIS breakdowns** (decisão do dono, contra a letra do backlog): `costBreakdown`
  segue sendo o **precificado** — é a metade esquerda da comparação estimado × real, e o
  `machineRoi.ts:63` lê a depreciação dele — e entra `realCostBreakdown` novo. Não grava quando a
  composição é parcial: meia composição engana mais que nenhuma, e `unitCost`/lucro/margem continuam
  corretos de qualquer forma. **Follow-up registrado:** migrar o `machineRoi` para a depreciação real.
- **`FinishedMove` de propósito NÃO ganhou breakdown** — ele só serve ao estorno (por `qty`/`layerId`),
  e 6 números por move seriam peso morto no doc da venda.
- **UI:** `CostDetail` ganhou 3 modos (só precificado / **2 colunas** / só real). O par
  acessórios × insumos divide linha com nomes diferentes dos dois lados de propósito (no preço é o item
  do catálogo, no real é a baixa do estoque). Uma linha some só quando as **duas** colunas são zero —
  senão um componente que existe só de um lado sumiria. A `/producao` rotulou os dois números órfãos
  ("custo real gasto") e os tornou detalháveis. A aba Produtos ganhou popover de composição do valor
  parado, custo médio por SKU, mini-barras (CSS puro, `flex-grow` proporcional) e margem congelada.
- **`CostBars`/`ProfitSummary` NÃO serviram** (o backlog citava os dois): consomem `PricingResult` —
  produto **vivo**, com markup e preço sugerido — que é exatamente o que o FEAT-06 recusa.

35 testes novos (álgebra, plano, rateio × units, overdraft, camada antiga, `qty=3` para pegar o ÷qty
esquecido) — **281 no total**. Zero migração (Diretriz 7).

## ✅ 7e — Insumos no estoque + baixa do acessório na produção (2026-07-20)

Fechou o **buraco de COGS**: acessórios já entravam no preço (`calculatePricing.ts`) mas ficavam de
fora do `frozenCost` da produção, então o lucro por peça do histórico saía superestimado. Entregue em
3 commits.

- **Núcleo do FIFO extraído** para `lib/fifo.ts` (`fifoSort`/`simulateFifo`/`shiftLots`): a regra do
  D4 (overdraft no lote mais novo) passou a ter UMA implementação, usada pelo filamento (gramas ×
  R$/kg) e pelo insumo (unidades × R$/un). `lib/stock.ts` delega; os 190 testes existentes foram a
  rede de segurança da extração.
- **Coleção nova `insumos`** (não `estoque`): o `subscribeStock` devolve a coleção inteira tipada como
  cor e o estorno filtra por `stockId` — insumo no meio das cores exigiria um discriminador em toda
  leitura, sem economizar nada. `lib/supplies.ts` espelha o `stock.ts` (saldo, FIFO, ajuste D6,
  extrato D6.1, guarda do excluir).
- **`Accessory.supplyId`**: ligado, o nome e o preço são **copiados** do insumo (denormalização
  deliberada — mantém `calculatePricing` e seus ~10 call sites sem conhecer o estoque, e espelha o
  `pricePerKg` que a `FilamentUsage` já congela). Sem ligação, segue **avulso**: entra no custo, não
  dá baixa — o mesmo caminho do filamento avulso.
- **Escala (o ponto sutil):** `Accessory.qty` é POR PEÇA, a linha-evento é POR PLACA. `accessoryRows`
  multiplica por `piecesCount` na origem, e daí o `scaleRow` escala por placas junto com as gramas,
  sem fator especial. Produto **multi-máquina** vira N eventos → os insumos vão só na **1ª linha**
  (repetidos, um produto em duas impressoras consumiria o ímã duas vezes). Produção de **subitem**
  leva só o acessório atribuído a ele: o não-atribuído é rateado no PREÇO, mas fisicamente não sai da
  gaveta ao imprimir uma parte só.
- **`productionCost` agora soma `supplies`** — e é só isso que fecha o COGS: tudo a jusante
  (`summary.frozen` → `submissionEntries` → `FinishedLayer.unitCost` → COGS da venda) propagou sozinho,
  sem tocar `finishedGoods.ts`. Reserva de falha e custo fixo **seguem fora** (são provisões de
  pricing, não custo físico).
- **Zero migração**, como o D1 previu: `StockMove.kind` já era `"filament" | "supply"` desde a 7a e o
  repositório já serializava o campo. `reverseProduction` passou a filtrar por `kind`; nasceu o
  `reverseSupplies` espelho. Batch da produção e o da venda (encomenda) ganharam `supplyUpdates`.
- **UI:** `/estoque` virou 3 abas (Filamentos · Insumos · Produtos), a nova num componente próprio
  (`SuppliesTab` + 3 modais espelhados). A `/producao` lista os insumos da submissão e avisa falta de
  saldo ao lado dos avisos de rolo.

56 testes novos (fifo, supplies, planSupplies/estorno, escala do productionPlan) — 246 no total.

## ✅ FEAT-08 — Produzir/Orçar/Vender no card do catálogo (2026-07-20)

Card e linha do catálogo ganharam as 3 ações, para o inteiro **e por subitem**. **Seed cross-page:**
`?produto=<id>&subitem=<subId>` — contrato único que cada destino traduz pro formato interno dela
(`ProductionPage` monta a chave `sub:`/`whole:` e chama o `selectOption` existente; `QuotePage` acha a
opção e anexa a linha). Preferido a pôr `?item=sub:a:b` na URL, que vazaria o formato de chave da
produção pro orçamento. **A opção 1 do backlog (derivação pura) NÃO era viável:** selecionar produto na
`/producao` também constrói `rows` (linhas de evento editáveis) e "orçar" anexa um `QuoteItem` — estado
editável não se deriva de query; e como os produtos chegam por assinatura, nem `useState` com
inicializador preguiçoso serve (lista vazia na 1ª renderização). Ficou a **opção 2** (ajuste durante o
render + `handledSeed`), idêntica ao FEAT-07, com `<Suspense>` nas duas rotas (seguiram estáticas).
**Regra permanente (vale pra qualquer seed futuro):** `setState` dentro de `useEffect` é **barrado pelo
lint** (`react-hooks/set-state-in-effect`, vem do `eslint-config-next/core-web-vitals`, não é regra
local) — e além de barrado é pior, pinta a tela no estado intermediário. **Não desligar a regra.**
**Venda de subitem saiu quase de graça:** `saleContextFromSubitem` já existia do FEAT-01 e o `SaleModal`
já tratava `subitemId` no saldo de acabado e no payload da reconciliação — só faltava quem chamasse.
**Coluna "Ações" — armadilha do CSS (custou um bug em produção):** a linha do catálogo **não é tabela,
é `display: grid`** (`.main-row`, `catalog.css`), e a última faixa do `grid-template-columns` era fixa em
**76px**. Com 5 ícones (~143px) o `justify-content: flex-end` empurrava o excedente pra esquerda e o
`overflow: hidden` do `.main-row td` **cortava exatamente os 3 novos** — invisíveis no desktop, ok no
mobile (lá a `responsive.css` transforma a célula em faixa de largura total). Faixa foi pra **146px**,
gap 4px, ícones 24px, divisor agrupando `[Vender][Produzir][Orçar] | [Editar][Excluir]`.
⚠ **As regras `position: sticky` de `th/td.col-actions` (~linha 536) são MORTAS** — sobrescritas por
`position: static` no bloco de ~655. Raciocinar por elas leva ao diagnóstico errado; foi o que aconteceu.
**Custo medido do alargamento:** entre 760 e ~860px de viewport o nome do produto passa a truncar com
reticências (comportamento já projetado da coluna); acima de ~860px nada muda. **Borda:** produto excluído ou subitem removido entre o
clique e o load ⇒ ignora em silêncio e limpa a URL (cair pro inteiro sem o dono pedir seria pior — a
produção grava estoque).

## ✅ UX-01 — Barra de navegação unificada (2026-07-19)

Antes, cada uma das 6 páginas montava seu próprio `header-actions` com um subconjunto ad-hoc dos
links (a raiz mostrava 5 rotas; as demais só 2-3), então pular entre duas páginas quase sempre exigia
voltar pela calculadora. Extraído o componente `NavBar.tsx` (`features/pricing-calculator/components/`):
6 destinos fixos na mesma ordem (Calculadora `/` · Vendas · Orçamento · Impressoras · Estoque ·
Produção) + botão de tema + `LogoutButton`, com a rota ativa marcada via `usePathname()` +
`aria-current="page"` (estilo `.icon-label-button[aria-current="page"]` em `forms.css`). O `Header` da
raiz e os 5 headers de página (`SalesPage`/`QuotePage`/`MachinesPage`/`StockPage`/`ProductionPage`)
passaram a delegar ao `NavBar`, cada um mantendo o próprio `.brand`/cloud-status. `SalesPage` injeta a
ação "Nova venda" via `children` (renderizada antes dos links). Decisão do dono: **"Início/Calculadora"
= navegação limpa** — o reset por `window.location.reload()` continua só no clique do brand "Lopo Lab ✦"
da raiz. (Nota: existe um "UX-01" antigo neste arquivo — o do `NumberInput`/zero à esquerda —, item
diferente que só reaproveitou a sigla.)

## Backlog (ideias do brainstorm com ChatGPT, não implementadas)

> Do brainstorm original, **já feitas**: taxa de falha e reserva de manutenção. As de baixo
> ficaram pendentes. **Ordem reavaliada (jul/2026)** — não é mais a do ChatGPT; ver "Notas de
> arquitetura" no fim. Contexto que pesa: **o negócio já está vendendo de verdade**, então a
> captura de venda é urgente (histórico não se cria retroativamente). Reavaliar antes de pegar
> — o dono decide o que entra.

**Princípios que reordenam o backlog:**
- **Separar captura de análise.** *Capturar* a venda é barato e destrava tudo → fazer já.
  *Analisar* (dashboard) só vale com dado acumulado → adiar. Cada dia sem registrar = dado
  perdido pra sempre.
- **Venda = foto congelada.** O app hoje é calculadora ao vivo (produtos guardam só entradas
  brutas e recalculam; editar watts de máquina muda o custo de todos retroativamente). Um
  registro de venda **tem que congelar** custo/preço/margem no momento da venda — não pode ser
  link pro produto vivo. Decisão de design mais crítica do conjunto.
- **Páginas separadas (rotas).** A calculadora (`/`) já está densa; histórico/dashboard/estoque
  entram como **rotas novas** do App Router (`/vendas`, `/painel`, `/estoque`), não empilhados
  na tela atual. PDF **não** é página — é botão de exportar no card.
- **Risco:** dashboard/estoque só pagam se o hábito de marcar cada venda pegar. Marcar tem que
  custar ~5s, senão o dado fica furado e a ferramenta morre.

**Ordem recomendada:**

1. **Captura de venda + Histórico** *(rota `/vendas`)* — **Fase 1a ✅ FEITA.** Botão
   "Registrar venda" no card → `SaleModal` congela snapshot em `vendas` (Firestore); rota
   `/vendas` com totais, tabela, excluir e CSV. Fundação dos itens 3 e 4.
   **Fase 1b ✅ FEITA: cesta/recibo** — modal virou cesta (N itens em batch compartilhando
   `reciboId`), `/vendas` agrupa por recibo em cartões. **Editar recibo ✅ FEITO** — botão
   editar em cada recibo reabre o `SaleModal` em modo edição; grava atômico via `saveRecibo`
   (upsert + delete), que unificou registrar e editar.
2. **Geração de orçamento (PDF)** — **✅ FEITA (avulso).** Rota `/orcamento` (`QuotePage`):
   monta itens só pra cotação (catálogo ou livre), sem registrar venda; `generateQuotePdf`
   (jspdf) baixa o PDF com nº, cliente, data, itens, total, validade + **logo placeholder**
   (impressora). **Histórico** já FEITO (coleção `orcamentos`, re-baixar/excluir na `/orcamento`;
   numeração derivada do histórico). Dados do negócio no Firestore (`config/orcamento`). Opcional
   que sobrou: **branding** real (trocar o placeholder pela logo — já há comentário no código).
3. **Controle de estoque** *(rota `/estoque`)* — **MODELO APROVADO (jul/2026), a codar.** Cadastrar
   filamento (e depois insumos: ímãs, parafusos, rolamentos, chaveiros, embalagem) e dar **baixa
   automática** ao registrar a venda — unindo custo + venda + estoque num fluxo só. **Depende do
   item 1** (feito) e do **FEAT-02 lado-produto** (feito — `filamentId` já existe em todo
   `FilamentUsage`, hoje `null` → **nenhuma migração**).

   **Decisões do dono (fechadas — não rediscutir sem ele):**
   - **(D1) Filamento e insumos são entregas SEPARADAS**, uma por chat. Filamento primeiro (o
     `filamentId` já está plugado); insumos depois (item 7e), porque `Accessory` é `{desc, qty,
     unitPrice}` **texto livre, sem gancho** — ligá-lo ao estoque é um FEAT-02 inteiro do lado do
     acessório (tipo novo, migração texto→referência, UI, snapshot, baixa por unidade). **Não dá pra
     inverter a ordem** (o `supplyId` precisaria apontar pra um cadastro que ainda não existe), MAS
     o `stockMoves` da venda **nasceu genérico já na 7a** (`kind: 'filament' | 'supply'`, e o
     `stockId` aponta pra cor OU pro insumo) — senão a 7e forçaria **migrar documentos de venda já
     gravados**.
   - **(D2) Filamento = COR no dropdown, ROLOS por baixo (híbrido).** O produto aponta pra **cor**
     (`StockFilament`, id **estável**); os **rolos** (`FilamentRoll`) vivem dentro dela, cada um com
     o preço real pago, consumidos **do mais antigo pro mais novo** (FIFO). **Por que não SKU
     simples** (chegou a ser decidido e foi revertido): o dono cadastra **por rolo** e arquiva o rolo
     quando acaba — se a entrada FOSSE o rolo, o `filamentId` do produto apontaria pra algo
     descartável e **todo produto da cor ficaria órfão a cada rolo que termina** (e, com D3, cairia
     em silêncio no preço de fallback). O híbrido dá o id estável pro produto e o descarte pro rolo.
     Rolo zerado **fica no array** como histórico de compra (a UI esconde atrás de "rolos
     anteriores"); serve de base pra "quanto gastei em filamento".
   - **(D3) Preço/kg é VIVO, vem do estoque — com DOIS preços, por contexto.** O produto guarda só o
     `filamentId`; o preço sai da cor na hora do cálculo (**igual às máquinas hoje**: produto guarda
     `machineId`, watts vêm vivos). Mas:
     - **Catálogo/calculadora → preço do rolo MAIS NOVO** (custo de repor). Precificar é sobre a
       *próxima* impressão; assim nunca subprecifica em cima de um rolo velho quase vazio.
     - **Venda → preço do(s) rolo(s) EM USO** (FIFO), custo **real**. Se a impressão atravessar
       rolos, o custo é **misto e exato** (ex.: 100 g × R$90 + 50 g × R$110) — o consumo FIFO já diz
       de qual rolo saiu quanto, então é só somar.
     - ⚠ **Consequência intencional:** a **margem da venda diverge da margem do catálogo**. O dono
       quer isso ("fiel ao custo/lucro"). A `SaleModal` **tem que mostrar** o custo real e de onde
       veio, senão vira surpresa.
     - O `pricePerKg` gravado no `FilamentUsage` vira **fallback**: filamento avulso (fora do
       estoque) ou cor excluída.
   - **(D4) Saldo negativo é PERMITIDO, com aviso.** A venda é um fato consumado — bloquear o
     registro por falta de saldo perderia dado real, e negativo é justamente o sintoma de contagem
     furada que se quer enxergar. Nunca "deduzir até zero" (esconde o tamanho do furo).
   - **(D5) Dois avisos de "cabe?", com gravidades diferentes** (pedido do dono):
     - **Passa do rolo EM USO** → informativo: vai atravessar pro próximo rolo (custo misto). Na
       **A1 sem AMS isso é troca manual no meio da impressão** → o dono quer ver isso ao planejar.
     - **Passa do estoque TOTAL da cor** → aviso forte; é o negativo do D4.
     A UI mostra **qual rolo está em uso e quanto resta nele** junto do dropdown (7c) e na venda (8).
   - **(D6) Ajuste de inventário tem RASTRO** (pedido do dono: "histórico mais fiel possível").
     Contar o rolo e corrigir o saldo **não** é editar `remainingG` na mão — é `adjustRoll(cor,
     rollId, countedG, reason, at)` (puro, em `lib/stock.ts`), que anexa um `StockAdjustment` ao doc
     da cor. **Nenhum outro caminho** muda `remainingG` manualmente, senão o rastro fura no primeiro
     atalho. Guarda `beforeG` **e** `afterG` (o delta se deriva; o inverso não — um rastro que só diz
     "−70 g" perde qual era o furo). **Rolo arquivado/zerado também pode ser ajustado** (achou o spool
     na gaveta e não estava vazio). **Ajuste é o remédio do D4:** com saldo negativo por overdraft, a
     contagem gera delta positivo e o `beforeG` negativo **fica gravado como prova do tamanho do furo**.
   - **(D6.1) NÃO duplicar o consumo dentro do doc da cor.** Os 3 eventos de uma cor já têm dono:
     **compra** = o próprio `FilamentRoll` (data/preço/nota); **consumo** = `stockMoves` no doc da
     VENDA (é de lá que o estorno lê); **ajuste** = `StockAdjustment` (D6). Copiar o consumo pra cor
     criaria 2ª fonte da verdade do mesmo fato — e num rastro de auditoria, 2 fontes que divergem são
     piores que 1. O "extrato da cor" (compra → consumo → ajuste em ordem) se **monta na tela**
     juntando as 3 fontes, sem duplicar dado. ⚠ **Mas o extrato nasce em DUAS partes:** o consumo
     mora no `stockMoves` do doc da VENDA, que só passa a existir no **passo 8** — então o **extrato
     v1 da 7b tem só compra + ajuste** (2 das 3 fontes), e o consumo entra na 8. Não tentar construir
     a 3ª fonte na 7b: não há dado.
   - **(D7) `material` fica na COR e no SNAPSHOT — NUNCA no rolo.** A cor **é** material+marca+cor,
     então todo rolo dentro de "PLA Basic Preto" é PLA por construção. Pôr `material` no rolo
     permitiria um rolo de PETG dentro da cor PLA → o FIFO consumiria PETG numa impressão de PLA (o
     cadastro passaria a poder mentir), sem ganhar expressividade nenhuma. **O buraco real** que o
     pedido do dono ("saber o que imprime em qual material") achou é outro: o campo "Material" da
     venda é **texto livre digitado à mão**, opcional (`SaleModal.tsx`, ~linha 546), **um só por
     item** (multicolor em PLA+PETG não é representável) — e `FilamentUsage` **não congela** o
     material, então o histórico dependeria de consultar a cor VIVA (que pode ter sido arquivada),
     violando a foto congelada. **Solução:** `material` e `brand` entram no **`FilamentUsage`**,
     preenchidos automático pela cor escolhida (7c) e **congelados na venda** (8), por cor. O campo
     de texto da venda vira derivado (ou sai) — **dono: passo 8** (era um buraco sem etapa
     responsável; sem isso o `SaleInput.material` fica órfão pra sempre).
   - **(D8) `material` é INPUT PRÓPRIO — a cor não tem campo de "nome".** O nome exibido
     ("PLA Basic · Preto · Bambu") é **derivado** de material+brand+colorName. É isso que deixa
     agrupar por material sem parsear texto. **Decisão da 7b:** o input é **dropdown dos materiais
     já cadastrados + opção de digitar um novo** (que passa a aparecer na lista). Texto livre puro
     deixaria "PLA"/"pla"/"PLA Basic" virarem 3 materiais no agrupamento — o "lucro por material" do
     Dashboard mentiria calado (mesmo furo do campo digitado à mão do D7). Lista fixa também não:
     trava no dia que entrar material fora dela.

   **Modelo (híbrido cor + rolos):**
   ```ts
   type FilamentRoll = {
     id: string;
     purchaseDate: number;
     initialG: number;      // 1000 normalmente
     remainingG: number;    // drena FIFO; o excedente vira negativo no rolo mais novo (D4)
     pricePerKg: number;    // preço REAL pago neste rolo
     note?: string;         // NF/fornecedor
   };

   type StockAdjustment = { // D6: rastro da contagem de inventário
     id: string;
     at: number;            // quando a contagem foi feita
     rollId: string;        // qual rolo foi contado
     beforeG: number;       // o que o sistema achava que tinha (pode ser NEGATIVO — D4)
     afterG: number;        // o que foi contado de verdade
     reason: string;        // "contagem", "sobrou no bico", "rolo veio com menos"...
   };

   type StockFilament = {   // = a COR; é o que o produto aponta (filamentId ESTÁVEL)
     id: string;
     // SEM campo de nome — o nome exibido é derivado destes 3 (D8).
     material: string; brand: string; colorName: string; colorHex?: string;
     minG: number;          // alerta de estoque mínimo (0 = sem alerta)
     archived: boolean;     // "parei de usar essa cor" (raro; NÃO é "rolo acabou")
     rolls: FilamentRoll[]; // saldo = Σ remainingG
     adjustments: StockAdjustment[]; // D6
     createdAt: number;
   };
   ```
   Coleção `estoque` (um doc por COR, rolos em array dentro — poucos por cor, mantém a escrita
   atômica), padrão do `productsRepository`. Baixa **dentro do mesmo `writeBatch` da `saveRecibo`**
   (atômica com a venda).

   **`lib/stock.ts` (matemática pura, 7a)** — o miolo é uma simulação FIFO que serve aos 3 usos
   (aviso no form, custo da venda, baixa): `simulateConsumption(cor, gramas)` → `{ moves, cost,
   crossesRoll, shortfallG }` (puro: descreve o que aconteceria, não muda a cor);
   `applyConsumption` / `reverseConsumption`; `adjustRoll` (D6); `catalogPricePerKg` (rolo
   mais novo) e `saleCost` (FIFO, D3); `balanceG`; alerta de mínimo.

   **Ponto mais frágil — o ESTORNO:** a venda **tem que gravar o que deduziu**
   (`stockMoves: [{ itemId, kind: 'filament', stockId, rollId, qty }]` no próprio doc da venda —
   `stockId` = a cor de origem, **sem ele o estorno teria que varrer todas as cores atrás do
   `rollId`**; decidido na 7a), senão editar
   um recibo de 3 → 2 unidades corrompe o estoque em silêncio. Editar/excluir recibo **estorna
   exatamente** o que consta no `stockMoves` (por rolo — inclusive rolo já zerado/arquivado).
   Vendas anteriores ao recurso não têm o campo → **não estornar**.

   **Etapas (uma por chat, nesta ordem):**
   - **7a — Modelo + repo (sem UI). ✅ FEITA (jul/2026).** Entregue: tipos (`FilamentRoll`,
     `StockAdjustment`, `StockFilament`+`Input`/`Payload`, `StockMove` genérico com **`stockId`**,
     `ConsumptionResult`) + `material?`/`brand?` no `FilamentUsage` (D7); `lib/stock.ts` puro;
     `stockRepository.ts` (coleção `estoque`) + `useStock`; 30 testes. Regras do Firestore não
     mudaram (wildcard `/{document=**}`). Nada plugado — nenhum preço mudou. Detalhe no "Status atual".
   - **7b — Rota `/estoque` (CRUD). ✅ FEITA (jul/2026).** Entregue: `StockPage` + 3 modais
     (cor / rolo / ajuste), `styles/stock.css`, link 📦 no header. Lista por cor com saldo, bolinha,
     rolo em uso, preço de repor e alerta de mínimo; criar/editar cor (material = dropdown + digitar
     novo, D8); registrar rolo; ajuste via `adjustRoll` (D6 — único caminho da tela que toca
     `remainingG`); arquivar/reativar; "rolos anteriores"; extrato v1 (compra + ajuste, D6.1).
     Helpers puros novos no `lib/stock.ts`: `filamentLabel`, `materialOptions`, `rollNumbers`,
     `colorStatement`, `filamentReferences`. **Decisões do dono:** só arquivar, mas **excluir
     liberado em cor arquivada SEM referências** (produto/venda apontando pro `filamentId`;
     `filamentReferences` é o guarda — inerte até a 7c, quando os `filamentId` deixam de ser `null`);
     **editar cor liberado** (inclusive `material`, que re-agrupa retroativo — ok por Diretriz 7);
     rolo default 1000 g. Ainda **desligado** do produto. Detalhe no "Status atual".
   - **7c — Ligar produto ↔ estoque. ✅ FEITA (jul/2026).** Entregue: campo "Cor" virou **dropdown
     das cores do Estoque** (mono E multi) + opção **"Avulso"** (texto livre + preço manual, fallback
     D3). `calculatePricing(..., stock)` resolve o **preço do rolo mais novo** (D3 catálogo,
     só-leitura quando ligada) e devolve **`filamentMissing`** → badge no molde do
     `machineMissing`/TD-009 (`PricingResultCard` + `ProductCatalog`). `useStock` no
     `PricingCalculator`, propagado a `ProductForm`/`ExtraStagesSection`/`ProductCatalog`/
     `exportProductsCsv`. **NÃO** mostra "rolo em uso/quanto resta" nem avisos D5 (é da 8). +5 testes
     (108 verdes). **Decisão do dono: SÓ O NÚCLEO** — a **faxina do legado FEAT-02 foi ADIADA**
     (`weightG`/`filamentPricePerKg` escalares, `normalizeFilaments`, round-trip do CSV velho
     **mantidos** como peso morto inofensivo) → vira **tarefa própria** depois (Diretriz 7 segue
     cobrindo). Detalhe no "Status atual".
   - **FEAT-01 — Preço/subitens por etapa. ✅ FEITA (jul/2026).** Toggle "vender por subitens" no
     produto (default OFF); `SubitemsSection` agrupa etapas (exclusividade mútua; fora de grupo = passos
     internos). Rateio ADITIVO em `computeSubitems` (peso = custo de impressão; internos/falha/fixo/
     acessórios-não-atribuídos rateados; acessório atribuído 100%; markup por subitem via botão discreto;
     fixo sem markup). **Inteiro = Σ subitens.** Catálogo/`/orcamento`/`SaleModal` vendem inteiro + cada
     subitem; `SaleInput.subitemId` grava a parte; `PrintStage.id` persiste. **Decisão do rateio (a que
     estava em aberto):** aditivo por custo, markup por subitem atrás de botão discreto, acessório
     atribuível por box. CSV **não** carrega subitem (Diretriz 7). +8 testes (116 verdes). Detalhe no
     "Status atual" e no item FEAT-01 abaixo.
   - **FEAT-04 — Registro de Produção (a primitiva de baixa migra pra cá).** O evento que gasta
     filamento + hora é a **produção**, não a venda. Registra TODA impressão com um **desfecho**
     (aprovado jul/2026): peça-pro-estoque / encomenda / **teste·calibração** / **falha** (dado real ≠
     reserva de falha do pricing) / **brinde·uso interno** / **histórico** (backfill avulso, sem deduzir
     rolo). Modos: real (deduz FIFO, D3) e histórico/avulso. `computeMachineRoi` passa a ler horas do log
     de produção (muda `/maquinas`, casa com TD-003). Constrói FIFO + `stockMoves` + estorno **no evento
     de produção**. Granularidade = subitem (do FEAT-01). **3 fases:**
     ~~**04a** modelo (`types.ts`) + `lib/production.ts` puro (`planProduction`/`reverseProduction`
     reusando o FIFO de `stock.ts`) + `productionRepository` (coleção `producao`) + baixa no MESMO
     `writeBatch`, sem UI~~ **✅ FEITA (jul/2026)**; ~~**04b** tela `/producao` (produto/subitem →
     máquina → h+min → filamento default editável → desfecho → modo; link no header) + `productionCost`
     (frozenCost) + inteiro multi-máquina = N eventos (baixa encadeada/atômica) + lista com excluir~~
     **✅ FEITA (jul/2026)**; ~~**04c** `computeMachineRoi` lê horas da produção (vida útil por
     `machineId`, todo desfecho) + consumo no extrato da cor (3ª fonte do D6.1); estorno já vinha da
     04b~~ **✅ FEITA (jul/2026) — FEAT-04 inteira fechada**. Detalhe no item FEAT-04 do backlog.
   - **FEAT-05 — Estoque de Produtos (acabados).** Produção **incrementa** com custo congelado; venda
     **decrementa sem rebaixar insumo** (já saiu na produção — furo "não dobrar baixa"). Guarda saldo
     **por subitem** (a SKU do acabado = o subitem vendável do FEAT-01); "produto inteiro disponível" é
     **derivado = min das partes**; vender só uma parte deixa a **lacuna** ("conjunto sem X") — e
     reimprimir a parte preenche. Saldo negativo permitido com aviso (política D4). Detalhe no item
     FEAT-05 do backlog.
   - **8 — Venda (RECONCILIAÇÃO, não mais "o passo da baixa"). Fecha o FEAT-02.** Cada item da venda
     escolhe o caminho **por item, default por saldo** (decisão do dono): **peça pronta** decrementa o
     acabado (FEAT-05, `consumeFifo`) sem rebaixar insumo; **encomenda DISPARA PRODUÇÃO** (resolvido: cria
     evento `producao` `outcome:encomenda`/`mode:real` que deduz filamento FIFO + horas — horas contam no
     ROI, consumo entra no extrato da cor pela fonte que a 04c já lê, **sem 3ª fonte nova no doc da
     venda**). FIFO automático (seleção manual de rolo = backlog). Custo real na `SaleModal` (D3; falha/
     fixo fora do COGS; ⚠ acessórios fora até 7e). **`SaleInput.material` vira derivado do
     `FilamentUsage.material` congelado, ou sai** (D7). **3 fases:**
     ~~**8a** modelo (`SaleInput`+`SaleItemOrigin`) + `finishedGoods` apply/reverse + `lib/productionPlan.ts`
     (builder extraído, `ProductionPage` refatorada) + `lib/saleReconciliation.ts`
     (`planReciboReconciliation`/`reverseReciboReconciliation`) + 15 testes, sem UI~~ **✅ FEITA (jul/2026)**;
     ~~**8b** `SaleModal` (seletor de origem + COGS real + avisos D4/D5) + `reconcileRecibo` batch atômico
     multi-coleção (vendas+producao+estoque+acabados, `reconcileReciboWrite` estorna-e-reaplica) + wiring
     (`handleDelete` estorna)~~ **✅ FEITA (jul/2026)**; ~~**8c** `material` derivado (D7, `freezeFilaments`/
     `materialsLabel`, tira o texto livre) + fecha FEAT-02 + Tier 1~~ **✅ FEITA (jul/2026) — PASSO 8 e
     TIER 1 FECHADOS.** ⚠ **COGS armazenado = custo real; `costBreakdown` = o do snapshot (stopgap) até o
     FEAT-06 congelar a composição na produção; acessórios fora do COGS até 7e.**
   - **7e — Insumos (item próprio, depois).** `supplyId` no `Accessory`, cadastro de insumos na
     `/estoque`, baixa por unidade (`kind: 'supply'`, já previsto no `stockMoves`). Ver D1.

   Alto valor no dia a dia, mas exige disciplina (estoque desatualizado é pior que nenhum) — o dono
   confirmou que a disciplina de marcar venda/baixa está OK.
4. **Dashboard do negócio** *(rota `/painel`)* — **desceu para último** (ChatGPT punha em 2º):
   só vale depois de ~1-2 meses de vendas no banco, senão é gráfico vazio. Receita / custo de
   produção / lucro bruto do mês; menos custos fixos (aluguel, energia, internet…) → **lucro
   líquido**; **utilização das máquinas** (horas impressas ÷ disponíveis → sinaliza se precisa
   comprar outra impressora); receita por máquina; lucro por material; produto mais lucrativo.

**Dívida técnica / faxina (análise de jul/2026) — TODOS OS 3 ITENS ✅ FEITOS:**
- ✅ **Helpers puros do `SaleModal` → `lib/saleContext.ts`** (`saleContextFromResult`,
  `productPrintHours`, `chargedWithFee` + type `SaleModalContext`); imports refeitos nos 3 arquivos.
- ✅ **`globals.css` dividido** em `src/app/styles/*.css` (14 arquivos por área, `@import` em ordem,
  split byte-a-byte idêntico) e **Tailwind removido** (opção (a) — o Tailwind era peso morto, não
  gerava CSS). Não usar Tailwind daqui pra frente; CSS artesanal por área.
- ✅ **Validação/avisos** — `validateProduct` cobre acessórios negativos e completa negativos das
  etapas; erro do formulário virou **aviso inline** (`.form-error`) no lugar do `window.alert`.
  (Etapas não têm campo de markup — herdam o do produto; a nota antiga estava imprecisa.)
  Ponta que sobrou: demais `window.alert` (import CSV, `MachineManagerModal`, `QuotePage`,
  `SaleModal`) seguem nativos — fora do escopo do débito do `validateProduct`.

**Achados da auditoria do GPT (jul/2026) — VERIFICADOS contra o código, ainda A FAZER:**

> O dono trouxe uma revisão "senior engineer" feita pelo ChatGPT sobre um ZIP do projeto
> (sem rodar o app). Cada achado foi cruzado com o código real neste chat. Veredito abaixo:
> ✅ procede · ⚠️ parcial/impreciso · ❌ improcede. Nada estava subprecificando venda hoje —
> o retrato é "fundação sólida com dívidas latentes". Ordenado por retorno.

- ✅ **[TD-001] Custo fixo não persistido → preço diverge entre telas — FEITO.** A **taxa** de custo
  fixo (aluguel/outros/máquinas/horas/dias) agora persiste em `config/negocio` (novo
  `businessSettingsRepository` + hook `useBusinessSettings`, mesmo padrão de `config/machines`); tipo
  `FixedCostRate` separa a taxa global dos toggles `enabled`/`markupOnFixed` (que seguem por-produto).
  Calculadora, `QuotePage` e `SalesPage` consomem a mesma taxa — preço consistente. Doc pensado para o
  Estoque agregar campos sem migração.
- ❌ **[TD-002] "Payback cobra depreciação em dobro" — IMPROCEDE.** Erro de revisar sem rodar:
  a `MachinesPage` já separa em DUAS barras — "Payback do investimento" (`profit/price`, lucro
  ALÉM do custo) e "Vida útil consumida" (`horas/lifeHours`, com `depreciationRecovered` mostrado
  no texto). Não há dobra; a definição de payback é conservadora e correta. No máximo, melhorar
  o rótulo. **Descartar.**
- ✅ **[TD-003] Capacidade não é por-máquina em produto multi-etapa.** `calculateCapacity.ts`
  soma todas as horas de etapa e multiplica por `machines` genérico — impreciso quando etapas
  rodam em impressoras diferentes ou disputam a mesma. Impacto baixo hoje (maioria mono-máquina).
  **Prioridade média — atacar quando o Dashboard/utilização (item 4) entrar (é a base do "gargalo").**
- ⚠ **[TD-004] — a parte dos `confirm` foi REVERTIDA pelo [UX-15] (2026-08-16):** os destrutivos
  deixaram de ser nativos e passaram pelo `ConfirmDialog`. O resto do item (avisos inline no lugar do
  `alert`) continua valendo — e o UX-15 unificou esses avisos num componente só.
- ✅ **[TD-004] Escritas sem feedback (Salvando/Salvo/Erro) — FEITO.** `SaleModal`, `QuotePage`,
  import CSV (`ProductCatalog`) e `MachineManagerModal` trocaram o `window.alert` de resultado/validação
  por avisos inline (`.form-error`/`.form-ok`). `QuotePage.handleGenerate` deixou de gravar
  fire-and-forget (`void addQuote/saveBusiness`) → aguarda com estado `saving` e reporta sucesso/erro.
  Decisão: os `window.confirm` **destrutivos** (excluir, sair) seguem nativos por escolha. **Guarda
  offline:** venda e orçamento checam `navigator.onLine` antes de gravar (o Firestore deixaria a
  Promise pendente para sempre offline, travando o botão) — bloqueiam com aviso em vez de pendurar.
- ✅ **[TD-005] Regras do Firestore não versionadas — FEITO.** Criados `firestore.rules` +
  `firebase.json` no repo (banco `lopo-lab-calculadora`, trava por `ALLOWED_EMAILS`). Deploy NÃO
  automático (Vercel só sobe o site); o dono aplica no Console via `firebase deploy --only
  firestore:rules` quando quiser — conferir contra o Console antes. (Índices não versionados: não
  há composto conhecido hoje; adicionar se surgir.)
- ✅ **[TD-008] Falta teste no núcleo financeiro — FEITO.** `calculatePricing.test.ts`,
  `calculateCapacity.test.ts`, `roundPrice.test.ts`, `validateProduct.test.ts` cobrem a matemática
  pura (componentes de custo, reserva de falha, custo fixo, divisão por peça, etapas/máquinas,
  capacidade mensal, validações). `pnpm test` = 46 casos verdes.
- ✅ **[TD-009] `machineId` ausente cai na 1ª máquina em silêncio — FEITO.** `findMachine`
  (`calculatePricing.ts`) devolve `{ machine, found }`; mantém o fallback mas sinaliza via flag
  `machineMissing` (em `StageCost`/`PricingResult`) + `console.warn` no dev. UI: aviso inline no card
  de preço e badge ⚠ na coluna Máquina do catálogo e no detalhe. +3 testes.
- ✅ **[TD-007] Import CSV > 500 parcialmente atômico — FEITO.** `createProductsBatch`
  (`productsRepository.ts`) reporta quantos entraram/faltam se um lote falhar após o 1º commit (o
  cliente Firestore não faz transação cross-lote). Caso comum (≤500) segue 100% atômico.
  **[TD-006] Subscrição de coleção inteira** (`subscribeProducts`/`useSales` sem paginação) —
  **ainda no backlog** (ok agora, revisitar quando `/vendas` tiver meses). Não descartado.
- Menores **(mantidos no backlog, não descartados):** numeração de orçamento derivada no browser
  (2 abas/2 cliques podem repetir); labor incluído na reserva de falha (impacto de centavos).

**Restam da auditoria:** **TD-003** (capacidade por-máquina) — atacar junto do Dashboard/utilização
(item 4), é a base do "gargalo"; **TD-006** (paginação) — quando `/vendas` acumular meses. Nada mais
pendente da auditoria.

**Ideias/ajustes trazidos pelo dono (jul/2026) — a fazer:**

> Itens levantados pelo dono em conversa (não vieram da auditoria do GPT). Verificados contra o
> código quando aplicável. Prioridade é a que o dono deu.

- ✅ **[UX-01] Zero à esquerda ao reescrever campo numérico — FEITO.** Criado o componente
  compartilhado `NumberInput` (`components/NumberInput.tsx`): guarda a **string exibida** em estado
  local (fica vazio ao apagar, não vira `0`), emite número **clampado** por `min`/`max`, normaliza a
  exibição **no blur** e resync com o valor externo pelo padrão "ajustar estado no render". Adotado
  nas 8 telas (`NumberField` do `ProductForm` passou a usá-lo; + `AccessoriesSection`,
  `ExtraStagesSection`, `CapacityPanel`, `FixedCostsPanel`, `SaleModal`, `QuotePage`,
  `MachineManagerModal`). Clamps de call-site redundantes removidos. Só UI, sem migração.
- ✅ **[FEAT-01] Preço/subitens por etapa — FEITA (jul/2026).** Rateio aditivo (inteiro = Σ subitens),
  toggle no produto, markup por subitem (botão discreto), acessório atribuível por box, venda/orçamento
  por subitem. Núcleo em `computeSubitems`/`SubitemsSection`. **Contexto histórico abaixo** *(**era**
  Tier 1, depois da 7c, antes do FEAT-04/05/8 · **definiu a granularidade de subitem que
  FEAT-04/05/8 herdam**)*. Salvar/mostrar o preço calculado e proporcional de **cada etapa** do
  produto (considerando máquina, mão de obra, filamento, tempo de cada etapa). **Por quê:** uma
  etapa pode ser um acessório opcional pro cliente (ex.: peça base + adorno impresso à parte) — o
  dono quer poder cotar as etapas separadamente e deixar o cliente escolher tudo ou só uma parte.
  **Onde:** card do produto no catálogo (mostrar preço por etapa) + toggle na `/orcamento` (e talvez
  `/vendas`) que **divide o produto em etapas** (cada etapa vira linha) ou trata como item único.
  **O que já existe:** `calculateStageCost` (`calculatePricing.ts`) já devolve o **custo** por etapa
  (`StageCost`: material/energia/depreciação/manutenção/labor). **Decisão de design que falta (o
  miolo):** etapas hoje **não** têm preço próprio — markup, reserva de falha, custo fixo e
  arredondamento são aplicados no **produto inteiro** e as etapas são fundidas nas categorias do
  produto. Definir a regra de rateio do preço por etapa: (a) aplicar o markup do produto sobre o
  custo de cada etapa, ou (b) ratear o preço final do produto proporcional ao custo de cada etapa;
  e como distribuir custo fixo/reserva de falha/acessórios/arredondamento (a soma das partes tem que
  fechar com o total). **Contexto do dono (importante):** as etapas são **peças físicas diferentes,
  de impressões diferentes** — ou seja, cada etapa é um produto realmente vendável à parte, então o
  rateio precisa ser **exato/aditivo** (soma das partes = total; não serve rateio só informativo).
  **Também quer:** poder **agrupar etapas específicas num subitem** do produto (ex.: 4 etapas → 2
  subitens vendáveis), não só quebrar 1-etapa-por-linha. Isso pede um conceito de "grupo de etapas"
  no orçamento/venda. **Depende de:** produto com etapas (`stages[]`) e dados por etapa (já existem).

  **⚠ Isto é CAPTURA, não conveniência (revisão jul/2026 — corrige análise errada anterior).** Cotar
  etapa separada leva a **vender** etapa separada. A `QuotePage` tem "Item livre" (~linha 513), mas a
  **`SaleModal` NÃO tem** — ela só monta itens a partir de `catalogItems` e todo item exige
  `source.productId` (~linha 298). Ou seja: **o orçamento da etapa sai hoje; a venda dela não tem como
  ser registrada como ela mesma.** As 3 saídas atuais são todas ruins — registrar o produto inteiro
  (custo/preço/peso errados), criar produto-fantasma no catálogo (duplica dado), ou não registrar
  (perde a venda). **Pior depois do passo 8:** a baixa deduz FIFO a partir do `filaments[]` do
  snapshot → registrar o produto inteiro numa venda de uma etapa **dá baixa do filamento do produto
  inteiro**, e o erro sai do histórico e entra no **estoque físico** (o único dado que a Diretriz 7
  NÃO deixa descartar — os rolos são reais).

  **Por que entre a 7c e a 8, e não antes da 7a** (decisão do dono, jul/2026): o acoplamento
  FEAT-01 ↔ Estoque é **só no passo 8** — se um item de venda pode ser "uma etapa"/"um grupo", muda
  o que a baixa deduz. A 7a (FIFO puro; o `itemId` do `StockMove` já é id opaco genérico por D1),
  a 7b (CRUD de cor/rolo) e a 7c (dropdown; FEAT-01 é camada de preço/agrupamento sobre etapas que
  já existem — não muda onde o filamento é declarado, `PrintStage.filaments[]` já é por etapa) **não
  são influenciadas**. Encaixar aqui faz o passo 8 nascer sabendo vender etapa, sem parar 3 chats de
  trabalho pronto enquanto o rateio (decisão aberta, poste longo) é decidido.

  **UX exigida pelo dono (jul/2026):** a etapa a orçar é **SELECIONADA entre as etapas já
  cadastradas do produto — nunca digitada à mão**. E o **"Item livre" CONTINUA existindo** (item
  genérico, fora do catálogo). Os dois convivem: não são o mesmo controle.
  - **Lado orçamento = barato.** Item de catálogo e item livre **já são a mesma forma**:
    `QuoteItemSnapshot = {description, quantity, unitPrice}` (`types.ts` ~313) — o orçamento **nem
    guarda `productId`**. "Adicionar do catálogo" é um `<select>` que só preenche descrição+preço
    (`QuotePage.tsx` ~494); "Item livre" é botão separado (~508). → **selecionar etapa = 3º modo de
    preencher a mesma forma**; o item livre não é ameaçado (controles independentes).
  - **Lado venda = estrutural.** Na `SaleModal` o item guarda `productId` + snapshot congelado +
    `filaments[]` e dirige a **baixa** (passo 8). Selecionar etapa ali muda o dado, não só a tela.
    É aqui que mora o trabalho real — mesma UI, profundidades diferentes.
  - **⚠ Depende do rateio:** o seletor precisa **exibir um preço por etapa/grupo** na lista. Sem a
    regra de rateio decidida, não há o que mostrar → reforça que o rateio é o poste longo.
  - **✅ RESOLVIDO (jul/2026) — o "grupo de etapas" mora NO PRODUTO, atrás de um TOGGLE.** O dono
    aprovou: `ProductForm` ganha um **toggle "vender por subitens"** (default OFF = só vende inteiro,
    = comportamento de hoje, zero fricção pros produtos simples). ON revela a UI de **agrupar etapas
    em subitens vendáveis**, montada **uma vez no produto**; orçamento/venda só **selecionam** entre
    inteiro e subitens prontos (nunca re-agrupam, nunca digitam à mão). **Nem toda etapa é vendável:**
    etapas fora de qualquer subitem = **passos internos** (entram no custo/preço, não vendem sozinhas).
    Descartadas: (A) sem toggle, inferir de "há ≥1 grupo" (UI de agrupar sempre visível polui produto
    simples); (B) flag vendável-sim/não por etapa (não cobre "4 etapas → 2 subitens" que o dono pediu).
  - **✅ Vender parte E inteiro convivem; parte vendida deixa LACUNA (jul/2026).** Produto com subitens
    vende as partes **e** ainda o inteiro. Vender só uma parte de uma unidade pronta **deduz do conjunto
    principal deixando uma lacuna** ("conjunto sem X"). Isso é fenômeno de **estoque de acabados
    (FEAT-05)**: o acabado guarda saldo **por subitem**, "inteiro disponível" = **min das partes**, e a
    lacuna é a divergência; reimprimir a parte preenche. **O rateio aditivo do FEAT-01 é o que faz o
    dinheiro fechar** (custo do inteiro = Σ custos das partes → vender a parte tira só o custo dela, sem
    centavo órfão). Decisão de apresentação ("conjunto faltando X" vs. peças avulsas) fica pro chat do
    FEAT-05.

  **⚠ NÃO DIVIDIR em "orçamento primeiro, venda depois" (decidido jul/2026).** É tentador, porque o
  lado-orçamento é barato e o lado-venda é estrutural (ver os dois bullets acima) — mas entregar só a
  metade do orçamento faz o dono **cotar** etapa separada sem poder **registrar** a venda dela na
  `SaleModal` (catálogo-only), criando ativamente o buraco de captura que este item existe pra fechar.
  O FEAT-01 sai **inteiro** (orçamento + venda) ou não sai. A tentação de fatiar vai voltar — é esta
  nota que a responde.

  **Escape hatch NÃO necessário:** cogitou-se copiar o "Item livre" da `QuotePage` pra `SaleModal`
  como curativo. Descartado — o FEAT-01 já vem antes do marco, e item livre captura só **preço**
  (sem `filaments[]`, sem baixa, sem "lucro por material"). Retomar só se uma venda de etapa
  aparecer antes do FEAT-01 ficar pronto.
- ✅ **[FEAT-02] Gasto de filamento por cor (multicor / AMS / dual nozzle)** — **FECHADO (jul/2026):
  lado-produto + reconciliação da venda (passo 8) + `material` derivado (8c/D7).** A baixa de filamento
  mora na PRODUÇÃO (FEAT-04); a venda-encomenda dispara produção, a peça pronta drena o acabado. **DECISÃO p/ o Estoque
  (passo 7/8):** o campo **"Cor"** (texto livre, hoje só no multicolor) vira um **dropdown de seleção
  da COR cadastrada no Estoque** (a cor, NÃO o rolo — ver D2 no item 3 do backlog) e passa a aparecer
  **também no monocolor** (mono = array de 1 → também escolhe qual filamento do estoque, pra puxar
  preço e dar baixa). O `filamentId` já existe em TODO `FilamentUsage` (inclusive mono), hoje `null`
  → não precisa migração, só ligar o dropdown; o texto `colorName` fica como **fallback de filamento
  avulso** (fora do estoque). Modelo `FilamentUsage`
  (`totalG` canônico + model/purga/torre opcional), `filaments[]` em produto/etapa, `lib/filaments.ts`,
  `FilamentColorsSection`, custo por cor no cálculo, e **snapshot da venda congela as cores**. Falta só
  deduzir do spool ao efetivar a venda (passo 8). *Contexto original abaixo mantido:* Permitir marcar a
  impressão como **monocolor ou colorida**; se colorida,
  informar **quais filamentos/cores** (vindos do futuro Estoque, ou avulso) e **quanto de cada um**.
  **Por quê:** casa com o Estoque — hoje o app assume 1 cor (ou soma tudo num `weightG`) e **não
  guarda quanto de cada cor** foi gasto; sem isso não dá pra dar baixa por spool/cor. **Fluxo no
  cadastro (calculadora):** escolher mono vs. multi; se multi, informar nº de filamentos → aparecem
  N entradas de **peso por filamento** + seleção do filamento (do Estoque ou fora dele). A proporção
  por cor fica salva no produto. Talvez o toggle seja dispensável se a UX ficar boa. **Fluxo na
  venda:** confirmar os filamentos usados (default = os do cadastro), e **ao efetivar a venda deduzir
  o peso de cada filamento do Estoque** (snapshot congelado). No **catálogo** o gasto por cor é
  informativo e **sempre atualizado** (vivo) — só congela/deduz quando vira venda. **Custo muda:**
  vira soma de `peso_i × preço_i` (spools de cores/preços diferentes), não `weightG` único ×
  preço único. **Aprendizado da imagem do slicer (Bambu):** o consumo por cor tem 3 parcelas —
  **Model** (vira peça), **Purged** e **Tower** (refugo da troca de cor). No exemplo enviado, ~43%
  do filamento (68,45 g purga + 9,62 g tower de 157,59 g) foi **desperdício** → a baixa de estoque e
  o custo devem usar o **Total por cor** (model+purged+tower), não só o que ficou na peça. Considerar
  campo de purga/refugo por cor. **Depende de:** Estoque (item 3, ainda não feito) — dá pra começar o
  modelo de dados (peso por cor no produto) antes, e plugar a baixa quando o Estoque existir.
  **Modelo hoje:** `weightG`/`filamentPricePerKg` únicos por produto/etapa → passam a array
  `{ filamentId/cor, weightG, pricePerKg }`, com o caso mono como array de 1.
- ✅ **[UX-02] Entrada de tempo de impressão em horas + minutos — FEITO.** O `PrintTimeField`
  (compartilhado por `ProductForm` e `ExtraStagesSection`) passou a ter **dois campos fixos** (horas +
  minutos). O campo de horas **aceita decimal** e, no **blur**, o total normaliza pra horas inteiras +
  minutos 0-59 (`11.85` → `11 h 51 min`; rollover de 60 min). Só minutos ou só horas decimais seguem
  funcionando. Removido o `<select>` de unidade. **Só UI:** dado guardado como `printHours` decimal —
  sem migração. Resync com prop externa via padrão React "ajustar estado no render" (evita o lint
  `set-state-in-effect`).
- ✅ **[DEC-01] Toggle "aplicar markup sobre o custo fixo" — RESOLVIDO (removido).** O dono decidiu
  que markup **nunca** deve incidir no fixo. Fixado o comportamento em `variableCost × markup +
  fixedCost` e removido o campo `markupOnFixed` de ponta a ponta (tipos, defaults, UI+CSS, CSV,
  repo, testes). Sem migração; default sempre foi `false`, então nenhum preço muda na prática.
  **PENDÊNCIA aberta (opção B, adiada) — semântica do `contributionMargin`:** no ramo sem markup no
  fixo, `contributionMargin = suggestedPrice − fixedCost − variableCost = suggestedPrice −
  totalCost`, ou seja **é o LUCRO por peça, não a margem de contribuição clássica** (que seria
  `preço − custo variável`, sem descontar o fixo). O nome da variável está impróprio. Ela alimenta
  só o **ponto de equilíbrio** (`custoFixoMês / contributionMargin` em `PricingResultCard` e
  `ProductCatalog`) — a aba Rentabilidade (`ProfitSummary`) NÃO usa, calcula lucro por conta
  (`suggestedPrice − totalCost`). Corrigir para a margem de contribuição correta faria o ponto de
  equilíbrio **diminuir** (margem maior) → é mudança de comportamento, mantida fora do DEC-01.
  Decidir depois se vale corrigir o cálculo do break-even ou só renomear a variável.
  **✅ RESOLVIDO (2026-07-31, Tier 4) — opção A (renomear):** o dono optou por renomear
  `contributionMargin` → **`profitPerPiece`** e manter o cálculo idêntico (o ponto de equilíbrio
  não muda). Opção B (margem de contribuição de verdade, break-even menor) descartada.
- ✅ **[Tier 4] Fechado (2026-07-31) — 4 itens.** (1) **Numeração de orçamento atômica:** o próximo
  número era derivado no browser (`max(numberValue)+1`), e 2 abas/2 cliques repetiam. Agora
  `reserveQuoteNumber` (`quotesRepository.ts`) reserva via transação num contador `config/orcamentoSeq`
  ANTES de gerar o PDF (número autoritativo, sem colisão). Sequência monotônica (não decresce ao excluir;
  para zerar, apagar o doc). Efeito colateral aceito: offline não gera mais orçamento. (2) **DEC-01 =
  opção A** (ver acima). (3) **ROI pela depreciação real:** `machineRoi.ts` passou a usar
  `realCostBreakdown.depreciation` (FEAT-06) na *depreciação recuperada*, repartida entre as máquinas na
  proporção da precificada (`machineUsage`); venda anterior ao FEAT-06 cai no fallback precificado.
  Payback/lucro não mudaram (seguem repartidos por horas). +2 testes. (4) **Labor na reserva de falha:**
  decidido **manter** (labor segue no `printingCost` → na reserva); sem código.
- ✅ **[UX-03] Telefone e Instagram clicáveis no PDF do orçamento — FEITO.** No cabeçalho do PDF,
  o **telefone** virou link de **WhatsApp** (`https://wa.me/...`, novo helper `whatsappUrl` garante
  o DDI **55** quando o número vem só com DDD — 10/11 díg.) e o **@ do Instagram** virou link pro
  perfil (`https://instagram.com/<handle>`, novo `instagramUrl`). O loop de contato passou a usar
  `doc.textWithLink(texto, x, y, { url })` quando há URL (e-mail segue texto puro). Isolado em
  `generateQuotePdf.ts`; sem mudança de dados.
- ⬜ **[FEAT-03] Melhorar o PDF do orçamento (mais informacional / melhor pro cliente)** *(guarda-chuva
  · a concretizar)*. Item aberto — pensar em como deixar o orçamento mais útil pro cliente. **Ideias
  semente (o dono escolhe quais viram tarefa):** (a) **prazo de entrega/produção** por item ou total
  (dá pra estimar pelas horas de impressão que já existem); (b) **foto/thumbnail** do produto na linha
  do item; (c) **formas de pagamento e condições** (já há taxas por forma em `config/taxas`);
  (d) **termos/observações** mais visíveis (garantia, o que está/não incluso); (e) **QR code** do
  WhatsApp (casa com UX-03); (f) **detalhar etapas/subitens** quando o FEAT-01 existir (cliente vê o
  que pode tirar); (g) **desconto/acréscimo** por forma de pagamento ou volume; (h) **branding real**
  (trocar o logo placeholder — ponta já conhecida do item 2 do backlog). **Onde:** `generateQuotePdf.ts`
  + `QuotePage`/`config/orcamento` conforme o que exigir dado novo. **Relacionado:** UX-03, FEAT-01,
  item 2 (branding).
- ⬜ **[FEAT-04] Registro de Produção (log de impressão) — a primitiva de baixa** *(guarda-chuva ·
  grande · **posição FECHADA jul/2026: depois do FEAT-01, antes do FEAT-05/8**)*. **O quê:** um evento de **impressão/produção**
  como fonte da verdade do consumo — cada impressão rodada registra **máquina + horas + filamento
  gasto**, independente de virar venda. **Por quê:** o dono vai operar um **quiosque de mall** (vende
  peça pronta na hora). Hoje o app só conhece **catálogo + venda**, e **toda hora de máquina e baixa de
  filamento sai da venda** (`computeMachineRoi` lê horas só de `sales` — `machineRoi.ts:82`; passo 8
  deduz filamento na venda). Logo: **impressão que não virou venda não existe pro sistema** → ROI/vida
  útil da máquina subcontam, estoque de filamento fica achando que tem mais do que tem, e não há onde
  cadastrar impressão passada nem impressão que não vira produto (teste/falha/brinde). **Reframe (o
  miolo):** o evento que gasta filamento + hora é a **produção**, NÃO a venda — a venda só reconhece
  receita e escolhe qual unidade pronta saiu (make-to-stock vs. make-to-order). **DESFECHO por impressão
  (aprovado jul/2026 — campo obrigatório do evento):** `peça-pro-estoque` (→ incrementa FEAT-05) ·
  `encomenda` (sai direto pra venda) · `teste·calibração` · `falha` · `brinde·uso interno` · `histórico`
  (backfill). Só `peça-pro-estoque` alimenta o acabado; teste/falha/brinde deduzem insumo+hora mas **não**
  produzem unidade vendável (é por isso que a baixa NÃO pode morar na venda — senão eles nunca deduziriam e
  o estoque físico mentiria). **Modos exigidos:**
  (a) **real** — deduz dos rolos atuais (FIFO, D3); (b) **histórico/avulso** — só horas + gramas soltas,
  **sem** deduzir rolo (o dono tem o histórico das 2 impressoras e vai preenchê-lo no marco; não quer
  recadastrar rolo velho — reusa o fallback "Avulso" já existente). **Consequência:** `computeMachineRoi`
  passa a ler horas do log de produção, não das vendas (muda `/maquinas`; casa com TD-003). **Furos a
  encarar:** (1) **não dobrar baixa** — se produção deduz filamento/hora, a venda de item já produzido
  NÃO pode deduzir de novo; (2) **congelamento migra pra produção** (custo do rolo no dia da impressão,
  não no da venda); (3) falha registrada (dado real) ≠ reserva de falha do pricing (provisão
  estatística) — não misturar. **Relacionado:** FEAT-05 (consome este log), passo 8 (ver nota de
  ordem), TD-003, Estoque (item 3), Diretriz 7 (backfill no marco = sem migração).
- ⬜ **[FEAT-05] Estoque de Produtos (finished goods) — peça pronta parada na loja** *(guarda-chuva ·
  grande · **posição FECHADA jul/2026: depois do FEAT-04, antes da 8** · depende conceptualmente do
  FEAT-04)*. **O quê:** um **estoque de produtos** (separado do
  estoque de insumos de hoje) com as peças **já impressas mas ainda não vendidas** — quantidade em mãos,
  com **custo congelado no momento da produção**. **SKU = o subitem vendável do FEAT-01** (não o produto
  inteiro): guarda saldo **por subitem**; "produto inteiro disponível" é **derivado = min das partes**.
  **Por quê:** no quiosque o dono precisa de
  produto físico pronto pra vender na hora; hoje não há representação disso (só catálogo vivo + venda).
  **Fluxo:** produção (FEAT-04) **incrementa** o estoque com o custo congelado; a **venda
  decrementa** a quantidade e reconhece receita **sem rebaixar insumo** (o filamento já saiu na produção).
  **Lacuna (aprovado jul/2026):** vender **só uma parte** de uma unidade pronta deduz aquele subitem →
  o conjunto principal fica incompleto, mostrado como **"conjunto sem X"** (a divergência entre os saldos
  das partes); **reimprimir a parte preenche a lacuna**. Sustentado pelo **rateio aditivo do FEAT-01**
  (custo do inteiro = Σ partes, sem centavo órfão). Decisão de apresentação ("conjunto faltando X" vs.
  peças avulsas) é deste chat.
  **Furos:** (1) a unidade carrega "insumo/hora já deduzidos" pra a venda não dobrar; (2) COGS da venda =
  **custo da produção** (congelado), não preço do rolo do dia da venda; (3) **saldo negativo permitido com
  aviso** (vender 2 com 1 em estoque — mesma política do D4 do filamento), nunca bloquear. **Onde
  (provável):** rota nova (ex.: `/estoque` ganha aba "Produtos" vs. "Insumos", ou rota própria) +
  `SaleModal` passa a poder vender **de estoque** (rápido, ~5s: custo já congelado, só escolher e
  decrementar). **Relacionado:** FEAT-04 (fonte), passo 8, SaleModal, Estoque (item 3).

  **Decisões do dono (jul/2026, fechadas neste chat):** FEAT-05 = **só o lado estoque** (a venda que
  DECREMENTA fica pro passo 8 — o reframe manda; encher agora, drenar na 8, como 7a/7b antes da 8);
  custo do acabado em **camadas FIFO** (cada produção `estoque` = uma camada {qtd, custo congelado,
  eventId}; estorno remove a camada do evento — round-trip; **não** custo médio); apresentação
  **híbrida** (saldo por subitem + linha derivada "inteiros montáveis = min das partes" + aviso de
  lacuna). **Furo tratado:** inteiro em N máquinas = N eventos mas **1 unidade** → incremento por
  SUBMISSÃO (não por evento); inteiro-com-subitens rateia o `frozenCost` real pelas proporções do
  `SubitemPrice.cost` (aditivo/FEAT-01). Só `estoque` incrementa. **Fases:**
  ~~**05a** modelo (`types.ts`) + `lib/finishedGoods.ts` puro + `finishedGoodsRepository` (coleção
  `acabados`, doc por produto) + `useFinishedGoods` + 15 testes, SEM UI/wiring~~ **✅ FEITA (jul/2026)**;
  ~~**05b** ligar a produção (incremento/estorno atômico no `writeBatch` do evento; delta por submissão
  na `ProductionPage` via `submissionEntries`; camadas ancoradas no 1º evento; só desfecho `estoque`)~~
  **✅ FEITA (jul/2026)**; ~~**05c** tela (aba "Produtos" na `/estoque`, híbrido "conjunto + lacuna" +
  negativo com aviso; helpers puros `goodValue`/`assemblyBreakdown`)~~ **✅ FEITA (jul/2026) — FEAT-05 fechada**.
- ✅ **[UX-04] Botão "Nova venda" no topo da `/vendas` — FEITO.** Botão no header da `SalesPage`
  (ícone `Plus`) abre o `SaleModal` em **modo novo** (`seed={null}`, cesta vazia; estado `newSale`
  separado do `editRecibo`), escolhendo itens pelo seletor de catálogo já existente e gravando via
  `saveRecibo`. Desabilitado quando o catálogo está vazio (senão não há como adicionar itens). Estado
  vazio da página passou a apontar pro botão. Sem migração — mesmo fluxo do registro pelo card.
- ⬜ **[FEAT-06] Aba Produtos rica — dados completos do produto com custo congelado** *(pedido do dono,
  jul/2026 · melhoria de apresentação sobre a FEAT-05c · **NÃO é o passo 8**)*. **O quê:** cada card da
  aba **Produtos** (`/estoque`) mostra **todos os dados do produto como no catálogo** (composição de
  custo, margem, peso/horas/máquina/filamento, subitens, etapas, acessórios, links, capacidade) — mas
  com os **custos CONGELADOS** da fabricação (a peça já foi impressa, o custo é o do dia da produção,
  não o vivo). Hoje o card é só um resumo de saldo (conjuntos/lacuna/valor parado). **⚠ Decisão de
  design que trava (o miolo):** o acabado só congela o **total** (`FinishedLayer.unitCost`); o evento de
  produção congela `frozenCost` (também total) + `filaments` — **nenhum guarda a composição**
  (material/energia/depreciação/manutenção/labor) nem markup/peso/horas. Então "barras de custo
  congeladas" exigem escolher: **(a)** puxar a composição do **produto VIVO** (`calculatePricing`) e
  congelar só o total — barato, mas se o produto mudou desde a impressão a composição diverge (não é
  fiel); **(b)** passar a **congelar o breakdown na produção** — fiel, mas mexe no modelo do FEAT-04
  (`ProductionInput`/`FinishedLayer` ganham a composição) e, por Diretriz 7, backfill no marco = sem
  migração. Múltiplas camadas por SKU (custos diferentes) → o custo do card é média ponderada ou
  por-camada. **Onde:** `StockPage` (aba Produtos) + reusar `CostBars`/`ProfitSummary`/`CatalogDetails`.
  **Relacionado:** FEAT-05 (base), FEAT-04 (fonte do congelamento), Diretriz 7.
  **✅ DECISÃO DO DONO (jul/2026): opção (b) — o acabado guarda a COMPOSIÇÃO INTEIRA congelada na
  produção** (não puxa do produto vivo), para a aba Produtos mostrar os dados igual à calculadora, mas
  fiéis ao dia da impressão. Consequência que casa com o passo 8: quando isto existir, o
  **`costBreakdown` da venda de peça pronta passa a vir da camada congelada** (hoje, no 8b, é o do
  snapshot do catálogo — stopgap informativo; ver o ⚠ do passo 8). Modelo: `FinishedLayer` (e o evento
  de `producao`) ganham um `SaleCostBreakdown` por unidade; inteiro-com-subitens rateia como o `unitCost`.

**Bugs / achados de teste visual (jul/2026, trazidos pelo dono) — VERIFICADOS contra o código:**

> Comentários do dono após rodar o app. Cada um cruzado com o código neste chat. ✅ procede ·
> ⚠️ parcial · ❌ improcede. Ordenados por criticidade.

- ✅ **[BUG-01] Hora quebrada SOMAVA com os minutos residuais — FEITO (jul/2026).** No `PrintTimeField`
  (`ProductForm.tsx`, compartilhado c/ `ExtraStagesSection`), digitar fração nas horas (ex.: `11.85`)
  **zera o campo de minutos** e emite só as horas (novo `onHoursChange`; blur/`normalize` → `11 h
  51 min`), em vez de somar com o resíduo (`11.85 + 30min = 12h 21min`, custo maior em silêncio). Sem
  fração, mantém o comportamento h + min. Só UI, sem migração. **Relacionado:** UX-02.
- ✅ **[BUG-02] Produção/estoque/encomenda ignoravam o `piecesCount` (mesa de N peças) — FEITO
  (2026-07-19).** O dono reclassificou como URGENTE e furou a fila pré-marco (fundação de dado,
  Diretriz 7). **Modelo (o MESMO da precificação): 1 evento = 1 placa** → baixa filamento/horas 1×,
  credita **N = `piecesCount`** acabados a `custo÷N`. Mudanças: `submissionEntries` (`finishedGoods.ts`)
  ganhou `units` (= peças×placas) e cada acabado vira `qty:units`/`unitCost = custo÷units` (fim do
  `qty:1` cravado); `subitemEventRows` (`productionPlan.ts`) multiplica o labor por `pieces` — o
  `SubitemPrice` mistura escalas (`printHours`/`filaments` crus × `costBreakdown` ÷peça), então o labor
  precisava voltar pra placa senão o `frozenCost` somava material cru + labor por peça; `scaleRow`
  centralizado em `productionPlan.ts` (era só da encomenda); `/producao` ganhou o campo **"Quantas
  placas"** (P) que escala rows por P e credita `piecesCount×P` acabados; a **encomenda**
  (`saleReconciliation.ts`) escala por `qty÷pieces` (decisão do dono: corrigir junto — baixa/COGS por
  peça batem com o preço; make-to-order não estoca as peças sobrando de placa parcial). O estorno é
  round-trip automático (os `stockMoves`/camadas gravados já vêm escalados). +5 testes (189 verdes).
- ✅ **[BUG-03] Histórico de vendas e extrato de rolos fora de ordem — FEITO (2026-07-19).** Desempate
  por `createdAt`: `Recibo` (`SalesPage`) ganhou `createdAt = max(items.createdAt)` e os sorts por data
  (`recent`/`oldest`) usam `(saleDate, createdAt)`; `colorStatement` (`stock.ts`) desempata por um `seq`
  local (createdAt cheio do evento de produção no consumo; `at`/dia p/ compra e ajuste, que naturalmente
  vêm antes do consumo do mesmo dia). Rolos/ajustes seguem só com o dia (não precisou p/ o bug). +1
  teste (190 verdes). Diagnóstico original abaixo. Raiz idêntica ao "só guarda DIA":**
  Diagnóstico do dono certo: **só guarda DIA, não hora.** `saleDate` e `purchaseDate`/`at` vêm de
  `<input type=date>` (meia-noite). Eventos do mesmo dia empatam → a ordem cai no que o Firestore
  devolveu (parece alfabético/aleatório). `SalesPage` ordena recibos por `saleDate` (dia);
  `colorStatement` (`stock.ts`, ~linha 391) ordena por `at` (dia). **Alavanca barata:** venda e evento
  de produção **já gravam `createdAt` (timestamp cheio)** → usar como **desempate** resolve os dois sem
  mexer no modelo (recibo ganha `createdAt = max(items.createdAt)`; statement desempata consumo por
  `event.createdAt`). Rolos/ajustes só têm data de dia — se quiser ordem fina entre compra e consumo do
  mesmo dia, aí sim guardar `createdAt` neles (Diretriz 7: sem migração, recadastra no marco). **Onde:**
  `SalesPage` (sort), `stock.ts` `colorStatement`.
- ✅ **[NOTA→UX] Custo congelado NÃO inclui reserva de falha — ❌ improcede (intencional); TRANSPARÊNCIA
  ADICIONADA (jul/2026).** `productionCost` (`production.ts`) exclui reserva de falha, custo fixo e
  acessórios de propósito: são **provisões de pricing** (markup estatístico), não custo físico da
  impressão. Depois do FEAT-04 as falhas reais viram eventos `outcome:falha` próprios (consomem
  filamento+hora) → embutir a reserva em cada peça boa **dobraria a contagem**. **Matemática mantida.**
  Como o dono achou confuso ver o custo "menor" na venda, foi criado o `CostDetail` (componente
  compartilhado): o gatilho mostra o **custo real** (base do lucro) e abre uma **janela flutuante
  (Popover API nativa, top-layer — não é cortada pelo scroll do modal)** com a **composição do custo
  precificado** (os 8 componentes, com reserva/fixo/acessórios marcados como provisões fora do custo
  real) + nota explicativa. Ligado na **SaleModal** (por item) e no **/vendas** (por venda, escala pela
  qtd). Popover inline foi descartado — refluía a linha da tabela e o modal com scroll cortava o painel. Custo real segue número único congelado (não decomposto); o breakdown exibido é o `costBreakdown`
  do snapshot (catálogo hoje, stopgap; vira o congelado da produção quando o FEAT-06 chegar — o UI já
  aguenta). Só exibição, sem mudança de cálculo.
- ✅ **[BUG-06] Coluna Material mostra só "PLA" (sem a marca) — ❌ improcede (é o PROJETADO). Decidido
  (jul/2026): manter só o material.** O dono confirmou "PLA" mesmo com uma cor; é o comportamento de
  `materialsLabel` (`filaments.ts`): por D7/D8 `material` é campo **separado** de `brand`/`colorName`
  ("PLA"/"Basic"/"Preto") e o rótulo usa **só o material** de propósito — chave do **"lucro por material"**
  do Dashboard (agrupa PLA/PETG/ABS sem fragmentar por marca). O exemplo "PLA Basic" do script de teste
  estava impreciso. **Dono escolheu (a) só o material — nenhuma mudança de código.** Pontas ainda não
  exercitadas (sem tarefa, código correto): multicolor 2-materiais deve mostrar "PLA · PETG"; cor
  **avulsa/arquivada** tem material vazio → some do rótulo.

**Ordem sugerida do backlog (jul/2026) — inclui itens antigos + ideias novas:**

> Priorização unificada acordada no chat. Guia: barato-e-destrava primeiro; captura antes de
> análise; features grandes por dependência, não por valor. O dono ajusta quando quiser.
> **REAVALIADA (jul/2026):** o dono confirmou **multicolor frequente** + **disciplina de marcar
> venda/baixa OK**. Consequência: o par Estoque+FEAT-02 foi **desmembrado** — a correção de custo
> por cor (dinheiro real, subprecificação hoje) **sobe e destrava-se do Estoque**; o Estoque vem
> logo atrás. FEAT-03 deixa de ser bloco monolítico: seus quick wins podem entrar em paralelo.

- **Tier 0 (limpar já — pequenos/baratos, alguns destravam) — ✅ FECHADO:** (1) ~~**DEC-01**~~ FEITO
  (markup nunca no fixo, toggle removido); (2) ~~**UX-04**~~ FEITO (botão "Nova venda" na
  `/vendas`); (3) ~~**UX-03**~~ FEITO (telefone/Instagram clicáveis no PDF); (4) ~~**UX-02**~~
  FEITO (tempo em h+min); (5) ~~**UX-01**~~ FEITO (zero à esquerda, componente `NumberInput`).
  **Tier 0 e Tier 1 ✅ FECHADOS — próximo: Tier 2.**
- **Bugs de teste visual (jul/2026) — atacar antes do Tier 2:** ~~**BUG-01**~~ **✅ FEITO** (hora
  decimal não soma mais com minutos) → ~~**BUG-02**~~ **✅ FEITO** (piecesCount na produção/estoque/
  encomenda; ver acima) → **BUG-03** (ordenar venda/extrato por `createdAt`, barato, mesma raiz "só
  dia"). ~~**BUG-06**~~ **✅ RESOLVIDO**
  (material "só PLA" é o projetado; dono escolheu manter só o material — sem mudança de código).
  ~~**NOTA** custo congelado sem reserva de falha~~ **✅ TRANSPARÊNCIA ADICIONADA** (`CostDetail`
  expansível na venda e no /vendas — custo real vs. precificado; matemática mantida). Detalhe no bloco
  "Bugs / achados de teste visual" acima.
- **Tier 1 (precisão de custo + fundação):** (6) ~~**FEAT-02 lado-produto**~~ **✅ FEITO** (cores no
  produto/etapa, custo por cor, snapshot da venda congela `filaments[]`); **Item 3 — Estoque**
  (modelo **aprovado**, detalhe e decisões D1-D8 no item 3 do backlog), quebrado em **uma etapa por
  chat**: ~~(7a) modelo + repo, sem UI~~ **✅ FEITA**; ~~(7b) rota `/estoque` (CRUD de cores +
  rolos)~~ **✅ FEITA**; ~~(7c) dropdown de cor no produto (preço vivo)~~ **✅ FEITA**;
  ~~**FEAT-01** preço/subitens por etapa (rateio aditivo; toggle de subitens)~~ **✅ FEITA**;
  ~~**FEAT-04** Registro de Produção (a **primitiva de baixa** migra pra produção; desfecho por impressão)
  — 04a·04b·04c~~ **✅ FEITA**; ~~**FEAT-05** Estoque de Produtos (acabado por subitem, lacuna) —
  05a·05b·05c~~ **✅ FEITA**; ~~**passo 8** (venda = **reconciliação**, não mais baixa; 8a·8b·8c)~~
  **✅ FEITA — TIER 1 FECHADO**. Insumos = (7e), **item separado depois** do filamento.
  **Ordem final do Tier 1 (jul/2026): 7a ✅ → 7b ✅ → 7c ✅ → FEAT-01 ✅ → FEAT-04 ✅
  (04a · 04b · 04c) → FEAT-05 ✅ (05a · 05b · 05c) → 8 ✅ (8a · 8b · 8c). ✅ TIER 1 FECHADO.**
  ⚠ **Reframe aprovado (jul/2026):** o quiosque de mall exige vender **peça pronta na hora**. FEAT-04
  move a **primitiva de baixa** pra produção (é o único ponto que captura teste/falha/brinde — impressões
  que nunca viram venda), então **entra antes da 8**, e a **8 deixa de ser "o passo da baixa"** e vira
  **reconciliação da venda** (encomenda deduz insumo; peça pronta decrementa o acabado do FEAT-05, sem
  dobrar baixa). Detalhe nos itens FEAT-01/FEAT-04/FEAT-05.
- **Tier 2 (features comerciais, independentes):** (10) **FEAT-03** melhorar PDF (quick wins soltos
  podem vir antes; "detalhar etapas" espera FEAT-01); (11) **branding/logo real** no PDF (overlap c/
  FEAT-03); (11b) **FEAT-06** aba Produtos rica (dados completos do produto com custo congelado —
  decidir congelar breakdown na produção vs. puxar do produto vivo; ver item FEAT-06).
- **Tier 3 (adiar até ter volume de vendas):** (12) **Item 4 — Dashboard** (`/painel`) + **TD-003**
  capacidade por-máquina; (13) **TD-006** paginação.
- **Tier 4 (menores/oportunistas):** ✅ **FECHADO (2026-07-31)** — (14) numeração atômica de orçamento;
  (15) labor na reserva de falha = mantido; (16) DEC-01 = opção A (rename); + ROI pela depreciação real.
  Detalhe no bloco "[Tier 4] Fechado" acima.

## 📒 Arquivo do BACKLOG — itens FECHADOS movidos para cá (faxina de 2026-08-16)

> **Por que este bloco existe:** o `BACKLOG.md` chegou a **671 linhas / 61KB** carregando o writeup
> completo de dezenas de itens JÁ CONCLUÍDOS — exatamente o que a Diretriz 8 manda morar aqui.
> O texto abaixo veio **verbatim** de lá (nada foi reescrito nem resumido: as medições e os ⚠ de
> cada item estão intactos). O `BACKLOG.md` ficou só com o que está **aberto**.
> Vários destes itens também têm um writeup próprio e mais longo nas seções `## ✅` acima —
> este bloco é o registro curto que vivia na fila, não substitui aqueles.

### Ordem de prioridade — os 11 blocos JÁ FECHADOS (itens 1–11 da fila antiga)

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
11. ~~**Cluster UI/UX (auditoria de 2026-08-15)**~~ ✅ **FECHADO (2026-08-16)** — **UX-13 → UX-19 +
   TD-013**, os 7 passos: ~~① TD-013 + UX-17a (tokens)~~ · ~~② UX-13a (desktop)~~ · ~~③ UX-13b + UX-14
   (chrome mobile)~~ · ~~④ UX-15 (alvos + confirmação + avisos)~~ · ~~⑤ UX-16 (rótulo foca o campo)~~ ·
   ~~⑥ UX-19 (cor por faixa)~~ · ~~⑦ UX-17b (conversão dos 16 CSS)~~ — **todos FEITOS**.
   As 2 decisões que saíram do cluster: **[DEC-04]** ✅ (faixas de margem, virou o UX-19) e
   **[DEC-05]** (lucide nos controles) — esta **segue aberta como tarefa de código**, sem posição na
   fila; ver "Decisões em aberto".

### Porquês da ordem — decisões de 2026-07-20 e do cluster UI/UX de 2026-08-15

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

### Bugs fechados (BUG-02…BUG-05) e UX/navegação fechada (UX-01…UX-12)

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

### Cluster UI/UX — auditoria de 2026-08-15 (UX-13→17 + UX-19 + TD-013): os 7 passos, todos fechados

### Cluster UI/UX — auditoria de 2026-08-15 (UX-13→17 + UX-19 + TD-013; o UX-18 virou DEC-05)

> **Origem:** auditoria de UI/UX pedida pelo dono, feita com o site **rodando** (`pnpm dev`, login real),
> em **1280×900** e **375×838**, com medições no DOM — não é impressão de leitura de código. As decisões
> de escopo abaixo (marcadas **Decidido**) são do **dono, 2026-08-15**, no mesmo chat da auditoria.
> **Situação (2026-08-16): CLUSTER FECHADO** — os 7 passos (①–⑦) estão feitos. Nada aqui segue aberto.
> **Os blocos seguem em ordem de ID** (fácil de achar pelo número); a **ordem de execução** é o
> `①②③…` marcado em cada um — ver "Ordem de prioridade" item 11 e os porquês acima.

- ~~**[UX-13] O preço some justo quando se mexe no markup**~~ ✅ **FECHADO (2026-08-15)** — *era o mais
  grave do lote.* **▸ ~~Passo ② = UX-13a (desktop)~~ ✅ · ~~Passo ③ = UX-13b (celular, com o UX-14)~~ ✅.**
  **Medido:** `.result-card` é `position: sticky; top: 20px`, mas mede **1286px** de altura contra uma
  viewport de **910px**. Um `sticky` mais alto que a tela **nunca prende no topo** — rola junto até o
  próprio fim. Com o slider de markup à vista, o `R$ 27,14` estava **403px acima** da borda superior.
  No celular é pior: `responsive.css:26` força `position: static`, a página vai a **3314px** e o preço
  (offset 2080px) fica **569px abaixo** do slider (1511px). Ou seja: a interação central de uma
  calculadora de preço — mexer no dial e ver o número — **não funciona em nenhum dos dois tamanhos**.
  **Decidido (dono):**
  - ~~**[UX-13a] Desktop — colapso, sem código novo de layout**~~ ✅ **FEITO (2026-08-15, passo ②)** —
    break-even + rentabilidade + capacidade foram pra um `<details className="result-advanced">`
    ("Ver informações avançadas", chevron lucide) **uncontrolled** (sem prop `open`): nasce fechado e o
    estado do usuário sobrevive aos re-renders — o card redesenha a cada tecla. O `<details>` é
    renderizado **sempre**, com o break-even condicional **dentro** (condicionar o próprio `<details>`
    o remontaria e fecharia sozinho quando o break-even aparecesse/sumisse). **Ficou de fora:** o
    "Total da impressão (N peças)" (decisão do dono — é preço, não info avançada).
    **Medido no site rodando (1280×900, produto real):** card **1392px → 624px** fechado (−55%); com o
    slider de markup no centro da tela o `.result-price` passou de **−509px** (fora de vista) para
    **+63px**. ⚠ **A ressalva do dono confirmada:** **aberto**, o card volta a 1392px e o preço vai a
    −509px — custo aceito de abrir, não regressão.
    **Junto (feito):** o painel de custo fixo **desativado** deixou de renderizar o `.fc-body` (banner
    **319 → 85px**). Não se perdeu nada: o `.fc-body.disabled` já era `pointer-events: none`, ou seja
    os campos nunca foram editáveis com o toggle off — ligar o toggle segue sendo o caminho pra editar
    `machines`/`hoursDay`/`daysMonth`, que são a fonte de onde a capacidade deriva (TD-010).
    **Onde:** `PricingResultCard.tsx` · `FixedCostsPanel.tsx` · `sections.css` (`.result-advanced` novo,
    já escrito em token do UX-17a; `.fc-body.disabled` apagado). O `sticky` do `.result-card` **não foi
    tocado** — o ponto do item era que ele já estava certo.
  - ~~**[UX-13b] Celular — barra fina fixa**~~ ✅ **FEITO (2026-08-15, passo ③)** — componente novo
    `MobilePriceBar.tsx`: faixa de **56px** fixa no rodapé com preço/peça · margem · markup ao vivo, e
    **um toque rola até o `.result-card`** (decisão do dono nesta sessão). Só a calculadora a tem
    (`<main class="wrap has-price-bar">`) e só abaixo de 760px. **O requisito de "não cobrir nada" é
    garantido por três regras amarradas ao MESMO token `--price-bar-h` (base.css):** a própria barra, o
    `padding-bottom` do `.wrap.has-price-bar` (60 → **116px**) e o `.back-to-top`, que sobe a altura da
    barra via `body:has(.price-bar)` — regra posta no **dono legítimo** do botão, não como antídoto em
    outro arquivo (lição do TD-013). **Medido com a página rolada até o fim: 60px de folga** entre o
    último card e o topo da barra; sem `:has()` o navegador só perde o deslocamento (degrada, não quebra).
  - ~~**Junto — painel de custos fixos desativado colapsa**~~ ✅ **FEITO no passo ②** (com o UX-13a).
  **Onde:** `PricingResultCard.tsx` · `FixedCostsPanel.tsx` · `MobilePriceBar.tsx` · `PricingCalculator.tsx`
  · `sections.css` · `base.css`.

- ~~**[UX-14] No celular, metade da tela é cabeçalho**~~ ✅ **FEITO (2026-08-15, passo ③, junto do
  UX-13b)** — abaixo de 760px a `.navbar-bar` **sai do fluxo e vira gaveta** (280px, entra pela direita,
  fundo escurecido) e no lugar dela fica a `.navbar-mobile-head`: **nome da página + ☰**. Fecha no ✕, no
  fundo, no **Escape** e ao navegar (o `onClick` do `<Link>`, e não um efeito no `pathname` — setState
  dentro de effect é erro de lint aqui). Fechada, a gaveta é `visibility: hidden`, então os 7 links
  **saem da ordem de tabulação** em vez de ficarem focáveis fora da tela; aberta, o fundo não rola.
  **Medido antes × depois (mesma sessão, 375×838):** `.navbar` **227 → 46px** e o 1º campo **421 →
  172px** = **48,7% → 19,9%** da tela. Desktop **idêntico** (navbar 53px, 1º campo 240px, página 1384px).
  **Junto (feito):** os 7 `<Link>` perderam o sublinhado (`text-decoration: none` na classe
  `.icon-label-button`, nunca num seletor `a` nu — TD-013); e o **`.subtitle` some no celular**
  (decisão do dono nesta sessão: ~60px de texto decorativo no topo; marca, h1 e status ficam).
  **Faxina obrigatória junto:** o bloco mobile da navbar morava no **`quote.css`** (CSS da página de
  orçamento) — mesmo defeito de escopo do TD-013 e, por ordem de `@import` (12º vs 2º), venceria o novo.
  Foi **apagado** e o que sobrevivia (`.navbar-page-actions > * { flex: 1 }`) foi pro `header.css`.
  **Onde:** `NavBar.tsx` · `header.css` · `forms.css` · `responsive.css` · `quote.css`.
  ⚠ Alternativa **descartada** pelo dono: barra fixa no rodapé com os 4 mais usados + "•••".

- ~~**[UX-15] Alvos de ação minúsculos no catálogo + `window.confirm` genérico**~~ ✅ **FEITO
  (2026-08-16, passo ④)** — alvos de **32px** e o **Excluir afastado** (divisor mudou de lugar; faixa
  "Ações" 146 → 196px). Os **8** `window.confirm` viraram `ConfirmDialog` + `useConfirm`
  (`ask(): Promise<boolean>`, foco no Cancelar, Escape), com texto que **nomeia o alvo e diz o que NÃO
  é afetado**. ⚠ **Reverteu** a decisão do TD-004 (confirm destrutivo nativo) — registrado lá.
  **Junto, a pedido do dono:** os avisos inline viraram **um** componente (`FeedbackNote`/`useFeedback`;
  sucesso some em 5s, erro fica com ✕), `guardOnline`/`errorMessage` foram pro `src/lib/errors.ts`
  (eram 4 cópias) e a **`/vendas` ganhou o aviso que nunca teve** — a exclusão que estorna acabado +
  filamento gravava sem `try/catch` e falhava em silêncio. Writeup e as medições: `HISTORICO.md`.

- ~~**[UX-16] Rótulo não foca o campo**~~ ✅ **FEITO (2026-08-16, passo ⑤)** — `useId()` +
  `htmlFor`/`id` (**não** aninhado: `.section-label` é `display:flex`, o input viraria filho de flex).
  ⚠ **O escopo dobrou na medição, e o dono aprovou:** além dos 44 `<label>` havia **67
  `<div className="section-label">`** — rótulo *falso*, quase todos nos **modais e páginas** (o item
  original, medido só por `<label>`, teria consertado a calculadora e deixado o resto do app igual).
  **As 3 regras aplicadas:** rotula **campo** → vira `<label htmlFor>`; rotula **cabeçalho ou valor
  só-leitura** → segue `div` (label sem controle engana o leitor de tela); rotula **grupo** (chips de
  máquina, caixas do subitem) → `role="group"` + `aria-labelledby`. `aria-label` redundante foi
  **removido** (com label real ele vence o texto visível — WCAG 2.5.3); campo em linha de tabela
  (acessórios, filamento da `/producao`), que não tinha nome nenhum, **ganhou** `aria-label`.
  **Medido rodando:** rótulo clicável **1 → 19** (`/`), **0 → 8** (`/orcamento`), **2 → 11**
  (`/producao`), **0 → 7** (SaleModal), **0 → 5** (StockColorModal); **zero** campo sem nome acessível.
  **Zero visual, provado:** desfazendo a troca de tag ao vivo (método do TD-013) deu **0 diferenças**
  em 49 rótulos e altura idêntica em toda página. **Onde:** 15 componentes de formulário.

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
  - ~~**[UX-17b] — passo ⑦ (último): CONVERTER os 16 arquivos de `styles/`**~~ ✅ **FEITO
    (2026-08-16)** — **875 declarações trocadas: 779 literais + 96 ÓRFÃOS colapsados.** Tipografia de
    **23 tamanhos → 9**, raio de **15 → 8**. ⚠ **A contradição que a medição expôs, e o martelo do
    dono:** o `base.css` prometia "converter não deve mexer no visual" e o item mandava "matar os
    órfãos" — **as duas coisas não podem ser verdade**; o dono escolheu a **escala curta**, aceitando
    o drift de 1–2px, e a promessa foi retirada do comentário. Única exceção que **sobe** em vez de
    descer: `15px → 16px` em `.field-input`/`.btn` no celular (abaixo de 16px o iOS dá zoom ao focar).
    **O medo do TD-013 quase não se aplicou:** só existiam **4** seletores de elemento nu no app
    inteiro (`button, input, select`, `button`, `h1`×2) e nenhum segurava espaço/raio de outra página.
    **Prova:** 25 estados medidos antes×depois no DOM (7 rotas × 2 tamanhos + 3 abas + 3 modais +
    gaveta) — **toda** diferença cai na lista de órfãos, **0 elemento sumiu**. Writeup e as medições
    por rota: `HISTORICO.md`. ➕ **Junto:** `.btn:disabled` foi do `stock.css` pro `forms.css` (última
    regra global de `.btn` fora do dono) e as **abas da `/estoque` viraram chip**, byte a byte iguais
    às da NavBar nos 2 temas — resolvendo os "dois paradigmas de aba". ➕ **Achado de brinde:** o
    destino ativo da NavBar tinha fundo `rgba(74,158,118,.12)` — **verde cru**, ao lado de borda e
    texto laranja, sem responder ao tema; virou `--chip-active-bg`.
  **Medido antes (2026-08-15):** das ~220 declarações de `font-size`, **155 entre 10 e 13px** (65×
  `12px`, 50× `11px`, 40× `13px`), **23 tamanhos distintos** incluindo `11.5`/`12.5`/`9.5px`. Idem
  `border-radius`: **15 valores**. O `base.css` tinha 19 variáveis, **todas de cor**.
  ⚠ **Decidido (dono): manter DENSO, mas UNIFORME.** **Não** era para aumentar o corpo do texto (a
  proposta de subir pra 13–14px foi **recusada** — o dono prefere mais linhas por tela).
  **Onde:** `base.css` (tokens) + os **16** arquivos de `styles/`.

> **[UX-18] saiu daqui em 2026-08-15** → virou **[DEC-05]**, na seção "Decisões em aberto (DEC-*)".
> Motivo: o próprio item dizia "precisa do martelo do dono" e tem overlap com o branding (⏸ sem data);
> deixá-lo na fila de código travaria por tempo indeterminado tudo que viesse depois dele.

- ~~**[UX-19] Números sem gradação + ênfase no lugar errado**~~ ✅ **FEITO (2026-08-16, passo ⑥)** —
  a régua da **[DEC-04]** virou o módulo puro **`lib/marginTier.ts`** (+12 testes) e a cor entrou em
  **4 superfícies**: o item citava 2, mas o dono aprovou incluir o **card de preço da calculadora**
  (onde o dial de markup é mexido) e a **margem congelada do estoque**. **Nenhuma regra CSS existente
  foi editada** — `base.css` é o 1º `@import` e perde todo empate, então a faixa vai sempre num
  `<span>` próprio. **Medido:** 93 produtos = **20 bom · 63 ok · 10 ruim**; dial ao vivo 45% vermelho
  → 54% âmbar → 65% verde; **0 mudança de geometria** (clone do `<main>` sem os 372 spans: 7114px
  idêntica, 0 de 187 linhas diferentes). **2 achados que só a medição pegou:** `.sale-pos`/`.sale-neg`
  estavam **mortos** no cabeçalho do recibo (a Taxa nunca ficou vermelha) e `65%` saía âmbar E verde
  na mesma tela (a faixa lia o valor cru, a tela o arredondado). **Junto:** "Sem cliente" ficou mudo.
  Writeup + os contrastes medidos: `HISTORICO.md`.

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

### Tier 2 — comerciais já fechados (FEAT-09 · FEAT-10 · FEAT-11 · FEAT-06)

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
- ~~**[FEAT-06] Aba Produtos rica / composição congelada**~~ ✅ **FEITO (2026-07-20)** — evento, camada
  do acabado e venda passaram a guardar o `FrozenCostBreakdown`; `CostDetail` ganhou o modo de 2 colunas
  (precificado × real); `/producao` rotulou os dois números órfãos; aba Produtos ganhou composição,
  custo/un, mini-barras e margem congelada. Writeup + as 3 decisões em `HISTORICO.md`.
  - ~~**Follow-up (ROI real)**~~ ✅ **FEITO (2026-07-31, Tier 4)** — ver abaixo.

### Tier 3 (TD-003 · TD-006 · TD-010 · TD-011 · TD-012) e Tier 4 inteiro — fechados

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

### Decisões DEC-01…DEC-05 — todas já marteladas

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

### 7e — Insumos no estoque (fechado)

### 7e — Insumos no estoque
- ~~**[7e] Insumos no estoque**~~ ✅ **FEITO (2026-07-20)** — coleção `insumos` com FIFO por lote, 3ª
  aba na `/estoque`, `Accessory.supplyId` (avulso continua valendo) e baixa por unidade na produção.
  O `frozenCost` passou a somar insumos ⇒ **o lucro por peça de produções NOVAS caiu** (ficou
  correto); produções antigas não mudaram. Writeup em `HISTORICO.md`.


### Nota antiga do cabecalho do Tier 3 (TD-004 x UX-15) — movida na mesma faxina

### Tier 3 — infra de cálculo/leitura (TD-*) e, por último, o Dashboard
> Ordem interna: **TD-003 → TD-006 → TD-010/011 → TD-012 → Dashboard** (o Dashboard é o último item
> do backlog). **TD-001 a TD-012 fechados**; nesta seção só o **Dashboard** segue aberto.
> ⚠ **Correção 2026-08-15:** a linha antiga dizia "todos os TD-* fechados" — **falso desde 2026-08-15**,
> quando a auditoria abriu o **[TD-013]**, que mora na seção do cluster UI/UX (é o passo ① dele).
> **Sobre o [TD-004]:** está fechado (`HISTORICO.md`), **não** parcialmente aberto — mas a decisão
> registrada nele ("os `window.confirm` destrutivos seguem nativos por escolha") é **revertida pelo
> [UX-15]**. Quem for pegar o UX-15 deve saber que está mudando uma decisão, não completando uma.

