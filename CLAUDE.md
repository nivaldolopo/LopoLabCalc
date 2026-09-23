# LopoLabCalc — Orientações para o chat

> Lido automaticamente a cada conversa. Leia as **Diretrizes de trabalho** antes de qualquer ação.
> **Três arquivos, três papéis** (Diretriz 7): este = AGORA (auto, todo turno) ·
> [`BACKLOG.md`](.claude/BACKLOG.md) = a-fazer · [`HISTORICO.md`](.claude/HISTORICO.md) = o porquê
> (pesado, sob demanda). **Não** traga o conteúdo desses dois de volta pra cá.

## Status atual (contexto de continuidade)

> Foto do **AGORA**, para abrir um chat novo por tarefa — não é histórico. Tamanho: Diretrizes 4 e 7.

- **Última mudança (2026-09-23): lote 2 da 3a (Venda) fechado** — **toda venda sai do acabado**
  ("encomenda" é só o canal); sem peça registrada → **camada de acerto** (custo do cadastro);
  acessório sem parte de produto por partes baixa na **venda do conjunto**. Writeup no
  `HISTORICO.md`; pedido pro pipeline em [`handoff/`](.claude/handoff/PEDIDO_PRINTPIPELINE.md).
- ⚠ **O site do designer é projeto próprio, fora deste repo** (writeup em
  [`HISTORICO.md`](.claude/HISTORICO.md)) — nada dele encosta neste projeto nem na base da loja, e
  daqui não se mexe lá.
- ⚠ **O pipeline de importação (histórico de impressão → CSV/JSON) virou projeto próprio em
  2026-09-21** (`LopoLabPrintPipeline`, fora deste repo — writeup em
  [`HISTORICO.md`](.claude/HISTORICO.md)). Daqui só se conhece o **formato que ele entrega** (o CSV
  que o `/catalogo` importa, o JSON que o "Importar histórico" da `/producao` lê) — o funcionamento
  interno dele não é documentado aqui, e não se mexe nele a partir daqui.
- **PRÓXIMA TAREFA DESTE PROJETO — frente 3a (dados da impressora), depois frente 3 (uso real).**
  Código S1–S13 + os V/W abertos do `BACKLOG.md` + as mudanças do pipeline, TUDO antes do marco (o
  marco pode atrasar um pouco, não muito). **Um chat por lote, na tabela "Ordem de execução do
  código" da seção 3a do `BACKLOG.md`** (✅ lotes 1–2; **próximo = lote 3, Chave de cor**:
  S11+V2+V6). Depois, a carga pelo "Processo da fase A"
  (que começa APAGANDO o teste) e o marco (Diretriz 6 expira).
  Frente 2 (Configurações) está inteira fechada.
- 🔴 **QR (fechado em 2026-09-15):** impresso/duradouro é o DONO quem gera; de um orçamento só, o
  SISTEMA gera na hora pro `wa.me/...?text=`. Regra completa (e "sem iPhone") na seção do
  `BACKLOG.md` — ainda não codado.
- ⚠ **Drive** (`G:\My Drive\Lopo Lab - Empresa\`, geral do outro agente) = marca, designer,
  planilhas, PDFs — **nunca código**. Ler é livre; escrever lá é compartilhar → só a pedido.
- **Contexto macro:** **✅ TIER 1**, **✅ [FROTA] (fases 1 e 2)**, **✅ [AUD-17]**, **✅ [AUD-18]**,
  **✅ [AUD-08]**, **✅ [TD-033]** e **✅ [FEAT-12]** — custo decomponível ponta a ponta, o PREÇO não
  depende mais de quem estava livre nem de preço congelado de insumo, e mudança global de preço não
  acontece mais calada. O que a 10ª varredura e as duas campanhas de prova acharam está corrigido.
- **Branding:** cores **amarelo + preto** e **logo pronta** (2026-09-15) — o código do rebrand espera
  a entrega do designer (frente 1). Com o `--on-accent` já criado, a troca virou paleta.
- ⚠ **NÃO REPROPOR (avaliadas e descartadas pelo dono):** `lifeHours` por máquina (**DEC-02**),
  `residualValue`, peso em **horas/dia** (D6.1), chutar a de maior peso na `/producao`, e a
  conversão **peso↔metragem**.
- ⚠ **A frota real tem TRÊS máquinas** (A1 Combo 40% · X2D Combo 40% · A1 Mini 20%, medido em
  2026-09-03) — o `DEFAULT_MACHINES` do código só tem duas, então não raciocine por ele. **Todo
  produto anterior à fase entra SEM conjunto** → frota inteira + badge de órfão (Diretriz 6 — sem
  migração; o dono recadastra).
- ⚠ **A `/producao` PERGUNTA a máquina** quando há 2+ candidatas (dono, 2026-09-01: *"vazia só
  quando há dúvida"*); sem escolher, o botão trava com o motivo na tela — não é bug. A VENDA não
  pergunta mais nada (S1): quem imprimiu sai das camadas do acabado.
- ⚠ **A frente do DONO (bloqueia a carga em massa):** cadastrar cores/insumos e religar os
  acessórios — detalhe no `BACKLOG.md`. **"Pode recadastrar?" → SIM, sem trava.** Acessório sem
  baixa *não é bug, é vínculo em branco* (`planSupplies`): ligar o `supplyId` liga a baixa.

## Resumo do projeto (contexto rápido)

**O que é:** **calculadora de precificação para impressão 3D** (Lopo Lab). Cadastra-se o produto
(peso, horas, filamento, energia, mão de obra, markup, acessórios, etapas extras) e o app calcula o
preço sugerido e a capacidade produtiva. Tudo salvo no Firestore, sincronizado em tempo real.

**Stack:** **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript 5** · **Firebase 12**
→ **Firestore** (banco `lopo-lab-calculadora`) · **CSS artesanal** por área em `src/app/styles/*.css`
(Tailwind foi removido — não usar) · `lucide-react` · PDF do orçamento com `jspdf` +
`jspdf-autotable` (client-side) · pacotes com **pnpm**.

**Estrutura:**
```
src/app/          # App Router. layout.tsx · page.tsx (calculadora) · catalogo (FEAT-07) ·
                  # vendas (histórico) · orcamento (PDF) · maquinas (ROI) · estoque · producao ·
                  # configuracoes (FEAT-12: registro de alterações; casa futura do config/) ·
                  # globals.css (só @import) + styles/*.css (CSS por área)
src/features/pricing-calculator/
  components/     # calculadora: PricingCalculator (raiz) + ProductForm + PricingResultCard +
                  #   CapacityPanel/MachineSelector/FixedCostsPanel/Accessories/ExtraStages/
                  #   Subitems/LinksSection + MachineCheckboxes (as elegíveis)
                  # uma por rota: CatalogPage(+ProductCatalog) · SalesPage · QuotePage ·
                  #   MachinesPage · ProductionPage (+ ImportProductionModal, botão "Importar
                  #   histórico") · StockPage (abas) + SuppliesTab · SettingsPage
                  # venda: SaleModal + SaleFlow (a fiação, usada pelas 2 páginas)
                  # casca: PageHeader · PageIntro · NavBar · MobilePriceBar · AuthGate ·
                  #   Modal (casca dos 9 diálogos) + os 8 que a consomem + ConfirmDialog
                  # reprecificação (FEAT-12): RepriceGate (prévia+confirmação, autônomo) ·
                  #   RepriceImpactView (o desenho do impacto, 3 telas) · RepriceNotice (aviso)
                  # compartilhados: NumberInput · ProfitSummary · SearchBox · CostBars ·
                  #   FeedbackNote · NetMarginHint · CostDetail (exporta CostBreakdownTable,
                  #   reusada por 3 rotas)
  hooks/          # useProducts · usePricingForm · useMachines · useBusinessSettings (config/
                  #   negocio — lido em 10 telas, editado só no FixedCostsPanel) · useTheme ·
                  #   useAuth · e um por coleção: useSales/useSupplies/useStock/useProduction/
                  #   useFinishedGoods/useQuotes/useQuoteConfig/useFees/useChangeLog
  lib/            # TODA a matemática, pura. calculatePricing · calculateCapacity ·
                  #   fleet (taxa de frota: média ponderada por componente +
                  #     as decisões do seletor, sobre o MARCADO VIVO) ·
                  #   validateProduct · productCsv · idTable (de-para nome→id, TSV) ·
                  #   fifo (ordem + overdraft D4) → stock (g) + supplies (unidades) ·
                  #   production (baixa por evento + custo congelado, em 3 escalas) ·
                  #   finishedGoods (camadas FIFO; SKU = subitem × cor) ·
                  #   productionPlan (produto/subitem→eventos) · productionImport (JSON externo
                  #   da Bambu → eventos historico, idempotente por "bambu:<task_id>" em `notes`) ·
                  #   saleReconciliation (passo 8 +
                  #   reverse) · marginTier (régua DEC-04) · saleContext · filaments ·
                  #   generateQuotePdf · paymentFees (bandeira × parcela, gross-up, desconto,
                  #   margem líquida)     [+ constants.ts, types.ts na raiz da feature]
src/lib/
  firebase/       # client.ts (init + db) · frozenCost.ts (o mesmo objeto vai p/ 3 coleções) ·
                  #   um repositório por coleção: products · machines (config/machines) ·
                  #   businessSettings (config/negocio) · quoteConfig · quotes · fees ·
                  #   sales (`vendas`; reconcileRecibo = 1 transação p/ as 4 coleções) ·
                  #   stock (`estoque`, doc por COR) · supplies (`insumos`, doc por INSUMO) ·
                  #   production (`producao`, N eventos + baixa na mesma transação) ·
                  #   finishedGoods (`acabados`, doc por PRODUTO) · changeLog (`alteracoes`,
                  #   append-only: 1 doc por mudança global de preço) · revGuard (trava de `rev`
                  #   otimista, AUD-18 — quem grava alavanca global chama antes de gravar)
  errors.ts       # guardOnline (barra ANTES do await) + withWriteTimeout (12s, na BORDA do
                  #   repositório — escrita nova passa por ele) + errorMessage
  cloudStatus.ts  # cloudStatusOf(metadata) + COM_METADATA — o chip de sincronização
  clipboard.ts    # copyText — erro EXPLÍCITO quando o navegador não libera
  formatting/     # currency.ts (formatCurrency/formatDecimal) · date.ts (ponte timestamp ↔
                  #   <input type="date">)
```

**Pontos-chave:**
- **CSS novo escreve TOKEN, não px nem hex** (UX-17a/b, TD-014): espaço/raio/tipografia e COR vivem
  em `:root` no `base.css`. Significado → `--danger`/`--warn`/`--success`/`--accent`; fundo tênue →
  `-soft`, fundo forte/hover → `-tint`, borda → `-line`. **Três papéis do laranja:** `--accent` só
  onde NÃO carrega letra · `--accent-text` quando É texto · `--accent-strong` sob texto branco.
  A tinta EM CIMA do accent é `--on-accent` (nunca `#fff` cru — o amarelo da marca exige preto).
  Custo → `--cost-*`. Cru só para o que não é escala (largura de grade, espessura de borda). Ação
  destrutiva se anuncia **em repouso** (UX-36); contorno de ícone é `box-shadow: inset`, nunca
  `border`.
- **Coluna flexível de grade escreve `minmax(0, 1fr)`, nunca `1fr` puro**: o mínimo implícito é o
  min-content, e `<select>`/`<input type="date">` não encolhem — a coluna estoura em vez de ceder.
- **Fileira que não cabe no celular VIRA CARTÃO, não rolagem** (UX-38/UX-40): abaixo dos ~300px
  úteis a linha quebra em faixas (receita do `.fg-part`, em 5 lugares).
- **Corte que não se anuncia vira OUTRO valor** (UX-21): faixa de nome e `<select>` têm reticências
  (`text-overflow: ellipsis`, global); faixa de número tem **piso `max(rótulo, conteúdo)` medido no
  DOM**. Coluna de número usa `.num` (direita); `tabular-nums` é global (UX-27), não redeclarar.
  ⚠ Largura que um `<select>` PEDE se mede com clone em `width: max-content`, nunca `measureText` —
  a seta nativa cobra por cima do texto.
- **Composição de custo é UM desenho só** (UX-26): `CostStack` (`CostBars.tsx`), em 3 rotas. Barra
  nova não se desenha na mão; a régua **nunca** é o maior item — é o total.
- **Cabeçalho, introdução e MODAL são COMPONENTE** — `PageHeader`, `PageIntro`, `Modal`: o `<Modal>`
  já dá papel, Escape, trava de rolagem e ✕; não escreva `.modal-overlay` na mão.
- **Título de seção é `<h2>`, não `<div>`** (UX-29) — o `base.css` zera heading, trocar a tag não
  move pixel. **Foco é `:focus-visible` + `--focus-ring`** (UX-31). **Alvo pequeno cresce por
  `padding`/`min-height` + margem negativa igual** (UX-28/UX-37): 44px no celular, 32 no desktop.
  **Botão só-ícone precisa de `aria-label`** (A11Y-01) — em fileira repetida ele **nomeia o quê**
  ("Excluir ovo fidget"), porque é lido fora de contexto visual; o `title` fica com o hover.
  Steppers `.num-spin` são exceção: `aria-hidden`, não são alvo.
  ⚠ As armadilhas medidas dessas 7 regras (tingimento a 10%, `transition` na leitura de cor, guarda
  de `grid-template-columns` em media query, `> tbody` ao desmontar tabela, especificidade do
  `@media`) estão no [`HISTORICO.md`](.claude/HISTORICO.md), em "Regras de CSS/UI".
- **Preço ligado ao Estoque lê o CADASTRO no cálculo, nunca o salvo** (7c + TD-033): cor
  (`resolveFilamentPrices`) e insumo (`resolveAccessoryPrices`) resolvem pelo id; o gravado é
  **fallback** e só volta a valer quando o id sumiu (aí acende `filamentMissing`/`supplyMissing`).
  ⚠ A lista vai **INTEIRA**, com arquivados — filtrar antes faz arquivado passar por removido.
- **Alavanca GLOBAL não grava sem prévia** (FEAT-12): máquinas, excluir máquina e custo fixo passam
  pelo `RepriceGate` (o "antes" é o da `revDoRascunho`, nunca o vivo); rolo/lote novo **conta
  depois**, com o aviso acumulado. Toda mudança vira 1 doc em `alteracoes` (resumo, nunca o
  catálogo), e o desfazer sai do `before` — **alavanca primeiro, rastro depois**, e falha do rastro
  não derruba a mudança. Campo de config que grave **a cada tecla** é reprecificação global calada:
  editar rascunho + aplicar. ⚠ **Dois `useState` do mesmo estado em duas instâncias do mesmo hook
  discordam** — estado de aparelho compartilhado entre telas é `useSyncExternalStore`, não `useState`.
- **Função que REMONTA objeto salvo copia TODO campo — ou come dado calado** (FORM-01/RT-01): o par
  `buildLoadedProduct` ⇄ `buildProductPayload` (puros e exportados, `usePricingForm.ts` /
  `lib/productPayload.ts`), o `toSavedProduct` e o `parseProductsCsv`; o que falta vira `null` no
  save seguinte. Campo novo entra em **todos** os lados no mesmo commit, gravado EXPLÍCITO (chave de
  carona num spread é a que some). ⚠ **Preço não é canário** — o teste é **diff campo a campo do
  documento** (`productPayload.test.ts` e `productCsvRoundTrip.test.ts`), e diff de célula JSON exige
  **stringify canônico** (o Firestore não preserva ordem de chave em mapa). **Valor-hora é do
  PRODUTO** e **tarifa de energia é GLOBAL** (`config/negocio`, frente 2) — nenhum dos dois é da
  etapa; o **`id` não é campo do documento**, é o caminho; o export escreve
  etapa **normalizada**, não crua. ⚠ **A importação de CSV AVISA, não engole** (CSV-05): coluna nova
  que possa falhar calada entra com a checagem dela no mesmo commit — e renomear coluna pede `alias`
  na passada EXATA, senão o nome que o app mesmo escrevia vira "lido por aproximação".
  ⚠ **Id DENTRO de JSON também é referência a conferir** (AUD-17 [E6]): ser string não é existir —
  `idsJson` recebe a frota, descarta o fantasma e avisa em classe PRÓPRIA (o conselho e o desfecho
  não são os da coluna humana). Palpite de id não tem leitura possível: descarta, não converte.
  ⚠ **Campo OPCIONAL num tipo de escrita é omissão silenciosa esperando acontecer** (AUD-02): campo
  que o repositório grava é **obrigatório**; lista vazia é a forma de dizer "nada".
- **Normalizar ANTES de validar é como o dado errado entra calado** (AUD-16 [E1]/[E2]): coluna nova
  **não corrige** valor (um `Math.max(0, …)` fazia `-1` virar 0, plausível e sem aviso) — entrega
  cru e deixa o `validateProduct`, a MESMA função do formulário, reprovar. No JSON, texto passa por
  `textoJson` e item de lista por `objetoJson`. ⚠ E **coerção cega é pior que descarte** ([E5]):
  `String(item.part)` fabricava a SKU `"[object Object]"`, que o estorno não acha. Tipo errado se
  DESCARTA, e o descarte **se anuncia** — inclusive o parcial.
- **Estoque sem lote NÃO é exceção: a dívida vira LOTE DE ACERTO** (AUD-16 [E7]) — `simulateFifo`
  precisa de um lote onde empurrar o negativo do D4. `planProduction`/`planSupplies` materializam o
  lote (0 g/un, preço do cadastro, `note`) ANTES de simular; daí em diante não há caso especial.
- **"PODE rodar" (conjunto, do produto/etapa) ≠ "RODOU" (escalar, do evento)** — as duas fases do
  [FROTA], e a regra que não se desfaz. A precificação lê `machineIds` e cobra a **taxa de frota**
  (média ponderada por `Machine.weight`, **por componente** — ratear um total só dá mistura sem
  significado); quem imprimiu sai das camadas drenadas do acabado (a venda não cria evento).
  **Um evento = uma etapa = UMA máquina.** Conjunto vazio/órfão → frota inteira + badge (TD-009);
  soma de pesos 0 → média simples (senão `NaN`). Na venda, `machineUsage` e `unattributedUnits` são
  **obrigatórios** (vazio = "sem lastro"); na CAMADA a ausência É o dado, e vazio não se grava.
  🔴 Horas sem máquina NUNCA entram no `machineUsage` com id vazio: `horas ÷ total` fecharia em 1
  sobre as conhecidas e ratearia a elas o lucro das órfãs. Evento sem máquina custa a **frota** (a
  mesma taxa do preço) e conta como órfão. Excluir produção apaga o **lote** (`submissionId`).
  ⚠ As máquinas são COMPARTILHADAS entre dispositivos (doc `config/machines`, realtime): editar
  watts/`lifeHours`/`weight` reprecifica TODOS os produtos, que guardam só os ids. `useMachines`
  semeia de `DEFAULT_MACHINES` na 1ª vez e cai pra fallback local em caso de erro. Gravar exige a
  `rev` (AUD-18) — e **a versão é capturada JUNTO do rascunho** (`useState(rev)` no modal), nunca
  lida na hora do save: o snapshot da outra aba a adianta e a trava passa batido.
  ⚠ **As 5 armadilhas que a AUD-17 mediu** (reprodução no `HISTORICO.md`): **[E1]** `machineUsage`
  escala por unidade ATRIBUÍDA, nunca vendida — só a `depreciation` denuncia (o resto é RAZÃO) ·
  **[E2]** interseção de UMA é resposta, e quem deduz é a RECONCILIAÇÃO · **[E4]/[E5]** id salvo pode
  ser FANTASMA (realtime de outro dispositivo): conte o marcado VIVO, nunca `machineIds.length` ·
  **[E3]/[E8]** qual aviso mostrar é DECISÃO, vai pro `lib/` puro (`null` ≠ `[]`; "ninguém creditado"
  ≠ "só as ambíguas") — no JSX nenhum teste a alcança.
- **Snapshot que CHEGA não é prova de servidor** (AUD-15 [E4]): offline o `onSnapshot` serve do
  cache pelo mesmo callback de sucesso. Assinatura de coleção pede `COM_METADATA` e repassa
  `snapshot.metadata`; quem decide o chip é o `cloudStatusOf` — nunca o `navigator.onLine`. ⚠ E
  `hasPendingWrites` vem ANTES de `fromCache`: o snapshot otimista de todo save vem do cache.
- Toda a lógica de cálculo vive em `features/pricing-calculator/lib/` — pura e coberta por teste.

## Diretrizes de trabalho

### 1. Ambiente: produção é o real; local e Preview usam banco de teste
- **Deploy só tem um alvo: produção** — push na `main` → ar automaticamente, sem mudar isso.
- **[DEC-07] Local (`pnpm dev`) e Preview caem no banco Firestore de TESTE**
  (`lopo-lab-calculadora-test`, mesmo projeto `lopo-lab`) — `client.ts` escolhe pelo
  `NEXT_PUBLIC_VERCEL_ENV`; produção nunca depende dessa detecção acertar (se a env faltar, o
  fallback é o comportamento de hoje — nunca o banco errado em produção).
- **`AuthGate` só pula login em `localhost`.** Preview exige login normal — e o domínio da branch
  precisa estar em Authorized Domains do Firebase Auth pra completar (sem wildcard, um por branch;
  detalhe no `BACKLOG.md`). **Eu cadastro esse domínio sozinho ao abrir um Preview novo** — você
  não precisa fazer nada pra o login funcionar lá.

### 2. Commit + deploy imediatos a cada alteração
Concluída uma **alteração no código** que eu pedi, execute **imediatamente**, sem esperar novo pedido:

```powershell
git add -A
git commit -m "<mensagem descritiva>"
git push
```

> Deploy pela **integração Git nativa da Vercel** (push na `main` → produção). **Não** rode
> `vercel --prod` no fluxo normal — deploy duplicado. Acompanhe com `vercel ls`.

### 3. Verificação visual: embutido pra local, Chrome real pra URL publicada
- **Não** abra navegador pra "confirmar" toda alteração — gasta tempo/tokens à toa. Pro código são,
  prefira o barato: `pnpm lint`, `pnpm test`, `pnpm typecheck` (e `pnpm build` quando fizer sentido).
- **Mas quando a verificação visual for de fato útil, ABRA você mesmo** — não espere eu validar.
  Típicos: layout/responsivo, medir no DOM, lógica interativa que lint/build não cobre, ou a meu
  pedido.
- **Local (`pnpm dev`): navegador embutido é o padrão de novo** ([DEC-07], 2026-09-17) — o
  `AuthGate` pula o login em `localhost`, então o embutido não esbarra mais nele (era exatamente
  isso que tinha tirado ele de uso, 2026-09-07). Suba com `preview_start`
  (`.claude/launch.json`, nunca `pnpm dev` no Bash) — a inspeção vai pro embutido em
  `http://localhost:3000`.
- **URL de fato publicada (Preview/produção): Chrome real**, via *Claude in Chrome*
  (`mcp__claude-in-chrome__*`: `tabs_context_mcp` → `tabs_create_mcp`/`navigate` +
  `read_page`/`computer`/`javascript_tool`) — a sessão Google já logada evita a tela de login a
  cada verificação. Abra **aba nova** por conversa e feche ao fim. Preview já vem com o domínio
  autorizado (Diretriz 1).
- **Login Google (AuthGate), quando precisar dele:** eu **nunca** te passo senha e você **nunca**
  digita credencial. Sessão logada → siga direto. Caiu na tela de login → **pausa e me avisa**
  ("logue aí que eu continuo").
- Terminada a verificação, **me mostre a prova** (screenshot/medição/console), não só o "funcionou".

### 4. Manter "Status atual" e "Resumo do projeto" sincronizados (regra irmã da 7)
- Concluída uma mudança relevante (feature, correção, decisão de arquitetura/infra), **atualize o
  "Status atual"** — é ele que permite abrir um **chat novo por tarefa**. Mudou arquitetura, stack
  ou arquivo-chave? **Atualize também o "Resumo do projeto".**
- **Para não virar changelog:** **≤ ~40 linhas** · só a mudança **MAIS recente**, **substituindo** a
  anterior (nada de `Antes: … Antes: …`) · bullets estáveis, não parágrafo de implementação (isso
  mora no código e no `git log`) · o **porquê** vai pro `HISTORICO.md` e o item aberto pro
  `BACKLOG.md` — **nunca** pro Status.
- **Status + código no MESMO commit/push.** Só vira commit separado se o código já foi pushado antes.
- **Status atual é só tarefa/decisão em aberto — não é referência.** Id, conta, caminho de pasta —
  fato que não muda de uma tarefa pra outra mora no `Infra/referência` ou dentro da diretriz que usa
  aquele fato, nunca aqui (foi o que inflou a seção pra 54 linhas antes da faxina de 2026-09-17).

### 5. Sinalizar hora de trocar de chat
- **Tarefa concluída** (fechada, commitada, pushada) é bom ponto de corte: sugira encerrar o chat e
  abrir um novo (o "Status atual" carrega o contexto).
- Conversa longa e ainda no meio de algo: avise que o contexto está grande e que pode valer fechar um
  passo lógico e seguir em chat novo — **sem prometer precisão de tokens** (não há medidor ao vivo;
  o gatilho confiável é "tarefa concluída", não contagem).

### 6. Dados atuais são descartáveis — priorize velocidade sobre compatibilidade
- **O histórico de hoje (catálogo, vendas, orçamentos) NÃO é o dado real** — é teste. O dono
  recadastra **tudo, inclusive os acessórios**, num **marco que ele mesmo vai anunciar** — **nunca
  presumir a data**. Logo: **nenhum item do backlog precisa de migração**, e nada se reordena por isso.
- **Na prática:** compatibilidade retroativa que custe trabalho extra ou complique o design **não se
  paga**. Vale abrir mão de migração de documento antigo, campo legado só-leitura, fallback pra dado
  sem o campo novo, round-trip de CSV velho, backfill. Nada de `window.confirm` extra nem código
  defensivo pra dado que vai ser jogado fora.
- **Como agir:** escolha o design certo primeiro; se quebrar o dado atual, **avise no chat** (o que
  quebra, o que ele recadastra) e siga — não peça permissão a cada campo.
- **Ainda vale a pena:** o que protege o dado **futuro** — escrita atômica, estorno correto, snapshot
  congelado da venda, testes da matemática. Isso é fundação, não compatibilidade.
- **Expira** quando o dono declarar a ferramenta madura e recadastrar; aí migração volta a ser
  obrigatória. Reler antes de assumir que ela ainda vale.

### 7. Manter o CLAUDE.md INTEIRO enxuto — a doc é 3 arquivos por custo de token
- **Por quê:** só o `CLAUDE.md` é **auto-carregado e re-enviado a cada turno** — cada linha aqui é
  token multiplicado pela conversa toda. Os outros dois só entram **quando eu os leio**.
- **Os 3 papéis:** `CLAUDE.md` (auto, todo turno · alvo **≤ ~380 linhas**, recalibrado 2026-09-17 —
  o Resumo de arquitetura cresceu de verdade com o projeto, não é acúmulo de lixo) = AGORA +
  próxima tarefa + stack/estrutura + diretrizes + infra + comandos, o que é preciso em TODA conversa ·
  [`BACKLOG.md`](.claude/BACKLOG.md) (curto) = só os itens **abertos** + prioridade ·
  [`HISTORICO.md`](.claude/HISTORICO.md) (pesado) = D1–D8, auditoria (TD-*) e writeups do que foi
  **concluído**, lido só quando um item precisa do *porquê*.
- **Ao concluir uma tarefa, releia o arquivo INTEIRO** e, bloco a bloco, pergunte *isto é preciso em
  TODA conversa?* Detalhe de item ou histórico **move**: o porquê/o concluído → `HISTORICO.md`; o
  a-fazer → `BACKLOG.md`. Nunca copiar de volta pra cá. Item concluído some do Status e vira `✅`
  no `HISTORICO.md`.
- ⚠ **A regra vale pros três arquivos, não só pra este.** O `BACKLOG.md` chegou a **2167 linhas**
  porque as 9 varreduras foram escritas lá e nenhuma saiu depois de fechar (faxina de 2026-08-31 →
  165). Cluster que zera **sai do backlog no mesmo commit** que o fecha.
- Esta verificação de tamanho/divisão é parte de "concluir a tarefa", igual a `lint`/`typecheck`/
  `build`/`test`.

### 8. Conferir o Airtable contra os `.md` — só quando eu pedir
- **Não é automático.** Rodar só quando eu disser algo como "analisa a Table" / "confere o
  Airtable" — não repetir a cada chat nem a cada mensagem da mesma conversa.
- Ao rodar: buscar o cartão do projeto **LopoLabCalc** (`rec72ERQgc4Ypy8CW`, base `Lopo Lab OS`
  `appQiYC4NVQy34QtH`, tabela Projects) e os cartões da tabela **Work** ligados a ele (Origem
  **Claude**); comparar Status/Próxima ação/Notas com este arquivo, o `BACKLOG.md` e o `HISTORICO.md`.
- **Achou divergência → PROPOR o ajuste no chat** (o que mudou lá, o que ajustar aqui). **Nunca
  editar `.md` ou Airtable por conta própria** — só depois que eu confirmar.
- ⚠ **Fechou/mudou uma frente → atualizar o cartão (Status + Próxima ação) no mesmo passo, mesmo
  sem eu ter pedido a conferência** — os `.md` seguem a fonte do detalhe. O projeto LopoLabCalc é
  MEU (controle total); o resto da base é do OUTRO agente do dono, que só LÊ o nosso — não tocar
  cartão/projeto de outra frente da loja.

### 9. Bug de dado/coerção primeiro passa pelo `/code-review`, não pelo navegador
- **O padrão das varreduras AUD-\* (medir na tela → commit → fix → commit) é caro pra bug que nem
  precisa de tela** — campo opcional comido no save, `String(objeto)` fabricando valor errado,
  coerção antes da validação. Isso é diff de código, não de UX.
- **Antes de abrir o Chrome pra reproduzir**, rode `/code-review` (`--high` pra alteração em
  `lib/`) no diff. Reserve a reprodução no navegador pra bug de layout/interação que só aparece
  renderizado — a classe de bug que o `/code-review` não alcança.

## Infra / referência de deploy

- **No ar em:** `calculadora.lopolab.com.br` (custom, SSL ok) e `lopolabcalc.vercel.app` (Vercel) —
  movido do "Status atual" pra cá (Diretriz 4): é fato estável, não tarefa em aberto.
- **Projeto Vercel:** `lopo-lab/lopolabcalc` (time `lopo-lab`, plano Hobby).
- **Vínculo:** já feito (`.vercel/repo.json` na raiz; pasta `.vercel` está no `.gitignore`).
- **Integração Git nativa:** **conectada** — push na `main` faz deploy de produção automático; não
  use `vercel --prod` no fluxo normal. Para desconectar: `vercel git disconnect`.
- **Framework:** fixado em `vercel.json` (`"framework": "nextjs"`) — não mexer: sem isso o projeto
  cai numa config estática herdada que quebra o build. As `NEXT_PUBLIC_FIREBASE_*` da Vercel são
  **ignoradas** (a config é FIXA no `client.ts`).
- **Domínio `lopolab.com.br`:** DNS **só no Cloudflare** — **NÃO** gerenciar pelo registro.br (onde
  é registrado). O CNAME do `calculadora` fica **"DNS only" / nuvem cinza**, nunca proxied; no ar com
  SSL. Detalhe (valores, motivo da migração): [`HISTORICO.md`](.claude/HISTORICO.md).
- ⚠ **O projeto Firebase é da conta `lopolab3d`, NÃO da `nivaldo.lopo`** — outro **perfil do
  Chrome** (`list_connected_browsers` mostra as duas); deep-link de regras redireciona, o caminho é
  Firestore → aba **Security**. Detalhe: [`HISTORICO.md`](.claude/HISTORICO.md).
- **Plano Firebase: Blaze** (pago por uso, aprovado 2026-09-17 pro [DEC-07]) — foi o que destravou o
  2º banco Firestore. Ainda **não usa** Storage nem Cloud Functions; ambos ficaram baratos de ligar
  se algum item do backlog precisar (ex.: foto do orçamento, backup agendado).

### Ambiente Windows (evita retrabalho de PATH)
- **Node:** `C:\Program Files\nodejs` (v24). **pnpm** e **vercel** instalados globalmente em
  `C:\Users\Lopo\AppData\Local\pnpm` (**máquina nova**, 2026-09-06) — num PowerShell recém-aberto os
  três já devem estar no PATH. Se algum não for reconhecido:
  ```powershell
  $env:Path = 'C:\Program Files\nodejs;C:\Users\Lopo\AppData\Local\pnpm;' + $env:Path
  ```
- **Java (só pro `pnpm test:rules`):** o emulador do Firestore é um `.jar`; **JRE 21 portátil** em
  `C:\Users\Lopo\jre-portatil\` (AUD-08), fora do PATH — antes de rodar:
  ```powershell
  $env:JAVA_HOME = 'C:\Users\Lopo\jre-portatil\jdk-21.0.12.1+1-jre'; $env:Path = "$env:JAVA_HOME\bin;" + $env:Path
  ```
- ⚠ **A CLI da Vercel está DESLOGADA aqui** — afeta só `vercel ls`/`whoami` (`vercel login` resolve).
  O **`firebase-tools`** (global, pnpm) também está deslogado — o emulador não liga, só o deploy de
  regras ligaria.
  O deploy não depende dela: push na `main` → produção pela integração Git.

## Comandos úteis
```powershell
pnpm install        # instalar dependências
pnpm dev            # rodar localmente (http://localhost:3000)
pnpm build          # build de produção local
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit — o build NÃO typa arquivo de teste (AUD-15 [E5])
pnpm test           # vitest (testes da matemática pura, ex.: paymentFees)
pnpm test:rules     # AUD-08: as REGRAS no emulador (pede o JAVA_HOME acima, não pede login); fora
                    #   do `pnpm test` de propósito — sufixo .emulator.test.ts
node scripts/provaRegrasNaProducao.mjs   # as mesmas regras contra a PRODUÇÃO, sem token
vercel ls           # listar deploys
vercel --prod       # deploy manual via CLI (uso pontual; o normal é push na main)
```
