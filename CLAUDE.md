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
- **Última mudança:** **FEAT-08 — vender/produzir/orçar no catálogo, inteiro e por subitem.** As 3 ações
  na coluna "Ações" (produto inteiro) e no painel expandido (inteiro + uma linha por subitem). Seed
  cross-page `?produto=<id>&subitem=<subId>`, traduzido por cada destino (a `/producao` reusa o
  `selectOption`; a `/orcamento` anexa a linha). Venda de subitem saiu quase de graça — o
  `saleContextFromSubitem` do FEAT-01 já existia. `lint`+`build` limpos (rotas seguiram estáticas),
  190 testes verdes. **Correção logo depois (reportada pelo dono):** no desktop os 3 ícones novos não
  apareciam — a linha do catálogo **não é tabela, é `display: grid`** e a faixa de "Ações" era fixa em
  **76px** (`catalog.css`), então o `overflow: hidden` do `.main-row td` cortava o excedente. Faixa foi
  pra **146px** (5 ícones de 24px + folgas + divisor = 143px). ⚠ **As regras `sticky` de `col-actions`
  (linha ~536) são MORTAS** — sobrescritas por `position: static` mais abaixo; não raciocinar por elas.
  Custo aceito: entre 760 e ~860px de tela o nome do produto passa a truncar com reticências (acima
  disso, nada muda). **O dono testou e o truncamento incomodou** (não há como ler o nome inteiro) →
  virou **UX-03** no backlog (paliativo já aplicado: `title` na célula do nome; segue aberto pra
  toque/mobile, que não tem hover), junto com **UX-04** (catálogo mostra só a 1ª máquina do produto).
- **Contexto macro:** **✅ TIER 1 FECHADO** — Estoque + FEAT-01/02/04/05 + passo 8 (venda virou
  **reconciliação**; a **primitiva de baixa mora na PRODUÇÃO**, rota `/producao`). 185 testes verdes.
- **▶ PRÓXIMA TAREFA sugerida:** **7e — insumos/acessórios no estoque** (`supplyId` no `Accessory`,
  cadastro de insumos na `/estoque`, baixa por unidade; fecha o buraco de COGS do gotcha abaixo e é
  pré-requisito do FEAT-06). **Ordem (dono, 2026-07-20):** 7e → **FEAT-06** → FEAT-03/branding →
  **Tier 4 inteiro** → TD-003/TD-006 → Dashboard (último). A trilha de UX (UX-01/FEAT-07/UX-02/FEAT-08)
  está **fechada**.
  **Roadmap + os porquês da ordem:** [`.claude/BACKLOG.md`](.claude/BACKLOG.md).
  **Decisões antigas:** [`.claude/HISTORICO.md`](.claude/HISTORICO.md).
- ⚠ **Gotcha vivo (buraco de COGS, motiva o 7e):** acessórios **JÁ entram no preço**
  (`calculatePricing.ts:325`) mas **NÃO no `frozenCost`** da produção (`production.ts:146-148`, decisão
  explícita) ⇒ o lucro por peça no histórico sai **superestimado**. COGS armazenado = custo real
  (unitCost/lucro/margem); `costBreakdown` = snapshot do catálogo (**stopgap**) até o FEAT-06 congelar
  a composição — por isso o **7e vem antes do FEAT-06**.
- **`/maquinas` (ROI):** cruza `price`/`lifeHours` com o histórico — 2 barras (payback do investimento
  e vida útil consumida); as horas vêm do **registro de produção** (FEAT-04c). Matemática pura em
  `lib/machineRoi.ts` (recebe `sales` **e** `production`).
- **Restam da auditoria:** **TD-003** (capacidade por-máquina) e **TD-006** (paginação) — agora **antes**
  do Dashboard. **Nenhum dos dois afeta a GRAVAÇÃO de dados** (verificado): as horas do histórico de
  máquina vêm dos eventos de produção somados por `machineId` (`machineRoi.ts:87-89`) e já estão certas;
  TD-003 é só **projeção** de capacidade na tela, TD-006 é custo/desempenho de **leitura**.
- **Infra pronta:** subdomínio no ar (CNAME "DNS only" no Cloudflare + SSL Let's Encrypt); e-mail
  `@lopolab.com.br` configurado; login Google restrito (`AuthGate` + regras Firestore travadas).
- **TO-DO macro em aberto:** **7e** (insumos no estoque — item próprio depois do filamento),
  **Dashboard** (`/painel`, só vale com ~1-2 meses de vendas), **logo real** no PDF do orçamento
  (placeholder hoje). Todos em [`.claude/BACKLOG.md`](.claude/BACKLOG.md).
- **Decisões encerradas:** variáveis de Preview do Firebase não cadastradas (só Production, Diretriz 1);
  conversão peso↔metragem **descartada** pelo dono (não repropor).

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
    components/             # UI: PricingCalculator (raiz), ProductForm,
                            #     CatalogPage (/catalogo) + ProductCatalog,
                            #     SaleFlow (fiação do SaleModal — usado pelas 2 páginas),
                            #     PricingResultCard, CapacityPanel, MachineSelector,
                            #     MachineManagerModal, FixedCostsPanel, AccessoriesSection,
                            #     ExtraStagesSection, SubitemsSection (subitens vendáveis),
                            #     LinksSection, Header,
                            #     SaleModal (registrar venda), SalesPage (rota /vendas),
                            #     QuotePage (/orcamento), MachinesPage (/maquinas),
                            #     StockPage (/estoque: abas Insumos/Produtos — acabados FEAT-05c) +
                            #     StockColorModal/StockRollModal/
                            #     StockAdjustModal, ProductionPage (/producao — registro de
                            #     impressão), NumberInput (compartilhado),
                            #     ProfitSummary (rentabilidade compartilhada),
                            #     CostDetail (custo real × precificado, expansível — venda e /vendas),
                            #     AuthGate (login)
    hooks/                  # useProducts, usePricingForm, useMachines, useTheme, useSales,
                            #     useAuth, useQuoteConfig (negócio), useQuotes (histórico),
                            #     useFees (taxas de pagamento), useStock (estoque de filamento),
                            #     useProduction (coleção producao — FEAT-04),
                            #     useFinishedGoods (coleção acabados — FEAT-05)
    lib/                    # calculatePricing, calculateCapacity, validateProduct, productCsv,
                            #     saleContext (foto congelada da venda — helpers puros do SaleModal),
                            #     filaments (cores por impressão, FEAT-02), stock (FIFO do estoque:
                            #     simulate/apply/reverse/adjustRoll — matemática pura, item 3),
                            #     production (baixa da produção FEAT-04: planProduction/
                            #     reverseProduction orquestram o FIFO por evento; productionCost
                            #     = frozenCost material+energia+deprec.+manut.+labor),
                            #     finishedGoods (estoque de acabados FEAT-05: camadas FIFO —
                            #     addProductionLayers/removeEventLayers/consumeFifo/apply+reverse
                            #     FinishedConsumption/assemblableWholes/goodValue/assemblyBreakdown; puro),
                            #     productionPlan (builder puro produto/subitem→eventos: wholeEventRows/
                            #     subitemEventRows/planEventRows/buildProductionPayloads — usado pela
                            #     /producao E pela encomenda do passo 8),
                            #     saleReconciliation (passo 8: planReciboReconciliation despacha item
                            #     acabado→consumeFifo vs encomenda→dispara producao; +reverse),
                            #     generateQuotePdf (orçamento), paymentFees (taxa de pagamento,
                            #     testado em paymentFees.test.ts via vitest)
    constants.ts, types.ts
  lib/
    firebase/               # client.ts (init + db), productsRepository.ts (CRUD + subscribe),
                            #   machinesRepository.ts (doc config/machines, realtime),
                            #   salesRepository.ts (coleção `vendas`, snapshots congelados;
                            #     reconcileRecibo = batch atômico vendas+producao+estoque+acabados — passo 8),
                            #   quoteConfigRepository.ts (doc config/orcamento: dados do negócio),
                            #   quotesRepository.ts (coleção `orcamentos`: histórico de orçamentos),
                            #   feesRepository.ts (doc config/taxas: taxa % por forma de pagamento),
                            #   stockRepository.ts (coleção `estoque`: um doc por COR, rolos dentro),
                            #   productionRepository.ts (coleção `producao`: newProductionId +
                            #     saveProduction(events[]) — N eventos + baixa dos rolos no mesmo
                            #     writeBatch — FEAT-04)
                            #   finishedGoodsRepository.ts (coleção `acabados`: um doc por PRODUTO,
                            #     id = productId; serializeSkus p/ o batch da produção — FEAT-05)
    formatting/currency.ts  # formatCurrency / formatDecimal
    formatting/date.ts      # ponte timestamp ↔ <input type="date"> (toDateInput, toTimestamp,
                            #   todayInputValue, formatDate) — usada por venda/orçamento/estoque
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
