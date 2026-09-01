# LopoLabCalc — Backlog (a fazer)

> **Só o que está ABERTO, mais a ordem.** Curto de propósito — é o que se lê pra escolher a próxima
> tarefa. O *porquê*, os writeups e os **nove clusters de varredura já fechados** (AUD-07…AUD-16)
> vivem em [`.claude/HISTORICO.md`](HISTORICO.md), seção **"📒 Arquivo do BACKLOG"**; abra sob
> demanda. A foto do AGORA fica no `CLAUDE.md`.
>
> **Estado em 2026-09-01: há UM item de código pendente** — a **Fase 2 do [FROTA]** logo abaixo
> (a Fase 1 fechou hoje). As nove varreduras seguem zeradas; o resto depende de algo de fora — a
> logo, o cadastro do dono, ou ~1-2 meses de venda real.
>
> ⚠ **Diretriz 7 cobre o backlog inteiro:** nenhum item precisa de migração, e nada se reordena por
> causa de dado velho.

## ▶▶ [FROTA] Fase 2 — a taxa de frota (o PREÇO) — **a próxima tarefa de código**

> **A Fase 1 fechou em 2026-09-01** (ROI real: uma linha por etapa, `submissionId`, exclusão por
> lote, repartição na camada, `machineUsage`/`unattributedUnits` na venda). Writeup e armadilhas
> medidas no [`HISTORICO.md`](HISTORICO.md).

**O problema:** a mesma peça sai por **R$33,06 (A1 Mini) · R$37,45 (A1) · R$49,01 (X2D)** — **48%**
de diferença decidida por qual impressora estava livre. Com 3 máquinas de 7× de diferença de preço,
não é ajustável por parâmetro.

⚠ **Duas premissas foram AVALIADAS E DESCARTADAS** (não repropor): mexer em `lifeHours` por máquina
e criar `residualValue`. O `lifeHours` 7.500 é o **DEC-02**, martelado pelo dono; e ajustar entrada
depois de ver a saída é encaixar premissa no resultado desejado. A taxa de frota **não toca em
nenhum número pesquisado** — aceita os R$2,187/h da X2D como verdade e muda só a **distribuição**.

- **`machineId` (produto e etapa) vira CONJUNTO.** Chips viram checkboxes, **todos marcados por
  padrão**; **sem máquina padrão** (era vestígio de o preço precisar de um escalar); mínimo 1;
  conjunto vazio/ids inexistentes → frota inteira + badge de dado órfão (molde TD-009).
- **Cada componente com sua PRÓPRIA média ponderada** — não ratear um total (isso dá "mistura de
  mistura" sem significado ao lado da coluna do custo real). Com 30/40/30:
  `desgaste 0,9226 + manutenção 0,1380 + energia 0,0808 = 1,1414/h` (soma exata — a média é linear).
  As 3 linhas do `CostDetail` **continuam**, e precificado × real segue casando linha a linha.
- **`Machine.weight` em % — pesos iniciais 30/40/30** (Mini/A1/X2D, dono 2026-09-01), editados **no
  modal de gerenciar máquinas**, junto dos outros campos da máquina.
  ⚠ **Percentual puro, NUNCA horas/dia:** o `FixedCostSettings` já tem `hoursDay`/`daysMonth`/
  `machines` (fonte da capacidade **e** do rateio do fixo). Horas aqui criariam 2ª fonte da verdade
  do mesmo fato (20h × 2 = 40 h-máquina/dia contra 8+12+8 = 28) — o que o **D6.1** proíbe.
  Proporção e hora são grandezas diferentes: não se contradizem.
  🔴 **Subconjunto com soma de pesos ZERO → média SIMPLES dele.** Máquina nova entra a 0% (com aviso
  visível; fatia igual automática reprecificaria o catálogo ao cadastrar) — e peça que só cabe nela
  daria `NaN`. A renormalização no subconjunto sai de graça (a fórmula já divide pela soma).
- **`/maquinas`:** cartão só-leitura com o **R$/h de cada máquina** (hoje invisível em qualquer tela)
  e a taxa de frota resultante.
- **Limpeza:** `MachineUsage` some do resultado da precificação (vira conceito só de produção/venda);
  a coluna **"Máquina" sai da tabela do `/catalogo`** e vai pro dropdown de detalhe (no caso normal
  repetiria "A1 Mini +2" em toda linha, e desambigua "pode rodar" de "foi impresso"); a capacidade
  perde o gargalo por máquina; `validateProduct` exige ≥1 elegível.
- **Round-trip (FORM-01/CSV-05):** `buildLoadedProduct` ⇄ `buildProductPayload` · `toSavedProduct` ·
  `parseProductsCsv` + coluna nova com checagem + testes de diff campo a campo. **Maior parte do
  trabalho, e invisível.**
- **Verificação:** ⚠ a trava de preço da Fase 1 (`frotaFase1.test.ts`) **vai mudar de propósito** —
  os literais são de antes da taxa de frota. Recalcular os números e trocá-los é parte da Fase 2;
  reaproveitar o teste sem olhar é o contrário do que ele existe para impedir.

### Fica de fora (registrado, não esquecido)
Unificar as horas do custo fixo com a frota · desembaraçar o duplo papel do campo "Máquinas" (fato
no fixo, **hipótese** no DEC-06) · capacidade somar as elegíveis em vez de gargalar numa · pesos
derivados do histórico real de produção (o dado de hoje é teste; volta depois do recadastro — a
**proporção** continua sendo a forma armazenada, então é compatível) · **custo fixo fica desligado
como está** (tirar não simplificaria: o trio `hoursDay`/`daysMonth`/`machines` é da capacidade e
ficaria de qualquer jeito).

**Efeito no dado (Diretriz 7, sem migração):** produto perde `machineId` e entra com todas
elegíveis.

## ▶ Disponível HOJE — as outras duas frentes que não esperam ninguém

- **[FEAT-03] sem a logo.** O guarda-chuva do PDF tem cinco sementes que **não tocam em marca**:
  prazo de entrega, formas de pagamento/condições, termos e observações, desconto/acréscimo,
  detalhar etapas e subitens (usa FEAT-01). Só a foto do item, o QR do WhatsApp e o branding real
  esperam o designer. **Onde:** `generateQuotePdf.ts` + `QuotePage`/`config/orcamento`.
- **[AUD-08 · regras do Firestore] — sem prova há 7 varreduras.** É a única lacuna que aparece em
  TODA lista de "não cobriu" desde a AUD-09. **Exige uma 2ª conta Google** para tentar ler/escrever
  como estranho — quem destrava é o dono. As regras estão travadas e o `AuthGate` no ar; o que falta
  é *provar*, não *escrever*.

## ⚠ A frente do DONO (bloqueia a carga em massa)

Cadastrar as **cores e os insumos definitivos**, **religar os acessórios** (`planSupplies`) e passar
os ids ao **sistema externo dele**, que gera a planilha. A **spec/planilha-modelo sai comigo no
chat** depois do cadastro — não vira botão no app (decisão do dono, 2026-08-23).

- **"Pode recadastrar?" → SIM, sem trava.** A última que existia (o `[E6]` da AUD-15) caiu.
- **Acessório sem baixa não é bug, é vínculo em branco.** Com `supplyId` ligado consome por FIFO;
  com `null` ("avulso") entra no custo e não mexe no estoque. Ligar no formulário liga a baixa,
  **sem código novo**.
- **[CSV-17] entra na spec** — o token do arredondamento é item de **doc**, não de código (o app já
  avisa). Único resíduo vivo da AUD-09; o `[CSV-18]`/`[CSV-19]`/`[CSV-20]` o round-trip limpa sozinho.
- **Decisão pendente do dono:** bloquear ou não a confirmação do CSV com erro de domínio. Hoje o
  TD-009 vale — **avisa, não bloqueia**.

## Bloqueadas por dado externo

- **[FEAT-03] — só a METADE que precisa de marca.** Bloqueadas aqui: foto/thumbnail do item, QR code
  do WhatsApp e branding real. As outras cinco sementes **não esperam ninguém** → ver "Disponível
  HOJE", no topo. Lista completa em `HISTORICO.md`.
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
    carregar BRANCO"* (UX-24) — e o amarelo dourado reprova justamente com branco em cima.
    ✅ **O `--on-accent` JÁ EXISTE (2026-08-31)** — criado antes da logo, de propósito, repetindo o
    acerto do TD-014: nasceu como **no-op** (valor `#fff`, zero mudança visual) e a troca de paleta
    virou **uma linha**. ⚠ **Eram 6 lugares, não os 5 que esta lista dizia** — faltava o
    **`.skip-link`** (`base.css`), além de `.btn.primary`, `.back-to-top`, os 2 toggles de desconto e
    o `.collapse-badge`. Os 6 leem o token; `grep` não acha mais branco literal sobre
    `--accent-strong`. **Ensaio medido do rebrand:** `--on-accent: #111` + `--accent-strong: #F2B705`
    numa linha → `.btn.primary` `rgb(255,255,255)` → `rgb(17,17,17)` sobre o mesmo fundo, e revertido
    limpo. Não é redeclarado no escuro, pelo mesmo motivo que o `--accent-strong`: tinta sobre cor
    não depende do fundo da página.
    → **Logo, a troca agora é SÓ de paleta.** O que sobra do rebrand é a logo e a decisão do
    `--accent-text` no claro, abaixo.
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

## Decisões já marteladas que ainda são tarefa de CÓDIGO

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


## Lacunas de PROVA — o que nenhuma das 9 varreduras cobriu

> Não são defeitos: é o que continua **sem medição**. Vale reler antes de afirmar que algo "está
> são". Consolidado das listas "O que a AUD-XX NÃO cobriu".

- **Regras de segurança do Firestore** — 7 varreduras sem prova. Exige 2ª conta Google (ver acima).
- **Escala acima de 500 produtos** — o corte do `createProductsBatch`, onde o lote pode entrar pela
  metade, segue sem prova (exigiria ~1.040 escritas). **A carga em massa real exercita isso de
  graça** — por isso o [AUD-08] fica fora de qualquer lote: varrer antes é ensaiar o que vai
  acontecer sozinho depois.
- **Rede realmente caída** no meio da transação de venda (fila do Firestore, promise pendente,
  reconexão). O `navigator.onLine` forçado já foi exercitado; a rede de verdade, não.
- **Duas abas com o timeout de 12s no meio** — o guarda `rev` foi lido e medido; a corrida, não.
- **Excel/Sheets de verdade** — BOM, CRLF, latin-1 e notação científica foram **simulados**. O
  Sheets exigiria login e envio de arquivo.
- **Exportação de CSV do `/vendas`** — o botão existe e nunca foi exercitado.
- **iOS Safari real, Firefox** e qualquer navegador fora do Chromium embutido · o **modal de
  máquinas nas larguras de celular** · a exclusão de produto **offline ao vivo**.

## Ressalvas vivas (não são itens; viram item se o dono mandar)

- **[R1] `readFinishedColors` conta a perda TOTAL e cala a PARCIAL** — `finishedGoods.ts`,
  `malformed = raw.length > 0 && entries.length === 0`. Um item torto no MEIO de uma lista boa some
  sem dizer nada. Medido: `1 torto + 3 bons` → 3 entradas, `malformed: false`. Alcançar isso exige
  documento escrito à mão — por isso é ressalva, não defeito.
- **Import >500 não é atômico** — commits sequenciais de 500, com o erro dizendo quantos entraram.
  Tradeoff já escrito no código; o `withWriteTimeout` é `Promise.race` e **não cancela** o commit do
  Firestore (a mensagem manda não repetir a ação).
- **`roundPrice("0.90")` devolve 48,899999999999998579** em vez de 48,90 — ruído de ponto flutuante
  abaixo do centavo, mas é assim que vai pro `suggestedPrice`.
- **O `<select>` continua sem encolher** (`min-content`) — a regra de reticências trata o que
  acontece DEPOIS de encolher. Por isso as colunas seguem em `minmax(0, 1fr)`.
- **Steppers** medem 28×20px no celular, mas são `aria-hidden` **dentro** de um campo de 44px — não
  são alvo independente. O `[A11Y-02]` segue **falso positivo declarado**, confirmado no fonte.
- **Console não está em zero** — um recibo real (`yoRC0YZjQAq2piItJojG`) tem `finishedColors`
  ilegível e avisa a cada leitura de `/vendas`. O `console.warn` é diagnóstico e fica; o dono já vê
  o recado na tela, com o id.
- **Lixo que o recadastro leva embora** (registrado só pra não voltar como achado novo): 18 dos 97
  produtos com campo `id` **dentro** do documento, um deles apontando pra outro produto · 65 com
  `markupOnFixed`, morto desde a DEC-01 · 4 `acabados` órfãos com saldo 0 e um com saldo −1 · dois
  contadores de orçamento (`config/orcamentoSeq.last = 21` vivo, `config/orcamento.lastNumber = 2`
  lixo) · overdraft de **−370 g na Bege** (furo de contagem física; o D4 preserva de propósito).
  ⚠ **A mecânica que SOBREVIVE ao recadastro:** `saveProduct` usa `tx.update`, que faz **merge** —
  campo que o `buildProductPayload` deixe de gravar fica no documento pra sempre.
- **[TD-021] e [CSV-30]** seguem ressalva por decisão do dono.

## Fechado

Nada aqui. Todo item concluído — com writeup e medições — vive no
[`.claude/HISTORICO.md`](HISTORICO.md): as seções `## ✅` (uma por item/cluster) e os dois blocos
**"📒 Arquivo do BACKLOG"** (a faxina de 2026-08-16 e a de 2026-08-31, esta com os nove clusters de
varredura na íntegra).
