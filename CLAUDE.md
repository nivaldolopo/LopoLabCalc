# LopoLabCalc — Orientações para o chat

> Este arquivo é lido automaticamente pelo Claude Code no início de cada conversa.
> Leia as **Diretrizes de trabalho** antes de qualquer ação.

## Status atual (contexto de continuidade)

> Foto do **AGORA** para permitir abrir um chat novo por tarefa. Manter curto e atual —
> não é histórico (o git já guarda o detalhe). Atualizar ao concluir mudanças relevantes.

- **Estado do site:** no ar e estável (produção `● Ready`). Acessível por
  **`calculadora.lopolab.com.br`** (domínio próprio, SSL ok) e pelo `lopolabcalc.vercel.app`.
- **Últimas mudanças relevantes:** **Editar recibo de venda.** A `/vendas` ganhou botão
  **editar** em cada recibo — reabre o `SaleModal` em **modo edição** (campos compartilhados +
  itens): dá pra mudar produto/qtd/preço/material, remover itens e **adicionar** do catálogo. O
  custo continua **congelado**; alterar qtd/preço recalcula receita/lucro. Gravação **atômica**
  no novo **`saveRecibo`** (writeBatch: upsert dos itens + delete dos removidos), que
  **unificou** registrar venda nova e editar (aposentou `createSales`). Os helpers
  `saleContextFromResult`/`productPrintHours` foram para o `SaleModal` (reusados pela calculadora
  e pela `/vendas`); reconstrução da foto congelada via `contextFromSale`. **Antes:** limpeza de
  código morto (ACCENT órfão; `createSale`/`updateSale`+`addSale`/`editSale` não usados).
  **Antes:** **Histórico de orçamentos.** Cada PDF gerado agora
  **também salva** um registro na coleção **`orcamentos`** (nº, cliente, itens, total, dados do
  negócio **congelados**); seção **Histórico** na `/orcamento` com **re-baixar** (regenera o PDF)
  e **excluir**. Novos: `quotesRepository` + `useQuotes`. A **numeração perdeu o contador**
  (`config/orcamento` agora só guarda o negócio, via `subscribeQuoteBusiness`): o **próximo
  nº = maior do histórico + 1** (ou 0001 se vazio) — **zera sozinho** ao esvaziar o histórico. O
  campo Número segue o histórico até o usuário digitar um valor. **Antes:**
  **Item 2 — Orçamento avulso em PDF.** Nova rota
  **`/orcamento`** (`QuotePage`) — monta itens **só pra cotação** (NÃO registra venda).
  Adiciona itens do **catálogo** (com preço sugerido, editável) ou **itens livres**;
  qtd/preço/subtotal por item; observações; validade em dias. Botão **Gerar PDF** client-side
  (`jspdf` + `jspdf-autotable`, `lib/generateQuotePdf.ts`) baixa `orcamento-<nº>-<cliente>.pdf`.
  **Dados do negócio** (nome, telefone/WhatsApp, e-mail/Instagram) + **numeração sequencial**
  ficam no **Firestore** (doc `config/orcamento` via `quoteConfigRepository`/`useQuoteConfig`) —
  **portáteis entre aparelhos, nada em localStorage**. Link **📄 Orçamento** no Header e no
  `/vendas`. O preço sugerido prefilado usa `DEFAULT_FIXED_COSTS` (e é editável de todo jeito).
  Verificado por smoke test headless: jsPDF gera `%PDF-` válido, acentos pt-BR OK. **Antes:**
  **Fase 1b — cesta/recibo (vários produtos numa mesma
  venda).** O `SaleModal` virou uma **cesta**: cliente / canal / forma de pagamento / data /
  obs são **compartilhados** do recibo; abaixo, **N itens** (cada um com produto, **material
  por item**, qtd e preço unitário — o material saiu do compartilhado). Um `<select>`
  **"Adicionar produto do catálogo"** injeta mais itens (lista `catalogSaleItems`, memo no
  `PricingCalculator` = todos os produtos já precificados). Ao confirmar, grava **N docs** na
  coleção `vendas` compartilhando um mesmo **`reciboId`** via novo `createSales` (writeBatch
  **atômico** no `salesRepository`; cada item continua uma **foto congelada** própria). A rota
  **`/vendas`** agora **agrupa por `reciboId`** em **cartões de recibo** (cabeçalho: data,
  cliente, canal, pagamento, nº de itens + totais receita/lucro/margem do recibo; itens
  listados abaixo; **excluir por item** — apagar o último item some com o recibo). CSV ganhou
  coluna **"Recibo"**. Helpers `saleContextFromResult`/`productPrintHours` movidos p/ escopo de
  módulo. Props do `SaleModal` mudaram: agora `seed` + `catalogItems` + `onConfirm(payloads[])`.
  **Antes:** **Barreira de acesso COMPLETA (login Google restrito +
  banco travado).** Firebase Auth em `client.ts` (`auth`), hook `useAuth` (onAuthStateChanged +
  **signInWithPopup** Google + signOut), `AuthGate` envolvendo TODAS as rotas no `layout.tsx` —
  só renderiza o app para e-mail em `ALLOWED_EMAILS` (nivaldo.lopo@ / lopolab3d@); senão, tela
  de login / "não autorizado". **Feito no Console Firebase:** provedor Google ativo, domínios
  Vercel autorizados, e **Regras do Firestore travadas** (banco `lopo-lab-calculadora`:
  `read, write` só se `request.auth.token.email_verified` **e** `email in [os 2 e-mails]`).
  Verificado por fora: GET REST sem auth → **403 PERMISSION_DENIED**. **Dois aprendizados de
  infra importantes:** (a) `client.ts` agora usa **config Firebase FIXA no código** (não lê mais
  `NEXT_PUBLIC_FIREBASE_*`) — as envs da Vercel estavam salvas com a `apiKey` **mascarada com
  "•"** (colada oculta da UI), o que mandava chave inválida só pro Auth (`auth/api-key-not-valid`)
  enquanto o Firestore tolerava. **NÃO reintroduzir leitura dessas envs.** As 7 envs podem ser
  excluídas na Vercel (ignoradas hoje). (b) **Login híbrido popup→redirect:** o `signIn` tenta
  `signInWithPopup` (desktop OK); se o popup falhar (`auth/cancelled-popup-request` /
  `popup-blocked` / etc. — comum no **mobile**), cai para `signInWithRedirect`
  (com `getRedirectResult` no efeito). O "loop" antigo do redirect era artefato da chave
  inválida, não do redirect em si. Também há **fallback de 8s** no `useAuth`: se o Auth não
  resolver o estado inicial, mostra a tela de login em vez de "Carregando…" eterno (trava vista
  em navegador mobile). **Antes:** **Vida útil (depreciação) recalibrada:
  `lifeHours` default 5000 → 10000** nas duas máquinas (`DEFAULT_MACHINES` + default de
  máquina nova na `MachineManagerModal`). Embasado em pesquisa (jul/2026): a referência que
  faz o mesmo cálculo (preço ÷ horas) usa 10.000h; FDM dura 5.000–10.000h; consumíveis já
  entram à parte em `maintenancePerHour`, então 5.000h dobrava a conta. **Atenção:** só afeta
  seed novo / máquina nova — as máquinas já salvas no Firestore mantêm o valor persistido até
  serem editadas na modal "Gerenciar impressoras". Também: rótulo dos acessórios agora diz
  **"Qtd/peça"** (a quantidade é por peça, não o total da mesa). Antes: **Backlog item 1 —
  Captura de venda + Histórico
  (Fase 1a).** Nova coleção Firestore `vendas` (foto CONGELADA no momento da venda —
  não referencia o produto vivo). `salesRepository.ts` (subscribe/create/update/remove),
  hook `useSales`, tipos `Sale`/`SalePayload`/`SaleCostBreakdown`/`PaymentMethod`/`SaleChannel`
  em `types.ts`, constantes `PAYMENT_METHODS`/`SALE_CHANNELS`. Botão **"Registrar venda"** no
  `PricingResultCard` **e no dropdown de cada item do catálogo** (`CatalogDetails`, via
  `SaleModalContext` reaproveitável — vender direto do catálogo sem carregar o produto no
  formulário) abre `SaleModal` (cliente, material, canal, forma de pagamento, qtd,
  data, preço editável pré-preenchido com o sugerido, obs; mostra receita/custo/lucro ao
  vivo). Grava snapshot com **preço sugerido + preço real** e o **detalhamento de custo
  inteiro** (pro dashboard futuro). Nova rota **`/vendas`** (`SalesPage`) com totais, tabela
  do histórico, excluir e export CSV; link no `Header` (`.header-actions`). A calculadora e
  o catálogo continuam **intocados** (recálculo ao vivo é proposital — ferramenta de aferição).
  `reciboId` por venda já preparado pra Fase 1b (cesta/recibo). **Antes:** adicionadas duas
  melhorias de precificação (ideias do brainstorm com ChatGPT — as demais no backlog):
  **(1) Reserva de manutenção** — novo campo `maintenancePerHour` por máquina (editável na
  `MachineManagerModal`, compartilhado via Firestore como watts). Entra no custo como
  `horas × R$/h`, **separado da depreciação** (que é só a compra da máquina). Nova barra
  "Manutenção" no `CostBars`. Defaults calibrados com **preços reais (ML)** + **vida útil
  de relatos reais do fórum Bambu** (uso PLA/ABS não-abrasivo: bico dura ~2000h, placa PEI
  ~3000h dupla-face, filtro 1440h só na X2D): A1 R$0,12/h, X2D R$0,20/h
  (`DEFAULT_MAINTENANCE_BY_ID` + `defaultMaintenanceForId`).
  **Backfill**: máquina cujo doc não tem o campo assume o default por id ao ler
  (`toMachine`), então máquinas antigas já vêm com o valor sem reentrada; valor explícito
  (inclusive 0) é respeitado. **(2) Taxa de falha** — campo `failureRate` (%) por produto
  (`ProductForm`, default **3%** via `DEFAULT_FAILURE_RATE` — embasado em benchmarks reais:
  Bambu bem calibrada ~2%, operador experiente <5%). Dentro de `calculatePricing`,
  divide o custo de **impressão** (material+energia+desgaste+manutenção+mão de obra, **exceto
  acessórios**) por `(1 − taxa)` — clamp em 95%. Nova barra "Reserva de falha". Ambos os
  campos persistem (Firestore + colunas novas no CSV) e produtos antigos caem no default 3%.
  Antes: o campo **"Tempo de impressão"** no `ProductForm` virou **um input + um select de
  unidade (horas/minutos)** (`PrintTimeField`, grava `printHours` em horas decimais). Antes:
  o título **"Lopo Lab"** no `Header` virou um `<button>`
  (classe `.brand-reset`, estilizado p/ herdar a cara do `h1`) que chama
  `window.location.reload()` — recarrega a página e limpa os campos preenchidos. Antes:
  **arredondamento do preço sugerido, salvo por produto** —
  campo `roundingMode` no `ProductInput` (persistido no Firestore e no CSV, coluna
  "Arredondamento"); modos "de mercado": final ,90 (psicológico), múltiplo de R$ 0,50 / R$ 1 /
  R$ 5 / R$ 10, ou exato (padrão). Lógica central em `lib/roundPrice.ts`, aplicada **dentro de
  `calculatePricing`**: `suggestedPrice` já sai arredondado (sempre p/ cima → margem preservada)
  e o novo `exactPrice` guarda o bruto. Assim **card, catálogo, ordenação, capacidade e lote**
  usam o mesmo preço automaticamente; o seletor fica no card (`PricingResultCard`) e grava no
  produto via `form.updateProduct`. Produtos antigos sem o campo caem em "exact". Antes:
  catálogo no desktop virou lista de cartões; campos sem negativos (clamp `Math.max`).
- **Em andamento / próximos passos:** **itens 1 e 2 CONCLUÍDOS** (captura/histórico +
  cesta/recibo + orçamento PDF **com histórico**). Próximo natural: **item 3 — Estoque**
  (`/estoque`) ou o **item 4 — Dashboard** (`/painel`, só vale com ~1-2 meses de vendas).
  **Subdomínio `calculadora.lopolab.com.br` ✅ NO AR:** nameservers do Cloudflare propagados;
  **CNAME `calculadora` → `e5d09afaf3e58d32.vercel-dns-017.com` como "DNS only" (nuvem cinza)**
  criado no Cloudflare; domínio anexado ao projeto Vercel `lopolabcalc`; **SSL Let's Encrypt
  emitido** (auto-renova) e `calculadora.lopolab.com.br` adicionado nos **Authorized domains** do
  Firebase (pro login Google). O `lopolabcalc.vercel.app` segue funcionando (mesmo app).
  **Pendências opcionais:** **logo real** no PDF do orçamento (hoje é placeholder de impressora).
- **Problemas conhecidos / decisões pendentes:** variáveis de **Preview** do Firebase não
  cadastradas (por decisão — só mantemos Production; ver Diretriz 1). Nada quebrado.

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

## Resumo do projeto (contexto rápido)

**O que é:** aplicação web de **calculadora de precificação para impressão 3D**
(Lopo Lab). O usuário cadastra produtos (peso, horas de impressão, filamento,
energia, mão de obra, markup, acessórios, etapas extras) e o app calcula o preço
sugerido e a capacidade produtiva. Os produtos ficam salvos no Firestore e são
sincronizados em tempo real.

**Stack:**
- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript 5**
- **Tailwind CSS 4** (via `@tailwindcss/postcss`)
- **Firebase 12** → **Firestore** (banco nomeado `lopo-lab-calculadora`)
- Ícones: `lucide-react`
- PDF (orçamento): `jspdf` + `jspdf-autotable` (client-side)
- Gerenciador de pacotes: **pnpm**

**Estrutura:**
```
src/
  app/                      # App Router: layout.tsx, page.tsx (calculadora),
                            #   vendas/page.tsx (histórico), orcamento/page.tsx (PDF), globals.css
  features/pricing-calculator/
    components/             # UI: PricingCalculator (raiz), ProductForm, ProductCatalog,
                            #     PricingResultCard, CapacityPanel, MachineSelector,
                            #     MachineManagerModal, FixedCostsPanel, AccessoriesSection,
                            #     ExtraStagesSection, LinksSection, Header,
                            #     SaleModal (registrar venda), SalesPage (rota /vendas),
                            #     ProfitSummary (rentabilidade compartilhada), AuthGate (login)
    hooks/                  # useProducts, usePricingForm, useMachines, useTheme, useSales,
                            #     useAuth, useQuoteConfig (negócio), useQuotes (histórico)
    lib/                    # calculatePricing, calculateCapacity, validateProduct, productCsv,
                            #     generateQuotePdf (orçamento)
    constants.ts, types.ts
  lib/
    firebase/               # client.ts (init + db), productsRepository.ts (CRUD + subscribe),
                            #   machinesRepository.ts (doc config/machines, realtime),
                            #   salesRepository.ts (coleção `vendas`, snapshots congelados),
                            #   quoteConfigRepository.ts (doc config/orcamento: dados do negócio),
                            #   quotesRepository.ts (coleção `orcamentos`: histórico de orçamentos)
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
- Mantenha-a curta: é a foto do AGORA, não um histórico. Remova o que envelheceu.
- Objetivo: permitir abrir um **chat novo por tarefa** e continuar sem perder contexto,
  evitando um único chat com contexto gigante.
- **Quando atualizar o Status junto com uma alteração, faça tudo num único commit/push** —
  edite o código e o "Status atual" juntos e mande de uma vez (não dois pushes seguidos).
  Só vira commit separado quando a alteração já foi pushada e o ajuste do Status veio depois.

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
vercel ls           # listar deploys
vercel --prod       # deploy manual via CLI (uso pontual; o normal é push na main)
```
