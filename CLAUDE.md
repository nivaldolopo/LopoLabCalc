# LopoLabCalc — Orientações para o chat

> Este arquivo é lido automaticamente pelo Claude Code no início de cada conversa.
> Leia as **Diretrizes de trabalho** antes de qualquer ação.

## Status atual (contexto de continuidade)

> Foto do **AGORA** para permitir abrir um chat novo por tarefa. Manter curto e atual —
> não é histórico (o git já guarda o detalhe). Atualizar ao concluir mudanças relevantes.

- **Estado do site:** no ar e estável (produção `● Ready`).
- **Últimas mudanças relevantes:** **Vida útil (depreciação) recalibrada:
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
  `PricingResultCard` abre `SaleModal` (cliente, material, canal, forma de pagamento, qtd,
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
- **Em andamento / próximos passos:** **item 1 Fase 1a concluída** (captura de venda +
  histórico). Próximo: **Fase 1b — cesta/recibo** (vários produtos num mesmo `reciboId`),
  que encosta no item 2 (PDF). Também pendente na 1a, se quiser: editar cliente/obs de uma
  venda já registrada (hoje só exclui). (Decidido: **não** é preciso reentrar os produtos —
  eles guardam só as entradas brutas; os cálculos são refeitos ao vivo e corretos.)
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
   **Fase 1b (pendente): cesta/recibo** — juntar vários produtos num mesmo `reciboId`
   (schema já preparado) e, opcionalmente, editar cliente/obs de venda já registrada.
2. **Geração de orçamento (PDF)** — **subiu na ordem** (ChatGPT punha por último). Independente
   de tudo, ganho rápido, client-side. Botão "Gerar orçamento": nº, cliente, data, itens,
   quantidade, tempo estimado, preço unitário/total, validade. Layout simples (nome + contato);
   branding depois. Ganho: profissionalismo (clientes maiores, escolas, makerspaces).
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
- Gerenciador de pacotes: **pnpm**

**Estrutura:**
```
src/
  app/                      # App Router: layout.tsx, page.tsx (calculadora),
                            #   vendas/page.tsx (histórico), globals.css
  features/pricing-calculator/
    components/             # UI: PricingCalculator (raiz), ProductForm, ProductCatalog,
                            #     PricingResultCard, CapacityPanel, MachineSelector,
                            #     MachineManagerModal, FixedCostsPanel, AccessoriesSection,
                            #     ExtraStagesSection, LinksSection, Header,
                            #     SaleModal (registrar venda), SalesPage (rota /vendas)
    hooks/                  # useProducts, usePricingForm, useMachines, useTheme, useSales
    lib/                    # calculatePricing, calculateCapacity, validateProduct, productCsv
    constants.ts, types.ts
  lib/
    firebase/               # client.ts (init + db), productsRepository.ts (CRUD + subscribe),
                            #   machinesRepository.ts (doc config/machines, realtime),
                            #   salesRepository.ts (coleção `vendas`, snapshots congelados)
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
- **Variáveis do Firebase** (`NEXT_PUBLIC_FIREBASE_*`): cadastradas na Vercel em **Production**.

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
