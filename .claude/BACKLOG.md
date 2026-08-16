# LopoLabCalc — Backlog (a fazer)

> **Roadmap dos itens ABERTOS + ordem de prioridade.** Curto de propósito — é o que se lê pra
> escolher/rever a próxima tarefa (não precisa do histórico pesado pra isso).
> O *porquê* / detalhe de design (D1–D8, auditoria, writeups do que já foi feito) vive em
> [`.claude/HISTORICO.md`](HISTORICO.md) — abra sob demanda ao pegar o item.
> A foto do AGORA + a próxima tarefa sugerida vivem no `CLAUDE.md`.
>
> **Tier 0, Tier 1, Tier 4, o 7e e o cluster UI/UX de 2026-08-15 ✅ FECHADOS.** O registro deles
> (com as medições) foi movido pro `HISTORICO.md` na **faxina de 2026-08-16** — seção
> "📒 Arquivo do BACKLOG". **Este arquivo só tem o que está ABERTO.**

## Ordem de prioridade — ondas (dono, 2026-08-16)

> **O que mudou nesta data:** a fila antiga tinha 14 linhas, **11 riscadas**, e o único bloco vivo
> (o cluster da auditoria de 2026-08-16, com 20 itens) estava marcado *"sem ordem interna"* — ou
> seja, o backlog **não ordenava nada do que sobrou**. As ondas abaixo são o martelo do dono sobre
> os 21 itens abertos de código.
>
> **O critério que decidiu a ordem — prazo externo, e ele corta pros DOIS lados:**
> - **[TD-014] feito ANTES da marca ECONOMIZA** — com a cor tokenizada, o rebrand vira troca de
>   paleta; sem ela, são 14 edições à mão em literais que fixam o RGB do laranja. → **sobe**.
> - **[DEC-05] feito antes da marca CUSTA** — o próprio item registra a ressalva do dono de que
>   vai precisar de ajuste depois. É o simétrico do TD-014. → **desce, sai da fila.**
>
> ⚠ Dentro de cada onda **não há ordem** — são do mesmo tamanho e do mesmo tipo. O que a onda fixa
> é *quando o bloco entra*, não a sequência interna.

| Onda | Itens | Por que aqui |
|---|---|---|
| **0 — perguntas** *(não é código)* | **[DEC-06]** · a **sub-decisão do [UX-20]** (a/b/c) | DEC-06 muda a matemática da capacidade; respondida tarde, tudo que tocar capacidade vira retrabalho. Perguntar **em paralelo** com a Onda 1. |
| **1 — quebra, ou é conserto de 1 linha** | **[BUG-06]** · **[BUG-07]** · **[UX-27]** · **[UX-30]** · a parte de `text-align` do **[UX-21]** | BUG-06 é **dado inalcançável** no celular (lucro e excluir não existem lá), não cosmético. O resto é ~meio dia pro maior retorno visual do lote. |
| **2 — o bloco COR** ⏳ *prazo externo* | **[TD-014]** · **[UX-20]** · **[UX-24]** · **[UX-25]** · a parte de cor do **[UX-26]** | Única onda com prazo (a marca). O UX-20 é a **mesma passada** por `.sale-pos`/`.sale-neg` que o TD-014 exige — pega carona de graça. |
| **3 — grade e alinhamento** | resto do **[UX-21]** · **[UX-22]** · **[UX-23]** · **[UX-33]** | É literalmente o que o dono viu com os próprios olhos ("textos descentralizados"). |
| **4 — sistema** | **[TD-015]** (8 modais) · **[UX-29]** · **[UX-31]** · **[UX-28]** · **[UX-32]** | Caro, sem prazo, alto valor estrutural. O TD-015 apaga 8 cópias de `.modal-overlay`. |
| **5 — matemática e leitura** | **[UX-26]** (as barras) · **[TD-016]** · **[UX-34]** | Depende do **[DEC-06]** já ter sido respondido. |
| **fora da fila** | **[DEC-05]** (lucide) | Fazer **junto do rebrand**, não antes — ver o critério acima. |
| **⏸ bloqueadas** | **[FEAT-03]** + **[branding/logo real]** (a marca não existe) · **[Dashboard]** (precisa de ~1-2 meses de venda real) | Sempre por último; nenhuma das duas depende de decisão nossa. |

> Diretriz 7 (dados descartáveis, marco futuro) cobre o backlog inteiro → **nenhum item precisa de
> migração**. Não reordenar por causa disso.

## Itens abertos

### Cluster da auditoria de 2026-08-16 (UX-20…UX-34 · TD-014…TD-016 · BUG-06/07 · DEC-06)

> **Origem:** auditoria de UI/UX **+ cálculo** pedida pelo dono logo após o fechamento do cluster
> UI/UX. Feita com o site **rodando** e dados reais (93 produtos, 47 vendas, 53 produções), em
> **7 rotas + 9 modais**, a **1280×900** e **375×812**, nos **dois temas**, com medição no DOM —
> não é impressão de leitura de código.
>
> **33 achados → 21 itens.** Vários achados eram o **mesmo defeito em lugares diferentes** e foram
> consolidados; o código-referência do relatório (A1…I3) está anotado em cada item.
> **O número medido e o porquê de cada um vivem no [`HISTORICO.md`](HISTORICO.md)**, seção
> "🔍 Auditoria de UI/UX + cálculo (2026-08-16)" — abra lá ao pegar o item.
>
> ✅ **A ordem SAIU (dono, 2026-08-16)** — os 21 itens estão distribuídos nas **ondas 0–5** no topo
> deste arquivo. Ficou perto do que a auditoria sugeriu, com **duas divergências**: o `UX-22` não é
> conserto de 1 linha (é alinhamento → foi pra **onda 3**, não pra 1), e o `DEC-06` subiu pra
> **onda 0** por ser pergunta que trava a matemática de quem vier depois.
>
> ⚠ **Continua valendo que o mérito de cada item é levantamento** — a ordem diz *quando* o bloco
> entra, não que o desenho da solução já está aprovado. As "Sugestões" escritas em cada item
> seguem sendo sugestão da auditoria, não martelo. O `DEC-06` é **pergunta, não tarefa**, e o
> `UX-20` ainda tem uma **sub-decisão aberta** (a/b/c) — as duas são a **onda 0**.

- **▶ [UX-20] A cor do lucro compete com a faixa de margem** *(pedido do dono, 2026-08-16; era o
  achado **C5** da auditoria — o ÚNICO já decidido)*
  Em "Lucro **R$ 25,46 (76%)**" há **dois** sinais de cor sobrepostos: o valor recebe
  `.sale-pos`/`.sale-neg` (lucro × prejuízo) e a % recebe a faixa da **DEC-04** (ruim/ok/boa).
  **Medido: são o MESMO tom** — `.sale-pos` é `color: var(--green)` (`auth-sale.css:90`) e
  `--margin-good` é `var(--green)` (`base.css:108`). Enquanto a margem é boa, o verde dobra sem
  graduar nada (todo lucro positivo é verde); quando ela cai, a linha manda recados opostos —
  R$ **verde** ao lado de % **âmbar/vermelha** (existe nos dados reais: `R$ 20,11 (61%)`).
  **✅ Decidido (dono, 2026-08-16): valor em R$ na cor normal, cor SÓ na margem — e como REGRA
  DO APP INTEIRO**, não só na `/vendas` (o dono ampliou o escopo no mesmo dia).
  ⚠ **Reverte uma decisão do [UX-19]**, registrada em **DOIS** comentários no código
  (`SalesPage.tsx:681` e `StockPage.tsx:714`): *"o R$ segue verde/vermelho … e só a % recebe a
  faixa da DEC-04 — assim os DOIS sinais sobrevivem"*. Quem pegar está **mudando** uma decisão,
  não completando uma — mesmo molde do **[UX-15] vs [TD-004]**. Os dois comentários têm de ser
  reescritos junto, senão o código passa a mentir.
  ⚠ **A cor do lucro NÃO sai de um lugar só — são TRÊS implementações diferentes** do mesmo
  conceito, e a busca por `.sale-pos` **não acha a terceira**:
  1. `.sale-pos` / `.sale-neg` na classe (a maioria dos pontos) — verde `var(--green)` /
     vermelho `#e05252`;
  2. `.fg-margin-val` (`stock.css:568`) — o verde vem da **própria classe** (`color:
     var(--green)`), sem `.sale-pos`; o JSX só acrescenta `.sale-neg` no negativo;
  3. e nesse mesmo `.fg-margin-val.sale-neg` (`stock.css:575`) o prejuízo é **`var(--accent)`
     (laranja)**, não o vermelho `#e05252` que o resto do app usa — **duas cores para o mesmo
     significado**. Unificar isso faz parte da tarefa.
  ⚠ **Borda obrigatória (senão some sinal):** hoje o vermelho do PREJUÍZO mora no R$. Tirando a
  cor de lá, o prejuízo passa a depender da % vermelha (margem negativa cai em "ruim") + do sinal
  de menos. Isso **falha com receita 0**: a margem não é finita, `marginTier` devolve `null` e o
  prejuízo ficaria **sem cor nenhuma**. → **manter `.sale-neg` só para valor negativo**; o que
  sai é só o `.sale-pos`.
  ⚠ **Sub-decisão em aberto:** em alguns pontos o valor **não tem % ao lado** (linha do item em
  `/vendas`, `ProfitSummary`, cards do `/maquinas`). Sem a cor e sem a %, o número fica sem
  nenhuma leitura de qualidade. Escolher: (a) exibir a % nesses pontos também, (b) aceitar o
  valor neutro ali, ou (c) manter a cor só onde não há % companheira. **(a) é o mais coerente
  com a regra; (c) é o mais barato.**
  **Onde — APLICA (lucro/sobra pareado com margem):** `SalesPage.tsx` (`:555` card KPI, `:687`
  cabeçalho do recibo, `:764` linha do item) · `StockPage.tsx:712` (`fg-margin-val`) ·
  `SaleModal.tsx` (`:1345` lucro do item, `:1484` total) · `MachinesPage.tsx` (`:118` lucro
  acumulado, `:221` card de ROI) · `ProfitSummary.tsx:18`.
  **NÃO aplica (mesma classe, outro significado — o ± é o sentido inteiro, não "bom × ruim"):**
  `StockPage.tsx:599` e `SuppliesTab.tsx:438` (`stock-entry-delta` = entrada × saída de material)
  · `SaleModal.tsx:1330` (preço acima × abaixo do sugerido). **Não trocar em massa** — três
  desses ficariam errados.
  **Casa bem com o [TD-014]** (tokenizar cor): é a mesma passada por `.sale-pos`/`.sale-neg`. Mas
  **não depende dele** — pode sair sozinha.

#### Alinhamento — o que o dono viu como "textos descentralizados"

- **[UX-21] As listas não têm UMA grade só** *(A1 + A2 + A3)*. Três defeitos com a mesma raiz:
  no **catálogo**, cabeçalho (`padding 0 20px`, sem borda, conteúdo **906px**) e linhas
  (`padding 14px 16px` + borda 1px, conteúdo **904px**) são grades independentes → deriva de
  **1–3px que acumula** até "AÇÕES"; as **colunas de dinheiro** são `text-align: start`, então
  `R$ 33,64` e `R$ 617,90` começam no mesmo x e a **vírgula nunca alinha** (a fonte já é mono —
  `text-align: right` resolve sozinho); e em **`/vendas` cada recibo é uma `<table>` própria em
  layout automático**, então as colunas se dimensionam pelo nome mais longo *daquele* recibo
  (**8px de deslocamento** medido entre recibos vizinhos). **Onde:** `catalog.css` ·
  `cesta-recibo.css` · `SalesPage.tsx`. ⚠ A parte do `text-align` é a de **maior retorno visual
  por linha de CSS** de todo o cluster.
- **[UX-22] No `/orcamento`, os dois cartões nunca compartilham linha de base** *(A4)*. Topo dos
  campos: esquerda `235·297·379`, direita `250·250·332·332` (**Δ15** e **Δ35**). Junto: o campo
  `type="date"` mede **37px** contra 35px do vizinho na mesma linha. **Onde:** `QuotePage.tsx` +
  `quote.css` + `forms.css`.
- **[UX-23] O texto de introdução de página tem 4 tratamentos** *(A5)*. `/estoque` espremido ao
  lado do botão · `/producao` largura inteira · `/maquinas` **dois** parágrafos (~120px antes do
  1º dado) · `/catalogo` e `/vendas` nenhum. Nunca virou componente. **Sugestão:** um
  `PageIntro` com medida de linha limitada (~70 caracteres).

#### Cor — o buraco que o UX-17 deixou

- **[TD-014] Tokenizar a COR (o UX-17a, de novo, para cor)** *(B2 + B3 + C3)*. O UX-17 tokenizou
  espaço/raio/tipografia e **parou antes da cor**. Medido: **51 hex distintos + 8 bases
  `rgba()`**; o `base.css` declara ~23 de superfície e **nenhuma semântica** (`#c4836b` 11× e
  `#e05252` 5× fazem o papel de "perigo/aviso" sem nome). E a mesma tinta aparece em **6
  opacidades** (`rgba(255,107,53,·)` em `.08/.1/.12/.2/.22/.3`) — os **órfãos** do UX-17b, agora
  em cor. Inclui a paleta do `CostBars.tsx` (6 hex crus que **não respondem ao tema**).
  ⚠ **Tem PRAZO:** esses literais **fixam o RGB do laranja** → quando a marca chegar, são 14
  edições à mão. Feito antes, o rebrand vira **troca de paleta**. **Onde:** `base.css` + os 16
  CSS + `CostBars.tsx`.
- **[UX-24] Contrastes que reprovam no AA** *(B1)*. Medido: **branco sobre `--accent` = 2,84:1**
  (é o **botão primário**, reprova nos DOIS temas) · `--muted2` **2,93** claro / **3,18** escuro
  (52 usos, e é o texto de **10–11px**) · `--accent` como texto **2,84** no claro (57 usos; no
  escuro está ok em 6,02). ⚠ **O UX-19 mediu as 3 cores de margem com todo cuidado (5,13–5,62) e
  a paleta em que elas vivem nunca foi auditada.** **Sugestão:** separar "laranja da marca" de
  "laranja que carrega texto". **Casa com o [TD-014].**
- **[UX-25] Cinco ações da lista, cinco cores** *(B4)*. vender `#5faa80` · produzir `#b8925a` ·
  orçar `#8f6bc4` · editar `#6b88c4` · excluir `#c4836b`. Nada se destaca e o Excluir não se
  distingue por cor. **Sugestão:** neutro + cor no hover, vermelho semântico só no destrutivo.

#### Gráficos e números

- **[UX-26] As barras de custo mentem a proporção** *(C1 + C2)*. `maxValue = Math.max(...items)`
  → o maior custo **sempre** desenha barra inteira. Medido no cenário base: mão de obra desenha
  **100%** sendo **40%** do custo; material **88%** sendo **35%**. O bloco termina em "Custo
  total", então o olho lê as barras como fatia dele — **e não são**. Junto: reserva de falha
  `#D2726B` e custo fixo `#C4836B` são **quase a mesma cor** em linhas vizinhas.
  **Sugestão:** normalizar pelo total, ou barra empilhada 100% (devolve as 6 linhas do bloco).
  **Onde:** `CostBars.tsx`.
- **[UX-27] `tabular-nums` em 3 lugares de um app inteiro de números** *(C4)*. Onde o valor é
  mono os dígitos já alinham; onde não é (cartões de KPI, margens, os `(76%)`) a coluna treme.
  **Correção trivial.**

#### Celular

- **[BUG-06] Em `/vendas`, parte de cada recibo é CORTADA e não dá pra alcançar** *(D1)*.
  `.recibo-card` tem `overflow: hidden`, mas a tabela de itens é mais larga que o cartão — então
  o excedente **não rola, é cortado**. Medido a 375×812 em **todos** os recibos: `clientWidth
  345px` × `scrollWidth 414…471px` = **69 a 126px cortados**. **A coluna de lucro e o botão de
  excluir não existem no telefone.** ⚠ **O [TD-013] encostou nisso e leu ao contrário** — ele
  registrou "453px (108px)" como ganho; os 108px são **exatamente o pedaço cortado**.
  **Onde:** `cesta-recibo.css`.
- **[UX-28] Os links de ação inline têm 15px de altura** *(D2)*. O UX-15 subiu os alvos do
  catálogo p/ 32px e deixou os `.link-button` de fora: "Gerenciar" `79×15`, "detalhar refugo"
  `286×15`. **Sugestão:** padding vertical até 32px **sem** mudar o tamanho do texto (o alvo
  cresce, a densidade não muda). **Onde:** `forms.css`.

#### Modais

- **[TD-015] Casca de modal compartilhada** *(E1 + E2 + E3)*. **O padrão certo já existe** — o
  `ConfirmDialog` (UX-15) e a gaveta (UX-14) fazem tudo direito; nunca foi propagado. Levantado:
  **8 dos 9** modais **sem** `role="dialog"`, **sem** `aria-modal`, **sem** nome acessível e
  **sem** Escape (`SaleModal`, `MachineManagerModal`, `StockColorModal`, `StockRollModal`,
  `StockAdjustModal`, `SupplyModal`, `SupplyLotModal`, `SupplyAdjustModal`). **Nenhum** trava a
  rolagem do fundo (`document.body` segue `overflow: visible`; a gaveta **já** trava). E no
  `SaleModal` (**774px** numa viewport de 910px, `overflow-y: auto`) o rodapé rola junto → os
  botões ficam **abaixo da dobra**, e não há **✕** no cabeçalho. **Sugestão:** extrair a casca do
  `ConfirmDialog` para um `<Modal>` com cabeçalho/rodapé fixos — resolve os três de uma vez e
  apaga 8 cópias de `.modal-overlay`.

#### Estrutura e semântica (a camada que o UX-16 não tocou)

- **[UX-29] O documento não tem sumário nem marcos** *(F1 + F2 + F3)*. Na **calculadora** o único
  título é a **MARCA** (`h1=1 "Lopo Lab", h2=0, h3=0`) — todos os nomes de seção são `<div>`; as
  outras 6 rotas já têm `<h1>` de página. No app: `h1` 10× · `h2` **1×** · `h3` 10× (todos
  `.modal-title`) → salto h1→h3. E **não existe `<nav>` nem `<header>`** (só `<main>`, esse
  correto nas 8 rotas), nem link para pular ao conteúdo. **Sugestão:** a marca vira `<div>`, o
  `<h1>` nomeia a página, e os títulos de seção que **já existem visualmente** viram `<h2>` —
  **sem mudar um pixel**, porque o estilo já vem de classe.
- **[UX-30] O preço muda em silêncio** *(F4)*. A interação central do app (mexer no dial e ver o
  número) não anuncia nada. O `FeedbackNote` **já estabeleceu** `role="status"` no projeto.
  **Sugestão:** `aria-live="polite"` no `.result-price` + `aria-valuetext` no `<input
  type="range">` (senão o valor falado é "54", não "R$ 27,14"). **Correção trivial.**

#### Formulários e controles

- **[BUG-07] Os campos de observação estão em monoespaçada por acidente** *(G1)*. `textarea`
  **não é estilizado em nenhum arquivo do app**: o reset do `base.css` cobre `button, input,
  select` e esquece dele, e o `.field-input` define `font-size` mas **não** `font-family`.
  Medido em `/orcamento`: todos os campos em **Inter 14px**, o de observações em **`monospace`
  14px**. Atinge os 2 textarea do sistema (orçamento e `SaleModal`). **Conserto de UMA palavra**
  no `base.css`.
- **[UX-31] O foco de teclado não é um sistema** *(G3)*. Nos 16 CSS: `:focus-visible` **2×**
  (`.back-to-top`, `.brand-reset`) · `:focus` 6× (campos, **todos** com `outline: none`) ·
  **botões: nenhum** → ficam com o anel padrão do navegador, fora da identidade. Os dois que têm
  foco decente são recentes: a intenção existe, não virou sistema. **Sugestão:** token de foco +
  uma regra `:focus-visible` global. É o par natural do UX-16.
- **[UX-32] O primário desabilitado parece defeito, não "ainda não"** *(G4)*.
  `background: var(--border)` + `color: var(--muted2)`, largura inteira, 45px — na calculadora
  sem nome e em `/producao` sem produto é o **maior elemento da tela**. **Sugestão:** contorno em
  vez de preenchimento + uma linha dizendo **o que falta** ("dê um nome ao produto para salvar").
- **[G2 → anexado à [DEC-05]]** — os emoji dos rótulos **não seguem regra nenhuma**: no MESMO
  formulário, `🏷️ nome da etapa`/`🎨 filamento`/`⏱ tempo`/`⚡ tarifa`/`🔢 peças`/`🎲 taxa` têm, e
  `nome do produto`/`máquina`/`cor`/`filamento (R$/kg)`/`total (g)`/`mão de obra`/`valor-hora`
  não têm. **Não é decoração deliberada, é acaso.** Ao executar a DEC-05, decidir também o
  **critério** (ou todo rótulo de seção tem ícone, ou nenhum tem).

#### Hierarquia de navegação

- **[UX-33] Dois níveis de navegação com a MESMA aparência** *(H1 + H2 + H3)*. O UX-17b deixou as
  abas do estoque "byte a byte iguais" às da NavBar — resolveu o **estilo** e criou um problema de
  **hierarquia**: "em que página estou" e "em que aba estou" ficam idênticos, a poucos pixels de
  distância. E existe um **terceiro** paradigma (o segmentado de desconto no `SaleModal`).
  Junto: "Escuro"/"Sair" ocupam uma **faixa inteira sozinhos** (~40px em toda página, p/ 2
  botões). **Sugestão:** mesma família, pesos diferentes — chip preenchido p/ página, sublinhado
  ou contorno leve p/ aba interna; e os 2 utilitários sobem para a linha do título.

#### Matemática

- **▶ [DEC-06] O que `machines` significa na capacidade?** *(I1 — **decisão, não tarefa**)*.
  O modelo do gargalo (TD-003) **já** credita o paralelismo entre máquinas distintas; depois
  disso `× machines` multiplica **de novo**, o que só vale com N cópias do conjunto inteiro.
  **Travado em teste** (`calculateCapacity.test.ts:103`): produto A1 3h + X2D 2h com
  `machines: 2` → **400 ciclos**, o que exigiria **2 A1 e 2 X2D = 4 máquinas**. A oficina tem
  **2, uma de cada**, e `DEFAULT_FIXED_COSTS.machines = 2` → **todo produto que roda nas duas
  projeta o dobro**. **As duas saídas:** (a) `machines` = "cópias idênticas em paralelo" → não
  se aplica a produto multi-máquina (**barato**); (b) `machines` = "máquinas da oficina" → o
  gargalo passa a ser por máquina **física** e o campo vira lista (**descreve a oficina real**).
- **[TD-016] O ritmo de lucro do ROI é média de vida inteira** *(I2)*.
  `profitPerMonth = lucro ÷ (agora − 1ª venda)`: um mês forte seguido de período parado faz a
  média **decair sozinha** e a projeção de payback afastar a data mesmo com ritmo recente bom.
  Responde "quanto rendeu até aqui", não "quanto rende agora". **Sugestão:** janela móvel de
  60–90 dias p/ o ritmo, mantendo o acumulado. **Não depende do [Dashboard]** — que segue dono do
  payback honesto (UX-09). **Onde:** `machineRoi.ts`.
- **[UX-34] A ressalva do payback ocupa mais tela que o dado** *(I3)*. O UX-09 pôs o aviso em 3
  pontos de propósito e **funcionou** — o efeito colateral é visual: subtítulo do KPI + caixa no
  topo + linha italic em cada cartão. **Sugestão:** manter a linha por cartão (viaja junto do
  número) e recolher a caixa do topo para um ícone com dica. **Onde:** `MachinesPage.tsx`.

### Bloqueadas por dado externo

- **[FEAT-03] Melhorar o PDF do orçamento** *(guarda-chuva)*. Ideias-semente (o dono escolhe o que vira
  tarefa): prazo de entrega, foto/thumbnail do item, formas de pagamento/condições, termos/observações,
  QR code do WhatsApp, detalhar etapas/subitens (usa FEAT-01), desconto/acréscimo, branding real.
  **Onde:** `generateQuotePdf.ts` + `QuotePage`/`config/orcamento`. Lista completa em `HISTORICO.md`.
- **[branding/logo real]** trocar o logo placeholder (impressora) pela logo real no PDF — já há
  comentário no código. Overlap com FEAT-03.
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

### Micro-item solto (herdado do UX-17b, sem onda)

- **[micro] O botão do celular em 16px** — no UX-17b campo **e** botão foram a **16px** (abaixo
  disso o iOS dá zoom ao focar o campo), o que alongou `/vendas` (**+57px**) e `/producao`
  (**+70px**). O campo **precisa** dos 16px; o botão não. Se o dono preferir o botão em **14px**,
  é **1 linha** no `responsive.css`. Fica aqui até ele decidir — não entra em onda nenhuma.

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

## Fechado

Nada aqui. Todo item concluído — com writeup e medições — vive no
[`.claude/HISTORICO.md`](HISTORICO.md): as seções `## ✅` (uma por item/cluster) e o bloco
**"📒 Arquivo do BACKLOG"** no fim, que recebeu o registro curto que vivia nesta fila até a faxina
de 2026-08-16.
