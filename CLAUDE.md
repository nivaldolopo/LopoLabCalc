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
- **Última mudança:** **✅ FORM-01 — o formulário parou de comer campo ao salvar (2026-08-20)**.
  Achado pelo **dono**: o CSV estava são, o vazamento era o outro caminho (`loadProduct →
  buildPayload`). **(1)** `createAccessory` esquecia o `supplyId` — e como o save grava
  `supplyId ?? null`, **abrir e salvar sem tocar em nada apagava o vínculo** e a produção parava de
  dar baixa. **(2)** Tarifa/valor-hora **por etapa** eram achatados no save (R$ 92,38 → 82,96), e 4
  módulos discordavam do campo; o dono decidiu que **não deve existir** (não há input) → removido do
  tipo, parser, cálculo, validação e produção — neutro no preço (0 de 29 produtos divergiam).
  Varredura dos outros round-trips (venda, produção, acabados, orçamento): **limpos**.
  `lint` ✅ · **414/414** ✅ · `build` ✅. Detalhe: [`HISTORICO.md`](.claude/HISTORICO.md).
- **Contexto macro:** **✅ TIER 1 FECHADO** — Estoque (filamento + insumos) + FEAT-01/02/04/05 + passo 8
  (venda virou **reconciliação**; a **primitiva de baixa mora na PRODUÇÃO**, rota `/producao`).
  Custo real **decomponível ponta a ponta** (produção → acabado → venda) e o ROI já lê o custo real.
- **⏸ FEAT-03 / branding ADIADO (dono, 2026-08-12):** bloqueado por dado externo. **Cores saíram
  (2026-08-16): amarelo + preto**; a **logo não**. Destrava quando o dono avisar. Detalhe (e o
  token `--on-accent` que a troca exige): `BACKLOG.md`.
- **▶ PRÓXIMA TAREFA — a CARGA EM MASSA do dono.** O CSV está pronto (CSV-01) e o formulário parou
  de comer campo (FORM-01). Abertos: `AUD-01` (auditar estorno/reedição de recibo) e `CSV-02`
  (`findColumn` por substring). O resto está no rebrand (`DEC-05` + `G2`) ou bloqueado por dado
  externo (`FEAT-03`, `branding/logo`, `Dashboard`). **A decisão é do dono** — ler o `BACKLOG.md`
  antes de sugerir tarefa.
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
                            #   MachinesPage · ProductionPage · StockPage (abas Filamentos/Insumos/
                            #   Produtos) + SuppliesTab ·
                            # venda: SaleModal + SaleFlow (a fiação, usada pelas 2 páginas) ·
                            # casca das páginas: PageHeader · PageIntro · NavBar (gaveta no
                            #   celular) · MobilePriceBar · AuthGate ·
                            # Modal (casca dos 9 diálogos) + os 8 que a consomem
                            #   (MachineManager/StockColor/Roll/Adjust/Supply/SupplyLot/
                            #   SupplyAdjust) + ConfirmDialog (+useConfirm) ·
                            # compartilhados: NumberInput, ProfitSummary, SearchBox, CostBars,
                            #   FeedbackNote, NetMarginHint, CostDetail (composição precificado ×
                            #   real; exporta CostBreakdownTable, reusada por 3 rotas)
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
- **CSS novo escreve TOKEN, não px** (UX-17a/b): a escala de espaço/raio/tipografia vive em `:root` no
  `base.css` e os 16 arquivos já a consomem. Valor cru só para o que **não é escala** (largura de
  grade, espessura de borda, margem negativa de ajuste, reserva de espaço).
- **CSS novo escreve TOKEN, não hex** (TD-014): idem para COR. Significado →
  `--danger`/`--warn`/`--success`/`--accent`; fundo tênue → `-soft`, fundo forte/hover/borda sutil →
  `-tint`, borda → `-line`. **Três papéis do laranja:** `--accent` só onde NÃO carrega letra ·
  `--accent-text` quando É texto · `--accent-strong` quando carrega texto **branco** em cima.
  Categorias de custo → `--cost-*`. Hex cru só para `#fff` sobre preenchimento e sombras.
  **Ação destrutiva se anuncia em repouso** (UX-36): `.btn.danger` e `.icon-button.danger` usam o
  mesmo trio `--danger` + `-soft` + `-line` (`-tint` no hover). Contorno de ícone é
  `box-shadow: inset`, nunca `border` — borda muda a caixa e o controle pula.
  ⚠ **Ao escolher/alterar um tom, meça no DOM o PIOR fundo real** (o tingimento a 10% come ~0,3), e
  **mate `transition` antes de ler** — senão a medida pega a cor no meio da troca de tema.
- **Coluna flexível de grade escreve `minmax(0, 1fr)`, nunca `1fr` puro** (auditoria 2026-08-17): o
  mínimo implícito de `1fr` é o **min-content**, e `<select>` de option longa ou `<input
  type="date">` **não encolhem** — a coluna estoura em vez de ceder (foi a causa das 3 quebras).
  ⚠ **Ao sobrescrever `grid-template-columns` numa media query, reescreva a guarda junto** — não é
  herdada. Idem para **compensação calibrada sobre token** (o `padding` do date, UX-22): token que
  muda por faixa exige compensação que muda junto.
- **Fileira que não cabe no celular VIRA CARTÃO, não rolagem** (UX-38/UX-40): quando as colunas
  passam dos ~300px úteis de 375, a linha quebra em faixas (nome + ação em cima, números embaixo,
  encostados à direita) — receita do `.fg-part`; hoje em 4 lugares. Rolar de lado esconde justamente
  a coluna que se quer ler. ⚠ Ao desmontar uma `<table>` em grade, **todo seletor de elemento usa
  combinador de FILHO** (`> tbody`, `> td`): há tabela dentro de dropdown, e `tbody` solto quebra o
  alinhamento dela. E **`@media` não soma especificidade** — bloco que reescreve regra-base vai
  DEPOIS dela no arquivo.
- **Coluna de número usa `.num`** (direita) — `sales.css`, `cesta-recibo.css`, `catalog.css`.
  `tabular-nums` é global (`body`, UX-27): não redeclarar por componente. **Faixa de número tem
  PISO `max(rótulo, conteúdo)` medido no DOM; faixa de nome tem reticências** (UX-21) — número
  cortado vira outro número. Rolagem horizontal só como válvula (`min-width`).
- **Composição de custo é UM desenho só** (UX-26): `CostStack` (em `CostBars.tsx`) — faixa
  empilhada **100% sobre o total**, `flex-grow` proporcional, legenda com % (e R$ quando
  `showValue`). Consumida pela calculadora, pelo catálogo e pelo `/estoque`. **Barra nova de
  composição não se desenha na mão**; e a régua **nunca** é o maior item — é o total.
- **Cabeçalho, introdução e MODAL são COMPONENTE** — `PageHeader`, `PageIntro` e `Modal`. Página
  nova não copia `.header` nem inventa `.subtitle`/`.stock-intro`/`.roi-note` próprios; **modal novo
  não escreve `.modal-overlay` na mão** — usa o `<Modal>` (título/sub/corpo/rodapé) e ganha papel,
  Escape, trava de rolagem e ✕ de graça.
- **Título de seção é `<h2>`, não `<div>`** (UX-29). O `base.css` zera tamanho/margem de heading —
  quem manda é a classe, então trocar a tag não move pixel. Linha de LISTA continua sem heading (o
  sumário viraria ruído). **Foco é `:focus-visible` + `--focus-ring`** (UX-31): controle novo não
  precisa declarar nada; ⚠ campo que apagar o `outline` no `:focus` tem de devolver o anel **no
  mesmo arquivo** — `base.css` é o 1º import e perde o desempate de especificidade.
  **Alvo pequeno cresce por `padding`/`min-height` + margem negativa de igual valor** (UX-28/UX-37):
  o alvo sobe, a caixa no fluxo não. **Meça a faixa antes de engordar botão em fileira** — no
  desktop o alvo maior pode não caber, e 44px é regra do DEDO (UX-36: 44 no celular, 32 no desktop).
  **Botão só-ícone precisa de `aria-label`** (A11Y-01) — `title` é o último recurso do nome
  acessível, e rótulo escondido por CSS no celular não conta como texto.
- **Máquinas são compartilhadas entre dispositivos** (doc `config/machines`, realtime): editar
  watts/`lifeHours` recalcula energia e desgaste de TODOS os produtos, que guardam só o `machineId`.
  `useMachines` semeia de `DEFAULT_MACHINES` na 1ª vez e cai pra fallback local em caso de erro.
- **Função que REMONTA objeto salvo copia TODO campo — ou come dado calado** (FORM-01):
  `createStage`/`createAccessory` e os pares `to*`/`*ToDocument`; o que falta vira `null` no save
  seguinte (`buildPayload` grava `?? null`). Campo novo entra nos **dois** lados no mesmo commit.
  ⚠ **Preço não é canário** (o `supplyId` sumia sem mover um centavo): o teste é **diff campo a
  campo do documento**. **Tarifa e valor-hora são do PRODUTO**, nunca da etapa — não devolver.
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

### 5. Manter o "Status atual" atualizado
- Ao concluir uma mudança relevante (feature, correção, decisão de arquitetura/infra),
  **atualize a seção "Status atual"** no topo deste arquivo.
- **Regras de tamanho (para não virar changelog):** Status **≤ ~40 linhas** · registre **só a
  mudança MAIS recente** e **substitua** a anterior (nada de correntes `Antes: … Antes: …`) ·
  consolide em bullets estáveis, não em parágrafos de implementação (isso mora no código e no
  `git log`) · o **porquê** de uma decisão vai pro [`HISTORICO.md`](.claude/HISTORICO.md) e o item
  aberto pro [`BACKLOG.md`](.claude/BACKLOG.md) — **nunca** pro Status. **Ver a Diretriz 8:** a
  faxina vale pro arquivo INTEIRO.
- Objetivo: permitir abrir um **chat novo por tarefa** e continuar sem perder contexto.
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

### 8. Manter o CLAUDE.md INTEIRO enxuto — e a doc dividida em 3 arquivos por custo de token
- **Por que importa:** só o `CLAUDE.md` é **auto-carregado no início de todo chat e re-enviado a cada
  turno** — cada linha aqui é token multiplicado por toda conversa. Os outros dois só entram em contexto
  **quando eu os leio** (`Read`), e só nos chats que precisam. Por isso a divisão abaixo.
- **Os 3 arquivos e seus papéis:**
  - **`CLAUDE.md`** (auto, todo turno · alvo **≤ ~270 linhas**): foto do AGORA (Status) + **a próxima
    tarefa sugerida**, stack/estrutura, as diretrizes, infra de deploy, comandos. O que o modelo precisa
    **em TODA conversa**.
  - **[`.claude/BACKLOG.md`](.claude/BACKLOG.md)** (a-fazer / roadmap · curto): só os itens **abertos** +
    ordem de prioridade. É o que se lê pra **escolher/rever** a próxima tarefa.
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
- **Framework:** fixado em `vercel.json` (`"framework": "nextjs"`) — não mexer: sem isso o projeto
  cai numa config estática herdada que quebra o build. As `NEXT_PUBLIC_FIREBASE_*` da Vercel são
  **ignoradas** (a config é FIXA no `client.ts`).
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
