# LopoLabCalc — Backlog (a fazer)

> **Só o que está ABERTO, mais a ordem.** Curto de propósito — é o que se lê pra escolher a próxima
> tarefa. O *porquê*, os writeups e os **nove clusters de varredura já fechados** (AUD-07…AUD-16)
> vivem em [`.claude/HISTORICO.md`](HISTORICO.md), seção **"📒 Arquivo do BACKLOG"**; abra sob
> demanda. A foto do AGORA fica no `CLAUDE.md`.
>
> **Estado em 2026-09-01: NÃO há item de código pendente.** As duas fases do [FROTA] fecharam hoje
> (a 1 de manhã, a 2 à tarde) e saíram daqui — writeups no `HISTORICO.md`. As nove varreduras seguem
> zeradas. O que resta **depende de algo de fora**: a logo, o cadastro do dono, uma 2ª conta Google,
> ou ~1-2 meses de venda real. As duas frentes tocáveis hoje estão logo abaixo.
>
> ⚠ **Diretriz 7 cobre o backlog inteiro:** nenhum item precisa de migração, e nada se reordena por
> causa de dado velho.

## ▶ Disponível HOJE — as duas frentes que não esperam ninguém

- **[FEAT-03] sem a logo.** O guarda-chuva do PDF tem cinco sementes que **não tocam em marca**:
  prazo de entrega, formas de pagamento/condições, termos e observações, desconto/acréscimo,
  detalhar etapas e subitens (usa FEAT-01). Só a foto do item, o QR do WhatsApp e o branding real
  esperam o designer. **Onde:** `generateQuotePdf.ts` + `QuotePage`/`config/orcamento`.
- **[AUD-08 · regras do Firestore] — sem prova há 7 varreduras.** É a única lacuna que aparece em
  TODA lista de "não cobriu" desde a AUD-09. **Exige uma 2ª conta Google** para tentar ler/escrever
  como estranho — quem destrava é o dono. As regras estão travadas e o `AuthGate` no ar; o que falta
  é *provar*, não *escrever*.

## ▶ Aberto pela [FROTA] Fase 2 — pequeno, e nenhum bloqueia nada

> A fase fechou de propósito sem estes. Estão aqui para não voltarem como "achado novo".

- **A capacidade somar as ELEGÍVEIS em vez de gargalar numa.** A Fase 2 tirou o `machineBreakdown`
  (ele vinha da máquina atribuída na precificação, que deixou de existir) e o ciclo voltou a ser a
  **soma** das horas — o pior caso honesto, tudo em série. Creditar o paralelismo agora exigiria
  saber quantas cópias de cada elegível existem, que é o item abaixo.
- **Desembaraçar o duplo papel do campo "Máquinas" do custo fixo.** Ele é FATO no rateio do fixo e
  **hipótese** no DEC-06 ("N conjuntos completos"). O aviso que explicava isso na tela saiu junto com
  o `machineBreakdown` — ele só aparecia quando o produto usava mais de uma máquina, e não há mais
  como saber isso a partir do preço. O `× machines` continua correto e continua sem quem o explique.
- **Unificar as horas do custo fixo com a frota.** Hoje `hoursDay`/`daysMonth`/`machines` (capacidade
  + rateio do fixo) e `Machine.weight` (proporção de uso) são grandezas diferentes que não se
  contradizem — foi o D6.1 que manteve assim, de propósito. Unificar é opcional, não dívida.
- **Pesos derivados do histórico REAL de produção — COM interruptor (dono, 2026-09-02).** Os
  30/40/30 são declaração do dono. Com venda real no banco dá para derivá-los das horas dos eventos.
  **A proporção continua sendo a forma armazenada**, então é compatível, sem migração. Volta depois
  do recadastro. Cruza com o [Dashboard].
  ⚠ **O dono pediu poder LIGAR/DESLIGAR a derivação** — então ela nasce com o modo, não ganha um
  depois. O que a spec precisa resolver, decidido AGORA para não virar retrabalho:
  - **Guardar os DOIS.** `weightMode: "manual" | "historico"` ao lado do `Machine.weight` digitado.
    O peso manual **não se perde** ao ligar o histórico: desligar restaura o número do dono. Derivar
    POR CIMA do campo digitado seria destrutivo e irreversível.
  - **Global, não por máquina.** Meia frota no histórico e meia na mão dá uma proporção que não
    significa nada (as fatias não se somam entre fontes diferentes).
  - **Janela explícita na tela.** O ROI já usa 90 dias para o "ritmo" (TD-016); a derivação deve
    dizer de quantos dias e de quantas impressões ela saiu — peso derivado de 3 eventos é ruído.
  - **Piso de dado.** Sem histórico suficiente, NÃO cai em média simples calada: fica no manual e
    avisa. Trocar o peso do dono por um palpite é o que o DEC-02 já recusou uma vez.
  - **Ligar RECALCULA O CATÁLOGO INTEIRO.** Precisa de prévia (antes/depois de N produtos) antes de
    confirmar — não pode ser um toggle que muda 103 preços em silêncio.
  - ⚠ **O peso também é o custo real da encomenda sem máquina declarada** (`productionCostAtRate`),
    não só o preço. Mudar a fonte do peso muda COGS de venda, não só número de vitrine.
- **O custo fixo fica DESLIGADO como está.** Tirar não simplificaria: o trio
  `hoursDay`/`daysMonth`/`machines` é da capacidade e ficaria de qualquer jeito.

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
- **iOS Safari real, Firefox** e qualquer navegador fora do Chromium embutido · a exclusão de
  produto **offline ao vivo**. ✅ O **modal de máquinas no celular** saiu desta lista: medido a 375px
  na Fase 2 (4 fileiras no cartão, Excluir 44×44 dentro da caixa, sem rolagem lateral).

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
