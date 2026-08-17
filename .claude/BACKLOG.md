# LopoLabCalc — Backlog (a fazer)

> **Roadmap dos itens ABERTOS + ordem de prioridade.** Curto de propósito — é o que se lê pra
> escolher/rever a próxima tarefa (não precisa do histórico pesado pra isso).
> O *porquê* / detalhe de design (D1–D8, auditoria, writeups do que já foi feito) vive em
> [`.claude/HISTORICO.md`](HISTORICO.md) — abra sob demanda ao pegar o item.
> A foto do AGORA + a próxima tarefa sugerida vivem no `CLAUDE.md`.
>
> **Tier 0, Tier 1, Tier 4, o 7e, o cluster UI/UX de 2026-08-15 e as ondas 0–3 ✅ FECHADOS.** O
> registro deles (com as medições) vive no `HISTORICO.md` — seção "📒 Arquivo do BACKLOG" e os
> writeups das ondas 1, 2 e 3. **Este arquivo só tem o que está ABERTO.**

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

> ✅ **Ondas 0, 1, 2 e 3 FECHADAS em 2026-08-16** (mesmo dia). A 0 eram as duas perguntas —
> respondidas (ver abaixo); a 1 eram os 5 consertos; a 2 era o bloco COR, com o **prazo externo da
> marca já neutralizado** (a cor virou token: o rebrand agora é troca de paleta); a 3 era grade e
> alinhamento. Writeups: `HISTORICO.md`.

| Onda | Itens | Por que aqui |
|---|---|---|
| **▶ 4 — sistema** | **[TD-015]** (8 modais) · **[UX-29]** · **[UX-31]** · **[UX-28]** · **[UX-32]** | Caro, sem prazo, alto valor estrutural. O TD-015 apaga 8 cópias de `.modal-overlay`. **O `PageHeader` da onda 3 já barateou o UX-29** (as 7 cópias de `.header` viraram uma). |
| **5 — matemática e leitura** | **[UX-26]** (só a MATEMÁTICA das barras) · **[TD-016]** · **[UX-34]** | ✅ Destravada — o **[DEC-06]** foi respondido. A parte de COR do UX-26 saiu na onda 2. |
| **fora da fila** | **[DEC-05]** (lucide) | Fazer **junto do rebrand**, não antes — ver o critério acima. |
| **⏸ bloqueadas** | **[FEAT-03]** + **[branding/logo real]** (a marca não existe) · **[Dashboard]** (precisa de ~1-2 meses de venda real) | Sempre por último; nenhuma das duas depende de decisão nossa. |

> Diretriz 7 (dados descartáveis, marco futuro) cobre o backlog inteiro → **nenhum item precisa de
> migração**. Não reordenar por causa disso.

## Itens abertos

### Cluster da auditoria de 2026-08-16 (UX-20…UX-34 · TD-014…TD-016)

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
> ✅ **A ordem SAIU (dono, 2026-08-16)** — os 21 itens foram distribuídos nas **ondas 0–5**. Ficou
> perto do que a auditoria sugeriu, com **duas divergências**: o `UX-22` não é conserto de 1 linha
> (é alinhamento → foi pra **onda 3**, não pra 1), e o `DEC-06` subiu pra **onda 0** por ser
> pergunta que travava a matemática de quem vier depois.
>
> ✅ **Ondas 0, 1, 2 e 3 fechadas no mesmo dia** — restam **6 itens** aqui.
>
> ⚠ **Continua valendo que o mérito de cada item é levantamento** — a ordem diz *quando* o bloco
> entra, não que o desenho da solução já está aprovado. As "Sugestões" escritas em cada item
> seguem sendo sugestão da auditoria, não martelo.

#### Gráficos e números

- **[UX-26 — o que SOBROU] As barras de custo mentem a proporção** *(C1; o C2, das duas cores
  quase iguais, foi fechado na onda 2)*. `maxValue = Math.max(...items)` → o maior custo **sempre**
  desenha barra inteira. Medido no cenário base: mão de obra desenha **100%** sendo **40%** do
  custo; material **88%** sendo **35%**. O bloco termina em "Custo total", então o olho lê as barras
  como fatia dele — **e não são**.
  **Sugestão:** normalizar pelo total, ou barra empilhada 100% (devolve as 6 linhas do bloco).
  ✅ A paleta já não atrapalha: as 8 categorias viraram `--cost-*` no `base.css`, respondem ao tema
  e não há mais duas cores quase iguais em linhas vizinhas. Sobrou **só a matemática**.
  **Onde:** `CostBars.tsx` (o `maxValue`, que tem um comentário apontando pra cá).

#### Celular

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

#### Formulários e controles

- **[UX-31] O foco de teclado não é um sistema** *(G3)*. Nos 16 CSS: `:focus-visible` **2×**
  (`.back-to-top`, `.brand-reset`) · `:focus` 6× (campos, **todos** com `outline: none`) ·
  **botões: nenhum** → ficam com o anel padrão do navegador, fora da identidade. Os dois que têm
  foco decente são recentes: a intenção existe, não virou sistema. **Sugestão:** token de foco +
  uma regra `:focus-visible` global. É o par natural do UX-16.
- **[UX-32] O primário desabilitado parece defeito, não "ainda não"** *(G4)*.
  `background: var(--border)` + `color: var(--muted2)`, largura inteira, 45px — na calculadora
  sem nome e em `/producao` sem produto é o **maior elemento da tela**. **Sugestão:** contorno em
  vez de preenchimento + uma linha dizendo **o que falta** ("dê um nome ao produto para salvar").
  ⚠ **Número novo (varredura da onda 3):** ele também **reprova AA** — **4,43** contra 4,5, no tema
  **claro**, em 3 rotas ("Salvar", "Gerar PDF", "Registrar produção"). Quem resolver este item já
  resolve o contraste de brinde; não vale abrir item separado.
- **[UX-35 — achado NOVO da varredura da onda 3] A faixa de margem RUIM reprova AA no escuro.**
  `.margin-bad` (a régua da DEC-04) é `rgb(224,82,82)` sobre o card sólido `rgb(26,26,46)` do tema
  escuro = **4,47** contra 4,5. **Sem tingimento no meio** — 4,47 é o valor exato, não erro de
  medida. Aparece em 10 linhas do /catalogo. É anterior à onda 3 (nenhuma linha de
  `margin-bad`/`--danger` mudou nela) e **passou batido na varredura da onda 2**.
  **Sugestão:** escurecer 1 passo o `--danger` do tema escuro, ou clarear o texto — medir no card
  sólido, que aqui é o pior fundo. **Onde:** `base.css` (o token) + `marginTier`.
  ⚠ **Armadilha ao remedir:** o `body` tem `transition: background 0.2s`. Ler contraste logo após
  trocar de tema pega a cor NO MEIO da transição e gera reprovação fantasma (na 1ª passada deu 9
  falsos positivos, um deles "1,02"). Injetar `*{transition:none}` e forçar reflow antes de ler.
- **[G2 → anexado à [DEC-05]]** — os emoji dos rótulos **não seguem regra nenhuma**: no MESMO
  formulário, `🏷️ nome da etapa`/`🎨 filamento`/`⏱ tempo`/`⚡ tarifa`/`🔢 peças`/`🎲 taxa` têm, e
  `nome do produto`/`máquina`/`cor`/`filamento (R$/kg)`/`total (g)`/`mão de obra`/`valor-hora`
  não têm. **Não é decoração deliberada, é acaso.** Ao executar a DEC-05, decidir também o
  **critério** (ou todo rótulo de seção tem ícone, ou nenhum tem).

#### Matemática

> ✅ **[DEC-06] respondido (dono, 2026-08-16) — saída (a) com aviso.** `machines` = **N cópias
> idênticas do conjunto que o produto usa**; a matemática **não muda** e o `× machines` sobre
> produto multi-máquina é intencional. O que entrou foi o **aviso** no `CapacityPanel` quando o
> produto usa >1 máquina e `machines > 1`. ⚠ Isso **não corrige** quem preencheu `machines: 2`
> pensando "tenho 2 impressoras" — torna a premissa visível. Detalhe: `HISTORICO.md`.

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
