# LopoLabCalc — Backlog (a fazer)

> **Roadmap dos itens ABERTOS + ordem de prioridade.** Curto de propósito — é o que se lê pra
> escolher/rever a próxima tarefa (não precisa do histórico pesado pra isso).
> O *porquê* / detalhe de design (D1–D8, auditoria, writeups do que já foi feito) vive em
> [`.claude/HISTORICO.md`](HISTORICO.md) — abra sob demanda ao pegar o item.
> A foto do AGORA + a próxima tarefa sugerida vivem no `CLAUDE.md`.
>
> ⚠ **LEIA PRIMEIRO — a varredura AUD-16 (2026-08-28, a 9ª) é a varredura TOTAL do sistema, feita
> por outra IA sobre uma cópia ZIP.** Ela abriu **7 defeitos** (`[E1]`…`[E7]`); o **lote 1**
> (`[E1]`…`[E4]`, a fronteira de ingestão) e o **lote 2** (`[E5]` `[E6]`, a perda calada)
> FECHARAM em **2026-08-29**. **Aberto: só o `[E7]`.** A seção dela é a **primeira** deste arquivo. ⚠ Os 7 foram
> **reconferidos aqui com sonda rodando o parser real** — e a reconferência **corrigiu o
> relatório em 3 pontos** (ver a seção). O lote 3 dele (import >500 / timeout) **não é defeito**:
> é tradeoff já escrito e tratado no código.
>
> ⚠ **LEIA — a varredura AUD-15 (2026-08-26, a 8ª) é de REGRESSÃO: o alvo foi o código
> dos 4 lotes da AUD-14, não o sistema.** Ela **reabriu o backlog de código**: **6 defeitos**
> (`[E1]`…`[E6]`) + **2 ressalvas** — os lotes **1** (`[E6]`), **2** (`[E1]` `[E2]` `[E3]`) e
> **3** (`[E5]`) FECHARAM em 2026-08-26 e o **4** (`[E4]`) em **2026-08-28**: o cluster está
> **ZERADO**, sobram as 2 ressalvas.
> A seção deles está **logo abaixo deste
> cabeçalho**, ACIMA da AUD-14. Placar: **47 afirmações de ontem refeitas — 38 bateram, 8 não,
> 1 parcial** (a AUD-14 tinha derrubado 7 de 32; o padrão do repositório se repetiu). **Os 9 itens
> da AUD-14 continuam fazendo o que esta seção diz que fazem** — o que caiu foram *afirmações
> sobre* eles. **A pergunta "pode recadastrar?" já era SIM com uma trava, o `[E6]` — e a trava
> caiu:** ele era o único que mordia dado que o dono **não digita** (a planilha vem do sistema
> externo), e fechou. O de tela (`[E4]`) fechou depois, e nunca mordeu o dado da carga.
>
> ⚠ **LEIA ISTO ANTES DO RESTO — a varredura AUD-14 (2026-08-25, a 7ª e v4 da geral) abriu 9
> defeitos e os 4 lotes FECHARAM no mesmo dia.** A seção deles está **logo abaixo da seção da
> AUD-15**: lote 1 (`[D1]` `[D8]`), 2 (`[D2]` `[D3]`), 3 (`[D4]` `[D5]` `[D6]`) e 4 (`[D7]` `[D9]`
> + alvos de toque + as afirmações falsas, este com a prova ao vivo do lote 3 junto). **O backlog
> de código voltou a ZERO** — ⚠ isso valeu **só até 2026-08-25**: a AUD-15 o reabriu (ver a nota
> acima). O que sobra na seção da AUD-14 são as ressalvas dela e a lista do que ela não cobriu. Tudo que os parágrafos seguintes chamam de "ZERADO"
> descreve o estado **até 2026-08-24** e continua valendo como registro do que fechou. Vários
> parágrafos abaixo dizem "está ZERADO" descrevendo o estado **antes** da varredura **AUD-12** (a v2
> da geral); a **AUD-13** (a v3) abriu 18 itens depois deles e **fechou os cinco lotes no mesmo
> dia** — A, B, C, D e E (os 11 🟢). A seção dela é a **última** deste arquivo, logo acima de
> "## Fechado", e vale reler por dois motivos: ela **refuta parte da AUD-12** (o lote D daquela
> quebrou o `/producao`, `[TD-026]` 🔴) e ela deixa **ressalvas registradas** — os alvos a 1–4px da
> régua, o overdraft de −370 g na cor Bege, o `[CSV-30]`/`[TD-021]` e o `[A11Y-02]`, que fechou como
> **falso positivo declarado**. Os dois últimos abertos — o `[UX-47]` (a fileira de acessórios) e o
> `[UX-52]` (o "N disp." somando as cores contra um aviso de UMA cor) — **fecharam em 2026-08-24**,
> medidos no DOM e ao vivo; a seção deles agora é a de fechados, logo antes de "## Fechado".
> **Não sobrou item de código.** O que resta é a frente do DONO (cadastro de cores/insumos, religar
> os acessórios) e o branding do `[FEAT-03]`, adiado por ele.
>
> **Da AUD-12 (a v2), para o registro:** ela abriu **17 itens** — o cabeçalho dizia 15, e a conta
> estava errada: o rótulo "4 🟡" vinha
> seguido de **cinco** nomes. São 5 🔴 (`[CSV-23]` `[CSV-24]` `[UX-44]` `[CSV-25]` `[CSV-26]`),
> 2 🟠 (`[TD-022]` `[UX-46]`), **5** 🟡 (`[UX-45]` `[TD-023]` `[CSV-27]` `[CSV-28]` `[CSV-29]`) e
> 5 🟢 (`[CSV-31]` `[TD-021]` `[TD-024]` `[TD-025]` `[CSV-30]`).
>
> ✅ **Fecharam em 2026-08-23:** os 5 🔴 (lotes A e B, com os três que entravam calados na carga), o
> `[TD-022]` inteiro (reproduzido com escrita real), as duas guardas baratas `[TD-024]`/`[TD-025]`
> e os lotes **C** (`[CSV-27]` `[CSV-28]` `[CSV-29]` `[CSV-31]`), **D** (`[TD-023]`) e **E**
> (`[UX-45]` `[UX-46]`). `[CSV-30]` e `[TD-021]` viraram **ressalva** por decisão do dono.
> **O cluster AUD-12 está ZERADO** — e com ele o backlog de código, de novo. O que sobrou virou o
> `[UX-47]`, fechado em 2026-08-24, e as ressalvas medidas dentro do UX-45/UX-46.
>
> **Tier 0, Tier 1, Tier 4, o 7e, o cluster UI/UX de 2026-08-15, as ondas 0–5 e o `[micro]` do
> botão de 14px (2026-08-17) ✅ FECHADOS.** O
> registro deles (com as medições) vive no `HISTORICO.md` — seção "📒 Arquivo do BACKLOG" e os
> writeups das ondas 1 a 5. **Este arquivo só tem o que está ABERTO.**
>
> ⚠ **Estado em 2026-08-23, DEPOIS dos lotes A, B e D: o código da importação está ZERADO.** A
> varredura **AUD-09** abriu 12 itens (`CSV-09`…`CSV-20`), mais o [CSV-21] achado no lote A e o
> [CSV-22] aberto e fechado no lote D. **Tudo que era código da AUD-09 está fechado** — mas a
> **AUD-12** abriu `CSV-23`…`CSV-31` depois (ver o aviso do topo). Sobra: o [CSV-17]
> (token do arredondamento, item de **doc** — e ele avisa), que entra na spec da planilha; e
> [CSV-18]/[CSV-19]/[CSV-20], resíduo legado que o round-trip limpa sozinho.
>
> **A planilha-modelo mudou de forma (dono, 2026-08-23): NÃO vira botão no app.** Quem gera a
> planilha de importação é um **sistema externo do dono**, que lê os dados das impressões. O que
> falta é a **spec/planilha-modelo escrita no chat** com ele, *depois* que ele cadastrar as cores e
> os insumos definitivos e tiver os ids em mãos. O que era o "lote C" virou isso.
> O parágrafo abaixo descreve o estado de 2026-08-22.
>
> ⚠ **Estado em 2026-08-22: o backlog de código está ZERADO de novo.** A fila de ondas acabou em
> 2026-08-17; a auditoria de layout responsivo fechou em 2026-08-18; e o cluster da varredura
> **AUD-07** (10 defeitos) fechou nos **4 lotes** de 2026-08-22 — tabela logo abaixo.
> **O que sobra não é tarefa a pegar:** está acoplado ao rebrand (**DEC-05** + **G2**) ou bloqueado
> por algo de fora (**FEAT-03**, **branding/logo**, **Dashboard**, **AUD-08**).
> → **A próxima coisa é a CARGA EM MASSA**, que é trabalho e decisão do dono (planilha gerada por
> ele; as cores definitivas precisam estar cadastradas ANTES). Depois dela, a decisão é destravar o
> rebrand (a logo) ou abrir frente nova.
> **Atualização 2026-08-23:** os 3 bloqueantes da AUD-09 ([CSV-09], [CSV-10], [CSV-11]) e os 4 do
> lote B foram fechados no mesmo dia. **O que falta antes da carga é do dono:** cadastrar as cores
> e os insumos definitivos — só então eu gero a de-para e a planilha-modelo (lote C).

## ⚠ ABERTO — cluster da varredura AUD-16 (2026-08-28) — a 9ª, varredura TOTAL por outra IA

> Relatório cru: `AUD-16-RELATORIO.md` (fora do repo, veio com o dono). 63 casos de import/export,
> 38 de rota/UI, 8 de matemática, 11 de persistência. Base dela: **778/778**, `lint`/`typecheck`/
> `build` verdes, 35/35 medições sem rolagem horizontal, matemática batendo com contas externas,
> 1 ciclo produção→acabado→venda→estorno real no Firestore.
>
> **Reconferido AQUI, com sonda rodando o parser real (2026-08-29)** — os 7 se reproduzem. E a
> reconferência **corrigiu o relatório em 3 pontos**:
> · `[E4]`, metade do subitem: `name: 2` **não estoura** — entra gravado como NÚMERO num campo que
>   o tipo declara `string`. Pior que o throw, porque é calado.
> · **caso novo que ela não achou:** `Filamentos JSON = [null]` estourava em
>   `Cannot read properties of null (reading 'id')` — mesma causa raiz do `[E4]`.
> · o **lote 3 dela (import >500 / timeout) NÃO é defeito**: os dois pontos já estão escritos e
>   tratados (`productsRepository.ts:99` informa quantos entraram; `withWriteTimeout` manda **não**
>   repetir a ação). É tradeoff documentado — vira ressalva, não item.
>
> ⚠ **O que este lote NÃO fez, de propósito:** o relatório pedia **bloquear** a confirmação quando
> houver erro de domínio. Este app **avisa e deixa o dono decidir** (TD-009, escrito na
> `CsvImportResult`: "Nada disso bloqueia"). Mantive a regra da casa — **bloquear é decisão do
> dono**, e é uma linha de código no dia em que ele mandar.

### ✅ FECHADO — a fronteira de ingestão (lote 1, 2026-08-29)

`[E1]` `[E2]` `[E3]` `[E4]` — mesma causa raiz: **a normalização acontecia ANTES de uma validação
que não cobria tudo**, então o importador ora avisava, ora corrigia calado, ora estourava com erro
técnico. A assimetria denunciava: `Mao de obra (min) = -30` entrava negativa e acendia
`linha-invalida`; `Tempo (h) = -1` virava 0 com `issues: []`, porque tinha um clamp na frente.

| Repro | Antes | Agora |
|---|---|---|
| `Tempo (h) = -1` | `printHours: 0`, sem aviso | entra cru → `linha-invalida` ("Tempo de impressão") |
| `Taxa Falha (%) = -1 / 96 / 500` | 0 / 95 / 95, sem aviso | entra cru → `linha-invalida` ("Taxa de falha") |
| `[{"desc":"X","supplyId":"sup"}]` | `qty:0, unitPrice:0`, sem aviso | `acessorio-zerado` |
| `colorName: []` | **derruba a carga inteira** | `json-tipo-errado`, cor entra com nome vazio |
| `subitem name: 2` | grava número em campo `string` | `json-tipo-errado`, vira `"2"` |
| `[null]` / `[[]]` na lista | **throw** / cor fantasma de 0 g | `json-item-invalido`, item descartado |
| linha boa | sem aviso | **sem aviso** (nenhum falso positivo) |

O que mudou no código: o clamp do tempo (`Math.max(0, …)`) e o da taxa (`Math.min(95, Math.max(0,
…))`) **saíram**; `validateProduct` ganhou o **domínio 0–95 da taxa de falha**, que passa a valer
igual para o formulário e para o CSV; dois ajudantes novos (`textoJson`, `objetoJson`) cuidam da
FORMA do JSON, e as cores de etapa deixaram de ser uma **segunda cópia** do bloco de cores
(`parseFilamentList`). A matemática não corre risco com o valor cru: `failureFractionOf` tem o teto
de 95% dele, compartilhado com a capacidade (TD-011). **806/806 · lint ✅ typecheck ✅ build ✅.**

### 🔴 `[E7]` — produção sem lote promete overdraft e não registra nada

- **Medido:** `simulateFifo([], 200)` → `moves: []`, `shortfall: 200`. Sem lote não há onde lançar,
  então **não há baixa e não há custo**; a tela, porém, diz "o saldo da cor fica negativo" e
  "faltam N unidades" (`ProductionPage.tsx:1051-1061`). A auditoria mediu ao vivo: mesma impressão
  custou **R$ 1,22** sem lote e **R$ 4,89** depois de lançar os rolos.
- **O estrago:** o dono produz antes de lançar a compra achando que a dívida ficou registrada.
  Material e insumo somem do custo real **e** da baixa.
- **Pronto quando:** ou a produção é **bloqueada** sem lote, ou a dívida fica **representada e
  custeada** — e a prévia diz o mesmo que o documento salvo.
- **Arquivos:** `fifo.ts:58-96`, `stock.ts`, `supplies.ts`, `production.ts`, `ProductionPage.tsx`.

### ✅ FECHADO — a perda calada (lote 2, 2026-08-29)

`[E5]` `[E6]` — dois lugares onde o app **descartava texto sem dizer**. Um custa uma SKU no
estorno, o outro custa a legibilidade do orçamento; a resposta é a mesma nos dois: **o que não
passa tem de aparecer**.

| Repro | Antes | Agora |
|---|---|---|
| `[{part:""},{part:"corpo",colorKey:"x"}]` | `corpo` volta, `malformed: false` | `corpo` volta, **`malformed: true`** |
| `[{part:123, colorKey:{}}]` | `part:"123"`, `colorKey:"[object Object]"` | descartado + `malformed` |
| `[{part:"corpo", colorKey:7}]` | `colorKey:"7"` (SKU inventada) | descartado + `malformed` |
| `sanitizeForPdf("um\ndois")` | `"umdois"` | `"um dois"` |
| Observações em 2 linhas no PDF | uma linha colada | **2 linhas** (a vazia inclusive) |

O que mudou: `readFinishedColors` passou a contar **qualquer** entrada perdida (antes só a perda
TOTAL) e **parou de coagir com `String(...)`** — parte tem de ser string não-vazia, chave de cor
tem de ser string ou ausente; coerção cega é pior que descarte porque não deixa rastro. O aviso
saiu do `console.warn` de dev e virou faixa na `/vendas`, **nomeando o documento** (campo novo
`Sale.finishedColorsMalformed`, escrito só pelo `toSale`). No PDF, `sanitizeForPdf` trata a
quebra como **separador de linha** (vira espaço) e o novo `sanitizeBlockForPdf` **preserva** o
`\n` das Observações — medido: o `splitTextToSize` do jsPDF já quebra nele. **814/814 · lint ✅
typecheck ✅ build ✅.**

### ⚠️ Ressalvas da AUD-16 (não são itens; viram item se o dono mandar)

- **Import >500 não é atômico** — commits sequenciais de 500, com o erro dizendo quantos entraram.
  Tradeoff **já escrito** no código; o `withWriteTimeout` é `Promise.race` e não cancela o commit
  do Firestore (a mensagem dele manda **não** repetir a ação).
- **Steppers dos campos numéricos** medem 28×20px no celular, mas são `aria-hidden` **dentro** de um
  campo de 44px — não são alvo independente.
- **Console não está em zero:** um recibo real (`yoRC0YZjQAq2piItJojG`) tem `finishedColors`
  ilegível e avisa a cada leitura de `/vendas`. O `console.warn` continua (é diagnóstico); o que
  mudou no lote 2 é que **o dono agora vê o recado na tela**, com o id do documento.
- **Simulações, não Excel de verdade:** BOM, CRLF, latin-1 e notação científica foram simulados.
- **Não coberto:** regras publicadas no Console Firebase, segunda conta Google, Safari/iOS/Firefox,
  duas abas, corte de rede no meio da transação de venda, import real de 501+.

## ✅ ZERADO — cluster da varredura AUD-15 (2026-08-26) — a 8ª, REGRESSÃO dos lotes da AUD-14

> **O alvo não foi o sistema, foi o código de ontem.** Os 4 lotes da AUD-14 mexeram em 46 arquivos
> e na camada de escrita inteira, e ninguém além de quem os escreveu os exercitou. Relatório
> completo, com as medições cruas:
> [artifact 20582690](https://claude.ai/code/artifact/20582690-a94f-4d52-8fca-d6dec7244a00).
> Números de base: **764/764 em 5 execuções sem flake** · **escrita real autorizada** (4 eventos de
> produção gravados e estornados) · **diff campo a campo contra backup integral: 0 documentos com
> dado alterado** · `lint` ✅ `build` ✅ · **`tsc` acusa 2 erros** (1 pré-existente + 1 novo, o `[E5]`).
> **4 achados dela caíram como falso positivo e estão declarados no relatório** (o BOM do CSV de
> vendas, o `material`/`brand` do round-trip, o `0.90` no Excel, e o teste da rejeição solta).
>
> **Os 2 que entravam CALADOS:** `[E4]` (status "Sincronizado" com a rede caída — sem aviso na
> hora e sem divergência visível depois) e `[E6]` (valor de magnitude absurda vindo da planilha
> externa, com `issues: []` e `warnings: []`) — **os dois fecharam** (`[E6]` em 26/08, `[E4]` em
> 28/08). Os outros 4 eram visíveis.
>
> **Reconferido no código em 2026-08-26** (não é só o relatório falando): `[E1]` `[E2]` `[E3]`
> `[E5]` `[E6]` e a ressalva `[R1]` foram todos reproduzidos estaticamente — ordem dos `@import`,
> ausência de regra de alvo, a regex, a saída do `tsc` e o `git show c990679~1`.

### Ordem sugerida (não decidida pelo dono)

| Lote | Itens | Por que esses | Estado |
|---|---|---|---|
| **1 — a trava do recadastro** | `[E6]` | É o único que morde dado que o dono **não digita**, e o recadastro é a próxima frente. Uma linha de checagem | ✅ **FECHADO 2026-08-26** |
| **2 — a régua do dedo, de novo** | `[E1]` `[E2]` `[E3]` | Um commit de CSS só. A conclusão "0 abaixo de 44" do lote 4 vale nas rotas, **não** em 641–760px nem com diálogo aberto | ✅ **FECHADO 2026-08-26** |
| **3 — o tipo que se perdeu** | `[E5]` | Uma linha na fixture. Nasceu no `c990679` | ✅ **FECHADO 2026-08-26** |
| **4 — o indicador que mente** | `[E4]` | O mais caro dos quatro (exige sonda de conectividade real, não `navigator.onLine`) e o que entra mais calado | ✅ **FECHADO 2026-08-28** |

### ✅ FECHADO — a trava do recadastro (lote 1, 2026-08-26)

- ✅ **[E6] `isMilharMultiplo` era trava de PONTUAÇÃO, e a premissa que a justificava era de
  MAGNITUDE — agora a trava é a premissa.** O comentário do `number.ts` argumentava que 2+ grupos
  de milhar bastavam *"porque nenhuma coluna deste app tem valor plausível acima de 999.999"*, mas
  o teste era a regex `/^-?\d{1,3}(?:\.\d{3}){2,}$/`, **ancorada no fim** — qualquer parte decimal
  a desarmava, e en-US ou inteiro cru nunca a acionavam.
  **Conserto:** `isMilharMultiplo` **saiu**; no lugar entrou `isMagnitudeAbsurda`, que lê o valor
  (`parseDecimalPtBr`) e acende quando `Math.abs(parsed) > MAGNITUDE_MAXIMA` (999.999). É estrita-
  mente mais forte: dois grupos de milhar já valem 1.000.000, então o caso do Excel da AUD-14
  (`5.283.333.333.333.330`) continua coberto.
  **Três ganhos de tabela**, todos com teste: **científica** entra pelo mérito (`5,28E+15` acende;
  a versão de forma tinha de excluí-la para não mentir, CSV-29) · **número cru** entra (dentro do
  JSON o `1234567` chega como `number`, e a versão de forma devolvia `false` para tudo que não
  fosse string) · e a **borda** ficou declarada (999.999 atravessa; 999.999,99 acende).
  **Classes renomeadas** porque a mensagem antiga descrevia a pontuação, não o defeito:
  `milhar-multiplo` → `magnitude-absurda` e `milhar-multiplo-json` → `magnitude-absurda-json`
  (a chave só agrupa e serve de `key` no React — nada fora dos testes a lia).
  **`isMilharAmbiguo` não se mexeu:** UM grupo (`1.234`) continua sendo ambiguidade de leitura, com
  a lista curada de colunas dele.
  Arquivos: `src/lib/formatting/number.ts`, `productCsv.ts` (as 2 chamadas + as 2 mensagens),
  `number.test.ts` (describe reescrito) e `productCsvIssues.test.ts` (chaves + describe novo do E6).
  **Prova:** as 4 formas medidas na AUD-15 (`1.234.567,89`, `1,234,567.89`, `1.234.567,00`,
  `1234567`) em `Valor-hora (R$)` acendem `magnitude-absurda` citando a coluna e a célula crua;
  `999.999,00` atravessa calado e entra como 999999. **773/773** · `lint` ✅ · `build` ✅ ·
  `tsc --noEmit` segue com os **mesmos 2** erros de antes (nenhum novo; o 2º é o `[E5]`).

### ✅ FECHADO — a régua do dedo, de novo (lote 2, 2026-08-26)

> Um commit de CSS só, e a varredura dos **9 diálogos** junto, como o `[E3]` pedia.
> **Resultado medido:** 320 / 375 / 641 / 760px → **0 alvos abaixo de 44** nas rotas afetadas e
> nos 9 diálogos · 1280px → **0 abaixo de 32** nos 9 diálogos · **rolagem lateral 0** em todas as
> larguras · **773/773** · `lint` ✅ `build` ✅.

- ✅ **[E1] O regime de 44 do `.roi-warn > summary` mudou de ARQUIVO, porque de onde estava ele não
  alcançava.** Confirmado ao vivo antes do conserto: 641px → 600×32 e 760px → 719×32, `min-height`
  computado **32px**. O `responsive.css` é o 8º `@import` e o `machines.css` é o 14º; os dois
  seletores são `.x > summary` (mesma especificidade) e `@media` **não soma** — a regra do 14º
  vencia por ordem, inclusive dentro da media query do 8º.
  **Conserto:** a linha `.roi-warn > summary` **saiu** da lista do `responsive.css` (lá ela era
  código morto, e a devolução de −8px nem era a certa para este elemento) e o bloco de 44 nasceu
  no `machines.css`, num `@media (max-width: 760px)` próprio, onde ele é o último a falar.
  **Padding de 13px por lado com margem negativa igual** (18 de conteúdo + 26 = 44): a margem
  cancela o padding, então a conta se mantém quando a frase quebra em duas linhas.
  **Prova:** 641px → 600×**44** ocupando 18 · 760px → 719×**44** ocupando 18 · 375px → 334×**62**
  (2 linhas) ocupando **36**, os mesmos 36 de antes · 1280px → 1047×**32** ocupando 18, desktop
  intacto. Em nenhuma largura o `.roi-warn` mudou de altura.
  **A afirmação falsa do `machines.css` saiu** e no lugar ficou a medição, com o nome da armadilha.

- ✅ **[E2] `.toggle-wrap` ganhou a primeira regra de alvo da vida dele.** Os dois interruptores
  das seções recolhíveis da calculadora ("Vende por subitens" e "Custos fixos") não tinham
  `min-height` em arquivo nenhum. Confirmado antes: 317,8×**33** a 641 e a 760px.
  **Conserto:** no `responsive.css` (o `sections.css` é o 4º, então aqui a ordem *ajuda*),
  `min-height: 44px` + `padding-block: 6px` + `margin-block: -6px`.
  **Prova:** 641 e 760px → 317,8×**45**, ocupando os mesmos **33** · 375px → 196,8×**59** e
  201,6×**87**, ocupando **47** e **75** — exatamente os números naturais de antes · 1280px
  inalterado (`min-height: auto`, 33 e 47). Altura do pai idêntica em todas.

- ✅ **[E3] Os 9 diálogos foram varridos. Só o de venda tinha defeito — e eram 18, não 4.**
  A varredura abriu os 9 (`SaleModal`, `MachineManagerModal`, `ConfirmDialog`, `StockColorModal`,
  `StockRollModal`, `StockAdjustModal`, `SupplyModal`, `SupplyLotModal`, `SupplyAdjustModal`) nas
  **duas** réguas. **8 estavam sãos**; o de venda rendeu os 4 previstos **mais 14 que a AUD-15 não
  tinha visto**, porque só aparecem depois de interagir:
  · `.fee-edit-link` 84,5×**23** · `.discount-mode-toggle button` ×3 → **40** de altura (os 4 da
  previsão) · `.fee-editor-item input` ×12 → 81×**38**, atrás do botão "Ajustar taxas"
  · `.discount-unit-toggle button` ×2 ("R$" / "%") → **36,7×42** e **33,8×42**, só visíveis com
  item na cesta e desconto **por item** escolhido.
  **Conserto:** o regime de 44 foi escrito **dentro do `fees.css` (10º) e do `cesta-recibo.css`
  (12º)**, não no `responsive.css` (8º) — pelo mesmo motivo do `[E1]`: os seletores empatam em
  especificidade e lá perderiam por ordem. Fica registrado como regra: **todo arquivo depois do 8º
  `@import` carrega o próprio regime de 44.**
  ⚠ **Uma armadilha nova, medida durante o conserto:** `min-width: 44px` sozinho nos botões
  "R$/%" **estoura a fileira** — os dois pedem 90px e sobravam 70, e como o `.discount-unit-toggle`
  tem `overflow: hidden` o "%" era **CORTADO** em vez de vazar (o UX-44 pela porta dos fundos).
  A largura veio de dar **linha própria ao rótulo** "Desconto" (`flex-wrap` na `.cesta-discount` +
  `flex: 0 0 100%` no rótulo), que é a receita de UX-38/UX-40 para fileira que não cabe.
  ⚠ **Achado de tabela, do mesmo commit:** a régua de **DESKTOP** (32px) também tinha buraco no
  mesmo modal — `.fee-edit-link` **23** e os 3 `.discount-mode-toggle button` **24** a 1280px. A
  afirmação "0 abaixo de 32 a 1280px" do lote 4 também era **só das rotas**. Os dois pisos entraram
  na regra base (fora da media query).
  **Prova:** modal de venda com editor de taxas aberto, item na cesta e desconto por item →
  **0 abaixo de 44** a 320, 375 e 760px e **0 abaixo de 32** a 1280px, `overflow` horizontal **0**
  na caixa, na fileira e no documento. Fluxo preservado onde importa: `.fee-row` 68→**68** no
  celular e 54→**54** no desktop. O que cresceu, cresceu de propósito: editor de taxas 491→521,
  seletor de modo 42→46, fileira de desconto 44→**69** (o rótulo subiu de linha).
  ⚠ **`.num-spin` ficou de fora da conta, como nas varreduras anteriores** — 28×~20, `tabindex="-1"`,
  é o stepper ao lado do campo e o alvo de verdade é o campo (exceção já declarada no lote 4).

### ✅ FECHADO — o tipo que se perdeu (lote 3, 2026-08-26)

- ✅ **[E5] `tsc --noEmit` está verde — e agora é rotina, que é o que impedia o próximo `[E5]`.**
  Os **2** erros caíram, não 1. **(a)** `productionPlan.test.ts(256,9)`, TS2322: a fixture
  `const laranja: StockFilament` ganhou `material: "PLA"`, `brand: "Bambu"` e `minG: 0` — os mesmos
  valores da outra fixture do mesmo arquivo, pra não inventar um terceiro estilo. Nenhum
  deles entra na conta do `[D9]` (catálogo × FIFO), então a prova segue idêntica.
  **(b)** `calculatePricing.test.ts(205,30)`, TS2352, o **pré-existente**: era o cast do documento
  antigo com `energyTariff`/`laborRate` dentro da etapa. Virou `as unknown as Partial<ProductInput>`
  — a forma que o próprio compilador sugere — com o comentário dizendo o porquê: o erro é o TS
  avisando que o lixo **não existe mais no tipo**, que é exatamente o que o teste simula. Deixá-lo
  de fora manteria o `tsc` vermelho e a rotina abaixo seria decorativa.
  **Decisão tomada (a que o item pedia):** **`pnpm typecheck` entra em "concluir a tarefa"**, ao
  lado de `lint`/`test`/`build`. Script novo no `package.json`; `CLAUDE.md` atualizado na Diretriz 4,
  na 8 e nos Comandos. **O motivo, medido:** `pnpm build` **não typa arquivo de teste** — ele passou
  verde com o TS2322 vivo o tempo todo — e `pnpm lint` não roda `tsc`. Sem o comando próprio, todo
  erro de tipo em teste é invisível.
  ⚠ **Achado de tabela, fora do item:** `pnpm test` **morria antes de rodar um teste sequer**
  (`memory allocation of 248752 bytes failed`) — reproduzido **na árvore limpa** via `git stash`,
  logo não é regressão de código: o Vitest abre 1 worker por CPU (**16** nesta máquina) e sobravam
  **0,5 GB de 7,7 GB**. `maxWorkers: 4` no `vitest.config.ts`, com o porquê no comentário; a suíte
  fecha em ~1s de teste, então não custa nada. ⚠ `minWorkers` **não existe** no tipo do Vitest 4 —
  e quem pegou foi o `pnpm build`, que typa o `vitest.config.ts`. O **build** também caiu uma vez
  pela mesma memória (`worker exited with code: 3221226505`, na geração das páginas) e passou na
  segunda — ambiente, não código.
  **Prova:** `pnpm typecheck` sai **limpo** (era 2 erros) · **773/773** · `lint` ✅ · `build` ✅.

### ✅ FECHADO — o indicador que mente (lote 4, 2026-08-28)

- ✅ **[E4] O chip parou de perguntar "chegou dado?" e passou a perguntar "de ONDE veio?".**
  O defeito medido pela AUD-15: com `disableNetwork(db)`, 12 leituras em 18s, o chip ficava em
  `.cloud-status synced :: "Sincronizado"` o tempo inteiro, com `navigator.onLine = true` sempre.
  O `onSnapshot` **entrega** quando a rede cai — serve do cache e chama o mesmo callback de
  sucesso —, e os 9 hooks liam esse callback como prova de vida (`setStatus("synced")`).
  **Conserto:** `src/lib/cloudStatus.ts` (novo), com a função pura `cloudStatusOf({fromCache,
  hasPendingWrites})` → `pending` | `offline` | `synced`, mais a `COM_METADATA` compartilhada.
  As 9 assinaturas de coleção passaram a pedir `includeMetadataChanges` e a repassar
  `snapshot.metadata` como 2º (ou 3º) argumento do callback; os 9 hooks trocaram
  `setStatus("synced")` por `setStatus(cloudStatusOf(origin))`. Dois rótulos novos no `PageHeader`:
  **"Sem conexão"** (`--warn`) e **"Gravando..."** (muted, como o `connecting`), com a consequência
  inteira num `title`.
  ⚠ **A ORDEM da função é o item inteiro:** `hasPendingWrites` é testado ANTES de `fromCache`,
  porque **online** o snapshot otimista de toda gravação também chega com `fromCache: true` (é a
  compensação de latência). Invertendo os dois, o chip piscaria "Sem conexão" a cada save — a
  mentira oposta. Nenhum dos dois ramos novos afirma "Sincronizado".
  ⚠ **`includeMetadataChanges` não é detalhe:** sem ela o Firestore **não reemite** quando só o
  metadado muda, e a queda de rede é exatamente isso (os documentos continuam iguais, muda a
  origem). Era o evento que faltava para a tela saber.
  ⚠ **Achado de tabela, do mesmo commit:** o "X de N" da `/producao` tinha o mesmo TD-019 que as
  vendas já tinham consertado — a aggregation query disparava no snapshot otimista e voltava o
  número de ANTES da gravação, e a confirmação nunca chegava. Agora chega, e o
  `!origin.hasPendingWrites` espera por ela.
  **Prova ao vivo** (dev server, sessão autenticada do dono; transporte para
  `firestore.googleapis.com` cortado no XHR/fetch, que é o cenário "Wi-Fi conectado sem internet"
  do `[D2]` — o `navigator.onLine` fica `true` o tempo todo, e é esse o ponto):
  · `/estoque` → `synced → offline` em **≤1s**, e **"Sem conexão" nas 20 amostras de 20s**
  (a AUD-15 tinha conjunto de 1 valor: "Sincronizado"); restaurado o transporte, volta a
  "Sincronizado" em ≤1s · `/producao` (`useProductionPage`, o callback de 3 argumentos) e
  `/vendas` (`useSalesPage`) → mesma ida e volta, e os cards de agregação seguem em
  **47 / R$ 2.620,70 / R$ 853,05 / R$ 1.762,87 / 67%** antes e depois · `/` (`useProducts`) idem.
  **Contraste do rótulo novo:** escuro `rgb(224,163,58)` ≈ 8,6:1 · claro `rgb(160,90,0)` sobre
  `rgb(250,250,247)` ≈ **5,1:1** — os dois passam de 4,5:1.
  **Sem regressão no caminho feliz:** "Editar + Salvar" numa cor (gravação real, `runTransaction`)
  → **0 transições** do chip em 3s de `MutationObserver`. É o esperado: transação do Firestore
  **não** aplica local, então nem chega a existir snapshot pendente.
  ⚠ **O que NÃO foi medido ao vivo:** o rótulo `pending` ("Gravando..."), que só aparece nos
  caminhos que aplicam local — `addDoc` / `deleteDoc` / `writeBatch` (criar produto, criar cor,
  criar insumo, excluir produto, importar CSV). Exigiria escrever dado de teste no Firestore do
  dono. A precedência dele sobre o `offline` está fixada em teste unitário
  (`src/lib/cloudStatus.test.ts`, 5 casos).
  **778/778** · `lint` ✅ · `typecheck` ✅ · `build` ✅.

### ⚠️ Ressalvas da AUD-15 (não são itens; viram item se o dono mandar)

- ⚠️ **[R1] `readFinishedColors` conta a perda TOTAL e cala a PARCIAL.**
  `finishedGoods.ts:199` — `malformed = raw.length > 0 && entries.length === 0`. Um item torto no
  MEIO de uma lista boa some sem nada dizer, que é a classe de coisa que o `[D6]` existe para
  impedir. **Medido:** `1 torto + 3 bons` → `entries: 3`, `malformed: false` (perde 1 calado) ·
  `{part: "a"}` sem `colorKey` → entra com `colorKey: ""` · `{part: 0}` (falsy) → `malformed: true`,
  inconsistente com o caso acima. Alcançar isso exige documento escrito à mão — por isso é
  ressalva.

- ⚠️ **[R2] Os "9 escalares" do `[D1]` são 8 — e sobra uma célula com ponto que nenhuma lista cita.**
  Varredura de TODA célula escalar do export: `"Pecas" = "2.5"` (ponto, fora do `numeroPtBr`) e
  `"Arredondamento" = "0.90"` (ponto, em nenhuma das duas listas); **as outras 22 com vírgula** ✓.
  Round-trip real no Excel 16 pt-BR: `"0.90"` volta **intacto** (o Excel a trata como TEXTO, não é
  agrupamento pt-BR válido) e, se `"2.5"` virasse `25`, o `validateProduct` **reprova**
  `piecesCount` não-inteiro nos DOIS caminhos (form e importação) → não chega ao banco.
  ⚠️ **A afirmação é que está errada, não o comportamento.** O arquivo é pt-BR na prática; a conta
  de 9 é 8.

### O que a AUD-15 NÃO cobriu

- **Regras de segurança do Firestore** — 6ª varredura seguida. Exige uma 2ª conta Google.
- **Escala acima de 500 produtos** — o corte do `createProductsBatch`, onde o lote pode entrar pela
  metade, segue sem prova (exigiria ~1.040 escritas).
- **Google Sheets** — o Excel fechou; o Sheets exigiria login e envio de arquivo.
- ~~**Os outros 7 diálogos**~~ — **coberto**: os 9 foram varridos no lote 2 (ver `[E3]`).
- **Duas abas com timeout no meio** — o guarda `rev` foi lido no código e a AUD-14 o mediu; a
  corrida com o prazo de 12s no meio não foi reproduzida.
- **Tema escuro na geometria** — mediu um tema só. A geometria não depende de tema (token de cor
  não entra em `min-height`/`flex`), mas o contraste não foi reconferido.
- **iOS Safari real** e navegadores fora do Chromium embutido.
- **O `<select>` que corta sem reticências** — segue ressalva do dono, reconfirmada em **8,5%** no
  modal de venda.

### ✅ O que está SÃO — medido, não presumido (o resumo; o cru está no relatório)

- **Lote 1:** round-trip real no Excel 16 pt-BR — `4,75` volta exato, `5,283333333333333` custa
  **3,333×10⁻¹⁰ h**, `warnings: []` nas duas pontas · `[D8]` round-trip campo a campo com
  acessório + `supplyId` + `subitemId` + etapa extra + multicolor: **`csv1 === csv2` byte a byte**,
  0 escalares divergentes em 13 campos · CSV do `/vendas` (nunca exercitado antes): 22×48, **0
  células com ponto**, BOM `EF BB BF` presente nos bytes crus, `—` e `Ç` intactos no Excel.
- **Lote 2:** offline REAL — `t=1,0s` "Salvando…" `disabled` · `t=13,0s` a frase do timeout **com o
  nome ainda no campo** · `enableNetwork` → produtos **99 → 100**: **a escrita entrou sozinha**, e a
  frase que manda CONFERIR está certa ("nada foi salvo" teria mentido) · **21** chamadas de
  `withWriteTimeout` nos repositórios e **0 escritas exportadas fora dele** · a escrita mais pesada
  do app (transação nas 4 coleções) confirmada em **776 ms** → folga de ~15× contra os 12.000 ms.
- **Lote 3:** `[D4]` select 259×44 com 8,5% cortado (dentro dos "5 a 9%" que o lote 4 corrigiu) ·
  `[D5]` ao vivo: "só para os 23 recibos já carregados" → um clique → **23 → 41**, topo por receita
  vai de `88,00 / 87,59` para `159,34 / 105,30`, `totals.count = 47` = docs no Firestore.
- **Lote 4:** `[D7]` **0 referências** ao código morto, nenhuma função órfã · `[D9]` **escrita real**:
  `catalogPricePerKg` em 100% das linhas, `pricePerKg` ausente, `catalogUnitPrice` no insumo, e a
  conta à mão do FIFO (`40×100/1000 + 15×110/1000 = 5,65`) **bate dígito a dígito** com o
  `frozenBreakdown.material`, com a divergência de **R$ 0,375** nomeada no mesmo documento · os 57
  eventos antigos com `pricePerKg` continuam legíveis pelo `??`.
- **Padrão nº 9 (o defeito que só aparece na 2ª vez):** o mesmo produto produzido duas vezes
  seguidas — 57 → 59 → 61 eventos, FIFO andou certo nas duas.
- **Balanço da escrita real:** `producao` 57→57 · `estoque` 2 docs / 1.646 g → idem · `insumos` 306
  un → idem · `acabados` 22 / 39 peças → idem · `vendas` 47 → 47 · `products` 99 → 99.
  **0 documentos com dado alterado** (só o `rev` subiu, de propósito: estoque 18→30, acabados
  22→26 = as 6 transações gravadas e estornadas). O **overdraft de −370 g na Bege** continua
  idêntico (é o furo de contagem física que o `[D4]` preserva de propósito).
- **Layout, 4 fronteiras × 7 rotas com acordeões abertos:** 375px → **0** abaixo de 44 · 641 e
  760px → **2** (os `[E1]`/`[E2]`) · 1280px → **0** abaixo de 32 · **rolagem lateral 0 em todas** ·
  `document.scrollWidth === innerWidth` em **28 combinações**.

## ✅ ZERADO — cluster da varredura AUD-14 (2026-08-25) — a 7ª, v4 da geral

> **Os 4 lotes fecharam no mesmo dia (2026-08-25).** Não há item aberto de código nesta seção; o
> que sobra são as **ressalvas** (que só viram item se o dono mandar) e a lista do que a varredura
> não cobriu.

> **A pergunta que ela existiu para responder:** *a Diretriz 7 pode expirar?* Resposta medida:
> **sim, com uma trava** — havia um caminho que corrompia a carga **em silêncio** (o `[D1]`, que
> fechou no lote 1). Relatório completo, com as medições cruas:
> [artifact 99e19ac1](https://claude.ai/code/artifact/99e19ac1-7b0b-4d05-8640-2fb3217eab71).
> Números de base: **729/729 em 4 execuções sem flake** · divergência máxima contra a conta à mão
> **8,0×10⁻¹²** · 1.902 medições de contraste, 0 falhas · backup de **251 documentos**, **0 docs com
> dado alterado ao fim** · **32 afirmações anteriores refeitas: 25 bateram, 7 não** (4 delas são
> comentários no código descrevendo comportamento que mudou).
>
> **Os 6 erros que entram CALADOS** (a 2ª pergunta do dono): `[D1]` horas ×10¹⁵ · `[D2]` escrita
> perdida offline · `[D3]` exclusão offline · `[D6]` `finishedColors` em formato antigo · `[D5]`
> ranking parcial · `[D9]` preço divergente no evento. Três deles (`[D2]` `[D3]` `[D6]`) são
> invisíveis **mesmo depois**.

### Ordem dos lotes AUD-14 (dono, 2026-08-25: "lote 1 e ir aos outros depois, um commit por lote")

| Lote | Itens | Por que esses | Estado |
|---|---|---|---|
| **1 — a planilha da carga** | `[D1]` · `[D8]` | Era o único que **bloqueava o recadastro**: corrompe no caminho exato que o dono desenhou (sistema externo gera → confere no Excel → reimporta) | ✅ **FEITO (2026-08-25)** |
| **2 — a escrita que evapora** | `[D2]` · `[D3]` | Quiosque tem rede ruim, e o app afirma "Sincronizado" enquanto perde o produto. Cada clique repetido enfileira outra escrita | ✅ **FEITO (2026-08-25)** |
| **3 — a tela que informa errado** | `[D4]` · `[D5]` · `[D6]` | Não corrompem dado; informam errado uma decisão de negócio | ✅ **FEITO (2026-08-25)** — medido ao vivo no lote 4, **com 2 correções** |
| **4 — poeira e verdade escrita** | `[D7]` · `[D9]` + alvos de toque + as afirmações falsas | Inerte hoje; é o padrão nº 10 (código morto que volta a ser chamado) e o comentário que envelhece | ✅ **FEITO (2026-08-25)** — com a prova ao vivo do lote 3 junto |

### ✅ FECHADOS no lote 1 (2026-08-25)

- ✅ **[D1] FEITO — o arquivo é pt-BR INTEIRO, e o ponto repetido passou a ACUSAR.**
  Duas metades, porque a planilha da carga é **gerada por máquina que o app não controla**:
  · **o export** — 11 colunas de dinheiro já saíam pelo `formatDecimal`; **9 escalares** saíam pelo
  `String(number)` do `join`, ou seja com PONTO decimal (`Tempo (h)`, `Tarifa Energia`,
  `Valor-hora`, `Markup`, `Filamento (R$/kg)`, `Mao de obra (min)`, `Taxa Falha`, `Pecas`,
  `Margem`). Agora todas saem com vírgula, **sem agrupar o milhar** (agrupar reintroduziria a
  ambiguidade do CSV-07 no arquivo do próprio app).
  · **a importação** — classe nova `milhar-multiplo` (+ `milhar-multiplo-json`): **2 grupos ou mais**
  de milhar não é ambiguidade a resolver, é número corrompido, e **nenhuma coluna deste app tem
  valor plausível acima de 999.999**. A lista é TODA coluna que entra no documento, inclusive as
  duas que o `isMilharAmbiguo` exclui de propósito — `Tempo (h)` (a coluna do defeito) e
  `Taxa Falha (%)`, onde o **clamp de 95 ESCONDE o estrago**.
  **Medido no Excel 16 pt-BR de verdade (COM), com os 6 valores reais da varredura:** formato velho
  → `5.283333333333333` volta `5.283.333.333.333.330`, `printHours` = 5283333333333330 e o aviso
  **acende 6×** citando a célula crua; formato novo → `5,283333333`, **0 avisos**. A truncagem do
  Excel na volta custa **3,3×10⁻¹⁰ h** (1,2 µs), não os 10¹⁵ de antes.
  ⚠ **Para a spec da planilha:** o número vai com **vírgula decimal**. Dentro dos JSONs continua
  ponto (é o decimal do JSON — vírgula quebraria o `JSON.parse`), e `Arredondamento = 0.90` é
  **nome de modo**, não número.
  ⚠ O CSV do `/vendas` foi conferido junto e **não tem o defeito**: escreve tudo por `formatDecimal`.

- ✅ **[D8] FEITO — o export não depende mais da ordem de chave do banco (fecha o `[CSV-30]`).**
  `Acessorios JSON` e `Subitens JSON` eram dumpadas **cruas** do documento, e o Firestore não
  preserva ordem de chave em mapa: duas exportações do mesmo banco, sem nada mudar, davam arquivos
  diferentes — **24 células** (18 + 5), **0 com dado diferente**. Agora são remontadas campo a campo
  na ordem que a importação produz, como as etapas já eram.
  ⚠ **Consequência declarada:** o `id` do acessório **não é exportado**, porque o `parseAccessories`
  não o lê de volta — dumpar cru escrevia um id que o round-trip descartava calado.
  ⚠ O `productCsvRoundTrip` não pegava isto: lá a origem é o **parser** (ordem fixa), não o banco.

### ✅ FECHADOS no lote 2 (2026-08-25)

- ✅ **[D2] FEITO — a espera tem prazo, e o botão para de mentir.** Duas metades, porque o defeito
  também era duplo:
  · **o prazo** — `withWriteTimeout` (`src/lib/errors.ts`), **12s** (45s na importação em lote).
  A decisão do "só o salvar ou os 15 caminhos" foi pelos **15**: o timeout mora na **borda do
  repositório**, e as **21** escritas exportadas passam por ele (`addDoc`/`setDoc`/`deleteDoc`/
  `runTransaction`/`batch.commit`). Deixar 14 fora seria o mesmo defeito com outro botão, e na UI
  seriam 15 diffs em vez de 12 linhas.
  ⚠ **A frase é diferente da do `guardOnline` de propósito.** O guarda barra ANTES do `await` e por
  isso pode prometer "nada foi salvo ainda"; o timeout **não pode** — ele desiste da espera, mas a
  escrita **continua enfileirada** no SDK e pode entrar sozinha (foi o modo 2 da varredura: 97 → 98,
  atrasado). Então ela manda **conferir**, não repetir. Um teste trava essa diferença.
  · **o botão** — a calculadora era a única tela que gravava sem estado de "salvando". Agora um
  `saving` só apaga as **4** ações que gravam o mesmo produto (Salvar · Vender · Produzir · Orçar),
  e o `saveAsNewProduct` — a única gravação da tela **sem `try/catch`** — ganhou o dele. **O
  formulário não é mais limpo quando a gravação falha.**
  **Medido ao vivo** (rede pendurada na página, `navigator.onLine` = `true`, ou seja o modo 1):
  t=2,0s o botão vira **"Salvando…" + desabilitado** (os 2 cliques seguintes não fazem nada) e
  t=14,2s (12,2s depois) sai a frase do timeout, com o **nome ainda no campo**. Online, o mesmo
  caminho: "Salvando…" → "✓ Salvo!" em ~350 ms; catálogo **99 → 100**.

- ✅ **[D3] FEITO — o 15º caminho ganhou a guarda.** `guardOnline()` no `useProducts.deleteProduct`,
  e não no `ProductCatalog`: vale para qualquer chamador, e o catálogo já mostrava o erro no `fail`.
  **Medido ao vivo** (com `navigator.onLine` forçado a `false`): a exclusão é **recusada**, o
  catálogo continua em **99** e a mensagem sai por extenso ("Não foi possível excluir "…": Sem
  conexão com a internet…"). Com a rede de volta, excluir funciona: **100 → 99**.
  ⚠ A ressalva de honestidade da varredura vale ao contrário agora: o que se mediu foi a guarda
  **funcionando**; o comportamento do `deleteDoc` no código velho continua não reproduzido ao vivo.

### ✅ FECHADOS no lote 3 (2026-08-25)

> ✅ **A prova ao vivo saiu no lote 4** (mesmo dia, sessão seguinte — o painel do navegador voltou a
> navegar). As medições que faltavam estão abaixo, e **duas afirmações do lote 3 não bateram**: o
> `[D4]` **não** volta a ser uma linha no desktop, e os "241px de texto" eram medida de FONTE, não
> de `<select>` (a caixa nativa cobra a seta por cima). As duas viraram correção no comentário do
> `cesta-recibo.css` — e entram na conta como a 8ª e a 9ª afirmação falsa da varredura.

- ✅ **[D4] FEITO — a fileira vira CARTÃO, e sem media query.** O defeito era o padrão nº 8 na forma
  flex: `flex: 1 1 0%` com `min-width: auto` contra um vizinho rígido (o `CostDetail`, 242–250px),
  em 259px de linha — 22 + 8 + 250 = 280, e o select ficava com **22,0px** para 241px de texto.
  A saída é a regra da casa (UX-38/UX-40), mas escrita **sem `@media`**: `flex-wrap: wrap` no
  `.cesta-origem` e `flex: 1 1 260px; min-width: 0` no select. **O gatilho certo aqui não é a
  largura da TELA, é a do MODAL** — e a base de 260px (os 241 do texto mais folga) faz a quebra
  acontecer exatamente onde o texto começaria a ser cortado, em vez de num número escolhido a dedo.
  ⚠ O `min-width: 0` é obrigatório e vem junto: sem ele o mínimo implícito do flex é o min-content,
  o `<select>` não encolhe, e a base de 260 viraria piso de 241 — a mesma armadilha da coluna `1fr`
  pura nas grades.
  **✅ MEDIDO ao vivo (375×812)**: a fileira quebrou, o select ficou com a **linha inteira — 259px**
  (contra os **22,0px** de antes) e o `CostDetail` desceu para a linha de baixo. O texto que ele
  mostra passou de **9% para 95%**.
  ⚠ **Duas correções do que o lote 3 escreveu**, as duas medidas:
  · **no desktop ela também é cartão** — o `.sale-modal` tem `max-width: 560px`, ou seja 469px de
    linha, e uma linha só pediria **502** (244 do texto + 8 de gap + 250 do custo). A fileira quebra
    em TODA largura, e a alternativa seria voltar a espremer o select. O desenho está certo; a frase
    "volta a ser uma linha no desktop" é que estava otimista.
  · **os 241px eram medida de FONTE** — a caixa nativa cobra a seta por cima: "Estoque de acabados
    (2 disp.)" pede **273px** e "Sob encomenda (produz agora)" **283**, contra os 259 da linha. Então
    sobra **5 a 9% cortado**, não zero — e isso cai na ressalva já registrada dos `<select>` que
    cortam sem reticências, que é decisão do dono.

- ✅ **[D5] FEITO — a ordem parcial passou a se declarar, e dá pra completá-la.** Não dá para
  empurrar o ranking ao servidor: a receita do recibo é a **soma dos itens** dele, agrupada no
  cliente, e o Firestore não ordena por agregado. Então a tela ficou honesta em duas metades:
  · **o aviso** — `partialRanking = hasMore && sortMode !== "recent"` acende uma faixa `--warn`
  ("Esta ordem vale só para os N recibos já carregados"). **"Mais recentes" é a única isenta**, e
  por um motivo, não por gentileza: é a ordem da própria consulta (`saleDate desc`), então os 25
  carregados **são** os 25 do topo. Todas as outras — inclusive **"Mais antigas"**, que o achado não
  citava — reordenam a janela e chamam o resultado de ranking do histórico.
  · **a saída** — `loadAll()` no `useSalesPage` mira o `totals.count` (a aggregation query conta
  DOCUMENTOS, a mesma unidade do `limit`, porque cada item de venda é um doc), com piso de uma
  página a mais. Se o count vier atrasado ou curto, o `hasMore` — que é medido no servidor
  (`docs.length > pageLimit`) — mantém o aviso na tela e outro clique avança. O aviso **não some
  por conta própria**.
  ⚠ Com filtro de PRODUTO o `hasMore` é sempre `false` (a consulta traz o conjunto inteiro), então
  ali não há o que avisar — e é o desenho, não um furo.
  **✅ MEDIDO ao vivo**: com a janela de 25 documentos = **23 recibos**, "Receita (maior)" acende a
  faixa `--warn` por extenso — *"Esta ordem vale só para os 23 recibos já carregados — há mais
  vendas no histórico"* + "Carregar tudo e reordenar". Um clique: **41 recibos**, faixa some, e o
  topo passa de `386,41 · 294,36 · 88,00 · 87,59` para `386,41 · 294,36 · 159,34 · 105,30` — os dois
  recibos que a janela escondia (159,34 e 105,30) sobem para o lugar que era deles.

- ✅ **[D6] FEITO — "não tem" deixou de ser a mesma coisa que "tem, e eu não consigo ler".**
  `readFinishedColors` (em `finishedGoods.ts`, ao lado do par `colorEntriesOf`/`colorRecordOf`, e
  coberta por 4 testes) devolve `{ entries, malformed }`. Campo ausente e lista vazia → `malformed:
  false` (a venda de encomenda, a venda pré-FEAT-11: não há nada a lamentar); **mapa** ou lista cujos
  itens não sobrevivem → `malformed: true`.
  · **Sem migração, de propósito** (Diretriz 7): a forma de mapa nem consegue representar a peça
  INTEIRA — o Firestore recusa `__whole__` como nome de campo, que é a razão de a lista existir.
  Aceitá-la seria ressuscitar um formato que o app não sabe escrever.
  · **O que mudou de verdade é o `finishedColorLabel`**: ele deixou de sobreviver sozinho. Era outro
  campo, era lido e exibido, e com a lista descartada a tela dizia "Cor vendida: Azul" enquanto o
  estorno não tinha prateleira de onde devolver. Rótulo sem lista agora **não aparece** — a ausência
  é a informação honesta. Some junto um `console.warn` (fora de produção) com o id do recibo.
  ⚠ A lição é do leitor, não do documento: os 2 docs concretos morrem no recadastro.
  ⚠ **Sem prova ao vivo, e de propósito:** produzir o sintoma exigiria gravar à mão um documento no
  formato ANTIGO no banco de produção. Os 4 testes de unidade cobrem os quatro casos (ausente ·
  vazio · mapa · lista podre) e o `finishedColorLabel` cai junto no teste.

### ✅ FECHADOS no lote 4 (2026-08-25) — o último

- ✅ **[D7] FEITO — o código morto SAIU, e os comentários que mentiam foram refeitos.**
  · **`saveRecibo` (salesRepository) apagado** — 0 chamadores, nem em teste. Sozinho ele era uma
  armadilha esperando quem o reencontrasse: escrevia `batch.set(ref, payload)` **cru**, sem passar
  pelo `saleToDocument` (o passo 8 sairia sem origem/moves/ids) e sem o `lerEConferirRevs`.
  · **`removeSale` + `useSales.deleteSale` apagados junto** — a cadeia inteira era morta (nenhum
  componente destruturava o `deleteSale`), e ela apagava a venda **sem estornar** filamento, insumo
  nem acabado. Quem exclui recibo é o `reconcileRecibo`, que ajusta as 4 coleções na mesma
  transação. Mesma decisão do TD-030 no `finishedGoodsRepository`: o morto sai em vez de esperar um
  botão que o ressuscite. No lugar dos dois ficou o registro do **porquê não voltam**.
  · **`serializeSkus` deixou de ser exportada** — o comentário dizia que a exportação existia "para
  a baixa da produção reusar esta serialização". Medido: **0 importadores fora do arquivo**, nem em
  teste. Quem os dois repositórios de escrita importam é o `finishedGoodToDocument`, que já a
  embrulha. API pública que ninguém usa é convite a divergir da escrita normal — justo o que o
  comentário dizia evitar.
  · **as 4 outras afirmações falsas em comentário:** o `finishedEventReferences` dizia, no presente,
  que o estorno "não acha o id e devolve o doc intacto, calado" — isso é o código de ANTES do
  TD-028; hoje o `shiftLayers` **lança erro** · o `quoteConfigRepository` dizia que a numeração é
  "derivada do histórico, então zera sozinha quando o histórico esvazia" — hoje é **reservada no
  servidor** (`config/orcamentoSeq`), **monotônica**, e o histórico entra só como piso · o
  `ReciboWrite` dizia "num ÚNICO `writeBatch`" e é `runTransaction` desde o TD-022 · o rabicho do
  TD-030 dizia "os serializadores, que os dois repositórios importam" — é **um** serializador.
  · ⚠ **E o `writeBatch` era um bando, não um caso:** grep no fonte achou o nome em **15 comentários**
  de 10 arquivos descrevendo escritas que viraram `runTransaction` no TD-022 — quem lesse e fosse
  procurar o `writeBatch` não acharia nada. Todos passaram a dizer "transação". Ficaram de fora, de
  propósito, os três que estão CERTOS: o `createProductsBatch` (que usa `writeBatch` de verdade), o
  `revGuard` (que descreve a semântica dele) e a própria nota do TD-022. Os 2 do `CLAUDE.md` foram
  junto.

- ✅ **[D9] FEITO — o campo passou a dizer qual dos dois preços ele é.**
  `ProductionFilament` é tipo próprio do evento (a `FilamentUsage` sem o `id` de formulário), e o
  preço lá se chama **`catalogPricePerKg`**. O gêmeo do insumo veio junto — `SupplyUsage.unitPrice`
  → **`catalogUnitPrice`** — porque tinha o mesmo defeito e o mesmo comentário mentiroso ("resolvido
  no momento, FIFO real ou congelado"). O custo que a impressão pagou continua onde sempre esteve: o
  `frozenBreakdown.material`.
  **3 testes travam o cenário medido** (`productionPlan.test.ts`): rolo velho a R$ 110/kg + rolo novo
  a R$ 85/kg, 40 g → a linha do evento grava **85** (catálogo) e o `frozenBreakdown.material` **4,40**
  (FIFO), **R$ 1,00 de divergência no mesmo documento**, exatamente como em
  `producao/32Fa5M0jFy2wvCe7dDod`. Um terceiro fixa que no modo `historico` os dois coincidem (não há
  rolo a consumir). O `pricePerKg` e o `id` **não sobrevivem** à travessia — é o que o teste afirma,
  campo a campo.
  ⚠ **Sem migração (Diretriz 7), mas a LEITURA é tolerante**: doc anterior aceita `pricePerKg` /
  `unitPrice` como o que eles sempre foram (preço de cadastro). Escrever, só com o nome novo.
  ⚠ A tela do `/producao` passou a dizer **"R$ 85,00/kg no cadastro"** na etiqueta de cor — o número
  sozinho era metade da informação.

- ✅ **ALVOS DE TOQUE — a régua voltou a valer nos dois eixos, nas 7 rotas.**
  A ressalva herdada falava em "1–4px"; a faixa real ia de **2 a 24px**, e o método mudou: em vez de
  conferir uma lista, **varri o DOM inteiro de cada rota** (`button, a, input, select, summary,
  [role=button], textarea`) atrás de qualquer caixa abaixo da régua — 44px a 375×812, 32px a 1280.
  Isso achou **alvos que a varredura não tinha listado**.
  · **canto do cabeçalho, 40×40** (☰ + tema + sair, nas 7 rotas): 44×44, e a reserva do `.header`
  acompanhou (144 → 156px, a mesma folga de antes). O `.header-utils` era o caso mais traiçoeiro —
  **40 de largura por 44 de altura**, porque a altura vinha do `min-height` do `responsive.css` e a
  largura continuava presa no `width: 40px` do `header.css`.
  · **`.back-to-top` 42×42** — os 2px que ele economizava no celular não devolviam espaço a ninguém
  (é `position: fixed`). O override saiu; quem afasta do canto é o `right`/`bottom`, e esses ficam.
  · **`.skip-link` 162,6×32** (só no foco) · **`.collapse-head` 311×41** · **`.stock-hex-input`
  285×37** · **`.icon-button.edit` 38,6×44 no `/vendas`, ×23** — este não era tamanho, era **FLEX**:
  o botão é item de uma fileira e o padrão é `flex-shrink: 1`, então quando o nome do cliente
  apertava a linha, o único item de largura fixa era justamente quem cedia.
  · **os que a varredura não listou:** `.cost-detail-trigger` 106,7×32 (aba Produtos do `/estoque`)
  · `.details-links a` **119×16** — link para site EXTERNO, o pior do app · e no DESKTOP o
  `.brand-reset` 111×20 (o botão que LIMPA o formulário) e o `.result-advanced > summary` 313×27,
  além do `.roi-warn > summary` **1047×18** que a varredura já tinha achado.
  ⚠ **Duas armadilhas medidas, e as duas viraram comentário no código:**
  · **ORDEM de @import vence media query** — o `.stock-hex-input` (`stock.css`, 15º) e o
  `.cost-detail-trigger`/`.icon-button` do recibo (`cesta-recibo.css`, 12º) **ignoraram** o override
  escrito no `responsive.css` (8º). Media query não soma especificidade. As regras foram para o dono
  legítimo de cada um — a lição do TD-013, medida de novo.
  · **margem negativa COLAPSA através do pai** — no `.roi-warn` a devolução de −7px não devolvia
  nada (caixa 18 → **25px**), porque o bloco não tem borda nem recuo no eixo vertical. `display:
  flow-root` no pai conserta: caixa de volta aos 18px, alvo em 32.
  ⚠ **A exceção que FICA:** as setinhas do stepper (28×20/21). É a decisão do UX-51 — o alvo de
  verdade é o campo, e ele agora É de 44px.
  ⚠ **Onde o alvo cresce SEM devolução, e por quê:** `.details-links a`. A fileira tem `flex-wrap`
  com `gap` de 8px, e devolver a diferença faria duas linhas de link se sobreporem — dois alvos de
  44px a 24px de distância é pior que o alvo pequeno. O painel de detalhes cresce, e é o preço certo.
  **Medição final, com recarga antes de cada leitura:** 375×812 → **0 alvos abaixo de 44** nas 7
  rotas (fora a exceção); 1280×800 → **0 abaixo de 32**. Nenhuma rota ganhou rolagem lateral
  (`scrollWidth` = 375 em todas).

### ⚠️ Ressalvas da AUD-14 (não são itens; viram item se o dono mandar)

- ✅ **A régua de 44px** — era ressalva, **virou item e fechou no lote 4** (acima). Fica o registro
  do diagnóstico: a afirmação do `CLAUDE.md` de que a régua já valia era minha e estava errada, e a
  ressalva herdada falava em "1–4px" quando a faixa real ia de **2 a 24px**.
- **Nome acessível por `title`, não por `aria-label`** — nos 48 botões só-ícone do `/vendas` e nos 5
  do `/catalogo`, `aria-label` é `null`. Satisfaz a WCAG (o `title` é fonte válida de nome), mas
  contraria a regra escrita do projeto e **não aparece no toque**. A AUD-13 afirmou "com
  `aria-label`" no catálogo: **não bate**.
- **Os `<select>` cortam texto sem reticências** — no `/` a 375px o seletor de cor tem 135px úteis
  para 186px de texto (51px cortados, `text-overflow: clip`). Importa porque o dono vai cadastrar
  **muitas cores**.
  ⚠ **A ressalva ficou maior no lote 4:** o `.cesta-origem` do modal de venda cai no mesmo caso
  MESMO depois do `[D4]` — "Estoque de acabados (2 disp.)" pede 273px e "Sob encomenda (produz
  agora)" 283, contra 259 de linha a 375px (5 a 9% cortado). E a caixa nativa **cobra a seta por
  cima do texto**, o que faz toda medição feita só com a largura da FONTE subestimar o que o
  `<select>` precisa. Quem for mexer nisso mede com um `<select>` clone em `width: max-content`, não
  com `measureText`.
- **Lixo que o recadastro leva embora** (registrado só para não voltar como achado novo): 18 dos 97
  produtos carregam um campo `id` **dentro** do documento, e um deles aponta para **outro produto**
  (resíduo do "salvar como novo") · 65 dos 97 ainda têm `markupOnFixed`, morto desde a DEC-01 · **4**
  docs de `acabados` órfãos com saldo 0 (a AUD-13 disse 2; eram 3, e o 4º é da própria AUD-14) · um
  acabado com saldo **−1** (`teste 3 avisos etapa 8`, −R$ 13,07) · dois contadores de orçamento
  (`config/orcamentoSeq.last = 21`, o vivo, e `config/orcamento.lastNumber = 2`, lixo).
  ⚠ **A mecânica que sobrevive ao recadastro:** `saveProduct` usa `tx.update`, que faz **merge** —
  campo que o `buildProductPayload` deixe de gravar fica no documento **para sempre**.
- **`roundPrice("0.90")` devolve 48,899999999999998579** em vez de 48,90 exato — ruído de ponto
  flutuante abaixo do centavo, mas é assim que vai para o `suggestedPrice`.
- **Reconferidas e idênticas:** o **overdraft de −370 g na Bege** (saldo 243 g = −370 do rolo de
  18/07 + 613 do de 10/08; furo de contagem física, o D4 preserva de propósito) · o **`[A11Y-02]`**
  continua **falso positivo**, agora confirmado no fonte · o **`[TD-021]`** segue ressalva do dono.

### O que a AUD-14 NÃO cobriu

- **Dos 7 buracos herdados, 4 fecharam** (offline real → virou o `[D2]` · duas abas com o guarda
  `rev` → passou · forma dos documentos no Firestore → virou o `[D6]` e três ressalvas · `/maquinas`
  além da leitura → watts editados, 60 produtos recalculados, tudo restaurado). **Seguem abertos:**
  **escala acima de 500 produtos** (o dono não autorizou as 1.040 escritas; o corte de 500 do
  `createProductsBatch`, onde o lote pode entrar pela metade, segue **sem prova**) · **regras de
  segurança do Firestore** (5ª varredura seguida, exige 2ª conta Google) · **Google Sheets** (o
  Excel fechou; o Sheets exigiria login e envio de arquivo).
- Importação/exportação de **vendas** (o botão "Exportar CSV" do `/vendas` existe e não foi
  exercitado) · navegadores fora do Chromium embutido e **iOS Safari real** · o **modal de máquinas
  nas larguras de celular** · a exclusão de produto **offline ao vivo** · **screenshots** (o painel
  não estava compondo quadros; toda medição visual saiu do DOM).
- ⚠ **Armadilha nova, para a próxima varredura:** a regra do projeto sobre `transition` na leitura
  de cor tem forma pior que a documentada — **quando o painel não está compondo quadros, a transição
  não avança nunca**, e esperar não resolve. Só `transition: none` antes de ler devolve o valor
  real. Custou um falso positivo (147 falsas falhas de contraste em 7 rotas).

## Ordem de prioridade — ondas (dono, 2026-08-16)

> **O que mudou nesta data:** a fila antiga tinha 14 linhas, **11 riscadas**, e o único bloco vivo
> (o cluster da auditoria de 2026-08-16, com 20 itens) estava marcado *"sem ordem interna"* — ou
> seja, o backlog **não ordenava nada do que sobrou**. As ondas abaixo são o martelo do dono sobre
> os 21 itens abertos de código.
>
> **O critério que decidiu a ordem — prazo externo, e ele corta pros DOIS lados:**
> - **[TD-014] feito ANTES da marca ECONOMIZA** — com a cor tokenizada, o rebrand vira troca de
>   paleta; sem ela, são 14 edições à mão em literais que fixam o RGB do laranja. → **sobe**.
>   ✅ **Feito (onda 2)** — a tinta agora mora num `-rgb` por cor no `base.css`, e todo o resto
>   deriva dela. O prazo externo **deixou de existir**.
> - **[DEC-05] feito antes da marca CUSTA** — o próprio item registra a ressalva do dono de que
>   vai precisar de ajuste depois. É o simétrico do TD-014. → **desce, sai da fila.**
>
> ⚠ Dentro de cada onda **não há ordem** — são do mesmo tamanho e do mesmo tipo. O que a onda fixa
> é *quando o bloco entra*, não a sequência interna.

> ✅ **Ondas 0, 1, 2 e 3 FECHADAS em 2026-08-16** (mesmo dia) e as **4 e 5 em 2026-08-17**. A 0 eram
> as duas perguntas — respondidas (ver abaixo); a 1 eram os 5 consertos; a 2 era o bloco COR, com o
> **prazo externo da marca já neutralizado** (a cor virou token: o rebrand agora é troca de
> paleta); a 3 era grade e alinhamento; a 4 era sistema (modal, semântica, foco, alvo, estado
> desabilitado) e levou o **[UX-35]** de carona; a 5 era matemática e leitura (barra empilhada,
> ritmo em janela de 90 dias, ressalva em `<details>`). Writeups: `HISTORICO.md`.

| Onda | Itens | Por que aqui |
|---|---|---|
| ~~5 — matemática e leitura~~ | ~~[UX-26] · [TD-016] · [UX-34]~~ | ✅ **Fechada em 2026-08-17.** Era a última da fila. |
| **fora da fila** | **[DEC-05]** (lucide) + **[G2]** | Fazer **junto do rebrand**, não antes — ver o critério acima. |
| **⏸ bloqueadas** | **[FEAT-03]** + **[branding/logo real]** (a marca não existe) · **[Dashboard]** (precisa de ~1-2 meses de venda real) | Sempre por último; nenhuma das duas depende de decisão nossa. |

> ⚠ **Com o cluster da auditoria zerado (2026-08-18), esta tabela é o backlog INTEIRO** — e as três
> linhas dependem de algo de fora: a logo (dono/designer) ou ~1-2 meses de venda real no banco.
>
> ⚠ **Vencido em 2026-08-23:** a **AUD-12** reabriu o backlog de código com 15 itens, e eles **não
> estão nesta tabela** — não passaram pelo martelo do dono. A fila de ondas continua valendo só para
> o que sobrou do rebrand; a ordem dos itens novos é a decisão pendente.

> Diretriz 7 (dados descartáveis, marco futuro) cobre o backlog inteiro → **nenhum item precisa de
> migração**. Não reordenar por causa disso.

## Itens abertos

### ✅ Cluster da auditoria de layout responsivo (2026-08-17) — ZERADO

> Auditoria pedida pelo dono a partir de um print (nome de peça quebrado letra a letra no
> `/estoque`). Medição no DOM nas 7 rotas, em 375px e 1280px, acordeões abertos um a um, mais um
> passe de contraste WCAG nos dois temas — que **passou sem nenhuma falha**.
> **10 achados, 10 fechados:** os 4 bugs de layout na hora (causa raiz única, `1fr` sem
> `minmax(0, …)`) · **[UX-36]** + **[UX-37]** (alvo de toque + peso do destrutivo) · **[UX-39]** sem
> código · e **[UX-38]** + **[UX-40]** + **[A11Y-01]** em **2026-08-18**. Writeups e medições no
> [`HISTORICO.md`](HISTORICO.md).
>
> ℹ️ **Os 2 achados que NÃO viraram item** (registrados pra não voltarem como achado novo): o range
> do markup transborda **2px** do container (folga nativa do thumb); e os `.btn-sm` medem 31–33px —
> abaixo dos 44px, mas isso é anterior à auditoria e já está no writeup do `[micro]` de 14px.

### ✅ Cluster da auditoria de 2026-08-16 (UX-20…UX-34 · TD-014…TD-016) — ZERADO

> A auditoria de UI/UX + cálculo (site rodando, dados reais, 7 rotas + 9 modais, dois temas,
> medição no DOM) rendeu **33 achados → 21 itens**, distribuídos nas ondas 0–5. **Todas fechadas
> entre 2026-08-16 e 2026-08-17** — nenhum item do cluster está aberto.
> O levantamento (A1…I3, com os números medidos) e os writeups vivem no
> [`HISTORICO.md`](HISTORICO.md): seção "🔍 Auditoria de UI/UX + cálculo (2026-08-16)" e as
> seções "✅ Onda N".
>
> O único resíduo é o **[G2]** (os emoji dos rótulos não seguem regra nenhuma) — nunca foi item
> próprio: está anexado à **[DEC-05]**, logo abaixo, que foi pro rebrand.

### Bloqueadas por dado externo

- **[FEAT-03] Melhorar o PDF do orçamento** *(guarda-chuva)*. Ideias-semente (o dono escolhe o que vira
  tarefa): prazo de entrega, foto/thumbnail do item, formas de pagamento/condições, termos/observações,
  QR code do WhatsApp, detalhar etapas/subitens (usa FEAT-01), desconto/acréscimo, branding real.
  **Onde:** `generateQuotePdf.ts` + `QuotePage`/`config/orcamento`. Lista completa em `HISTORICO.md`.
- **[branding/rebrand]** paleta + logo real *(engloba o antigo "[branding/logo real]": trocar o
  placeholder de impressora no PDF, que já tem comentário no código)*. **Bloqueado:** a logo ainda
  não está fechada. **Leva junto a [DEC-05]** (lucide) e a logo do **[FEAT-03]**.
  ✅ **Cores marteladas pelo dono (2026-08-16): amarelo + preto.** Prévia do designer vista — duas
  opções (1: wordmark em caixas de traço fino · 2: abelha + wordmark em pixel art), **ainda não
  escolhida**; um jogo de 5 padrões de preenchimento acompanha as duas.
  **O que a prévia JÁ decide, e não depende da opção escolhida:**
  - O amarelo é **dourado** (~`#F2B705`–`#F5C518` — pedir o hex exato). Em toda essa faixa,
    **branco em cima reprova** (~1,8–2,1) e **preto passa folgado** (~10–11,5). As travas da marca
    nunca usam branco — não é estilo, é o único par que funciona.
  - → **O `--accent-strong` inverte de sentido.** Ele existe como *"o accent escuro o bastante pra
    carregar BRANCO"* (UX-24), e esse branco está **cravado em 5 lugares**: `forms.css:369`
    (`.btn.primary`) · `base.css:404` (`.back-to-top`) · `cesta-recibo.css:152` e `:212` (toggles de
    desconto) · `sections.css:79` (badge 10px).
    → **A troca NÃO é só de paleta:** é a paleta **+ um token novo `--on-accent`** (a tinta que fica
    *em cima* do accent). O TD-014 não o criou porque na época o branco era constante.
  - As duas travas mapeiam **1:1 nos temas**: amarelo-sobre-preto = escuro (~11:1);
    preto-sobre-amarelo = o preenchimento accent no claro. Nada a inventar.
  - **Decisão pendente pra hora do rebrand:** o `--accent-text` no tema **claro** — amarelo como
    texto sobre fundo claro reprova. Ou vira âmbar escuro (~`#8a6a00`, ~5,1 no branco; **medir no
    tingimento 10%**, que come ~0,3), ou o accent-como-texto no claro vira **preto** e o amarelo fica
    só preenchimento/tingimento (mais fiel a "amarelo e preto").
  - **Input pro dono levar ao designer (só aparece porque existe app):** favicon 16/32px, marca de
    ~32px no cabeçalho e cabeçalho do PDF. A **opção 2 é nativa nesses tamanhos** (pixel art já é
    grade; a abelha funciona **sem** a palavra). A **opção 1 não reduz** — traço fino some e não há
    símbolo isolável, exigiria criar um só pro app.
  - **Oportunidade (não é tarefa):** os 5 padrões são preenchimentos de impressão 3D. Hoje as 8
    categorias do `CostBars` se distinguem **só por cor** — falha pra daltônico e em P&B. Padrão +
    cor distingue nos dois. Cruza com o **[UX-26]**.
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

### Decisões já marteladas que ainda são tarefa de CÓDIGO

- **▶ [DEC-05] Lucide em tudo que é CONTROLE** *(decidido pelo dono em 2026-08-15; emoji só como
  decoração deliberada — era o antigo `UX-18`)*. Motivo: emoji não herda `currentColor` (não
  responde ao tema), renderiza diferente em cada SO e desalinha ao lado de um lucide — hoje
  convivem em **9 componentes** (🧮 📚 🧾 📄 🖨️ 📦 🏭 · 🏷️ ⚡ 🔢 🎲 📈 🎯).
  **Leva o [G2] junto:** os emoji dos rótulos **não seguem regra nenhuma** — no MESMO formulário,
  `🏷️ nome da etapa`/`🎨 filamento`/`⏱ tempo`/`⚡ tarifa`/`🔢 peças`/`🎲 taxa` têm, e `nome do
  produto`/`máquina`/`cor`/`filamento (R$/kg)`/`total (g)`/`mão de obra`/`valor-hora` não têm.
  Não é decoração deliberada, é acaso → decidir também o **critério** (ou todo rótulo de seção tem
  ícone, ou nenhum tem).
  ⚠ **Por que está FORA da fila:** o dono registrou que **a marca está chegando** e que a troca vai
  precisar de **um ajuste depois** (overlap com **[branding/logo real]**). É o simétrico do
  [TD-014] — fazer antes da marca **custa** retrabalho. → **fazer junto do rebrand.**
  Detalhe da decisão: `HISTORICO.md`.

## Aberto — resíduo da auditoria FORM-01 (2026-08-20)

> Os dois defeitos do FORM-01 foram corrigidos. Sobrou o que ficou **fora** daquela varredura.

- ~~**[AUD-01] Auditar o estorno/reedição de recibo**~~ — **FEITO na varredura AUD-02
  (2026-08-22)**, e a previsão estava certa: o defeito era mesmo *"função que reconstrói um objeto
  campo a campo e esquece um"* — o `SaleModal` montava o `ReciboWrite` sem `supplyUpdates`. A
  matemática do estorno passou exata nos dois caminhos (`encomenda` e `acabado`, incluindo o
  overdraft D4). Detalhe: [`HISTORICO.md`](HISTORICO.md).

### Sobrou da varredura AUD-02 (2026-08-22) — ✅ TODOS FECHADOS pela AUD-07 (2026-08-22)

- ~~**[AUD-03] Ponta a ponta contra o Firestore**~~ — **FEITO na AUD-07** (com aval do dono para
  gravar): cor + insumo criados, produção real, venda de peça pronta, 3 reedições e exclusão. Tudo
  apagado no fim; banco devolvido ao estado inicial, conferido campo a campo.
- ~~**[AUD-04] Offline de verdade**~~ — **PARCIAL na AUD-07**: exercitado com `navigator.onLine`
  forçado a `false` (calculadora e importação travam com aviso e não gravam). **Continua sem** o
  teste com a rede realmente caída (fila do Firestore, promise pendente, reconexão) → virou
  ressalva do **[AUD-08]**.
- ~~**[AUD-05] Orçamento/PDF**~~ — **FEITO na AUD-07**: PDF gerado de verdade e o texto extraído do
  arquivo. Os números batem com a tela. Rendeu **[TD-017]** e **[UX-43]**.
- ~~**[AUD-06] Taxas + tempo real**~~ — **FEITO na AUD-07**: margem líquida recalculada à mão nas 3
  combinações (3,14% à vista · 6,11% em 3× · repasse com gross-up arredondado) e tempo real
  confirmado em duas abas. Máquina editada recalculando o catálogo **não** foi exercitada (escreve
  no doc compartilhado `config/machines`) → **[AUD-08]**.

## Ordem aprovada pelo dono — 4 lotes (2026-08-22)

> O cluster AUD-07 é o backlog inteiro de código hoje. O dono aprovou esta ordem. O critério: **o
> que sai errado pro cliente primeiro**, depois **o que destrava a carga em massa**, depois o resto.
>
> **A descoberta que reagrupou a lista:** CSV-06, CSV-07, CSV-08 e UX-41 **não são 4 itens** — são o
> MESMO defeito em 4 portas: um número em pt-BR lido por um parser que não fala pt-BR. O app tem
> `formatDecimal` (formata pt-BR pra fora) e **nada** que leia pt-BR pra dentro; cada porta
> improvisou a sua. → uma primitiva `parseDecimalPtBr` em `lib/formatting/`, e as 4 portas a chamam.

| Lote | Itens | Estado |
|---|---|---|
| **0** | **[TD-017]** | ✅ **FEITO (2026-08-22)** |
| **1** | **[CSV-06]** + [CSV-07] + [CSV-08] + **[UX-41]** | ✅ **FEITO (2026-08-22)** |
| **2** | [UX-42] · [TD-018] · [TD-019] | ✅ **FEITO (2026-08-22)** |
| **3** | [UX-43] · [TD-020] | ✅ **FEITO (2026-08-22)** — fecha o cluster AUD-07 |

**[AUD-08] fica FORA dos lotes de propósito:** metade da lista dele (*"escrita de 100 produtos de
verdade"*) é **exercitada de graça pela carga em massa real**. Varrer antes é ensaiar o que vai
acontecer sozinho depois. Reavaliar **depois** da carga.

### Aviso resolve no import, NÃO resolve na digitação — medido (2026-08-22)

> O dono perguntou, com razão, se não bastava avisar quando o dado viesse errado. **No import, sim**
> — é o que o CSV-06 faz: o texto chega inteiro no código, dá pra ver que `"1,5"` é vírgula pt-BR e
> apontar. **Na digitação, não.**
>
> Uma tecla de vírgula de verdade num `<input type="number">` produz:
>
> ```
> keydown      key=","   → chega, e é identificável
> beforeinput  data=","  → dispara
> input                  → NÃO dispara: o Chrome recusa a inserção
> value: "3" → "5" → "35"        a vírgula some e os dígitos colam
> validity.badInput: false       nada denuncia depois
> selectionStart: null           e setRangeText lança InvalidStateError
> ```
>
> O `"35"` é o mesmo mecanismo do `143,53 → 14353` que a auditoria mediu à mão. **O que impede o
> aviso é o `badInput: false`:** o que chega no código é um número VÁLIDO, 100× maior. Não há erro a
> detectar depois do fato.
>
> ⚠ **Correção de um registro anterior deste arquivo.** Numa primeira medição eu afirmei que a tecla
> chegava anônima (`key:""`, `code:""`, sem `beforeinput`) e que interceptar era *impossível*. Estava
> **errado**: aquele evento vazio era a ferramenta de automação não mapeando a tecla `comma` — o
> mesmo evento vazio aparecia num `<input type="text">`, onde a vírgula obviamente funciona. Passando
> o caractere `,` em vez do nome `comma`, o evento chega normal. **Interceptar no `beforeinput` É
> possível.** Não foi o caminho escolhido por três motivos concretos, não por impossibilidade:
> sem `selectionStart` só dá pra acrescentar no fim (editar no meio do número quebra); um campo
> numérico não exibe os estados intermediários `"143,"` nem `"143."`, o que exige um "decimal
> pendente" com aresta em backspace, colagem e seleção; e o celular continuaria sem setinha.
>
> ⚠ **Armadilha de método, que vale pra próxima varredura:** digitação sintética mente de duas
> formas. `type` manda a string inteira num `beforeinput` só (`data:"1,5"`), e `key` com o NOME da
> tecla (`comma`) entrega um evento vazio. Só `key` com o **caractere** reproduz o teclado humano.

### Decisão do dono: setinhas artesanais, não perder o incremento — ✅ FEITO

O dono usa muito as setinhas de incremento, e `type="text"` não as tem. → **`type="text"` +
`inputMode="decimal"` + stepper próprio.** Protótipo medido nas 4 frentes: `143,53` → 143.53 ✓ ·
`27.14` (ponto) → 27.14 ✓ · clicar ▲▲ em `143,53` → `143,55` ✓ · tecla ↓ em `27.14` → `27,13` ✓.
Devolve o valor **em pt-BR**, aceita `step` por campo, e passa a ter setinha **no celular** — que a
nativa nunca renderizou. Os **40 usos não mudam** (`value: number` / `onChange` intactos); muda o
`NumberInput` + CSS do stepper, que precisa respeitar o alvo de 44px (UX-28/UX-37).

## Aberto — cluster da varredura AUD-07 (2026-08-22)

> 2ª varredura ponta a ponta, pedida pelo dono **antes da carga em massa**, com a regra de que a
> passada anterior **não é referência** (nem as correções dela). Método e medições:
> [`HISTORICO.md`](HISTORICO.md). Eram **10 defeitos**, reportados sem correção (a varredura tinha
> regra de só reportar). ✅ **Os 10 foram corrigidos em 2026-08-22**, nos 4 lotes acima — o
> [CSV-06], que bloqueava a carga em massa, incluído.
>
> ⚠ **Dois itens tinham o diagnóstico errado**, e a correção está registrada em cada um: o
> **[CSV-06]** (a coluna escalar não zerava; o `cor-sem-peso` disparava; mas os filamentos nem
> parse tinham) e o **[UX-43]** (o travessão nunca foi comido — era artefato de extração; o
> defeito real é a string inteira virar UTF-16). Vale reler os dois antes de citá-los.

### 🔴 Bloqueante da carga

- ~~**[CSV-06] Vírgula pt-BR DENTRO das células JSON vira 0, em silêncio.**~~ — ✅ **FEITO
  (Lote 1).** Primitiva `parseDecimalPtBr` em `lib/formatting/number.ts` nas 4 portas + classe
  `numero-nao-reconhecido`. A reprodução corrigiu o diagnóstico deste item em 3 pontos, anotados
  abaixo. Descrição original: Fora das colunas
  escalares (que passam pelo `parseNumber`), todo número do JSON é lido com `Number(x) || 0` →
  `Number("1,5")` é `NaN` → **0**. Medido ponta a ponta: linha com `printHours:"1,5"`,
  `pricePerKg:"200,00"`, `unitPrice:"12,50"` e `modelG:"140,0"` importou **sem um único aviso** e
  nasceu a **R$51,58 em vez de R$223,32** (custo 25,78 vs 83,03); o documento gravado ficou com
  `printHours: 0`, `pricePerKg: 0`, `unitPrice: 0`, `totalG: 3.53`.
  **A checagem `cor-sem-peso` da AUD-02 não cobre o pior caso**: ela roda `filamentsTotalG` no array
  **cru** (`productCsv.ts:808-814`), onde `totalG` ainda vale 143,53 — mas `makeFilament`
  (`filaments.ts:41`) recalcula `totalG` como a soma do detalhe, e o `modelG` com vírgula zerou.
  **Onde:** `productCsv.ts:314` (`parseStages`) · `:343` (`parseAccessories`) · `:363`
  (`parseSubitems`) · `:665` (filamentos entram crus).
  ⚠ **O que a reprodução corrigiu neste diagnóstico** (medido antes de consertar):
  · `printHours` **não** zerava na coluna escalar `Tempo (h)` — ela passa pelo `parseNumber`; quem
    zerava era o `printHours` DENTRO do `Etapas JSON`;
  · a checagem `cor-sem-peso` **disparava** no caso relatado (`num("143,53")` já é 0), ao contrário
    do que este item dizia;
  · mas os filamentos eram **piores** que o descrito: não havia parse nenhum, só um
    `as FilamentUsage[]` — a string `"143,53"` viajava até o Firestore num campo tipado `number`.
    O `Acessorios JSON` e o `markup` do `Subitens JSON` eram os silenciosos de verdade.

  **Correção proposta:** um `numFromCsv()` (o `parseNumber` pt-BR) em **todo** campo numérico dos 4
  JSONs (`printHours`, `laborMinutes`, `weightG`, `filamentPricePerKg`, `totalG`, `modelG`,
  `supportG`, `purgedG`, `towerG`, `pricePerKg`, `qty`, `unitPrice`, `markup`) + classe de issue
  `numero-nao-reconhecido` nomeando o campo + rodar `cor-sem-peso` sobre as cores **normalizadas**.

### 🟠 Alto (não bloqueia, mas morde cedo)

- ~~**[TD-017] `/vendas` e `/orcamento` precificam SEM o preço vivo do rolo.**~~ — ✅ **FEITO
  (Lote 0, 2026-08-22).** A `SalesPage` já tinha o `stock` em mãos (linha 201) — faltava só passá-lo;
  a `QuotePage` ganhou o `useStock`. Varri as **11** chamadas de `calculatePricing`: eram as 2 únicas
  sem o argumento, e agora nenhuma está. `lint` ✅ · 483/483 ✅ · `build` ✅.
  `SalesPage.tsx:232` e `QuotePage.tsx:122` chamavam `calculatePricing(product, machines, fixedCosts)`
  — falta o 4º argumento `stock`, que as outras 6 chamadas passam (`CatalogPage:91`,
  `PricingCalculator:128`, `ProductCatalog:171`, `ProductionPage:142`, `SaleFlow:67`,
  `StockPage:236`). Medido: o MESMO produto vale **R$51,58 no catálogo** e **R$18,47** no seletor da
  venda, no orçamento e no PDF. Com o catálogo todo ligado ao Estoque, isso dispara na primeira
  compra de rolo com preço novo. **Correção:** passar `stock` nos dois pontos.
- ~~**[UX-41] O campo numérico engole a vírgula e concatena os dígitos.**~~ — ✅ **FEITO (Lote 1):**
  `type="text"` + `inputMode="decimal"` + stepper artesanal (o dono não quis perder o incremento).
  Medido no app: vírgula ✓ ponto ✓ clique ▲▼ ✓ teclas ↑↓ ✓ · 0 cortes em 18 campos · 375px sem
  rolagem lateral · console limpo. Efeito colateral corrigido: a coluna "Vida (h)" do modal de
  máquinas cortava "7500" em "750" (UX-21) — stepper 18→14px e a grade alargada. Original:
  `NumberInput.tsx:58` (`type="number"`) + `:50` (`Number(raw)`). Medido digitando de verdade:
  **`143,53` → `14353`** (100×), preço R$27,14 → **R$4.896,51**; `R$ 118,90` → `11890`. Com ponto
  funciona. Nada avisa. **Correção:** `type="text"` + `inputMode="decimal"` normalizando a vírgula
  para ponto (a mesma função do CSV), ou no mínimo um `onKeyDown` que faça a troca.

### 🟡 Médio

- ~~**[UX-42] Aviso FALSO de saldo negativo ao editar recibo.**~~ — ✅ **FEITO (Lote 2).** O
  `planReciboReconciliation` passou a **delegar** ao `reconcileReciboWrite` em vez de repetir o
  cálculo: eram duas implementações que PRECISAM concordar, e por isso divergiram. Ele agora aceita
  o mesmo `old`, que no `SaleModal` saiu de dentro do salvar e virou um `useMemo` que o preview
  também lê. Verificado no app, sem gravar: com saldo 3 e venda antiga de 1, **QTD 4 não avisa** e
  **QTD 5 avisa "1 além"** — o limiar e o número certos. Original: O preview usa
  `planReciboReconciliation` (forward puro, `SaleModal.tsx:588`) enquanto a gravação usa
  `reconcileReciboWrite(..., old, ...)` (`:715`) — o preview não credita de volta o que o recibo
  antigo consumiu. Medido: com 1 conjunto em estoque, editar 1→2 avisou *"o saldo fica negativo"* e
  o resultado real foi **0**, sem overdraft. Atinge também `crossesRoll`/`filamentShortfallG` e o
  **custo real exibido** durante a edição (pode divergir do gravado quando o FIFO atravessa rolo).
- ~~**[TD-018] Chave React duplicada no extrato do Estoque.**~~ — ✅ **FEITO (Lote 2):** o índice do
  move entra na chave, e é o índice da lista **COMPLETA** (não da filtrada), senão a chave mudaria
  conforme a cor/insumo que se está olhando. Extrato aberto nas duas abas do `/estoque` com o
  console limpo. Original: `stock.ts:319` e `supplies.ts:237`
  montam a chave com id do evento + id do rolo, o que **não é único** quando um evento tem ≥2 baixas
  do mesmo rolo/lote. Medido: `Encountered two children with the same key` repetido no console do
  `/estoque`. Hoje o extrato ainda soma certo (2000−597=1403 ✓), mas o React pode omitir/duplicar
  linha — no extrato que serve justamente para auditar estoque. **Correção:** juntar o índice do
  move na chave.
- ~~**[TD-019] Os KPIs de `/vendas` não atualizam depois de gravar.**~~ — ✅ **FEITO (Lote 2).** Além
  do que o item descrevia, faltava a causa de o número nunca se corrigir sozinho: **o `onSnapshot`
  não reemite quando só o metadata muda**, então o snapshot de confirmação simplesmente não chegava.
  A assinatura passou a pedir `includeMetadataChanges` e o callback leva `pending`
  (`hasPendingWrites`); a aggregation query só roda com a escrita **já confirmada**, e enquanto isso
  o total anterior fica na tela em vez de piscar um número errado. O caminho de PRODUTO não mudou
  (soma no cliente, e o doc otimista já está lá).
  ⚠ **Verificado por código, `build` e `lint` — NÃO ao vivo:** a prova exige gravar uma venda de
  verdade no Firestore, e isso não estava combinado nesta sessão. Fica como insumo do **[AUD-08]**.
  Original: `useSalesPage.ts:63` dispara
  `fetchSalesTotals` dentro do `onSnapshot`, que chega **antes** do servidor confirmar (latency
  compensation); o snapshot de confirmação é só metadata e não refaz a busca. Medido: registrei a
  venda, a linha apareceu e o topo continuou **47 / R$2.620,70**; após recarregar, **48 /
  R$2.729,60**.

### 🟢 Baixo

- ~~**[UX-43] O PDF do orçamento come o travessão e as aspas curvas.**~~ — ✅ **FEITO (Lote 3), mas
  o DIAGNÓSTICO DESTE ITEM ESTAVA ERRADO.** O travessão nunca foi comido: o jsPDF declara
  `/Encoding /WinAnsiEncoding` e grava `—` no byte **0x97**, que nessa tabela É o travessão. Quem
  extrai o texto lendo o stream como Latin-1 (onde 0x97 é um controle invisível) vê o caractere
  "sumir" — foi artefato de extração da varredura. O mesmo vale para as aspas curvas, `…`, `•`, `€`
  e `·`: todos têm byte e sempre renderizaram certo.

  **O defeito real está ao lado e é MAIOR.** Um único caractere SEM byte no cp1252 não se perde
  sozinho: o jsPDF reescreve a **string inteira** em UTF-16BE e deixa a fonte declarada WinAnsi.
  Medido no bloco de texto do arquivo:

  ```
  "A—B"  (travessão, tem byte) → (A<97>B) Tj             1 byte por char, ok
  "A‐B"  (U+2010, sem byte)    → (<00>A <10><00>B) Tj     UTF-16BE
  "A🐱B" (emoji, sem byte)     → (<00>A<d8>=<dc>1<00>B)   UTF-16BE
  ```

  Como o leitor lê byte a byte pela tabela WinAnsi, **a linha toda vira lixo** — um nome de produto
  com emoji levaria junto o nome inteiro. O saneador é cirúrgico por isso: preserva tudo que tem
  byte (mantém a linha no caminho de 1 byte) e troca só o que não tem. Rebaixar o travessão para
  hífen, como a "correção proposta" original pedia, pioraria um PDF que já estava certo.

  ⚠ **Lição de método, para a próxima varredura:** extrair texto de PDF só vale como medição se a
  extração respeitar o `/Encoding` do arquivo. Descrição original: Medido no PDF real:
  `"ZZ AUDIT Produto  Corpo · PLA azul"` (o travessão sumiu; o `·` sobrevive) e o rodapé
  `"7 dias  até 29/08/2026"`. Como o app monta o nome do subitem com travessão e usa `option.name`
  como descrição (`QuotePage.tsx:174`), **todo orçamento de subitem sai sem o separador**.
  **Correção:** sanitizar os caracteres fora do WinAnsi antes de escrever, ou embutir fonte Unicode.
- ~~**[CSV-07] A checagem "milhar ambíguo" erra dos dois lados.**~~ — ✅ **FEITO (Lote 1).** O falso
  negativo saiu testando no texto limpo. O falso positivo NÃO tem conserto estrutural ("2.375" e
  "1.234" são idênticos): quem decide é a coluna — `Tempo (h)` e `Tarifa Energia` saíram da
  checagem, porque nelas a leitura de milhar é absurda. Original: `productCsv.ts:197` testa o regex no
  texto **bruto**: `"R$ 1.234"` vira 1,234 e **não avisa** (o prefixo quebra o regex); e
  `Tempo (h) = 2.375` — valor que o **próprio export escreve** — **acende** o aviso (falso positivo
  no round-trip). **Correção:** testar depois da limpeza de moeda/espaço.
- ~~**[CSV-08] Formato EN e milhar com 2 pontos passam mudos.**~~ — ✅ **FEITO (Lote 1):** com os
  dois separadores, o ÚLTIMO é o decimal; separador repetido é milhar. Original: `parseNumber` (`productCsv.ts:175`):
  `"1,234.56"` → **1.23456** (1000× menor) e `"1.234.567"` → **1.234**. Relevante se a planilha for
  gerada no Google Sheets em locale en-US.
- ~~**[TD-020] Máquinas e taxas gravam sem `guardOnline`.**~~ — ✅ **FEITO (Lote 3).** `saveMachines`
  virou `async` e devolve a **mensagem de erro** (ou `null`): o `MachineManagerModal` mostra e **não
  fecha**, em vez de fechar por cima de um save que não aconteceu. `saveFees` é chamada a cada tecla
  e sem `await`, então lançar viraria unhandled rejection por dígito — ela expõe um `error` que o
  editor de taxas renderiza. Nos dois casos o `guardOnline` vem ANTES do `await`, porque offline a
  Promise do Firestore não resolve nem rejeita. Original: `useMachines.ts:87`
  (`void persistMachines(...)`, fire-and-forget, sem tratar erro) e `useFees.saveFees`. Offline a UI
  mostra o valor novo (estado local + localStorage) e a escrita fica enfileirada — "finge que
  salvou". **Verificado só no código** (escrever em `config/machines` estava fora do combinado).

### Observação registrada (não é defeito — decisão do dono)

- A produção com desfecho **falha** também dá baixa do insumo (medido: 4 unidades). Se o ímã só é
  montado depois da impressão boa, a falha não deveria consumi-lo. A tela declara isso antes de
  registrar, então é escolha, não silêncio.

### O que a AUD-07 NÃO cobriu

- **[AUD-08] Insumo da próxima varredura.** ~~Escrita de 100 produtos de verdade~~ (✅ **coberto
  pela AUD-09, 2026-08-23**: 100 gravados de fato, atomicidade confirmada, banco restaurado); **edição de máquina** recalculando o
  catálogo (escreve no doc compartilhado); **offline real** (só simulei `navigator.onLine`);
  ~~round-trip do form via CSV **não cobre** `createdAt` nem os 3 nulos legados~~ (✅ **coberto pela
  AUD-09** — viraram [CSV-15] e [CSV-20]); só **um**
  produto-cobaia (faltou produto sem subitens vendendo acabado, multicolor com cor por etapa —
  SKU composta — e `piecesCount` > 2); importação/exportação de **vendas**, filtros e paginação do
  histórico, `/maquinas` além da leitura, tema claro; **concorrência** (duas abas gravando o mesmo
  recibo); e o **saldo negativo pré-existente** no banco (contador "SALDO NEGATIVO 1"), cuja origem
  não investiguei.

## Aberto — cluster da varredura AUD-09 (2026-08-23) — IMPORTAÇÃO/EXPORTAÇÃO DE CSV

> 3ª varredura, pedida pelo dono **imediatamente antes da carga em massa** e restrita a
> `productCsv.ts` + o fluxo de import do `ProductCatalog.tsx`. Mesma regra das anteriores: o que
> está marcado como corrigido **não é referência**, e diagnóstico registrado também não — cada
> item abaixo foi **reproduzido** antes de virar achado. Reportado sem correção (o dono decide os
> lotes).
>
> **Método:** harness local em vitest sobre as funções puras (≈120 casos) + **escrita real no
> Firestore de produção**, com aval do dono: backup dos 97 produtos em disco, round-trip do
> catálogo real (97 cópias), carga de 100 produtos escritos à mão, teste de atomicidade, e
> **limpeza verificada** no fim — 198 documentos criados e apagados, banco de volta a **97/97
> idênticos por conteúdo e mesmos ids**. Cores (2) e insumos (2) intactos.
> `lint` ✅ · **523/523 em 5 execuções** ✅.
>
> ⚠ **Armadilha de método que eu mesmo pisei e vale registrar:** o helper de dump escrevia
> `{ id: doc.id, ...doc.data() }` — o spread sobrescreve o id do caminho quando o documento tem um
> campo `id`, e isso **mascarou um produto legítimo** na lista de "originais". Se eu tivesse
> limpado por aquela lista, teria apagado um produto real. Dump de Firestore põe o id do caminho
> **por último** e com nome que não colide (`__id`). Foi também o que revelou o [CSV-18].

## Ordem aprovada pelo dono — AUD-09 (2026-08-23)

> O dono aprovou **A + B** antes da carga. O **C** (tabela de-para cor → id + planilha-modelo)
> fica pendente até ele **cadastrar as cores e os insumos definitivos** — hoje o banco só tem os
> 2 de teste, e a de-para nasceria com id que vai ser jogado fora.

| Lote | Itens | Estado |
|---|---|---|
| **A** | [CSV-09] + [CSV-10] + [CSV-11] — os 3 bloqueantes | ✅ **FEITO (2026-08-23)** |
| **B** | [CSV-12] · [CSV-13] · [CSV-14] · [CSV-15] | ✅ **FEITO (2026-08-23)** |
| **C** | ~~tabela de-para (cor → id) + planilha-modelo~~ | ❌ **CANCELADO** — vira spec escrita no chat, sem botão (ver acima) |
| **D** | [CSV-16] + [CSV-21] + [CSV-22] | ✅ **FEITO (2026-08-23)** |

**Fora dos lotes:** só o [CSV-17] (o arredondamento pede o token e **avisa** quando não recebe) —
entra na spec da planilha. [CSV-18], [CSV-19] e [CSV-20] são resíduo legado que o round-trip limpa.

> **O [CSV-16] mudou de lado.** Estava classificado como "doc, não código" com o argumento de que *o
> parser não tem como saber que 'Tempo (min)' é minuto*. **O argumento é falso: o cabeçalho DIZ a
> unidade.** O que faltava era ler. Reclassificado e fechado no lote D — e o dono apontou o motivo
> de valer o esforço: o formulário já aceita horas **e** minutos (`PrintTimeField`), e o sistema que
> vai gerar a planilha tira o tempo da impressão, que reporta em minutos.

### 🔴 Bloqueia a carga

- ✅ **[CSV-09] FEITO (Lote A).** Coluna escalar PRESENTE e vazia (ou ilegível) virava 0 — sem um
  único aviso. Helper `cellNumber` em `productCsv.ts`: **coluna ausente e célula vazia caem no MESMO
  default**, e a célula escrita que não dá pra ler fica no default + acende a classe nova
  `coluna-numero-nao-reconhecido`, nomeando a coluna. Vale nas 7 escalares (a 8ª, `Markup`, já
  tinha checagem própria). **Efeito colateral bom: a "regra de ouro" morreu** — pôr a coluna e
  deixar em branco agora é seguro. Descrição original:
  **Mecanismo:** o default só vale quando a coluna está **AUSENTE** (`indexX >= 0 ? parseNumber(...)
  : DEFAULT`). Presente, passa pelo `parseNumber`, que é `parseDecimalPtBr(value) ?? 0` — o wrapper
  leniente. O comentário dele diz "use nas colunas cujo vazio JÁ significa zero", mas em
  `Tarifa Energia`, `Valor-hora`, `Mao de obra (min)` e `Taxa Falha` o vazio **não** significa zero:
  significa o default 0,8 / 30 / 15 / 3.
  **Medido** (mesma linha, única diferença = as 4 colunas presentes e em branco):
  custo **R$ 15,19 → R$ 7,08** · preço **R$ 30,10 → R$ 21,24**. `warnings: []`, `issues: [cor-avulsa]`.
  **Medido por coluna** (valor `"abc"`, referência preço R$ 27,52):
  `Peso (g)` → **10,51** · `Filamento (R$/kg)` → **10,51** · `Mao de obra (min)` e `Valor-hora` →
  **22,37** · `Tempo (h)` → **22,16** · `Tarifa Energia` → **27,05** · `Taxa Falha (%)` → **26,70**.
  **Das 8, só `Markup` avisa** (`markup-invalido`). As outras 7 são mudas.
  **Por que bloqueia:** a carga é uma planilha escrita à mão. Célula em branco é o erro mais
  provável que existe — e é justamente o único sem sinal. É o mesmo defeito que o [CSV-06] fechou
  **dentro** dos JSONs, sobrevivendo **fora** deles.

- ✅ **[CSV-10] FEITO (Lote A).** A 2ª passada do `resolveColumns` roda **do needle mais LONGO para
  o mais curto** (era a ordem de declaração), e `filaments` passou a ter needle `"filamentos"`.
  Comprimento é o desempate certo: needle mais longo é o mais específico, e o par
  `filamentos`/`filamento` se resolve sozinho em qualquer ordem de cabeçalho. Descrição original:
  **Cabeçalho `Filamentos` (sem a palavra "JSON") é capturado pela coluna de PREÇO — e a
  lista de cores inteira vira um número absurdo, calada.**
  **Mecanismo:** `resolveColumns` faz 2 passadas. O `claimed` do CSV-02 só protege quando **uma
  das duas** casou por nome EXATO. Quando nenhuma casa, a passada por `needle` roda na ordem de
  declaração de `COLUMN_SPECS`, e `filamentPrice` (needle `"filamento"`) é declarada **antes** de
  `filaments` (needle `"filamentos json"`) — então `"Filamentos"` é reclamada pelo preço, e a
  coluna de cores não acha mais nada.
  **Medido:** cabeçalho `Produto;Tempo (h);Filamentos` com JSON de cor válido →
  `filamentPricePerKg: 11050`, `weightG: 0`, **sem** `filaments`. `warnings: []` — e nem entra em
  "coluna ignorada", porque foi reclamada. Duplamente silencioso.

- ✅ **[CSV-11] FEITO (Lote A), e melhor do que "só avisar".** A lista `CALCULADAS` (`includes` sobre
  substring) virou `COLUNAS_CALCULADAS`, com os **10 nomes exatos** que o próprio export escreve, e
  ganhou **dois** usos: suprime o aviso só por **igualdade exata**, e **impede captura por needle**.
  É essa segunda trava que permitiu encurtar os needles pra `"energia"` e `"inclui"` sem risco de
  roubarem as calculadas `Energia (R$)`/`Custo Fixo (R$)` — então `Tarifa de Energia`,
  `Energia (R$/kWh)` e `Inclui custo fixo` passaram a ser **LIDAS**, não só apontadas.
  (`"inclui"` e não `"fixo"`: "fixo" casaria com qualquer coluna de custo fixo inventada ao lado.)
  Descrição original: **A supressão do aviso "coluna ignorada" engole variantes de DUAS colunas de
  ENTRADA.**
  **Mecanismo:** a lista `CALCULADAS` suprime o aviso por `includes` sobre o cabeçalho inteiro, e
  contém `"energia"` e `"custo fixo"` — que também casam com nomes das colunas de entrada
  `Tarifa Energia` e `Inclui Fixo`. Resultado: o nome não é reconhecido (needle não bate) **e** não
  é avisado.
  **Medido** (varredura sistemática: 19 colunas × variantes plausíveis, todo o resto exato):
  `"Tarifa de Energia"` → `energyTariff` 0,8 (planilha dizia 99) · `"Energia (R$/kWh)"` → 0,8 ·
  `"Inclui custo fixo"` → `includeFixed` false (planilha dizia "sim"). **Os três, calados.**
  As outras 12 variantes que erraram **avisaram** — a mecânica geral está certa; são estes dois
  vazamentos.

### 🟠 Alto (não bloqueia, mas morde na carga)

- ✅ **[CSV-12] FEITO (Lote B).** O `numFromJson` passou a testar `isMilharAmbiguo` também quando CONSEGUE ler, e o reporter ganhou um `kind` para carregar as duas notícias sobre o mesmo campo. Classe própria (`milhar-ambiguo-json`), porque o conselho é outro: na coluna a saída é escrever com vírgula decimal; dentro do JSON, onde o decimal já é o ponto, a saída é tirar o ponto. Descrição original: **`milhar-ambiguo` não roda DENTRO das células JSON.** A checagem cobre 4 colunas
  escalares; o JSON é onde moram os pesos de verdade do modelo. **Medido:** `"totalG":"1.234"` →
  **1,234 g**, sem aviso, e o `cor-sem-peso` **não** dispara (1,234 > 0). Um produto de 1234 g
  entra 1000× mais leve, invisível.

- ✅ **[CSV-13] FEITO (Lote B).** A checagem roda **cor a cor** sobre as normalizadas, e o exemplo NOMEIA a cor zerada (ou a posição, quando ela não tem nome). Descrição original: **`cor-sem-peso` só olha a SOMA da lista, não cada cor.** **Mecanismo:**
  `filamentsTotalG(lista.map(makeFilament)) === 0`. **Medido:** 2 cores, uma com `totalG: 0` →
  **nenhum aviso**. Em produto multicolor — a feature-bandeira do app — uma cor zerada por engano
  passa batida.

- ✅ **[CSV-14] FEITO (Lote B), em duas metades.** (1) Quem decide o separador é o próprio `parseLine`: entre `;`, TAB e `,`, vence o que PARTE o cabeçalho em mais células (empate fica com `;`, que é o que o export escreve) — contar caractere seria frágil, porque vírgula dentro de célula citada conta igual. Se dois candidatos partem o cabeçalho, um aviso diz qual usei. (2) O caso que a detecção sozinha NÃO resolve — vírgula com decimal pt-BR sem aspas, onde o separador está certo e a linha desalinha — virou a classe `celulas-demais`: célula A MAIS que o cabeçalho não tem outra explicação. A MENOS tem (planilha enxuta) e segue calada, e separador sobrando no fim da linha não conta. Descrição original: **O separador sai só do cabeçalho, e vírgula/TAB degradam em silêncio.**
  **Mecanismo:** `const separator = rawLines[0].includes(";") ? ";" : ","`.
  **Medido:** planilha com `,` e decimais pt-BR **sem aspas** — `Caneca,2,5,50` → `printHours: 2`,
  `weightG: 5`, terceiro valor descartado, `warnings: []`. Planilha com **TAB** → a linha inteira
  vira o NOME do produto, todo o resto no default; só acendem `linha-invalida`/`cor-avulsa`.
  Com `,` **e** aspas (o que o Excel faz) funciona.

### 🟡 Médio

- ✅ **[CSV-15] FEITO (Lote B).** Um só instante de referência por arquivo, mais o índice da linha: instante distinto por produto E ordem da planilha preservada (linha de baixo = mais recente). Descrição original: **`createdAt: Date.now()` no parse → a carga inteira nasce no mesmo instante.**
  **Medido na escrita real:** 100 produtos → **3 valores distintos** de `createdAt`; o round-trip de
  97 → **6**. Consequência: "Mais recentes"/"Mais antigos" fica arbitrário para o lote todo (a
  tela ordenou 047, 095, 061, 049…). Não corrompe nada; atrapalha achar o que acabou de entrar.

- ✅ **[CSV-16] FEITO (Lote D)** — e reclassificado: **era código, não doc.** `Tempo (min)` virou
  coluna própria (`timeMinutes`, needle `"tempo (min"`, que vence `"tempo"` na ordenação por
  comprimento do CSV-10) e **soma** com `Tempo (h)`, a mesma conta do `PrintTimeField` do
  formulário. Pro cabeçalho que o needle não pega (`"Tempo de impressao (min)"`), a 2ª trava é
  `headerEmMinutos`, que lê a unidade no texto da coluna que a de horas reclamou — com
  `\bmin(utos?)?\b`, pra "Tempo mínimo" não virar coluna de minutos. Descrição original: o needle
  `"tempo"` casa; **medido:** 120 → `printHours: 120`. Erro de 60×, sem aviso.

- **[CSV-17] `Arredondamento` pede o TOKEN, não o rótulo da tela.** O dono vê "Final ,90
  (psicológico)" na UI e precisa escrever `0.90`. **Medido:** `"0,9"` → `arredondamento-invalido`
  (avisa certo), `"0.90"` e `"0,90"` → ok. Como avisa, é item de modelo, não de código.

### 🟢 Baixo / informativo (não é da importação)

- ✅ **[CSV-21] FEITO (Lote D).** Set de classes já contadas na linha corrente, zerado a cada volta
  do laço. Os **exemplos** seguem por ocorrência (até 3) de propósito: numa linha só eles nomeiam
  campos diferentes, que é a informação acionável. Os 2 testes que travavam o comportamento antigo
  viraram "1 linha + N exemplos". Descrição original: o `addIssue` somava 1 por chamada, então uma
  única linha com 3 células ruins da mesma classe era reportada como **"3 linhas"** — e é esse
  número que decide se o dono confirma a carga ou volta pro Excel.

- ✅ **[CSV-22] FEITO (Lote D) — aberto nesta conversa, a partir de uma pergunta do dono**
  (*"usar o id aleatório do Firestore pode dar problema?"*). **Um `filamentId` errado mas
  EXISTENTE amarra o produto na cor errada, calado.** A checagem do CSV só pergunta se o id existe.
  O id é auto-id do Firestore (`addDoc`), ninguém digita, todo mundo cola — paste deslocado ou
  `PROCV` mal ancorado na planilha não deixa rastro. Conserto: cruzar com o `colorName` da MESMA
  célula JSON (o export escreve os dois). Divergiu, avisa (`cor-nome-divergente`) e **não escolhe**:
  vale o id, o dono decide. Por `normalizeText` (acento/caixa não contam); nome vazio é ausência;
  id inexistente acende só o `cor-inexistente`; vale também pra cor de etapa.
  ⚠ **Não vale pros insumos:** o acessório tem `desc` (texto livre, "ima"), não o nome do insumo —
  cruzar daria falso positivo em série.

- **[CSV-18] 18 documentos do catálogo carregam um campo `id` DENTRO do dado.** O `id` é o caminho,
  não campo (CLAUDE.md). Em 17 o valor é igual ao id do caminho (eco inofensivo); em **1** —
  caminho `4MKTY5K6OGldKp0zDZNB`, "Clicker The Sheep - Rosto cor da orelha" — aponta para **outro**
  documento (`nTpe34KAcIQf4rxhmYjL`). **Não vem da importação:** medido, **0 dos 100** importados
  têm o campo, e o `buildProductPayload` de hoje faz `delete base.id`. É resíduo legado — e o
  round-trip por CSV, aliás, **limpa**.

- **[CSV-19] `markupOnFixed` em 65 documentos** — campo que não existe no `ProductPayload`, nem no
  `toSavedProduct`, nem no CSV. Morto; o round-trip descarta. Só registro.

- **[CSV-20] Etapa legada `combineEnabled`/`stage2` não sobrevive ao round-trip.** O export lê
  `product.stages`, não `normalizeStages`. **Medido:** a 2ª etapa legada some e o custo cai — **mas
  a rede do CSV-03 pega** (`custo 19,08 → 5,11` no aviso de divergência). E, medido no banco real,
  **nenhum** dos 97 documentos tem `stage2` preenchido → hoje é inalcançável.

### ✅ O que está SÃO — medido, não presumido

> Registrado porque a pergunta do dono era "vai dar certo?", e a maior parte da resposta é **sim**.

- **Round-trip do arquivo do app é estável:** `export → parse → export` deu arquivo **idêntico**
  (97 produtos reais + 4 sintéticos com etapa/acessório/subitem/markup/links/detalhamento de cor).
  A 3ª volta também.
- **Diff campo a campo dos 97 reais:** toda diferença é normalização **documentada** — defaults
  preenchidos (`sellBySubitems`, `subitems`, `roundingMode`, links…), escalares migrando para
  `filaments`, `stages[].energyTariff`/`laborRate` descartados de propósito,
  `accessories[].supplyId`/`subitemId` virando `null`. **`recalc`: 0 divergências em 97 linhas.**
  ⚠ Sem *stringify canônico* apareciam 33 falsos positivos em `stages[].filaments` — só ordem de
  chave. A regra do CLAUDE.md se confirmou na prática.
- **O que caiu no banco bate com o parse:** os 97 documentos gravados casaram **exatamente**
  (0 sem par) com os payloads que o `parseProductsCsv` produziu; os 100 da carga saíram com forma
  **uniforme** (as mesmas 24 chaves em 100/100), sem `undefined`, com os 3 nulos legados e sem
  campo `id`.
- **As 13 classes de aviso: nenhum falso positivo.** Nos ~45 casos de controle, todas acenderam
  quando deviam e ficaram caladas quando não deviam — incluindo os limítrofes (`[]` e `[ ]` não são
  JSON inválido, `{}` é; markup vazio não avisa, `"abc"` avisa; detalhamento sem `totalG` não é
  cor-sem-peso; subitem apontando `"main"` ou `stage_0` sem id explícito é válido).
- **Encoding e formato:** ANSI lido como UTF-8 é **detectado** (3 caracteres ilegíveis → aviso
  certo). CRLF, BOM, célula com quebra de linha citada, aspas dobradas, linha em branco no meio,
  linha `;;`: todos corretos. Nome repetido conta certo (arquivo + catálogo).
- **pt-BR:** vírgula decimal, ponto de milhar, `R$`, espaço não-separável — corretos, inclusive
  **dentro** do JSON quando o número vem como string (`"143,53"` → 143,53). `1.234` acende
  `milhar-ambiguo` nas 4 colunas certas e **não** acende em `Tempo (h) = 2.375`.
- **Escala e atomicidade:** 100 produtos = 17,7 KB, parse **5,1 ms**, e da confirmação até
  aparecerem na tela **1,48 s**. Lote com 1 payload inválido → **nada entra** (294 → 294), nos dois
  modos de falha (`undefined` barrado pelo SDK; documento > 1 MiB barrado no commit).
- **Uma linha ruim entre 100 não derruba as outras:** no parse ela entra degradada e é apontada;
  na escrita, ou entra tudo ou nada (≤ 500 é um `writeBatch` atômico).

### 📋 Resposta direta: o conjunto MÍNIMO de colunas

- **Obrigatória: `Produto`. Só ela.** Sem essa coluna a importação lança
  `Coluna "Produto" não encontrada.` e **nada** entra. Linha sem nome é pulada em silêncio.
- **Todo o resto é opcional** e cai em default **quando a coluna está AUSENTE**: máquina = a 1ª
  (A1), Tempo 0, Peças 1, Tarifa 0,8, Mão de obra 15 min, Valor-hora 30, Markup 3, Taxa de falha 3,
  Inclui Fixo "não", Arredondamento `exact`, links vazios, sem etapa/acessório/subitem.
- **Mínimo RECOMENDADO — as 15 colunas que eu carreguei com 100 linhas e ZERO avisos:**
  `Produto` · `Maquina` · `Peso (g)` · `Tempo (h)` · `Pecas` · `Filamento (R$/kg)` · `Markup` ·
  `Taxa Falha (%)` · `Tarifa Energia` · `Mao de obra (min)` · `Valor-hora (R$)` · `Inclui Fixo` ·
  `Arredondamento` · `Filamentos JSON` · `Acessorios JSON`.
- ~~**Regra de ouro enquanto o [CSV-09] estiver aberto: coluna que você NÃO vai preencher, não
  coloque.**~~ **Morreu com o lote A:** coluna ausente e célula **vazia** agora caem no MESMO
  default. Deixar em branco é seguro; o que aponta é o valor escrito e ilegível.
- **Nomes:** acento e caixa não importam ("Máquina" = "Maquina"). **Depois do lote A**,
  `Filamentos` (sem "JSON"), `Tarifa de Energia`, `Energia (R$/kWh)` e `Inclui custo fixo` também
  funcionam. Use `;` como separador e salve como **CSV UTF-8** — TAB e `,` são detectados, mas com
  `,` todo decimal precisa ir **entre aspas** (`"1,5"`), senão a linha desalinha (a importação
  avisa, mas o excedente é descartado).
- **Depois do lote D:** o tempo pode vir em **horas, em minutos, ou nos dois** — `Tempo (h)` e
  `Tempo (min)` são colunas distintas e **somam** (2 h + 30 min = 2,5 h), e hora decimal continua
  valendo. Um cabeçalho que diga minuto de outro jeito (`Tempo de impressao (min)`, `Tempo em
  minutos`) também é lido como minuto ([CSV-16]).
- **Continua valendo:** `Arredondamento` pede o **token** — `exact`, `0.90`, `4.90`, `0.5`, `1`,
  `5`, `10` —, não o rótulo da tela ([CSV-17], que ao menos avisa).
- ✅ **O de-para (nome → id) sai pelo app** — botão **"Copiar de-para"** nas abas Filamentos e
  Insumos do `/estoque` (2026-08-23), em TSV: cola no Sheets/Excel já em colunas. Cores saem com
  `Cor · Material · Marca · Arquivada · id` — material e marca vão junto porque `colorName` sozinho
  repete entre materiais, e é aí que um de-para cego amarra na cor errada. Antes disso o único
  caminho era o console do Firebase (medido: nada na `/estoque` renderizava o id, e o export do
  catálogo só revela id de cor **já usada** por algum produto).
- **Decisão do dono:** segue com o auto-id — a alternativa (slug) colide entre materiais/marcas e exigiria esquema de desempate.
  **A regra que isso cria:** depois da carga, cor se **edita** (nome, preço, arquivar — tudo
  preserva o id); **excluir e recriar gera id novo** e mata o vínculo de todos os produtos que a
  usam. A exclusão já lista os produtos/vendas afetados antes de confirmar (`filamentReferences`).
- **Pré-requisito confirmado (item E):** a importação **não cria** cor nem insumo — medido, 2 cores
  e 2 insumos antes e depois de importar 100 produtos que os referenciam. Referência órfã **entra
  assim mesmo**, avisando (`cor-inexistente` / `insumo-inexistente`); máquina que não casa cai na
  primeira e avisa; máquina em **branco** cai na primeira **sem** avisar. Ou seja: **cadastre as
  cores e os insumos definitivos ANTES**, e ponha os ids reais no JSON.

### O que a AUD-09 NÃO cobriu

- **Acima de 500 produtos** (lotes sequenciais, estado parcial possível): li o código e o próprio
  repositório documenta, mas **não medi** — exigiria criar 500+ documentos. A carga prevista é ~100.
- **Excel de verdade:** sintetizei ANSI/CRLF/BOM/separadores em bytes. Não abri o arquivo no Excel
  nem no Google Sheets para ver o que ELES escrevem ao salvar.
- **O seletor de arquivo do sistema:** injetei o `File` via `DataTransfer` — `FileReader`, parse,
  modal e `writeBatch` rodaram de verdade, mas o diálogo do SO não.
- **A planilha-modelo / spec** continua por fazer; esta varredura define o que ela precisa conter,
  não a entrega. A **tabela de-para (cor → id)** saiu de cena: o dono pega os ids no console do
  Firebase depois de cadastrar as cores e alimenta o sistema externo dele (2026-08-23).

## Aberto — cluster da varredura AUD-12 (2026-08-23) — SISTEMA INTEIRO, 2ª passada

> 5ª varredura (a **v2** da geral), pedida pelo dono **imediatamente antes da carga em massa**, com
> a regra mais dura até aqui: **nada é verdade até ser reproduzido** — inclusive os `✅ FEITO` deste
> arquivo, os comentários do código, os nomes dos testes, as mensagens de commit e **o relatório da
> AUD-11**, cujas duas listas (4 defeitos corrigidos + 78 verificações sãs) entraram como hipótese.
> Reportado **sem correção**: o dono decide os lotes.
>
> **Relatório com todas as medições:**
> <https://claude.ai/code/artifact/b7e0753b-ec6a-4e1a-9418-91ac4667766c>
>
> **Método:** 10 arquivos de harness em vitest (~350 casos) · sonda instalada em `window` medindo o
> DOM nas **7 rotas × 2 temas × 4 larguras** (375 / 400–430 / 700 / 1280) com os acordeões abertos ·
> os **9 modais** medidos um a um (o buraco declarado da AUD-11) · PDF gerado em node e o texto
> extraído do stream · **importação real** montada em JS, disparada no `input[type=file]`, o diálogo
> lido e **cancelada**. `lint` ✅ · `build` ✅ · **603/603** ✅ · `git status` vazio ·
> **0 escritas no Firestore** (a de duas abas gravando ficou pendente de aval — ver o fim da seção).
>
> ⚠ **Três falsos positivos MEUS, declarados** (valem mais que achado inflado): (1) "o
> `buildProductPayload` perde o `weightG` de etapa legada" — errado, montei o estado do formulário à
> mão; o caminho real passa por `createStage` → `normalizeFilaments`, que migra o escalar antes de
> qualquer save (refeito pelo documento: `doc1 === doc2`, preço 78,80 → 78,80); (2) "`marginTier(65)`
> está errado" — é a DEC-04 escrita, faixa fechada nas duas pontas, e o arredondamento antes do
> faixeamento é de propósito; (3) "`worstPaymentFee` devolve 2% havendo 6%" — meu fixture usava
> `t1`/`t2` em vez de `visamaster`/`amexelo`; com as constantes reais devolve 7,19%.
>
> ✅ **O lote AUD-11 segura.** Os 4 foram reproduzidos e nenhum criou falso positivo: auditei **toda**
> coluna escalar numérica do `COLUMN_SPECS` e nenhuma ficou fora da checagem de milhar; a 2ª trava do
> CSV-16 acende nos 3 cabeçalhos testados; o `cor-sem-preco` fica **mudo** com cor real que tem rolo
> (confirmado ao vivo com o id do Bege) e nunca coexiste com `cor-sem-peso` na mesma cor; o
> round-trip do próprio export dá **0 avisos** apesar de `printHours: 2.375`; e `"2 e 5"` não vira
> 200000.

### ✅ 🔴 Entra CALADO na carga — os 5 FECHADOS nos lotes A e B (2026-08-23)

- ✅ **[CSV-23] FEITO (Lote A, 2026-08-23).** `parseBool` passou a aceitar `sim/s/true/verdadeiro/v/1/x/yes/y` (e `nao/n/false/falso/f/0/no/-` para negar), e a grafia fora das duas listas acende `booleano-nao-reconhecido` nomeando a coluna — o default calado era o defeito, não a grafia. Célula VAZIA continua sendo ausência, e segue calada. Descrição original: **`parseBool` só aceita `"sim"` — `TRUE`/`1`/`VERDADEIRO` viram `false`, sem um aviso.**
  Atinge as duas colunas booleanas: `Inclui Fixo` e `Vende por Subitens`. **Medido**, 13 grafias na
  mesma linha: `"sim"`/`"SIM"`/`" sim "` → `true` (custo fixo 4,76 · total 27,65 · **preço 57,98**);
  `"TRUE"`/`"true"`/`"VERDADEIRO"`/`"1"`/`"S"`/`"Y"`/`"yes"` → `false` (fixo **0,00** · total 22,89 ·
  **preço 53,22**), com **0 avisos** nos três canais (`warnings`, `recalc`, `issues`).
  **Impacto:** a planilha vem de um sistema externo; se ele escrever em inglês, o catálogo inteiro
  nasce sem repassar aluguel e fixos — **−R$ 4,76/peça (−8,2%)** — e a margem exibida continua
  "normal", porque é calculada sobre o custo que ficou. Mesmo formato do `Tempo (min)` da AUD-11.
  **Onde:** `productCsv.ts:247`. **Saída:** aceitar o vocabulário de planilha (`sim/s/true/1/x/v/
  verdadeiro`) **e** acender uma classe nova para a grafia não reconhecida — o default calado é o
  defeito, não a grafia.

- ✅ **[CSV-24] FEITO (Lote A, 2026-08-23).** O casamento por substring continua — vira `maquina-por-aproximacao`, classe AGRUPADA e não um `warnings.push` por linha (o palpite erra em bloco: se o sistema externo escrever "AnyCubic A1 Mini", são as 100 linhas de uma vez). E o desempate deixou de ser a ordem do array: vence o **id mais longo** contido no nome, o mesmo critério do CSV-10 — "Maquina X2D e A1" agora dá **x2d**. Descrição original: **Nome de máquina casado por SUBSTRING, e o palpite não se anuncia.**
  `machineNameToId` tenta o nome exato; falhando, procura a 1ª máquina cujo **id** esteja contido no
  nome. Esse 2º caminho **nunca chama o `onFallback`** — só o fracasso total avisa. **Medido**,
  8 nomes: `"AnyCubic A1 Mini"` → **a1**, `"Elegoo Neptune A1"` → **a1**, `"meu x2d antigo"` → x2d,
  `"Maquina X2D e A1"` → **a1** (a 1ª do array vence, não a mais específica) — os quatro **sem
  aviso**; só `"Prusa MK4"` avisa.
  **Impacto:** energia, desgaste e manutenção saem da máquina errada e `machineMissing` fica
  `false`, então nem o badge ⚠ do catálogo aparece. Diferença A1 × X2D no mesmo produto:
  **R$ 53,22 → R$ 65,13 (+22%)**, quase tudo desgaste (2,1196 → 5,5996). O id `a1` tem 2
  caracteres: casa dentro de quase qualquer nome de impressora. **Onde:** `productCsv.ts:625`.
  **Saída:** é o padrão 11 (*o palpite que não se anuncia*) — o casamento aproximado pode continuar,
  desde que vire aviso, como o [CSV-10]/D-3 da AUD-11 fez com as colunas.

- ✅ **[UX-44] FEITO (Lote B, 2026-08-23), e a correção foi APAGAR, não reescrever.** O override de `grid-template-columns` do bloco de 760px saiu inteiro: além do `1fr` puro, as larguras eram as **pré-UX-41**, e sem ele a regra boa do `modal.css` vale de 641px para cima. Abaixo de 640px (a fronteira de cartão que o resto do arquivo já usa) a fileira **vira cartão**, com colocação EXPLÍCITA nos 6 itens — colocar só o botão em `3 / 1` não tira a coluna 3 do fluxo automático, e o campo Watts caía nela (32px de caixa para 44px de conteúdo). ⚠ **Achado NOVO, que o relatório não tinha:** a grade cortava `13999` (71px numa caixa de 64) e `7500` (62 numa de 54) **também de 641 a 760px** — a varredura mediu o NOME a 700px, que estava bem, e não os números. Medido depois, em 320/375/400/430/561/641/1013px e nos 2 temas: **0 estouro, 0 corte, 0 rolagem lateral**, botão dentro da caixa. Descrição original: **"Gerenciar Máquinas" quebra no celular: `13999` aparece como `1399` e `7500` como
  `750`.** Único dos **9 modais** que falha (os outros 8 medidos limpos a 375 px). São dois padrões
  do próprio catálogo deste repositório somados:
  · **`1fr` puro em vez de `minmax(0, 1fr)`** — `responsive.css:93` sobrescreve a regra boa do
  `modal.css:87` (`minmax(0, 1fr) 82px 72px 68px 78px 32px`) por `1fr 64px 54px 52px 66px 32px`;
  · **a correção que não foi para a irmã em media query** — o comentário do `modal.css:85` descreve
  exatamente este bug (UX-41: *"7500 deixava de caber e aparecia como 750"*) e alargou as colunas
  **só no desktop**.
  **Medido a 375 px:** colunas resolvidas `22px 64px 54px 52px 66px 32px`; grade com 285 px para
  326 px de conteúdo → **estoura 41 px**; botão de excluir em `right: 371` contra a borda do diálogo
  em `right: 355` → **fora da caixa**; campo Nome com **22 px** para conteúdo de 90–100 px;
  `13999` corta (caixa 64 / precisa 71), `7500` corta (54 / 62), `150` corta (52 / 53).
  **A conta que explica:** 64+54+52+66+32 = 268 px fixos + 5 gaps de 8 px = **308 px** consumidos
  antes de o Nome ganhar 1 px → só cabe a partir de viewport **≥ 416 px**. Medido a 400 px: ainda
  estoura 16 px. A 430 px: 0 estouro, mas Nome com 32 px. A 700 px: Nome com 202 px ✅.
  **Impacto:** as máquinas moram no doc compartilhado `config/machines` e alimentam energia +
  desgaste de **todos** os produtos; editá-las pelo celular hoje é adivinhação. **Saída:** a regra do
  próprio projeto — `minmax(0, 1fr)` na media query e a fileira **virando cartão** (receita do
  `.fg-part`) abaixo dos ~300 px úteis, em vez de rolar.

- ✅ **[CSV-25] FEITO (Lote A, 2026-08-23).** Classe `linha-sem-nome`, com até 3 exemplos mostrando as células que a linha trazia. ⚠ A guarda distingue **linha de dado sem nome** de **linha em branco escrita com separador**: `";;"` sobrevive ao `splitRecords` (`";;".trim()` não é vazio) e a AUD-09 registrou o silêncio dela como SÃO — quem separa as duas é ter, ou não, conteúdo em alguma outra célula. Um teste trava isso. Descrição original: **Linha sem nome desaparece sem entrar em contador nenhum.**
  `if (!name) return []` no `flatMap`: sem `warning`, sem `issue`, sem contagem. O diálogo já mostra
  o total **depois** do descarte. **Medido:** arquivo com 5 linhas de dado, 3 com a célula `Produto`
  vazia (vazia, só espaços, e `""` citada) → **2 produtos**, `warnings: []`.
  **Impacto:** numa planilha de ~100 linhas gerada fora, uma coluna deslocada ou uma linha de
  subtotal zeram o nome — e só se descobre contando o catálogo contra a planilha à mão.
  **Onde:** `productCsv.ts:970`. **Saída:** um `addIssue("linha-sem-nome", …)`; é irmã do
  `celulas-demais`, que já avisa.

- ✅ **[CSV-26] FEITO (Lote A, 2026-08-23).** Os três problemas nasciam de espremer leitura, default e aviso numa expressão só; a separação em `markupCell` (o que a planilha escreveu, e é o que o aviso cita) / `markupRaw` (sem o sufixo `x`) / `markupLido` (o número, `null` se ilegível) resolve os três: `-2` e `0` agora entram **com 3x**, como o aviso sempre prometeu; `"x"` sozinho não vira string vazia e **aponta**; e `<1x` ganhou classe própria (`markup-abaixo-de-1`), porque foi LIDO certo — a linha entra como está, mas o dono sabe que o preço sai abaixo do custo. Descrição original: **O aviso do markup MENTE sobre o que entrou no documento** *(era a ressalva "markup
  negativo entrando no documento", promovida a defeito)*. Três problemas na mesma checagem:
  · `markup: parseNumber(raw) || 3` — **`-2` é truthy**, então o `|| 3` nunca dispara e o documento
  recebe **−2** (preço **−R$ 22,59**), enquanto o aviso diz *"a linha entra com 3x"*;
  · `"0,5"` entra a 0,5× (preço R$ 15,31, **abaixo** do custo R$ 22,89) **sem** a classe
  `markup-invalido` — o teste é `<= 0`;
  · `"x"` vira string vazia no `replace("x","")` e o guarda `if (markupRaw && …)` pula: entra a 3×
  **sem aviso nenhum**.
  **Atenuante:** o `linha-invalida` (que roda o `validateProduct`) pega os dois casos de preço
  absurdo — o que se perde é a confiança no texto. **Onde:** `productCsv.ts:1124` e `:1224`.

### Ordem aprovada pelo dono — AUD-12 (2026-08-23)

| Lote | Itens | O que é | Estado |
|---|---|---|---|
| **A — o parser volta a avisar** | [CSV-23] · [CSV-24] · [CSV-25] · [CSV-26] | tudo em `productCsv.ts`; a disciplina do CSV-10 (*o palpite que não se anuncia*) | ✅ **FEITO (2026-08-23)** |
| **B — celular** | [UX-44] | CSS; `minmax(0, 1fr)` + fileira virando cartão | ✅ **FEITO (2026-08-23)** |
| **C — qualidade do aviso** | [CSV-27] · [CSV-28] · [CSV-29] · [CSV-31] | falso positivo e conselho errado — o que ensina a ignorar aviso | ✅ **FEITO (2026-08-23)** |
| **D — dívida barata** | ~~[TD-023]~~ · ~~[TD-024]~~ · ~~[TD-025]~~ | comentário que afirma garantia inexistente + 2 guardas | ✅ **FEITO (2026-08-23)** |
| **E — toque e responsivo** | [UX-45] · [UX-46] | faixa 641–760px + os alvos abaixo de 44px; o maior dos cinco | ✅ **FEITO (2026-08-23)** |
| **fora de lote** | ~~[TD-022]~~ · ~~[TD-021]~~ · ~~[CSV-30]~~ | TD-022 reproduzido e corrigido; CSV-30 e TD-021 viraram ressalva (dono) | ✅ **nada aberto aqui** |

### 🟠 Alto (não bloqueia a carga, mas morde)

- ✅ **[TD-022] FEITO (2026-08-23) — REPRODUZIDO com escrita real e corrigido nas duas metades.**
  Contador `rev` conferido dentro de `runTransaction`, que **RECUSA** em vez de mesclar (mesclar
  produziria um documento que nenhuma das duas pontas quis, e no estoque o FIFO poderia atravessar
  outro rolo). (a) **produtos:** medido — aba A peso 40→99, aba B mão de obra 10→55, B salva antes,
  A depois, e o documento fica com **mão de obra 10**; o formulário de A ainda exibia 10 no instante
  do salvar, porque a assinatura atualiza a LISTA, não a cópia em edição. Depois da correção a
  gravação velha é recusada e o formulário fica intacto. (b) **estoque/insumos/acabados:**
  `reconcileRecibo`, `saveProduction` e `removeProduction` deixaram de ser `writeBatch` (atômico,
  mas **não isolado**), com a conferência num lugar só (`revGuard.ts`). ⚠ O guarda seria inútil se a
  tela do `/estoque` gravasse sem incrementar — `saveStockFilament`/`saveSupply` entraram na mesma
  transação. Recusa medida ao vivo (2 cliques no mesmo tick do React, cor Laranja); e a tentativa
  pelo diálogo "Ajustar" **não** reproduziu, porque o `adjustFor` é derivado da lista viva — o que é
  elogio ao app. Writeup e o estado do banco: [`HISTORICO.md`](HISTORICO.md). Descrição original:
  **Escrita concorrente é last-write-wins, sem controle nenhum.**
  Leitura dos 12 repositórios: `saveProduct` faz `updateDoc(ref, {...payload})` — **documento
  inteiro**; idem `estoque` (`stockRepository.ts:135`) e `insumos` (`suppliesRepository.ts:130`). O
  **único** `runTransaction` do app é a numeração do orçamento (`quotesRepository.ts:86`).
  Consequência: duas abas editando o mesmo produto — a que salvar por último **apaga** a mudança da
  outra em silêncio; duas vendas simultâneas da mesma cor podem perder uma baixa (as duas leem o
  mesmo saldo e escrevem o mesmo resultado). ⚠ **Mecanismo lido no código, NÃO reproduzido** — exige
  escrita real, que ficou pendente de aval (plano no fim desta seção).

- ✅ **[UX-46] FEITO (Lote E, 2026-08-23) — escopo ENXUTO, aprovado pelo dono: só os controles que o
  dedo busca.** Quatro mudanças, todas medidas no DOM antes e depois:
  · **`.icon-button` 28 → 32px** (a régua de desktop; o catálogo já corrigia isso localmente desde o
  UX-15 — era o global que estava atrás) **e → 44px no celular**. O caso comum era o botão de
  excluir SOLTO numa fileira: os quatro aglomerados que já subiam para 44 tinham regra própria,
  quem estava sozinho não tinha ninguém.
  · **`input[type="range"]` 313×4 → 313×44** (celular) / ×32 (desktop): os 4px viraram DESENHO
  (`::-webkit-slider-runnable-track`), com margem negativa devolvendo o crescimento ao fluxo — a
  linha do markup ocupava 14px e continua ocupando 14.
  · **`.btn-sm` 29 → 32/44px** via `min-height`, sem mexer no `padding`.
  · **`.num-spin` 14 → 28px no celular.** A trava dos 14px é do `[micro]` e a razão era medida — mas
  a coluna de 64px que a motivou **não existe mais no celular** (o UX-44 virou a fileira em cartão).
  Remedido: a pior folga vira 18px, no `13999`. No desktop fica em 14, onde a coluna estreita segue
  existindo.
  **Resultado medido:** `/producao` a 1280px **25 → 0** abaixo da régua de 32 · `/producao` a 375px
  43 → 16 · `/estoque` 27 → 19 (os 8 `.btn-sm`) · `/orcamento` 67 → 27. `overflow` horizontal 0 e
  **0 números cortados** em todas as medições.
  ⚠ **Duas exceções DECLARADAS, com a conta:** `.accessory-row` e `.machine-edit-row` (na grade de 6
  colunas, 641–760px) são fileiras de **trilha FIXA** e não têm de onde tirar — medido, o botão de 44
  estourava a fileira de acessórios em 12px e jogava o Excluir para FORA da linha, que é o UX-44
  reaberto pela porta dos fundos. Nelas o botão fica em 32 e o stepper em 14. Onde a fileira JÁ é
  cartão (`.machine-edit-row` ≤640px) a exceção se desfaz e o 3º trilho sobe para 44 junto.
  ⚠ **Armadilha nova, registrada:** `::-webkit-slider-runnable-track` e `::-moz-range-track` NÃO
  podem ir na mesma lista de seletores — um pseudo-elemento desconhecido invalida a **regra inteira**,
  e o Chrome descartava a pista (barra do markup sumia). Duas regras separadas.
  Descrição original:
  **Alvos de toque abaixo da régua — mais largo do que a ressalva antiga dizia.**
  A ressalva falava do *"slider de markup com ~15px de área real"*. **Medido:** o slider tem caixa
  de **313×4 px** com `padding: 0`. E a 375 px, contra os 44 px da regra do projeto:
  `/orcamento` **67** elementos abaixo · `/producao` **41** (25 deles `.icon-button.danger` de
  28×28) · `/vendas` 42 · `/estoque` 27 · `/catalogo` 18. Os steppers `.num-spin` medem **14×20 px**
  (têm `tabindex="-1"`, então não quebram teclado — o dedo é que não acerta). No desktop,
  `.icon-button` 28×28 e `.btn-sm` 29 px contra os 32 da régua.
  ⚠ A técnica documentada (`padding` + margem negativa igual, UX-28/UX-37) **apareceria** no
  `getBoundingClientRect` — ela não foi aplicada nesses lugares.

### 🟡 Médio

- ✅ **[UX-45] FEITO (Lote E, 2026-08-23).** O corte de cartão do catálogo e do recibo subiu de 640
  para **760px**. Não é número novo: é a outra fronteira que o `responsive.css` já usa, e é o que o
  comentário do `catalog.css` **já afirmava** (*"em 760 o layout já vira cartão"*) — o código é que
  divergia da intenção escrita. **Medido a 700px, depois:** `/catalogo` 68 → **0** de rolagem;
  `/vendas` 130 → **0** em 23 recibos. O editor de máquinas FICOU em 640 de propósito: a grade dele é
  confortável de 641 a 760, e fronteira igual não é virtude quando as larguras mínimas diferem.
  ⚠ **Resíduo medido (a válvula, não é regressão):** a `.recibo-items` pede `min-width: 800px`, então
  de **761 a 841px** ela ainda rola — 81px a 761. É o mesmo desenho da válvula do catálogo (que rola
  19px a 761 e zera em 782). Fica registrado; fechar exigiria cartão até ~842px, que é decisão do
  dono. Descrição original:
  **Faixa 641–760 px: tabela rolando de lado em vez de virar cartão.**
  *(era ressalva aberta; agora medida)*. A regra "vira cartão" só entra em `max-width: 640px`.
  **Medido a 700 px:** `/catalogo` → `.table-scroll` 672 → 740 = **68 px de rolagem**, com a célula
  de nome em 66 px para conteúdo de 99–135 px; `/vendas` → `.recibo-items-scroll` 670 → 800 =
  **130 px**, repetido em 6+ recibos. `/estoque` e `/producao`: **0** ✅.

- ✅ **[TD-023] FEITO (Lote D, 2026-08-23) — o CÓDIGO passou a honrar o comentário (escolha do dono).**
  `addProductionLayers` confere `layer.id` antes do `push`: reaplicar o mesmo evento na mesma SKU não
  soma nada. ⚠ **A outra metade do achado foi resolvida ao contrário, de propósito:** `shiftLayers`
  (e portanto `applyFinishedConsumption`/`reverseFinishedConsumption`) é **DELTA**, e deduplicar por
  `layerId` ali seria BUG — dois recibos diferentes drenando a mesma camada são dois movimentos
  legítimos, e engolir o 2º faria o estorno de um devolver o material do outro. Ganhou comentário
  explicando a assimetria (lá a `layerId` identifica O EVENTO; aqui só aponta DE ONDE tirar).
  5 testes, incluindo os dois lados. Descrição original:
  **`addProductionLayers` NÃO é idempotente, apesar do comentário afirmar que é.**
  O comentário diz *"a `layerId` é evento+SKU, então um mesmo evento nunca duplica camada na mesma
  SKU (idempotente por evento)"* — e o código só faz `existing.layers.push(layer)`, sem checar o id.
  **Medido:** mesmo `eventId` aplicado 2× → **2 camadas com o id idêntico**
  (`EV1____whole__::__nocolor__`) e o saldo dobra de 4 para 8. O mesmo vale para
  `reverseFinishedConsumption` (8 → 12 no estorno duplo). **Risco prático baixo:** o `batch.set`
  grava o doc inteiro já computado, então repetir o batch grava o mesmo valor; e o
  `removeEventLayers` limpa as duas camadas. → **ou o comentário muda, ou o código o honra** (dedup
  por `layer.id`). Um comentário que afirma garantia inexistente é armadilha para quem confiar.

- ✅ **[CSV-27] FEITO (Lote C, 2026-08-23).** O sufixo passa a olhar `rolls.length`: sem rolo mantém
  a frase original (ali ela está certa); **com** rolo diz *"TEM rolo, mas o rolo mais novo está com
  preço 0 — corrija no Estoque"*, que é o que o `catalogPricePerKg` de fato lê. O corpo do aviso
  deixou de mandar "cadastre um rolo" e passou a pedir *"um rolo COM preço"*. 3 testes. Descrição
  original: o sufixo era anexado sempre que a cor existia, sem olhar se havia rolo — cor com 1 rolo
  de `pricePerKg: 0` recebia ordem de cadastrar um rolo que já estava cadastrado.

- ✅ **[CSV-28] FEITO (Lote C, 2026-08-23).** O `resolveColumns` passou a devolver `duplicadas` (os
  índices cujo texto normalizado casa com o de uma coluna JÁ reclamada). Elas saem do aviso de "nome
  não reconhecido" e ganham o seu, com o conselho **oposto**: lá a saída é renomear, aqui é apagar a
  sobra — e a mensagem diz qual das duas venceu (*"vale a PRIMEIRA da esquerda para a direita"*).
  A leitura não mudou. 3 testes. Descrição original: `Produto;Peso (g);Peso (g)` reportava *"o nome
  não foi reconhecido"* — o nome **foi** reconhecido, e a razão errada mandava renomear.

- ✅ **[CSV-29] FEITO (Lote C, 2026-08-23).** A regex de científica virou o helper `matchCientifica`,
  usado pelos **dois** lados do `number.ts`: o `parseDecimalPtBr` a lê antes da limpeza (como já
  fazia) e o `isMilharAmbiguo` sai **mudo** quando ela casa. O milhar ambíguo de verdade (`"1.234"`,
  `"R$ 1.234"`, `"(1.234)"`) continua acendendo, e `"2 e 5"` segue sem virar 200000 — o espaço
  preservado na limpeza é o que o impede. 4 testes. Descrição original: `"1.5E+03"` era lido
  **corretamente como 1500**, mas a limpeza transformava o texto em `"1.503"` e casava o padrão,
  produzindo um aviso que se contradizia.

### 🟢 Baixo / informativo

- ✅ **[CSV-31] FEITO (Lote C, 2026-08-23) — REPROVA, não arredonda (escolha do dono).**
  `validateProduct` passou a exigir `Number.isInteger(piecesCount)`, então a linha cai no
  `linha-invalida` que a importação já mostra, junto do `milhar-ambiguo` que já acendia. **O motivo
  de não arredondar:** se a planilha queria dizer 1234, virar 1 troca um número absurdo (que salta
  aos olhos) por um plausível (que ninguém acha depois). 0 e ausente continuam passando — o default
  é do chamador (`Math.max(1, …)` no CSV). 5 testes. Descrição original: `Pecas = "1.234"` gravava
  **1,234 peça** e o preço caía de 29,71 para 24,08 — o aviso acendia e o valor absurdo entrava.

- 📌 **[TD-021] RESSALVA, não item (dono, 2026-08-23).** A planilha da carga é **gerada por máquina**
  pelo sistema externo do dono — as entradas abaixo são de escrita à mão, que não é o caminho real.
  Fica registrado para não voltar como achado novo; se a planilha um dia passar a ser editada à mão,
  reabrir. Descrição original: **`parseDecimalPtBr` cola pedaços e devolve número plausível**
  *(padrão 12 do roteiro)*.
  **Medido, 83 entradas:** `"1/2"` → **12** · `"1a2"` → 12 · `"1,2,3"` → 123 · `"2 e 5"` → 25 ·
  `"1E"` → 1 · `"e5"` → 5 · `"(5) (6)"` → −56. Nenhum devolve `null`, então nenhum vira aviso. Em
  compensação `"1-2"`, `"--5"`, `"N/A"` e `"n.d."` viram `null` corretamente, e `"1E+400"` também
  (não vira `Infinity`). **Risco baixo numa planilha gerada por máquina; alto numa escrita à mão.**

- ✅ **[TD-024] FEITO (2026-08-23) — guarda barata.** `machines[0] ?? MAQUINA_AUSENTE` (uma máquina
  de zeros): energia, desgaste e manutenção saem 0, `machineMissing` continua `true` — que é o que a
  tela já sabe mostrar — e o material continua entrando. `lifeHours: 0` é seguro porque a
  depreciação já era guardada por `lifeHours > 0`. "Não achei caminho pela UI" não é "não existe", e
  o preço inteiro depende de a função não explodir. 3 testes. Descrição original:
  **`calculatePricing` com lista de máquinas VAZIA lança `TypeError`.**
  **Medido:** `Cannot read properties of undefined (reading 'watts')`. Alcançável só se
  `useMachines` devolver lista vazia — ele semeia dos defaults e cai em fallback local, então **não
  reproduzi pela UI**. Máquina *inexistente* (id órfão) é tratada certo: cai na 1ª e marca
  `machineMissing: true`.

- ✅ **[TD-025] FEITO (2026-08-23) — guarda barata.** O `|| 1` existe para o campo AUSENTE
  (`undefined`/`NaN`), onde 1 é o default certo — mas 0 e negativo são números que alguém escreveu,
  e responder "vendeu 1" a eles é inventar receita. Agora `Number.isFinite` separa os dois casos:
  ausente → 1, zero/negativo → 0 (receita, custo, taxa e lucro saem 0). 4 testes. Descrição
  original: **`saleItemFinancials` com quantidade 0 vende 1.**
  **Medido:** `quantity: 0` e `quantity: -2` devolvem os dois `totalRevenue: 100, totalCost: 30,
  profit: 70` — é o `Math.max(1, …)`. **Não achei caminho pela UI** que produza qty 0; fica como
  ressalva de biblioteca.

- 📌 **[CSV-30] RESSALVA, não item (dono, 2026-08-23).** Os **dados** são idênticos (diff canônico
  limpo); só a ordem das chaves de `Acessorios JSON` muda no texto. Importa apenas para quem comparar
  arquivos com `diff`, e ninguém no fluxo faz isso. Fica registrado para não voltar como achado novo.
  Descrição original: **O texto do CSV não é estável byte a byte no round-trip.**
  Export → import → export produz a mesma linha com a ordem das chaves de `Acessorios JSON` trocada
  (`subitemId`/`supplyId`). Os **dados** são idênticos (diff canônico limpo); só o texto difere.
  Importa apenas para quem comparar arquivos com `diff`.

### ✅ Fechado — o resíduo de UI (2026-08-24): os dois últimos itens de código

- ✅ **[UX-47] A fileira de acessórios virou CARTÃO no celular** *(fechado 2026-08-24, medido no
  DOM)*. Era a única fileira do app que nunca virou: `1fr 60px 90px 32px` em TODA largura, com a
  conta fechando no talo a 375px (77 + 60 + 90 + 32 + 3 folgas de 8 = 283px = a largura da linha).
  Por isso ela era EXCEÇÃO à régua de 44px do dedo. Aplicada a receita do projeto (UX-38/UX-40), a
  mesma do `.machine-edit-row` que fechou o UX-44: cada campo ganhou invólucro com rótulo próprio
  (`.acc-field`/`.acc-label`), a `.acc-header` some no celular e a fileira quebra em 2 faixas
  (descrição + excluir em cima, os dois números embaixo). **A exceção morreu inteira, nos dois
  pedaços do range** — abaixo de 640 pelo cartão; de 641 a 760 alargando a TRILHA
  (`minmax(0,1fr) 96px 110px 44px`), porque ali sobra espaço e o certo é dar largura, não tirar
  tamanho do dedo. Medido a 375px: descrição **77 → 229px**, excluir **32 → 44×44** e agora DENTRO
  da linha (right 329 = a borda, contra 341 de antes), stepper **14 → 28px** com **67px** de folga
  para o número (eram 16 — o caso do `[micro]`), rolagem horizontal **0**. A 641 e a 700 a fileira
  segue em pé, com 44px de altura e o excluir de 44 dentro da linha. Desktop **inalterado**
  (`394px 60px 90px 32px`, altura 35, rótulos escondidos).
  ⚠ **A fronteira do cartão é 640, não os 760 do catálogo/recibo** — e isso foi medido antes de
  escolher: a 700px o cartão dava 554px à descrição e **272px a CADA campo de número**, com a
  fileira indo de 44 para 124px de altura. Largura de sobra virando rolagem não é a regra; o cartão
  entra onde a fileira realmente não cabe.
- ✅ **[UX-52] O rótulo passou a dizer as DUAS coisas** *(fechado 2026-08-24, escolha do dono: o
  rótulo, não o aviso)*. O seletor de origem agora lê **"Estoque de acabados (7 disp. · 3 nesta
  cor)"**. Os dois números sempre foram certos e mediam coisas diferentes — `partBalance` soma
  todas as cores (FEAT-11, de propósito) e o aviso vem do `consumeFifo`, que drena da cor ESCOLHIDA
  —, mas lado a lado a leitura era contraditória. Com o segundo número na tela a conta FECHA à
  vista: medido ao vivo no Chaveiro Charmander (Laranja 4 · Bege 3), com Bege escolhida e
  quantidade 7, o rótulo diz "7 disp. · 3 nesta cor" e o aviso "⚠ 4 além" — **7 − 3 = 4**.
  O parêntese só aparece quando os dois DIVERGEM (peça em mais de uma cor); com uma cor só eles
  coincidem e ele seria ruído. Conjunto multicor diz "nestas cores" e usa o **mínimo entre as
  partes**, a mesma conta do `assemblableWholes` — o que limita o conjunto é a parte mais escassa.
  **Nenhum cálculo mudou**: o `colorBalanceOf` só lê o que o seletor de cor já mostrava.
- 📌 **Ressalva medida: o `.icon-button.edit` do `/vendas` renderiza 39×44** dentro do
  `.recibo-head-side` (5px a menos na horizontal, contra 28×28 antes). O contêiner não estoura
  (`overflow: 0`) e `flex: none` não muda o número — a compressão não vem do flex-shrink. Não vale
  turno de investigação por 5px num botão que triplicou de área; fica registrado para não voltar
  como achado novo.
- 📌 **Ressalva: alvos a 1–4px da régua no celular.** Fora do escopo enxuto aprovado, porque todos
  são LARGOS (fáceis de acertar) e falham em um eixo só. **Atualizada pelo lote E da AUD-13
  (2026-08-24):** o `.icon-label-button` (43), o `.search-box-input` (36) e o `.stock-tab` (34)
  **saíram da lista — estão em 44**; os três que sobram são `.back-to-top` 42×42 e a navbar
  (`navbar-toggle` e `navbar-close`) 40×40, remedidos em todas as 7 rotas.

### Ressalva que FECHA (não é mais item)

- ~~**`filamentId` sem `trim`**~~ — **não é mais silencioso.** `"sc9LAy…ZLb "` (espaço no fim) não
  bate no `Set` e o parser acende `cor-inexistente` **nomeando o id com o espaço visível entre
  aspas**. Nada a fazer.

### Observação registrada (não é código)

- **O overdraft de −370 g na cor Bege continua exato, no banco de produção.** A tela mostra saldo
  total **243 g** com *"Rolo #5 em uso · 613 g restantes"* — ou seja, os rolos #1–#4 somam
  **−370 g**. Número idêntico ao reportado antes. A matemática está certa (o preço de repor lido é
  R$ 100,00/kg = rolo mais novo ✅); o furo é de **contagem física** e o remédio é o `adjustRoll`
  (D6), que grava o `beforeG` negativo como prova do tamanho do furo.

### ✅ O que está SÃO — medido, não presumido (64 verificações)

A lista longa, com os números, vive no relatório (link no topo desta seção). O resumo do que foi
**refeito à mão** e bateu dígito a dígito: `calculatePricing` componente a componente no cenário
40 g/3 h/A1 (material 4,4000 · energia 0,2280 · desgaste 2,1196 · manut 0,3600 · labor 7,5000 ·
reserva 0,45178 · total 15,05938 · **preço 29,71423**) · preço ponta a ponta de um produto escalar
(à mão 106,098145 = código 106,10) · FIFO misto (R$ 42,00) · overdraft D4 (R$ 134,40, shortfall
370 g) · gross-up (104,71204188) · `saleItemFinancials` nos 5 campos · custo fixo/hora
(1,5865384615). O round-trip documento→formulário→documento fecha **campo a campo** na 2ª volta
(`doc1 === doc2`, 24 chaves, com *stringify* canônico), e **0 `undefined`** chega ao payload (o
Firestore os rejeita — o client não liga `ignoreUndefinedProperties`). Contraste WCAG AA:
**0 falhas** em 7 rotas × 2 temas. PDF: travessão, aspas curvas, ‰, € e todo o acentuado intactos;
total R$ 1.390,26 = conta à mão. Importação real cancelada: **Catálogo (97) → Catálogo (97)**.
E o cache `calc3d-machines` confirma que `config/machines` em produção é **idêntico** aos
`DEFAULT_MACHINES` — o que valida todas as contas à mão acima contra o banco real.

### O que a AUD-12 NÃO cobriu

- ~~**Escrita real no Firestore**~~ — ✅ **FEITA em 2026-08-23, com aval do dono**, no conserto do
  [TD-022]: sonda de produto criada e apagada (catálogo 97 → 98 → 97) e a corrida encenada na cor
  Laranja. Banco restaurado aos números exatos; o único resíduo (2 lançamentos no rastro D6, que é
  append-only) está declarado no writeup. O plano abaixo é o que foi executado, com uma diferença:
  a corrida do estoque NÃO precisou de duas abas — dois cliques no mesmo tick do React reproduzem-na
  de forma determinística.
  **Plano, se for autorizado:** 1 produto sonda `__SONDA_VARREDURA__` criado pela importação (1 doc
  em `products`), aberto em **duas abas**, editado em campos diferentes nas duas, salvo em ordem
  invertida, e o documento relido campo a campo para provar ou refutar o **[TD-022]**. Backup em
  disco antes e depois; limpeza pelo id retornado no `addDoc`, com releitura confirmando
  `exists: false`. ⚠ No dump, o id do caminho vai **por último** e com nome `__id` — a armadilha do
  `{ id: doc.id, ...doc.data() }` da AUD-09 não se repete.
- ~~**Duas abas gravando o mesmo documento**~~ — ✅ **FEITO**: o [TD-022] deixou de ser leitura de
  código e virou experimento, com o defeito reproduzido e corrigido.
- **Offline de verdade** (rede caída, fila do Firestore, reconexão). Verifiquei a *guarda*
  (`guardOnline` antes do `await`, nos 5 pontos de escrita) por leitura. Continua sendo o resíduo do
  antigo [AUD-04].
- **Regras de segurança do Firestore** (usuário fora da lista) — exige uma segunda conta Google.
- **PDF contra a tela do `/orcamento` com dado real** — gerei e extraí um PDF sintético completo, com
  os números conferidos à mão. A ponte tela → `QuotePdfData` não foi exercitada.
- **Fluxo completo de venda e produção pela UI** (SaleFlow, submissão, estorno de recibo) — todo
  caminho grava. Matemática medida por harness, atomicidade por leitura.
- **Acima de 500 produtos** (onde o batch deixa de ser atômico). Testei 200 linhas no parser; a carga
  prevista é ~100.
- **Navegadores além do Chromium embutido**, e iOS Safari real.

## ✅ FECHADO — cluster da varredura AUD-13 (2026-08-24) — SISTEMA INTEIRO, 3ª passada

> 6ª varredura (a **v3** da geral), pedida pelo dono **imediatamente antes da carga em massa**, para
> quebrar o ciclo fechado da AUD-12 (mesmo agente escrevendo o conserto e o teste do conserto, 15
> itens no mesmo dia). Regra: **nada é verdade até ser reproduzido** — inclusive os `✅ FEITO` deste
> arquivo, os comentários do código, os nomes dos testes e **as duas listas da AUD-12** (15 defeitos
> corrigidos + 64 verificações sãs). Reportado **sem correção**: o dono decide os lotes.
>
> **Relatório com todas as medições:**
> <https://claude.ai/code/artifact/0eda95a1-d7d0-4a71-9c09-f5834953b6d4>
>
> **Método:** 10 arquivos de harness em vitest (previsão escrita ANTES, conta à mão em aritmética
> decimal depois; apagados no fim) · sonda no DOM medindo **7 rotas × 2 temas × 8 larguras**
> (375/430/700/759/761/800/841/1280), cada rota carregada num `<iframe>` de largura fixa · os 9
> modais · **escrita real no Firestore de produção** com aval do dono: 2 produtos-sonda criados pela
> importação, 2 produções, 1 venda editada e estornada, 1 orçamento com PDF · PDF lido do `Blob` pela
> tabela WinAnsi · offline com `navigator.onLine` forçado.
> `lint` ✅ · `build` ✅ · **672/672 em 4 execuções** ✅ (sem flake) · `git status` vazio.
>
> ⚠ **A varredura ACHOU O QUE PROCURAVA: a AUD-12 quebrou o `/producao`.** O `[TD-022]` (o item
> "fora de lote") deixou cada produto produzível **uma única vez**. Não foi pego porque o defeito só
> aparece na SEGUNDA produção, e ninguém produziu duas vezes o mesmo produto depois de 2026-08-23.
>
> ✅ **A limpeza do banco está LIBERADA desde o lote A (2026-08-24).** Ela tinha parado de propósito
> porque o próprio `[TD-026]` impedia excluir as 2 produções das sondas. Fechado o lote A, "Excluir e
> estornar" apaga os eventos E devolve os 50 g da cor Laranja (1353 → 1403) — é o dono quem roda,
> pela UI, e serve de conferência ao vivo do conserto. Balanço completo no fim da seção.
>
> ⚠ **Três falsos positivos MEUS, declarados:** (1) "a capacidade está 8% errada" — eu esqueci o
> `Math.floor` por conjunto de máquinas; (2) "o `buildProductPayload` corrompe o `includeFixed`" — eu
> chamei a função com a assinatura errada; (3) "o catálogo esconde as ações no celular" — a linha
> ABERTA entrega os 5 botões a 44×44, é o desenho declarado.
>
> ✅ **O que da AUD-12 SEGUROU** (refeito por fora): lotes A e B inteiros (`parseBool` nas 37
> grafias, `linha-sem-nome` vs `";;"`, markup, modal de máquinas a 375/641/700/760 sem corte) · lote
> C (`cor-sem-preco` nomeia certo os dois casos opostos; `isMilharAmbiguo` mudo sobre científica e
> aceso no milhar real; peça fracionária reprova) · `TD-024`/`TD-025` · no desktop o lote E entrega
> **0** alvos abaixo de 32px em `/catalogo`, `/vendas`, `/producao` e `/estoque`, e os resíduos
> declarados batem (`/catalogo` 19px e `/vendas` 81px em 23 recibos, a 761px).

### 🔴 Entra calado na carga, ou trava a operação

- ✅ **[TD-026] FEITO (lote A, 2026-08-24).** Os TRÊS construtores de payload do acabado passaram a
  chamar um só — `finishedGoodToPayload` —, e o `addProductionLayers` devolve o doc com `rev`. Um dos
  três (o `toPayload` do `saleReconciliation`) já estava certo, e é por isso que a venda escapava: a
  correção foi unificar, não remendar dois. ⚠ O teste é o
  `src/lib/firebase/productionRevRoundTrip.test.ts` — **não é unitário**, como a AUD-13 exigiu:
  Firestore falso em memória + o repositório e os serializadores de verdade nos dois sentidos,
  cobrindo 2ª/3ª produção, "Excluir e estornar" com a cor voltando a 1403 g, produzir depois de
  excluir, e o contraponto (versão velha CONTINUA sendo recusada). Revertido o conserto, 4 dos 5
  falham com a frase literal de produção. Writeup no [`HISTORICO.md`](HISTORICO.md).
  ⚠ **Isto ABRE o `[TD-028]`** (lote C) — leia a ordem obrigatória lá.
  ⚠ **As 2 sondas `ZZ AUDIT` já podem ser limpas pela UI** (nenhuma foi vendida, então não passam
  pelo caminho do TD-028). Descrição original: **cada produto podia ser produzido para o estoque UMA
  ÚNICA VEZ — depois o `/producao` recusava para sempre**, com mensagem FALSA de concorrência,
  porque os dois construtores montavam o payload sem copiar o `rev` e a versão esperada era sempre 0.

- ✅ **[CSV-32] FEITO (lote B, 2026-08-24), em duas metades.** (1) **Reconhecer** — o fallback
  varre os ids explícitos da lista INTEIRA antes de gerar qualquer `sub_<n>` e só usa o que estiver
  livre; o acidente clássico (id explícito + id ausente na mesma lista) morre aí, sem aviso, porque
  não há nada que o dono precise corrigir na planilha. (2) **Avisar** — id explícito REPETIDO é
  outra coisa: o segundo recebe um id livre (a peça não some) e a classe nova `subitem-id-repetido`
  NOMEIA os dois subitens, dizendo também que acessório atribuído àquele id ficou com o PRIMEIRO.
  ⚠ O id do formulário (`sub_<timestamp>_<i>`, em `usePricingForm`) nunca colidiu — o defeito era
  só do parser. Descrição original: **Id de subitem repetido entra calado na carga e come um quarto
  do custo congelado.**
  **Mecanismo:** `parseSubitems` dá ao subitem sem id o nome `sub_<índice>`. Um id explícito `sub_1`
  em qualquer posição + um subitem SEM id na posição 1 → os dois viram `sub_1`. Ninguém precisa
  repetir id: basta misturar id explícito com id ausente, o acidente clássico de planilha gerada
  fora. `validateProduct` passa, o preço fica certo, o diálogo da importação mostra **0 avisos**.
  **Medido ao vivo, com dinheiro:** produção de custo **R$ 15,75** creditou **R$ 11,69** no acabado —
  **R$ 4,06 (25,8%) sumiram** e a SKU "Tampa" nunca existiu. O seletor do `/producao` lista **duas
  opções com o MESMO `value`** (`sub:…:sub_1` para "Corpo" e para "Tampa" — escolher Tampa produz
  Corpo) e o seletor de acabados da venda oferece **a mesma peça física três vezes** ("inteiro",
  "Corpo" e "Tampa", 1 em estoque cada). A tela ainda anuncia "2 subitens · 1 conjunto completo".
  **Onde:** `productCsv.ts:646`; o dano se materializa em `finishedGoods.ts:308` (ver `[TD-027]`).
  **Saída:** duas metades, como no CSV-23. **Reconhecer:** o fallback só usa `sub_<índice>` se o id
  estiver livre na lista inteira (varre os explícitos primeiro). **Avisar:** classe nova
  `subitem-id-repetido` nomeando os dois subitens — sem ela, planilha que repita id de propósito
  segue entrando calada.

### 🟠 Alto (não bloqueia a carga, mas morde)

- ✅ **[TD-027] FEITO (lote B, 2026-08-24).** As duas perguntas se separaram: a idempotência por
  evento se decide UMA vez por chamada, contra o doc que CHEGOU (SKU que já traz camada com aquele
  `sourceEventId` é replay e se ignora inteira), e entrada repetida DENTRO da chamada **soma** —
  `qty` acumula na mesma camada e o `unitCost` vira a média ponderada, para `qty × unitCost` seguir
  sendo o custo submetido. Uma camada só, com o id determinístico intacto: duplicar o id quebraria
  `removeEventLayers` e `shiftLayers`. O `costBreakdown` funde junto (`sumFrozen === unitCost` de
  graça) e só sobrevive se TODAS as entradas o trouxerem — meia composição mentiria sobre o total.
  Descrição original: **A idempotência do `[TD-023]` engole entrada legítima DENTRO da mesma chamada.**
  `if (existing.layers.some((l) => l.id === layer.id)) continue;` — a `layerId` é *evento + SKU*, e o
  `continue` não distingue "reaplicaram o mesmo evento" de "esta chamada trouxe duas entradas para a
  mesma SKU". A segunda é descartada em silêncio, com a fatia de custo dela.
  **Medido:** 2 entries da mesma SKU (2 un a R$ 30 cada) → saldo **2** em 1 camada e valor **R$ 60**,
  quando a submissão custou R$ 120. E reaplicar o mesmo `eventId` com quantidade DIFERENTE (6 un,
  custo 300) sobre uma camada de 2/R$ 100 não muda nada.
  Hoje só alcançável pelo `[CSV-32]`; fechado o CSV-32 vira latente — mas continua sendo um
  `continue` que descarta dado sem contar. **Onde:** `finishedGoods.ts:308`.
  **Saída:** separar as duas perguntas — idempotência por evento se resolve UMA vez por chamada (a
  SKU já tem camada com aquele `sourceEventId`?); entradas duplicadas na mesma chamada **somam**.

- ✅ **[TD-028] FEITO (lote C, 2026-08-24) — BARRAR (escolha do dono).** O `/producao` passou a ler
  o histórico de vendas e a chamar o `finishedEventReferences` novo (`finishedGoods.ts`, espelho
  exato do `filamentReferences`): recibo vivo em cima das camadas do evento **recusa** a exclusão
  nomeando quem segura ("24/08/2026 · Maria") e quantas peças já saíram. E o `shiftLayers` deixou de
  ser mudo — move deste produto cujo `layerId` não existe mais **lança** com a frase de estoque
  inconsistente, em vez de devolver o doc intacto. O `delta === undefined` no lugar do `!delta`
  entrou junto: delta 0 é camada ACHADA, e o `!delta` a acusaria de órfã. **14 testes novos;
  revertido o `shiftLayers`, os 3 do cenário medido falham** (os outros 11 cobrem a função nova).
  O comentário mentiroso do `removeEventLayers` foi reescrito no lugar. Descrição original:
  **Excluir uma produção já vendida apaga a camada — e o estorno do recibo devolve NADA.**
  `finishedForRemove` chamava `removeEventLayers` sem perguntar se alguma camada do evento já foi
  drenada por venda. A camada some; a venda continua guardando um `FinishedMove` apontando para ela;
  no estorno o `shiftLayers` procura pelo id, não acha e devolve o doc intacto — sem erro, sem aviso.
  **Medido (harness):** produzir 10 un/R$ 100 → vender 4 (saldo 6, valor 60, COGS 40) → excluir a
  produção (**0 camadas**, valor 0) → estornar o recibo → **0 un devolvidas**, quando deveriam voltar
  4 un / R$ 40.
  ⚠ De quebra, o comentário do `removeEventLayers` afirma que manter a SKU vazia serve para que *"o
  custo já vendido não some do rastro"* — **medido, some** (valor 60 → 0). Mesma classe que o próprio
  TD-023 levantou, do outro lado do arquivo.
  ⚠ **ORDEM OBRIGATÓRIA:** hoje este defeito está **mascarado pelo `[TD-026]`** (nenhuma produção que
  creditou acabado pode ser excluída). Consertar o TD-026 sem consertar este **abre** o caminho.
  **Onde:** `ProductionPage.tsx:424-441` e `:508-541` (o diálogo de confirmação não menciona venda) ·
  `finishedGoods.ts:336-354` e `:507-533`.
  **Saída (decisão do dono):** **(a) barrar** — camada com `qty` menor que a original faz a exclusão
  recusar nomeando o recibo, a disciplina que a exclusão de cor já usa (`filamentReferences`); ou
  **(b) preservar** a camada drenada e remover só o saldo não vendido, o que faz o comentário virar
  verdade. Nos dois casos, o `shiftLayers` precisa CONTAR o move que não achou camada.

### 🟡 Médio

- ✅ **[UX-48] FEITO (lote B, 2026-08-24).** O `machineNameToId` casa pelo **id exato** antes de
  qualquer palpite — id inteiro é identidade, e devolve sem chamar o `onFuzzy`. A comparação de NOME
  passou a colapsar espaços nos dois lados, então `A1  Combo` também deixa de ser palpite. Medido no
  teste: `a1`, `A1`, `x2d`, `X2D`, ` A1 `, `A1  Combo` e **100 linhas com `Maquina = A1`** → **0**
  em `maquina-por-aproximacao`; o palpite de verdade (`AnyCubic A1 Mini`, id DENTRO de um nome maior)
  continua avisando, como o CSV-24 quis. Descrição original: **O aviso `maquina-por-aproximacao`
  acende em 100% das linhas de uma planilha CERTA.**
  O `machineNameToId` só casa por NOME exato antes de partir para o palpite por substring — e o valor
  mais preciso que a planilha pode trazer é o **id** da máquina.
  **Medido:** `A1`, `a1`, `x2d`, `X2D`, `A1  Combo` (espaço duplo) e `combo a1` **todos avisam**,
  todos resolvendo certo. Em escala: **100 linhas com `Maquina = A1` → `maquina-por-aproximacao =
  100`**. O dono vê que 100% das linhas "foram adivinhadas" e ou desiste da carga ou aprende a
  ignorar o aviso — o defeito que o lote C inteiro existiu para evitar.
  **Onde:** `productCsv.ts:696-703`. **Saída:** tentar `machine.id === normalizado` antes do
  `filter/sort` — id inteiro é identidade, não palpite, e devolve sem chamar o `onFuzzy`. O espaço
  duplo se resolve normalizando espaços nos dois lados da comparação de nome.

- ✅ **[TD-029] FEITO (lote D, 2026-08-24).** Os três ganharam o `guardOnline` **antes do
  `await`**, cada um no molde que o chamador comporta: `saveFixedCostRate` expõe `error` e NÃO lança
  (é a cada tecla — molde do `saveFees`), e o `FixedCostsPanel` recebeu a linha `.form-error`;
  `saveBusiness` DEVOLVE a mensagem (molde do `saveMachines`), e os 4 `onBlur` da `/orcamento`
  pararam de engolir a falha; `addQuote`/`deleteQuote` **lançam**, porque os dois chamadores já
  esperam dentro de um `try` que reporta pelo `FeedbackNote`. O `reserveQuoteNumber` **já estava
  guardado** — por uma 5ª cópia inline do `navigator.onLine`, com frase própria e legítima (lá o
  motivo é o número no servidor). O que virou dedupe: `isOffline()` + `OFFLINE_MESSAGE` no
  `errors.ts`, e as cópias da `QuotePage` e do `SaleModal` passaram a usá-los.
  ⚠ **A repro escrita no item mirava o campo ERRADO** (registrado no `HISTORICO.md`): "Dias de
  impressão/mês" é o `CapacityPanel`, simulação local por desenho (TD-010) — a tela até diz
  *"Simulando — os valores salvos do negócio não mudaram"*. O defeito era real, mas mora nos campos
  do **painel de custos fixos**. **Medido ao vivo** com `navigator.onLine = false`: Aluguel
  1500 → 1501 agora acende a frase do offline no painel (antes: 0 avisos); "Dados do negócio não
  foram salvos: …" ao sair do campo Telefone; e "Excluir orçamento" offline devolve erro nomeando o
  nº **e não exclui** (21 → 21 orçamentos). Online, os três voltam a gravar em silêncio.
  Descrição original: **Três caminhos de escrita ficaram sem `guardOnline`.**
  O `[TD-020]` fechou máquinas e taxas. Restaram: `useBusinessSettings.saveFixedCostRate`
  (`hooks/useBusinessSettings.ts:51-57`, `void persistFixedCostRate`, fire-and-forget — e `:38`, a
  semeadura) · `useQuoteConfig.saveBusiness` (`:28-31`) · `useQuotes.addQuote/deleteQuote` (`:31-37`)
  + `reserveQuoteNumber` (`QuotePage.tsx:261`, que é `runTransaction`: offline a Promise não resolve
  nem rejeita e o botão fica em "gerando" para sempre).
  **Medido ao vivo com `navigator.onLine = false`:** `/producao` **bloqueia** com a frase certa
  (eventos 58→58); mudar "Dias de impressão/mês" 26→27 na calculadora — que é `config/negocio` e
  alimenta o custo fixo por hora do **catálogo inteiro** — muda na tela, **0 avisos**, e o badge segue
  dizendo **"Sincronizado"**. **Saída:** `guardOnline()` ANTES do `await` nos três; em
  `saveFixedCostRate`, que é chamada a cada tecla, o molde é o `saveFees` (expõe `error`, não lança).

- ✅ **[UX-49] FEITO (lote D, 2026-08-24).** No `@media (max-width: 760px)` o `.modal-close` vai a
  **44×44** com `margin: calc(-1 * var(--space-6))` — os 12px de crescimento voltam ao fluxo
  (receita UX-28/UX-37). ⚠ `padding` sozinho não cresceria nada: o `box-sizing` é `border-box` e a
  classe fixa `width`/`height`. **Medido a 375px**, no mesmo diálogo, antes e depois: 32×32 → 44×44,
  cabeçalho **84px nos dois**, título e ✕ **no mesmo lugar** (24px e 40px do topo do
  `.modal-head`, idênticos); o ponto a 3px do canto superior-direito do alvo novo — **fora** dos
  32×32 antigos — dá `elementFromPoint` = `BUTTON.modal-close` e fecha o diálogo. No desktop
  (1280px) segue **32×32, margem 0**. Descrição original: **o ✕ mede 32×32 no celular — e no
  celular não há Escape.**
  `.modal-close` tem largura/altura fixas em `var(--space-32)` e nenhum override em media query. O
  UX-46 levou o `.icon-button` a 44px no celular, mas o fechar do diálogo é classe própria e ficou de
  fora. **Medido** no modal de máquinas a 375px: **32×32**. Vale para os nove (a casca é uma só). As
  alternativas que o `<Modal>` oferece — Escape e clique no overlay — não existem num toque de dedo.
  **Onde:** `modal.css:48-51`. **Saída:** `padding` + margem negativa igual (UX-28/UX-37) dentro do
  `@media (max-width: 760px)`, para o alvo crescer sem empurrar o cabeçalho do diálogo.

### 🟢 Baixo / informativo — ✅ OS 11 FECHADOS (lote E, 2026-08-24)

> Um deles fechou como **falso positivo declarado** (o `[A11Y-02]`), com o porquê medido. Writeup
> completo dos 11 no [`HISTORICO.md`](HISTORICO.md); aqui fica só o veredito de cada um.

- ✅ **[UX-50] FEITO (lote E).** Todos subiram para 44 no `@media (max-width: 760px)`, pela receita
  UX-28/UX-37, e o custo foi medido rota a rota: `/` **+27px**, `/estoque` +18, `/vendas` +12,
  `/producao` +12, `/orcamento` +10, `/catalogo` +8 e `/maquinas` **0**. **Nada mexeu em
  `font-size`** — o `[micro]` recusou o `.btn` maior pela FONTE em cascata, e altura de alvo é outra
  conta. Entraram também os que a varredura não viu porque mediu outra rota (`.catalog-actions
  select` e `.search-box-input` 36, as 3 abas do `/estoque` 34, o `summary` do payback 36 e a família
  inteira de campos que não é `.field-input`, incluindo as duas fileiras de trilha fixa — a exceção
  delas é de LARGURA, e foi remedida: o excluir da `.accessory-row` continua terminando em 329px
  dentro de uma linha que vai até 329). Desktop remedido a 1280: **inalterado**. Descrição original:
  **Controles 9–12px abaixo da régua no celular, fora da ressalva de "1–4px" da AUD-12:**
  `select` do Arredondamento 178×**32** · `.link-button` ×**32** (3 em `/`, 2 em `/estoque`) · `.btn`
  e `.icon-label-button` ×**34** · inputs do `.ci-item` ×**35** · `summary` ×27 · `.brand-reset` ×20.

- ✅ **[UX-51] FEITO (lote E) — subiu o CAMPO, não a seta.** A justificativa escrita era falsa
  (`.field-input` = 42, `.ci-item` = 35): agora os dois vão a 44 no celular e a frase fica de pé, com
  a seta em 21px de altura como ATALHO de um alvo que existe. O comentário do `forms.css` foi
  reescrito com a medição no lugar. Descrição original: **O stepper cresceu só na horizontal, e a
  justificativa escrita não se sustenta.** Cada seta mede **28×19,5** no celular (o UX-46 mediu a
  largura). ⚠ Subir a altura da seta mexe na altura do campo, que é a trava do `[micro]` de 14px.

- ⚠ **[A11Y-02] FALSO POSITIVO (lote E) — nada a corrigir.** Os botões não têm nome porque o
  `<span class="num-spin">` que os envolve tem `aria-hidden="true"`: pela especificação a subárvore
  inteira sai da árvore de acessibilidade, e a sonda da varredura leu **elemento a elemento**. Dar
  `aria-label` (tirando o `aria-hidden` do pai) poria **40 paradas novas** no leitor de tela, que é o
  que o comentário do `NumberInput` já recusava. A régua A11Y-01 vale para botão que ESTÁ na árvore.
  Descrição original: **Botão só-ícone sem nome acessível**: **20** em `/` e **4** em `/orcamento`.

- ✅ **[TD-030] FEITO (lote E) — saiu o código morto INTEIRO.** `deleteGood`, `saveGood` e os dois do
  repositório (`saveFinishedGood`/`removeFinishedGood`) nunca tiveram chamador; o hook virou leitura
  pura. Quem escreve no acabado é sempre o `writeBatch` de outra coleção — atalho por fora seria a
  porta para o saldo descolar do rastro. ⚠ **Consequência declarada:** doc de acabado com saldo 0
  fica na coleção, invisível (inclusive os 2 das sondas da AUD-13), e **não há caminho de UI para
  apagá-lo** — é o retrato certo do que aconteceu.

- ✅ **[TD-031] FEITO (lote E).** `.sales-table`/`.sales-table-wrap` (~45 linhas) apagadas: eram a
  tabela de antes de o histórico virar lista de recibos, e o `min-width: 760px` delas é o oposto da
  regra de hoje (fileira que não cabe vira CARTÃO).

- ✅ **[CSV-33] FEITO (lote E).** Classe nova `pecas-invalida`: `"0"` e `"-1"` entram como 1 **e
  contam a linha**, citando a célula crua. Ausente/vazia seguem caladas, ilegível continua só com a
  classe do CSV-09 e a fracionária > 1 segue com o dono dela (o `validateProduct`, CSV-31).

- ✅ **[CSV-34] FEITO (lote E).** O rótulo passou a ler uma cópia creditada
  (`reverseFinishedConsumption`, o mesmo estorno da gravação, sem gravar nada) — a mesma prateleira
  que o aviso do UX-42 já usava; o seletor de cor foi junto. ⚠ O `oldRecibo` teve de subir para o
  topo do componente: o `stockItems` o lê durante o render.

- ✅ **[CSV-35] FEITO (lote E).** A sobra vira "coluna repetida" quando é o próprio needle ou uma
  ABREVIAÇÃO do nome canônico (`"peso"` dentro de `"peso (g)"`). ⚠ Reusar o `includes(needle)` da
  passada por pedaço quebrou o teste do AUD-11/D-3 — `"Tempo de cura (h)"` não é repetição, é outra
  coluna, e continua em "nome não reconhecido".

- ✅ **[CSV-36] FEITO (lote E).** As duas frases do portão flexionam. Os outros plurais fixos do app
  foram conferidos e estão certos (só aparecem com contagem > 1).

- ✅ **[TD-032] FEITO (lote E).** `MAX_FEE_PCT = 95` num lugar só, exportado do `paymentFees`, e o
  editor clampa a ENTRADA nele (mais `max` nos 5 campos). O ×20 continua sendo a conta certa de uma
  taxa de 95% — o defeito era chegar nele digitando 100 e a tela guardar um número que a conta não
  usava.

- ✅ **[CSV-37] FEITO (lote E).** A trava é uma linha no `parseDecimalPtBr`: **letra ENTRE dígitos →
  `null`**. A culpa não era do `replace` do markup (ancorado no fim), era da limpeza que apaga e
  COLA. `"5x"`, `"X5"` e `"5 x"` seguem valendo 5; `"2h30"` deixa de virar 230 em qualquer coluna.

### Ordem dos lotes AUD-13 — ✅ OS CINCO FECHADOS (2026-08-24)

| Lote | Itens | Por que esses | Custo / risco |
|---|---|---|---|
| ~~**A — destravar a produção**~~ ✅ **FEITO (2026-08-24)** | ~~[TD-026]~~ | Era o único que deixava o app **inoperante**. O aviso do custo se confirmou: o conserto foi de 3 linhas, o teste é que exigiu montar o ciclo inteiro | — |
| ~~**B — o que entra calado na carga**~~ ✅ **FEITO (2026-08-24)** | ~~[CSV-32] · [TD-027] · [UX-48]~~ | O diagnóstico se confirmou: consertar só o parser deixaria a bomba armada no `finishedGoods` — os dois foram no mesmo commit, com 20 testes novos (14 falham contra o código velho; os 6 restantes são os contrapontos) | — |
| ~~**C — o estorno que fica mudo**~~ ✅ **FEITO (2026-08-24)** | ~~[TD-028]~~ | O dono martelou **barrar**. O custo bateu com o previsto (baixo): o guarda é uma função pura de 30 linhas + 5 linhas no `remove` — o que cresceu foi o teste, como no lote A | — |
| ~~**D — offline e o dedo no diálogo**~~ ✅ **FEITO (2026-08-24)** | ~~[TD-029] · [UX-49]~~ | Confirmado: nenhum tocou lógica de negócio e os dois se verificaram na mesma sessão. A ressalva da cascata do `@media` se pagou ao contrário — a ordem estava certa (`responsive.css` vem depois), o que enganou foi o CSS **em cache no navegador**: só depois do reload o 44 apareceu | — |
| ~~**E — a poeira**~~ ✅ **FEITO (2026-08-24)** | ~~os 11 🟢~~ | Foi numa sessão só, não duas: o parser e o CSS não se cruzam, então o custo real foi a MEDIÇÃO (7 rotas × 375px, antes e depois) e não o código. Um item fechou como falso positivo declarado (`A11Y-02`) e 5 alvos que a varredura não tinha visto entraram de carona | — |

**O que eu deixaria de FORA de propósito (ressalva registrada, não item):** os alvos a 1–4px da
régua e o `.icon-button.edit` **38,6×44** do `/vendas` (reconfirmados, 23 ocorrências — uma por
recibo) · o **overdraft de −370 g na cor Bege** (remedido idêntico: saldo 243 g com o rolo #5 em
613 g; é furo de contagem física) · o **[UX-47]** (confirmado ao pixel, mas já é item aberto:
`77px 60px 90px 32px` + 3 folgas de 8 = **283px** = exatamente a largura da linha a 375px) · e
**acima de 500 produtos** (o `createProductsBatch` fatia em lotes de 500 e o erro já informa quantos
entraram; li, não medi — provar exigiria criar 500+ documentos).

### ✅ O que está SÃO — medido, não presumido

A lista longa, com os números, vive no relatório (link no topo desta seção). O resumo:
**matemática refeita à mão num cenário NOVO** (2 etapas em máquinas diferentes, 3 peças, falha 7%,
markup 2,4×, acessório, fixo ligado, arredondamento `0.90`) — os 11 componentes batem com divergência
máxima de **4,9×10⁻¹¹**: material 6,7695 · energia 0,2434166667 · desgaste 3,0941888889 · manut 0,35
· labor 8,1666666667 · reserva 1,4017893070 · fixo 3,0408653846 · total **30,5664269139** · exato
**56,8083062448** · arredondado 56,90. Os 7 modos de arredondamento, FIFO misto (R$ 19,60 = 120×0,090
+ 80×0,110) e overdraft D4 (R$ 85,60, shortfall 380 g) conferidos à mão · **estorno de filamento
exato nas 5 quantidades**, e o rolo não é apagável pela UI, então o caminho do move órfão **não
existe** do lado do filamento (ao contrário do acabado) · gross-up e margem líquida · **rateio de
desconto: 20.000 sorteios, 0 falhas** nas duas invariantes · capacidade pelo gargalo com `floor` por
conjunto (**641** peças/mês) · `marginTier` na régua do número arredondado (49,4 ruim / 49,5 ok /
65,4 ok / 80 bom) · **round-trip documento→formulário→documento** fecha campo a campo (`doc1 ===
doc2`, 24 chaves, 0 `undefined`) e **CSV export→parse→export dá arquivo IDÊNTICO com 0 avisos**,
preservando `filamentId`/`supplyId`/`subitemId` · **600 linhas em 11,3 ms com 600 `createdAt`
distintos** (o CSV-15 segura em escala) · **contraste WCAG AA: 0 falhas** em 7 rotas × 2 temas ·
rolagem lateral 0 a 375/430/700px · o catálogo no celular entrega os **5 botões a 44×44** com
`aria-label` na linha aberta · **venda ao vivo exata** (+18,41 receita, +11,69 custo, +6,72 lucro) e
os **KPIs do `/vendas` atualizaram sem recarregar** (o `[TD-019]` verificado ao vivo pela 1ª vez) ·
**UX-42 ao vivo**: qtd 1 não avisa, 2 avisa "1 além", 3 avisa "2 além" · **estorno de recibo ida e
volta ao centavo** (acabado −1 e de volta a 0, contador de saldo negativo 1→2→1) · **PDF do
`/orcamento` com dado real** (o buraco da AUD-12): 8.157 bytes, `/Encoding /WinAnsiEncoding`, **19
strings e nenhuma em UTF-16**, travessão/aspas curvas/`·`/`½`/`‰` intactos, `‐` (U+2010) rebaixado
sozinho sem arrastar a linha, total R$ 18,41 = a tela.

### O que a AUD-13 NÃO cobriu

- **Dump documento a documento do Firestore.** Eu ia ler o token de sessão para consultar a REST API
  e o **classificador de segurança bloqueou a chamada** — corretamente, porque ler token de
  autenticação do IndexedDB é indistinguível de exfiltração. Não retentei por outro caminho: o
  retrato do banco saiu **pela própria UI** (contadores, saldos, extratos, rolos e lotes abertos um a
  um). Isso prova os NÚMEROS, não a forma dos documentos — um campo que mudasse sem mover saldo
  passaria batido.
- **Offline com a rede realmente caída** (fila do Firestore, Promise pendente, reconexão). Forcei
  `navigator.onLine`, que é o que o `guardOnline` lê — e é por isso que o contraste guardado × não
  guardado ficou nítido. Resíduo do antigo `[AUD-04]`, agora pela **quarta** varredura.
- ~~**O caminho da camada órfã na UI**~~ ✅ **RODADO ao vivo no lote C (2026-08-24)**, no banco real
  e no cenário que já estava armado (a venda de R$ 18,41 drenava a camada da produção
  `ZZ AUDIT sonda D1`). Ida e volta inteira: excluir a produção **recusou** nomeando o recibo →
  a produção NÃO vendida (`sonda REV`) abriu o diálogo normal e excluiu, devolvendo os 10 g
  (Laranja 1353 → 1363) → apagar a venda estornou ao centavo (48→47 itens, −18,41 receita,
  −11,69 custo, −6,72 lucro) e o `shiftLayers` **achou** a camada, porque o guarda impediu que ela
  fosse apagada → aí a `sonda D1` LIBEROU e excluiu (Laranja 1363 → **1403 g**). Não sobrou item da
  AUD-13 sem prova ao vivo.
- **Regras de segurança do Firestore** (exige 2ª conta Google) · **acima de 500 produtos** contra o
  banco · **duas abas gravando ao mesmo tempo** (a AUD-12 já fez; aqui o guarda `rev` foi exercitado
  e foi ele que denunciou o TD-026) · **Excel/Google Sheets de verdade** e o diálogo de arquivo do SO
  · **navegadores fora do Chromium embutido** e iOS Safari real · **importação/exportação de vendas,
  filtros e paginação do histórico**, e o `/maquinas` além da leitura.

### Balanço do banco — 7 documentos criados, ✅ LIMPEZA FEITA no lote C (2026-08-24)

> A limpeza rodou pela UI durante a prova ao vivo do `[TD-028]` e serviu de conferência: `products`
> **99 → 97** · `producao` **59 → 57** · `vendas` **48 → 47** · `estoque` Laranja **1353 → 1403 g**,
> exatamente os 50 g previstos. Sobraram só os **2 docs de `acabados`** (saldo 0, invisíveis na
> tela): é o `[TD-030]` — não existe caminho de UI para apagá-los, e o `deleteGood` é código morto.
> A tabela abaixo é o retrato de quando as sondas foram criadas.

| Coleção | Antes | Depois | O quê | Sai pela UI? |
|---|---|---|---|---|
| `products` | 97 | **99** | `ZZ AUDIT sonda D1` = `4I1pyH6F9fcWV2OpJpq9` · `ZZ AUDIT sonda REV` = `KGFRWOheghVBdEUzVVEV` | sim |
| `producao` | 56 | **58** | 2 eventos "ZZ AUDIT", 24/08/2026 | ✅ **sim, desde o lote A** |
| `acabados` | — | **+2** | id = o id do produto (os dois acima) | não existe caminho (TD-030) |
| `vendas` | 47 · R$ 2.620,70 | **48** · R$ 2.639,11 | 1 recibo de R$ 18,41 | sim |
| `orcamentos` | — | **+1** | Nº 0021 (contador 21 → 22, liberado pelo dono) | sim |
| `estoque` Laranja | 1403 g | **1353 g** | −40 g e −10 g das 2 produções | ✅ volta ao excluir as 2 produções |

Tudo o mais bate com o retrato inicial: **Bege 243 g / 5 rolos · Argola 198 un · Clicker Azul 108 un
· `config/machines` intacto**. A alteração offline em `config/negocio` foi desfeita ainda offline e o
doc terminou com o valor original (26 dias). **Nenhum lançamento novo no rastro D6.**

## Fechado

Nada aqui. Todo item concluído — com writeup e medições — vive no
[`.claude/HISTORICO.md`](HISTORICO.md): as seções `## ✅` (uma por item/cluster) e o bloco
**"📒 Arquivo do BACKLOG"** no fim, que recebeu o registro curto que vivia nesta fila até a faxina
de 2026-08-16.
