# LopoLabCalc — Orientações para o chat

> Este arquivo é lido automaticamente pelo Claude Code no início de cada conversa.
> Leia as **Diretrizes de trabalho** antes de qualquer ação.
> **Três arquivos, três papéis** (ver Diretriz 8): este `CLAUDE.md` = foto do AGORA + próxima tarefa
> (auto, todo turno) · [`.claude/BACKLOG.md`](.claude/BACKLOG.md) = a-fazer/roadmap (leia pra escolher
> tarefa; curto) · [`.claude/HISTORICO.md`](.claude/HISTORICO.md) = feito + decisões D1–D8 + auditoria
> (leia sob demanda pro *porquê*; pesado). **Não** traga o conteúdo desses dois de volta pra cá.

## Status atual (contexto de continuidade)

> Foto do **AGORA** para abrir um chat novo por tarefa. Curto e atual — não é histórico (o git guarda
> o detalhe; o `HISTORICO.md` guarda o porquê). Regras de tamanho nas Diretrizes 5 e 8.

- **Estado do site:** no ar e estável (produção `● Ready`), em `calculadora.lopolab.com.br`
  (domínio próprio, SSL ok) e `lopolabcalc.vercel.app`.
- **Última mudança:** **Lotes A e B da AUD-09 (2026-08-23) — os 3 bloqueantes + os 4 que mordiam na
  carga, fechados.** Tudo em `productCsv.ts`. **A:** `cellNumber` (coluna ausente e célula **vazia**
  caem no mesmo default; ilegível fica no default e **avisa**) — morreu junto a "regra de ouro" de
  não pôr coluna que não vai preencher · needle **do mais longo pro mais curto** (`Filamentos` fica
  com as cores) · `COLUNAS_CALCULADAS` com os nomes **exatos** do export, que suprime o aviso *e*
  bloqueia captura por needle — com ela, `Tarifa de Energia` e `Inclui custo fixo` passaram a ser
  **lidas**. **B:** milhar dentro do JSON · `cor-sem-peso` **cor a cor** · separador decidido por
  quem PARTE o cabeçalho em mais células (TAB entrou) + `celulas-demais` · `createdAt` por linha.
  **28 testes novos.** `lint` ✅ · `build` ✅ · **551/551** ✅.
- **Contexto macro:** **✅ TIER 1 FECHADO** — Estoque (filamento + insumos) + FEAT-01/02/04/05 + passo 8
  (venda virou **reconciliação**; a **primitiva de baixa mora na PRODUÇÃO**, rota `/producao`).
  Custo real **decomponível ponta a ponta** (produção → acabado → venda) e o ROI já lê o custo real.
- **⏸ FEAT-03 / branding ADIADO (dono, 2026-08-12):** bloqueado por dado externo. **Cores saíram
  (2026-08-16): amarelo + preto**; a **logo não**. Destrava quando o dono avisar. Detalhe (e o
  token `--on-accent` que a troca exige): `BACKLOG.md`.
- **▶ PRÓXIMA TAREFA — é do DONO: cadastrar as cores e os insumos definitivos.** Só então eu faço o
  **lote C** (tabela **de-para** cor → id + **planilha-modelo** com as 15 colunas, que também cobre
  o `Tempo (h)` em horas e o token do arredondamento) e aí vem a **CARGA EM MASSA**. A importação
  **não cria** cor nem insumo (medido: 2 e 2, inalterados após importar 100 produtos que as
  referenciam), e a planilha é do dono. **Não existe "limpar catálogo"** (97 exclusões uma a uma).
- ⚠ **Pendência do 7e (ainda vale):** **o dono precisa cadastrar os insumos e religar os acessórios** —
  os acessórios já cadastrados seguem avulsos (entram no custo, não dão baixa) até lá.
- ⚠ **Duas ressalvas que o Dashboard resolve** (já avisadas na tela/no código): o payback do
  `/maquinas` usa lucro **bruto**, sem fixo nem perda (UX-09); e paginar resolveu a **lista**, não a
  **análise** (TD-006).
- **Infra pronta:** subdomínio no ar (CNAME "DNS only" no Cloudflare + SSL Let's Encrypt); e-mail
  `@lopolab.com.br` configurado; login Google restrito (`AuthGate` + regras Firestore travadas).
- **Decisão encerrada:** conversão peso↔metragem **descartada** pelo dono (não repropor).

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
                            #   catalogo/page.tsx (catálogo, FEAT-07),
                            #   vendas/page.tsx (histórico), orcamento/page.tsx (PDF),
                            #   maquinas/page.tsx (ROI), estoque/page.tsx (estoque),
                            #   producao/page.tsx (registro de produção),
                            #   globals.css (só @import) + styles/*.css (CSS por área)
  features/pricing-calculator/
    components/             # calculadora: PricingCalculator (raiz) + ProductForm +
                            #   PricingResultCard + CapacityPanel/MachineSelector/FixedCostsPanel/
                            #   Accessories/ExtraStages/Subitems/LinksSection ·
                            # uma por rota: CatalogPage(+ProductCatalog) · SalesPage · QuotePage ·
                            #   MachinesPage · ProductionPage · StockPage (abas) + SuppliesTab ·
                            # venda: SaleModal + SaleFlow (a fiação, usada pelas 2 páginas) ·
                            # casca: PageHeader · PageIntro · NavBar · MobilePriceBar · AuthGate ·
                            # Modal (casca dos 9 diálogos) + os 8 que a consomem + ConfirmDialog ·
                            # compartilhados: NumberInput, ProfitSummary, SearchBox, CostBars,
                            #   FeedbackNote, NetMarginHint, CostDetail (exporta
                            #   CostBreakdownTable, reusada por 3 rotas)
    hooks/                  # useProducts, usePricingForm, useMachines, useTheme, useAuth ·
                            #   um por coleção: useSales, useSupplies, useStock, useProduction,
                            #   useFinishedGoods, useQuotes, useQuoteConfig, useFees
    lib/                    # TODA a matemática, pura. calculatePricing, calculateCapacity,
                            #   validateProduct, productCsv · fifo (ordem + overdraft D4) →
                            #   stock (g) + supplies (unidades) · production (baixa por evento +
                            #   custo congelado, em 3 escalas) · finishedGoods (camadas FIFO;
                            #   SKU = subitem × cor) · productionPlan (produto/subitem→eventos) ·
                            #   saleReconciliation (passo 8 + reverse) · marginTier (régua DEC-04) ·
                            #   saleContext · filaments · generateQuotePdf ·
                            #   paymentFees (bandeira × parcela, gross-up, desconto, margem líquida)
    constants.ts, types.ts
  lib/
    firebase/               # client.ts (init + db) · frozenCost.ts (o mesmo objeto vai p/ 3
                            #   coleções) · um repositório por coleção: products · machines
                            #   (config/machines) · quoteConfig · quotes · fees ·
                            #   sales (`vendas`; reconcileRecibo = batch atômico das 4 coleções) ·
                            #   stock (`estoque`, doc por COR) · supplies (`insumos`, doc por
                            #   INSUMO) · production (`producao`, N eventos + baixa no mesmo
                            #   writeBatch) · finishedGoods (`acabados`, doc por PRODUTO)
    errors.ts               # guardOnline (offline trava a escrita) + errorMessage
    formatting/             # currency.ts (formatCurrency/formatDecimal) · date.ts (ponte
                            #   timestamp ↔ <input type="date">)
```

**Pontos-chave:**
- **CSS novo escreve TOKEN, não px nem hex** (UX-17a/b, TD-014): espaço/raio/tipografia e COR vivem
  em `:root` no `base.css`. Significado → `--danger`/`--warn`/`--success`/`--accent`; fundo tênue →
  `-soft`, fundo forte/hover → `-tint`, borda → `-line`. **Três papéis do laranja:** `--accent` só
  onde NÃO carrega letra · `--accent-text` quando É texto · `--accent-strong` sob texto branco.
  Custo → `--cost-*`. Cru só para o que não é escala (largura de grade, espessura de borda) e para
  `#fff` sobre preenchimento. Ação destrutiva se anuncia **em repouso** (UX-36); contorno de ícone é
  `box-shadow: inset`, nunca `border`.
- **Coluna flexível de grade escreve `minmax(0, 1fr)`, nunca `1fr` puro**: o mínimo implícito é o
  min-content, e `<select>`/`<input type="date">` não encolhem — a coluna estoura em vez de ceder.
- **Fileira que não cabe no celular VIRA CARTÃO, não rolagem** (UX-38/UX-40): abaixo dos ~300px
  úteis a linha quebra em faixas (receita do `.fg-part`, hoje em 4 lugares). Rolar de lado esconde
  justamente a coluna que se quer ler.
- **Coluna de número usa `.num`** (direita). `tabular-nums` é global (UX-27), não redeclarar. Faixa
  de número tem **piso `max(rótulo, conteúdo)` medido no DOM**; faixa de nome tem reticências
  (UX-21) — número cortado vira outro número.
- **Composição de custo é UM desenho só** (UX-26): `CostStack` (em `CostBars.tsx`), consumido por 3
  rotas. Barra nova não se desenha na mão; e a régua **nunca** é o maior item — é o total.
- **Cabeçalho, introdução e MODAL são COMPONENTE** — `PageHeader`, `PageIntro`, `Modal`. Modal novo
  não escreve `.modal-overlay` na mão: usa o `<Modal>` e ganha papel, Escape, trava de rolagem e ✕.
- **Título de seção é `<h2>`, não `<div>`** (UX-29) — o `base.css` zera heading, trocar a tag não
  move pixel. **Foco é `:focus-visible` + `--focus-ring`** (UX-31), de graça. **Alvo pequeno cresce
  por `padding`/`min-height` + margem negativa igual** (UX-28/UX-37): 44px no celular, 32 no
  desktop. **Botão só-ícone precisa de `aria-label`** (A11Y-01).
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
- Toda a lógica de cálculo vive em `features/pricing-calculator/lib/` — pura e coberta por teste.

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

```powershell
git add -A
git commit -m "<mensagem descritiva>"
git push
```

> O deploy é feito pela **integração Git nativa da Vercel** (push na `main` → deploy de produção
> automático, na nuvem da Vercel). **Não** rode `vercel --prod` no fluxo normal — geraria deploy
> duplicado. Para acompanhar: `vercel ls` ou o painel.

### 4. Verificação visual: pode abrir o site — o login é um handshake comigo
- **Não** abra o navegador pra "confirmar" toda alteração — isso gasta tempo/tokens à toa. Pro
  código são, prefira o barato: `pnpm lint`, `pnpm test` (e `pnpm build` quando fizer sentido).
- **Mas quando a verificação visual for de fato útil, ABRA você mesmo** — não fique esperando eu
  validar. Casos típicos: layout/responsivo, medir no DOM, lógica interativa que lint/build não
  cobre, ou quando eu pedir. Use o **navegador embutido** (`preview_start` + `read_page`/
  `computer`/`javascript_tool`); pra rodar local, `.claude/launch.json` (nunca `pnpm dev` no Bash).
- **Login Google (AuthGate):** eu **nunca** te passo senha e você **nunca** digita credencial. Se a
  sessão ainda estiver logada, **siga direto**. Se cair na tela de login, **pausa e me avisa** ("logue
  aí que eu continuo"); eu logo na aba e te devolvo — aí você retoma de onde parou.
- Terminada a verificação, **me mostre a prova** (screenshot/medição/console), não só o "funcionou".

### 5. Manter o "Status atual" atualizado (regra irmã da 8)
- Ao concluir uma mudança relevante (feature, correção, decisão de arquitetura/infra),
  **atualize a seção "Status atual"** no topo — é ela que permite abrir um **chat novo por tarefa**.
- **Para não virar changelog:** Status **≤ ~40 linhas** · registre **só a mudança MAIS recente** e
  **substitua** a anterior (nada de correntes `Antes: … Antes: …`) · bullets estáveis, não parágrafos
  de implementação (isso mora no código e no `git log`) · o **porquê** vai pro `HISTORICO.md` e o
  item aberto pro `BACKLOG.md` — **nunca** pro Status.
- **Status + código no MESMO commit/push** (não dois pushes seguidos). Só vira commit separado
  quando a alteração já foi pushada e o ajuste do Status veio depois.

### 6. Sinalizar hora de trocar de chat
- Ao **concluir uma tarefa** (feature/correção fechada, commitada e pushada),
  lembre que aquele é um bom ponto de corte: sugira encerrar este chat e abrir
  um novo pra próxima tarefa (o "Status atual" já carrega o contexto).
- Se a conversa estiver visivelmente longa (muitos turnos/leituras) e ainda no
  meio de algo, avise que o contexto está grande e que pode valer finalizar um
  passo lógico e continuar em chat novo — mas **sem prometer precisão de tokens**
  (não há medidor ao vivo; o gatilho confiável é "tarefa concluída", não contagem).

### 7. Dados atuais são descartáveis — priorize velocidade sobre compatibilidade
- **O histórico de hoje (catálogo, vendas, orçamentos) NÃO é o dado real/final** — é teste. O dono
  recadastra **tudo, inclusive os acessórios**, num **marco futuro que ele mesmo vai anunciar** —
  decisão totalmente dele, provavelmente só depois de fechar o backlog inteiro. **Nunca presumir a
  data.** Consequência: **nenhum item do backlog precisa de migração**, e não se reordena nada por
  causa disso.
- **Consequência prática:** quando compatibilidade retroativa custar trabalho extra ou complicar o
  design, **não pague esse preço**. Vale abrir mão de: migração de documentos antigos, campos legado
  só-leitura, fallbacks pra dado sem o campo novo, round-trip de CSV velho, backfill.
- **Como agir:** escolha o design certo primeiro; se ele quebrar o dado atual, **avise o dono no
  chat** (o que quebra e o que ele recadastra) e siga — não peça permissão a cada campo. Nada de
  `window.confirm` extra nem código defensivo pra dado que vai ser jogado fora.
- **Ainda vale a pena:** o que protege o dado **futuro** — escrita atômica, estorno correto,
  snapshot congelado da venda, testes da matemática. Isso é fundação, não compatibilidade.
- **Esta diretriz expira** quando o dono declarar a ferramenta madura e recadastrar. **Depois disso,
  migração volta a ser obrigatória** — reler antes de assumir que ela ainda vale.

### 8. Manter o CLAUDE.md INTEIRO enxuto — a doc é 3 arquivos por custo de token
- **Por que:** só o `CLAUDE.md` é **auto-carregado e re-enviado a cada turno** — cada linha aqui é
  token multiplicado por toda a conversa. Os outros dois só entram em contexto **quando eu os leio**.
- **Os 3 papéis:** `CLAUDE.md` (auto, todo turno · alvo **≤ ~270 linhas**) = foto do AGORA + próxima
  tarefa + stack/estrutura + diretrizes + infra + comandos, ou seja o que é preciso em TODA conversa ·
  [`BACKLOG.md`](.claude/BACKLOG.md) (curto) = só os itens **abertos** + prioridade, é o que se lê pra
  escolher tarefa · [`HISTORICO.md`](.claude/HISTORICO.md) (pesado) = D1–D8, auditoria (TD-*) e
  writeups do que foi **concluído**, lido só quando um item precisa do *porquê*.
- **Ao concluir uma tarefa, releia o arquivo INTEIRO** (não só o Status) e, bloco a bloco, pergunte
  *isto é preciso em TODA conversa?* Se for detalhe de item ou histórico, move: o **porquê**/o item
  concluído → `HISTORICO.md`; o que **virou a-fazer** → `BACKLOG.md`. Nunca copiar de volta pra cá.
- **Item concluído** some do Status e vira `✅` no `HISTORICO.md` (com o writeup, se útil).
- Esta verificação de tamanho/divisão é parte de "concluir a tarefa", igual ao `lint`/`build`.

## Infra / referência de deploy

- **Projeto Vercel:** `lopo-lab/lopolabcalc` (time `lopo-lab`, plano Hobby).
- **Vínculo:** já feito (`.vercel/repo.json` na raiz; pasta `.vercel` está no `.gitignore`).
- **Integração Git nativa:** **conectada** — push na `main` faz deploy de produção
  automático. Não use `vercel --prod` no fluxo normal (geraria deploy duplicado).
  Para desconectar: `vercel git disconnect`.
- **Framework:** fixado em `vercel.json` (`"framework": "nextjs"`) — não mexer: sem isso o projeto
  cai numa config estática herdada que quebra o build. As `NEXT_PUBLIC_FIREBASE_*` da Vercel são
  **ignoradas** (a config é FIXA no `client.ts`).
- **Domínio `lopolab.com.br`:** DNS é **só no Cloudflare** — **NÃO** gerenciar pelo registro.br (onde
  ele é registrado). O CNAME do `calculadora` fica **"DNS only" / nuvem cinza**, nunca proxied. Já está
  no ar com SSL. Detalhe (valores, motivo da migração): [`HISTORICO.md`](.claude/HISTORICO.md).

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
pnpm test           # vitest (testes da matemática pura, ex.: paymentFees)
vercel ls           # listar deploys
vercel --prod       # deploy manual via CLI (uso pontual; o normal é push na main)
```
