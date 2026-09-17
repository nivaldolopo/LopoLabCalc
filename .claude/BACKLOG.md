# LopoLabCalc — Backlog (a fazer)

> **Só o que está ABERTO, mais a ordem.** Curto de propósito — é o que se lê pra escolher a próxima
> tarefa. O *porquê*, os writeups e os **onze clusters já fechados** (AUD-07…AUD-18) vivem em
> [`.claude/HISTORICO.md`](HISTORICO.md), seção **"📒 Arquivo do BACKLOG"**; abra sob demanda. A foto
> do AGORA fica no `CLAUDE.md`.
>
> **Estado em 2026-09-15: a LOGO FICOU PRONTA e o dono voltou com um plano de 5 frentes** (abaixo),
> fechado em chat de planejamento — **um chat por frente**, na ordem da tabela. A logo destrava a
> metade da [FEAT-03] que esperava marca, o [branding/rebrand] e o [DEC-05]. Antes disso: [FEAT-12]
> (2026-09-09), [TD-033], [AUD-08], [AUD-18], [AUD-17] e o [FROTA] — writeups no `HISTORICO.md`.

> ⚠ **Diretriz 6 cobre o backlog inteiro:** nenhum item precisa de migração, e nada se reordena por
> causa de dado velho — **até a frente 3** (uso real), que é o marco em que ela expira.

## ▶ PLANO 2026-09-15 — cinco frentes, um chat cada

> **Por que esta ordem:** o designer trabalha em paralelo (o pedido sai primeiro) · mudar a casa das
> configurações é barato enquanto o dado é teste e o dono aprende o lugar definitivo no 1º cadastro
> real (Configurações antes do uso real) · o Airtable e a rotina de Drive não dependem de nada.
>
> **Papéis dos lugares (decidido pelo dono):** **GitHub** = código + a cópia EXPORTADA da logo que o
> app usa · **`.md`** = spec, backlog detalhado, porquês (continua a fonte de trabalho, nada muda) ·
> **Airtable** = só PAINEL Kanban do dono · **Drive** = originais da marca, pedidos/entregas do
> designer, planilhas de cadastro, PDFs de exemplo. ⚠ **Airtable e Drive são geridos por OUTRO agente
> do dono** — aqui só se toca **o que é do LopoLabCalc**: não criar/reestruturar base, tabela ou
> pasta alheia; descobrir a estrutura existente e encaixar. Ler no Drive é livre; **escrever** lá é
> compartilhar (o designer vê) → só a pedido.

| # | Frente | Tipo | Entrega |
|---|---|---|---|
| 1 | ✅ **Designer: pedido do PDF + checklist da marca** | conversa, sem código | os dois no Drive |
| 2 | **Aba de Configurações** | desenho → código (2 chats se crescer) | tudo de config num lugar |
| 3 | **Checklist + uso real** | checklist → limpeza do dado de teste | site pronto pro cadastro de verdade |
| — | **Airtable (LopoLabCalc)** | encaixe na base do outro agente | backlog aberto espelhado como Kanban |
| — | **Drive (LopoLabCalc)** | organização da pasta do projeto | só o que é do projeto, sem código |

**Drive — onde está cada coisa** (unidade `G:`, Drive para Desktop instalado; eu leio direto):
`G:\My Drive\Lopo Lab - Empresa\` → `06_MARCA\01_ARQUIVOS_LOPO_LAB` (finais da marca; estava vazia) ·
`06_MARCA\02_COMPARTILHADO_DESIGNER` (troca com o designer) · `07_SITE_E_SISTEMAS\LopoLabCalc`
(planilhas, PDFs de exemplo; hoje só um "snapshot antigo" — cópia de doc que ficou pra trás, não
repetir). ✅ **A pasta do designer é legível pelo atalho** (`02_COMPARTILHADO_DESIGNER\Lopo Lab.lnk`
→ `G:\.shortcut-targets-by-id\1Qp5-Ostzq-61UTdZJhNL6b-tQgH8Ck9o\Lopo Lab\`): tem `.ai`/`.svg`/`.eps`/
`.jpg` (cartão de visita, elementos auxiliares, padrão, WhatsApp, QR) e a subpasta "Minha bagunça"
com os rascunhos (ideia caixa, ideia abelha). ⚠ **Não existe arquivo só da logo** — ela aparece
dentro do cartão e das artes; pedir o `.ai` isolado é o item **A2** da checklist (bloco 1b).

### 1 · Pedido do PDF ao designer — ✅ PEDIDO ENTREGUE (2026-09-15), aguarda o designer
**A logo final** é o retângulo `LOPO LAB` **sem "Impressão 3D"**, com as ondas do **giroide**; os
quadradinhos são **elementos auxiliares** (tipos de infill). Amarelo `#F2B705`, Futura Round (paga,
só na logo) + **Archivo** (OFL, embutível). O pedido está no Drive, em
`Lopo Lab\INPUT LOPO LAB\01 - Pedidos\01 - Orcamento em PDF\` (HTML + PDF, mesmo conteúdo); o
`00 - LEIA-ME.html` da raiz explica a convenção (pedido numerado ↔ entrega de mesmo nome em
`02 - Entregas do designer`). Artifact: `claude.ai/artifact/NjMbHuXmAhbpARtrF9mbQy`.

**Decidido pelo dono, vira código quando a arte chegar:**
- Entram no PDF: **prazo**, **pagamento/condições**, **observações** (era "termos"), **desconto**,
  **partes/etapas**, **comentário por item** (texto livre na hora), **foto por item** e **QR + link**
  do WhatsApp. Cabeçalho: telefone · `@lopo_lab` · `contato@lopolab.com.br` (site quando existir).
- **Bloco vazio não imprime**, e cada opcional (pagamento, prazo, observações, QR, foto) tem chave
  "sair no PDF" por orçamento; o texto padrão mora nas Configurações (frente 2) e não se apaga.
  Fixos: logo, número, cliente, itens, total.
- **Prazo:** o sistema SUGERE (horas → dias, arredonda pra cima, folga de pós-processamento e
  **mínimo** configurável) e o digitado do dono **manda**. Nunca sair em horas.
- **QR:** `wa.me/...?text=` com "quero **falar sobre** o orçamento nº X" (texto curto, senão o código
  fica denso demais pro papel); o chamado impresso segue "Aprovar pelo WhatsApp", e o **link também
  vai escrito** (clicável). Precisa de lib de QR nova.
- **Foto:** comprimida no cliente (~1000px, ~80–150 KB) e salva em **doc separado** do orçamento
  (não no doc do orçamento, que a lista assina) — evita o Storage, que exige Blaze.
- **Fonte:** **Archivo embutida** (carregada só ao gerar o PDF), o que de quebra mata o limite
  cp1252; a Futura Round só dentro da imagem da logo.
- ⚠ O pedido diz **não** mandar PDF de fundo pronto: o que serve é gabarito de medidas (mm) +
  tipografia (pt) + peças isoladas (SVG/PNG transparente) + página 2.
### 1b · Checklist geral da marca — ✅ ENTREGUE (2026-09-15), com a frente 1 fechada
`00 - CHECKLIST DA MARCA.html` na **raiz** do `INPUT LOPO LAB` (o LEIA-ME já aponta pra ela).
Artifact: `claude.ai/artifact/6tRp2pVZRQdgSj8jNo319X`. **Revisão 2 (2026-09-15): 30 itens em 6 blocos
e 3 levas**, caixinhas no `localStorage` de quem abre; linhas **"só responder"** não pedem arte. Não
é pedido — cada bloco vira pedido numerado quando chegar a vez. ⚠ **Toda revisão escreve o que
entrou/mudou/saiu** no bloco "O que mudou nesta lista", com data — foi pedido do dono.
- **Bloco A (destrava o resto):** qual arquivo é a logo final · o `.ai` só dela · o que são as artes
  de WhatsApp · o padrão em vetor ladrilhável · nomear os 5 infills.
- **1ª leva — kit base + site/app:** cores (HEX/RGB/CMYK), pesos da Archivo, **símbolo sozinho** e a
  **versão miúda** (16–32px), respiro/tamanho mínimo, usos proibidos, resumo em PDF · favicon
  SVG+32, ícone Android 192/512 + recorte no **círculo de 80%**, **símbolo pro quadrado de 36×36
  (raio 10) e/ou a marca em SVG no lugar do nome escrito** — medido no cabeçalho em 15/09 —, nas
  duas tintas (`#0f0f1a` e `#fafaf7`), marca de login ~120px, `theme-color` por tema. ⚠ Pergunta
  aberta que vira token: **o `#F2B705` muda no tema escuro?** O sistema guarda um valor por tema.
- **2ª leva:** Instagram (perfil 1080, 6 capas de destaque, 2 modelos de post 1080×1350, story,
  assinatura de foto) · WhatsApp (perfil 640, cartão de boas-vindas, moldura de catálogo 1000×1000,
  **desenho** do QR de vitrine). **3ª leva:** Google (logo 720×720, capa 1024×576, guia de foto) e a
  imagem de link 1200×630, que só vale quando existir **site público** (o sistema é interno).
- **Fora por enquanto:** embalagem, adesivo, cartão de agradecimento, camiseta, sinalização.
- 🔴 **QR CODE — a regra, fechada em 2026-09-15.** Depende de o código ser **duradouro** ou
  **descartável**:
  - **Impresso e duradouro** (cartão, vitrine, adesivo, embalagem): **quem gera é o DONO**, sempre
    apontando pro **endereço fixo dele**, que redireciona depois sem reimprimir nada. Do designer
    vem só o desenho em volta. Nada disso nasce no código.
  - **De um orçamento só:** o **sistema gera na hora**, direto pro `wa.me/...?text=` com o nº do
    orçamento na mensagem. Redirecionador não serve aqui: a mensagem muda a cada orçamento, e cada
    um exigiria um link novo cadastrado na mão — trabalho sem fim para um papel que vale 7 dias.
    Gerar no navegador ainda tira um salto do caminho (menos coisa para dar errado na leitura).
- ⚠ **Sem iPhone:** o sistema roda no computador e no **Android** do dono, mais ninguém usa — não
  gastar ícone, teste nem CSS com iOS.
- ⚠ **Tom da lista (pedido do dono):** o designer (**Hermes**) é **amigo e dono da loja vizinha**
  (República Ludóvico, boardgame). Profissional, sim, mas a lista se apresenta como **sugestão** —
  "quem manda no design é ele" — e os dois pedem coisa um pro outro com liberdade.

> ⚠ **O site do designer virou projeto próprio, fora deste repo** — writeup breve no
> [`HISTORICO.md`](HISTORICO.md). Nada dele encosta neste backlog.

### 2 · Aba de Configurações — mover o `config/` pra `/configuracoes`
⚠ **2026-09-16: a 1ª conta de energia real da loja já está disponível** (dono) — usar pra calibrar
a tarifa de energia da precificação (hoje estimada) em vez do chute; pedir/ler a fatura na hora de
desenhar esta frente, sem presumir o valor antes disso.

Inventário de 2026-09-15 (conferir no código antes de desenhar):

| Config | Onde se edita hoje | Doc |
|---|---|---|
| Máquinas (frota, watts, pesos) | modal da calculadora | `config/machines` |
| Custo fixo + capacidade | `FixedCostsPanel` na calculadora | `config/negocio` |
| Taxas de pagamento | modal no fluxo de venda (`SaleFlow`/`SalesPage`) | `config/taxas` |
| Dados do negócio | página Orçamento | `config/orcamento` |
| Registro de alterações | já em `/configuracoes` | `alteracoes` |
| **Fixos no código** | `constants.ts` | validade do orçamento (7), falha padrão (3%), manutenção/h, pagamento/canal padrão, 3 parcelas |

- **A decisão por item:** mover de vez · deixar nos dois · **editar só lá + resumo com atalho no
  lugar de uso** (ex.: taxa do cartão visível na venda). Pesar o que se perde: o custo fixo na
  calculadora mostra o preço reagindo; a taxa na venda corrige no meio da venda.
- ⚠ Já decidido: a página entra pelo ⚙ **fora das abas**. Máquinas e custo fixo **passam pelo
  `RepriceGate`** onde quer que morem (FEAT-12). Mudar a casa **não muda o caminho do doc**.
- Os campos novos do PDF (prazo/pagamento/termos padrão) nascem **já na casa nova**.

### 3 · Checklist e uso real
- **O que se apaga** (dado de teste): `products`, `vendas`, `orcamentos`, `estoque`, `insumos`,
  `acabados`, `producao`, `alteracoes`, `config/orcamentoSeq` — conferir coleção por coleção, e o
  que o dono **já cadastrou de verdade** antes não pode ir junto.
- **Ordem do cadastro real:** máquinas (a frota real tem 3) → custo fixo/capacidade → taxas → dados
  do negócio → cores e insumos → catálogo (planilha, ver "A frente do DONO") → acessórios religados.
- **A Diretriz 6 expira aqui** — o dono anuncia o marco; a partir dele, migração é obrigatória.
- Pendências de prova que o uso real exercita: import >500, Excel/LibreOffice real.

### Airtable e Drive (LopoLabCalc)
- **✅ Airtable (2026-09-15):** o projeto **LopoLabCalc** ficou com 12 cartões na Work — um por
  frente, não por item técnico (lacunas de prova e ressalvas NÃO vão). O projeto duplicado "Site Lopo
  Lab" foi **arquivado** (era o mesmo sistema) e seus 2 cartões vieram pra cá. Opção **Claude**
  criada no campo Origem. Quem fecha item aqui atualiza lá no mesmo passo. **Sem visão Kanban, e não
  precisa** (dono): ele não abre o Airtable — acompanha pelo outro agente, que lê os cartões. Por
  isso o que importa é o TEXTO de Status e Próxima ação estar certo.
- **Drive:** só a pasta `07_SITE_E_SISTEMAS\LopoLabCalc` e o que for do projeto em `06_MARCA`.
  Código **não** vai pro Drive (GitHub já é a nuvem dele; `node_modules`/`.git` sincronizando
  corrompem).

> **[AUD-08] FECHADA em 2026-09-08, sem resíduo** — as regras estão provadas nas **três** pontas:
> produção sem token (403 em 18/18 sondas), o texto do `firestore.rules` (119 testes no emulador, 12
> identidades, mutação conferida) e o **ruleset publicado** (diff mecânico contra o Console: 17
> linhas, idênticas). **A 2ª conta Google nunca foi necessária** — o emulador forja identidade.
> Writeup no `HISTORICO.md`.

> **[FEAT-12] FECHADA em 2026-09-09, sem resíduo de código** — as 6 peças entregues: a lib pura
> (`repriceImpact.ts`), o passo de confirmação autônomo (`RepriceGate`), o aviso acumulado nas portas
> do estoque, a página `/configuracoes` (⚙ fora das abas), a coleção `alteracoes` (com sonda nomeada
> no `pnpm test:rules`) e o desfazer derivado do registro. **Um resíduo de DADO, declarado:** duas
> entradas de teste ficaram no `alteracoes` de produção — registro honesto de mudanças que de fato
> aconteceram, e a coleção é append-only de propósito. Writeup no `HISTORICO.md`.
>
> ⚠ **O que ela NAO fez, e não era escopo:** mover os painéis de config existentes
> (`config/machines`, `config/negocio`, `config/taxas`, `config/orcamento`) para a `/configuracoes`.
> A página registra o destino; a mudança de casa é outro item, e só se justifica quando o dono
> quiser. `config/taxas` seguiu fora do controle de reprecificação por decisão: ele move a dica de
> margem líquida, não a etiqueta.

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

- **[FEAT-03] inteira** → frente 1 do PLANO, no topo (a logo ficou pronta em 2026-09-15). Lista
  completa em `HISTORICO.md`.
- **[branding/rebrand]** paleta + logo real *(engloba o antigo "[branding/logo real]": trocar o
  placeholder de impressora no PDF, que já tem comentário no código)*. **✅ Desbloqueado (2026-09-15):
  a logo está pronta** — o código espera a entrega da frente 1. **Leva junto a [DEC-05]** (lucide) e
  a logo do **[FEAT-03]**.
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

## Fechado

Nada aqui. Todo item concluído — com writeup e medições — vive no
[`.claude/HISTORICO.md`](HISTORICO.md): as seções `## ✅` (uma por item/cluster) e os dois blocos
**"📒 Arquivo do BACKLOG"** (a faxina de 2026-08-16 e a de 2026-08-31, esta com os nove clusters de
varredura na íntegra).
