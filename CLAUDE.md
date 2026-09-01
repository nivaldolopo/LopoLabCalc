# LopoLabCalc — Orientações para o chat

> Lido automaticamente a cada conversa. Leia as **Diretrizes de trabalho** antes de qualquer ação.
> **Três arquivos, três papéis** (Diretriz 8): este = AGORA (auto, todo turno) ·
> [`BACKLOG.md`](.claude/BACKLOG.md) = a-fazer · [`HISTORICO.md`](.claude/HISTORICO.md) = o porquê
> (pesado, sob demanda). **Não** traga o conteúdo desses dois de volta pra cá.

## Status atual (contexto de continuidade)

> Foto do **AGORA**, para abrir um chat novo por tarefa — não é histórico. Tamanho: Diretrizes 5 e 8.

- **Estado do site:** no ar em `calculadora.lopolab.com.br` (SSL ok) e `lopolabcalc.vercel.app`.
- **Última mudança (2026-09-01): [FROTA] Fase 1 fechada — o ROI atribui por quem IMPRIMIU.**
  Uma linha por **etapa** (conserta o `printedCount`) · `submissionId` liga o lote e **excluir
  qualquer card apaga o lote inteiro** · a camada carrega a repartição, a venda a congela na
  reconciliação · saíram `sale.machineId`/`machineName` e a máquina do `SaleModalContext` · caiu o
  malabarismo "depreciação real na proporção da precificada". **O preço não mudou, e há teste
  literal disso** (`frotaFase1.test.ts`; 848/848 no total).
  ⚠ **Avaliadas e DESCARTADAS, não repropor:** mexer em `lifeHours` (é o **DEC-02** do dono) e criar
  `residualValue` — ajustar entrada depois de ver a saída é encaixar premissa no resultado querido.
- **Contexto macro:** **✅ TIER 1 FECHADO** — Estoque + FEAT-01/02/04/05 + passo 8 (venda virou
  **reconciliação**; a **primitiva de baixa mora na PRODUÇÃO**). Custo real **decomponível ponta a
  ponta** (produção → acabado → venda), e o ROI já o lê — agora pela máquina certa.
- **⏸ branding ADIADO (dono, 2026-08-12):** **cores saíram (amarelo + preto)**, a **logo não** —
  destrava quando o dono avisar. Com o `--on-accent` já criado, a troca virou paleta.
- **▶ PRÓXIMA TAREFA — [FROTA] Fase 2 (a taxa de frota, o PREÇO).** `machineId` vira **conjunto** ·
  **cada componente com a sua média ponderada**, nunca ratear um total · `Machine.weight` em **%
  puro** (30/40/30; horas criariam 2ª fonte da verdade — D6.1) · peso zero → média simples · o
  round-trip (FORM-01/CSV-05) é a maior parte do trabalho. ⚠ **A trava de preço da Fase 1 VAI mudar
  de propósito** — recalcular os literais faz parte da tarefa. **Escopo: `BACKLOG.md`.** FEAT-03 sem
  logo e regras do Firestore seguem disponíveis, sem competir.
- ⚠ **A frente do DONO:** cadastrar **cores e insumos**, **religar os acessórios** e passar os ids
  pro sistema externo dele — a spec sai **comigo no chat** depois do cadastro (detalhe no
  `BACKLOG.md`). ⚠ **"Pode recadastrar?" → SIM, sem trava.** ⚠ Acessório sem baixa *não é bug, é
  vínculo em branco* (`planSupplies`): ligar o `supplyId` no formulário liga a baixa, sem código novo.
- **Infra pronta:** login Google restrito (`AuthGate` + regras travadas); DNS na seção "Infra".
- **Decisão encerrada:** conversão peso↔metragem **descartada** pelo dono (não repropor).

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
                  # globals.css (só @import) + styles/*.css (CSS por área)
src/features/pricing-calculator/
  components/     # calculadora: PricingCalculator (raiz) + ProductForm + PricingResultCard +
                  #   CapacityPanel/MachineSelector/FixedCostsPanel/Accessories/ExtraStages/
                  #   Subitems/LinksSection
                  # uma por rota: CatalogPage(+ProductCatalog) · SalesPage · QuotePage ·
                  #   MachinesPage · ProductionPage · StockPage (abas) + SuppliesTab
                  # venda: SaleModal + SaleFlow (a fiação, usada pelas 2 páginas)
                  # casca: PageHeader · PageIntro · NavBar · MobilePriceBar · AuthGate ·
                  #   Modal (casca dos 9 diálogos) + os 8 que a consomem + ConfirmDialog
                  # compartilhados: NumberInput · ProfitSummary · SearchBox · CostBars ·
                  #   FeedbackNote · NetMarginHint · CostDetail (exporta CostBreakdownTable,
                  #   reusada por 3 rotas)
  hooks/          # useProducts · usePricingForm · useMachines · useTheme · useAuth · e um por
                  #   coleção: useSales/useSupplies/useStock/useProduction/useFinishedGoods/
                  #   useQuotes/useQuoteConfig/useFees
  lib/            # TODA a matemática, pura. calculatePricing · calculateCapacity ·
                  #   validateProduct · productCsv · idTable (de-para nome→id, TSV) ·
                  #   fifo (ordem + overdraft D4) → stock (g) + supplies (unidades) ·
                  #   production (baixa por evento + custo congelado, em 3 escalas) ·
                  #   finishedGoods (camadas FIFO; SKU = subitem × cor) ·
                  #   productionPlan (produto/subitem→eventos) · saleReconciliation (passo 8 +
                  #   reverse) · marginTier (régua DEC-04) · saleContext · filaments ·
                  #   generateQuotePdf · paymentFees (bandeira × parcela, gross-up, desconto,
                  #   margem líquida)     [+ constants.ts, types.ts na raiz da feature]
src/lib/
  firebase/       # client.ts (init + db) · frozenCost.ts (o mesmo objeto vai p/ 3 coleções) ·
                  #   um repositório por coleção: products · machines (config/machines) ·
                  #   quoteConfig · quotes · fees · sales (`vendas`; reconcileRecibo = 1
                  #   transação p/ as 4 coleções) · stock (`estoque`, doc por COR) ·
                  #   supplies (`insumos`, doc por INSUMO) · production (`producao`, N eventos +
                  #   baixa na mesma transação) · finishedGoods (`acabados`, doc por PRODUTO)
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
  úteis a linha quebra em faixas (receita do `.fg-part`, hoje em 5 lugares). Rolar de lado esconde
  justamente a coluna que se quer ler.
- **Corte que não se anuncia vira OUTRO valor** (UX-21): faixa de nome e `<select>` têm reticências
  (`text-overflow: ellipsis`, global); faixa de número tem **piso `max(rótulo, conteúdo)` medido no
  DOM**. Coluna de número usa `.num` (direita); `tabular-nums` é global (UX-27), não redeclarar.
  ⚠ Largura que um `<select>` PEDE se mede com clone em `width: max-content`, nunca `measureText` —
  a seta nativa cobra por cima do texto.
- **Composição de custo é UM desenho só** (UX-26): `CostStack` (em `CostBars.tsx`), consumido por 3
  rotas. Barra nova não se desenha na mão; e a régua **nunca** é o maior item — é o total.
- **Cabeçalho, introdução e MODAL são COMPONENTE** — `PageHeader`, `PageIntro`, `Modal`. Modal novo
  não escreve `.modal-overlay` na mão: usa o `<Modal>` e ganha papel, Escape, trava de rolagem e ✕.
- **Título de seção é `<h2>`, não `<div>`** (UX-29) — o `base.css` zera heading, trocar a tag não
  move pixel. **Foco é `:focus-visible` + `--focus-ring`** (UX-31), de graça. **Alvo pequeno cresce
  por `padding`/`min-height` + margem negativa igual** (UX-28/UX-37): 44px no celular, 32 no
  desktop. **Botão só-ícone precisa de `aria-label`** (A11Y-01) — e em fileira repetida ele **nomeia
  o quê** ("Excluir ovo fidget"), porque é lido fora de qualquer contexto visual; o `title` fica com
  o texto curto do hover. Steppers `.num-spin` são exceção: `aria-hidden`, não são alvo.
  ⚠ As armadilhas medidas dessas 7 regras (tingimento a 10%, `transition` na leitura de cor, guarda
  de `grid-template-columns` em media query, `> tbody` ao desmontar tabela, especificidade do
  `@media`) estão no [`HISTORICO.md`](.claude/HISTORICO.md), em "Regras de CSS/UI".
- **Máquinas são compartilhadas entre dispositivos** (doc `config/machines`, realtime): editar
  watts/`lifeHours` recalcula energia e desgaste de TODOS os produtos, que guardam só o `machineId`.
  `useMachines` semeia de `DEFAULT_MACHINES` na 1ª vez e cai pra fallback local em caso de erro.
- **Função que REMONTA objeto salvo copia TODO campo — ou come dado calado** (FORM-01/RT-01): o par
  `buildLoadedProduct` ⇄ `buildProductPayload` (puros e exportados, `usePricingForm.ts` /
  `lib/productPayload.ts`), o `toSavedProduct` e o `parseProductsCsv`; o que falta vira `null` no
  save seguinte. Campo novo entra em **todos** os lados no mesmo commit.
  ⚠ **Preço não é canário** (o `supplyId` sumia sem mover um centavo): o teste é **diff campo a
  campo do documento** — `productPayload.test.ts` (form) e `productCsvRoundTrip.test.ts` (CSV); e
  diff de célula JSON exige **stringify canônico** (o Firestore não preserva ordem de chave em mapa,
  e comparar o texto dá falso positivo). **Tarifa e valor-hora são do PRODUTO**, nunca da etapa. O
  **`id` não é campo do documento** — é o caminho. O export escreve etapa **normalizada**, não crua.
  ⚠ **A importação de CSV AVISA, não engole** (CSV-05): coluna nova que possa falhar calada entra
  com a checagem dela no mesmo commit. ⚠ **Campo OPCIONAL num tipo de escrita é omissão silenciosa
  esperando acontecer** (AUD-02): o `SaleModal` montava o `ReciboWrite` sem `supplyUpdates` e o
  TypeScript não reclamava — a venda não debitava insumo. Campo que o repositório grava é
  **obrigatório**; lista vazia é a forma de dizer "nada".
- **Normalizar ANTES de validar é como o dado errado entra calado** (AUD-16 [E1]/[E2]): coluna nova
  **não corrige** valor (um `Math.max(0, …)` fazia `-1` virar 0, plausível e sem aviso) — entrega
  cru e deixa o `validateProduct`, a MESMA função do formulário, reprovar. No JSON, texto passa por
  `textoJson` e item de lista por `objetoJson`. ⚠ E **coerção cega é pior que descarte** ([E5]):
  `String(item.part)` fabricava a SKU `"[object Object]"`, que o estorno não acha. Tipo errado se
  DESCARTA, e o descarte **se anuncia** — inclusive o parcial.
- **Estoque sem lote NÃO é exceção: a dívida vira LOTE DE ACERTO** (AUD-16 [E7]) — `simulateFifo`
  precisa de um lote onde empurrar o negativo do D4. `planProduction`/`planSupplies` materializam o
  lote (0 g/un, preço do cadastro, `note`) ANTES de simular; daí em diante não há caso especial.
- **Atribuir MÁQUINA é papel da RECONCILIAÇÃO, não da precificação** ([FROTA] Fase 1): a
  precificação diz onde o produto *pode* rodar; quem *imprimiu* sai dos eventos (encomenda) ou das
  camadas drenadas (acabado). **Um evento = uma etapa.** Na venda, `machineUsage` e
  `unattributedUnits` são **obrigatórios** (vazio = "sem lastro"); na CAMADA a ausência É o dado, e
  vazio não se grava. 🔴 Sem `unattributedUnits` o D4 vira atribuição invisível (`horas ÷ total`
  soma 1 e ratearia o lucro das órfãs). Excluir produção apaga o **lote** (`submissionId`).
- **Snapshot que CHEGA não é prova de servidor** (AUD-15 [E4]): offline o `onSnapshot` serve do
  cache pelo mesmo callback de sucesso. Assinatura de coleção pede `COM_METADATA` e repassa
  `snapshot.metadata`; quem decide o chip é o `cloudStatusOf` — nunca o `navigator.onLine`. ⚠ E
  `hasPendingWrites` vem ANTES de `fromCache`: o snapshot otimista de todo save vem do cache.
- Toda a lógica de cálculo vive em `features/pricing-calculator/lib/` — pura e coberta por teste.

## Diretrizes de trabalho

### 1. Usar apenas o ambiente de produção
- **Só existe produção.** Preview e Development da Vercel não são mantidos (as variáveis do Firebase
  só estão em **Production**) — use sempre o target `production`, e todo deploy é de produção
  (push na `main` → deploy automático).

### 2. Resumo para contexto
- A seção **Resumo do projeto** acima existe para acelerar a obtenção de contexto. **Mantenha-a
  atualizada** sempre que a arquitetura, a stack ou os arquivos-chave mudarem.

### 3. Commit + deploy imediatos a cada alteração
Concluída uma **alteração no código** que eu pedi, execute **imediatamente**, sem esperar novo pedido:

```powershell
git add -A
git commit -m "<mensagem descritiva>"
git push
```

> O deploy é da **integração Git nativa da Vercel** (push na `main` → produção, na nuvem deles).
> **Não** rode `vercel --prod` no fluxo normal — geraria deploy duplicado. Acompanhe com `vercel ls`.

### 4. Verificação visual: pode abrir o site — o login é um handshake comigo
- **Não** abra o navegador pra "confirmar" toda alteração — gasta tempo/tokens à toa. Pro código são,
  prefira o barato: `pnpm lint`, `pnpm test`, `pnpm typecheck` (e `pnpm build` quando fizer sentido).
- **Mas quando a verificação visual for de fato útil, ABRA você mesmo** — não espere eu validar.
  Típicos: layout/responsivo, medir no DOM, lógica interativa que lint/build não cobre, ou a meu
  pedido. Use o **navegador embutido** (`preview_start` + `read_page`/`computer`/`javascript_tool`);
  pra rodar local, `.claude/launch.json` (nunca `pnpm dev` no Bash).
- **Login Google (AuthGate):** eu **nunca** te passo senha e você **nunca** digita credencial. Sessão
  logada → siga direto. Caiu na tela de login → **pausa e me avisa** ("logue aí que eu continuo").
- Terminada a verificação, **me mostre a prova** (screenshot/medição/console), não só o "funcionou".

### 5. Manter o "Status atual" atualizado (regra irmã da 8)
- Concluída uma mudança relevante (feature, correção, decisão de arquitetura/infra), **atualize o
  "Status atual"** — é ele que permite abrir um **chat novo por tarefa**.
- **Para não virar changelog:** **≤ ~40 linhas** · só a mudança **MAIS recente**, **substituindo** a
  anterior (nada de `Antes: … Antes: …`) · bullets estáveis, não parágrafo de implementação (isso
  mora no código e no `git log`) · o **porquê** vai pro `HISTORICO.md` e o item aberto pro
  `BACKLOG.md` — **nunca** pro Status.
- **Status + código no MESMO commit/push.** Só vira commit separado se o código já foi pushado antes.

### 6. Sinalizar hora de trocar de chat
- **Tarefa concluída** (fechada, commitada, pushada) é bom ponto de corte: sugira encerrar o chat e
  abrir um novo (o "Status atual" carrega o contexto).
- Conversa longa e ainda no meio de algo: avise que o contexto está grande e que pode valer fechar um
  passo lógico e seguir em chat novo — **sem prometer precisão de tokens** (não há medidor ao vivo;
  o gatilho confiável é "tarefa concluída", não contagem).

### 7. Dados atuais são descartáveis — priorize velocidade sobre compatibilidade
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

### 8. Manter o CLAUDE.md INTEIRO enxuto — a doc é 3 arquivos por custo de token
- **Por quê:** só o `CLAUDE.md` é **auto-carregado e re-enviado a cada turno** — cada linha aqui é
  token multiplicado pela conversa toda. Os outros dois só entram **quando eu os leio**.
- **Os 3 papéis:** `CLAUDE.md` (auto, todo turno · alvo **≤ ~270 linhas**) = AGORA + próxima tarefa +
  stack/estrutura + diretrizes + infra + comandos, o que é preciso em TODA conversa ·
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

## Infra / referência de deploy

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

### Ambiente Windows (evita retrabalho de PATH)
- **Node:** `C:\Program Files\nodejs` (v24). **pnpm** e **vercel** instalados globalmente — num
  PowerShell recém-aberto os três já devem estar no PATH. Se algum não for reconhecido:
  ```powershell
  $env:Path = 'C:\Program Files\nodejs;C:\Users\nival\AppData\Roaming\npm;' + $env:Path
  ```

## Comandos úteis
```powershell
pnpm install        # instalar dependências
pnpm dev            # rodar localmente (http://localhost:3000)
pnpm build          # build de produção local
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit — o build NÃO typa arquivo de teste (AUD-15 [E5])
pnpm test           # vitest (testes da matemática pura, ex.: paymentFees)
vercel ls           # listar deploys
vercel --prod       # deploy manual via CLI (uso pontual; o normal é push na main)
```
