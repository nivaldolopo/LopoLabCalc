# LopoLabCalc — Orientações para o chat

> Este arquivo é lido automaticamente pelo Claude Code no início de cada conversa.
> Leia as **Diretrizes de trabalho** antes de qualquer ação.

## Status atual (contexto de continuidade)

> Foto do **AGORA** para permitir abrir um chat novo por tarefa. Manter curto e atual —
> não é histórico (o git já guarda o detalhe). Regras de tamanho na Diretriz 5.

- **Estado do site:** no ar e estável (produção `● Ready`). Acessível por
  **`calculadora.lopolab.com.br`** (domínio próprio, SSL ok) e pelo `lopolabcalc.vercel.app`.
- **Última mudança:** **DEC-01 RESOLVIDO — markup nunca incide sobre o custo fixo; toggle
  removido.** O fixo passa a ser só repassado (`variableCost × markup + fixedCost`); apagados o
  campo `markupOnFixed` (de `ProductInput`/`FixedCostSettings`), o toggle na UI (`FixedCostsPanel` +
  CSS morto), a coluna "Markup no Fixo" do CSV, e todas as referências (calc, form, repo, defaults,
  testes). Sem migração: `markupOnFixed` que sobrar no Firestore é ignorado. Como o default sempre
  foi `false`, nenhum preço muda na prática. **Opção A (cirúrgica):** mantido o comportamento
  idêntico — **pendência registrada** (ver DEC-01 abaixo): no ramo sem markup no fixo,
  `contributionMargin` desconta o fixo → é numericamente o LUCRO por peça, não a margem de
  contribuição clássica (preço − custo variável). Corrigir a semântica (opção B) mudaria o ponto de
  equilíbrio — adiado. `pnpm test` = 49 verdes, `pnpm lint` limpo. Restam da auditoria: **TD-003**
  (capacidade por-máquina, casar com Dashboard) e **TD-006** (paginação).
- **Contexto do ROI (`/maquinas`):** rota `MachinesPage` (linkada no header) cruza
  `price`/`lifeHours` com o histórico. Duas barras por cartão: **payback do investimento**
  (`lucro acumulado / price`, com projeção "faltam ~N meses / paga por volta de MÊS/ANO" pelo
  ritmo de lucro desde a 1ª venda — só projeta com ≥14 dias de histórico e lucro > 0) e **vida
  útil consumida** (`horas impressas / lifeHours`). Matemática pura em `lib/machineRoi.ts`.
- **Concluído (macro):** itens 1 e 2 do backlog — **captura de venda + histórico**
  (`/vendas`: cesta/recibo com N itens por `reciboId`, editar recibo, CSV, snapshot congelado)
  e **orçamento em PDF** (`/orcamento`: itens de catálogo/livres, `generateQuotePdf`, histórico
  na coleção `orcamentos` com re-baixar/excluir, dados do negócio no Firestore). Login Google
  restrito (`AuthGate` + regras Firestore travadas). Responsividade mobile ajustada.
- **Infra pronta:** subdomínio `calculadora.lopolab.com.br` **NO AR** (CNAME "DNS only" no
  Cloudflare + SSL Let's Encrypt + Authorized domain no Firebase). **E-mail `@lopolab.com.br`
  configurado** (DNS no Cloudflare; contexto no chat "abertura da loja", fora do repo).
- **Próximo passo:** **comparação com o Pea3D encerrada** — (1) taxa de pagamento ✅ FEITO;
  (2) ROI/payback da máquina ✅ FEITO (`/maquinas`); (3) conversão peso↔metragem de filamento
  **descartada** (o dono decidiu não implementar). Foco volta ao backlog antigo
  (**item 3 — Estoque** `/estoque`, já desbloqueado).
- **TO-DO em aberto:** (a) item 3 — **Estoque** (`/estoque`) — o "business settings persistido"
  (TD-001) já está pronto (`config/negocio`); o Estoque agrega campos nesse mesmo doc, sem
  migração; (b) item 4 — **Dashboard** (`/painel`, só vale com ~1-2 meses de vendas; incorpora
  TD-003 capacidade por-máquina/gargalo); (c) **logo real** no PDF do orçamento (placeholder hoje).
  **Auditoria do GPT: TD-001/004/005/007/008/009 FEITOS; restam TD-003 e TD-006** (no backlog, não
  descartados). Menores mantidos no backlog: numeração de orçamento derivada no browser, labor na
  reserva de falha, `window.confirm` destrutivos (mantidos nativos por decisão).
- **Decisões pendentes:** variáveis de **Preview** do Firebase não cadastradas (por decisão —
  só Production; ver Diretriz 1). Nada quebrado.

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
3. **Controle de estoque** *(rota `/estoque`)* — cadastrar spools de filamento, ímãs, parafusos,
   rolamentos, chaveiros, embalagem. Como o app já sabe o que cada job consome, dar **baixa
   automática** ao marcar a venda concluída — unindo custo + venda + estoque num fluxo só.
   **Depende do item 1.** Alto valor no dia a dia, mas exige disciplina (estoque desatualizado
   é pior que nenhum).
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

- ⬜ **[UX-01] Zero à esquerda ao reescrever campo numérico** *(prioridade baixa · pequeno)*. Ao
  **apagar** um campo numérico, ele volta a exibir `0`; ao digitar o novo número o `0` fica à
  esquerda (ex.: `05`). Só ocorre no fluxo apagar→digitar (selecionar-e-substituir funciona). É
  estético, não altera o valor final. **Causa (confirmada):** inputs são controlados com valor
  `number` e todo `onChange` faz `Number(event.target.value) || 0` → campo vazio coage para `0`.
  **Abrange todos os campos numéricos:** `ProductForm`, `AccessoriesSection`, `ExtraStagesSection`,
  `CapacityPanel`, `FixedCostsPanel`, `SaleModal`, `QuotePage`, `MachineManagerModal`. **Correção
  sugerida:** permitir string vazia no estado do input (só coagir para número no submit/blur) ou um
  helper de input numérico compartilhado — evita repetir a lógica em 8 telas.
- ⬜ **[FEAT-01] Preço por etapa (etapa como item opcional no orçamento/venda)** *(prioridade a
  definir · tamanho médio)*. Salvar/mostrar o preço calculado e proporcional de **cada etapa** do
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
- ⬜ **[FEAT-02] Gasto de filamento por cor (multicor / AMS / dual nozzle)** *(prioridade ALTA ·
  tamanho a definir)*. Permitir marcar a impressão como **monocolor ou colorida**; se colorida,
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
- ⬜ **[UX-02] Entrada de tempo de impressão em horas + minutos** *(prioridade baixa · pequeno)*. Os
  slicers dão o tempo como `11h51m` — hoje o campo aceita só horas decimais, obrigando a converter
  na mão. Permitir informar **h + min** (dois campos ou máscara). **Só UI:** o dado é guardado como
  **horas decimais** (`printHours`), então os dois campos combinam para decimal ao salvar — sem
  migração. **Onde:** os campos de entrada de tempo — `ProductForm` (produto) e `ExtraStagesSection`
  (etapas). Demais telas só exibem/leem `printHours`, não precisam mudar.
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
  Decidir depois se vale corrigir o cálculo do break-even ou só renomear a variável. Ver a NOTA no
  `calculatePricing.ts` (linha do `contributionPrice`).
- ⬜ **[UX-03] Telefone e Instagram clicáveis no PDF do orçamento** *(prioridade a definir ·
  pequeno)*. No cabeçalho do PDF, tornar o **telefone** um link de **WhatsApp** (`https://wa.me/...`)
  e o **@ do Instagram** um link pro perfil. **Hoje:** ambos são texto puro (`doc.text(...)` no loop
  de contato, `generateQuotePdf.ts:120`). **Como:** trocar por `doc.textWithLink(texto, x, y, { url })`.
  **WhatsApp:** `https://wa.me/<DDI+DDD+número>` — garantir o **55** na frente quando o telefone não
  vier com código do país (`formatPhone` já trata 10/11/13 dígitos). **Instagram:**
  `https://instagram.com/<handle>` (o `formatInstagram` já remove o `@`). Isolado em
  `generateQuotePdf.ts`.
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
- ⬜ **[UX-04] Botão "Nova venda" no topo da `/vendas`** *(prioridade a definir · pequeno-médio)*.
  Facilitar o acesso — hoje **não há** botão de nova venda na `/vendas`; o cabeçalho só tem links
  (Calculadora/Orçamento/Impressoras/tema/sair) e o `SaleModal` da página serve **só pra editar**
  recibo. Registrar venda nova obriga a ir na **calculadora → escolher produto → "Registrar venda"**
  no card de preço. **Proposta:** botão "Nova venda" no topo da `/vendas` que abre o `SaleModal` em
  **modo novo** (cesta vazia), escolhendo itens do catálogo. **O que já existe:** o `SaleModal` já é
  cesta e já tem o seletor de itens do catálogo (`catalogItems` em `SalesPage.tsx:174`, usado na
  edição) — é basicamente ligar esse ponto de entrada com um seed vazio. **Onde:** `SalesPage.tsx`
  (header-actions + estado de abertura do modal).

**Ordem sugerida do backlog (jul/2026) — inclui itens antigos + ideias novas:**

> Priorização unificada acordada no chat. Guia: barato-e-destrava primeiro; captura antes de
> análise; features grandes por dependência, não por valor. O dono ajusta quando quiser.

- **Tier 0 (limpar já — pequenos/baratos, alguns destravam):** (1) ~~**DEC-01**~~ ✅ FEITO
  (markup nunca no fixo, toggle removido); (2) **UX-04** botão "Nova venda" na `/vendas`;
  (3) **UX-03** telefone/Instagram clicáveis no PDF; (4) **UX-02** tempo em h+min; (5) **UX-01**
  zero à esquerda. **Próximo da fila: UX-04.**
- **Tier 1 (grande próximo passo):** (6) **Item 3 — Estoque** (`/estoque`, desbloqueado, destrava
  FEAT-02); (7) **FEAT-02** gasto por cor/multicor — ALTA, mas depende do Estoque → desenhar junto.
- **Tier 2 (features comerciais):** (8) **FEAT-01** preço/subitens por etapa (depois do DEC-01);
  (9) **FEAT-03** melhorar PDF do orçamento; (10) **branding/logo real** no PDF (overlap c/ FEAT-03).
- **Tier 3 (adiar até ter volume de vendas):** (11) **Item 4 — Dashboard** (`/painel`) + **TD-003**
  capacidade por-máquina; (12) **TD-006** paginação.
- **Tier 4 (menores/oportunistas):** (13) numeração de orçamento derivada no browser;
  (14) labor na reserva de falha.

## Resumo do projeto (contexto rápido)

**O que é:** aplicação web de **calculadora de precificação para impressão 3D**
(Lopo Lab). O usuário cadastra produtos (peso, horas de impressão, filamento,
energia, mão de obra, markup, acessórios, etapas extras) e o app calcula o preço
sugerido e a capacidade produtiva. Os produtos ficam salvos no Firestore e são
sincronizados em tempo real.

**Stack:**
- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript 5**
- **CSS artesanal** por área em `src/app/styles/*.css` (Tailwind foi removido — não usar)
- **Firebase 12** → **Firestore** (banco nomeado `lopo-lab-calculadora`)
- Ícones: `lucide-react`
- PDF (orçamento): `jspdf` + `jspdf-autotable` (client-side)
- Gerenciador de pacotes: **pnpm**

**Estrutura:**
```
src/
  app/                      # App Router: layout.tsx, page.tsx (calculadora),
                            #   vendas/page.tsx (histórico), orcamento/page.tsx (PDF),
                            #   globals.css (só @import) + styles/*.css (CSS por área)
  features/pricing-calculator/
    components/             # UI: PricingCalculator (raiz), ProductForm, ProductCatalog,
                            #     PricingResultCard, CapacityPanel, MachineSelector,
                            #     MachineManagerModal, FixedCostsPanel, AccessoriesSection,
                            #     ExtraStagesSection, LinksSection, Header,
                            #     SaleModal (registrar venda), SalesPage (rota /vendas),
                            #     ProfitSummary (rentabilidade compartilhada), AuthGate (login)
    hooks/                  # useProducts, usePricingForm, useMachines, useTheme, useSales,
                            #     useAuth, useQuoteConfig (negócio), useQuotes (histórico),
                            #     useFees (taxas de pagamento)
    lib/                    # calculatePricing, calculateCapacity, validateProduct, productCsv,
                            #     saleContext (foto congelada da venda — helpers puros do SaleModal),
                            #     generateQuotePdf (orçamento), paymentFees (taxa de pagamento,
                            #     testado em paymentFees.test.ts via vitest)
    constants.ts, types.ts
  lib/
    firebase/               # client.ts (init + db), productsRepository.ts (CRUD + subscribe),
                            #   machinesRepository.ts (doc config/machines, realtime),
                            #   salesRepository.ts (coleção `vendas`, snapshots congelados),
                            #   quoteConfigRepository.ts (doc config/orcamento: dados do negócio),
                            #   quotesRepository.ts (coleção `orcamentos`: histórico de orçamentos),
                            #   feesRepository.ts (doc config/taxas: taxa % por forma de pagamento)
    formatting/currency.ts
```

**Pontos-chave:**
- `src/lib/firebase/client.ts` — inicializa o Firebase e exporta `db`. Lê a config das
  variáveis `NEXT_PUBLIC_FIREBASE_*` (com fallback embutido para os valores reais).
- `src/lib/firebase/productsRepository.ts` — coleção `products` no Firestore;
  `subscribeProducts` (realtime via `onSnapshot`), `createProduct`, `saveProduct`, `removeProduct`.
- `src/lib/firebase/machinesRepository.ts` — documento único `config/machines` (campo `items`);
  `subscribeMachines` (realtime; retorna `null` se o doc não existe, p/ o hook semear/migrar) e
  `persistMachines`. O hook `useMachines` semeia do localStorage/`DEFAULT_MACHINES` na 1ª vez e
  cai pra fallback local em caso de erro. **Máquinas são compartilhadas entre dispositivos** —
  editar watts recalcula energia/desgaste de todos os produtos (que guardam só `machineId`).
- Toda a lógica de cálculo vive em `features/pricing-calculator/lib/`.

## Diretrizes de trabalho

### 1. Usar apenas o ambiente de produção
- Trabalhe sempre mirando **produção**. Não mantemos os ambientes de **Preview** nem
  **Development** da Vercel (as variáveis do Firebase só estão em **Production**).
- Ao lidar com variáveis de ambiente na Vercel, use somente o target `production`.
- Deploys são sempre de produção (push na `main` → deploy automático de produção).

### 2. Resumo para contexto
- A seção **Resumo do projeto** acima existe para acelerar a obtenção de contexto.
  **Mantenha-a atualizada** sempre que a arquitetura, a stack ou os arquivos-chave mudarem.

### 3. Commit + deploy imediatos a cada alteração
Sempre que eu (usuário) pedir e você concluir uma **alteração no código**, execute
**imediatamente**, sem esperar novo pedido:

1. **Commit** das mudanças:
   ```powershell
   git add -A
   git commit -m "<mensagem descritiva>"
   ```
2. **Push** — a integração Git nativa da Vercel deploya a produção automaticamente:
   ```powershell
   git push
   ```

> Observação: o deploy é feito pela **integração Git nativa da Vercel** (push na `main`
> → deploy de produção automático, rodando na nuvem da Vercel). **Não** rode `vercel --prod`
> no fluxo normal — isso criaria um deploy duplicado. Use o CLI só em casos pontuais
> (ex.: deployar estado local sem commit). Para acompanhar: `vercel ls` ou o painel da Vercel.

### 4. Verificação visual só quando realmente necessária
- **Não** subir servidor de dev nem abrir o navegador para "confirmar" toda alteração —
  isso gasta tempo/tokens à toa. O **usuário testa visualmente** e confirma o funcionamento.
- Para validar que o código está são, prefira o barato: `pnpm lint` (e `pnpm build` quando
  fizer sentido). Reserve a verificação no navegador para casos em que ela é de fato útil —
  ex.: lógica visual/interativa complexa que o lint/build não cobre, ou quando o usuário pedir.

### 5. Manter o "Status atual" atualizado
- Ao concluir uma mudança relevante (feature, correção, decisão de arquitetura/infra),
  **atualize a seção "Status atual"** no topo deste arquivo.
- **Regras de tamanho (para não virar changelog):**
  - Status atual **≤ ~40 linhas**. É a foto do AGORA, não histórico — o git já guarda o detalhe.
  - Registre **apenas a mudança MAIS recente** em 1-2 frases. Ao concluir uma tarefa,
    **substitua** a entrada anterior — **não** empilhe correntes `Antes: … Antes: …`.
  - Prefira consolidar em bullets estáveis ("Concluído (macro)", "TO-DO", "Próximo passo")
    a acumular parágrafos de implementação (isso mora no código e no `git log`).
- Objetivo: permitir abrir um **chat novo por tarefa** e continuar sem perder contexto,
  evitando um único chat com contexto gigante.
- **Quando atualizar o Status junto com uma alteração, faça tudo num único commit/push** —
  edite o código e o "Status atual" juntos e mande de uma vez (não dois pushes seguidos).
  Só vira commit separado quando a alteração já foi pushada e o ajuste do Status veio depois.

### 6. Sinalizar hora de trocar de chat
- Ao **concluir uma tarefa** (feature/correção fechada, commitada e pushada),
  lembre que aquele é um bom ponto de corte: sugira encerrar este chat e abrir
  um novo pra próxima tarefa (o "Status atual" já carrega o contexto).
- Se a conversa estiver visivelmente longa (muitos turnos/leituras) e ainda no
  meio de algo, avise que o contexto está grande e que pode valer finalizar um
  passo lógico e continuar em chat novo — mas **sem prometer precisão de tokens**
  (não há medidor ao vivo; o gatilho confiável é "tarefa concluída", não contagem).

## Infra / referência de deploy

- **Projeto Vercel:** `lopo-lab/lopolabcalc` (time `lopo-lab`, plano Hobby).
- **Vínculo:** já feito (`.vercel/repo.json` na raiz; pasta `.vercel` está no `.gitignore`).
- **Integração Git nativa:** **conectada** — push na `main` faz deploy de produção
  automático. Não use `vercel --prod` no fluxo normal (geraria deploy duplicado).
  Para desconectar: `vercel git disconnect`.
- **Framework:** fixado em `vercel.json` (`"framework": "nextjs"`) — necessário porque o
  projeto herdou uma config estática antiga (versão HTML única) que quebrava o build com
  *"No Output Directory named public"*.
- **Variáveis do Firebase** (`NEXT_PUBLIC_FIREBASE_*`): cadastradas na Vercel em **Production**
  — mas **ignoradas** hoje (a config do Firebase é FIXA no `client.ts`; ver Status). Podem ser
  excluídas.
- **Domínio `lopolab.com.br`:** registrado no **registro.br**, mas a **gestão de DNS foi migrada
  para o Cloudflare** (nameservers do registro.br apontando pro Cloudflare; motivo: e-mail no
  domínio). **NÃO gerenciar DNS pelo registro.br** — todos os registros (CNAME do `calculadora`,
  MX/e-mail, etc.) vão no painel do **Cloudflare**. **`calculadora.lopolab.com.br` já está NO AR**
  (CNAME → `e5d09afaf3e58d32.vercel-dns-017.com`, **"DNS only" / nuvem cinza**, nunca proxied; SSL
  Let's Encrypt emitido pela Vercel; domínio nos Authorized domains do Firebase). O contexto do
  domínio/e-mail vive em outro projeto de chat do dono ("abertura da loja"), fora deste repo.

### Ambiente Windows (evita retrabalho de PATH)
- **Node:** `C:\Program Files\nodejs` (v24). **pnpm** e **vercel** instalados globalmente.
- Em um PowerShell recém-aberto, `node`, `pnpm` e `vercel` já devem estar no PATH.
  Se algum não for reconhecido, prepende o Node à sessão:
  ```powershell
  $env:Path = 'C:\Program Files\nodejs;C:\Users\nival\AppData\Roaming\npm;' + $env:Path
  ```
- O `vercel.cmd` (via npm) fica em `C:\Users\nival\AppData\Roaming\npm\vercel.cmd`.

## Comandos úteis
```powershell
pnpm install        # instalar dependências
pnpm dev            # rodar localmente (http://localhost:3000)
pnpm build          # build de produção local
pnpm lint           # eslint
pnpm test           # vitest (testes da matemática pura, ex.: paymentFees)
vercel ls           # listar deploys
vercel --prod       # deploy manual via CLI (uso pontual; o normal é push na main)
```
