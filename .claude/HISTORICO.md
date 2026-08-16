# LopoLabCalc — Histórico & decisões de design

> **Arquivo pesado, lido SÓ sob demanda** — o *porquê* de cada decisão: design do Estoque
> (D1–D8), auditoria (TD-*), e os writeups completos de tudo que já foi **feito** (7a–7c,
> FEAT-01/02/04/05, passo 8, UX-*, DEC-01, bugs). Abra este arquivo quando um item precisar da
> justificativa/detalhe de implementação de algo já concluído.
>
> **Para escolher a PRÓXIMA tarefa, não é aqui** — o que falta fazer vive em
> [`.claude/BACKLOG.md`](BACKLOG.md) (a-fazer, curto). E a foto do AGORA vive no `CLAUDE.md`.
> Referências a "item 3", "FEAT-04", etc. resolvem dentro deste arquivo.

## ✅ Cluster UI/UX passo ③ — UX-13b + UX-14: o chrome do celular (2026-08-15)

Os dois itens foram juntos porque disputavam o mesmo espaço vertical (um o topo, outro o rodapé) e a
conta do `.back-to-top` teria de ser refeita duas vezes se fossem separados.

**UX-14 — a navbar virou gaveta.** Abaixo de 760px a **mesma** `.navbar-bar` sai do fluxo e vira painel
de 280px que entra pela direita; no lugar dela fica a `.navbar-mobile-head` (nome da página + ☰). Sem
markup duplicado — é CSS sobre o nó que já existia. Três detalhes que não são cosméticos:
- fechada, a gaveta é `visibility: hidden` (e não só `translateX(100%)`), senão os 7 links continuariam
  **focáveis fora da tela** na ordem de tabulação;
- fecha no ✕, no fundo escuro, no **Escape** e no `onClick` de cada `<Link>`. O caminho óbvio seria um
  `useEffect` no `pathname`, mas `setState` dentro de effect é **erro de lint** neste repo
  (`react-hooks/set-state-in-effect`). Efeito colateral aceito: com a gaveta aberta, o **botão voltar**
  do navegador não a fecha (o toque no fundo resolve);
- o backdrop tem `z-index: 80` — acima do `.back-to-top` (50) e da `.price-bar` (40), abaixo do overlay
  de modal (100). Com isso ele cobre e bloqueia os dois **sem regra extra**.

**UX-13b — a barra fixa.** `MobilePriceBar.tsx`, 56px no rodapé, com preço/peça · margem · markup ao
vivo; um toque rola até o `.result-card`. O requisito do dono ("não pode cobrir nada") virou **três
regras amarradas ao mesmo token `--price-bar-h`**: a barra, o `padding-bottom` do `.wrap.has-price-bar`
(60 → 116px) e o `.back-to-top`, que sobe a altura da barra via `body:has(.price-bar)` — regra posta no
**dono legítimo** do botão (base.css), não como antídoto no CSS de outra área. Se algum dia faltar
`:has()`, perde-se só o deslocamento.

**A faxina que veio no caminho.** O bloco mobile da navbar morava no **`quote.css`** — CSS de outra
área no arquivo da página de orçamento, o mesmo defeito do TD-013. Como o `quote.css` é o 12º `@import`
e o `header.css` o 2º, ele **venceria** o CSS novo na cascata: foi apagado, não sobrescrito.

**Medido no site rodando, antes × depois na mesma sessão** (o "antes" veio de `git stash`, para as duas
medições saírem do mesmo navegador e do mesmo produto):

| | antes | depois |
|---|---|---|
| `.navbar` (375×838) | 227px | **46px** |
| 1º campo do formulário | 421px (48,7% da tela) | **172px (19,9%)** |
| `.wrap` padding-bottom | 60px | **116px** (60 + 56) |
| desktop 1280×900 (navbar · 1º campo · página) | 53 · 240 · 1384 | **53 · 240 · 1384** |

Com a página rolada até o fim sobram **60px** entre o último card e o topo da barra, e o `.back-to-top`
para 2px acima dela. Junto saíram o sublinhado dos 7 `<Link>` (`text-decoration: none` na **classe**,
nunca num seletor `a` nu) e o `.subtitle` no celular (~60px de texto decorativo; decisão do dono).

## Infra — domínio e DNS (detalhe que saiu do `CLAUDE.md`)

`lopolab.com.br` é registrado no **registro.br**, mas a gestão de DNS foi **migrada para o Cloudflare**
(nameservers do registro.br apontando pra lá; o motivo foi o e-mail no domínio). Por isso **nada** de
DNS se mexe no registro.br — CNAME, MX e o resto vivem no painel do Cloudflare.
`calculadora.lopolab.com.br` está no ar: CNAME → `e5d09afaf3e58d32.vercel-dns-017.com`, **"DNS only" /
nuvem cinza** (nunca proxied), SSL Let's Encrypt emitido pela Vercel, domínio nos Authorized domains do
Firebase. O contexto de domínio/e-mail vive em outro projeto de chat do dono ("abertura da loja").

## ✅ FEAT-11 — Trocar a cor na produção, e a cor como dimensão do acabado (2026-08-13)

O pedido do dono era simples de enunciar: *"a mesma peça é impressa em outra cor o tempo todo, e só
dá pra trocar editando o produto no catálogo"*. O que ele destravou não foi.

### As 5 decisões do dono

1. **Escopo: A + C** — liberar a troca pontual na `/producao` **e** fazer a cor virar dimensão da SKU
   do acabado. A opção B (variantes pré-aprovadas no produto) ficou de fora.
2. **Encomenda não escolhe cor** — a venda sob encomenda produz na cor do cadastro. Coerente com o
   código: a encomenda **não credita** o acabado (produz e sai pela porta), então nunca toca uma SKU
   colorida. Trocar cor é na `/producao`.
3. **O seletor aceita avulso livre** — cores do Estoque **+** filamento fora dele (texto + R$/kg).
4. **Chave composta** em peça multicor: "Azul + Branco" é saldo próprio, não "a cor dominante".
5. **Seletor de cor por item na venda de peça pronta**, listando só cores com saldo, default = a de
   maior saldo.

### A correção que veio no meio (e que mudou o desenho)

O plano inicial avisava que "3 corpos azuis + 2 tampas vermelhas = 0 conjuntos". **Estava errado** —
e errado de um jeito que teria quebrado o produto multicor **de projeto** (corpo azul + tampa
vermelha), que é comum. O achado: **subitem é um grupo de etapas** (`Subitem.stageKeys`) e
`SubitemPrice.filaments` são as cores daquelas etapas — ou seja, **o app já sabe a cor de cada
parte**. Daí a regra final:

- **A montagem IGNORA a cor** (`assemblableWholes` soma as cores via `partBalance`). Um conjunto é
  corpo azul + tampa vermelha quando é assim que ele é; exigir cor única zeraria esse produto.
- **A cor vive na PARTE**, e a venda escolhe por parte (um seletor por peça, só quando aquela peça
  tem 2+ cores com saldo — no caso normal a tela não muda).

### O fio que liga a cor à parte certa

A `/producao` agrupa as linhas por **máquina**, mas o acabado é creditado por **subitem**. Sem
ligação entre os dois, produzir o inteiro carimbaria "Azul + Vermelho" nas duas partes. Conserto:
`FilRow` ganhou `stageKey` (as MESMAS chaves do `stageDetails` — `MAIN_STAGE_KEY` / `stageKeyFor`,
que virou exportada), e `submissionColors` recorta as cores por `Subitem.stageKeys`. Resultado:
corpo=Azul, tampa=Vermelho num evento só, **e a troca feita na tela cai na parte certa**.

### O núcleo

- **`colorKeyOf`** (`filaments.ts`, ao lado do `materialsLabel`): cores de uma peça → `{key, label}`.
  Identidade = `filamentId` (renomear a cor **não** parte o saldo) ou `livre:<slug>` no avulso;
  gramas 0 não pintam; ordem canônica (azul+branco ≡ branco+azul); repetida colapsa. Sentinela
  `NO_COLOR` para o que não tem cor.
- **`skuKey(subitemId, colorKey)`** — a chave da SKU virou 2D. Junto vieram `partBalance` (soma as
  cores), `skusOfPart`, `colorsWithBalance` (opções do seletor, maior saldo primeiro, esconde zerada
  e **mostra negativa** — D4) e `WholePart` no `consumeWholeFifo` (cada parte com a sua cor).
- **Estorno não mudou**: `shiftLayers` casa por `layerId`, que já era único por evento+SKU.

### O aviso ATIVO (pedido do dono)

Trocar a cor muda o custo real (FIFO da cor escolhida), mas **não** muda o preço — ele vem do
cadastro. Sem aviso, a margem menor só apareceria depois, congelada na venda. Então `FilRow` guarda
a `origin` (a cor com que o produto foi precificado) e a `/producao` mostra, **por linha**, "trocou
X por Y: R$ 128/kg vs R$ 110/kg do cadastro → +R$ 0,90 por peça"; e **no resumo**, o efeito somado
com a margem resultante ("fica em 36%, precificada 42%"). O `origin` é só para o aviso — o cálculo
usa sempre a cor escolhida.

### Consequências no dado (Diretriz 7 — sem migração)

- SKU sem `colorKey` (tudo que existe hoje) vira o balde **"Sem cor"**, normalizado no `toSku` do
  repositório — um ponto só, para o núcleo puro não carregar `??` em cada função. O saldo velho
  **não** se mistura com o das produções novas.
- **Borda documentada em teste:** cor apagada do Estoque cai no caminho avulso e a SKU passa a ser
  chaveada pelo NOME (`livre:azul`). Recadastrar a cor não junta os dois saldos — mesmo sintoma que
  o badge de cor removida (TD-009) já avisa.

### O que o teste manual pegou (2026-08-15)

Dois dias depois, revisão + teste do dono acharam **dois** problemas — os dois de classes que
lint/build/teste unitário não pegam sozinhos:

1. **A venda estourava no Firestore.** `finishedColors` era um mapa `parte → cor`, e mapa vira **nome
   de campo** no documento; a sentinela do produto sem partes é `__whole__`, exatamente o formato
   reservado que o Firestore recusa (*"Document fields cannot begin and end with `__`"*). O batch é
   atômico, então nada foi gravado pela metade. **Conserto:** o campo persistido virou **lista** de
   `{part, colorKey}` — a sentinela passa a ser um VALOR, e os únicos nomes de campo são `part` e
   `colorKey`. Trocar a sentinela resolveria o caso, não a classe: id de subitem esquisito reabriria
   o furo. Em memória segue `Record`; converte só na fronteira da gravação.
   ⚠ Venda de **subitem** (não do inteiro) chegava a salvar antes do conserto — `subitemId` é nome de
   campo válido. Essas ficam sem a cor congelada ao reeditar (cai no default). Diretriz 7: não migrar.
2. **A aba Produtos mostrava contagem de CORES no lugar do saldo.** Num produto sem subitens, a linha
   exibia `rows.length` com o rótulo "SKUs" — antes do FEAT-11 esse produto tinha sempre UMA SKU, então
   o ramo quase nunca disparava; com a cor na chave ele virou o caso normal, e quem tinha 5 peças em 2
   cores lia "2". Voltou a ser o total de peças ("em N cores"), e a margem do dropdown — que também
   sumia com 2+ cores — voltou pelo custo médio ponderado entre elas.

**Onde:** `filaments.ts` (+`colorKeyOf`) · `finishedGoods.ts` (chave 2D) · `productionPlan.ts`
(`stageKey`, `origin`, `submissionColors`) · `calculatePricing.ts` (exporta `stageKeyFor`) ·
`ProductionPage` (seletor liberado + aviso) · `SaleModal` (cor por parte, congelada) ·
`saleReconciliation` (`ReconItem.colors`) · `StockPage` (saldo por cor na parte) · `SalesPage`
("Cor vendida") · repositórios de acabados e vendas. **+47 testes (376).**

## ✅ FEAT-10 + UX-12 — Arredondamento de varejo e a ordem do card (2026-08-13)

Os dois primeiros do cluster da calculadora. Baratos, mesma tela, sem dependência entre si.

### FEAT-10 — final 4,90 **ou** 9,90

O pedido nasceu como "final X9,90" e o **dono ampliou para 4,90 OU 9,90** no mesmo turno — o que
troca o passo de **10 para 5** e derruba o problema que o backlog levantava: com degraus só de
9,90 o cenário base R$ 27,14 saltava pra R$ 29,90 (+10%) e um preço de R$ 21 ia pra R$ 29,90
(+42%); com passo 5 esse R$ 21 para em **R$ 24,90**. É **um único modo** no seletor (não dois) —
"ou" aqui é o conjunto de finais permitidos, não uma escolha do usuário.

**Implementação:** os dois modos psicológicos viraram a tabela `NINETY_STEP` (`"0.90"` → passo 1,
`"4.90"` → passo 5) e um bloco só: desce ao múltiplo do passo, soma `passo − 0,10`, e se o valor já
passou disso pula um degrau. O `"0.90"` mantém o comportamento anterior byte a byte (passo 1 ⇒
`base + 0,90` / `base + 1,90`). Nada mais mudou: o seletor renderiza `ROUNDING_OPTIONS` sozinho, o
CSV valida contra a mesma lista e o `chargedWithFee` chama o `roundPrice` genérico — o modo novo já
entrou na varredura `ALL_MODES` do `saleContext.test.ts` de graça.

**A regra "nunca pra baixo" vale aqui também**, e ela tem uma consequência assumida: **não existe
degrau abaixo de R$ 4,90**, então qualquer preço menor que isso vira R$ 4,90 (R$ 1,00 → R$ 4,90).
Está travado em teste em vez de virar surpresa. +3 casos (**329 testes**).

### UX-12 — o break-even desceu

O balão "🎯 Meta de Break-Even" estava **entre o preço e as barras de composição**, separando causa
de efeito. Passou pra depois do `breakdown-total` — mais precisamente **depois da linha "Total da
impressão (N peças)"**, pra não partir o bloco de custo ao meio em produto multi-peça. Só ordem de
JSX; nenhum cálculo mudou. O CSS precisou de um `margin-top: 14px` no `.break-even-box` (o
`breakdown-total` não tem margem inferior — sem isso o balão encostava na linha); o catálogo não é
afetado porque `.cd-breakeven` sobrescreve as duas margens e `catalog.css` é importado depois.

## ✅ TD-012 — Rede do `chargedWithFee` + comentário da tarifa (2026-08-13)

Último achado da auditoria. **Nenhuma mudança de comportamento** — teste e comentário.

`chargedWithFee` (`saleContext.ts`) era a única função de dinheiro-que-o-cliente-paga sem teste:
a composição `grossUpForFee → roundPrice → round2`. Novo `saleContext.test.ts` (10 casos, 326
testes no total) trava as propriedades: idempotência sem taxa, o arredondamento do produto
reaplicado sobre o preço inflado (os 6 modos), "nunca abaixo do exato / nunca abaixo do base",
bordas (preço 0/negativo/NaN, taxa negativa/NaN, clamp de 95% ⇒ 20× e não infinito) e
monotonicidade na taxa.

**A borda que o teste documenta:** o `roundPrice` sempre sobe, mas o `round2` que fecha a conta
arredonda ao centavo **mais próximo** — pode cortar até R$ 0,005. No modo `exact`, 100 @ 4,5% cobra
R$ 104,71 (não 104,7120), deixando o líquido R$ 0,002 abaixo dos R$ 100. Irrelevante em R$, mas
agora está travado em teste em vez de ser folclore.

**Comentário da `energyTariff`** (`constants.ts`): dizia "média nacional ~R$0,68" e chamava R$ 0,80
de conservador. Com a projeção ANEEL de ~R$ 0,849/kWh pro fim de 2026 a frase inverteu de sentido —
R$ 0,80 está **abaixo** da média. O valor **fica** (energia é ~1,9% do custo; ir a R$ 0,95 move o
cenário base ~R$ 0,13); só a justificativa foi reescrita.

## ✅ TD-010 + TD-011 — A capacidade produtiva (2026-08-13)

Os dois moram em `calculateCapacity.ts` e **não mudam preço nenhum** — só a projeção de volume e o
faturamento/lucro derivados dela.

### TD-010 — o mês tinha 26 dias de um lado e 30 do outro

`CapacitySettings` ganhou `daysMonth` e virou **subconjunto exato do `FixedCostRate`** — é esse o
ponto: o horizonte que projeta a capacidade e o que rateia o custo fixo passaram a ser o mesmo mês.
Antes o `horizon` era `hoursDay × 30` fixo enquanto o rateio usava `daysMonth` (26), e o fixo/h saía
~13% maior que a capacidade que o justificava.

A **média diária não muda** com isso (numerador e denominador escalam juntos: 200/30 ≈ 173/26); só a
mensal cai. Há um teste travando exatamente essa propriedade.

A segunda metade era a divergência entre páginas: a calculadora semeava o painel com o literal
`DEFAULT_CAPACITY` (1 máquina) enquanto o `/catalogo` já derivava do rate salvo (2). O literal foi
**apagado** do `constants.ts` — as duas páginas derivam de `config/negocio`.

**Decisão do dono (o painel da calculadora):** semear do rate salvo **e permitir simular**. Os campos
seguem editáveis, mas a edição vira um **override local** (`capacityOverride`, não persiste, não toca
no preço) com aviso "simulando — voltar ao padrão". Descartadas: travar o painel (perderia o "e se eu
dedicasse 3 máquinas?") e write-through pro Firestore (mexer em "máquinas dedicadas" pra simular
mudaria o rateio do fixo e, portanto, o preço de **todo o catálogo** em silêncio). O override existe
em vez de um `useState(semente)` porque o `fixedCostRate` chega **assíncrono** do Firestore — semear
no estado inicial congelaria o default.

Ganhou também o 3º campo "Dias de impressão/mês" (sem ele o número mensal fica inexplicável) e o
rótulo `📅 Mensal (26d)` no lugar do `(30d)` cravado.

### TD-011 — ciclo ≠ peça vendável

`piecesMonth`/`piecesDay` (e o `piecesMonth` de cada máquina no breakdown) passaram por
`× (1 − falha)`, com `floor`. `cyclesMonth`/`cyclesDay` **não** mudaram: a máquina roda a impressão
que falha do mesmo jeito — é justamente por isso que sobra menos peça boa no mês.

**Não há dupla contagem** com a reserva de falha do preço: a reserva paga o **material** perdido,
este fator conta a **máquina ocupada**. Eram os dois lados da mesma moeda, e só um estava
implementado — a falha inflava o preço e deixava a receita projetada intacta.

O clamp da taxa (percentual → fração, teto de 95%, default `DEFAULT_FAILURE_RATE`) foi extraído pra
`failureFractionOf`, exportada do `calculatePricing.ts` e usada pelos dois: o mesmo número que infla
o custo deflaciona o volume, não dois clamps parecidos. O `CapacityResult` carrega `failureRatePct`
para a UI poder dizer que "peças" são peças **boas** (mesma disciplina de rótulo do UX-09/UX-10).

**Efeito no cenário base** (40g/3h/A1, 20h/dia): a capacidade por máquina cai de 200 para **167**
peças/mês (−13% dos 26 dias, −3% da falha); na calculadora o painel passa a usar as **2 máquinas**
do negócio, então o número na tela vai de 200 pra ~334 — e agora bate com o `/catalogo`.

## ✅ UX-09 + UX-10 — Os dois rótulos honestos da auditoria (2026-08-13)

Dupla de "o número não está errado, está **incompleto no lugar onde a decisão acontece**".
Nenhuma mudança de cálculo em nenhum dos dois — só exibição.

**UX-09 (`/maquinas`)** — o payback soma `sale.profit` (receita − COGS real − taxa), que **não**
desconta custo fixo (aluguel) nem as impressões `outcome: "falha"` (queimam filamento e horas sem
abater nada em lugar nenhum) ⇒ a barra enche mais rápido que o caixa, e a decisão que ela alimenta
é "compro outra máquina?". Guarda-rail em 3 pontos: nota de aviso no topo (`.roi-note.roi-warn`,
filete no accent), uma linha por card sob a barra de payback (`.roi-caveat` — viaja junto do número
pra quem rolou e não vê mais a nota), e o `sales-total-sub` do "Lucro acumulado" virou "líquido de
taxas · bruto de custo fixo". **Paliativo por design:** o número honesto só existe quando o
[Dashboard] consolidar fixo + perdas — e é ele quem deve virar a fonte do payback.

**UX-10 (catálogo + calculadora)** — `PricingResult.margin` é **bruta, pré-taxa**: mostra 54% (base
pós-DEC-03) onde o crédito 3× Amex/Elo rende 46,8%. O `SaleModal` sempre calculou certo, mas aí a
venda já está acontecendo; **a decisão de preço acontece antes**. Duas funções puras novas em
`paymentFees.ts` — `worstPaymentFee(fees)` (varre forma × bandeira × parcela e devolve a maior taxa
+ rótulo legível; `null` quando tudo é isento, aí não há contraponto) e `netMarginPct(preço, custo,
taxa)` (delega ao **mesmo** `saleItemFinancials` da venda real, pra os dois números não divergirem).
Componente `NetMarginHint` em 3 superfícies: célula "Margem" da tabela (modo `compact`: "47% líq."),
card expandido do catálogo e card de preço da calculadora (modo cheio, nomeia o meio de pagamento).
`title` em todas com a taxa exata. +7 testes (311 no total).

**Por que a matemática é trivial e ainda assim virou função:** sem repasse, margem líquida =
margem bruta − taxa (em pontos). O valor de `netMarginPct` não é a conta, é a **fonte única** — se o
repasse ou o desconto mudarem o cálculo da venda, o catálogo acompanha de graça.

**Fiação:** `CatalogPage` e `PricingCalculator` passaram a chamar `useFees()` (só exibição — nenhuma
taxa entra no preço; o repasse continua escolha da venda). CSS compartilhado `.margin-net-hint` em
`base.css` porque as 3 superfícies moram em arquivos de área diferentes.

## ✅ DEC-02 + DEC-03 — As duas decisões da auditoria (2026-08-13)

Vieram da auditoria técnica de 2026-08-13. **Nenhuma era bug** — a matemática do app estava correta;
eram escolhas de negócio parametrizadas em código. O dono martelou as duas no mesmo dia.

### DEC-02 — `lifeHours` 10.000 h → **7.500 h**

O único parâmetro que movia o preço em dois dígitos. O argumento original do código estava **certo**
(bico, placa PEI e filtro saíram para o `maintenancePerHour`, então a vida *estrutural* deve mesmo ser
maior que as 5.000 h das calculadoras de referência) — só que 10.000 h era o **extremo** dele, não o
centro. Deixava a A1 a R$ 0,65/h de depreciação + manutenção contra R$ 1,06/h da referência (−39%).

| `lifeHours` | Custo/h da A1 | Preço do cenário base (40 g / 3 h / A1) |
|---|---|---|
| 10.000 (antes) | R$ 0,65/h | R$ 35,81 |
| **7.500 (escolhido)** | **R$ 0,83/h** | **R$ 37,45** (+4,6%) |
| 5.000 (referência) | R$ 1,18/h | R$ 40,72 (+13,7%) |

**Onde:** `constants.ts` (`DEFAULT_MACHINES` + o comentário auditado) e `MachineManagerModal.tsx`
(padrão de máquina nova). ⚠ **Esses valores só SEMEIAM o doc `config/machines`** — as máquinas já
cadastradas guardam o próprio `lifeHours`, então a mudança **não** as alcança: o dono edita as duas à
mão em `/maquinas` (2 campos). Não foi escrita migração — Diretriz 7, e a alternativa (código que
sobrescreve máquina salva) apagaria edição legítima do dono.

### DEC-03 — markup **deixa de incidir** sobre a mão de obra

Mudança de fórmula, escolhida pelo dono contra a recomendação de manter:

- **Antes:** `(material + energia + depreciação + manutenção + labor + falha) × markup + fixo`
- **Agora:** `(mesma base, SEM labor) × markup + labor + fixo`

**Por quê:** labor é **~42% do custo** do cenário base (mais que o material, 37%) e o markup o
amplificava — a fórmula antiga tratava hora de trabalho como produto de prateleira. A de referência
trata como repasse (serviço sob encomenda). Nenhuma das duas é errada; o dono escolheu a segunda.
Efeito isolado no cenário base: **R$ 35,81 → R$ 25,50 (−29%)**. Combinado com o DEC-02:
**R$ 27,14** (−24% contra o preço de antes das duas decisões).

**A reserva de falha continua cobrindo o labor.** Isto é deliberado e preserva a decisão irmã do
Tier 4 ("labor na reserva de falha: **manter**"): uma impressão perdida também perde a hora de
trabalho. O que sai da base do markup é `labor × (1 + failureK)`, não o labor puro — por isso o
número dá **R$ 25,50** e não os R$ 25,34 citados na auditoria, que tirava o labor da reserva também.
A diferença é R$ 0,16; a coerência entre as duas decisões vale mais.

**Onde:** `calculatePricing.ts` nos **dois** caminhos — o produto inteiro (`failureK` +
`laborPassThrough`) e o rateio por subitem (`computeSubitems`, que passou a receber `failureK`).
A aditividade **Σ subitens = inteiro** continua valendo: Σ labor dos subitens = labor total e o
coeficiente da reserva é o mesmo, então o repasse soma exato. O label do slider virou
"📈 Markup sobre o custo (sem mão de obra)" (`ProductForm.tsx`).

**O que NÃO mudou:** `totalCost`, `variableCost`, `profitPerPiece` e a fórmula da `margin` são os
mesmos — custo é custo, independente de como o preço é montado. A margem apenas **cai** (66,7% →
54,0% no cenário base sem falha), porque a mão de obra agora entra a preço de custo e dilui.
**+2 testes** (o repasse de +R$ 5 de labor vira +R$ 5 no preço, e +R$ 6,25 a 20% de falha).

## ✅ UX-06 + UX-07(a) — Cluster "linha + dropdown de detalhe" (2026-08-10)

Pedido do dono (2026-08-10): unificar o padrão de "abrir detalhe" do catálogo nas outras listas. Três
superfícies viraram **linha clicável + dropdown**: o item do recibo em `/vendas`, a produção recente em
`/producao` e a aba **Produtos** do estoque. Só **apresentação** — dado intacto, matemática inalterada
(294 testes seguem verdes); build/lint limpos.

**Decisão-chave — o dropdown absorve o `CostDetail`.** O popover de composição de custo saiu dessas
listas. Para não duplicar a tabela (precificado × real, provisões, totais, nota), extraí a parte interna
do `CostDetail` num subcomponente exportado **`CostBreakdownTable`** (`CostDetail.tsx`), renderizado
**inline** dentro de cada dropdown. O `CostDetail` (gatilho + Popover API na top-layer) passou a reusar
esse mesmo subcomponente e **continua como popover** só onde o popover faz sentido: a venda **VIVA** do
`SaleModal` (modal com scroll) e o **tile de totais** da aba Produtos (agregado, não é linha).

**CSS reescopado:** as regras da tabela mudaram de `.cost-detail-pop .cost-detail-table` para
**`.cost-detail-body`** — o wrapper que agora envolve a tabela nos dois contextos (dentro do popover E
inline). O prefixo continua blindando contra `.recibo-items td` (nowrap/padding/borda) por
especificidade, e o `table-layout: fixed` + `min-width: 0` seguem anulando o `table { min-width: 600px }`
global.

**Por superfície:**
- **`/producao`** (fácil, lista plana): `.prod-card` empilhou head (linha) + `.prod-card-details`; o custo
  na linha virou texto simples e a composição desceu pro dropdown, junto de máquina, tempo, desfecho/modo,
  filamento por cor e observações.
- **aba Produtos (UX-07a)**: os cards saíram da grade `.stock-list` pra uma coluna `.fg-list`; a linha
  (`.fg-head`) mostra nome + valor parado (texto) + saldo, e o `.fg-details` carrega avisos, partes,
  barras (`renderCostBars`), margem congelada e o `CostBreakdownTable`.
- **`/vendas`** (aninhado): cada item da `.recibo-items` ganhou um `<tr className="ri-details-row">` irmão
  (Fragment), aberto por `openSaleId`; o dropdown traz máquina, tempo, qtd, **desconto congelado**
  (FEAT-09), filamento por cor e a tabela precificado × real.

**UX-07(b) ficou de fora** (ligar o acabado aos eventos de `producao` que o geraram): puxa buscar
`producao` por `productId` sob demanda (pós-TD-006 a coleção não é assinada inteira) — a mesma agregação
server-side do painel, adiada pro **Dashboard**.

## ✅ FEAT-09 — Desconto na venda (2026-08-10)

Pedido do dono (2026-08-07): dar desconto ao registrar a venda, com lucro/margem recalculando **sobre o
preço COM desconto** (não o de tabela). **Escopo (decisão do dono):** por **item** _XOR_ no **total** do
recibo — um modo ou o outro por venda, nunca os dois. **Formato:** R$ ou %.

**Modelo (congelado, Diretriz 7):** `SaleInput` ganhou `discountKind` (`"item"|"total"`), `discountInput`
(`{mode:"abs"|"pct", value}` — o que o dono digitou, p/ exibir "10%") e `discountAmount` (o **R$ efetivo**
da linha; no modo total, já a fatia rateada). Congelados no snapshot; `profit`/`margin`/`feeAmount` já
entram líquidos. Custo real **não muda** → lucro = preço_com_desconto − custo real.

**Matemática (`paymentFees.ts`, testada):** `discountAmountOf(base, discount)` (clamp: nunca <0 nem >base,
% até 100%, round2); `saleItemFinancials` ganhou `discountAmount` — receita = bruto − desconto e a **taxa
incide sobre o valor JÁ com desconto** (é o que a maquininha cobra); `apportionDiscount(lineGross, total)`
rateia o desconto-total **proporcional à receita bruta** de cada linha, com o resíduo de arredondamento na
última linha (Σ fatias = desconto total). **Duas decisões confirmadas pelo dono (2026-08-10):** taxa sobre
o valor com desconto; rateio proporcional à receita.

**UI (`SaleModal`):** seletor de modo (Nenhum/Por item/No total) reforça o XOR; campo `DiscountInput`
(número + toggle R$/%) por item ou no total; resumo mostra Subtotal/Desconto/Receita quando há desconto.
Round-trip na edição (reconstrói o modo do recibo salvo). Exibição em `/vendas` (nota "−R$X" na linha,
"(rateado)" no modo total) + coluna no CSV. `toSale`/`saleToDocument` (salesRepository) leem/gravam os 3
campos. Sem migração de venda antiga (Diretriz 7): sem os campos, a tela mostra a venda como sempre.

## ✅ UX-03 (nome do produto truncado no catálogo) — 2026-08-10

Efeito colateral do FEAT-08 (a faixa de Ações cresceu p/ 146px): o `.col-name` corta com reticências e o
`title` só se lê no hover — inútil em toque/mobile, e o painel expandido não repetia o nome. **Fix:** o
painel expandido (`CatalogDetails`) abre com o **nome inteiro** num `<h3 class="cd-product-name">`
(`overflow-wrap: anywhere`, quebra em várias linhas). `title` na linha fechada mantido pro hover no
desktop. Só `ProductCatalog.tsx` + `catalog.css`.

## ✅ TD-006 (paginação) + UX-05 Fase 2/3 (busca em vendas/produção) — 2026-08-10

**O problema:** `/vendas` e `/produção` assinavam a **coleção inteira** (`onSnapshot` sem limite). Ok
com dados de teste, mas o **marco** (recadastro de tudo de uma vez — Diretriz 7) chega como um volume
grande; paginar importa *no* marco. UX-05 (busca por nome) foi acoplada porque tem a mesma raiz: ao
paginar, a busca client-side da Fase 1 só varreria o que está carregado — precisa virar query no banco.

**Fase 2 — paginação (limite crescente + realtime):** hooks novos `useSalesPage`/`useProductionPage`
substituem `useSales`/`useProduction` nas duas listas. Assinam `query(orderBy(saleDate|at desc),
limit(pageLimit+1))` — o `+1` diz se há mais (`hasMore`) sem uma contagem à parte; "carregar mais"
re-assina com limite maior (padrão **limite crescente**, não cursor `startAfter` — a query roda do topo
de novo, então empates no limite nunca pulam doc). **Um `orderBy` só ⇒ dispensa índice composto** (o
Firestore auto-indexa cada campo nas duas ordens). Os `useSales`/`useProduction` cheios **continuam** —
o ROI (`/maquinas`) os usa (agrega o histórico inteiro; a ressalva registra que isso só some com
agregação server-side no Dashboard).

- **Totais server-side:** os cards de /vendas passaram a somar o histórico INTEIRO via **aggregation
  query** (`fetchSalesTotals` — `sum`/`count`, 1 leitura, não baixa docs). A /produção usa
  `fetchProductionCount` p/ "X de N". Decidido com o dono (a alternativa "só do carregado" foi descartada).
- **Estorno desacoplado da janela (bug latente consertado):** o estorno de venda/edição resolvia os
  eventos de produção da encomenda pela **lista em memória** (`production.find(id)`); com a janela
  paginada, um evento antigo fora dela não seria achado e **o estoque não estornaria**.
  `fetchProductionEventsByIds` resolve por id direto no banco. `SaleFlow`/nova venda passam
  `production=[]` (venda nova não estorna); a edição em `SalesPage` busca os eventos por id ao abrir.
- **Export CSV** lê tudo sob demanda (`fetchAllSales`) p/ não truncar.
- ⚠ **Recibo no limite:** itens do mesmo dia não são contíguos (empate por `__name__`), então um recibo
  pode aparecer partido no limite da página até "carregar mais". Os cards não erram (vêm da agregação).

**Fase 3 — busca ("os dois juntos", decisão do dono):** o Firestore **não faz substring de texto**
server-side. Então: **filtro produto + período** vai ao banco, **caixa de nome** refina no cliente.
- **Produto:** `where("productId","==",X)` — **equality-only, sem orderBy** → traz o conjunto todo do
  produto (naturalmente limitado), refina período **no cliente** e não pagina. Evita de propósito o
  índice composto equality+range.
- **Período:** range em `saleDate`/`at` — **mesmo campo do `orderBy`** → sem índice composto. Como
  `toTimestamp` ancora ao **meio-dia**, toda venda/evento do dia tem o mesmo timestamp e `>= start && <=
  end` (ambos meio-dia) fica exato e inclusivo, sem off-by-one.
- **Totais/contagem respeitam o filtro:** agregação recebe o período; no caminho de produto soma-se
  local (`totalsOfSales`) sobre o conjunto carregado.
- **Nome:** `matchesQuery` (helper da Fase 1) sobre a janela — casa produto/cliente (vendas) ou
  nome/observações (produção). Não mexe nos totais (que refletem o filtro server-side).
- **UI:** `HistoryFilterBar` (novo) compartilhado — seletor de produto + datas de/até + `SearchBox`. O
  reset da janela ao trocar filtro usa o padrão do React de **ajustar estado no render** (chave derivada),
  não `setState` em effect (o lint proíbe).

## ✅ TD-003 (capacidade pelo gargalo) + UX-04 (catálogo multi-máquina) — 2026-08-04

**O defeito:** `calculateCapacity` **somava** as horas de todas as etapas e dividia o horizonte
mensal por esse total — como se uma única máquina ficasse ocupada a soma inteira. Num produto que
imprime em duas impressoras (A1 3h + X2D 2h/peça) isso **subestima**: as máquinas rodam em
**paralelo**, e quem limita o ritmo é a mais ocupada (o gargalo), não os 5h somados.

**Decisão do dono (neste chat):** o painel é uma **estimativa branda** ("quanto consigo fazer e qual
faturamento") — por isso os dois botões (máquinas dedicadas + horas/dia) **ficam**. Modelo escolhido:
**gargalo/paralelo**. O número muda **só** em produto multi-máquina; produto de 1 máquina fica
idêntico (`max === soma`), então os testes antigos seguem verdes (o teste da "etapa extra" usava duas
etapas na MESMA `a1`).

- **De onde vêm as horas por máquina:** `PricingResult.machineUsage` já existia (FEAT-04c/TD-003 base).
  Ele é **por peça** (dividido por `pieces` em `calculatePricing.ts`), então `calculateCapacity`
  multiplica de volta por `result.pieces` para voltar ao tempo por **impressão/ciclo**. `bottleneckHours
  = max(cycleHours)`; `cyclesMonth = floor(horizonte / bottleneckHours) × máquinas`.
- **`CapacityResult.machineBreakdown`** (campo novo): uma entrada por máquina distinta, ordenada da
  mais ocupada; `piecesMonth` = capacidade SE aquela máquina fosse o único limite. A do gargalo bate
  com o total; as outras aparecem como **folga** no `CapacityPanel` (linha só visível se >1 máquina).
- **UX-04:** `MachineCell` (novo, em `ProductCatalog.tsx`) lista as máquinas distintas de
  `machineUsage` — "A1 +1" compacto na linha (com `title` da lista inteira), lista completa no painel
  expandido. Mantém o `machine-missing-badge` (TD-009). Substituiu os dois pontos que mostravam só
  `result.machine.name` (a principal).

## ✅ FEAT-06 — Composição de custo congelada na produção (2026-07-20)

Matou o **stopgap do COGS**: até aqui a venda de peça pronta gravava `costBreakdown` = snapshot do
catálogo **vivo** enquanto o `unitCost` vinha do FIFO real — os dois não somavam o mesmo número, e
detalhar a venda mostrava a estimativa fingindo ser o gasto. A causa era só uma: `productionCost()`
já devolvia 6 componentes, mas o save guardava só o `.total`. Entregue em 7 commits.

**Por que não dava para reconstruir depois** (o argumento que definiu a prioridade): material e
insumos até sairiam dos arrays `filaments`/`supplies` congelados, mas energia/desgaste/manutenção
teriam que ser recalculados da **máquina viva** (editar watts faria os componentes pararem de somar o
total gravado) e a **mão de obra não estava gravada em lugar nenhum** do evento. Cada impressão
registrada sem o breakdown é uma composição perdida para sempre — daí os passos 1-5 (o dado) virem
antes dos 6-7 (a tela).

- **`FrozenCostBreakdown` (tipo novo, não `SaleCostBreakdown`).** Reusar o da venda obrigaria a gravar
  `failureReserve: 0`/`fixed: 0` (zeros indistinguíveis de "não houve", e provisão zerada num quadro
  de custo **real** é ruído) e a renomear `supplies`→`accessories`, batendo em `calculatePricing`,
  `saleContext`, `salesRepository` e 6 asserts. `ProductionCostBreakdown` passou a **derivar** dele
  (`& { total }`), então os 6 componentes têm uma definição só. Sem `total` no tipo persistido: é
  derivável (`sumFrozen`) e dois campos que precisam bater são convite a drift.
- **A regra que sustenta o invariante `Σ componentes === total`:** nunca calcular total e componentes
  por caminhos diferentes. `submissionEntries` foi reescrita para derivar **um fator escalar**
  (`share / units`) e aplicá-lo aos dois — antes o rateio e a divisão por unidades eram duas
  expressões que precisavam concordar.
- **Overdraft (D4) foi o ponto nº 1 de bug.** O breakdown do `consumeFifo` **não pode** ser acumulado
  dentro do laço FIFO: as linhas que engrossam o move da camada mais nova rodam **depois** dele, e a
  fatia excedente ficaria de fora, deixando os componentes menores que o `cost`. É calculado no final,
  a partir dos moves já fechados, com `Map<layerId, layer>`. Há teste dedicado.
- **`costUnknown`/`unknown` em vez de zeros sintéticos.** Camada anterior ao FEAT-06 não vira
  `{material: 0, …}` — isso mentiria na tela ("Material R$ 0,00"). Vai para um campo separado, exibido
  como "não detalhado", e `sumFrozen(breakdown) + unknown === total` continua valendo.
- **A venda guarda os DOIS breakdowns** (decisão do dono, contra a letra do backlog): `costBreakdown`
  segue sendo o **precificado** — é a metade esquerda da comparação estimado × real, e o
  `machineRoi.ts:63` lê a depreciação dele — e entra `realCostBreakdown` novo. Não grava quando a
  composição é parcial: meia composição engana mais que nenhuma, e `unitCost`/lucro/margem continuam
  corretos de qualquer forma. **Follow-up registrado:** migrar o `machineRoi` para a depreciação real.
- **`FinishedMove` de propósito NÃO ganhou breakdown** — ele só serve ao estorno (por `qty`/`layerId`),
  e 6 números por move seriam peso morto no doc da venda.
- **UI:** `CostDetail` ganhou 3 modos (só precificado / **2 colunas** / só real). O par
  acessórios × insumos divide linha com nomes diferentes dos dois lados de propósito (no preço é o item
  do catálogo, no real é a baixa do estoque). Uma linha some só quando as **duas** colunas são zero —
  senão um componente que existe só de um lado sumiria. A `/producao` rotulou os dois números órfãos
  ("custo real gasto") e os tornou detalháveis. A aba Produtos ganhou popover de composição do valor
  parado, custo médio por SKU, mini-barras (CSS puro, `flex-grow` proporcional) e margem congelada.
- **`CostBars`/`ProfitSummary` NÃO serviram** (o backlog citava os dois): consomem `PricingResult` —
  produto **vivo**, com markup e preço sugerido — que é exatamente o que o FEAT-06 recusa.

35 testes novos (álgebra, plano, rateio × units, overdraft, camada antiga, `qty=3` para pegar o ÷qty
esquecido) — **281 no total**. Zero migração (Diretriz 7).

## ✅ 7e — Insumos no estoque + baixa do acessório na produção (2026-07-20)

Fechou o **buraco de COGS**: acessórios já entravam no preço (`calculatePricing.ts`) mas ficavam de
fora do `frozenCost` da produção, então o lucro por peça do histórico saía superestimado. Entregue em
3 commits.

- **Núcleo do FIFO extraído** para `lib/fifo.ts` (`fifoSort`/`simulateFifo`/`shiftLots`): a regra do
  D4 (overdraft no lote mais novo) passou a ter UMA implementação, usada pelo filamento (gramas ×
  R$/kg) e pelo insumo (unidades × R$/un). `lib/stock.ts` delega; os 190 testes existentes foram a
  rede de segurança da extração.
- **Coleção nova `insumos`** (não `estoque`): o `subscribeStock` devolve a coleção inteira tipada como
  cor e o estorno filtra por `stockId` — insumo no meio das cores exigiria um discriminador em toda
  leitura, sem economizar nada. `lib/supplies.ts` espelha o `stock.ts` (saldo, FIFO, ajuste D6,
  extrato D6.1, guarda do excluir).
- **`Accessory.supplyId`**: ligado, o nome e o preço são **copiados** do insumo (denormalização
  deliberada — mantém `calculatePricing` e seus ~10 call sites sem conhecer o estoque, e espelha o
  `pricePerKg` que a `FilamentUsage` já congela). Sem ligação, segue **avulso**: entra no custo, não
  dá baixa — o mesmo caminho do filamento avulso.
- **Escala (o ponto sutil):** `Accessory.qty` é POR PEÇA, a linha-evento é POR PLACA. `accessoryRows`
  multiplica por `piecesCount` na origem, e daí o `scaleRow` escala por placas junto com as gramas,
  sem fator especial. Produto **multi-máquina** vira N eventos → os insumos vão só na **1ª linha**
  (repetidos, um produto em duas impressoras consumiria o ímã duas vezes). Produção de **subitem**
  leva só o acessório atribuído a ele: o não-atribuído é rateado no PREÇO, mas fisicamente não sai da
  gaveta ao imprimir uma parte só.
- **`productionCost` agora soma `supplies`** — e é só isso que fecha o COGS: tudo a jusante
  (`summary.frozen` → `submissionEntries` → `FinishedLayer.unitCost` → COGS da venda) propagou sozinho,
  sem tocar `finishedGoods.ts`. Reserva de falha e custo fixo **seguem fora** (são provisões de
  pricing, não custo físico).
- **Zero migração**, como o D1 previu: `StockMove.kind` já era `"filament" | "supply"` desde a 7a e o
  repositório já serializava o campo. `reverseProduction` passou a filtrar por `kind`; nasceu o
  `reverseSupplies` espelho. Batch da produção e o da venda (encomenda) ganharam `supplyUpdates`.
- **UI:** `/estoque` virou 3 abas (Filamentos · Insumos · Produtos), a nova num componente próprio
  (`SuppliesTab` + 3 modais espelhados). A `/producao` lista os insumos da submissão e avisa falta de
  saldo ao lado dos avisos de rolo.

56 testes novos (fifo, supplies, planSupplies/estorno, escala do productionPlan) — 246 no total.

## ✅ FEAT-08 — Produzir/Orçar/Vender no card do catálogo (2026-07-20)

Card e linha do catálogo ganharam as 3 ações, para o inteiro **e por subitem**. **Seed cross-page:**
`?produto=<id>&subitem=<subId>` — contrato único que cada destino traduz pro formato interno dela
(`ProductionPage` monta a chave `sub:`/`whole:` e chama o `selectOption` existente; `QuotePage` acha a
opção e anexa a linha). Preferido a pôr `?item=sub:a:b` na URL, que vazaria o formato de chave da
produção pro orçamento. **A opção 1 do backlog (derivação pura) NÃO era viável:** selecionar produto na
`/producao` também constrói `rows` (linhas de evento editáveis) e "orçar" anexa um `QuoteItem` — estado
editável não se deriva de query; e como os produtos chegam por assinatura, nem `useState` com
inicializador preguiçoso serve (lista vazia na 1ª renderização). Ficou a **opção 2** (ajuste durante o
render + `handledSeed`), idêntica ao FEAT-07, com `<Suspense>` nas duas rotas (seguiram estáticas).
**Regra permanente (vale pra qualquer seed futuro):** `setState` dentro de `useEffect` é **barrado pelo
lint** (`react-hooks/set-state-in-effect`, vem do `eslint-config-next/core-web-vitals`, não é regra
local) — e além de barrado é pior, pinta a tela no estado intermediário. **Não desligar a regra.**
**Venda de subitem saiu quase de graça:** `saleContextFromSubitem` já existia do FEAT-01 e o `SaleModal`
já tratava `subitemId` no saldo de acabado e no payload da reconciliação — só faltava quem chamasse.
**Coluna "Ações" — armadilha do CSS (custou um bug em produção):** a linha do catálogo **não é tabela,
é `display: grid`** (`.main-row`, `catalog.css`), e a última faixa do `grid-template-columns` era fixa em
**76px**. Com 5 ícones (~143px) o `justify-content: flex-end` empurrava o excedente pra esquerda e o
`overflow: hidden` do `.main-row td` **cortava exatamente os 3 novos** — invisíveis no desktop, ok no
mobile (lá a `responsive.css` transforma a célula em faixa de largura total). Faixa foi pra **146px**,
gap 4px, ícones 24px, divisor agrupando `[Vender][Produzir][Orçar] | [Editar][Excluir]`.
⚠ **As regras `position: sticky` de `th/td.col-actions` (~linha 536) são MORTAS** — sobrescritas por
`position: static` no bloco de ~655. Raciocinar por elas leva ao diagnóstico errado; foi o que aconteceu.
**Custo medido do alargamento:** entre 760 e ~860px de viewport o nome do produto passa a truncar com
reticências (comportamento já projetado da coluna); acima de ~860px nada muda. **Borda:** produto excluído ou subitem removido entre o
clique e o load ⇒ ignora em silêncio e limpa a URL (cair pro inteiro sem o dono pedir seria pior — a
produção grava estoque).

## ✅ UX-01 — Barra de navegação unificada (2026-07-19)

Antes, cada uma das 6 páginas montava seu próprio `header-actions` com um subconjunto ad-hoc dos
links (a raiz mostrava 5 rotas; as demais só 2-3), então pular entre duas páginas quase sempre exigia
voltar pela calculadora. Extraído o componente `NavBar.tsx` (`features/pricing-calculator/components/`):
6 destinos fixos na mesma ordem (Calculadora `/` · Vendas · Orçamento · Impressoras · Estoque ·
Produção) + botão de tema + `LogoutButton`, com a rota ativa marcada via `usePathname()` +
`aria-current="page"` (estilo `.icon-label-button[aria-current="page"]` em `forms.css`). O `Header` da
raiz e os 5 headers de página (`SalesPage`/`QuotePage`/`MachinesPage`/`StockPage`/`ProductionPage`)
passaram a delegar ao `NavBar`, cada um mantendo o próprio `.brand`/cloud-status. `SalesPage` injeta a
ação "Nova venda" via `children` (renderizada antes dos links). Decisão do dono: **"Início/Calculadora"
= navegação limpa** — o reset por `window.location.reload()` continua só no clique do brand "Lopo Lab ✦"
da raiz. (Nota: existe um "UX-01" antigo neste arquivo — o do `NumberInput`/zero à esquerda —, item
diferente que só reaproveitou a sigla.)

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
   - **7c — Ligar produto ↔ estoque. ✅ FEITA (jul/2026).** Entregue: campo "Cor" virou **dropdown
     das cores do Estoque** (mono E multi) + opção **"Avulso"** (texto livre + preço manual, fallback
     D3). `calculatePricing(..., stock)` resolve o **preço do rolo mais novo** (D3 catálogo,
     só-leitura quando ligada) e devolve **`filamentMissing`** → badge no molde do
     `machineMissing`/TD-009 (`PricingResultCard` + `ProductCatalog`). `useStock` no
     `PricingCalculator`, propagado a `ProductForm`/`ExtraStagesSection`/`ProductCatalog`/
     `exportProductsCsv`. **NÃO** mostra "rolo em uso/quanto resta" nem avisos D5 (é da 8). +5 testes
     (108 verdes). **Decisão do dono: SÓ O NÚCLEO** — a **faxina do legado FEAT-02 foi ADIADA**
     (`weightG`/`filamentPricePerKg` escalares, `normalizeFilaments`, round-trip do CSV velho
     **mantidos** como peso morto inofensivo) → vira **tarefa própria** depois (Diretriz 7 segue
     cobrindo). Detalhe no "Status atual".
   - **FEAT-01 — Preço/subitens por etapa. ✅ FEITA (jul/2026).** Toggle "vender por subitens" no
     produto (default OFF); `SubitemsSection` agrupa etapas (exclusividade mútua; fora de grupo = passos
     internos). Rateio ADITIVO em `computeSubitems` (peso = custo de impressão; internos/falha/fixo/
     acessórios-não-atribuídos rateados; acessório atribuído 100%; markup por subitem via botão discreto;
     fixo sem markup). **Inteiro = Σ subitens.** Catálogo/`/orcamento`/`SaleModal` vendem inteiro + cada
     subitem; `SaleInput.subitemId` grava a parte; `PrintStage.id` persiste. **Decisão do rateio (a que
     estava em aberto):** aditivo por custo, markup por subitem atrás de botão discreto, acessório
     atribuível por box. CSV **não** carrega subitem (Diretriz 7). +8 testes (116 verdes). Detalhe no
     "Status atual" e no item FEAT-01 abaixo.
   - **FEAT-04 — Registro de Produção (a primitiva de baixa migra pra cá).** O evento que gasta
     filamento + hora é a **produção**, não a venda. Registra TODA impressão com um **desfecho**
     (aprovado jul/2026): peça-pro-estoque / encomenda / **teste·calibração** / **falha** (dado real ≠
     reserva de falha do pricing) / **brinde·uso interno** / **histórico** (backfill avulso, sem deduzir
     rolo). Modos: real (deduz FIFO, D3) e histórico/avulso. `computeMachineRoi` passa a ler horas do log
     de produção (muda `/maquinas`, casa com TD-003). Constrói FIFO + `stockMoves` + estorno **no evento
     de produção**. Granularidade = subitem (do FEAT-01). **3 fases:**
     ~~**04a** modelo (`types.ts`) + `lib/production.ts` puro (`planProduction`/`reverseProduction`
     reusando o FIFO de `stock.ts`) + `productionRepository` (coleção `producao`) + baixa no MESMO
     `writeBatch`, sem UI~~ **✅ FEITA (jul/2026)**; ~~**04b** tela `/producao` (produto/subitem →
     máquina → h+min → filamento default editável → desfecho → modo; link no header) + `productionCost`
     (frozenCost) + inteiro multi-máquina = N eventos (baixa encadeada/atômica) + lista com excluir~~
     **✅ FEITA (jul/2026)**; ~~**04c** `computeMachineRoi` lê horas da produção (vida útil por
     `machineId`, todo desfecho) + consumo no extrato da cor (3ª fonte do D6.1); estorno já vinha da
     04b~~ **✅ FEITA (jul/2026) — FEAT-04 inteira fechada**. Detalhe no item FEAT-04 do backlog.
   - **FEAT-05 — Estoque de Produtos (acabados).** Produção **incrementa** com custo congelado; venda
     **decrementa sem rebaixar insumo** (já saiu na produção — furo "não dobrar baixa"). Guarda saldo
     **por subitem** (a SKU do acabado = o subitem vendável do FEAT-01); "produto inteiro disponível" é
     **derivado = min das partes**; vender só uma parte deixa a **lacuna** ("conjunto sem X") — e
     reimprimir a parte preenche. Saldo negativo permitido com aviso (política D4). Detalhe no item
     FEAT-05 do backlog.
   - **8 — Venda (RECONCILIAÇÃO, não mais "o passo da baixa"). Fecha o FEAT-02.** Cada item da venda
     escolhe o caminho **por item, default por saldo** (decisão do dono): **peça pronta** decrementa o
     acabado (FEAT-05, `consumeFifo`) sem rebaixar insumo; **encomenda DISPARA PRODUÇÃO** (resolvido: cria
     evento `producao` `outcome:encomenda`/`mode:real` que deduz filamento FIFO + horas — horas contam no
     ROI, consumo entra no extrato da cor pela fonte que a 04c já lê, **sem 3ª fonte nova no doc da
     venda**). FIFO automático (seleção manual de rolo = backlog). Custo real na `SaleModal` (D3; falha/
     fixo fora do COGS; ⚠ acessórios fora até 7e). **`SaleInput.material` vira derivado do
     `FilamentUsage.material` congelado, ou sai** (D7). **3 fases:**
     ~~**8a** modelo (`SaleInput`+`SaleItemOrigin`) + `finishedGoods` apply/reverse + `lib/productionPlan.ts`
     (builder extraído, `ProductionPage` refatorada) + `lib/saleReconciliation.ts`
     (`planReciboReconciliation`/`reverseReciboReconciliation`) + 15 testes, sem UI~~ **✅ FEITA (jul/2026)**;
     ~~**8b** `SaleModal` (seletor de origem + COGS real + avisos D4/D5) + `reconcileRecibo` batch atômico
     multi-coleção (vendas+producao+estoque+acabados, `reconcileReciboWrite` estorna-e-reaplica) + wiring
     (`handleDelete` estorna)~~ **✅ FEITA (jul/2026)**; ~~**8c** `material` derivado (D7, `freezeFilaments`/
     `materialsLabel`, tira o texto livre) + fecha FEAT-02 + Tier 1~~ **✅ FEITA (jul/2026) — PASSO 8 e
     TIER 1 FECHADOS.** ⚠ **COGS armazenado = custo real; `costBreakdown` = o do snapshot (stopgap) até o
     FEAT-06 congelar a composição na produção; acessórios fora do COGS até 7e.**
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
- ✅ **[FEAT-01] Preço/subitens por etapa — FEITA (jul/2026).** Rateio aditivo (inteiro = Σ subitens),
  toggle no produto, markup por subitem (botão discreto), acessório atribuível por box, venda/orçamento
  por subitem. Núcleo em `computeSubitems`/`SubitemsSection`. **Contexto histórico abaixo** *(**era**
  Tier 1, depois da 7c, antes do FEAT-04/05/8 · **definiu a granularidade de subitem que
  FEAT-04/05/8 herdam**)*. Salvar/mostrar o preço calculado e proporcional de **cada etapa** do
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
  - **✅ RESOLVIDO (jul/2026) — o "grupo de etapas" mora NO PRODUTO, atrás de um TOGGLE.** O dono
    aprovou: `ProductForm` ganha um **toggle "vender por subitens"** (default OFF = só vende inteiro,
    = comportamento de hoje, zero fricção pros produtos simples). ON revela a UI de **agrupar etapas
    em subitens vendáveis**, montada **uma vez no produto**; orçamento/venda só **selecionam** entre
    inteiro e subitens prontos (nunca re-agrupam, nunca digitam à mão). **Nem toda etapa é vendável:**
    etapas fora de qualquer subitem = **passos internos** (entram no custo/preço, não vendem sozinhas).
    Descartadas: (A) sem toggle, inferir de "há ≥1 grupo" (UI de agrupar sempre visível polui produto
    simples); (B) flag vendável-sim/não por etapa (não cobre "4 etapas → 2 subitens" que o dono pediu).
  - **✅ Vender parte E inteiro convivem; parte vendida deixa LACUNA (jul/2026).** Produto com subitens
    vende as partes **e** ainda o inteiro. Vender só uma parte de uma unidade pronta **deduz do conjunto
    principal deixando uma lacuna** ("conjunto sem X"). Isso é fenômeno de **estoque de acabados
    (FEAT-05)**: o acabado guarda saldo **por subitem**, "inteiro disponível" = **min das partes**, e a
    lacuna é a divergência; reimprimir a parte preenche. **O rateio aditivo do FEAT-01 é o que faz o
    dinheiro fechar** (custo do inteiro = Σ custos das partes → vender a parte tira só o custo dela, sem
    centavo órfão). Decisão de apresentação ("conjunto faltando X" vs. peças avulsas) fica pro chat do
    FEAT-05.

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
- ✅ **[FEAT-02] Gasto de filamento por cor (multicor / AMS / dual nozzle)** — **FECHADO (jul/2026):
  lado-produto + reconciliação da venda (passo 8) + `material` derivado (8c/D7).** A baixa de filamento
  mora na PRODUÇÃO (FEAT-04); a venda-encomenda dispara produção, a peça pronta drena o acabado. **DECISÃO p/ o Estoque
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
  Decidir depois se vale corrigir o cálculo do break-even ou só renomear a variável.
  **✅ RESOLVIDO (2026-07-31, Tier 4) — opção A (renomear):** o dono optou por renomear
  `contributionMargin` → **`profitPerPiece`** e manter o cálculo idêntico (o ponto de equilíbrio
  não muda). Opção B (margem de contribuição de verdade, break-even menor) descartada.
- ✅ **[Tier 4] Fechado (2026-07-31) — 4 itens.** (1) **Numeração de orçamento atômica:** o próximo
  número era derivado no browser (`max(numberValue)+1`), e 2 abas/2 cliques repetiam. Agora
  `reserveQuoteNumber` (`quotesRepository.ts`) reserva via transação num contador `config/orcamentoSeq`
  ANTES de gerar o PDF (número autoritativo, sem colisão). Sequência monotônica (não decresce ao excluir;
  para zerar, apagar o doc). Efeito colateral aceito: offline não gera mais orçamento. (2) **DEC-01 =
  opção A** (ver acima). (3) **ROI pela depreciação real:** `machineRoi.ts` passou a usar
  `realCostBreakdown.depreciation` (FEAT-06) na *depreciação recuperada*, repartida entre as máquinas na
  proporção da precificada (`machineUsage`); venda anterior ao FEAT-06 cai no fallback precificado.
  Payback/lucro não mudaram (seguem repartidos por horas). +2 testes. (4) **Labor na reserva de falha:**
  decidido **manter** (labor segue no `printingCost` → na reserva); sem código.
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
- ⬜ **[FEAT-04] Registro de Produção (log de impressão) — a primitiva de baixa** *(guarda-chuva ·
  grande · **posição FECHADA jul/2026: depois do FEAT-01, antes do FEAT-05/8**)*. **O quê:** um evento de **impressão/produção**
  como fonte da verdade do consumo — cada impressão rodada registra **máquina + horas + filamento
  gasto**, independente de virar venda. **Por quê:** o dono vai operar um **quiosque de mall** (vende
  peça pronta na hora). Hoje o app só conhece **catálogo + venda**, e **toda hora de máquina e baixa de
  filamento sai da venda** (`computeMachineRoi` lê horas só de `sales` — `machineRoi.ts:82`; passo 8
  deduz filamento na venda). Logo: **impressão que não virou venda não existe pro sistema** → ROI/vida
  útil da máquina subcontam, estoque de filamento fica achando que tem mais do que tem, e não há onde
  cadastrar impressão passada nem impressão que não vira produto (teste/falha/brinde). **Reframe (o
  miolo):** o evento que gasta filamento + hora é a **produção**, NÃO a venda — a venda só reconhece
  receita e escolhe qual unidade pronta saiu (make-to-stock vs. make-to-order). **DESFECHO por impressão
  (aprovado jul/2026 — campo obrigatório do evento):** `peça-pro-estoque` (→ incrementa FEAT-05) ·
  `encomenda` (sai direto pra venda) · `teste·calibração` · `falha` · `brinde·uso interno` · `histórico`
  (backfill). Só `peça-pro-estoque` alimenta o acabado; teste/falha/brinde deduzem insumo+hora mas **não**
  produzem unidade vendável (é por isso que a baixa NÃO pode morar na venda — senão eles nunca deduziriam e
  o estoque físico mentiria). **Modos exigidos:**
  (a) **real** — deduz dos rolos atuais (FIFO, D3); (b) **histórico/avulso** — só horas + gramas soltas,
  **sem** deduzir rolo (o dono tem o histórico das 2 impressoras e vai preenchê-lo no marco; não quer
  recadastrar rolo velho — reusa o fallback "Avulso" já existente). **Consequência:** `computeMachineRoi`
  passa a ler horas do log de produção, não das vendas (muda `/maquinas`; casa com TD-003). **Furos a
  encarar:** (1) **não dobrar baixa** — se produção deduz filamento/hora, a venda de item já produzido
  NÃO pode deduzir de novo; (2) **congelamento migra pra produção** (custo do rolo no dia da impressão,
  não no da venda); (3) falha registrada (dado real) ≠ reserva de falha do pricing (provisão
  estatística) — não misturar. **Relacionado:** FEAT-05 (consome este log), passo 8 (ver nota de
  ordem), TD-003, Estoque (item 3), Diretriz 7 (backfill no marco = sem migração).
- ⬜ **[FEAT-05] Estoque de Produtos (finished goods) — peça pronta parada na loja** *(guarda-chuva ·
  grande · **posição FECHADA jul/2026: depois do FEAT-04, antes da 8** · depende conceptualmente do
  FEAT-04)*. **O quê:** um **estoque de produtos** (separado do
  estoque de insumos de hoje) com as peças **já impressas mas ainda não vendidas** — quantidade em mãos,
  com **custo congelado no momento da produção**. **SKU = o subitem vendável do FEAT-01** (não o produto
  inteiro): guarda saldo **por subitem**; "produto inteiro disponível" é **derivado = min das partes**.
  **Por quê:** no quiosque o dono precisa de
  produto físico pronto pra vender na hora; hoje não há representação disso (só catálogo vivo + venda).
  **Fluxo:** produção (FEAT-04) **incrementa** o estoque com o custo congelado; a **venda
  decrementa** a quantidade e reconhece receita **sem rebaixar insumo** (o filamento já saiu na produção).
  **Lacuna (aprovado jul/2026):** vender **só uma parte** de uma unidade pronta deduz aquele subitem →
  o conjunto principal fica incompleto, mostrado como **"conjunto sem X"** (a divergência entre os saldos
  das partes); **reimprimir a parte preenche a lacuna**. Sustentado pelo **rateio aditivo do FEAT-01**
  (custo do inteiro = Σ partes, sem centavo órfão). Decisão de apresentação ("conjunto faltando X" vs.
  peças avulsas) é deste chat.
  **Furos:** (1) a unidade carrega "insumo/hora já deduzidos" pra a venda não dobrar; (2) COGS da venda =
  **custo da produção** (congelado), não preço do rolo do dia da venda; (3) **saldo negativo permitido com
  aviso** (vender 2 com 1 em estoque — mesma política do D4 do filamento), nunca bloquear. **Onde
  (provável):** rota nova (ex.: `/estoque` ganha aba "Produtos" vs. "Insumos", ou rota própria) +
  `SaleModal` passa a poder vender **de estoque** (rápido, ~5s: custo já congelado, só escolher e
  decrementar). **Relacionado:** FEAT-04 (fonte), passo 8, SaleModal, Estoque (item 3).

  **Decisões do dono (jul/2026, fechadas neste chat):** FEAT-05 = **só o lado estoque** (a venda que
  DECREMENTA fica pro passo 8 — o reframe manda; encher agora, drenar na 8, como 7a/7b antes da 8);
  custo do acabado em **camadas FIFO** (cada produção `estoque` = uma camada {qtd, custo congelado,
  eventId}; estorno remove a camada do evento — round-trip; **não** custo médio); apresentação
  **híbrida** (saldo por subitem + linha derivada "inteiros montáveis = min das partes" + aviso de
  lacuna). **Furo tratado:** inteiro em N máquinas = N eventos mas **1 unidade** → incremento por
  SUBMISSÃO (não por evento); inteiro-com-subitens rateia o `frozenCost` real pelas proporções do
  `SubitemPrice.cost` (aditivo/FEAT-01). Só `estoque` incrementa. **Fases:**
  ~~**05a** modelo (`types.ts`) + `lib/finishedGoods.ts` puro + `finishedGoodsRepository` (coleção
  `acabados`, doc por produto) + `useFinishedGoods` + 15 testes, SEM UI/wiring~~ **✅ FEITA (jul/2026)**;
  ~~**05b** ligar a produção (incremento/estorno atômico no `writeBatch` do evento; delta por submissão
  na `ProductionPage` via `submissionEntries`; camadas ancoradas no 1º evento; só desfecho `estoque`)~~
  **✅ FEITA (jul/2026)**; ~~**05c** tela (aba "Produtos" na `/estoque`, híbrido "conjunto + lacuna" +
  negativo com aviso; helpers puros `goodValue`/`assemblyBreakdown`)~~ **✅ FEITA (jul/2026) — FEAT-05 fechada**.
- ✅ **[UX-04] Botão "Nova venda" no topo da `/vendas` — FEITO.** Botão no header da `SalesPage`
  (ícone `Plus`) abre o `SaleModal` em **modo novo** (`seed={null}`, cesta vazia; estado `newSale`
  separado do `editRecibo`), escolhendo itens pelo seletor de catálogo já existente e gravando via
  `saveRecibo`. Desabilitado quando o catálogo está vazio (senão não há como adicionar itens). Estado
  vazio da página passou a apontar pro botão. Sem migração — mesmo fluxo do registro pelo card.
- ⬜ **[FEAT-06] Aba Produtos rica — dados completos do produto com custo congelado** *(pedido do dono,
  jul/2026 · melhoria de apresentação sobre a FEAT-05c · **NÃO é o passo 8**)*. **O quê:** cada card da
  aba **Produtos** (`/estoque`) mostra **todos os dados do produto como no catálogo** (composição de
  custo, margem, peso/horas/máquina/filamento, subitens, etapas, acessórios, links, capacidade) — mas
  com os **custos CONGELADOS** da fabricação (a peça já foi impressa, o custo é o do dia da produção,
  não o vivo). Hoje o card é só um resumo de saldo (conjuntos/lacuna/valor parado). **⚠ Decisão de
  design que trava (o miolo):** o acabado só congela o **total** (`FinishedLayer.unitCost`); o evento de
  produção congela `frozenCost` (também total) + `filaments` — **nenhum guarda a composição**
  (material/energia/depreciação/manutenção/labor) nem markup/peso/horas. Então "barras de custo
  congeladas" exigem escolher: **(a)** puxar a composição do **produto VIVO** (`calculatePricing`) e
  congelar só o total — barato, mas se o produto mudou desde a impressão a composição diverge (não é
  fiel); **(b)** passar a **congelar o breakdown na produção** — fiel, mas mexe no modelo do FEAT-04
  (`ProductionInput`/`FinishedLayer` ganham a composição) e, por Diretriz 7, backfill no marco = sem
  migração. Múltiplas camadas por SKU (custos diferentes) → o custo do card é média ponderada ou
  por-camada. **Onde:** `StockPage` (aba Produtos) + reusar `CostBars`/`ProfitSummary`/`CatalogDetails`.
  **Relacionado:** FEAT-05 (base), FEAT-04 (fonte do congelamento), Diretriz 7.
  **✅ DECISÃO DO DONO (jul/2026): opção (b) — o acabado guarda a COMPOSIÇÃO INTEIRA congelada na
  produção** (não puxa do produto vivo), para a aba Produtos mostrar os dados igual à calculadora, mas
  fiéis ao dia da impressão. Consequência que casa com o passo 8: quando isto existir, o
  **`costBreakdown` da venda de peça pronta passa a vir da camada congelada** (hoje, no 8b, é o do
  snapshot do catálogo — stopgap informativo; ver o ⚠ do passo 8). Modelo: `FinishedLayer` (e o evento
  de `producao`) ganham um `SaleCostBreakdown` por unidade; inteiro-com-subitens rateia como o `unitCost`.

**Bugs / achados de teste visual (jul/2026, trazidos pelo dono) — VERIFICADOS contra o código:**

> Comentários do dono após rodar o app. Cada um cruzado com o código neste chat. ✅ procede ·
> ⚠️ parcial · ❌ improcede. Ordenados por criticidade.

- ✅ **[BUG-01] Hora quebrada SOMAVA com os minutos residuais — FEITO (jul/2026).** No `PrintTimeField`
  (`ProductForm.tsx`, compartilhado c/ `ExtraStagesSection`), digitar fração nas horas (ex.: `11.85`)
  **zera o campo de minutos** e emite só as horas (novo `onHoursChange`; blur/`normalize` → `11 h
  51 min`), em vez de somar com o resíduo (`11.85 + 30min = 12h 21min`, custo maior em silêncio). Sem
  fração, mantém o comportamento h + min. Só UI, sem migração. **Relacionado:** UX-02.
- ✅ **[BUG-02] Produção/estoque/encomenda ignoravam o `piecesCount` (mesa de N peças) — FEITO
  (2026-07-19).** O dono reclassificou como URGENTE e furou a fila pré-marco (fundação de dado,
  Diretriz 7). **Modelo (o MESMO da precificação): 1 evento = 1 placa** → baixa filamento/horas 1×,
  credita **N = `piecesCount`** acabados a `custo÷N`. Mudanças: `submissionEntries` (`finishedGoods.ts`)
  ganhou `units` (= peças×placas) e cada acabado vira `qty:units`/`unitCost = custo÷units` (fim do
  `qty:1` cravado); `subitemEventRows` (`productionPlan.ts`) multiplica o labor por `pieces` — o
  `SubitemPrice` mistura escalas (`printHours`/`filaments` crus × `costBreakdown` ÷peça), então o labor
  precisava voltar pra placa senão o `frozenCost` somava material cru + labor por peça; `scaleRow`
  centralizado em `productionPlan.ts` (era só da encomenda); `/producao` ganhou o campo **"Quantas
  placas"** (P) que escala rows por P e credita `piecesCount×P` acabados; a **encomenda**
  (`saleReconciliation.ts`) escala por `qty÷pieces` (decisão do dono: corrigir junto — baixa/COGS por
  peça batem com o preço; make-to-order não estoca as peças sobrando de placa parcial). O estorno é
  round-trip automático (os `stockMoves`/camadas gravados já vêm escalados). +5 testes (189 verdes).
- ✅ **[BUG-03] Histórico de vendas e extrato de rolos fora de ordem — FEITO (2026-07-19).** Desempate
  por `createdAt`: `Recibo` (`SalesPage`) ganhou `createdAt = max(items.createdAt)` e os sorts por data
  (`recent`/`oldest`) usam `(saleDate, createdAt)`; `colorStatement` (`stock.ts`) desempata por um `seq`
  local (createdAt cheio do evento de produção no consumo; `at`/dia p/ compra e ajuste, que naturalmente
  vêm antes do consumo do mesmo dia). Rolos/ajustes seguem só com o dia (não precisou p/ o bug). +1
  teste (190 verdes). Diagnóstico original abaixo. Raiz idêntica ao "só guarda DIA":**
  Diagnóstico do dono certo: **só guarda DIA, não hora.** `saleDate` e `purchaseDate`/`at` vêm de
  `<input type=date>` (meia-noite). Eventos do mesmo dia empatam → a ordem cai no que o Firestore
  devolveu (parece alfabético/aleatório). `SalesPage` ordena recibos por `saleDate` (dia);
  `colorStatement` (`stock.ts`, ~linha 391) ordena por `at` (dia). **Alavanca barata:** venda e evento
  de produção **já gravam `createdAt` (timestamp cheio)** → usar como **desempate** resolve os dois sem
  mexer no modelo (recibo ganha `createdAt = max(items.createdAt)`; statement desempata consumo por
  `event.createdAt`). Rolos/ajustes só têm data de dia — se quiser ordem fina entre compra e consumo do
  mesmo dia, aí sim guardar `createdAt` neles (Diretriz 7: sem migração, recadastra no marco). **Onde:**
  `SalesPage` (sort), `stock.ts` `colorStatement`.
- ✅ **[NOTA→UX] Custo congelado NÃO inclui reserva de falha — ❌ improcede (intencional); TRANSPARÊNCIA
  ADICIONADA (jul/2026).** `productionCost` (`production.ts`) exclui reserva de falha, custo fixo e
  acessórios de propósito: são **provisões de pricing** (markup estatístico), não custo físico da
  impressão. Depois do FEAT-04 as falhas reais viram eventos `outcome:falha` próprios (consomem
  filamento+hora) → embutir a reserva em cada peça boa **dobraria a contagem**. **Matemática mantida.**
  Como o dono achou confuso ver o custo "menor" na venda, foi criado o `CostDetail` (componente
  compartilhado): o gatilho mostra o **custo real** (base do lucro) e abre uma **janela flutuante
  (Popover API nativa, top-layer — não é cortada pelo scroll do modal)** com a **composição do custo
  precificado** (os 8 componentes, com reserva/fixo/acessórios marcados como provisões fora do custo
  real) + nota explicativa. Ligado na **SaleModal** (por item) e no **/vendas** (por venda, escala pela
  qtd). Popover inline foi descartado — refluía a linha da tabela e o modal com scroll cortava o painel. Custo real segue número único congelado (não decomposto); o breakdown exibido é o `costBreakdown`
  do snapshot (catálogo hoje, stopgap; vira o congelado da produção quando o FEAT-06 chegar — o UI já
  aguenta). Só exibição, sem mudança de cálculo.
- ✅ **[BUG-06] Coluna Material mostra só "PLA" (sem a marca) — ❌ improcede (é o PROJETADO). Decidido
  (jul/2026): manter só o material.** O dono confirmou "PLA" mesmo com uma cor; é o comportamento de
  `materialsLabel` (`filaments.ts`): por D7/D8 `material` é campo **separado** de `brand`/`colorName`
  ("PLA"/"Basic"/"Preto") e o rótulo usa **só o material** de propósito — chave do **"lucro por material"**
  do Dashboard (agrupa PLA/PETG/ABS sem fragmentar por marca). O exemplo "PLA Basic" do script de teste
  estava impreciso. **Dono escolheu (a) só o material — nenhuma mudança de código.** Pontas ainda não
  exercitadas (sem tarefa, código correto): multicolor 2-materiais deve mostrar "PLA · PETG"; cor
  **avulsa/arquivada** tem material vazio → some do rótulo.

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
  **Tier 0 e Tier 1 ✅ FECHADOS — próximo: Tier 2.**
- **Bugs de teste visual (jul/2026) — atacar antes do Tier 2:** ~~**BUG-01**~~ **✅ FEITO** (hora
  decimal não soma mais com minutos) → ~~**BUG-02**~~ **✅ FEITO** (piecesCount na produção/estoque/
  encomenda; ver acima) → **BUG-03** (ordenar venda/extrato por `createdAt`, barato, mesma raiz "só
  dia"). ~~**BUG-06**~~ **✅ RESOLVIDO**
  (material "só PLA" é o projetado; dono escolheu manter só o material — sem mudança de código).
  ~~**NOTA** custo congelado sem reserva de falha~~ **✅ TRANSPARÊNCIA ADICIONADA** (`CostDetail`
  expansível na venda e no /vendas — custo real vs. precificado; matemática mantida). Detalhe no bloco
  "Bugs / achados de teste visual" acima.
- **Tier 1 (precisão de custo + fundação):** (6) ~~**FEAT-02 lado-produto**~~ **✅ FEITO** (cores no
  produto/etapa, custo por cor, snapshot da venda congela `filaments[]`); **Item 3 — Estoque**
  (modelo **aprovado**, detalhe e decisões D1-D8 no item 3 do backlog), quebrado em **uma etapa por
  chat**: ~~(7a) modelo + repo, sem UI~~ **✅ FEITA**; ~~(7b) rota `/estoque` (CRUD de cores +
  rolos)~~ **✅ FEITA**; ~~(7c) dropdown de cor no produto (preço vivo)~~ **✅ FEITA**;
  ~~**FEAT-01** preço/subitens por etapa (rateio aditivo; toggle de subitens)~~ **✅ FEITA**;
  ~~**FEAT-04** Registro de Produção (a **primitiva de baixa** migra pra produção; desfecho por impressão)
  — 04a·04b·04c~~ **✅ FEITA**; ~~**FEAT-05** Estoque de Produtos (acabado por subitem, lacuna) —
  05a·05b·05c~~ **✅ FEITA**; ~~**passo 8** (venda = **reconciliação**, não mais baixa; 8a·8b·8c)~~
  **✅ FEITA — TIER 1 FECHADO**. Insumos = (7e), **item separado depois** do filamento.
  **Ordem final do Tier 1 (jul/2026): 7a ✅ → 7b ✅ → 7c ✅ → FEAT-01 ✅ → FEAT-04 ✅
  (04a · 04b · 04c) → FEAT-05 ✅ (05a · 05b · 05c) → 8 ✅ (8a · 8b · 8c). ✅ TIER 1 FECHADO.**
  ⚠ **Reframe aprovado (jul/2026):** o quiosque de mall exige vender **peça pronta na hora**. FEAT-04
  move a **primitiva de baixa** pra produção (é o único ponto que captura teste/falha/brinde — impressões
  que nunca viram venda), então **entra antes da 8**, e a **8 deixa de ser "o passo da baixa"** e vira
  **reconciliação da venda** (encomenda deduz insumo; peça pronta decrementa o acabado do FEAT-05, sem
  dobrar baixa). Detalhe nos itens FEAT-01/FEAT-04/FEAT-05.
- **Tier 2 (features comerciais, independentes):** (10) **FEAT-03** melhorar PDF (quick wins soltos
  podem vir antes; "detalhar etapas" espera FEAT-01); (11) **branding/logo real** no PDF (overlap c/
  FEAT-03); (11b) **FEAT-06** aba Produtos rica (dados completos do produto com custo congelado —
  decidir congelar breakdown na produção vs. puxar do produto vivo; ver item FEAT-06).
- **Tier 3 (adiar até ter volume de vendas):** (12) **Item 4 — Dashboard** (`/painel`) + **TD-003**
  capacidade por-máquina; (13) **TD-006** paginação.
- **Tier 4 (menores/oportunistas):** ✅ **FECHADO (2026-07-31)** — (14) numeração atômica de orçamento;
  (15) labor na reserva de falha = mantido; (16) DEC-01 = opção A (rename); + ROI pela depreciação real.
  Detalhe no bloco "[Tier 4] Fechado" acima.
