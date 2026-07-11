# LopoLabCalc — Orientações para o chat

> Este arquivo é lido automaticamente pelo Claude Code no início de cada conversa.
> Leia as **Diretrizes de trabalho** antes de qualquer ação.

## Status atual (contexto de continuidade)

> Foto do **AGORA** para permitir abrir um chat novo por tarefa. Manter curto e atual —
> não é histórico (o git já guarda o detalhe). Atualizar ao concluir mudanças relevantes.

- **Estado do site:** no ar e estável (produção `● Ready`).
- **Últimas mudanças relevantes:** o campo **"Tempo de impressão"** no `ProductForm`
  agora é **um input + um select de unidade (horas/minutos)**. Digita o número e escolhe a
  unidade; ao trocar a unidade o valor se converte sozinho. Continua gravando `printHours`
  em horas decimais (minutos → `printHours = min/60`). Componente `PrintTimeField`
  (ProductForm.tsx, usa `useState` p/ a unidade) + CSS `.time-inputs`/`.time-unit-select`.
  Antes:
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
- **Em andamento / próximos passos:** nada pendente. (Decidido: **não** é preciso reentrar os
  produtos — eles guardam só as entradas brutas; os cálculos são refeitos ao vivo e estão corretos.)
- **Problemas conhecidos / decisões pendentes:** variáveis de **Preview** do Firebase não
  cadastradas (por decisão — só mantemos Production; ver Diretriz 1). Nada quebrado.

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
  app/                      # App Router: layout.tsx, page.tsx, globals.css
  features/pricing-calculator/
    components/             # UI: PricingCalculator (raiz), ProductForm, ProductCatalog,
                            #     PricingResultCard, CapacityPanel, MachineSelector,
                            #     MachineManagerModal, FixedCostsPanel, AccessoriesSection,
                            #     ExtraStagesSection, LinksSection, Header
    hooks/                  # useProducts, usePricingForm, useMachines, useTheme
    lib/                    # calculatePricing, calculateCapacity, validateProduct, productCsv
    constants.ts, types.ts
  lib/
    firebase/               # client.ts (init + db), productsRepository.ts (CRUD + subscribe),
                            #   machinesRepository.ts (doc config/machines, realtime)
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
