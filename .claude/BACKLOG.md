# LopoLabCalc — Backlog (a fazer)

> **Roadmap dos itens ABERTOS + ordem de prioridade.** Curto de propósito — é o que se lê pra
> escolher/rever a próxima tarefa (não precisa do histórico pesado pra isso).
> O *porquê* / detalhe de design (D1–D8, auditoria, writeups do que já foi feito) vive em
> [`.claude/HISTORICO.md`](HISTORICO.md) — abra sob demanda ao pegar o item.
> A foto do AGORA + a próxima tarefa sugerida vivem no `CLAUDE.md`.
>
> ⚠ **LEIA ISTO ANTES DO RESTO — o backlog de código NÃO está mais zerado (2026-08-23).** Vários
> parágrafos abaixo dizem "está ZERADO"; eles descrevem o estado **antes** da varredura **AUD-12**
> (a v2 da geral — a seção dela é a **última** deste arquivo, logo acima de "## Fechado").
> Ela abriu **17 itens** — o cabeçalho dizia 15, e a conta estava errada: o rótulo "4 🟡" vinha
> seguido de **cinco** nomes. São 5 🔴 (`[CSV-23]` `[CSV-24]` `[UX-44]` `[CSV-25]` `[CSV-26]`),
> 2 🟠 (`[TD-022]` `[UX-46]`), **5** 🟡 (`[UX-45]` `[TD-023]` `[CSV-27]` `[CSV-28]` `[CSV-29]`) e
> 5 🟢 (`[CSV-31]` `[TD-021]` `[TD-024]` `[TD-025]` `[CSV-30]`).
>
> ✅ **Os 5 🔴 fecharam nos lotes A e B, e o `[TD-022]` fechou junto (2026-08-23)** — os três que
> entravam calados na carga incluídos. Restam **11 abertos**. A ordem dos lotes aprovada pelo dono
> está na tabela do fim desta seção.
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
| **C — qualidade do aviso** | [CSV-27] · [CSV-28] · [CSV-29] · [CSV-31] | falso positivo e conselho errado — o que ensina a ignorar aviso | aberto |
| **D — dívida barata** | [TD-023] · [TD-024] · [TD-025] | comentário que afirma garantia inexistente + 2 guardas | aberto |
| **E — toque e responsivo** | [UX-45] · [UX-46] | faixa 641–760px + os alvos abaixo de 44px; o maior dos cinco | aberto |
| **fora de lote** | ~~[TD-022]~~ · [TD-021] · [CSV-30] | reproduzido com escrita real e corrigido nas 2 metades | ✅ **TD-022 FEITO (2026-08-23)** |

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

- **[UX-46] Alvos de toque abaixo da régua — mais largo do que a ressalva antiga dizia.**
  A ressalva falava do *"slider de markup com ~15px de área real"*. **Medido:** o slider tem caixa
  de **313×4 px** com `padding: 0`. E a 375 px, contra os 44 px da regra do projeto:
  `/orcamento` **67** elementos abaixo · `/producao` **41** (25 deles `.icon-button.danger` de
  28×28) · `/vendas` 42 · `/estoque` 27 · `/catalogo` 18. Os steppers `.num-spin` medem **14×20 px**
  (têm `tabindex="-1"`, então não quebram teclado — o dedo é que não acerta). No desktop,
  `.icon-button` 28×28 e `.btn-sm` 29 px contra os 32 da régua.
  ⚠ A técnica documentada (`padding` + margem negativa igual, UX-28/UX-37) **apareceria** no
  `getBoundingClientRect` — ela não foi aplicada nesses lugares.

### 🟡 Médio

- **[UX-45] Faixa 641–760 px: tabela rolando de lado em vez de virar cartão.**
  *(era ressalva aberta; agora medida)*. A regra "vira cartão" só entra em `max-width: 640px`.
  **Medido a 700 px:** `/catalogo` → `.table-scroll` 672 → 740 = **68 px de rolagem**, com a célula
  de nome em 66 px para conteúdo de 99–135 px; `/vendas` → `.recibo-items-scroll` 670 → 800 =
  **130 px**, repetido em 6+ recibos. `/estoque` e `/producao`: **0** ✅.

- **[TD-023] `addProductionLayers` NÃO é idempotente, apesar do comentário afirmar que é.**
  O comentário diz *"a `layerId` é evento+SKU, então um mesmo evento nunca duplica camada na mesma
  SKU (idempotente por evento)"* — e o código só faz `existing.layers.push(layer)`, sem checar o id.
  **Medido:** mesmo `eventId` aplicado 2× → **2 camadas com o id idêntico**
  (`EV1____whole__::__nocolor__`) e o saldo dobra de 4 para 8. O mesmo vale para
  `reverseFinishedConsumption` (8 → 12 no estorno duplo). **Risco prático baixo:** o `batch.set`
  grava o doc inteiro já computado, então repetir o batch grava o mesmo valor; e o
  `removeEventLayers` limpa as duas camadas. → **ou o comentário muda, ou o código o honra** (dedup
  por `layer.id`). Um comentário que afirma garantia inexistente é armadilha para quem confiar.

- **[CSV-27] O `cor-sem-preco` diz "não tem rolo" para cor que TEM rolo.**
  O sufixo é anexado sempre que a cor existe, sem olhar se há rolo. **Medido:** cor com 1 rolo de
  `pricePerKg: 0` → o aviso manda cadastrar um rolo que já está cadastrado. O conselho certo é
  *"o rolo está com preço 0"*.

- **[CSV-28] Coluna duplicada é reportada como "nome não reconhecido".**
  **Medido:** `Produto;Peso (g);Peso (g)` → *"Coluna(s) ignorada(s) — o nome não foi reconhecido:
  "Peso (g)"."* O nome **foi** reconhecido; ela é a segunda (a 1ª vence, peso 100, e a 2ª é
  descartada). Avisa, mas pela razão errada — e a razão errada manda o dono renomear a coluna.

- **[CSV-29] `isMilharAmbiguo` acende sobre notação científica — falso positivo.**
  **Medido:** `"1.5E+03"` é lido **corretamente como 1500**, mas a limpeza por regex do
  `isMilharAmbiguo` transforma o texto em `"1.503"` e casa o padrão. O aviso sairia como *"lido como
  DECIMAL (1.234 = 1,234) → 1500"*, contraditório consigo mesmo. Raro — mas falso positivo é defeito
  (padrão 7): ensina a ignorar aviso. **Saída:** rodar a checagem de científica **antes**, e sair sem
  apontar quando ela casar.

### 🟢 Baixo / informativo

- **[CSV-31] `Pecas` fracionária entra depois do aviso.** *(era a ressalva "`Pecas`/`Taxa Falha` no
  milhar")*. `Pecas` entrou na lista de milhar da AUD-11 ✅, e `Taxa Falha` segue fora — corretamente:
  o clamp em 95 torna a leitura de milhar impossível. Mas `Pecas = "1.234"` grava **1,234 peça** e o
  preço cai de 29,71 para 24,08: o aviso acende, o valor absurdo entra. Um `Math.round` (ou uma
  reprovação no `validateProduct`) fecha.

- **[TD-021] `parseDecimalPtBr` cola pedaços e devolve número plausível** *(padrão 12 do roteiro)*.
  **Medido, 83 entradas:** `"1/2"` → **12** · `"1a2"` → 12 · `"1,2,3"` → 123 · `"2 e 5"` → 25 ·
  `"1E"` → 1 · `"e5"` → 5 · `"(5) (6)"` → −56. Nenhum devolve `null`, então nenhum vira aviso. Em
  compensação `"1-2"`, `"--5"`, `"N/A"` e `"n.d."` viram `null` corretamente, e `"1E+400"` também
  (não vira `Infinity`). **Risco baixo numa planilha gerada por máquina; alto numa escrita à mão.**

- **[TD-024] `calculatePricing` com lista de máquinas VAZIA lança `TypeError`.**
  **Medido:** `Cannot read properties of undefined (reading 'watts')`. Alcançável só se
  `useMachines` devolver lista vazia — ele semeia dos defaults e cai em fallback local, então **não
  reproduzi pela UI**. Máquina *inexistente* (id órfão) é tratada certo: cai na 1ª e marca
  `machineMissing: true`.

- **[TD-025] `saleItemFinancials` com quantidade 0 vende 1.**
  **Medido:** `quantity: 0` e `quantity: -2` devolvem os dois `totalRevenue: 100, totalCost: 30,
  profit: 70` — é o `Math.max(1, …)`. **Não achei caminho pela UI** que produza qty 0; fica como
  ressalva de biblioteca.

- **[CSV-30] O texto do CSV não é estável byte a byte no round-trip.**
  Export → import → export produz a mesma linha com a ordem das chaves de `Acessorios JSON` trocada
  (`subitemId`/`supplyId`). Os **dados** são idênticos (diff canônico limpo); só o texto difere.
  Importa apenas para quem comparar arquivos com `diff`.

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

## Fechado

Nada aqui. Todo item concluído — com writeup e medições — vive no
[`.claude/HISTORICO.md`](HISTORICO.md): as seções `## ✅` (uma por item/cluster) e o bloco
**"📒 Arquivo do BACKLOG"** no fim, que recebeu o registro curto que vivia nesta fila até a faxina
de 2026-08-16.
