# LopoLabCalc — Backlog (a fazer)

> **Roadmap dos itens ABERTOS + ordem de prioridade.** Curto de propósito — é o que se lê pra
> escolher/rever a próxima tarefa (não precisa do histórico pesado pra isso).
> O *porquê* / detalhe de design (D1–D8, auditoria, writeups do que já foi feito) vive em
> [`.claude/HISTORICO.md`](HISTORICO.md) — abra sob demanda ao pegar o item.
> A foto do AGORA + a próxima tarefa sugerida vivem no `CLAUDE.md`.
>
> **Tier 0, Tier 1, Tier 4, o 7e, o cluster UI/UX de 2026-08-15, as ondas 0–5 e o `[micro]` do
> botão de 14px (2026-08-17) ✅ FECHADOS.** O
> registro deles (com as medições) vive no `HISTORICO.md` — seção "📒 Arquivo do BACKLOG" e os
> writeups das ondas 1 a 5. **Este arquivo só tem o que está ABERTO.**
>
> ⚠ **A fila de ondas acabou em 2026-08-17** e a **auditoria de layout responsivo do mesmo dia**, que
> tinha reaberto o backlog, **também FECHOU em 2026-08-18** (UX-38 + UX-40 + A11Y-01 na última
> rodada). **Não há mais item de código escolhível:** o que sobra está acoplado ao rebrand
> (**DEC-05** + **G2**) ou bloqueado por dado externo (**FEAT-03**, **branding/logo**, **Dashboard**).
> → **A próxima decisão é do dono**, não uma tarefa a pegar: destravar o rebrand (a logo) ou abrir
> uma frente nova.

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
| **3** | [UX-43] · [TD-020] | ▶ próximo |

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
> [`HISTORICO.md`](HISTORICO.md). **10 defeitos, nenhum corrigido ainda** — a varredura tinha regra
> de só reportar.
>
> ⚠ **O [CSV-06] BLOQUEIA a carga em massa.** Os outros não.

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

- **[UX-43] O PDF do orçamento come o travessão e as aspas curvas.** Medido no PDF real:
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
- **[TD-020] Máquinas e taxas gravam sem `guardOnline`.** `useMachines.ts:87`
  (`void persistMachines(...)`, fire-and-forget, sem tratar erro) e `useFees.saveFees`. Offline a UI
  mostra o valor novo (estado local + localStorage) e a escrita fica enfileirada — "finge que
  salvou". **Verificado só no código** (escrever em `config/machines` estava fora do combinado).

### Observação registrada (não é defeito — decisão do dono)

- A produção com desfecho **falha** também dá baixa do insumo (medido: 4 unidades). Se o ímã só é
  montado depois da impressão boa, a falha não deveria consumi-lo. A tela declara isso antes de
  registrar, então é escolha, não silêncio.

### O que a AUD-07 NÃO cobriu

- **[AUD-08] Insumo da próxima varredura.** Escrita de 100 produtos de verdade (medi o parse — 16 ms
  — e li que o `writeBatch` é atômico até 500, mas não gravei); **edição de máquina** recalculando o
  catálogo (escreve no doc compartilhado); **offline real** (só simulei `navigator.onLine`);
  round-trip do form via CSV **não cobre** `createdAt` nem os 3 nulos legados; só **um**
  produto-cobaia (faltou produto sem subitens vendendo acabado, multicolor com cor por etapa —
  SKU composta — e `piecesCount` > 2); importação/exportação de **vendas**, filtros e paginação do
  histórico, `/maquinas` além da leitura, tema claro; **concorrência** (duas abas gravando o mesmo
  recibo); e o **saldo negativo pré-existente** no banco (contador "SALDO NEGATIVO 1"), cuja origem
  não investiguei.

## Fechado

Nada aqui. Todo item concluído — com writeup e medições — vive no
[`.claude/HISTORICO.md`](HISTORICO.md): as seções `## ✅` (uma por item/cluster) e o bloco
**"📒 Arquivo do BACKLOG"** no fim, que recebeu o registro curto que vivia nesta fila até a faxina
de 2026-08-16.
