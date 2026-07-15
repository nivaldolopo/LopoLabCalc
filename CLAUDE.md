# LopoLabCalc — Orientações para o chat

> Este arquivo é lido automaticamente pelo Claude Code no início de cada conversa.
> Leia as **Diretrizes de trabalho** antes de qualquer ação.

## Status atual (contexto de continuidade)

> Foto do **AGORA** para permitir abrir um chat novo por tarefa. Manter curto e atual —
> não é histórico (o git já guarda o detalhe). Regras de tamanho na Diretriz 5.

- **Estado do site:** no ar e estável (produção `● Ready`). Acessível por
  **`calculadora.lopolab.com.br`** (domínio próprio, SSL ok) e pelo `lopolabcalc.vercel.app`.
- **Última mudança:** **7b FEITA — rota `/estoque` (CRUD de cores + rolos).** `StockPage` + 3 modais
  (cor / rolo / ajuste), `styles/stock.css`, link 📦 no header. Cartão por cor com saldo, rolo em uso,
  preço de repor e alerta de mínimo; arquivar/reativar/excluir; detalhe com rolos, "rolos anteriores"
  e extrato v1 (compra + ajuste — o consumo é a 3ª fonte e só nasce na 8, D6.1). 5 helpers puros
  novos no `lib/stock.ts` (`filamentLabel`, `materialOptions`, `rollNumbers`, `colorStatement`,
  `filamentReferences`) — a tela não monta nada derivado no JSX, senão a 7c remonta e diverge.
  `adjustRoll` é o **único caminho da tela que toca `remainingG`** (D6). De carona: os helpers de
  data saíram duplicados de `SaleModal`+`QuotePage` pra **`lib/formatting/date.ts`** (o estoque seria
  a 3ª cópia). `lint`+`test` (**102 verdes, +10**)+`build` limpos. Decisões da etapa e recorte: item 3
  do backlog. **Ainda desligada do produto — nenhum preço muda.**
  **Próximo passo (Tier 1): 7c — dropdown de cor no produto (preço vivo).**
  **`7a ✅ → 7b ✅ → 7c → FEAT-01 → 8`** (detalhe e decisões D1-D8: item 3 do backlog). Lembretes da
  7c: **é onde preços PODEM mudar**; **não** mostrar "quanto resta no rolo" nem avisos D5 ali (entre
  7c e 8 nada deduz → seria ficção); matar o legado do FEAT-02 de carona (Diretriz 7);
  ⚠ `makeFilament`/`stripFilamentIds` (`lib/filaments.ts`) **descartam `material`/`brand`** — a 7c
  precisa passá-los adiante, senão o D7 morre calado. Restam da auditoria: **TD-003** (capacidade
  por-máquina, casar com Dashboard) e **TD-006** (paginação).
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
- **TO-DO em aberto:** (a) item 3 — **Estoque** (`/estoque`) — **EM ANDAMENTO: 7a ✅ + 7b ✅**,
  próximo é a **7c**; coleção `estoque` (um doc por COR, rolos dentro); decisões D1-D8 e as etapas
  no item 3 do backlog; (b) item 4 — **Dashboard** (`/painel`, só vale com ~1-2 meses de vendas; incorpora
  TD-003 capacidade por-máquina/gargalo); (c) **logo real** no PDF do orçamento (placeholder hoje).
  **Auditoria do GPT: TD-001/004/005/007/008/009 FEITOS; restam TD-003 e TD-006** (no backlog, não
  descartados). Menores mantidos no backlog: numeração de orçamento derivada no browser, labor na
  reserva de falha, `window.confirm` destrutivos (mantidos nativos por decisão).
- **Decisões pendentes:** variáveis de **Preview** do Firebase não cadastradas (por decisão —
  só Production; ver Diretriz 1). Nada quebrado. Encerradas: comparação com o Pea3D (taxa de
  pagamento e ROI ✅ feitos; **conversão peso↔metragem descartada** pelo dono — não repropor).

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
3. **Controle de estoque** *(rota `/estoque`)* — **MODELO APROVADO (jul/2026), a codar.** Cadastrar
   filamento (e depois insumos: ímãs, parafusos, rolamentos, chaveiros, embalagem) e dar **baixa
   automática** ao registrar a venda — unindo custo + venda + estoque num fluxo só. **Depende do
   item 1** (feito) e do **FEAT-02 lado-produto** (feito — `filamentId` já existe em todo
   `FilamentUsage`, hoje `null` → **nenhuma migração**).

   **Decisões do dono (fechadas — não rediscutir sem ele):**
   - **(D1) Filamento e insumos são entregas SEPARADAS**, uma por chat. Filamento primeiro (o
     `filamentId` já está plugado); insumos depois (item 7e), porque `Accessory` é `{desc, qty,
     unitPrice}` **texto livre, sem gancho** — ligá-lo ao estoque é um FEAT-02 inteiro do lado do
     acessório (tipo novo, migração texto→referência, UI, snapshot, baixa por unidade). **Não dá pra
     inverter a ordem** (o `supplyId` precisaria apontar pra um cadastro que ainda não existe), MAS
     o `stockMoves` da venda **nasceu genérico já na 7a** (`kind: 'filament' | 'supply'`, e o
     `stockId` aponta pra cor OU pro insumo) — senão a 7e forçaria **migrar documentos de venda já
     gravados**.
   - **(D2) Filamento = COR no dropdown, ROLOS por baixo (híbrido).** O produto aponta pra **cor**
     (`StockFilament`, id **estável**); os **rolos** (`FilamentRoll`) vivem dentro dela, cada um com
     o preço real pago, consumidos **do mais antigo pro mais novo** (FIFO). **Por que não SKU
     simples** (chegou a ser decidido e foi revertido): o dono cadastra **por rolo** e arquiva o rolo
     quando acaba — se a entrada FOSSE o rolo, o `filamentId` do produto apontaria pra algo
     descartável e **todo produto da cor ficaria órfão a cada rolo que termina** (e, com D3, cairia
     em silêncio no preço de fallback). O híbrido dá o id estável pro produto e o descarte pro rolo.
     Rolo zerado **fica no array** como histórico de compra (a UI esconde atrás de "rolos
     anteriores"); serve de base pra "quanto gastei em filamento".
   - **(D3) Preço/kg é VIVO, vem do estoque — com DOIS preços, por contexto.** O produto guarda só o
     `filamentId`; o preço sai da cor na hora do cálculo (**igual às máquinas hoje**: produto guarda
     `machineId`, watts vêm vivos). Mas:
     - **Catálogo/calculadora → preço do rolo MAIS NOVO** (custo de repor). Precificar é sobre a
       *próxima* impressão; assim nunca subprecifica em cima de um rolo velho quase vazio.
     - **Venda → preço do(s) rolo(s) EM USO** (FIFO), custo **real**. Se a impressão atravessar
       rolos, o custo é **misto e exato** (ex.: 100 g × R$90 + 50 g × R$110) — o consumo FIFO já diz
       de qual rolo saiu quanto, então é só somar.
     - ⚠ **Consequência intencional:** a **margem da venda diverge da margem do catálogo**. O dono
       quer isso ("fiel ao custo/lucro"). A `SaleModal` **tem que mostrar** o custo real e de onde
       veio, senão vira surpresa.
     - O `pricePerKg` gravado no `FilamentUsage` vira **fallback**: filamento avulso (fora do
       estoque) ou cor excluída.
   - **(D4) Saldo negativo é PERMITIDO, com aviso.** A venda é um fato consumado — bloquear o
     registro por falta de saldo perderia dado real, e negativo é justamente o sintoma de contagem
     furada que se quer enxergar. Nunca "deduzir até zero" (esconde o tamanho do furo).
   - **(D5) Dois avisos de "cabe?", com gravidades diferentes** (pedido do dono):
     - **Passa do rolo EM USO** → informativo: vai atravessar pro próximo rolo (custo misto). Na
       **A1 sem AMS isso é troca manual no meio da impressão** → o dono quer ver isso ao planejar.
     - **Passa do estoque TOTAL da cor** → aviso forte; é o negativo do D4.
     A UI mostra **qual rolo está em uso e quanto resta nele** junto do dropdown (7c) e na venda (8).
   - **(D6) Ajuste de inventário tem RASTRO** (pedido do dono: "histórico mais fiel possível").
     Contar o rolo e corrigir o saldo **não** é editar `remainingG` na mão — é `adjustRoll(cor,
     rollId, countedG, reason, at)` (puro, em `lib/stock.ts`), que anexa um `StockAdjustment` ao doc
     da cor. **Nenhum outro caminho** muda `remainingG` manualmente, senão o rastro fura no primeiro
     atalho. Guarda `beforeG` **e** `afterG` (o delta se deriva; o inverso não — um rastro que só diz
     "−70 g" perde qual era o furo). **Rolo arquivado/zerado também pode ser ajustado** (achou o spool
     na gaveta e não estava vazio). **Ajuste é o remédio do D4:** com saldo negativo por overdraft, a
     contagem gera delta positivo e o `beforeG` negativo **fica gravado como prova do tamanho do furo**.
   - **(D6.1) NÃO duplicar o consumo dentro do doc da cor.** Os 3 eventos de uma cor já têm dono:
     **compra** = o próprio `FilamentRoll` (data/preço/nota); **consumo** = `stockMoves` no doc da
     VENDA (é de lá que o estorno lê); **ajuste** = `StockAdjustment` (D6). Copiar o consumo pra cor
     criaria 2ª fonte da verdade do mesmo fato — e num rastro de auditoria, 2 fontes que divergem são
     piores que 1. O "extrato da cor" (compra → consumo → ajuste em ordem) se **monta na tela**
     juntando as 3 fontes, sem duplicar dado. ⚠ **Mas o extrato nasce em DUAS partes:** o consumo
     mora no `stockMoves` do doc da VENDA, que só passa a existir no **passo 8** — então o **extrato
     v1 da 7b tem só compra + ajuste** (2 das 3 fontes), e o consumo entra na 8. Não tentar construir
     a 3ª fonte na 7b: não há dado.
   - **(D7) `material` fica na COR e no SNAPSHOT — NUNCA no rolo.** A cor **é** material+marca+cor,
     então todo rolo dentro de "PLA Basic Preto" é PLA por construção. Pôr `material` no rolo
     permitiria um rolo de PETG dentro da cor PLA → o FIFO consumiria PETG numa impressão de PLA (o
     cadastro passaria a poder mentir), sem ganhar expressividade nenhuma. **O buraco real** que o
     pedido do dono ("saber o que imprime em qual material") achou é outro: o campo "Material" da
     venda é **texto livre digitado à mão**, opcional (`SaleModal.tsx`, ~linha 546), **um só por
     item** (multicolor em PLA+PETG não é representável) — e `FilamentUsage` **não congela** o
     material, então o histórico dependeria de consultar a cor VIVA (que pode ter sido arquivada),
     violando a foto congelada. **Solução:** `material` e `brand` entram no **`FilamentUsage`**,
     preenchidos automático pela cor escolhida (7c) e **congelados na venda** (8), por cor. O campo
     de texto da venda vira derivado (ou sai) — **dono: passo 8** (era um buraco sem etapa
     responsável; sem isso o `SaleInput.material` fica órfão pra sempre).
   - **(D8) `material` é INPUT PRÓPRIO — a cor não tem campo de "nome".** O nome exibido
     ("PLA Basic · Preto · Bambu") é **derivado** de material+brand+colorName. É isso que deixa
     agrupar por material sem parsear texto. **Decisão da 7b:** o input é **dropdown dos materiais
     já cadastrados + opção de digitar um novo** (que passa a aparecer na lista). Texto livre puro
     deixaria "PLA"/"pla"/"PLA Basic" virarem 3 materiais no agrupamento — o "lucro por material" do
     Dashboard mentiria calado (mesmo furo do campo digitado à mão do D7). Lista fixa também não:
     trava no dia que entrar material fora dela.

   **Modelo (híbrido cor + rolos):**
   ```ts
   type FilamentRoll = {
     id: string;
     purchaseDate: number;
     initialG: number;      // 1000 normalmente
     remainingG: number;    // drena FIFO; o excedente vira negativo no rolo mais novo (D4)
     pricePerKg: number;    // preço REAL pago neste rolo
     note?: string;         // NF/fornecedor
   };

   type StockAdjustment = { // D6: rastro da contagem de inventário
     id: string;
     at: number;            // quando a contagem foi feita
     rollId: string;        // qual rolo foi contado
     beforeG: number;       // o que o sistema achava que tinha (pode ser NEGATIVO — D4)
     afterG: number;        // o que foi contado de verdade
     reason: string;        // "contagem", "sobrou no bico", "rolo veio com menos"...
   };

   type StockFilament = {   // = a COR; é o que o produto aponta (filamentId ESTÁVEL)
     id: string;
     // SEM campo de nome — o nome exibido é derivado destes 3 (D8).
     material: string; brand: string; colorName: string; colorHex?: string;
     minG: number;          // alerta de estoque mínimo (0 = sem alerta)
     archived: boolean;     // "parei de usar essa cor" (raro; NÃO é "rolo acabou")
     rolls: FilamentRoll[]; // saldo = Σ remainingG
     adjustments: StockAdjustment[]; // D6
     createdAt: number;
   };
   ```
   Coleção `estoque` (um doc por COR, rolos em array dentro — poucos por cor, mantém a escrita
   atômica), padrão do `productsRepository`. Baixa **dentro do mesmo `writeBatch` da `saveRecibo`**
   (atômica com a venda).

   **`lib/stock.ts` (matemática pura, 7a)** — o miolo é uma simulação FIFO que serve aos 3 usos
   (aviso no form, custo da venda, baixa): `simulateConsumption(cor, gramas)` → `{ moves, cost,
   crossesRoll, shortfallG }` (puro: descreve o que aconteceria, não muda a cor);
   `applyConsumption` / `reverseConsumption`; `adjustRoll` (D6); `catalogPricePerKg` (rolo
   mais novo) e `saleCost` (FIFO, D3); `balanceG`; alerta de mínimo.

   **Ponto mais frágil — o ESTORNO:** a venda **tem que gravar o que deduziu**
   (`stockMoves: [{ itemId, kind: 'filament', stockId, rollId, qty }]` no próprio doc da venda —
   `stockId` = a cor de origem, **sem ele o estorno teria que varrer todas as cores atrás do
   `rollId`**; decidido na 7a), senão editar
   um recibo de 3 → 2 unidades corrompe o estoque em silêncio. Editar/excluir recibo **estorna
   exatamente** o que consta no `stockMoves` (por rolo — inclusive rolo já zerado/arquivado).
   Vendas anteriores ao recurso não têm o campo → **não estornar**.

   **Etapas (uma por chat, nesta ordem):**
   - **7a — Modelo + repo (sem UI). ✅ FEITA (jul/2026).** Entregue: tipos (`FilamentRoll`,
     `StockAdjustment`, `StockFilament`+`Input`/`Payload`, `StockMove` genérico com **`stockId`**,
     `ConsumptionResult`) + `material?`/`brand?` no `FilamentUsage` (D7); `lib/stock.ts` puro;
     `stockRepository.ts` (coleção `estoque`) + `useStock`; 30 testes. Regras do Firestore não
     mudaram (wildcard `/{document=**}`). Nada plugado — nenhum preço mudou. Detalhe no "Status atual".
   - **7b — Rota `/estoque` (CRUD). ✅ FEITA (jul/2026).** Entregue: `StockPage` + 3 modais
     (cor / rolo / ajuste), `styles/stock.css`, link 📦 no header. Lista por cor com saldo, bolinha,
     rolo em uso, preço de repor e alerta de mínimo; criar/editar cor (material = dropdown + digitar
     novo, D8); registrar rolo; ajuste via `adjustRoll` (D6 — único caminho da tela que toca
     `remainingG`); arquivar/reativar; "rolos anteriores"; extrato v1 (compra + ajuste, D6.1).
     Helpers puros novos no `lib/stock.ts`: `filamentLabel`, `materialOptions`, `rollNumbers`,
     `colorStatement`, `filamentReferences`. **Decisões do dono:** só arquivar, mas **excluir
     liberado em cor arquivada SEM referências** (produto/venda apontando pro `filamentId`;
     `filamentReferences` é o guarda — inerte até a 7c, quando os `filamentId` deixam de ser `null`);
     **editar cor liberado** (inclusive `material`, que re-agrupa retroativo — ok por Diretriz 7);
     rolo default 1000 g. Ainda **desligado** do produto. Detalhe no "Status atual".
   - **7c — Ligar produto ↔ estoque.** O campo "Cor" do `FilamentColorsSection` vira **dropdown de
     cor**, e passa a aparecer **também no monocolor** (mono = array de 1 → escolhe a cor pra puxar
     preço e dar baixa). Opção **"avulso"** revela o texto livre + preço manual (fallback D3).
     `calculatePricing` usa o **preço do rolo mais novo** (D3); badge quando a cor sumiu, **no molde
     do `machineMissing`/TD-009**. ⚠ **É aqui que preços podem mudar** (produto ligado a cor
     reajustada).
     ⚠ **NÃO mostrar "rolo em uso + quanto resta" nem os avisos do D5 aqui** — entre a 7c e a 8
     **nada deduz nada**, então o saldo só se move por compra ou ajuste manual e o número exibido
     seria ficção crescente. Esse display **é da 8** (ou a 7c e a 8 saem em sequência imediata, sem
     janela). Recorte da 7c = dropdown + preço vivo + badge de cor sumida.
     **Aproveitar o chat p/ matar o legado do FEAT-02** (Diretriz 7 — o FEAT-02 é anterior a ela):
     `weightG`/`filamentPricePerKg` só-leitura, `normalizeFilaments` e o round-trip do CSV velho
     viram peso morto assim que a cor vem do estoque. A 7c já reescreve o `FilamentColorsSection` e
     mexe no CSV → custo quase zero agora, tarefa inteira depois. Avisar o dono o que ele recadastra.
   - **FEAT-01 — Preço/subitens por etapa (ENTRA AQUI, antes da 8).** Não é do Estoque, mas o passo 8
     depende dele: se um item de venda pode ser "uma etapa"/"um grupo de etapas", isso muda o que a
     baixa deduz. Fazer antes evita nascer o passo 8 sabendo só vender produto inteiro e refazê-lo.
     **Decisão do rateio (exato/aditivo) ainda em aberto — o dono decidiu resolver no PRÓPRIO chat
     do FEAT-01** (não em paralelo com 7a/7b/7c). Não cobrar a decisão antes: 7a/7b/7c não dependem dela.
     Detalhe no item FEAT-01 (seção "Ideias/ajustes trazidos pelo dono").
   - **8 — Baixa na venda (fecha o FEAT-02).** `saveRecibo` deduz FIFO no batch atômico; custo real
     recalculado pelo consumo (D3) e **exibido na `SaleModal`**; editar/excluir estorna via
     `stockMoves`; avisos D4/D5 + **"rolo em uso e quanto resta"** (herdado da 7c: só faz sentido
     quando a dedução existe). **Consumo entra no extrato da cor** (3ª fonte, fecha o D6.1/7b).
     **`SaleInput.material` (texto livre) vira derivado do `FilamentUsage.material` congelado, ou
     sai** (D7). **Fim do Tier 1.**
   - **7e — Insumos (item próprio, depois).** `supplyId` no `Accessory`, cadastro de insumos na
     `/estoque`, baixa por unidade (`kind: 'supply'`, já previsto no `stockMoves`). Ver D1.

   Alto valor no dia a dia, mas exige disciplina (estoque desatualizado é pior que nenhum) — o dono
   confirmou que a disciplina de marcar venda/baixa está OK.
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

- ✅ **[UX-01] Zero à esquerda ao reescrever campo numérico — FEITO.** Criado o componente
  compartilhado `NumberInput` (`components/NumberInput.tsx`): guarda a **string exibida** em estado
  local (fica vazio ao apagar, não vira `0`), emite número **clampado** por `min`/`max`, normaliza a
  exibição **no blur** e resync com o valor externo pelo padrão "ajustar estado no render". Adotado
  nas 8 telas (`NumberField` do `ProductForm` passou a usá-lo; + `AccessoriesSection`,
  `ExtraStagesSection`, `CapacityPanel`, `FixedCostsPanel`, `SaleModal`, `QuotePage`,
  `MachineManagerModal`). Clamps de call-site redundantes removidos. Só UI, sem migração.
- ⬜ **[FEAT-01] Preço por etapa (etapa como item opcional no orçamento/venda)** *(**Tier 1, entre a
  7c e a 8** · tamanho médio · **pré-requisito técnico da 8**)*. Salvar/mostrar o preço calculado e proporcional de **cada etapa** do
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

  **⚠ Isto é CAPTURA, não conveniência (revisão jul/2026 — corrige análise errada anterior).** Cotar
  etapa separada leva a **vender** etapa separada. A `QuotePage` tem "Item livre" (~linha 513), mas a
  **`SaleModal` NÃO tem** — ela só monta itens a partir de `catalogItems` e todo item exige
  `source.productId` (~linha 298). Ou seja: **o orçamento da etapa sai hoje; a venda dela não tem como
  ser registrada como ela mesma.** As 3 saídas atuais são todas ruins — registrar o produto inteiro
  (custo/preço/peso errados), criar produto-fantasma no catálogo (duplica dado), ou não registrar
  (perde a venda). **Pior depois do passo 8:** a baixa deduz FIFO a partir do `filaments[]` do
  snapshot → registrar o produto inteiro numa venda de uma etapa **dá baixa do filamento do produto
  inteiro**, e o erro sai do histórico e entra no **estoque físico** (o único dado que a Diretriz 7
  NÃO deixa descartar — os rolos são reais).

  **Por que entre a 7c e a 8, e não antes da 7a** (decisão do dono, jul/2026): o acoplamento
  FEAT-01 ↔ Estoque é **só no passo 8** — se um item de venda pode ser "uma etapa"/"um grupo", muda
  o que a baixa deduz. A 7a (FIFO puro; o `itemId` do `StockMove` já é id opaco genérico por D1),
  a 7b (CRUD de cor/rolo) e a 7c (dropdown; FEAT-01 é camada de preço/agrupamento sobre etapas que
  já existem — não muda onde o filamento é declarado, `PrintStage.filaments[]` já é por etapa) **não
  são influenciadas**. Encaixar aqui faz o passo 8 nascer sabendo vender etapa, sem parar 3 chats de
  trabalho pronto enquanto o rateio (decisão aberta, poste longo) é decidido.

  **UX exigida pelo dono (jul/2026):** a etapa a orçar é **SELECIONADA entre as etapas já
  cadastradas do produto — nunca digitada à mão**. E o **"Item livre" CONTINUA existindo** (item
  genérico, fora do catálogo). Os dois convivem: não são o mesmo controle.
  - **Lado orçamento = barato.** Item de catálogo e item livre **já são a mesma forma**:
    `QuoteItemSnapshot = {description, quantity, unitPrice}` (`types.ts` ~313) — o orçamento **nem
    guarda `productId`**. "Adicionar do catálogo" é um `<select>` que só preenche descrição+preço
    (`QuotePage.tsx` ~494); "Item livre" é botão separado (~508). → **selecionar etapa = 3º modo de
    preencher a mesma forma**; o item livre não é ameaçado (controles independentes).
  - **Lado venda = estrutural.** Na `SaleModal` o item guarda `productId` + snapshot congelado +
    `filaments[]` e dirige a **baixa** (passo 8). Selecionar etapa ali muda o dado, não só a tela.
    É aqui que mora o trabalho real — mesma UI, profundidades diferentes.
  - **⚠ Depende do rateio:** o seletor precisa **exibir um preço por etapa/grupo** na lista. Sem a
    regra de rateio decidida, não há o que mostrar → reforça que o rateio é o poste longo.
  - **❓ EM ABERTO — onde mora o "grupo de etapas"?** O dono quer agrupar etapas num subitem (4
    etapas → 2 subitens). Se o grupo for montado **no orçamento**, ele re-agrupa a cada cotação —
    exatamente o trabalho manual que ele recusou. **Proposta (a confirmar):** o grupo é definido
    **no PRODUTO** (`ProductForm`, uma vez), e orçamento/venda só **selecionam** entre etapas e
    grupos já prontos. Confirmar com o dono antes de codar.

  **⚠ NÃO DIVIDIR em "orçamento primeiro, venda depois" (decidido jul/2026).** É tentador, porque o
  lado-orçamento é barato e o lado-venda é estrutural (ver os dois bullets acima) — mas entregar só a
  metade do orçamento faz o dono **cotar** etapa separada sem poder **registrar** a venda dela na
  `SaleModal` (catálogo-only), criando ativamente o buraco de captura que este item existe pra fechar.
  O FEAT-01 sai **inteiro** (orçamento + venda) ou não sai. A tentação de fatiar vai voltar — é esta
  nota que a responde.

  **Escape hatch NÃO necessário:** cogitou-se copiar o "Item livre" da `QuotePage` pra `SaleModal`
  como curativo. Descartado — o FEAT-01 já vem antes do marco, e item livre captura só **preço**
  (sem `filaments[]`, sem baixa, sem "lucro por material"). Retomar só se uma venda de etapa
  aparecer antes do FEAT-01 ficar pronto.
- 🟡 **[FEAT-02] Gasto de filamento por cor (multicor / AMS / dual nozzle)** — **LADO-PRODUTO ✅ FEITO
  (jul/2026); baixa de estoque = passo 8 (pendente, depende do Estoque).** **DECISÃO p/ o Estoque
  (passo 7/8):** o campo **"Cor"** (texto livre, hoje só no multicolor) vira um **dropdown de seleção
  da COR cadastrada no Estoque** (a cor, NÃO o rolo — ver D2 no item 3 do backlog) e passa a aparecer
  **também no monocolor** (mono = array de 1 → também escolhe qual filamento do estoque, pra puxar
  preço e dar baixa). O `filamentId` já existe em TODO `FilamentUsage` (inclusive mono), hoje `null`
  → não precisa migração, só ligar o dropdown; o texto `colorName` fica como **fallback de filamento
  avulso** (fora do estoque). Modelo `FilamentUsage`
  (`totalG` canônico + model/purga/torre opcional), `filaments[]` em produto/etapa, `lib/filaments.ts`,
  `FilamentColorsSection`, custo por cor no cálculo, e **snapshot da venda congela as cores**. Falta só
  deduzir do spool ao efetivar a venda (passo 8). *Contexto original abaixo mantido:* Permitir marcar a
  impressão como **monocolor ou colorida**; se colorida,
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
- ✅ **[UX-02] Entrada de tempo de impressão em horas + minutos — FEITO.** O `PrintTimeField`
  (compartilhado por `ProductForm` e `ExtraStagesSection`) passou a ter **dois campos fixos** (horas +
  minutos). O campo de horas **aceita decimal** e, no **blur**, o total normaliza pra horas inteiras +
  minutos 0-59 (`11.85` → `11 h 51 min`; rollover de 60 min). Só minutos ou só horas decimais seguem
  funcionando. Removido o `<select>` de unidade. **Só UI:** dado guardado como `printHours` decimal —
  sem migração. Resync com prop externa via padrão React "ajustar estado no render" (evita o lint
  `set-state-in-effect`).
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
  `calculatePricing.ts` (linha do `contributionPrice`). **Priorizada no Tier 4** (item 16).
- ✅ **[UX-03] Telefone e Instagram clicáveis no PDF do orçamento — FEITO.** No cabeçalho do PDF,
  o **telefone** virou link de **WhatsApp** (`https://wa.me/...`, novo helper `whatsappUrl` garante
  o DDI **55** quando o número vem só com DDD — 10/11 díg.) e o **@ do Instagram** virou link pro
  perfil (`https://instagram.com/<handle>`, novo `instagramUrl`). O loop de contato passou a usar
  `doc.textWithLink(texto, x, y, { url })` quando há URL (e-mail segue texto puro). Isolado em
  `generateQuotePdf.ts`; sem mudança de dados.
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
- ✅ **[UX-04] Botão "Nova venda" no topo da `/vendas` — FEITO.** Botão no header da `SalesPage`
  (ícone `Plus`) abre o `SaleModal` em **modo novo** (`seed={null}`, cesta vazia; estado `newSale`
  separado do `editRecibo`), escolhendo itens pelo seletor de catálogo já existente e gravando via
  `saveRecibo`. Desabilitado quando o catálogo está vazio (senão não há como adicionar itens). Estado
  vazio da página passou a apontar pro botão. Sem migração — mesmo fluxo do registro pelo card.

**Ordem sugerida do backlog (jul/2026) — inclui itens antigos + ideias novas:**

> Priorização unificada acordada no chat. Guia: barato-e-destrava primeiro; captura antes de
> análise; features grandes por dependência, não por valor. O dono ajusta quando quiser.
> **REAVALIADA (jul/2026):** o dono confirmou **multicolor frequente** + **disciplina de marcar
> venda/baixa OK**. Consequência: o par Estoque+FEAT-02 foi **desmembrado** — a correção de custo
> por cor (dinheiro real, subprecificação hoje) **sobe e destrava-se do Estoque**; o Estoque vem
> logo atrás. FEAT-03 deixa de ser bloco monolítico: seus quick wins podem entrar em paralelo.

- **Tier 0 (limpar já — pequenos/baratos, alguns destravam) — ✅ FECHADO:** (1) ~~**DEC-01**~~ FEITO
  (markup nunca no fixo, toggle removido); (2) ~~**UX-04**~~ FEITO (botão "Nova venda" na
  `/vendas`); (3) ~~**UX-03**~~ FEITO (telefone/Instagram clicáveis no PDF); (4) ~~**UX-02**~~
  FEITO (tempo em h+min); (5) ~~**UX-01**~~ FEITO (zero à esquerda, componente `NumberInput`).
  **Próximo: Tier 1.**
- **Tier 1 (precisão de custo + fundação):** (6) ~~**FEAT-02 lado-produto**~~ **✅ FEITO** (cores no
  produto/etapa, custo por cor, snapshot da venda congela `filaments[]`); **Item 3 — Estoque**
  (modelo **aprovado**, detalhe e decisões D1-D8 no item 3 do backlog), quebrado em **uma etapa por
  chat**: ~~(7a) modelo + repo, sem UI~~ **✅ FEITA**; ~~(7b) rota `/estoque` (CRUD de cores +
  rolos)~~ **✅ FEITA**;
  (7c) dropdown de cor no produto (preço vivo) — **próximo**; **(9) FEAT-01** preço/subitens por etapa
  (rateio exato/aditivo) — **subiu do Tier 2 (jul/2026): é captura, e o passo 8 depende dele**;
  (8) **FEAT-02 baixa na venda** (deduz FIFO no batch da venda, estorna via `stockMoves`).
  Insumos = (7e), **item separado depois** do filamento.
  **Ordem final do Tier 1: 7a → 7b → 7c → FEAT-01 → 8.**
- **Tier 2 (features comerciais, independentes):** (10) **FEAT-03** melhorar PDF (quick wins soltos
  podem vir antes; "detalhar etapas" espera FEAT-01); (11) **branding/logo real** no PDF (overlap c/
  FEAT-03).
- **Tier 3 (adiar até ter volume de vendas):** (12) **Item 4 — Dashboard** (`/painel`) + **TD-003**
  capacidade por-máquina; (13) **TD-006** paginação.
- **Tier 4 (menores/oportunistas):** (14) numeração de orçamento derivada no browser;
  (15) labor na reserva de falha; (16) **pendência do DEC-01 — semântica do
  `contributionMargin`** (hoje é o LUCRO por peça, não a margem de contribuição clássica;
  alimenta só o ponto de equilíbrio). **Decisão que falta:** corrigir o cálculo do break-even
  (muda comportamento — o ponto de equilíbrio diminui) ou só renomear a variável. Detalhe no
  item DEC-01 acima e na NOTA do `calculatePricing.ts`.

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
                            #   maquinas/page.tsx (ROI), estoque/page.tsx (estoque),
                            #   globals.css (só @import) + styles/*.css (CSS por área)
  features/pricing-calculator/
    components/             # UI: PricingCalculator (raiz), ProductForm, ProductCatalog,
                            #     PricingResultCard, CapacityPanel, MachineSelector,
                            #     MachineManagerModal, FixedCostsPanel, AccessoriesSection,
                            #     ExtraStagesSection, LinksSection, Header,
                            #     SaleModal (registrar venda), SalesPage (rota /vendas),
                            #     QuotePage (/orcamento), MachinesPage (/maquinas),
                            #     StockPage (/estoque) + StockColorModal/StockRollModal/
                            #     StockAdjustModal, NumberInput (compartilhado),
                            #     ProfitSummary (rentabilidade compartilhada), AuthGate (login)
    hooks/                  # useProducts, usePricingForm, useMachines, useTheme, useSales,
                            #     useAuth, useQuoteConfig (negócio), useQuotes (histórico),
                            #     useFees (taxas de pagamento), useStock (estoque de filamento)
    lib/                    # calculatePricing, calculateCapacity, validateProduct, productCsv,
                            #     saleContext (foto congelada da venda — helpers puros do SaleModal),
                            #     filaments (cores por impressão, FEAT-02), stock (FIFO do estoque:
                            #     simulate/apply/reverse/adjustRoll — matemática pura, item 3),
                            #     generateQuotePdf (orçamento), paymentFees (taxa de pagamento,
                            #     testado em paymentFees.test.ts via vitest)
    constants.ts, types.ts
  lib/
    firebase/               # client.ts (init + db), productsRepository.ts (CRUD + subscribe),
                            #   machinesRepository.ts (doc config/machines, realtime),
                            #   salesRepository.ts (coleção `vendas`, snapshots congelados),
                            #   quoteConfigRepository.ts (doc config/orcamento: dados do negócio),
                            #   quotesRepository.ts (coleção `orcamentos`: histórico de orçamentos),
                            #   feesRepository.ts (doc config/taxas: taxa % por forma de pagamento),
                            #   stockRepository.ts (coleção `estoque`: um doc por COR, rolos dentro)
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
