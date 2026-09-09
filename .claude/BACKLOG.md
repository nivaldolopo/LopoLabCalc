# LopoLabCalc — Backlog (a fazer)

> **Só o que está ABERTO, mais a ordem.** Curto de propósito — é o que se lê pra escolher a próxima
> tarefa. O *porquê*, os writeups e os **onze clusters já fechados** (AUD-07…AUD-18) vivem em
> [`.claude/HISTORICO.md`](HISTORICO.md), seção **"📒 Arquivo do BACKLOG"**; abra sob demanda. A foto
> do AGORA fica no `CLAUDE.md`.
>
> **Estado em 2026-09-08 (fim do dia): o [TD-033] FECHOU; sobra o [FEAT-12]** — os dois nasceram da
> conversa sobre *reprecificação automática*; o TD-033 (preço vivo do insumo) foi primeiro e sozinho,
> como a spec dele exigia, e o writeup está no `HISTORICO.md`. Fora o FEAT-12 a lista não tem dívida
> de código: a [AUD-08] provou as regras do Firestore — a
> lacuna mais velha, aberta desde a AUD-09; a [AUD-18] fechou seis lacunas de prova e os 2 defeitos
> que elas revelaram (writeups no `HISTORICO.md`); a [AUD-17] fechara os 6 dela antes, e as duas
> fases do [FROTA] em 2026-09-01. O resto **depende de algo de fora**: a logo, o cadastro do dono, o
> LibreOffice, ou ~1-2 meses de venda real.
>
> ⚠ **Diretriz 7 cobre o backlog inteiro:** nenhum item precisa de migração, e nada se reordena por
> causa de dado velho.

## ▶ Disponível HOJE — a frente que não espera ninguém

> **Ordem:** o **[FEAT-12]** primeiro (o [TD-033], que tinha de vir antes dele, fechou em
> 2026-09-08). A **[FEAT-03] sem a logo** continua livre, atrás dele.

- **▶ [FEAT-12] Controle de mudança GLOBAL de preço + página de Configurações.**
  **O problema, medido:** o preço não é dado, é **função**. Não existe campo de preço no produto
  (`ProductPayload` não tem nenhum) — toda tela chama `calculatePricing(product, machines,
  fixedCosts, stock, supplies)` no render. Logo, mexer numa alavanca global reprecifica o catálogo inteiro,
  **em todos os aparelhos** (os docs `config/*` são realtime e compartilhados), **sem aviso, sem
  antes/depois e sem desfazer** — o `rev` da AUD-18 conta versão, não guarda a anterior. `lifeHours`
  7500 → 750 multiplica a depreciação por 10 em todo produto da máquina, calado.
  ⚠ **O que NÃO é o problema** (dono, 2026-09-08): que o preço acompanhe o insumo. **Filamento mais
  caro DEVE deixar o produto mais caro** — falta controle e rastro, não trava.
  **Já é imune, e continua fora:** venda (`frozenCost` + preço congelado), evento de produção e
  orçamento emitido (`QuoteItemSnapshot.unitPrice`). O dano nunca foi retroativo — é a vitrine e o
  que for emitido depois.
  **As 5 alavancas, e o tratamento de cada uma** *(o critério é a tela em que o dono está: se ele
  está olhando para a alavanca, pergunta antes; se ela se moveu como efeito colateral de outra
  tarefa, conta depois)*:
  - **pergunta antes** → máquinas (watts, preço/vida, manutenção, peso) · **excluir máquina** (o id
    salvo vira órfão e o produto cai na frota inteira, `resolveFleet`) · custo fixo (`config/negocio`).
  - **conta depois** → rolo novo de uma cor / cor arquivada (`resolveFilamentPrices`) · lote novo de
    um insumo (`resolveAccessoryPrices`, viva desde o [TD-033]).
  **Fora de escopo, decidido:** `config/taxas` — é doc compartilhado (não é por venda, ao contrário
  do que parece na tela), mas move só a **dica de margem líquida**, não a etiqueta. E mover os
  painéis de config existentes de casa (ver peça 4).
  **As peças:**
  1. **`lib/repriceImpact.ts`, pura** — `computeRepriceImpact(products, antes, depois)`, onde
     *antes/depois* é o pacote de alavancas. Devolve por produto preço antes/depois/Δ R$/Δ% e os
     agregados: afetados, subiram, desceram, média, os maiores movimentos e **quem CRUZA a faixa do
     `marginTier`** (dono: "preço mais quem cruza"). A régua usada é a **margem precificada bruta,
     pré-taxa** — a mesma que o catálogo pinta —, e é por isso que a prévia não depende de
     `config/taxas`. Uma função, três superfícies; molde do `fleet.ts`.
  2. **Passo de confirmação — componente AUTÔNOMO**, não colado no `MachineManagerModal`: os painéis
     de config vão mudar de casa (peça 4) e acoplar custaria reescrita. Cancelar não grava (é o
     rascunho de hoje). ⚠ **A prévia calcula contra a MESMA lista que a `revDoRascunho` descreve**
     (AUD-18): usar o `machines` vivo mostraria um "antes" que é o de quem acabou de sobrescrever;
     `rev` recusada → prévia descartada com o motivo, e a trava atual segue idêntica.
  3. **Aviso pós-fato**, nas portas do estoque: **UM aviso que ACUMULA** ("3 alterações
     reprecificaram 21 produtos · ver quais") — cadastrar 4 rolos seguidos não pode virar 4 caixas.
     **Fica até dispensar** (dono), dispensa persistida por entrada do registro (localStorage), e
     vive no **aparelho que fez a mudança** — os outros ficam com o registro, que é permanente e não
     interrompe ninguém. "Ver quais" abre a entrada em `/configuracoes`. Sem leitura nova: a
     `StockPage` já precifica o catálogo inteiro (`StockPage.tsx:254`).
  4. **Página nova `/configuracoes`** — **⚙ discreto, separado das abas de conteúdo** da `NavBar`
     (dono, 2026-09-08): não é destino diário e seria a 8ª aba numa linha de 7. Nasce só com o
     registro, mas é a **casa futura da coleção `config/`**, hoje espalhada — `config/machines`
     (modal da calculadora), `config/negocio` (painel da calculadora), `config/taxas` (modal da
     venda), `config/orcamento` (página Orçamento). **Mover não é deste item**; registrar o destino é
     o que justifica a peça 2 nascer desacoplada.
  5. **O registro** — coleção `alteracoes`, um doc por mudança: `at`, quem (e-mail do AuthGate),
     alavanca, antes, depois, e `impacto` (afetados, subiram, desceram, médiaPct, **até 10** maiores
     com id/nome/antes/depois, e quem cruzou a faixa). Guarda **resumo, nunca o catálogo**. É o que
     responde *"por que este produto está 18% mais caro que semana passada?"* — hoje sem resposta por
     porta nenhuma. ⚠ Coleção nova entra no `firestore.rules` **e** no `pnpm test:rules` (AUD-08).
  6. **Desfazer derivado do registro** — o `antes` da alavanca está lá, então não é preciso guardar
     `prevItems` no doc. E o desfazer **passa pela mesma prévia**: desfazer também é mudança global.
  **Aceite:** a lib pura coberta por teste (inclusive "nada mudou" = lista vazia, e produto órfão de
  máquina); a prévia contra `rev` velha recusa sem gravar; o aviso acumulado dispensado não
  ressuscita ao recarregar.

- **[FEAT-03] sem a logo.** O guarda-chuva do PDF tem cinco sementes que **não tocam em marca**:
  prazo de entrega, formas de pagamento/condições, termos e observações, desconto/acréscimo,
  detalhar etapas e subitens (usa FEAT-01). Só a foto do item, o QR do WhatsApp e o branding real
  esperam o designer. **Onde:** `generateQuotePdf.ts` + `QuotePage`/`config/orcamento`.

> **[AUD-08] FECHADA em 2026-09-08, sem resíduo** — as regras estão provadas nas **três** pontas:
> produção sem token (403 em 18/18 sondas), o texto do `firestore.rules` (119 testes no emulador, 12
> identidades, mutação conferida) e o **ruleset publicado** (diff mecânico contra o Console: 17
> linhas, idênticas). **A 2ª conta Google nunca foi necessária** — o emulador forja identidade.
> Writeup no `HISTORICO.md`.

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


## Lacunas de PROVA — o que continua sem medição

> Não são defeitos: é o que continua **sem medição**. Vale reler antes de afirmar que algo "está
> são". A **[AUD-18] (2026-09-08) fechou seis** desta lista — export CSV do `/vendas`, tela de
> importação, CSS da FROTA, rede caída na venda, timeout de 12s e a corrida de duas abas; as duas que
> viraram defeito estão no `HISTORICO.md`. Sobra o que segue bloqueado por algo de fora.

- ~~Regras de segurança do Firestore~~ — **✅ PROVADAS (AUD-08, 2026-09-08)**, nas três pontas:
  `node scripts/provaRegrasNaProducao.mjs` (produção, sem token), `pnpm test:rules` (o texto do
  arquivo, no emulador) e o diff contra o **ruleset publicado** no Console. ⚠ O que **continua
  valendo como risco** não é lacuna de prova: as regras **não validam forma de documento** — os 3
  e-mails têm CRUD total em tudo, então conta comprometida = perda total, sem camada de contenção
  (tradeoff aceito para uma ferramenta de 3 contas, não defeito).
- **Escala acima de 500 produtos** — o corte do `createProductsBatch`, onde o lote pode entrar pela
  metade, segue sem prova (exigiria ~1.040 escritas). **A carga em massa real exercita isso de
  graça** — por isso o [AUD-08] fica fora de qualquer lote: varrer antes é ensaiar o que vai
  acontecer sozinho depois. ⚠ O dono tirou este item do escopo da AUD-18 de propósito ("não vou usar
  isso por agora").
- **Excel/Sheets de verdade** — BOM, CRLF, latin-1 e notação científica seguem **simulados**.
  ⚠ **A AUD-18 tentou e esbarrou em bloqueio TÉCNICO, não de permissão** (o dono autorizou): Excel,
  LibreOffice e WPS **não estão instalados** na máquina, e o `Arquivo → Importar` do Google Sheets
  abre o Picker num iframe de outra origem cujo upload aciona o **diálogo nativo do Windows**, que a
  ferramenta de navegador não pode operar. **Saída mais barata: instalar o LibreOffice** e fazer o
  round-trip local.
- **iOS Safari real e Firefox** — o Firefox **não está instalado** na máquina (conferido na AUD-18);
  iOS exige aparelho. Some junto a exclusão de produto **offline ao vivo**.
- **A falha PARCIAL de uma transação** que estoure o limite de 500 escritas do Firestore.
- **A concorrência de dois donos no `config/machines` está PROVADA e CORRIGIDA** (AUD-18 [A1]) — o
  que continua sem medida é a corrida em *rede real lenta*, não a lógica da trava.

## Ressalvas vivas (não são itens; viram item se o dono mandar)

- **As 5 🟢 que a [AUD-17] deixou** (medidas, nenhuma é tarefa): `useMemo` do preview da `/producao`
  sem `dateStr` · evento gravado com id de máquina morta (`productionPlan.ts`) · a escolha de máquina
  da venda **não é gravada** no doc (editar a venda zera a escolha de 2+ candidatas; a de interseção
  única a reconciliação re-deduz) · `idsJson` não distingue `machineIds: []` explícito de ausente ·
  **[E7]** a corrida `machines × products` na `/producao` — o núcleo puro erra, mas **não reproduziu
  em 3 cargas frias** (o doc único chega antes da coleção de 104 produtos).
- **Pergunta aberta pro dono (AUD-17):** na `/producao` o `<select>` "Máquina" oferece a frota
  INTEIRA, mesmo num produto elegível a duas. Se é de propósito ("o que RODOU manda, não o que
  PODE"), vale dizer isso no comentário; se não, é restrição faltando.
- **A regra do Firestore é sensível a CAIXA, o `useAuth` não** (AUD-08) — a regra usa `in`, o app
  compara depois de `toLowerCase()`. E-mail em caixa mista seria **autorizado pela tela e negado
  pelo banco**. Não é explorável (o Google entrega o e-mail canônico em minúsculas) e os 9 testes da
  identidade "CAIXA ALTA" fixam o comportamento.
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
- **O `CLAUDE.md` está em 330 linhas, contra o alvo de ~270** (Diretriz 8). O Status já foi
  comprimido; o que sobra de gordura são as **7 regras de CSS/UI** dos Pontos-chave (~30 linhas).
  Movê-las para o `HISTORICO.md` é a saída natural, mas é decisão deliberada — elas são guarda-corpo
  de quem escreve CSS novo, e o `HISTORICO` só entra em contexto quando alguém o lê.

## Fechado

Nada aqui. Todo item concluído — com writeup e medições — vive no
[`.claude/HISTORICO.md`](HISTORICO.md): as seções `## ✅` (uma por item/cluster) e os dois blocos
**"📒 Arquivo do BACKLOG"** (a faxina de 2026-08-16 e a de 2026-08-31, esta com os nove clusters de
varredura na íntegra).
