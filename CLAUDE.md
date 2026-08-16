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
- **Última mudança:** **✅ passo ⑦ = UX-17b (2026-08-16) — o CLUSTER UI/UX FECHOU.** Os 16 CSS passaram
  a consumir os tokens que o UX-17a só tinha declarado: **875 declarações trocadas** (779 literais +
  **96 órfãos colapsados**); fonte de **23 tamanhos → 9**, raio de **15 → 8**. **Prova por medição, não
  por diff:** 25 estados (7 rotas × 2 tamanhos + 3 abas, 3 modais, gaveta) medidos antes×depois no DOM
  — **toda** diferença cai na lista de órfãos, **0 elemento sumiu**. **Junto:** `.btn:disabled` foi pro
  `forms.css` e as **abas da `/estoque` viraram chip** (byte a byte iguais às da NavBar, nos 2 temas).
  Writeup + os falsos positivos da medição: [`HISTORICO.md`](.claude/HISTORICO.md).
- ⚠ **O que o dono vai ver mudado** (preço da escala curta, tudo medido): toda página **4px mais curta
  no topo** · **h1 22→20px** · o fundo do destino ativo da NavBar era **verde cru** com texto laranja e
  virou `--chip-active-bg` · no **celular** campo e botão vão 15→**16px** (abaixo disso o iOS dá zoom ao
  focar), o que custou +57px na `/vendas` e +70px na `/producao` — se preferir o botão em 14px, é **1
  linha** no `responsive.css`.
- **Contexto macro:** **✅ TIER 1 FECHADO** — Estoque (filamento + insumos) + FEAT-01/02/04/05 + passo 8
  (venda virou **reconciliação**; a **primitiva de baixa mora na PRODUÇÃO**, rota `/producao`).
  Custo real **decomponível ponta a ponta** (produção → acabado → venda) e o ROI já lê o custo real.
- **⏸ FEAT-03 / branding ADIADO (dono, 2026-08-12):** bloqueado por dado externo — **a marca ainda não
  existe**; o PDF antes da logo obriga a refazer o cabeçalho. Destrava quando o dono avisar.
- **▶ PRÓXIMA TAREFA sugerida: DEC-05 — lucide em tudo que é CONTROLE**, emoji só como decoração (hoje
  os dois convivem em **9 componentes**; emoji não herda `currentColor` nem responde ao tema). É a
  única coisa **codificável hoje** — o Dashboard só vale com venda real acumulada e o Tier 2 está
  travado na marca. Já decidida (dono, 2026-08-15), sem posição na fila: **ele diz quando entra**, e
  com a ressalva dele de que **a marca está chegando** (contar com um ajuste depois). Detalhe no
  [`BACKLOG.md`](.claude/BACKLOG.md).
- ⚠ **Pendência do 7e (ainda vale):** **o dono precisa cadastrar os insumos e religar os acessórios** —
  os acessórios já cadastrados seguem avulsos (entram no custo, não dão baixa) até lá.
- ⚠ **Duas ressalvas que o Dashboard resolve** (já avisadas na tela/no código): o payback do `/maquinas`
  usa lucro **bruto** de vendas, sem fixo nem perda (UX-09); e paginar resolveu a **lista**, não a
  **análise** — ROI e Dashboard agregam o histórico inteiro (TD-006). ROI: ver `lib/machineRoi.ts`.
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
    components/             # UI: PricingCalculator (raiz) + ProductForm + PricingResultCard +
                            #     CapacityPanel/MachineSelector/MachineManagerModal/FixedCostsPanel/
                            #     AccessoriesSection/ExtraStagesSection/SubitemsSection/LinksSection,
                            #     CatalogPage (/catalogo) + ProductCatalog, SalesPage (/vendas),
                            #     QuotePage (/orcamento), MachinesPage (/maquinas),
                            #     ProductionPage (/producao), StockPage (/estoque: abas Filamentos/
                            #       Insumos/Produtos) + StockColorModal/StockRollModal/
                            #       StockAdjustModal + SuppliesTab (7e) + SupplyModal/
                            #       SupplyLotModal/SupplyAdjustModal,
                            #     SaleModal (registrar venda) + SaleFlow (a fiação dele, usada
                            #       pelas 2 páginas), Header, AuthGate (login),
                            #     NavBar (no celular vira painel lateral — UX-14),
                            #     MobilePriceBar (barra fixa da calculadora no celular — UX-13b),
                            #     compartilhados: NumberInput, ProfitSummary, SearchBox,
                            #       ConfirmDialog (+useConfirm: ask(): Promise<boolean> — UX-15),
                            #       FeedbackNote (+useFeedback: aviso de escrita; ok some em 5s),
                            #       NetMarginHint (UX-10: margem líquida ao lado da bruta),
                            #       CostDetail (composição 1 ou 2 colunas — precificado × real;
                            #       exporta CostBreakdownTable, reusada pelo popover E pelos
                            #       dropdowns de /vendas · /producao · /estoque — UX-06/07a)
    hooks/                  # useProducts, usePricingForm, useMachines, useTheme, useSales,
                            #     useSupplies (coleção insumos — 7e),
                            #     useAuth, useQuoteConfig (negócio), useQuotes (histórico),
                            #     useFees (taxas de pagamento), useStock (estoque de filamento),
                            #     useProduction (coleção producao — FEAT-04),
                            #     useFinishedGoods (coleção acabados — FEAT-05)
    lib/                    # calculatePricing, calculateCapacity, validateProduct, productCsv,
                            #     fifo (núcleo FIFO compartilhado: ordem + overdraft D4),
                            #     stock (FIFO do filamento) + supplies (gêmeo em unidades, 7e) —
                            #       matemática pura,
                            #     production (baixa da produção FEAT-04: orquestra o FIFO por evento;
                            #       productionCost = frozenCost material+energia+deprec.+manut.+
                            #       labor+INSUMOS; + a ÁLGEBRA do custo congelado do FEAT-06, que
                            #       atravessa 3 escalas: placa, unidade, unidade×qtd),
                            #     finishedGoods (estoque de acabados FEAT-05: camadas FIFO, valor
                            #       parado DECOMPOSTO — puro; SKU = subitem × COR no FEAT-11),
                            #     productionPlan (builder puro produto/subitem→eventos; usado pela
                            #       /producao E pela encomenda do passo 8; submissionColors = a cor
                            #       de cada PARTE, via stageKey → Subitem.stageKeys — FEAT-11),
                            #     saleReconciliation (passo 8: item acabado→consumo vs
                            #       encomenda→dispara producao; +reverse),
                            #     marginTier (UX-19: a régua da DEC-04 — faixa de margem ruim/ok/bom,
                            #       usada por catálogo, calculadora, /vendas e estoque),
                            #     saleContext (foto congelada da venda), filaments (cores, FEAT-02;
                            #       colorKeyOf = identidade de cor da peça, FEAT-11),
                            #     generateQuotePdf (orçamento), paymentFees (taxa de pagamento:
                            #       matriz bandeira × parcela, gross-up do repasse, desconto FEAT-09,
                            #       margem líquida do UX-10; testado em paymentFees.test.ts)
    constants.ts, types.ts
  lib/
    firebase/               # client.ts (init + db), frozenCost.ts (FEAT-06: serialização do
                            #   FrozenCostBreakdown — o mesmo objeto vai p/ 3 coleções),
                            #   productsRepository (CRUD + subscribe), machinesRepository (doc
                            #     config/machines), quoteConfigRepository (config/orcamento),
                            #     quotesRepository (`orcamentos`), feesRepository (config/taxas),
                            #   salesRepository (`vendas`, snapshots congelados; reconcileRecibo =
                            #     batch atômico vendas+producao+estoque+acabados — passo 8),
                            #   stockRepository (`estoque`: um doc por COR, rolos dentro) +
                            #     suppliesRepository (`insumos`: um doc por INSUMO, lotes — 7e),
                            #   productionRepository (`producao`: N eventos + baixa dos rolos no
                            #     mesmo writeBatch — FEAT-04),
                            #   finishedGoodsRepository (`acabados`: doc por PRODUTO, id = productId)
    errors.ts               # guardOnline (offline trava a escrita) + errorMessage — UX-15
    formatting/currency.ts  # formatCurrency / formatDecimal
    formatting/date.ts      # ponte timestamp ↔ <input type="date"> (toDateInput, toTimestamp,
                            #   todayInputValue, formatDate) — usada por venda/orçamento/estoque
```

**Pontos-chave:**
- **CSS novo escreve TOKEN, não px** (UX-17a/b): a escala de espaço/raio/tipografia vive em `:root` no
  `base.css` e os 16 arquivos já a consomem. Valor cru só para o que **não é escala** (largura de
  grade, espessura de borda, margem negativa de ajuste, reserva de espaço).
- `src/lib/firebase/client.ts` — init + `db`; lê `NEXT_PUBLIC_FIREBASE_*` com fallback embutido nos
  valores reais (hoje as vars da Vercel são ignoradas).
- **Máquinas são compartilhadas entre dispositivos** (doc `config/machines`, realtime): editar
  watts/`lifeHours` recalcula energia e desgaste de TODOS os produtos, que guardam só o `machineId`.
  `useMachines` semeia de `DEFAULT_MACHINES` na 1ª vez e cai pra fallback local em caso de erro.
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

### 5. Manter o "Status atual" atualizado
- Ao concluir uma mudança relevante (feature, correção, decisão de arquitetura/infra),
  **atualize a seção "Status atual"** no topo deste arquivo.
- **Regras de tamanho (para não virar changelog):**
  - Status atual **≤ ~40 linhas**. É a foto do AGORA, não histórico — o git já guarda o detalhe.
  - Registre **apenas a mudança MAIS recente** em 1-2 frases. Ao concluir uma tarefa,
    **substitua** a entrada anterior — **não** empilhe correntes `Antes: … Antes: …`.
  - Prefira consolidar em bullets estáveis ("Concluído (macro)", "TO-DO", "Próximo passo")
    a acumular parágrafos de implementação (isso mora no código e no `git log`).
  - Contexto de **por que** uma decisão foi tomada (D1–D8, TD-*, FEAT-*) vai pro
    [`.claude/HISTORICO.md`](.claude/HISTORICO.md); item aberto vai pro
    [`.claude/BACKLOG.md`](.claude/BACKLOG.md) — não pro Status. **Ver a Diretriz 8** — a faxina de
    tamanho vale pro arquivo INTEIRO, não só pra esta seção.
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

### 7. Dados atuais são descartáveis — priorize velocidade sobre compatibilidade
- **O histórico de hoje (catálogo, vendas, orçamentos) NÃO é o dado real/final** — é teste. O dono
  recadastra tudo (impressões já feitas e vendas) num **marco futuro que ele mesmo vai anunciar**,
  e a partir daí a guarda de dados começa pra valer. Um CSV de produtos mockup é trivial de refazer.
- **QUANDO é o marco (dono, jul/2026):** decisão **totalmente dele**, quando **ele** considerar a
  ferramenta madura — **provavelmente só depois de fechar o backlog atual inteiro**. Recadastra
  **tudo, inclusive os acessórios** (não só produtos/filamentos). **Consequência:** esta diretriz
  cobre o **backlog inteiro**, não só o Tier 1 → **nenhum item do backlog precisa de migração**,
  incluindo o **7e** (o `Accessory` texto→referência sai de graça: o dono cadastra acessório uma vez
  só, já ligado ao estoque, no marco). Não reordenar nada por causa de migração. **Nunca presumir a
  data do marco** — só o dono anuncia.
- **Consequência prática:** quando compatibilidade retroativa custar trabalho extra ou complicar o
  design, **não pague esse preço**. Prefira o modelo mais limpo. Vale abrir mão de: migração de
  documentos antigos, campos legado só-leitura, fallbacks pra dado sem o campo novo, round-trip de
  CSV velho, backfill.
- **Como agir:** escolha o design certo primeiro; se ele quebrar o dado atual, **avise o dono no
  chat** (o que quebra e o que ele precisa recadastrar) e siga — não peça permissão a cada campo.
  Nada de `window.confirm` extra nem código defensivo pra dado que vai ser jogado fora.
- **Ainda vale a pena:** o que protege o dado **futuro**. Escrita atômica, estorno correto
  (`stockMoves`), snapshot congelado da venda, testes da matemática — isso é a fundação que o marco
  vai usar, não é compatibilidade com o passado.
- **Esta diretriz expira** quando o dono declarar a ferramenta madura e recadastrar. **Depois disso,
  migração volta a ser obrigatória** — reler esta diretriz antes de assumir que ela ainda vale.

### 8. Manter o CLAUDE.md INTEIRO enxuto — e a doc dividida em 3 arquivos por custo de token
- **Por que importa:** só o `CLAUDE.md` é **auto-carregado no início de todo chat e re-enviado a cada
  turno** — cada linha aqui é token multiplicado por toda conversa. Os outros dois só entram em contexto
  **quando eu os leio** (`Read`), e só nos chats que precisam. Por isso a divisão abaixo. (Antes da
  faxina, tudo isto estava num `CLAUDE.md` de ~960 linhas / ~20k tokens por turno.)
- **Os 3 arquivos e seus papéis:**
  - **`CLAUDE.md`** (auto, todo turno · alvo **≤ ~270 linhas**): foto do AGORA (Status) + **a próxima
    tarefa sugerida**, stack/estrutura, as diretrizes, infra de deploy, comandos. O que o modelo precisa
    **em TODA conversa**.
  - **[`.claude/BACKLOG.md`](.claude/BACKLOG.md)** (a-fazer / roadmap · curto): só os itens **abertos** +
    ordem de prioridade. É o que se lê pra **escolher/rever** a próxima tarefa e ver "o que mais falta".
  - **[`.claude/HISTORICO.md`](.claude/HISTORICO.md)** (feito + decisões · pesado): D1–D8, auditoria
    (TD-*), e writeups do que já foi **concluído**. Lido **só** quando um item precisa do *porquê*.
- **Ao concluir uma tarefa, confira o arquivo INTEIRO** (não só o "Status"): releia o `CLAUDE.md` como
  um todo e, para cada bloco, pergunte *isto é preciso em TODA conversa?* Se for detalhe de um item ou
  histórico, move: o **porquê** de decisão/o item concluído → `HISTORICO.md`; um item que **virou a-fazer**
  → `BACKLOG.md`; e atualize a **próxima tarefa** no Status. Nunca copiar de volta pro `CLAUDE.md`.
- **Item concluído:** some do Status, vira `✅` de UMA linha no `HISTORICO.md` (o writeup detalhado, se
  útil, também vai pra lá). Não empilhar parágrafos nem correntes `Antes: … Antes: …` — código + `git log`.
- Esta verificação de tamanho/divisão é parte de "concluir a tarefa", igual ao `lint`/`build`.

## Infra / referência de deploy

- **Projeto Vercel:** `lopo-lab/lopolabcalc` (time `lopo-lab`, plano Hobby).
- **Vínculo:** já feito (`.vercel/repo.json` na raiz; pasta `.vercel` está no `.gitignore`).
- **Integração Git nativa:** **conectada** — push na `main` faz deploy de produção
  automático. Não use `vercel --prod` no fluxo normal (geraria deploy duplicado).
  Para desconectar: `vercel git disconnect`.
- **Framework:** fixado em `vercel.json` (`"framework": "nextjs"`) — o projeto herdou uma config
  estática antiga que quebrava o build (*"No Output Directory named public"*).
- **Variáveis do Firebase** (`NEXT_PUBLIC_FIREBASE_*`): cadastradas na Vercel em **Production**, mas
  **ignoradas** hoje (a config é FIXA no `client.ts`). Podem ser excluídas.
- **Domínio `lopolab.com.br`:** DNS é **só no Cloudflare** — **NÃO** gerenciar pelo registro.br (onde
  ele é registrado). O CNAME do `calculadora` fica **"DNS only" / nuvem cinza**, nunca proxied. Já está
  no ar com SSL. Detalhe (valores, motivo da migração): [`HISTORICO.md`](.claude/HISTORICO.md).

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
