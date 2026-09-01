# LopoLabCalc — Histórico & decisões de design

> **Arquivo pesado, lido SÓ sob demanda** — o *porquê* de cada decisão: design do Estoque
> (D1–D8), auditoria (TD-*), e os writeups completos de tudo que já foi **feito** (7a–7c,
> FEAT-01/02/04/05, passo 8, UX-*, DEC-01, bugs). Abra este arquivo quando um item precisar da
> justificativa/detalhe de implementação de algo já concluído.
>
> **Para escolher a PRÓXIMA tarefa, não é aqui** — o que falta fazer vive em
> [`.claude/BACKLOG.md`](BACKLOG.md) (a-fazer, curto). E a foto do AGORA vive no `CLAUDE.md`.
> Referências a "item 3", "FEAT-04", etc. resolvem dentro deste arquivo.

## ✅ [FROTA] Fase 2 — a taxa de frota: o preço parou de depender de quem estava livre (2026-09-01)

> **O problema, em uma linha:** a mesma peça saía por **R$33,06 (A1 Mini) · R$37,45 (A1) · R$49,01
> (X2D)** — 48% de diferença decidida por qual impressora estava livre no dia em que alguém abriu a
> calculadora. Com três máquinas de 7× de diferença de preço, isso não é ajustável por parâmetro.
>
> **A saída não toca em NENHUM número pesquisado.** O `lifeHours` de 7.500h segue sendo o DEC-02, e
> os R$2,187/h da X2D continuam verdade. O que mudou é a **distribuição**: a etapa deixou de
> escolher UMA impressora e passou a declarar em quais ela **pode** rodar; o preço é a média
> ponderada dessas.

### A decisão central: `machineId` (produto e etapa) virou CONJUNTO

Não é renomear campo. O escalar respondia "quem vai imprimir", e a Fase 1 já tinha provado que essa
resposta era ficção — quem imprime sai do evento de produção. O conjunto responde a pergunta que a
precificação de fato consegue responder: **onde a peça cabe**. Os chips de escolha única viraram
**caixas de seleção** (`MachineCheckboxes`) porque radio→checkbox é a única forma de o controle
parar de prometer a semântica antiga.

- **Todas marcadas por padrão**, e **não existe mais "máquina padrão"** — ela era vestígio de o
  preço precisar de um escalar. Restringir é a exceção que o dono declara marcando menos.
- **Desmarcar a última é no-op.** Produto sem máquina nenhuma não tem preço definível, e deixar o
  `validateProduct` reprovar só na hora de salvar afastaria o aviso do clique que causou o problema.
- **O `DEFAULT_PRODUCT_INPUT` nasce com `machineIds: []`** de propósito: aquele literal não conhece
  a frota viva, e um `["a1"]` fixo reintroduziria a máquina padrão pela porta dos fundos. Quem marca
  todas é o `PricingCalculator`, que tem a lista — e **só para produto NOVO**: semear o vazio ao
  ABRIR um produto salvo converteria dado órfão em escolha deliberada e apagaria o badge.

### A média é POR COMPONENTE — nunca um total rateado

Cada componente tem a sua ponderada (`lib/fleet.ts`, `resolveFleet`): desgaste, manutenção e watts.
Ratear **um** total daria uma "mistura de mistura" sem significado ao lado da coluna do custo real
do `CostDetail`, que compara **linha a linha** (desgaste com desgaste). Como a média é linear, a
soma das médias é a média das somas: as 3 linhas continuam fechando a taxa cheia, sem resíduo a
distribuir. Com os pesos 30/40/30 do dono:

```
desgaste 0,9226 + manutenção 0,1380 + energia 0,0808 = 1,1414 R$/h
```

(travado em teste — `frotaFase2.test.ts` reproduz essa aritmética, não só a prosa.)

### `Machine.weight` em PERCENTUAL PURO — e por que não em horas

O peso vive na máquina, editado no modal de gerenciar, junto dos outros campos dela.

⚠ **Percentual, nunca horas/dia (D6.1).** O `FixedCostSettings` já tem `hoursDay`/`daysMonth`/
`machines`, e é dele que saem a capacidade **e** o rateio do custo fixo. Hora aqui seria uma
**segunda fonte da verdade do mesmo fato** — 20h × 2 = 40 h-máquina/dia contra 8+12+8 = 28.
Proporção e hora são grandezas diferentes: não se contradizem, e por isso convivem.

- **Os pesos NÃO precisam somar 100.** A fórmula divide pela soma dos pesos **presentes**, então a
  renormalização no subconjunto sai de graça: um produto que só cabe na X2D é precificado pela X2D
  pura, sem ninguém reescrever percentual. Um subconjunto de 30 e 40 vira 3/7 e 4/7.
- **🔴 Soma de pesos ZERO no subconjunto → média SIMPLES dele.** Sem esse caso, a peça que só cabe
  na máquina recém-cadastrada daria `NaN` e contaminaria o preço inteiro.
- **Máquina nova nasce a 0%**, com aviso visível no modal. Dar-lhe fatia igual automática
  reprecificaria o catálogo inteiro no ato do cadastro, antes de ela imprimir uma peça.
- Peso negativo é **saneado** (`weightOf`), não propagado.

### O dado órfão: dois casos, e eles são diferentes

| Conjunto | O que acontece | Por quê |
|---|---|---|
| Vazio, ou **só** ids que sumiram | Frota INTEIRA + badge | Nada foi declarado; a média de todas é o mesmo default de um produto sem restrição |
| **Parcialmente** órfão (`["a1","sumiu"]`) | As vivas VALEM (`["a1"]`) + badge | Cair na frota **adicionaria** máquinas que o dono nunca nomeou — o preço subiria por conta de uma X2D que ele excluiu de propósito |

O segundo caso foi encontrado escrevendo o teste: a primeira versão do teste afirmava "frota
inteira" nos dois, e o código estava certo e o teste errado. Vale registrar porque o instinto puxa
para a regra única.

Todo produto anterior à fase chega no primeiro caso (Diretriz 7 — sem migração, o dono recadastra),
e o preço deles passa a ser o da frota inteira, com o badge aceso.

### O fallback mudo que o escopo mandou matar

O `planEventRows` tinha `machines.find(...) ?? machines[0]`: linha sem máquina resolvível caía na
**primeira do cadastro**, e energia, desgaste e manutenção do evento saíam dela — creditados a ela.
Com escalar isso era quase inalcançável (o id vinha do produto); com conjunto virou o caminho normal
da encomenda. Ele virou **explícito**:

- **Custo:** sem máquina declarada, o evento custa a **taxa da frota elegível** — exatamente a que o
  preço de venda embutiu (`productionCostAtRate`, em `production.ts`).
- **Atribuição:** o evento fica **sem dono**. As horas dele vão para `summary.unattributedHours`,
  fora do `machineUsage`.

⚠ **Custo certo e dono desconhecido são coisas separadas** — foi confundi-las que a Fase 1 desfez.

🔴 **E é por isso que as horas órfãs não podem entrar no `machineUsage` com id vazio:** ninguém no
ROI casa com id vazio, mas a soma `horas ÷ total` da venda passaria a fechar em **1** sobre as
máquinas conhecidas, rateando para elas o lucro das horas sem dono. É o 🔴 da Fase 1 escrito às
avessas. Na reconciliação da encomenda, `unattributedUnits` deixou de ser `0` fixo e virou a
**proporção por HORAS** das etapas sem máquina — por horas, e não por evento, porque é assim que o
ROI reparte lucro e receita (uma etapa de 6h sem dono ao lado de uma de 1h com dono não é "metade
atribuída").

### A ponte com a `/producao`: "vazia só quando há dúvida" (decisão do dono, 2026-09-01)

O evento continua exigindo um escalar. `initialRowMachineId` faz a ponte:

- **Uma elegível** → não há escolha a fazer, a linha já nasce nela.
- **Duas ou mais (ou conjunto vazio)** → nasce **vazia**, e o botão Registrar fica travado com o
  motivo na tela (UX-32) até o dono escolher.

**A alternativa recusada foi chutar a de maior peso.** O peso diz com que frequência a frota roda,
não quem rodou ESTA placa — e um palpite que ninguém confere vira atribuição errada no ROI, calada.
O atrito aparece só onde a ambiguidade é real. A impressão **avulsa** também nasce vazia: sem
produto não há conjunto de onde deduzir nada, e o `machines[0]` de antes era o mesmo palpite mudo.

### O round-trip (FORM-01 / CSV-05) — a maior parte do trabalho, e invisível

- `buildLoadedProduct` ⇄ `buildProductPayload` ⇄ `toSavedProduct` ⇄ `parseProductsCsv`, os quatro no
  mesmo commit. O `machineIds` é gravado **explícito** no payload, não de carona no spread: a regra
  é que toda chave gravada seja uma decisão, e a que fica implícita é a que some.
- **A coluna "Maquina" virou "Maquinas"**, e a célula virou **lista separada por `|`** ("A1 Combo |
  X2D Combo"). O separador é `|` porque o do arquivo é `;` e nome de impressora leva espaço e
  vírgula com naturalidade. Ela sai do **PRODUTO**, não do resultado — o resultado traz a união com
  as etapas, e reimportá-la apagaria a diferença entre o conjunto do produto e o de cada etapa.
- **`alias: "Maquina"`** no `COLUMN_SPECS`, entrando na passada EXATA. Sem ele, o nome que o próprio
  app escreveu em todo export até aqui cairia na passada por pedaço e acenderia "coluna lida por
  aproximação" em toda planilha antiga — um palpite anunciado sobre um nome que nós mesmos
  escolhemos. É a lição do UX-48 aplicada à coluna: nome canônico anterior é **identidade**, não
  palpite. (Foi assim que 9 testes de outros clusters, poluídos pelo aviso, voltaram ao verde.)
- **Nome que não casa é DESCARTADO, não redirecionado.** Antes ele entrava na 1ª máquina do
  cadastro; com conjunto isso é pior que inútil — uma impressora que ninguém pediu passaria a puxar
  a média. Quatro classes de aviso, todas agrupadas (CSV-24), porque planilha gerada fora erra em
  bloco: `maquina-vazia`, `maquina-nenhuma-casou`, **`maquina-descartada`** (o descarte PARCIAL, que
  é o que some mais fácil — a linha entra com preço plausível e conjunto errado) e
  `maquina-por-aproximacao`.
- Dentro do "Etapas JSON" o conjunto viaja por **id**, com `idsJson` descartando item de tipo errado
  e anunciando (AUD-16 [E5]: `String(item)` fabricaria um id inexistente).

### A limpeza que veio junto

- **`MachineUsage` saiu do `PricingResult` e do `SubitemPrice`.** Virou conceito só de
  produção/venda. No lugar dele, `eligibleMachines`: a união dos conjuntos das etapas.
- **A coluna "Máquina" saiu da tabela do `/catalogo`** e foi para o dropdown de detalhe, como "Pode
  rodar em". Na tabela ela repetiria "A1 Mini +2" em toda linha (o caso normal passou a ser "cabe em
  todas") e, pior, era lida como "foi impresso na A1 Mini" — a confusão que a Fase 1 existiu para
  desfazer. A faixa liberada (`minmax(70px, 1.2fr)`) foi para o nome, a maior flexível.
- **A capacidade perdeu o gargalo por máquina** (`machineBreakdown`, TD-003). Ele saía do
  `machineUsage` da precificação, e a taxa de frota desfez essa atribuição: dizer "a A1 é o gargalo"
  seria inventar um plano de produção que ninguém declarou. O ciclo voltou a ser a **soma** das
  horas — o pior caso honesto. Somar a capacidade das elegíveis fica no BACKLOG.
  ⚠ Junto foi o aviso do **DEC-06** ("2 máquinas dedicadas num produto de 2 impressoras = QUATRO"),
  que dependia do mesmo dado. O `× machines` continua igual e continua significando conjuntos
  completos; o que não existe mais é o dado que dizia quando a premissa deixava de ser óbvia.
- **`validateProduct` exige ≥1 elegível**, no produto e em cada etapa. O CÁLCULO sobrevive ao vazio
  (é o que salva os 97 produtos antigos); o que não pode é SALVAR um produto novo sem dizer onde ele
  roda. A importação de CSV não esbarra nisso: célula vazia lá vira frota inteira, com aviso próprio.
- **`/maquinas` ganhou o cartão da taxa de frota** — o R$/h de cada impressora não aparecia em tela
  nenhuma. Era o número que decidia 48% de diferença de preço e só se via depois, no preço final.
  A coluna de R$/h **não inclui energia** de propósito: ela depende da tarifa, que é do PRODUTO
  (conta de luz), não da máquina; os watts médios ficam ao lado para quem quiser fechar a conta.

### A trava de preço da Fase 1 — o que aconteceu com ela

O escopo previa "os literais são de antes da taxa de frota; recalcular faz parte da tarefa". O que
se mediu foi diferente, e é melhor: o KIT do `frotaFase1.test.ts` declara **um conjunto de UMA
máquina por etapa** — exatamente as impressoras que ele nomeava como escalar. Conjunto unitário tem
média ponderada igual ao único membro, então a taxa de frota **reduz** ao custo daquela máquina e
**nenhum literal se mexeu**. Isso não é o teste ficando velho: é a prova de que a matemática nova
contém a antiga como caso particular. Os números da taxa de frota de verdade (conjuntos de 2+) vivem
no `frotaFase2.test.ts`, que é a trava nova — e ela guarda outra promessa: *"o preço parou de
depender de qual impressora estava livre"*.

**Verificação:** 895/895 (26 testes novos), `lint`/`typecheck`/`build` limpos — **e o navegador,
que pegou três coisas que nenhum teste pegaria:**

1. **Produto novo abria com 2 das 3 máquinas marcadas.** O `useMachines` inicia o estado com os
   `DEFAULT_MACHINES` (2) e só DEPOIS o snapshot do Firestore traz as 3 reais; uma semeadura de tiro
   único rodava nas duas primeiras e a A1 Mini nunca era marcada — produto novo nascia com uma
   restrição que ninguém declarou. O gatilho virou *"o dono tocou no conjunto?"*, não *"já semeei?"*:
   enquanto não tocou, o conjunto persegue a lista viva; no primeiro clique numa caixa o
   acompanhamento para. ⚠ Teste de unidade não pega isto — o defeito mora na ORDEM em que dois
   estados assíncronos chegam.
2. **"0% (fora da média)" em TODAS as máquinas**, que é o oposto do que acontece. Com a frota
   inteira em zero não há quem excluir: a média é SIMPLES e todas entram nela — e esse é justamente
   o estado em que o app nasce, antes de qualquer peso ser cadastrado. Corrigido nos três lugares
   que diziam isso (chips, nota do modal, coluna "Peso" da `/maquinas`), com a distinção explícita
   entre *excluída* e *média simples*.
3. **A coluna "Peso" da `/maquinas` mostrava "33% (0%)"** — dois números contraditórios na mesma
   célula. Virou `33% simples` (frota sem peso), `0% — fora da média` (excluída) ou `40% da média`.

**Medições guardadas** (frota real do dono, pesos ainda em 0 → média simples): A1 Mini R$0,27/h de
desgaste · A1 R$0,71 · X2D R$1,87; frota R$0,95 + R$0,14 = **R$1,09/h**. Com 30/40/30 seriam R$0,92
+ R$0,14 = R$1,06/h — os literais do `frotaFase2.test.ts` batem com a frota real.
· `/catalogo`: 6 colunas, cabeçalho e linha com trilhas idênticas, nome ganhou 279,7px, **103 badges
em 103 produtos** (todos anteriores à fase) · modal a 680px com o Nome em 182px · **modal de
máquinas a 375px**: 4 fileiras no cartão (Peso na 4ª), Excluir 44×44 dentro da caixa, sem rolagem
lateral — isto fecha uma das "lacunas de prova" que o BACKLOG listava como nunca medida ·
`/producao`: linha nasce vazia, borda âmbar, botão travado com o motivo, e destrava ao escolher.

### CSS — o que a fase mexeu

- `.machine-chip` virou `<label>` com checkbox nativo cobrindo o cartão (`opacity: 0`, não
  `display: none`, que tiraria do foco por tabulação); `:has(:focus-visible)` leva o anel para o
  cartão, porque o input é invisível. A fileira ganhou `flex-wrap` — com escolha única eram 2-3
  itens e cabia; agora ela lista a frota inteira, e a 4ª máquina não pode achatar as outras (UX-38).
- O modal de máquinas ganhou a 7ª trilha (Peso %) e, com ela, a **única exceção de largura** da
  casca do TD-015: `.machine-modal` a 680px. Com os 560px padrão o campo Nome ficaria com 76px.
  Abaixo de 640 a fileira já vira cartão (UX-44) e a largura deixa de importar; o Peso abre a 4ª
  fileira do cartão, com colocação **explícita** pelo mesmo motivo dos outros cinco.
- `.field-pending` — a linha da `/producao` que espera escolha se anuncia **em repouso** (UX-36).
  Sem isso o dono só descobriria o que falta ao clicar em Registrar, e com várias linhas na tela não
  saberia qual delas.

### ⚠ Continua valendo (não desfazer)

`ProductionEvent.machineId`, `EventRow.machineId`, `MachineUsage`, `FinishedLayer.machineUsage` e
`Sale.machineUsage` seguem **escalares por evento** — um evento = uma etapa = UMA máquina. O
conjunto é do **produto/etapa** (quem PODE rodar), nunca do evento (quem RODOU).

## ✅ [FROTA] Fase 1 — o ROI parou de atribuir por quem foi PRECIFICADO (2026-09-01)

> **A Fase 1 não toca em preço** — e a prova disso é um teste, não uma afirmação
> (`frotaFase1.test.ts`, com os componentes do preço colados como literal). O que ela conserta é
> quem leva o crédito: o ROI atribuía horas, lucro e depreciação à máquina que o **cadastro** dizia,
> não à que de fato imprimiu. Isso já estava errado ANTES de qualquer mudança de preço — a Fase 2
> (taxa de frota) fica intacta no `BACKLOG.md`.

### O que estava quebrado (4 coisas independentes, um problema só)

1. **`printedCount` contava grupos, não impressões.** O `wholeEventRows` agrupava as etapas **por
   máquina**: duas etapas na mesma impressora viravam **um** evento. O ROI dizia 1 impressão onde
   houve 2, e o desgaste da máquina ficava subcontado no número (as HORAS estavam certas; a
   CONTAGEM, não).
2. **Subitem carimbava tudo na `machineUsage[0]`.** O `subitemEventRows` devolvia UMA linha, com
   todas as horas do subitem na primeira máquina dele. Um corpo na A1 + acabamento na X2D creditava
   as duas coisas na A1 — errava a máquina, não só a contagem.
3. **A camada do acabado não sabia quem a produziu.** O único elo era o `sourceEventId`, que aponta
   só para `built[0]` — ele **nunca** poderia responder "quem imprimiu" numa submissão multi-etapa.
4. **A venda copiava a repartição PRECIFICADA** do `saleContext` (`result.machineUsage`), que é a
   resposta a outra pergunta: em que máquina o produto *pode* rodar.

### As 6 mudanças

- **Uma linha por ETAPA** (`wholeEventRows` e `subitemEventRows`). O agrupamento por máquina não
  economizava nada — a baixa já era encadeada e o custo já era somado componente a componente —,
  então N eventos de uma placa custam exatamente o que o grupo custava. Uma etapa = uma impressão =
  um evento. O nome do evento passou a desambiguar pela **etapa** (`Kit — Tampa`), porque a máquina
  não distingue duas etapas que rodam nela.
  ⚠ **A mão de obra do SUBITEM não é a soma das etapas dele:** o rateio aditivo (FEAT-01) embute a
  fatia dos **passos internos** que cabe àquela parte, e essa fatia não tem etapa onde morar. O
  total continua sendo `costBreakdown.labor × pieces` (o MESMO de antes) e só a **repartição** entre
  as linhas é nova — proporcional ao labor próprio de cada etapa, em partes iguais quando nenhuma
  tem. Somar só o labor das etapas barataria o evento em silêncio.
- **`submissionId`** — o id do 1º evento, carimbado nos N, decidido em UM lugar
  (`buildProductionPayloads`), por onde passam os **dois** caminhos que gravam produção. Evento
  anterior é lido como `submissionId = próprio id` (Diretriz 7, sem migração) e a exclusão dele
  segue apagando exatamente ele.
- **Excluir qualquer card apaga o LOTE INTEIRO** (decisão do dono). Substitui a regra que quebrava
  nos dois sentidos: card secundário deixava o custo do lote inflado; 1º card estornava o acabado e
  deixava os outros eventos órfãos. Os irmãos vêm do **banco** (`fetchProductionSubmission`), nunca
  da lista da tela — ela é paginada/filtrada, e um irmão fora da janela apagaria meio lote. O
  diálogo anuncia o tamanho ("registrada em 3 etapas… todas as 3 saem juntas").
  ⚠ **Não vale para o estorno da VENDA** — ele já reverte exatamente o conjunto que criou.
- **A camada carrega a REPARTIÇÃO** (`FinishedLayer.machineUsage`), por unidade, na mesma escala do
  `unitCost` e pelo **mesmo fator**. Fusão de camadas soma repartições pela mesma regra do
  breakdown: **só sobrevive se TODAS as entradas trouxerem** — meia repartição diria que a camada
  inteira saiu de uma máquina só, o que é pior que dizer "não sei".
  ⚠ No inteiro-com-subitens o fator é a proporção de **custo** da parte, não a de horas: assumido, e
  é a única que mantém Σ partes = submissão sem inventar um 2º critério de rateio.
- **A venda calcula na RECONCILIAÇÃO** — dos eventos (encomenda) ou das camadas drenadas (acabado).
  `machineUsage` virou **obrigatório** no tipo de escrita (AUD-02: `supplyUpdates` opcional fez a
  venda não debitar insumo); lista vazia é a forma de dizer "sem lastro". Saíram `sale.machineId`,
  `sale.machineName` e os três campos de máquina do `SaleModalContext` — **agora**, e não junto da
  Fase 2, porque campo carregado e ignorado é campo que volta a ser lido por engano. Recibo e CSV
  derivam o rótulo do `machineUsage` (`machineUsageLabel`: "A1", "A1 +2", `—` sem lastro).
- **`unattributedUnits`, também obrigatório.** 🔴 **Sem ele o D4 vira atribuição invisível:**
  `fraction = share.hours / totalHours` **soma 1 de qualquer jeito**, então vender 10 tendo
  produzido 6 daria às máquinas 100% do lucro dos 10 e o buraco não apareceria em lugar nenhum. A
  fração passou a ser sobre as horas que cobririam **todas** as unidades, e Σ frações = 6/10.

### O que CAIU junto

O malabarismo **"depreciação real repartida na proporção da precificada"** (follow-up registrado
desde o FEAT-06). Ele existia porque o `realCostBreakdown` é um total por unidade e a única forma de
dividi-lo entre máquinas era pela razão da **precificada** — dois números de fontes diferentes num
só. Não é mais necessário: cada evento congela a sua depreciação **real** e ela desce pela camada
até a venda, por máquina.

### As armadilhas medidas

- ⚠ **A escala do `machineUsage` da venda é a unidade ATRIBUÍDA, não a vendida.** É o que permite ao
  ROI extrapolá-la para as `quantity` e descobrir sozinho quanto sobra sem dono. Usar a vendida
  faria a cobertura sumir na conta.
- ⚠ **Venda antiga lê `unattributedUnits: 0`, nunca `quantity`.** Ela tem a repartição precificada
  gravada na época e o campo simplesmente não existe; ler `quantity` apagaria o ROI inteiro
  retroativamente. Consequência declarada: **até o recadastro o ROI mistura atribuição precificada
  (vendas velhas) com real (novas)**.
- ⚠ **Overdraft do acabado (D4) NÃO gera órfã.** As unidades a mais saem da camada mais nova, que
  tem repartição — o buraco vive no `shortfall`, que é quem o descreve. Órfã é a unidade que veio de
  **camada sem repartição** (anterior à Fase 1) ou de **SKU que não existe**.
- ⚠ **Lista vazia gravada ≠ campo ausente.** Na camada, a ausência é o dado ("não sei quem
  imprimiu"), então lista vazia **não** é gravada. Na venda, o campo é **sempre** gravado, porque lá
  a lista vazia significa "sem lastro" — e as duas coisas levam a contas diferentes.

### A prova — em TRÊS camadas, porque cada uma passa com a outra quebrada

**1. A matemática — `frotaFase1.test.ts` (21 casos).**
- **O preço, componente a componente, como literal.** Uma asserção que recalculasse
  `calculatePricing` acompanharia qualquer regressão — só o número colado é trava.
- **O dinheiro contra o agrupamento ANTIGO**, reconstruído à mão no próprio teste: 3 eventos contra
  2, e `frozen`/`grams`/`material` e os 6 componentes idênticos a 1e-10. (⚠ Ao montar o fixture
  antigo, esquecer os acessórios na 1ª linha deu exatamente R$ 1,00 de diferença — o teste pegou o
  teste.)

**2. A SERIALIZAÇÃO — `frotaFase1RoundTrip.test.ts` (14 casos).** ⚠ **Este arquivo existe porque o
de cima passa inteiro com um serializador que joga o campo fora** — as funções puras nunca chegam
perto do documento, e é exatamente aí que este projeto já perdeu dado calado duas vezes (o
`supplyId` do FORM-01, o `supplyUpdates` do AUD-02). Diff campo a campo do documento nos dois
sentidos, com o SDK falso do `productionRevRoundTrip`. Cobre as três assimetrias que decidem conta:
`submissionId` ausente → o PRÓPRIO id (ler `""` faria a query de irmãos casar com todos os eventos
antigos de uma vez); camada sem repartição → campo AUSENTE, nunca `[]`; venda sem lastro → `[]`
GRAVADO, porque ali a ausência seria indistinguível de venda velha.
(Para isso, `toProduction`, `toSale` e `saleToDocument` viraram `export`, no precedente do
`toFinishedGood`, que já era exportado para o teste do TD-026.)

**3. O SITE, ponta a ponta (2026-09-01, navegador embutido, dado real).** Produto "Teste 4b
produção": principal **X2D 4h36** + etapa 2 **A1 2h35** + Etapa 3 **X2D 1h30** — duas etapas na
mesma X2D, o caso que o `printedCount` contava errado.
- **3 cards** onde antes havia 2; custos somando R$ 7,53 + 34,48 + 10,33 = **R$ 52,34**, o mesmo da
  prévia.
- **Excluir o card SECUNDÁRIO** (o da A1) abriu "registrada em **3 etapas**… todas as 3 saem
  juntas" e apagou o lote. ROI: A1 **34 → 33** impressões (−2,58 h) e X2D **26 → 24** (−6,10 h). A
  X2D caiu **2** clicando num card da A1 — as duas coisas que a regra antiga errava, medidas juntas.
- **Real ≠ precificado, medido:** as 3 etapas foram trocadas para a **A1 Mini** na tela de produção.
  Custo caiu de R$ 52,34 → **R$ 40,27**. Vendendo duas peças do MESMO produto, o FIFO drenou a
  camada velha e depois a nova: a 1ª venda mostra **"X2D Combo +1"**, a 2ª mostra **"A1 Mini"**, e o
  desgaste real dela é **R$ 1,16** contra R$ 6,61 precificado. O ROI deu à A1 Mini **3 impressões,
  8,68 h, 1 venda, R$ 52,44 de lucro** — 100% dela. No comportamento antigo esse lucro teria ido
  para X2D+A1 e a A1 Mini seguiria com 0 vendas tendo feito o trabalho.
- **A venda sem lastro, em dado real:** vender uma peça do "Insert Emberheart Luiz" (camada anterior
  à Fase 1) mostra **"Máquina —"**, e o **lucro acumulado da frota ficou parado em R$ 1.851,55**
  enquanto o lucro das vendas subiu R$ 86,80. Nenhuma máquina foi creditada. É o `unattributedUnits`
  funcionando: sem ele, os R$ 86,80 teriam ido para a A1 Combo sem nada indicar.

Medições: `pnpm test` 861/861 · `lint`, `typecheck` e `build` limpos · console sem erro.

## ✅ As 3 ressalvas baratas — o corte mudo, a tinta cravada e o botão sem nome (2026-08-31)

> Três itens antigos, escolhidos por um critério só: **não dependem da logo nem de venda real**, e
> os três estavam parados como *ressalva* havia semanas. Um commit.

### O critério de triagem (vale reusar)

O dono perguntou o que valia a pena e **o que ia sumir com o recadastro**. A pergunta separou a
lista em duas metades que ninguém tinha separado antes:

- **Some com o recadastro (não fazer):** `[CSV-18]` (18 docs com campo `id`), `[CSV-19]`
  (`markupOnFixed` em 65), `[CSV-20]` (`stage2`, hoje inalcançável), os 4 `acabados` órfãos, o
  acabado com saldo −1, os 2 contadores de orçamento, o overdraft de −370 g na Bege, o `warn` do
  recibo `yoRC0YZjQAq2piItJojG`. Tudo **dado**, e o código já parou de produzir os três primeiros.
- ⚠ **O que NÃO some é a MECÂNICA:** `saveProduct` usa `tx.update`, que faz **merge** — todo campo
  que o payload deixe de gravar fica no documento para sempre. É o que explica por que a lista
  existe, e ela vai se reformar depois do recadastro se alguém remover um campo.

### `<select>` que corta a seco → corte que se ANUNCIA

`select { text-overflow: ellipsis }` global no `base.css`. **Escolhido por ser o único item da lista
que PIORA com o recadastro:** o dono vai cadastrar muitas cores, e nome de cor tem a diferença no
FIM da string (`PLA Azul Bebê` × `PLA Azul Bebê Seda`) — cortar o fim troca uma cor por outra, que é
o UX-21 pela porta do `<select>`.

**A prova não foi o `getComputedStyle`** (que só diz que a regra chegou, não que o Chromium a
honra): duplicei o mesmo `<select>` no MESMO quadro com `clip` forçado no clone —
`Avulso (fora d…` ⌄ contra `Avulso (fora do est` ⌄. Sem a regra o texto entra **por baixo da seta**
e some no meio da palavra.

**Medido a 375px, 7 rotas + o modal de venda aberto:** 0 `<select>` sem `ellipsis` · rolagem lateral
**0** · pior corte **300px** (`.cesta-add`, "Adicionar do estoque de produtos…"), que é justamente o
`.cesta-origem` nomeado na ressalva da AUD-14.

⚠ **Não fecha o `min-content`** — o `<select>` continua sem encolher, e é por isso que as colunas
seguem em `minmax(0, 1fr)`. A regra trata o DEPOIS de encolher.
⚠ **A receita de medição segue valendo:** a caixa nativa cobra a seta **por cima** do texto, então
medir pela largura da FONTE subestima. Clone em `width: max-content`, nunca `measureText`.

### `--on-accent` — o token criado ANTES da marca, de propósito

Repete o acerto do `[TD-014]`, e pelo mesmo argumento de prazo externo: **fazer antes ECONOMIZA**.
O amarelo dourado da marca (~`#F2B705`–`#F5C518`) reprova com branco em cima (~1,8–2,1) e passa
folgado com preto (~10–11,5) — ou seja, a tinta **inverte**, e ela estava cravada em literal.

Nasceu **no-op**: valor `#fff`, zero mudança visual. ⚠ **Eram 6 lugares, não os 5 que o backlog
listava** — faltava o **`.skip-link`**, além de `.btn.primary`, `.back-to-top`, os 2 toggles de
desconto e o `.collapse-badge`.

**Ensaio medido do rebrand**, uma linha: `--on-accent: #111` + `--accent-strong: #F2B705` →
`.btn.primary` vai de `rgb(255,255,255)` a `rgb(17,17,17)` sobre o mesmo fundo `rgb(194,65,12)`, e
reverte limpo ao remover a propriedade. **A troca de paleta virou troca de paleta.**

⚠ **Armadilha de medição, nova:** ler `getComputedStyle` **síncrono** logo depois de mexer no
`disabled` devolve o estilo VELHO — a primeira leitura acusou `.btn.primary` cinza e fundo
transparente, e quase virou "regressão". Precisa de um tick entre mexer e ler. É irmã da armadilha
do `transition` já registrada em "Regras de CSS/UI".

Não redeclarei no escuro, pelo mesmo motivo que o `--accent-strong` não é: tinta sobre cor não
depende do fundo da página.

### `aria-label` nos botões só-ícone (A11Y-01)

Eram **21 sítios no fonte** — os "48 do `/vendas` + 5 do `/catalogo`" da ressalva eram **instâncias
renderizadas** (24 recibos × 2 botões). A varredura foi por **script**, não a olho: casa cada
`<button>` com `title` e sem `aria-label`, checa se o corpo é só ícone. Re-rodado depois: **0**.

**Ao vivo, 7 rotas:** **678 botões só-ícone renderizados, 0 sem nome** (`/catalogo` 545 · `/vendas`
51 · `/orcamento` 49 · `/producao` 27 · `/`, `/estoque` e `/maquinas` 2 cada).

⚠ **Fiz mais que a régua mínima, e é o ponto:** em fileira repetida o rótulo **nomeia o quê**.
`"Excluir"` virou `"Excluir ovo fidget"`; `"Editar venda"` virou
`"Editar a venda de <cliente>"`; `"Excluir item"` virou `"Excluir “<produto>” da venda"`. Um leitor
de tela ouvindo "Excluir" 97 vezes seguidas não sabe o que vai excluir — o `aria-label` é lido FORA
de qualquer contexto visual, enquanto o `title` só aparece no hover, onde a linha inteira está à
vista. Por isso os dois textos são diferentes de propósito, e não é redundância.

⚠ **Falso positivo MEU, declarado:** a varredura ao vivo acusou **4 botões sem nome** no
`/orcamento` que o scanner de fonte não via — eles não têm `title` nenhum. São os `.num-spin`
(steppers ▲▼), dentro de wrapper `aria-hidden="true"` com `tabindex="-1"`: **não existem para leitor
de tela, por desenho**. O filtro passou a ignorar `[aria-hidden='true']` e o número real é 0. É a
mesma ressalva de steppers já registrada na AUD-16 — e a lição é que **contar no fonte e contar no
DOM erram para lados opostos**: o fonte não vê o que é renderizado N vezes, o DOM não vê o que é
`aria-hidden`.

`lint` ✅ · `typecheck` ✅ · **824/824** ✅ · `build` ✅.

## ✅ AUD-16 lote 1 — a fronteira de ingestão parou de corrigir calada (2026-08-29)

**De onde veio:** varredura total do sistema feita por **outra IA** sobre uma cópia ZIP
(`AUD-16-RELATORIO.md`, fora do repo), 7 defeitos. Antes de mexer em qualquer linha, os 7 foram
**reconferidos aqui com sonda rodando o parser real** — e a reconferência corrigiu o relatório em
três pontos (registrados no `BACKLOG.md`, seção AUD-16).

**O diagnóstico que importa não é "o importador é frouxo".** É que ele **não tinha uma resposta
só**: para a mesma classe de erro ele ora avisava, ora corrigia em silêncio, ora estourava com
`TypeError`. A assimetria denunciava a causa: `Mao de obra (min) = -30` entrava negativa e acendia
`linha-invalida`, porque **nada** a normalizava antes; `Tempo (h) = -1` virava 0 sem um aviso,
porque tinha um `Math.max(0, …)` na frente. **O clamp não protegia — ele escondia**, e trocava um
número absurdo (que salta aos olhos) por um plausível (que ninguém acha depois). É literalmente o
argumento que o CSV-31 já tinha escrito para as peças fracionárias; faltava aplicá-lo aqui.

**As quatro mudanças:**

1. **`[E1]`** — o clamp do tempo saiu (`printTimeHours`). O negativo sobrevive até o
   `validateProduct`, que **já checava** `printHours < 0` e nunca via o valor cru.
2. **`[E2]`** — o clamp da taxa de falha saiu (`Math.min(95, Math.max(0, …))`, que fazia `-1`→0 e
   `96`/`500`→95, os três com `issues: []`). O domínio **0–95** virou regra do `validateProduct`, a
   MESMA função do formulário — que era o item "equivalência real com `validateProduct`" do
   relatório. A matemática não corre risco com o valor cru: `failureFractionOf` tem o teto de 95%
   dele, compartilhado com a capacidade (TD-011). ⚠ Um teste do AUD-14/D1 cristalizava o clamp
   (`expect(failureRate).toBe(95)`) — foi reescrito, não deletado: o aviso de magnitude continua, e
   agora a linha ainda é reprovada.
3. **`[E3]`** — `numFromJson` devolve 0 para campo ausente **sem reportar**, e está certo: dentro do
   JSON a maioria dos números é opcional. `qty`/`unitPrice` do acessório não são — sem eles o item
   vira uma linha de R$ 0,00 que aparece no catálogo, some do custo e, com `supplyId`, ainda parece
   que baixa insumo. A checagem olha o **resultado** (`qty <= 0 || unitPrice <= 0`), não a ausência:
   `"qty": 0` escrito à mão é o mesmo item inútil, e duas classes para o mesmo estrago ensinam a
   ignorar as duas.
4. **`[E4]`** — a **forma** do JSON, que ninguém lia (só os números tinham função própria).
   `textoJson` cuida do campo de TEXTO: número/booleano entram convertidos e avisados (`2` → `"2"`),
   lista/objeto viram vazio e avisam — insistir neles é o `"[object Object]"` que ninguém acha
   depois. `objetoJson` cuida do ITEM que não é objeto: `[null]` estourava em
   `Cannot read properties of null (reading 'id')` e `[[]]` entrava como cor fantasma de 0 g.
   ⚠ De quebra, as cores de etapa deixaram de ser uma **segunda cópia** do bloco de cores
   (`parseFilamentList`): a checagem de tipo teria de ser escrita duas vezes, que é o jeito clássico
   de a segunda ficar para trás.

**O que NÃO foi feito, de propósito:** o relatório pedia **bloquear** a confirmação quando houvesse
erro de domínio. Este app avisa e deixa o dono decidir — está escrito na própria `CsvImportResult`
("Nada disso bloqueia", TD-009). Mudar isso é decisão do dono, não da auditoria.

**Prova:** os 6 repros do relatório, contra o parser real — `Tempo=-1` e `Taxa=-1/96` →
`linha-invalida`; acessório sem números → `acessorio-zerado`; `colorName: []` e `name: 2` →
`json-tipo-errado`; `[null]` → `json-item-invalido`; **e a linha boa continua sem um aviso sequer**
(nenhum falso positivo). **806/806 (28 testes novos) · lint ✅ typecheck ✅ build ✅.**

## ✅ UX-47 + UX-52 — os dois últimos itens de código (2026-08-24)

> Fecharam o backlog de código INTEIRO. Os dois são de UI, nenhum mexe em cálculo.
> `lint` ✅ · `build` ✅ · **729/729** ✅ · medido no DOM em 4 larguras (375, 640, 641, 700, 1280) e
> conferido ao vivo no banco real (sem gravar nada).

### [UX-47] A fileira de acessórios virou cartão — e a exceção da régua de 44px morreu inteira

**O que era.** A `.accessory-row` era a única fileira do app que nunca virou cartão: `1fr 60px 90px
32px` em TODA largura. A 375px a conta fechava no talo — 77 + 60 + 90 + 32 + 3 folgas de 8 = **283px,
exatamente a largura da linha**. Por isso ela e a `.machine-edit-row` eram as **duas exceções** à
régua de 44px do UX-46: com o botão em 44 a fileira estourava 12px e o Excluir saía para fora da
linha (right 341 contra 329), e o stepper de 28 deixava 16px para o número — o caso que o `[micro]`
mediu. O campo mais usado dos três, a descrição, ficava com 77px.

**A saída.** A receita do projeto (UX-38/UX-40), idêntica à que fechou o UX-44 no editor de
máquinas: cada campo ganhou invólucro com rótulo próprio (`.acc-field`/`.acc-label`, gêmeos do
`.me-field`/`.me-label`), a `.acc-header` some no celular e a fileira quebra em 2 faixas —
descrição + excluir em cima, os dois números embaixo.

**⚠ O que este item ensinou, e que o UX-44 não tinha ensinado: a exceção tinha DOIS pedaços de
range, e cada um pede um remédio diferente.** Virar cartão resolve onde a fileira não cabe. De 641 a
760 ela **cabe** — ali o problema não era falta de espaço, era trilha estreita demais para o dedo.
O remédio certo naquela faixa é **alargar a trilha** (`minmax(0,1fr) 96px 110px 44px`), não encolher
o alvo. Medido a 641 (o pior da faixa): descrição 275px, quantidade 96px com **53px** de folga de
texto (o `[micro]` precisa de ~34), Excluir 44×44 dentro da linha, rolagem 0. Com os dois pedaços
cobertos, **não sobrou range em que a `.accessory-row` precise de exceção** — ela saiu da regra do
topo do `responsive.css` de vez.

**⚠ Por que a fronteira do cartão é 640 e não os 760 do catálogo/recibo.** Foi medido nos dois
cortes ANTES de escolher. A 700px o cartão dava 554px à descrição e **272px a cada campo de
número**, com a fileira indo de 44 para 124px de altura: largura de sobra convertida em rolagem
vertical. A regra é "fileira que NÃO CABE vira cartão", não "fileira estreita vira cartão" — o
cartão entra onde a fileira realmente não cabe, e a 641…760 ela cabe. 640 é a mesma fronteira do
`.machine-edit-row`, que é a fileira de trilha fixa irmã desta.

**Medido a 375px (o caso do item):** descrição **77 → 229px** · Excluir **32 → 44×44**, agora com
right 329 = a borda da linha (era 341, fora dela) · stepper **14 → 28px**, com **67px** de folga
para o número (eram 16) · rolagem horizontal **0** · altura da fileira 44 → 124px, que é o preço do
cartão. **Desktop inalterado:** `394px 60px 90px 32px`, altura 35, rótulos escondidos, cabeçalho em
`grid` — a prova de que o invólucro novo não move pixel onde a fileira já servia.

### [UX-52] O rótulo diz as duas coisas (escolha do dono)

**O que era.** "Estoque de acabados (8 disp.)" no seletor de origem e "⚠ 4 além do estoque de
acabados" no aviso, a 2cm de distância, os **dois certos** e medindo coisas diferentes: o rótulo é
`partBalance`, que soma TODAS as cores de propósito (FEAT-11 — "a cor decide de onde tirar, não
quantas existem"), e o aviso vem do `consumeFifo`, que drena da cor ESCOLHIDA. Não era bug de
número; era leitura contraditória.

**A saída** (o dono escolheu o rótulo, não o aviso): `Estoque de acabados (7 disp. · 3 nesta cor)`.
Com o segundo número na tela a conta **fecha à vista** — o aviso de "4 além" para quantidade 7
passa a ser 7 − 3, e não um número que aparece do nada. O parêntese só surge quando os dois
DIVERGEM (peça em mais de uma cor); com uma cor só eles coincidem e ele seria ruído — que é por que
ninguém tinha visto isto antes.

**Conjunto multicor** diz "nestas cores" e usa o **mínimo entre as partes**, a mesma conta do
`assemblableWholes`: o que limita um conjunto é a parte mais escassa. O `colorBalanceOf` só relê o
saldo que o próprio seletor de cor já exibia — **nenhum cálculo mudou**, e por isso ele não virou
função de `lib/`.

**Prova ao vivo** (banco real, sem gravar: o modal foi fechado no Escape). Chaveiro Charmander,
Laranja 4 · Bege 3, total 7. Com Laranja: "7 disp. · 4 nesta cor". Trocando para Bege: "7 disp. ·
3 nesta cor". Quantidade 7 com Bege: aviso "⚠ 4 além" — **7 − 3 = 4**, as duas frases finalmente
somando na mesma tela.

## ✅ Lote E da AUD-13 — "a poeira": os 11 🟢 (2026-08-24)

> O lote de fechamento da 3ª varredura. Nenhum item sozinho valia uma sessão; somados, são o
> parser aceitando número que não é número, dois pedaços de código morto, um preço de repasse ×20
> por digitação, um saldo que a tela e o aviso liam diferente, e **toda a régua de 44px do celular**.
> `lint` ✅ · `build` ✅ · **729/729** ✅ (18 testes novos; **4 deles falham** contra o código velho —
> os outros são contraponto) · medição no DOM em **7 rotas a 375px**, com o "antes" obtido
> desligando as regras novas na própria página · e **prova ao vivo no banco real** do CSV-34 (5
> recibos, antes × depois) e do TD-032 (teto na digitação, com o valor restaurado e conferido).
> **A prova ao vivo abriu um item novo: o `[UX-52]`.**
>
> ⚠ **Um item saiu como FALSO POSITIVO declarado: o `[A11Y-02]`.** Ver o fim desta seção.

### Parser — CSV-33, CSV-35, CSV-37

**[CSV-37] "5X0" entrava como 50.** A causa não era o `replace` do markup (o regex dele é ancorado
no fim, `/x\s*$/i`, e não toca o "X" do meio): era a **limpeza do `parseDecimalPtBr`**, que apaga
tudo que não é dígito/sinal/separador e **cola o que sobra**. Um erro de digitação virava outro
número plausível, sem aviso. A trava nova é uma linha, e mora no `number.ts` porque o defeito é de
lá: **letra ENTRE dígitos → `null`**. Letra antes ou depois segue tolerada, que é o que carrega
unidade e moeda (`"R$ 50"`, `"5 metros"`, `"5x"`, `"X5"` — os três últimos são markup legítimo). A
científica sai **antes** da trava, senão `"1e3"` morreria nela. Efeito colateral desejado: `"2h30"`
deixa de virar 230 em qualquer coluna escalar, e o `null` cai no default **com a classe do CSV-09** —
avisa, não engole. De quebra, o `"2 e 5"` do AUD-11/D-4 agora é `null` em vez de 25.

**[CSV-33] `Pecas = 0` e `-1` viravam 1 em silêncio.** É o defeito que o CSV-26 tirou do markup, na
coluna ao lado: leitura, default e clamp espremidos numa expressão só (`Math.max(1, cellNumber(…) ||
1)`). Separado nos mesmos três nomes do markup (`piecesCell` crua para o aviso, `piecesLido`,
`piecesUsavel`), o piso continua em 1 — dividir custo por 0 não tem leitura — e a classe
`pecas-invalida` conta a linha. **Ausente e vazia seguem caladas** (é ausência, não erro), ilegível
continua só com a classe do CSV-09 (sem aviso em dobro) e a **fracionária maior que 1 passa aqui de
propósito**: quem a reprova é o `validateProduct`, com a mensagem sobre inteiro (CSV-31).
⚠ Onde declarar o `piecesLido` importa: ele usa o `reportColuna`, que é `const` declarado mais
abaixo — no lugar "natural" (junto do markup) seria zona morta temporal.

**[CSV-35] a coluna repetida com grafia VARIANTE recebia o conselho oposto.** `Peso (g);Peso` caía em
*"o nome não foi reconhecido"*, cujo conselho é **renomear** — e renomear cria a duplicata exata que
o CSV-28 existe para apontar. A tentação era reusar o `includes(needle)` da passada por pedaço, e
**isso quebrou um teste do AUD-11/D-3 na primeira tentativa**: `"Tempo de cura (h)"` ao lado de
`"Tempo (h)"` virou "coluna repetida — apague a extra", e ela **não é repetida, é outra coluna**. O
que caracteriza a variante é a **direção da continência**: a sobra é o próprio needle, ou uma
abreviação do nome canônico (`"peso"` dentro de `"peso (g)"`). Nome com palavra a MAIS continua sendo
coluna desconhecida. O teste que falhou virou o contraponto explícito da suíte.

**[CSV-36]** "Importar **1 produtos**": o diálogo já flexionava "aviso/avisos" e "linha/linhas"; o
portão da carga, o número mais lido dos três, não. As duas ocorrências (título e o "importados com
sucesso") passaram a flexionar. Os outros plurais fixos do app foram conferidos e **estão certos** —
`SaleModal` e `SalesPage` só mostram a contagem quando é > 1.

### TD-032 — taxa ≥ 100% multiplicava o preço de repasse por 20

`grossUpForFee(100, 100)` → **1999,99**. O ×20 **é a conta certa** para uma taxa de 95% (`1/(1−f)`);
o defeito era **chegar nele digitando 100**: o editor guardava 100, o `feeFraction` clampava em 0,95
e os dois números discordavam em silêncio. O teto virou **um número só** — `MAX_FEE_PCT = 95`,
exportado do `paymentFees` — e o editor clampa a **entrada** nele (`clampFeePct`, mais `max` nos 5
campos JSX, que renderizam **11 campos** com `max="95"`). Agora o que se lê no campo é o que entra na
conta, e "o preço sobe para cobrir a taxa de 95%" torna o ×20 uma escolha visível.
**Medido ao vivo** no campo Pix do editor: digitar `100` **deixa 95** no campo, `250` deixa 95, `7`
deixa 7 (abaixo do teto nada se move). O valor original (0) foi restaurado e conferido **depois de um
reload** — as 11 taxas voltaram ao retrato de antes (pix/dinheiro/outro 0 · visa/master 1,36 · 3,14 ·
5,38 · 6,11 · amex/elo 2,57 · 4,90 · 6,46 · 7,19).

### CSV-34 — a tela e o aviso liam saldos diferentes

Editando um recibo de 1 un sobre 1 produzida, o rótulo dizia **"0 disp."** enquanto a quantidade 1
era aceita sem um pio. O **aviso estava certo** (UX-42: a reconciliação credita o recibo antigo antes
de simular); quem ficou na conta antiga foi o **rótulo**, que lia o `goods` cru. O conserto é o mesmo
estorno da gravação (`reverseFinishedConsumption`) sobre uma **cópia** — `goodsCreditados` —, sem
gravar nada; o `balanceForItem` e o `colorOptionsOf` passaram a ler dela.
⚠ **Ordem de declaração de novo:** o `oldRecibo` (um `useMemo`) vivia depois do `stockItems`, que é
outro `useMemo` e chama o `balanceForItem` **durante o render** — deixá-lo onde estava daria
ReferenceError. Subiu para o topo do componente, com a razão escrita no lugar.

**Medido ao vivo, no banco real, recibo a recibo** (o mesmo código com e sem o conserto, trocando só
a fonte do `good`): o crédito é **exatamente o que aquele recibo drenou**, nunca um a mais.

| recibo | o que ele drenou | antes (`goods` cru) | depois (creditado) |
|---|---|---|---|
| #0 | 1 linha × 1 un | 7 disp. | **8** |
| #1 | 1 linha × 1 un | 5 disp. | **6** |
| #3 | 1 linha × **2** un | 6 disp. | **8** |
| #4 | 1 linha × 1 un | 6 disp. | **7** |
| #5 | **2 linhas** × 1 un | 6 disp. | **8** |
| #2, #6, #7 (encomenda) | nada — sem `finishedMoves` | 0 | **0** |

O #5 é a conferência que fecha o argumento: ele credita **+2** com "qtd 1" no campo, porque são
**duas linhas** do mesmo produto no mesmo recibo — a soma é por `finishedMove`, não por linha. E o
seletor de COR foi junto: as opções do #0 somam `Bege (4) + Laranja (4) = 8`, o mesmo 8 creditado do
rótulo (com o `goods` cru elas somariam 7).

⚠ **A prova ao vivo abriu um item novo, o `[UX-52]`** (registrado no `BACKLOG.md`): com quantidade 8
sobre esse rótulo de "8 disp.", o aviso responde **"4 além do estoque"** — e os dois estão certos. O
rótulo é `partBalance`, que **soma as cores** por desenho do FEAT-11; o aviso vem do `consumeFifo`,
que drena da cor **escolhida** (Bege, 4). Não é resíduo do CSV-34 — é a leitura lado a lado que fica
contraditória, e só acontece em produto que existe em mais de uma cor.

### Código morto — TD-030 e TD-031

**[TD-030]** o `deleteGood` do `useFinishedGoods` nunca teve chamador — e o `saveGood` ao lado dele
também não, nem os dois do repositório (`saveFinishedGood`/`removeFinishedGood`). **Saíram os
quatro.** Quem escreve no acabado é **sempre** o `writeBatch` de outra coleção (produção 05b, venda,
estorno), e é isso que mantém a baixa atômica: um caminho solto de gravar/apagar por fora seria a
porta para o saldo descolar do rastro que o produziu. O hook virou leitura pura.
⚠ **Consequência declarada:** doc de acabado com saldo 0 (produto excluído, produção estornada) fica
na coleção, invisível na tela — inclusive os 2 das sondas da AUD-13. É o retrato certo do que
aconteceu, e **não existe caminho de UI para apagá-lo** (era este o item).

**[TD-031]** `.sales-table`/`.sales-table-wrap` (~45 linhas) eram a tabela do histórico de **antes**
de ele virar lista de recibos. Nenhum componente as aplicava, e o `min-width: 760px` delas é o
oposto da regra de hoje (fileira que não cabe vira **cartão**, não rolagem).

### UX-50 e UX-51 — a régua de 44px, medida rota a rota

O UX-46 subiu o `.icon-button` e o UX-49 o `.modal-close`; a AUD-13 mediu **o que sobrou**, e não é a
ressalva de "1–4px" da AUD-12 — é gente de 32, 27 e 20px. Todos cresceram pela receita
**UX-28/UX-37** (`min-height` na caixa que a classe já tem + margem negativa de metade da diferença
onde o crescimento não pode empurrar a linha), tudo dentro do `@media (max-width: 760px)`.

**Nada mexeu em `font-size`** — o `[micro]` (dono, 2026-08-17) recusou o `.btn` maior porque a FONTE
subindo em cascata custou +57px na `/vendas`. Altura de alvo é outra conta, e ela foi medida:

| rota | altura antes → depois | custo | alvos < 44px depois |
|---|---|---|---|
| `/` | 2113 → 2140 | **+27px** | só as setas do stepper |
| `/vendas` | 6214 → 6226 | +12px | — |
| `/producao` | 4141 → 4153 | +12px | — |
| `/catalogo` | 5734 → 5742 | +8px | — |
| `/orcamento` | 3518 → 3528 | +10px | as 4 setas do stepper |
| `/estoque` | 1205 → 1223 | +18px | — |
| `/maquinas` | 1279 → **1279** | **0** | — |

(Os 3 remanescentes de toda rota — `navbar-toggle` 40, `navbar-close` 40, `back-to-top` 42 — são a
**ressalva de 1–4px** que a própria AUD-13 registrou como exclusão deliberada; não foram tocados.
No desktop, remedido a 1280px, **nada mudou**: `brand-reset` 20, `.field-input` 35, `summary` 27,
`.btn-secondary` 34, arredondamento 32 — os valores de sempre.)

Além dos 6 nomes que o item listava, entraram **os que a varredura não viu porque mediu outra rota**:
`.catalog-actions select` e `.search-box-input` (36 os dois), as **3 abas do `/estoque`** (34), o
`summary` do aviso de payback do `/maquinas` (36) e a **família inteira de campos** que não é
`.field-input` (35): `.fc-item`, `.accessory-row` e os 26 do editor de máquinas, além dos 3 do
`.ci-item` que o item citava.

⚠ **A `.accessory-row` e a `.machine-edit-row` entraram de propósito, e não contradizem a exceção
medida do UX-46**: aquela é de **LARGURA** (o botão de 44 e o stepper de 28 estouravam os 283px da
linha a 375px). Remedido depois da mudança, a 375px: a linha vai de 46 a 329 e o excluir termina em
**329** — dentro, com os campos já em 44. Altura não disputa trilha. No editor de máquinas o modal
foi de 679 para 690px de altura, sem estouro e sem rolagem lateral.

**[UX-51]** o comentário do `forms.css` justificava a seta pequena dizendo que *"o alvo de verdade é
o campo, e ele passa dos 44px"* — **medido, não passava**: `.field-input` dava 42 e os do `.ci-item`,
35. A saída não foi reescrever a desculpa: subir a SETA é o que não dá (ela é metade da altura do
campo, e a largura é a trava do `[micro]` de 14px), então **subiu o campo** — 2px — e a frase ficou
de pé. Cada seta passou de 19,5 para **21px de altura sobre um alvo primário que agora É de 44**.

### ⚠ [A11Y-02] — FALSO POSITIVO declarado, não corrigido

O item dizia que as setas do stepper não têm "nem texto, nem `aria-label`, nem `aria-hidden`" (20 em
`/`, 4 em `/orcamento`). **Os botões, sozinhos, realmente não têm — o `aria-hidden="true"` está no
`<span class="num-spin">` que os envolve**, e pela especificação isso remove a subárvore inteira da
árvore de acessibilidade. A sonda da varredura leu **elemento a elemento** e não viu o ancestral.

Não foi "corrigido" porque as duas correções possíveis pioram o resultado real:

- **dar `aria-label`** e tirar o `aria-hidden` do pai põe **40 paradas novas** no modo de navegação
  do leitor de tela (2 por campo), justamente o que o comentário do `NumberInput` já recusava — e o
  campo, que aceita ↑↓ e digitação, já é o controle nomeado;
- **repetir `aria-hidden` no botão** é redundância que não muda a árvore.

A régua A11Y-01 do projeto ("botão só-ícone precisa de `aria-label`") vale para botão que **está** na
árvore. Fica registrado que a leitura por elemento vai reacender isso na próxima varredura.

## ✅ Lote D da AUD-13 — offline que grava calado, e o ✕ pequeno demais (2026-08-24)

> Dois itens, nenhum tocando lógica de negócio, verificados na mesma sessão de navegador — que é
> exatamente o critério com que o lote foi montado. Ambos com medição antes/depois.

### [TD-029] — três caminhos de escrita sem `guardOnline`

O `[TD-020]` fechou máquinas e taxas em 2026-08-22 e o padrão ficou escrito: **a checagem vem ANTES
de qualquer `await`**, porque offline o Firestore enfileira a escrita e a Promise **nem resolve nem
rejeita** — quem espera o resultado espera para sempre. Três caminhos ficaram de fora.

O conserto não é um molde só; é **um molde por chamador**, e essa é a parte que não dá para copiar:

| caminho | molde | por quê |
|---|---|---|
| `useBusinessSettings.saveFixedCostRate` | expõe `error`, **não lança** (igual `saveFees`) | é chamado **a cada tecla** e ninguém espera o resultado — um `throw` viraria unhandled rejection por dígito |
| `useQuoteConfig.saveBusiness` | **devolve** a mensagem (igual `saveMachines`) | os 4 campos gravam no `onBlur` com `void`; quem reporta é a página, que já tem `FeedbackNote` |
| `useQuotes.addQuote` / `deleteQuote` | **lançam** | os dois chamadores já esperam dentro de um `try` que reporta — guarda que não lança aqui seria trabalho a mais para o mesmo efeito |

Dois detalhes de implementação que valem registro:

- **`saveFixedCostRate` recebe um PATCH**, e o merge acontecia **dentro do updater de estado**
  (`setFixedCostRate((cur) => { void persist({...cur, ...patch}); return next; })`). Gravar de dentro
  do updater é efeito colateral em função que o React pode chamar duas vezes. O merge saiu para um
  `useRef` que espelha o valor corrente.
- **A semeadura (`:38`)** também ganhou o guarda, com uma diferença: se ela **não** gravou, o
  `seededRef` volta a `false`. Marcar "semeado" sem ter semeado faria o app tratar como existente um
  doc compartilhado que não existe.

O `reserveQuoteNumber` estava na lista do item, mas **já estava guardado** — por uma 5ª cópia inline
do `navigator.onLine` na `QuotePage`, com frase própria e **legítima** (lá o motivo é outro: o
número precisa ser reservado no servidor). O que sobrou dela foi dedupe: `errors.ts` passou a
exportar `isOffline()` + `OFFLINE_MESSAGE`, e as cópias da `QuotePage` e do `SaleModal` (que repetia
a frase caractere a caractere) passaram a usá-los.

#### ⚠ A repro escrita no item mirava o campo ERRADO

O item dizia, com número: *"mudar Dias de impressão/mês 26→27 na calculadora — que é
`config/negocio` — muda na tela, 0 avisos"*. Reproduzido: aquele campo é o do **`CapacityPanel`**, e
ele é **simulação local por desenho** (TD-010) — não persiste, não muda preço, e a própria tela
anuncia *"Simulando — os valores salvos do negócio (custos fixos) não mudaram"* assim que se mexe
nele. Zero avisos ali é o comportamento **correto**.

O defeito era real e estava a um painel de distância: quem grava `config/negocio` são os cinco
campos do **`FixedCostsPanel`** (Aluguel, Outros, Máquinas operando, Horas/dia, Dias/mês). Fica a
lição, que é a mesma do ciclo fechado que a AUD-13 existe para quebrar: **defeito lido no código +
repro medida na tela podem apontar para lugares diferentes** — e foi só porque a repro foi refeita
que o painel certo apareceu. O `FixedCostsPanel` ganhou a linha `.form-error` (`role="alert"`),
onde a falha aparece.

**Medido ao vivo** (dev server, `navigator.onLine` forçado a `false`):

| ação, offline | antes | depois |
|---|---|---|
| Aluguel 1500 → 1501 (`/`) | valor novo na tela, **0 avisos**, badge "Sincronizado" | frase do offline no painel; valor local segue (não se desfaz o que o dono digitou) |
| sair do campo Telefone (`/orcamento`) | nada | "Dados do negócio não foram salvos: …" |
| "Excluir orçamento" nº 0001 | `await` pendente para sempre, **sem aviso** | erro nomeando o nº, e **21 → 21** orçamentos |

De volta online, os três gravam em silêncio e o aviso do painel se apaga sozinho (`setError(null)`
no sucesso). O aviso do excluir saía com **".."** — a frase do `guardOnline` termina em ponto e o
template acrescentava outro; o ponto do template saiu.

### [UX-49] — o ✕ dos nove modais

`.modal-close` é classe própria e ficou de fora quando o UX-46 levou o `.icon-button` a 44px no
celular. No `@media (max-width: 760px)` ele vai a **44×44** com
`margin: calc(-1 * var(--space-6))` — os 12px de crescimento voltam ao fluxo, receita do
UX-28/UX-37.

⚠ **`padding` sozinho não cresceria nada aqui**: o `box-sizing` é `border-box` (base.css) e a classe
fixa `width`/`height`. Quem cresce é a caixa; a margem negativa de metade da diferença é que devolve
o espaço.

**Medido a 375px, no mesmo diálogo, antes e depois:**

| | antes | depois |
|---|---|---|
| `.modal-close` | 32×32 | **44×44**, `margin: -6px` |
| altura do `.modal-head` | 84px | **84px** |
| título e ✕, relativos ao topo do cabeçalho | 24px / 40px | **24px / 40px** |
| desktop (1280px) | 32×32 | **32×32**, margem 0 |

O teste que prova o **alvo**, e não só o número: `elementFromPoint` a 3px do canto superior-direito
da caixa nova — ponto que está **fora** dos 32×32 antigos — devolve `BUTTON.modal-close`, e o clique
ali fecha o diálogo.

⚠ **A armadilha do lote não foi a cascata** (a ordem estava certa: `responsive.css` é importado
depois do `modal.css`, e media query não muda especificidade). Foi o **CSS servido em cache**: a
regra estava no arquivo baixado — conferida por `fetch` no próprio navegador — e o `getComputedStyle`
continuava dizendo 32px. Só depois de recarregar a página o 44 apareceu. Fica o registro: **medição
de CSS em dev vale depois do reload**, não no HMR.

`lint` ✅ · `build` ✅ · **711/711** ✅ (nenhum teste novo: o lote inteiro é fiação de UI e CSS —
o projeto não tem harness de componente, e a prova é a medição ao vivo acima, como no TD-020).

## ✅ TD-028 (lote C da AUD-13) — excluir produção vendida virou uma RECUSA (2026-08-24)

> O lote A **abriu** este caminho: enquanto o `[TD-026]` impedia excluir qualquer produção que
> tivesse creditado acabado, o defeito ficava mascarado. Consertado o TD-026, ele passou a ser
> alcançável por um clique.

### O buraco: o estorno que devolvia zero e não reclamava

`finishedForRemove` chamava `removeEventLayers` sem perguntar se alguma camada daquele evento já
tinha sido drenada por venda. A camada sumia; a venda continuava guardando o `FinishedMove` com o
`layerId`; e no estorno o `shiftLayers` procurava esse id, **não achava e devolvia o doc intacto** —
sem erro, sem aviso, sem número errado visível em lugar nenhum. Medido no harness: produzir 10 un a
R$ 100 → vender 4 (saldo 6, valor 60) → excluir a produção (0 camadas, valor 0) → estornar o recibo
→ **0 un devolvidas**, quando deveriam voltar 4 un / R$ 40.

De quebra, o comentário do próprio `removeEventLayers` afirmava que manter a SKU vazia servia para
que *"o custo já vendido não some do rastro"*. Medido: some (valor 60 → 0). Mesma classe de
armadilha que o `[TD-023]` levantou do outro lado do arquivo — comentário que promete garantia que o
código não dá.

### A decisão: BARRAR, não preservar (dono, 2026-08-24)

Havia duas saídas. **(b) preservar** a camada drenada e remover só o saldo não vendido faria o
comentário virar verdade, mas cria um estado que não se explica: estornar o recibo depois devolve a
peça à prateleira **sem produção nenhuma por trás dela**. **(a) barrar** é a disciplina que o
`/estoque` já usa para excluir cor (`filamentReferences`): excluir só é liberado quando ninguém
referencia mais. O dono martelou (a). O ganho não é só o custo menor — é que o estado ambíguo
**nunca nasce**.

### O que entrou

- **`finishedEventReferences(good, eventId, sales)`** (`finishedGoods.ts`) — espelho exato do
  `filamentReferences`. Lê os ids de camada DAQUELE evento **do doc** (não derivados à mão: id
  derivado erraria a cor), soma os moves de cada recibo que apontam para eles e **agrupa por
  RECIBO**, não por venda — um recibo tem vários itens, e é o recibo que a `/vendas` mostra e que o
  dono precisa apagar. Ordenado do mais recente para o mais antigo, como o histórico.
- **`ProductionPage`** passou a ler `useSales` (leitura pura; quem mexe em venda é a `/vendas`) e o
  `remove` recusa antes do diálogo, nomeando quem segura: *"1 peça desta produção já foi vendida
  (recibo 24/08/2026 · sem cliente)"*.
- **`shiftLayers` deixou de ser mudo.** Move deste produto cujo `layerId` não existe mais agora
  **lança**. Com o guarda no lugar esse estado não nasce pela UI — e é exatamente por isso que
  chegar lá significa doc corrompido, não "não havia o que fazer".
  ⚠ Entrou junto a troca de `!delta` por `delta === undefined`: delta 0 (moves que se anulam) é
  camada **ACHADA**, e o `!delta` a acusaria de órfã.

**14 testes novos.** Revertido só o `shiftLayers`, os **3** do cenário medido falham (os outros 11
cobrem a função nova, que não existia). `lint` ✅ · `build` ✅ · **711/711** ✅.

### A prova ao vivo — e a limpeza `ZZ AUDIT` de carona

Era o **único item da AUD-13 sem prova na UI**. O cenário já estava armado no banco real: a venda de
R$ 18,41 drenava a camada da produção `ZZ AUDIT sonda D1`. Ida e volta inteira, nesta ordem:

1. Excluir `sonda D1` → **RECUSOU**, nomeando o recibo. Sem diálogo, produção intacta.
2. Excluir `sonda REV` (não vendida) → diálogo normal, excluída, **Laranja 1353 → 1363 g** (os 10 g).
   O guarda não bloqueia demais.
3. Excluir a venda → estorno ao centavo (48→47, −18,41 receita, −11,69 custo, −6,72 lucro). O
   `shiftLayers` **achou** a camada — porque o guarda impediu que ela fosse apagada. É o buraco.
4. Excluir `sonda D1` de novo → **LIBEROU**. Laranja 1363 → **1403 g**, os 50 g previstos.

Os 2 produtos saíram do catálogo (99 → 97) e com eles o erro de chave React duplicada
(`sub:4I1pyH6F9fcWV2OpJpq9:sub_1`) que era **dado** legado do `[CSV-32]`, não código. Sobraram só os
**2 docs de `acabados`** (saldo 0, invisíveis): é o `[TD-030]` — não há caminho de UI, e o
`deleteGood` é código morto.

## ✅ Lote B da AUD-13 — o que entrava calado na carga (2026-08-24)

> Três itens, um tema: **dado que entra errado sem ninguém contar**. O `[CSV-32]` era o furo de
> verdade (dinheiro medido), o `[TD-027]` é o cano por onde ele escoava, e o `[UX-48]` é o oposto —
> um aviso que gritava onde não havia problema, e que por isso ensinaria o dono a ignorar avisos.

### [CSV-32] — `sub_<índice>` como fallback é uma colisão esperando o acidente

O `parseSubitems` batizava o subitem sem id de `sub_<posição>`. Basta a planilha **misturar** um id
explícito `sub_1` (em qualquer posição) com um subitem **sem** id na posição 1 e os dois saem daqui
com o mesmo id. Ninguém precisa repetir id de propósito — é o acidente clássico de arquivo gerado
fora, e a carga em massa é exatamente isso.

E ele passa por tudo: `validateProduct` aprova, o preço fica **certo**, o diálogo da importação
mostra **0 avisos**. O dano só se materializa dois passos adiante, no acabado, porque a `skuKey` é
*subitem × cor* e as duas partes colidem na MESMA chave. Medido ao vivo: produção de custo
**R$ 15,75** creditou **R$ 11,69** — **R$ 4,06 (25,8%)** sumiram, e a SKU "Tampa" nunca existiu. O
seletor da `/producao` ainda listava duas opções com o mesmo `value` (escolher "Tampa" produzia
"Corpo") e o de acabados oferecia a mesma peça física três vezes.

O conserto tem **duas metades**, como no CSV-23, e elas respondem a perguntas diferentes:

- **Reconhecer** — o fallback varre os ids explícitos da lista **inteira** antes de gerar qualquer
  `sub_<n>`, e só usa número livre. Isso mata o acidente **sem aviso**, de propósito: não há nada
  que o dono precise corrigir na planilha, e avisar aqui seria a mesma poluição do UX-48.
- **Avisar** — id explícito **repetido** é outra coisa: é o arquivo dizendo algo impossível. O
  segundo subitem recebe um id livre (a peça não some, que é o defeito original) e a classe nova
  `subitem-id-repetido` **nomeia os dois**, dizendo também que o acessório atribuído àquele id ficou
  com o PRIMEIRO — a consequência que o dono não teria como deduzir.

⚠ O id do **formulário** (`sub_<timestamp>_<i>`, no `usePricingForm`) nunca colidiu. O defeito era
só do parser, e a checagem disso é o motivo de o conserto não ter ido para o payload.

### [TD-027] — um `continue` respondendo a duas perguntas

O `[TD-023]` fechou a idempotência do `addProductionLayers` com
`if (existing.layers.some((l) => l.id === layer.id)) continue;`. A `layerId` é *evento + SKU*, e
esse `continue` não distingue **"reaplicaram o mesmo evento"** de **"esta chamada trouxe duas
entradas para a mesma SKU"**. A segunda é descartada em silêncio, com a fatia de custo dela — 2
entries de 2 un a R$ 30 davam saldo **2** e valor **R$ 60**, quando a submissão custou R$ 120.

São duas perguntas, e agora têm duas respostas:

- **"já apliquei este evento?"** se decide **uma vez por chamada**, contra o doc que CHEGOU (SKU com
  camada carregando aquele `sourceEventId` é replay e se ignora inteira). Decidir isso dentro do
  laço era o erro: as camadas que a própria chamada acabou de criar contaminavam a resposta.
- **"a chamada trouxe a SKU duas vezes?"** → **soma**. `qty` acumula na mesma camada e o `unitCost`
  vira a **média ponderada**, de modo que `qty × unitCost` continua sendo o custo submetido.

Uma camada só, com o id determinístico intacto — duplicá-lo quebraria `removeEventLayers` e
`shiftLayers`, que procuram camada por id. O `costBreakdown` funde pelo mesmo fator (`sumFrozen ===
unitCost` sai de graça, a disciplina do FEAT-06) e **só sobrevive se todas as entradas o trouxerem**:
meia composição mentiria sobre o total que ela deveria somar.

Fechado o CSV-32, este caminho vira **latente** — e é justamente por isso que ele foi no mesmo
commit. Consertar só o parser deixaria a bomba armada no `finishedGoods`, e um `continue` que
descarta dado sem contar não é garantia: é a mesma armadilha que o próprio TD-023 levantou.

### [UX-48] — o aviso que gritava na planilha certa

O `machineNameToId` casava por NOME exato e, falhando, chutava por substring (com aviso, desde o
CSV-24). Só que o valor **mais preciso** que a planilha pode trazer é o **id** da máquina — e ele
caía no chute. Medido: `A1`, `a1`, `x2d`, `X2D`, `A1  Combo` e `combo a1` **todos avisavam**, todos
resolvendo certo. Em escala: **100 linhas com `Maquina = A1` → 100 avisos**. O dono lê que 100% das
linhas "foram adivinhadas" e ou desiste da carga ou aprende a ignorar o aviso — que é exatamente o
defeito que o lote C da AUD-12 inteiro existiu para evitar.

Agora o **id exato** casa primeiro e devolve sem chamar o `onFuzzy` (id inteiro é identidade, não
palpite), e a comparação de nome colapsa espaços nos dois lados (`A1  Combo` é o mesmo nome, não um
nome errado). O palpite de verdade — id **dentro** de um nome maior, `AnyCubic A1 Mini` — continua
se anunciando, porque ali ele pode estar errado.

### Verificação

**20 testes novos** (677 → **697**), e a prova é a reversão: com os dois arquivos de código voltados
ao estado anterior, **14 dos 20 falham**. Os 6 que passam são os contrapontos deliberados — replay
do mesmo evento segue inerte, SKUs distintas seguem em camadas distintas, lista sem id nenhum segue
com `sub_0, sub_1…`, palpite de substring segue avisando —, e é obrigatório que passem: o conserto
não podia ser "parar de conferir" nem "parar de avisar".

`lint` ✅ · `build` ✅ · **697/697** ✅.

## ✅ TD-026 (lote A da AUD-13) — a produção destravou (2026-08-24)

> **Regressão do próprio `[TD-022]`, de um dia antes.** A trava de concorrência entrou certa; o que
> faltou foi o `rev` chegar até ela por dois dos três caminhos. Resultado na prática: cada produto
> podia ser produzido para o estoque **uma única vez**, e nenhuma produção que tivesse creditado
> acabado podia ser excluída — com uma mensagem de erro que **mentia** sobre a causa.

### O mecanismo, em uma frase

A transação confere `finished.payload.rev ?? 0` contra o `rev` que está no banco. Os dois
construtores desse payload — `addProductionLayers` e o `finishedForRemove` da `ProductionPage` —
montavam um objeto **novo**, campo a campo, e nenhum dos dois copiava o `rev`. Logo a versão
esperada era **sempre 0**, e 0 só é verdade antes da primeira produção. A venda escapava por acaso:
o `applyFinishedConsumption` faz `{...good}` e o `rev` pegava carona.

É a **FORM-01 aplicada a metadado de documento** — a mesma classe do `supplyId` que sumia sem mover
um centavo. E, como lá, o preço não era canário: o payload tinha as camadas certas, o custo certo e
o saldo certo. O que faltava não aparecia em número nenhum na tela.

### O conserto — um construtor, não dois remendos

Havia **três** lugares montando `FinishedGoodPayload` a partir de um `FinishedGood`, e um deles (o
`toPayload` do `saleReconciliation`) já estava certo, com o comentário explicando exatamente por quê
— o que só provou que corrigir os outros dois na mão recriaria o problema na quarta vez. Então os
três passaram a chamar **`finishedGoodToPayload`** (exportada do `finishedGoods.ts`), e o
`addProductionLayers` ganhou `rev: good?.rev` no doc que devolve.

⚠ O `rev` **não vai para o documento**: o `finishedGoodToDocument` o ignora de propósito e quem
escreve o número novo é a transação. Ele viaja no payload só para dizer **contra qual versão este
plano foi calculado**.

### O teste — e por que ele NÃO é unitário

A AUD-13 avisou que aqui estava o risco real ("baixo no código, **alto se o teste for unitário**"),
e a medição confirma: um teste sobre `addProductionLayers` sozinho **passa com o bug dentro**. O
defeito só existe no CICLO — gravar, o banco incrementar o `rev`, RELER, e planejar a gravação
seguinte sobre o doc relido.

`src/lib/firebase/productionRevRoundTrip.test.ts` monta esse ciclo: um Firestore de mentira em
memória (as escritas ficam **em espera** até o corpo da transação terminar sem lançar, para que
"nada foi gravado" seja verificável) e, por cima dele, o repositório de **verdade**
(`saveProduction`/`removeProduction` com o `lerEConferirRevs` real) e os serializadores de verdade
nos **dois** sentidos — o `toFinishedGood` e o `toStockFilament` foram exportados para fechar o
round-trip. O que é falso é só o SDK.

Cinco casos: 2ª produção · 3ª produção · "Excluir e estornar" das duas, com a cor voltando **1403 → 1323 →
1363 → 1403 g** · produzir depois de excluir tudo · e o contraponto obrigatório — **plano calculado
sobre versão velha continua sendo RECUSADO**, sem evento, sem camada e sem baixa. Revertendo o
conserto, os 4 primeiros falham com a frase literal de produção (*"As peças prontas de … mudou
enquanto esta tela estava aberta"*) e o 5º segue passando: o conserto não foi "parar de conferir".

`lint` ✅ · `build` ✅ · **677/677** (672 + 5).

### O que ficou de fora

O `[TD-028]` — excluir uma produção **já vendida** apaga a camada e o estorno do recibo devolve
nada. Ele estava **mascarado** por este item (nenhuma produção com acabado era excluível) e agora
está **aberto**: é o lote C, e é a primeira coisa a rodar contra o banco. As 2 sondas `ZZ AUDIT`
podem ser limpas pela UI agora — nenhuma delas foi vendida, então não passam por esse caminho.

## ✅ TD-022 — duas gravações simultâneas deixaram de se apagar (2026-08-23)

> Único item da AUD-12 que estava marcado como *"mecanismo lido no código, NÃO reproduzido"*. O dono
> autorizou **escrita real no Firestore de produção** para reproduzir **e corrigir**.

### A reprodução (produtos), com a sonda

Sonda `__SONDA_TD022__` criada pela calculadora (catálogo 97 → 98), aberta em duas abas:

```
aba A: peso 40 -> 99          aba B: mão de obra 10 -> 55
B salva primeiro, A depois
documento final: peso 99, mão de obra 10      <- os 55 de B, apagados
```

**O detalhe que explica por que ninguém percebe:** medi o formulário de A no instante do salvar, e
ele ainda exibia `mão de obra: 10`. A assinatura em tempo real atualiza a **lista**; a cópia que o
formulário está editando, não. As duas abas mostram a mesma tela, e uma delas está mentindo.

A causa é `updateDoc(ref, {...payload})` — o **documento inteiro**, montado a partir dessa cópia.

### O que a correção NÃO é

**Não é merge campo a campo.** Era a saída tentadora (A mexeu no peso, B na mão de obra: dá para
salvar os dois). Foi descartada porque juntar duas edições cegamente produz um produto que **nenhuma
das duas abas quis** — e no caminho do estoque seria pior: o FIFO pode ter atravessado outro rolo, e
o custo congelado da venda sairia de um rolo que não é o que saiu da prateleira.

A saída é a doutrina que o resto do projeto já segue (*"a importação AVISA, não engole"*, *"o palpite
que não se anuncia"*): **contador de versão conferido dentro de uma transação, e recusa quando não
bate.** O `runTransaction` do Firestore relê o documento e reexecuta o callback se ele mudar no meio,
então ou a versão bate e a escrita entra, ou ela não bate e nada é gravado.

**Medido depois, mesmo roteiro:** a gravação da aba velha é recusada, o formulário fica **intacto**
(nada se perde) e o documento mantém os 77min da aba que salvou primeiro.

### A segunda metade: estoque, insumos e acabados

`writeBatch` é **atômico, mas não isolado** — ele não relê nada. As baixas são calculadas no cliente
sobre o saldo que a assinatura entregou e gravadas como o array `rolls`/`lots`/`skus` **inteiro**.
Duas vendas simultâneas da mesma cor leem o mesmo saldo, calculam o mesmo resultado e gravam o mesmo
array: **uma das baixas não aconteceu**, e o furo só aparece quando alguém pesa o rolo.
(O overdraft de −370 g na Bege, registrado sem origem conhecida, tem exatamente esse formato.)

`reconcileRecibo`, `saveProduction` e `removeProduction` viraram `runTransaction` com a conferência
no `revGuard.ts` — **um lugar só**, porque a mesma checagem escrita três vezes é a receita de
divergirem (foi assim que o UX-42 nasceu, com duas implementações que PRECISAVAM concordar).

⚠ **O furo que quase passou:** o guarda seria **inútil** se a tela do `/estoque` continuasse gravando
sem mexer no `rev`. Um plano de venda calculado sobre o saldo velho atravessaria a conferência como
se nada tivesse mudado. **Todo escritor do documento incrementa, ou o contador não conta nada** —
por isso `saveStockFilament` e `saveSupply` entraram na mesma transação.

### Como provei a recusa no estoque, já que a UI não fica desatualizada

Primeira tentativa: abrir o diálogo "Ajustar" numa aba, gravar na outra, confirmar. **Não reproduziu
— e isso é um elogio ao app:** o `adjustFor` é derivado da lista viva a cada render
(`byId(adjustForId)`), então a aba 2 já tinha a versão nova. A janela de desatualização por esse
caminho não existe.

O que reproduz é a **simultaneidade de verdade**, e ela é encenável de forma determinística: dois
cliques no **mesmo tick** do React. Os dois handlers usam o MESMO objeto `color` da renderização
corrente, logo a mesma versão esperada. Medido em produção, na cor Laranja: a primeira gravação
entrou, a segunda foi recusada com a frase certa.

⚠ **Um erro de concordância saiu na primeira medição** (`"O estoque de a cor \"Laranja\""`): o
template prefixava "O estoque de" e quem chama já passava o artigo. O `nome` passou a vir com artigo
e maiúscula inicial, porque ele **abre** a frase.

### Estado do banco depois de tudo

Catálogo **97/97**; estoque **1,65 kg** (Bege 243 g, Laranja 1403 g), nenhuma cor arquivada — os
números exatos de antes. **Resíduo declarado:** a Laranja carrega **2 lançamentos de ajuste** no
rastro D6 (403 → 400 e 400 → 403, anotados como sonda). O rastro é append-only de propósito (é a
prova do tamanho do furo, D6) e não se apaga — o saldo, esse, voltou exato.

### O que ficou de fora

Documento sem o campo `rev` vale 0 e a primeira gravação o cria: **nada a migrar** (Diretriz 7).
Não exercitei duas vendas reais concorrendo pela mesma cor (exigiria encenar a corrida com duas
submissões de venda no mesmo instante); o que está provado é a **regra** (7 testes do `revGuard`), o
**mecanismo ponta a ponta em produção** (produtos e estoque) e que **toda escrita incrementa**.

## ✅ Lote D da AUD-09 — os 3 últimos consertos antes da carga (2026-08-23)

> Fecha o cluster de código da AUD-09. Dois itens vieram do backlog ([CSV-16] e [CSV-21]) e o
> terceiro ([CSV-22]) **nasceu de uma pergunta do dono no chat**, não de varredura.
> `lint` ✅ · `build` ✅ · **571/571** ✅ (+20 testes).

### [CSV-16] — o cabeçalho DIZ a unidade, e ninguém estava lendo

O item estava classificado como *"modelo/doc, não código"*, com o argumento: **o parser não tem
como saber que "Tempo (min)" é minuto.** O argumento é falso — o cabeçalho literalmente nomeia a
unidade. O que existia era um needle `"tempo"` casando por `includes`, então `Tempo (min)` era
reclamada pela coluna de HORAS e 120 minutos entravam como **120 horas**, 60× errado e calado.

**O que reabriu:** o dono observou que o formulário já aceita horas **e** minutos, e que hora
decimal ali já se ajusta sozinha (`PrintTimeField` + `splitPrintTime`, `ProductForm.tsx` — o
BUG-01). Se a tela aceita, a planilha também deveria. E o motivo prático é mais forte: quem vai
**gerar** a planilha é um sistema externo que lê os dados da impressão — e impressora/fatiador
reportam o tempo em **minutos**.

**Duas travas, porque uma não cobre o espaço todo:**
1. Coluna própria `timeMinutes`, needle `"tempo (min"` — 10 caracteres contra os 5 de `"tempo"`,
   então a **ordenação por comprimento que o CSV-10 criou** já garante que ela reclama o cabeçalho
   primeiro. Não precisou de mecanismo novo. O needle vai **sem o parêntese de fechar** de
   propósito: pega `Tempo (min)`, `Tempo (min.)` e `Tempo (minutos)` de uma vez.
2. `headerEmMinutos`, pro cabeçalho que o needle **não** pega — `"Tempo de impressao (min)"` não
   contém `"tempo (min"`. Quando só a coluna de horas casou, o texto dela ainda pode dizer minuto,
   e aí o valor é reinterpretado. A guarda é apertada por construção: só inspeciona o cabeçalho que
   a coluna de tempo de fato reclamou, e esse cabeçalho contém `"tempo"`.

⚠ **A armadilha da regex:** `\bmin(utos?)?\b` e **não** `includes("min")`. "Tempo mínimo" normaliza
para "tempo minimo", que contém "min" e não é coluna de minutos. Word boundary resolve: `minimo`
continua com `i` depois de `min`, então não casa.

**A soma é a mesma conta do formulário:** `h + min / 60`. Com as duas colunas presentes cada uma
está na sua unidade e elas somam; hora decimal continua valendo, que é o que o export escreve e o
que o round-trip depende.

### [CSV-21] — `linhas` contava ocorrência

`addIssue` fazia `found.linhas += 1` por chamada. O campo se chama `linhas`, a tela escreve
"linhas", e uma única linha com 3 células ruins da mesma classe era reportada como **"3 linhas"**.

**Por que importa mais do que parece:** é esse número que o dono usa pra decidir se confirma a
carga ou volta pro Excel. "12 linhas com problema" em 100 é uma coisa; 4 linhas com 3 erros cada é
outra bem diferente.

Conserto: um `Set` de classes já contadas na linha corrente, zerado no topo de cada volta do laço.
Coube porque **todas** as chamadas de `addIssue` acontecem dentro do `flatMap` das linhas —
inclusive as que vêm dos parsers de JSON, via closure criada por linha.

⚠ **Os exemplos seguem por OCORRÊNCIA (até 3), de propósito.** Numa linha só eles nomeiam campos
diferentes (`Tempo (h)`, `Pecas`, `Valor-hora`), que é justamente a informação acionável. Isso faz
`exemplos.length` poder ser **maior** que `linhas` — conferi o render (`ProductCatalog.tsx`): o
"e mais N…" é guardado por `linhas > exemplos.length`, então não vira texto errado.

### [CSV-22] — o id certo é o erro que sobrou

**Veio de uma pergunta do dono:** *"usar o id aleatório do Firestore pode dar problema, ou é
indiferente?"*. A resposta honesta é **quase indiferente** — auto-id dá unicidade de graça (um slug
`laranja` colidiria entre PLA Voolt e PETG Creality), distribui escrita melhor, é o que o resto do
app já usa, e o histórico não depende dele (a D7 congela `colorName`/`material`/`brand` na venda).

Mas a pergunta expôs **um buraco real**: a importação só verifica se o `filamentId` **existe**. Um
id **errado mas existente** — paste deslocado, `PROCV` mal ancorado na planilha — amarra o produto
na cor errada e **nada acende**. E como o id é opaco (`4MKTY5K6OGldKp0zDZNB`), não dá pra revisar a
olho lendo o CSV, que é como se pegaria um slug trocado.

**A saída usa o dado que já está lá:** o `colorName` vai na MESMA célula JSON, ao lado do id (o
export escreve os dois). Divergiu, alguma das duas células está errada — e não dá pra saber qual,
então o parser **não escolhe**: o id continua valendo (é ele que liga ao Estoque) e o aviso
`cor-nome-divergente` mostra as duas versões. Mesma disciplina do TD-009: sinalizar, não mascarar.

⚠ **Não vale pros insumos.** O acessório carrega `desc` — texto livre ("ima"), não o nome do
insumo. Cruzar `desc` com `Supply.name` daria falso positivo em série.

### O que a discussão decidiu fora do código

- **A planilha-modelo NÃO vira botão no app.** Cheguei a propor um gerador (lendo `stock`/`supplies`
  no clique, pra não envelhecer), mas quem vai gerar a planilha de importação é um **sistema externo
  do dono**, alimentado pelos dados das impressões. O modelo é um **contrato escrito uma vez**, não
  um arquivo que se reemite — vira spec escrita no chat depois do cadastro das cores.
- **Resolver a cor por NOME na importação foi proposto e recusado** (dono, 2026-08-23): ele prefere
  cadastrar as cores, pegar os ids e passá-los ao sistema externo. Fica registrado como alternativa
  descartada, não como item aberto.
- **O `filamentId` não aparece em lugar nenhum da UI** — medido: nada na `/estoque` renderiza ou
  copia o id, e o export do catálogo só revela id de cor **já usada** por algum produto. O caminho é
  o console do Firebase. Ofereci um "copiar id" no card da cor; o dono não pediu.

## ✅ De-para nome → id no `/estoque` (2026-08-23)

> Botão **"Copiar de-para"** nas abas Filamentos e Insumos. Nasceu de uma pergunta do dono
> (*"e como tá a questão de copiar o id pra fazer a tabela?"*) depois de ele **recusar** o botão de
> planilha-modelo — a diferença que justificou este é que o de-para é **dado que só o app tem** e
> que muda a cada cor cadastrada, enquanto o modelo era um contrato escrito uma vez.

**O problema:** `filamentId` e `supplyId` são auto-ids do Firestore (`addDoc`) e **não aparecem em
lugar nenhum da UI** — medido: nada na `/estoque` renderiza ou copia o id, e o export do catálogo
só revela id de cor **já usada** por algum produto. O único caminho era o console do Firebase,
documento por documento.

**A forma:** eu tinha oferecido um "copiar id" por cor; o dono quer montar **a tabela**, e 20 cópias
avulsas é o caminho chato. Um botão só, que entrega a tabela inteira em **TSV** — colado no
Sheets/Excel já cai em colunas, que é onde ela vai virar `PROCV`.

`colorIdTable` / `supplyIdTable` em `lib/idTable.ts`, puras, 7 testes. Três decisões travadas:

- **`material` e `brand` vão junto do nome.** `colorName` sozinho REPETE — "Laranja" existe em PLA
  Bambu e em PETG Voolt — e um de-para cego amarraria na cor errada. É o mesmo risco que o CSV-22
  passou a apontar do outro lado (na importação).
- **Arquivada entra MARCADA, não sumida.** Ela continua tendo id e podendo ser referenciada.
- **TAB e quebra de linha no nome viram espaço.** Os dois quebrariam a colagem em colunas.

O `copyText` (`src/lib/clipboard.ts`) falha **explícito** quando o navegador não expõe a API:
copiar para lugar nenhum em silêncio é pior do que dizer que não deu.

### O que a verificação no navegador pegou (e o teste não pegaria)

Rodei no site logado, contra o Firestore de produção (só leitura). O clipboard funcionou nas duas
abas — capturei o argumento do `writeText` para provar o conteúdo, porque `readText` é bloqueado:

```
Cor       Material  Marca   Arquivada  id
Laranja   PLA       Bambu   nao        US6B9aheebWtn9NMXhUQ
Bege      PLA       Bambu   nao        sc9LAy9TUcbslnZpEZLb
```

⚠ **Dois defeitos de layout que só apareceram medindo, e que o CSS antigo escondia porque a barra
sempre teve UM botão:**

1. `.stock-bar` era `justify-content: space-between`. Com um filho, isso é "encostado à esquerda";
   com **dois**, joga um em cada ponta da largura toda, e as duas ações deixam de parecer o mesmo
   grupo. Virou `flex-start` — resultado idêntico no caso de um botão só.
2. No celular a barra empilha (`flex-direction: column`) e a regra de largura cheia era
   `.stock-bar .btn.primary`. O botão novo é `.btn` sem `primary`: ficava com 152px de largura
   natural embaixo de um de 347px, torto. A regra passou a valer para os dois.

**Medido depois do conserto:** 375px → os dois com 347px, empilhados, `scrollWidth` = 375 (sem
transbordo lateral); 671px → lado a lado em x=14 e x=166, gap de 16.

## Regras de CSS/UI — as armadilhas medidas

> Os *porquês* das regras resumidas no `CLAUDE.md` ("Pontos-chave"). Cada uma custou uma medição.

- **Cor:** ao escolher/alterar um tom, meça no DOM o **pior fundo real** — o tingimento a 10% come
  ~0,3 de contraste — e **mate `transition` antes de ler**, senão a medida pega a cor no meio da
  troca de tema.
- **Grade:** ao sobrescrever `grid-template-columns` numa media query, **reescreva a guarda
  `minmax(0, 1fr)` junto** — ela não é herdada. Idem para compensação calibrada sobre token (o
  `padding` do `<input type="date">`, UX-22): token que muda por faixa exige compensação que muda
  junto. O `1fr` puro foi a causa das 3 quebras da auditoria de 2026-08-17.
- **Fileira → cartão (UX-47):** a fronteira do cartão **se mede, não se copia**. A regra é
  *fileira que NÃO CABE vira cartão* — não *fileira estreita vira cartão*: medido nos dois cortes
  possíveis, a 700px o cartão dava 272px a cada campo de número e triplicava a altura da fileira,
  largura de sobra virando rolagem. E quando uma fileira é exceção a uma régua de alvo, **a exceção
  costuma ter dois pedaços de range com remédios diferentes**: onde não cabe, vira cartão; onde cabe
  mas a trilha é estreita, **alarga-se a trilha**, nunca se encolhe o alvo. Cobrir só um pedaço
  deixa a exceção viva com outro nome.
- **Tabela → cartão:** ao desmontar uma `<table>` em grade, **todo seletor de elemento usa
  combinador de FILHO** (`> tbody`, `> td`) — há tabela dentro de dropdown, e `tbody` solto quebra o
  alinhamento dela. E **`@media` não soma especificidade**: bloco que reescreve regra-base vai
  DEPOIS dela no arquivo.
- **Foco:** campo que apagar o `outline` no `:focus` tem de devolver o anel **no mesmo arquivo** —
  `base.css` é o 1º import e perde o desempate de especificidade.
- **Alvo de toque:** meça a faixa antes de engordar botão em fileira — no desktop o alvo maior pode
  não caber, e 44px é regra do DEDO.
- **Rolagem horizontal** só como válvula (`min-width`), nunca como solução de layout.

## 🔍 AUD-07 — 2ª varredura ponta a ponta, ANTES da carga em massa (2026-08-22)

> Pedido do dono, no mesmo dia da AUD-02: *"houve uma varredura anterior. **Ela não é referência.**
> Achou defeitos, foram corrigidos, e as correções foram testadas **pelo mesmo agente que as
> escreveu** — é exatamente esse o problema que esta segunda passada existe para resolver. Vou
> repetir isso até uma passada não achar nada."* Regras: nada na doc (nem as conclusões da passada
> anterior, nem teste verde do repo) conta como fato; **não alterar código, doc nem git** — achou,
> reporta e para; escrever no Firestore exige perguntar antes.

**O que esta passada teve que a anterior não teve.** A AUD-02 mediu funções puras e leu código, mas
**nunca exercitou o app contra o banco**. Aqui o dono autorizou ~8–12 documentos descartáveis
(prefixo `ZZ AUDIT`), e a varredura **gravou de verdade**: cor com 2 rolos, insumo com 2 lotes,
produto completo, 2 produções, 1 venda, 3 reedições e as exclusões. Tudo apagado no fim pela própria
UI, com o banco conferido campo a campo contra o estado inicial. Também foi a primeira a **abrir o
PDF** — gerado em Node chamando o `generateQuotePdf` real e com o texto extraído do arquivo, o que
evitou gravar em `quotes` só para ver o resultado.

**O que passou — com previsão escrita ANTES e conta à mão depois.**
- **Preço.** O cenário default bateu ao centavo (R$27,14) só depois de descobrir na marra que
  `failureK = f/(1−f)`, não `f`: com 3% a reserva é 0,3744 e não 0,3632 — a diferença de 3 centavos
  no preço foi o que denunciou a fórmula. Produto MÁXIMO (2 cores ligadas, etapa em outra máquina,
  acessório ligado a insumo e atribuído a subitem, 2 subitens com markup próprio, fixo, peças=2):
  os **8 componentes**, o exato (R$98,99) e o final (R$99,80) bateram — e o final revelou que o
  **arredondamento é aplicado por subitem**, não no total (37,90 + 62,90; no total daria 99,90).
- **Estoque.** Catálogo usa o rolo **mais novo** (R$200/kg), FIFO consome o **mais antigo**
  (R$100/kg) — os dois medidos no mesmo produto. Valor parado dos insumos conferido à mão
  (142,50 → 392,50 → 388,50 → 392,50).
- **Produção.** R$30,49 previsto e obtido (15,00 material FIFO + 0,27 + 3,28 + 0,44 + 7,50 + 4,00 de
  insumo), creditando **1 SKU por subitem** na cor certa, com o rateio **7,86 / 7,38** — que só
  fecha porque a divisão usa as proporções de `SubitemPrice.cost` (0,5158/0,4842), não o custo real
  por etapa. Desfecho **falha**: consome e não credita acabado, e a tela **remove a linha** "entra
  no Estoque de Produtos" antes de registrar.
- **Venda e reedição (o que o dono mais queria ver).** Taxas recalculadas à mão: 3,14% à vista →
  lucro 83,36; 6,11% em 3× → 80,33; **repasse** → 108,90 (o gross-up 108,4248 passa pelo
  arredondamento do produto) e lucro 87,00. **Três reedições seguidas** (1→2, 2→1,
  `acabado`→`encomenda`) e a exclusão devolveram **exatamente** o consumido: 1225 g / 140 un na
  encomenda, e 1300 g / 142 un / 2 conjuntos ao excluir. Cesta vazia: "Salvar alterações" fica
  **desabilitado**. Os eventos de produção criados pela encomenda somem junto com o recibo.
- **Round-trip do formulário.** Salvar → abrir → salvar sem tocar em nada: **34 colunas, 0
  diferenças**, com stringify canônico nas 4 células JSON.
- **Transversais.** Tempo real confirmado em duas abas (R$101,80 → R$89,80 sem reload); 375px sem
  estouro horizontal nas **7 rotas**; offline (simulado) trava com aviso e não grava; ANSI avisa;
  100 linhas de CSV parseiam em **16 ms**; suíte **483/483 em 5 execuções** (não é flaky).

**Os 10 defeitos.** Detalhe, causa e correção proposta de cada um no
[`BACKLOG.md`](BACKLOG.md) — cluster AUD-07. O resumo do que importa:

1. **[CSV-06] (bloqueante)** — a AUD-02 consertou a vírgula pt-BR **nas colunas**, e a checagem de
   cor 0 g **num campo**. Mas todo número **dentro** dos JSONs continua em `Number(x) || 0`:
   `printHours`, `laborMinutes`, `pricePerKg`, `qty`, `unitPrice`, `markup` do subitem e os campos
   de detalhe. Medido ponta a ponta, importando de verdade: produto a **R$51,58 em vez de
   R$223,32**, **zero avisos**. Pior: `modelG:"140,0"` com `totalG` correto **escapa** da checagem
   `cor-sem-peso`, porque ela lê o array cru e é o `makeFilament` que depois recalcula o `totalG`
   como soma do detalhe. É a mesma classe de defeito da AUD-02, corrigida em um campo só.
2. **[TD-017]** — `/vendas` e `/orcamento` chamam o `calculatePricing` **sem o `stock`**: o mesmo
   produto vale R$51,58 no catálogo e R$18,47 na venda, no orçamento e no PDF.
3. **[UX-41]** — digitar `143,53` num campo numérico dá **14353** (o `type="number"` descarta a
   vírgula e os dígitos colam). Vale para todo peso/preço/hora do app.
4. **[UX-42]** — o preview da reedição de recibo não estorna o recibo antigo antes de simular, e
   avisa "saldo fica negativo" quando o resultado real é zero.
5. **[TD-018]** — a chave do extrato (evento + rolo) repete quando um evento tem duas baixas do
   mesmo rolo; o React reclama no console em toda renderização do `/estoque`.
6. **[TD-019]** — os KPIs do `/vendas` são buscados no servidor **antes** de a escrita ser
   confirmada; ficam velhos até recarregar.
7. **[UX-43]** — o PDF come o travessão (e as aspas curvas): todo orçamento de subitem sai sem o
   separador que o próprio app monta.
8. **[CSV-07] / [CSV-08]** — a checagem de milhar ambíguo tem falso negativo (`R$ 1.234`) e falso
   positivo (`2.375`, que é o que o export escreve); e o formato en-US (`1,234.56`) entra 1000×
   menor, mudo.
9. **[TD-020]** — máquinas e taxas gravam sem `guardOnline` (fire-and-forget): offline a UI mostra
   o valor novo e a escrita fica enfileirada.

**Veredito.** Dá para apagar o catálogo e carregar ~100 produtos **depois do [CSV-06]** — de
preferência com o [TD-017] junto. O resto do caminho (FIFO, custo congelado, baixa por evento, SKU
por subitem × cor, estorno de reedição, taxas) está sólido e conferido à mão.

**O que ficou no escuro** virou o **[AUD-08]** no `BACKLOG.md` — a lista é o insumo da próxima
passada, e o item mais importante dela é o mesmo de sempre: **quem escreveu a correção não deveria
ser quem a valida**.


## ✅ AUD-02 — varredura da ENTRADA DE DADOS antes da carga em massa (2026-08-22)

> Pedido do dono: *"o import/export foi muito mexido e eu perdi a noção do todo"*. Varredura de
> **tudo que ele toca ao cadastrar** — Estoque → produto → produção → venda → orçamento — com a
> regra de que **nada na doc conta como fato**: só medição própria. Fecha o **AUD-01** de quebra.

**Método.** Teste temporário (apagado) com **diff campo a campo em stringify canônico** (chaves
ordenadas, arrays sensíveis à ordem — o Firestore não preserva ordem de chave em mapa); leitura de
código para as causas; e o **app real em produção**, injetando um CSV escrito à mão no `input[type=
file]` e **cancelando** antes de gravar. Nada foi escrito no Firestore.

**O que passou (medido, não conferido).** Preço de catálogo usa o rolo **mais novo**, custo real usa
**FIFO do mais antigo** — ambos batendo com a conta à mão. Saldo negativo é permitido **e exibido**
(dado real: rolo #1 = −370 g, #5 = 613 g, cabeçalho 243 g). Insumo em unidades: 6 un de lotes
(4@0,40 + 100@0,55) = **R$2,7000** exato. Round-trip do formulário num produto MÁXIMO: **0 campos
perdidos, 0 surgidos, 0 alterados**. Desfecho `falha` consome material e não credita acabado.
100 linhas parseiam em **2 ms** e entram num `writeBatch` **atômico**. E o **AUD-01**: estorno
exato nos DOIS caminhos — `encomenda` (cor + insumo voltam idênticos; 3→2 == vender 2 direto;
3→2→5 sem resíduo) e `acabado` (camada a camada, COGS (2×10+1×14)/3 = R$11,3333, e o overdraft D4
indo a −3 e voltando). 12 de 14 classes de erro de CSV já eram apontadas.

**Os 5 defeitos reais, e o que mudou.**

1. **Cor declarada com 0 g subprecificava ~5× em silêncio** (o pior para a carga). Medido: a mesma
   linha dava R$66,31 com `"totalG":143.53` e **R$13,53** com `"totalG":"143,53"` (vírgula dentro
   do JSON), com `weightG` no lugar de `totalG`, ou sem a chave — `Number` devolve `NaN` → 0. E a
   rede de segurança não pegava: o `validateProduct` só reprova peso zero **junto com** tempo zero
   (`&&`), e toda linha importada tem tempo. Confirmado na UI real: das 6 linhas injetadas, as duas
   com esse defeito **não apareciam** no diálogo. → nova classe `cor-sem-peso`, aplicada à etapa
   principal e a cada etapa extra (lista de cores NÃO-vazia que soma 0 g). Etapa só de mão de obra,
   sem cores, não é apontada.
2. **`R$` e espaço de milhar viravam 0 e 1.** `parseFloat` PARA no primeiro caractere não-numérico:
   `"R$ 118,90"` → **0**, `"1 234,56"` → **1**. Basta uma coluna formatada como moeda no Excel para
   o arquivo inteiro entrar com material zerado. → o `parseNumber` limpa tudo que não é dígito,
   sinal ou separador antes de converter (moeda, espaço comum, U+00A0 e U+202F).
3. **`"1.234"` é ambíguo** — milhar no Excel pt-BR, decimal no export do próprio app. Continua
   **decimal** (senão o round-trip do arquivo do app quebraria) mas deixou de ser calado: classe
   `milhar-ambiguo`, que mostra a leitura escolhida.
4. **Arquivo salvo em ANSI virava mojibake sem um pio.** Medido: `"Coração de Mãe"` →
   `"Cora??o de M?e"`, com `issues=[]` e `warnings=0`. No Excel pt-BR é o **default** — "CSV
   (separado por vírgulas)" grava Windows-1252; só "CSV UTF-8" grava certo. Os bytes já se perderam
   na decodificação (`readAsText(file,"UTF-8")`), então não dá para reinterpretar — dá para **não
   deixar passar**: conta os U+FFFD e manda salvar de novo como CSV UTF-8.
5. **A venda por encomenda não debitava insumo** — e apagar o evento depois **criava estoque do
   nada**. O `reconcileReciboWrite` calculava `supplyUpdates`, o `reconcileRecibo` sabia gravá-lo, o
   tipo o declarava — mas o `SaleModal` montava o `ReciboWrite` **sem o campo**, e como ele era
   **opcional** o TypeScript não dizia nada. Filamento saía, insumo ficava intacto; e o
   `removeProduction` credita os `stockMoves` de volta, devolvendo ao saldo unidades que nunca
   tinham saído. → campo passado, e **`supplyUpdates` virou obrigatório no tipo**: a correção real é
   essa, porque transforma a próxima omissão em erro de compilação. É exatamente a assinatura que o
   AUD-01 previa — *"função que reconstrói um objeto campo a campo e esquece um"*.

**Mais duas coisas.** O **`guardOnline` faltava em 3 caminhos de escrita** (importação de CSV, save
da calculadora, confirmação do recibo) — offline o Firestore enfileira e a Promise **nunca resolve**,
travando o botão para sempre; agora os três barram antes do `await`. E a **suíte era flaky**: o
`parseProductsCsv` carimba `createdAt: Date.now()` e o teste do CSV-02 comparava **dois parses**
pelo JSON inteiro — medido **6 falhas em 10 execuções**, ou seja o "463/463 ✅" não se reproduzia.
Relógio congelado (`vi.setSystemTime`) em vez de tirar `createdAt` do diff, que esconderia
justamente o tipo de campo que o RT-01 existe para vigiar. **8/8** depois.

**Um falso positivo, registrado de propósito.** A auditoria reportou "cor excluída muda o preço sem
aviso" — **errado**: o `filamentMissing` já existe, é populado (`calculatePricing.ts:428`) e vira
badge em três telas. O preço mudar (R$103,52 → R$84,96, caindo no `pricePerKg` salvo) é o fallback
D3 **intencional**, e ele é sinalizado. A conclusão veio de um `grep` estreito, não de olhar a UI —
fica aqui como lembrete de que "não achei" não é "não existe".

**Ids reais das cores no Estoque** (lidos do app em 2026-08-22 — a semente da tabela de-para que o
dono pediu): `PLA · Bege · Bambu` = `sc9LAy9TUcbslnZpEZLb` · `PLA · Laranja · Bambu` =
`US6B9aheebWtn9NMXhUQ`. São eles que vão na chave `filamentId` do JSON de cada linha da planilha.

**No escuro (a auditoria não cobriu).** Nada foi escrito no Firestore, então produção/venda/estorno
foram medidos como **funções puras + leitura de código**, nunca ponta a ponta contra o banco. O
offline é evidência de código (não deu para cortar a rede). **Orçamento/PDF: zero cobertura.**
Taxas de pagamento não foram recalculadas à mão. Tempo real com duas abas, e "editar máquina
recalcula todos", não testados. O ANSI foi **simulado** (decodificação de bytes), não um arquivo de
verdade pelo diálogo.

`lint` ✅ · **483/483** ✅ (eram 463; +20 testes novos) · `build` ✅. O erro de `tsc` em
`calculatePricing.test.ts:205` é **anterior** (verificado no HEAD) e não foi tocado.

## ✅ CSV-02 + CSV-04 + RT-02 — a mecânica do arquivo escrito à mão (2026-08-21)

> O CSV-05 fez a importação **avisar**. Estes três fazem ela **aguentar** — são a mesma frente
> (planilha gerada fora do app) e fecharam juntos, no mesmo dia.

**CSV-02 — a coluna certa em qualquer ordem.** `findColumn` casava só por `includes`, e a PRIMEIRA
vitória vencia: `"filamento"` achava `"Filamentos JSON"` se ela viesse antes de
`"Filamento (R$/kg)"`. Com o export fixando a ordem isso nunca acontecia com o arquivo do próprio
app — mas na planilha da carga a ordem é de quem escreve. Virou `COLUMN_SPECS` (nome exato + pedaço
que ainda reconhece) e `resolveColumns`, em **duas passadas sem reaproveitar coluna**: exato
primeiro (o arquivo do app cai todo aqui), depois o pedaço, pulando o que já foi reclamado. Bônus:
a comparação é **sem acento e sem caixa** — "Preço Sugerido" à mão passou a casar com o "Preco
Sugerido" do export, o que antes falhava calado.

**CSV-04 — quebra de linha dentro da célula.** `parseProductsCsv` fazia `split(/
?
/)` ANTES de
respeitar aspas: um nome com `
` (colado de outro lugar) virava dois produtos-lixo. Entrou
`splitRecords`, que varre o texto e só fecha o registro fora das aspas — o `parseLine` segue
desfazendo o escape. CRLF continua funcionando.

**RT-02 — a identidade da etapa salva sem `id`.** `stageKeyFor` e o export chamam essa etapa de
`stage_${index}`; o formulário inventava `stage_${Date.now()}_${index}` ao ABRIR o produto, e todo
`stageKey` de subitem que apontasse para ela virava órfão no save seguinte — o custo daquela parte
sumia sem mover o preço do produto inteiro. O `buildLoadedProduct` passa a dar a chave **posicional**
para etapa salva sem id. ⚠ **Não é o one-liner que o backlog previa:** mudar o fallback dentro do
`createStage` criaria COLISÃO no formulário (apagar a 1ª de duas etapas e adicionar outra faria o
índice reusar um id vivo) — por isso o posicional vale só no CARREGAMENTO, e etapa nova continua
nascendo com id por timestamp.

**Prova no app real:** o catálogo inteiro exportado e reimportado a seco com as **34 colunas em
ordem invertida** — 97 produtos, os mesmos dois apontamentos do CSV-05 (84 avulsos, 97 nomes
repetidos), nenhum aviso de coluna ignorada. Nada gravado.

`lint` ✅ · **463/463** ✅ · `build` ✅

## ✅ CSV-05 — a importação parou de engolir erro em silêncio (2026-08-21)

> Nasceu de uma correção de rumo do dono: ele **não** vai exportar-editar-reimportar. Vai exportar
> só para ver quais são os campos e **gerar o CSV do zero**. Ou seja: o caminho provado no RT-01b
> (arquivo que o próprio app gerou) não é o caminho que ele vai usar.

**O import estava pronto para o arquivo dele mesmo, e cru para um arquivo escrito fora.** Só duas
coisas eram ditas: máquina que não casou e preço/custo divergente (CSV-03) — e esta segunda **fica
desligada** numa planilha do zero, que não traz as colunas calculadas. Todo o resto era silêncio:
JSON quebrado virava lista vazia, coluna com nome errado sumia, arredondamento inválido caía em
`exact`, referência inexistente virava avulso.

**O pior deles era assimétrico** — e foi o que o dono perguntou primeiro, ao ver que o "atalho sem
JSON" não liga no Estoque. Em `resolveFilamentPrices`: `filamentId` **errado** marca `missing` e
rende o badge "⚠ cor removida" no catálogo; `filamentId` **ausente** retorna antes de qualquer
checagem (`if (!f.filamentId) return f`) — é avulso legítimo, e **nada** na tela o distingue de uma
cor ligada. O erro mais provável numa planilha gerada (esquecer o id numa coluna inteira) era
justamente o invisível, e só apareceria na `/producao`, quando a baixa não acontecesse.

**Nove classes, agrupadas por tipo** (a planilha erra em série: 40 linhas sem id são UM recado, não
40) — cada uma com a contagem total e até 3 exemplos, no molde do CSV-03. Nada bloqueia:
`json-invalido` · `arredondamento-invalido` · `markup-invalido` · `cor-avulsa` · `cor-inexistente` ·
`insumo-inexistente` · `etapa-inexistente` (subitem → etapa) · `subitem-inexistente` (acessório →
subitem) · `nome-duplicado` (no arquivo **e** contra o catálogo) · `linha-invalida`. Esta última
roda o **mesmo `validateProduct` do formulário**, que a importação nunca tinha chamado — linha sem
peso e sem tempo entrava como produto de custo zero.

**Coluna de cabeçalho não reconhecida** virou aviso de arquivo (`"Etapas"` em vez de `"Etapas
JSON"`). As 12 colunas calculadas não contam como surpresa — são ignoradas de propósito.

**O que a checagem precisou de fora:** `supplies` e `existingNames` entraram no `CsvParseOptions`
(o `CatalogPage` passou a assinar `useSupplies` só para isso). Sem eles, as checagens
correspondentes simplesmente não rodam — o parsing puro dos testes continua sem dependência.

**Medido no app real** com uma planilha de 7 linhas com defeitos plantados: as 9 classes acenderam,
cada uma na linha certa. E o export do catálogo real reimportado a seco revelou dois números que
valem por si: **84 das 97 linhas têm filamento avulso** (o catálogo está 86% desligado do Estoque) e
**97 nomes repetidos** — a importação nunca substitui, sempre cria.

`lint` ✅ · **455/455** ✅ · `build` ✅

## ✅ RT-01b — re-auditoria independente, e a semente da planilha ficou limpa (2026-08-21)

> Pedido do dono: refazer a auditoria do RT-01 **do zero, por outra cabeça**, tratando cada
> afirmação anterior como hipótese a derrubar — "quem escreveu a mudança é a pior pessoa para julgar
> se ela está certa". Harness próprio, sem reaproveitar `productCsvRoundTrip.test.ts` nem
> `productPayload.test.ts`.

**As 3 mudanças do RT-01/CSV-03 se sustentaram** (`delete base.id`, export normalizado, aviso do
recálculo) — mas **uma afirmação caiu**: reimportar um arquivo recém-exportado **não** dava zero
avisos. Dava 2 em 97 linhas, e o aviso estava certo.

**O defeito que ele apontava era anterior aos 3 commits:** o export montava as etapas de
`product.stages ?? []`, enquanto o preço da MESMA linha vinha de `calculatePricing` →
`normalizeStages`, que migra o `stage2` legado quando `stages` está vazio. Resultado: a linha
afirmava `Etapas (R$) 16,64` ao lado de `Etapas JSON []`. Reimportar derrubava o custo de 35,85 para
10,63 (**3,4×**) — em silêncio, se o CSV-03 não existisse.

**Corrigido no DADO, não no código** (decisão do dono, Diretriz 7): os 2 produtos legados
(`Caixa uno`, `livro torre dados`) foram abertos e salvos no formulário, que migra `stage2 → stages`
e zera `combineEnabled`/`fixedCostPerHour`. Custo idêntico antes/depois. **Zero produto legado
no catálogo** — e, com isso, o export do catálogo (a semente da planilha do recadastro) reimporta
com **nenhum aviso**.

**Uma mudança de código saiu daqui, e é sobre a forma do dado NOVO:** `parseProductsCsv` gravava
`weightG`/`filamentPricePerKg` no produto **mesmo com o `Filamentos JSON` presente**. Todo produto
da carga em massa nasceria com os dois escalares que o formulário parou de persistir — inertes no
custo (por isso ninguém veria) até alguém abrir e salvar. Agora eles entram **só** quando a linha
não traz as cores, que é quando são o peso/preço de verdade (CSV escrito à mão).

**O que foi medido no catálogo real** (97 produtos, via estado do React + export capturado):
- export real: 39.699 bytes, 98 linhas, 34 colunas, **0 ocorrências** de
  `energyTariff`/`laborRate`/`weightG`/`filamentPricePerKg` (A4 confirmada);
- inventário de chaves das 47 etapas: nenhuma chave desconhecida sendo descartada pelo export;
- **P1 (o risco nunca medido):** 85 filamentos, 4 com detalhamento, **todos coerentes**
  (`totalG` == soma) — o recálculo do `makeFilament` não altera nada hoje, e nunca alterou custo
  (o `calculateStageCost` já normalizava antes);
- 15 etapas legadas só com escalares: custo **exatamente** igual depois do export normalizado;
- 26 etapas sem `id` em 14 produtos, nenhum com subitens → RT-02 no BACKLOG;
- 97 linhas pelo fluxo real de importação: parse de poucos ms; o recálculo do CSV-03 não pesa.

**Ciclos A e B provados em dado real**, sem canário e sem depender de preço: 4 documentos reais de
classes diferentes + 1 produto **criado à mão no formulário** (P3, o buraco que a auditoria anterior
admitia) → 0 campos divergentes, custo idêntico com 6–9 casas. Um produto real foi aberto e salvo no
app (`Insert Hitster`): saíram só `energyTariff`/`laborRate` da etapa; todo o resto intacto.

**Duas armadilhas de método que ficaram registradas:** (1) o CSV **não** é byte-a-byte igual na 1ª
volta — mapa do Firestore não preserva ordem de chave, e a comparação exige stringify canônico
(estável a partir da 2ª volta); (2) `saveProduct` usa `updateDoc`, que **mescla** — parar de gravar
um campo não o apaga dos documentos que já o têm (vale para o `id` do RT-01).

**O que continua no escuro:** ninguém leu o **documento cru** do Firestore. Tentei patch de
XHR/fetch, `offline`/`online` para forçar re-listen e o registro de módulos do Turbopack — o cliente
usa cache em memória e nada trafegou. O caminho por token de auth foi recusado.

`lint` ✅ · **442/442** ✅ · `build` ✅

## ✅ CSV-03 — a importação parou de ignorar preço/custo em silêncio (2026-08-21)

> Achado na auditoria RT-01, na pergunta do dono: *"por que o import/export trabalha com valores que
> serão recalculados de qualquer forma?"*

**O CSV tem dois públicos.** Para o dono é um relatório (abre no Excel e mostra onde o dinheiro do
produto está); para o app, 12 das 34 colunas — material, energia, desgaste, manutenção, mão de obra,
etapas, acessórios, reserva de falha, fixo, custo total, preço sugerido e margem — são **calculadas**
e não têm `findColumn`.

**Recalcular é o comportamento certo, e continua.** O preço não é dado do produto: é consequência de
markup, peso, horas, arredondamento e da config da MÁQUINA, que vive num doc compartilhado
(`config/machines`) e pode mudar depois do export. Se a importação confiasse no preço exportado,
bastaria ajustar os watts da A1 para o catálogo voltar com preço velho discordando das próprias
entradas — e sem nada indicando qual dos dois números vale.

**O defeito era o SILÊNCIO.** Quem abrisse o CSV, corrigisse o "Preço Sugerido" e reimportasse não
recebia aviso nenhum: a edição sumia e a pessoa achava que tinha definido o preço. Armadilha real na
carga em massa.

**A correção.** `parseProductsCsv` ganhou um 3º parâmetro OPCIONAL (`{ fixedCosts, stock }`) e, quando
ele vem, recalcula cada linha com a **mesma chamada do export** (`calculatePricing` com as mesmas
máquinas/taxa/estoque) e compara contra o que o arquivo afirma. Divergiu → conta e devolve em
`recalc: { divergentes, comparadas, exemplos }`, que a confirmação da importação mostra antes de
gravar. **Não bloqueia** — mesmo molde do aviso de máquina não reconhecida (TD-009).

**Decisões de escopo:**
- **Só `Preço Sugerido` e `Custo Total`.** São as duas que alguém tentaria editar para "definir" o
  preço; as outras 10 são detalhamento (ninguém mexe no "Desgaste (R$)" esperando mudar o resultado),
  e avisar sobre 12 colunas × N linhas viraria parede de texto.
- **Tolerância de R$ 0,02** — o export grava com 2 casas (`formatDecimal`), então centavo é ruído do
  próprio arredondamento, não edição.
- **Célula vazia/ausente não conta.** Um CSV enxuto escrito à mão não tem essas colunas, e isso é uso
  legítimo — não é divergência.
- **Máximo 3 exemplos**, mas o total conta todas ("6 de 6 linhas").
- **Parâmetro opcional** porque sem a taxa de custo fixo o número literalmente não é comparável.
  Sem ele a checagem não roda (é o caso dos testes de parsing puro).
- `Peso (g)` e `Filamento (R$/kg)` ficaram **de fora**: são inertes quando o `Filamentos JSON` está
  presente, mas ESSENCIAIS num CSV enxuto mono-cor. Avisar sobre elas puniria o uso legítimo.

**Efeito colateral útil:** o aviso também acende quando a configuração (máquina/tarifa/taxa do fixo)
mudou entre o export e o import — que é a outra coisa que o dono quer saber antes de gravar.

**433 → 439 testes.**

## ✅ RT-01 — round-trip auditado campo a campo, e o par virou função pura (2026-08-20)

> **Pedido do dono antes da carga em massa**, com uma regra explícita: **nada de canário**. O teste
> anterior usara o preço sugerido como prova de igualdade e deixara passar o FORM-01 — o `supplyId`
> sumia sem mover um centavo.

**Dois ciclos, porque são caminhos de código diferentes.** Ciclo A = `exportProductsCsv →
parseProductsCsv` (nunca passa pelo formulário). Ciclo B = `loadProduct → buildPayload` (abrir e
salvar sem tocar em nada) — o que produziu o FORM-01.

**Como foi medido.** Uma cobaia exercitando todo campo ao mesmo tempo (2 cores ligadas ao Estoque com
detalhamento model/suporte/purga/torre · 2 etapas extras, uma em outra máquina · 3 acessórios:
ligado a insumo, avulso e atribuído a subitem · `sellBySubitems` on com override de markup em 1 de 2
subitens · todos os escalares fora do padrão · os 3 links · `;` e `"` no nome e em 2 cores), rodada
**no app real contra o Firestore**: export A → import → export B → abrir a cópia e salvar → export C.
Comparação por código, **83 valores por linha** (30 células escalares + 53 folhas dentro das 4
colunas JSON, em profundidade). **Zero divergências em A×B e em B×C.**

**⚠ A armadilha de método.** A primeira rodada acusou 3 colunas divergentes que **não eram perda de
dado** — era **ordem de chave**: o Firestore não preserva ordem de inserção em mapa, então a cópia
volta com as chaves embaralhadas. Comparar o **texto** da célula JSON dá falso positivo; o diff
precisa de **stringify canônico** (chaves ordenadas, arrays na ordem). Quem repetir este teste
precisa disso.

**O quase-defeito que não era.** Ao carregar, o form exibe o preço/kg **vivo** do Estoque (R$ 85,00)
enquanto o documento guarda o salvo (R$ 118,90) — D3/7c. A suspeita era que o save escrevesse o
exibido por cima. **Não escreve.** Teria sido o molde exato do FORM-01: tela ≠ documento, sem aviso.

**As 3 mudanças que saíram:**

1. **`buildPayload` gravava `id` DENTRO do documento.** Ele fazia `{...form.product}`, e depois do
   `loadProduct` esse estado carrega o `id` do `SavedProduct`. O id de um doc é o **caminho** no
   Firestore — `toSavedProduct(item.id, item.data())` nunca lê `data.id` —, então era uma cópia que
   ninguém consulta. Inerte, **exceto em "salvar como novo"**: o doc novo nascia com o `id` do
   produto **ORIGINAL** (o `createdAt` era corrigido pelo spread final, o `id` não). Errado e
   silencioso — qualquer script/migração futura que confiasse em `data.id` mapearia a cópia no
   original. → `delete base.id`. O `createdAt` fica: vem de carona com o **mesmo valor**, no-op.

2. **O export dumpava `product.stages` cru.** Medido no catálogo real: **47 das 51 etapas**, em 24
   produtos, ainda carregam `energyTariff`/`laborRate` legados (0,8/0,9 e 30/31) — lixo inerte que
   o `parseStages` descarta na volta, mas que **saía no CSV**. Passa a exportar **normalizado** (a
   mesma forma que a importação produz), pra planilha da carga em massa ser autoconsistente.
   Varredura confirmou que acessórios, subitens e cores estão **limpos** nos 99 produtos — só as
   etapas tinham lixo.

3. **O par virou função pura e exportada.** `buildLoadedProduct` (em `usePricingForm.ts`) e
   `buildProductPayload` (em `lib/productPayload.ts`). Antes o `buildPayload` era closure dentro do
   componente, e **não dava pra testar sem React** (o projeto não tem testing-library) — o que
   obrigava a testar uma **cópia** do literal, que apodrece calada no dia em que o original ganha um
   campo. Que é exatamente a falha que o teste existe pra pegar. Cobertura nova:
   `productPayload.test.ts` (diff do documento) + `productCsvRoundTrip.test.ts` (34 colunas + bordas).
   **414 → 433 testes.**

**Bordas confirmadas:** `sellBySubitems` on com zero subitens volta ligado · máquina inexistente
**avisa** na tela antes de gravar, não engole · arrays vazios voltam vazios (não ausentes) · escape
de `;` e `"` sobrevive · `energyTariff`/`laborRate` escritos à mão dentro de uma etapa **não** viram
override.

**Não é perda de dado:** `material`/`brand` sumirem de uma cor do produto. Nada nunca os escreveu
lá — só o `StockColorModal` (na COR) e o `freezeFilaments` (no snapshot da VENDA, D7). O produto
guarda só o `filamentId`; guardar cópia criaria uma 2ª fonte da verdade que envelhece.

## ✅ FORM-01 — o formulário parou de comer campo ao salvar (2026-08-20)

> **Continuação do CSV-01, e achado pelo DONO**, não pelo diagnóstico: ao abrir o produto-cobaia na
> calculadora, o acessório aparecia como **avulso**. O CSV estava são; o vazamento era outro.

**Dois caminhos, não um.** O CSV vai `Firestore → export → parser → createProductsBatch → Firestore`
e **nunca passa pelo formulário**. O form é `Firestore → loadProduct → estado → buildPayload →
Firestore`. Por isso o round-trip do CSV passou limpo e ainda assim havia perda.

### Defeito 1 — `supplyId` morria no carregar+salvar
`createAccessory` (`usePricingForm.ts`) remontava o acessório campo a campo e **esquecia o
`supplyId`**. Não era só exibição: `buildPayload` grava `supplyId: accessory.supplyId ?? null`, então
**abrir um produto e salvar sem tocar em nada apagava o vínculo** — provado em produção (o export
saiu com `"supplyId":null`). A produção parava de dar baixa do insumo. Atinge também **Vender /
Produzir / Orçar** do form, que passam pelo `ensureSavedProductId` → mesmo `buildPayload`; ou seja,
"Produzir" destruía justamente o que dá baixa.

**Por que passou despercebido no CSV-01:** a checagem-mestra era o **preço**, e o `supplyId` não move
preço — o `unitPrice` sobrevive. R$ 55,80 continuava R$ 55,80. **Lição: o teste de integridade de um
snapshot é diff CAMPO A CAMPO do documento, não comparação de preço.**

### Defeito 2 (virou remoção) — tarifa/valor-hora por ETAPA
`buildPayload` escrevia o valor do produto em toda etapa, achatando qualquer override. Provado:
produto importado com `energyTariff 2,0`/`laborRate 90` entrou a **R$ 92,38** e virou **R$ 82,96** só
por carregar e salvar.

Mas a auditoria mostrou **quatro módulos discordando** do mesmo campo: o parser do CSV preservava, o
`calculatePricing` honrava (`stage.energyTariff ?? product`), o form destruía, e a **produção
ignorava** (`wholeEventRows` congela a tarifa do produto). Preço e custo real divergiriam por
construção — na comparação que o `CostDetail` existe para mostrar.

**Decisão do dono:** o campo **não deve existir** — não há input para ele. Então em vez de consertar o
achatamento, o override foi **removido** de `PrintStage`, do parser, do cálculo, da validação e do
`stageLabor`. **Medido antes:** dos 29 produtos com etapa extra, **zero** divergiam do valor do
produto → remoção neutra no preço do catálogo inteiro. Docs antigos seguem com as chaves: lixo
inerte, ignorado (Diretriz 7, sem migração). Import que traga tarifa na etapa a **ignora calado**
(decisão do dono — o aviso não pagava o código).

### O que a auditoria NÃO achou (varredura dos outros round-trips)
`toSale`/`saleToDocument` cobrem todos os campos de `Sale` e leem `filaments` crus;
`productionToDocument`↔`toProduction`, `usageToDocument`↔`usageFromDocument`,
`supplyUsageToDocument`↔`...FromDocument` e `moveToDocument`↔`moveFromDocument` são **pares
simétricos** com `filamentId`/`material`/`brand`/`supplyId` preservados; `finishedGoods` idem;
`QuoteItemSnapshot` é `{descrição, qtd, preço}` por design. O `createAccessory` era o fora-da-curva.

Testes: `usePricingForm.test.ts` (novo, 4 casos — a função virou `export` só para isso) + o caso do
`productCsv` que agora exige que a tarifa da etapa seja ignorada + um do `calculatePricing` que fixa
que doc antigo com a chave repetida **não** muda preço. `lint` ✅ · **414/414** ✅ · `build` ✅.

## ✅ CSV-01 — o round-trip do catálogo virou exato (2026-08-20)

> **Pedido como diagnóstico, não como tarefa.** O dono vai recadastrar o catálogo do zero a partir
> de um CSV **gerado fora do app**, e quis provar antes que `exportar → importar` devolve o produto
> íntegro. O momento foi escolhido de propósito: o dado de hoje é descartável (Diretriz 7), então um
> import ruim agora não custa nada — depois do recadastro, custaria.

### O que o diagnóstico achou (round-trip em produção, 2 produtos reais)

**O que JÁ funcionava** — e era a pergunta principal: o **`filamentId` sobrevive**. Confirmado por
três caminhos independentes: a coluna `Filamentos JSON` saiu byte-idêntica; as colunas de custo
recalcularam iguais (cor órfã cairia no preço congelado e mudaria o número); e o form carregou a
cópia com os selects em `PLA · Bege · Bambu` / `PLA · Laranja · Bambu`, na etapa principal **e** na
extra. O `supplyId` idem. **Armadilha de leitura:** `stripFilamentIds` **não** tira o `filamentId` —
tira o `id` de estado do formulário. O nome faz concluir o contrário de quem só lê a chamada.

**O achado que mudou o escopo:** perder os subitens **muda o PREÇO**, não só o modo de venda. No
"Teste 4b produção", custo idêntico (R$ 32,66) e preço **R$ 72,58 → 74,92** (+3,2%), porque as partes
tinham override de markup (`3.2x · 3.0x · 1.9x`) e a cópia caiu no 3,0x liso. "Subitens somem" soa
como perda de *modo de venda*; era perda de *dinheiro*. Foi isso que fez o dono pedir a correção.

### A ordem de dependência que não dá para furar

`subitems[].stageKeys` referencia as etapas por `"main"` (sentinela) + `PrintStage.id`. Se o
`stages[].id` não voltar, **todo subitem importado nasce apontando para o vazio** — pior que não
importar. Por isso o `id` da etapa não é um extra do item: é pré-requisito dele.

E o que **simplificou** a implementação: o export **já escrevia** `stages[].id` e
`accessories[].subitemId` (o JSON é `JSON.stringify` cru do documento). Quem jogava fora era o
**parser**. Então só os subitens precisaram de coluna nova — o resto foi parar de descartar.

### Os 3 defeitos que só o CSV escrito à mão dispara

Nenhum aparecia no round-trip do próprio app, e é exatamente por isso que nunca tinham surgido: o
export escreve número de JS (com **ponto**) e sempre preenche os campos opcionais da etapa.

| # | defeito | como falha |
|---|---|---|
| A | `markup` era o **único** número por `parseFloat`, que **para na vírgula** | `2,8` → **2**. Silencioso: grava o catálogo inteiro precificado abaixo |
| B | `roundingMode` são tokens com ponto (`0.90`) comparados por igualdade | `0,90` → `exact`. Silencioso |
| C | `Number(ausente) \|\| undefined` gravava `undefined` literal | Firestore recusa, `batch.set` é atômico → **o lote inteiro morre**. Barulhento |

Os três são a **mesma causa de fundo**: formato decimal pt-BR. Basta abrir o CSV uma vez no Excel
para ele reescrever as vírgulas — e dois dos três falham calados.

### Decisões de design

- **Colunas novas vão no FIM** (`Vende por Subitens`, `Subitens JSON`). O `findColumn` casa por
  **nome**, não por posição, então CSV exportado antes disto continua importando — sem as colunas o
  produto entra como só-inteiro, o default de sempre. Nenhuma migração.
- **A flag vai SEPARADA do array.** Desligar a venda por subitens não apaga os subitens salvos, então
  "desligado com partes guardadas" é um estado real que inferir de `subitems.length` perderia.
- **Campo opcional ausente é CHAVE AUSENTE, nunca `undefined`** (`...(x > 0 ? { x } : {})`) — o
  mesmo padrão que o `buildPayload` já usava para o markup do subitem. É a lição do defeito C.
- **Máquina que não casa AVISA** em vez de escolher calada (`CsvImportResult.warnings`, mostrado na
  confirmação antes de gravar). Cair na 1ª máquina em silêncio põe o produto na impressora errada, e
  energia/desgaste saem de lá. Mesma disciplina do TD-009/`filamentMissing`.

### Verificação

`productCsv.ts` era o **único parser sem arquivo de teste** (16 `.test.ts` em `lib/`, nenhum para
ele) — e os 3 defeitos são justamente o que um teste de round-trip pega sozinho. Ganhou **19
testes**: round-trip campo a campo de um produto rico (multicolor com cor do estoque + avulsa, 2
etapas extras em máquinas diferentes, acessório com `supplyId` + `subitemId`, subitens com override
de markup, `;` e aspas no texto), um caso por defeito corrigido, o CSV antigo sem as colunas novas, e
uma varredura que **falha se qualquer `undefined` sobrar** no payload. `lint` ✅ · **408/408** ✅ ·
`build` ✅.

## ✅ UX-38 + UX-40 + A11Y-01 — a linha do celular vira cartão (2026-08-18)

> **Os 3 últimos itens do cluster da auditoria de layout.** Os dois primeiros são **a mesma forma de
> problema em telas diferentes**: uma fileira horizontal com mais colunas do que cabem em 375px, em
> que o dado que se quer conferir (ou o alvo que se quer tocar) fica do lado de fora. O terceiro é
> independente e saiu de carona por ser barato.

### UX-38 — o lucro do recibo estava atrás de uma rolagem por venda

**Medido antes (375×812):** tabela de **453px** dentro de um cartão de **345px**. O excedente de
**108px** é exatamente onde moram o **lucro** (faixa de 86px, visível só até a 30ª) e o **excluir**
(401→453px, fora da tela inteiro). Como cada recibo é uma `<table>` própria com o seu scroller
(BUG-06), conferir o lucro exigia **rolar cada venda para o lado, uma por uma** — e o lucro é o
número que se abre a página para ver.

**O achado que corrigiu o próprio item:** a auditoria anotou que a coluna do *custo real* estava
"espremida a zero". Não estava — estava **escondida**. A regra `.recibo-items .ri-cost {display:
none}` morava no **`quote.css`**, o CSS da página de **orçamento** (o mesmo defeito de escopo do
TD-013), e por isso nenhuma busca no arquivo do recibo a encontrava. Escondia porque não cabia.

**A saída:** sete colunas não cabem em 375px — nenhuma repartição faz caber. Então a linha **deixa
de ser linha** e vira cartão de 3 faixas, a mesma receita do `.fg-part` (estoque) e do `.main-row`
(catálogo), com o par que se confere encostado na direita, um sob o outro:

```
▼ Nome do produto                  [excluir 44px]
  material
2×  R$ 33,50                               R$ 33,50
custo real R$ 8,04                         R$ 25,46
```

A grade tem **4 pistas** porque `qtd` e `preço unitário` precisam ficar **colados** — é o
"2× R$ 33,50" que se lê como uma coisa só e dispensa rótulo. As faixas que atravessam a linha (nome,
custo) **cruzam a pista flexível** e por isso não entram no dimensionamento intrínseco das pistas
`auto`: é o que impede um nome comprido de empurrar a coluna do preço. O custo real **volta** (a
regra do `quote.css` não migrou de arquivo: deixou de existir).

**Depois:** rolagem horizontal **108 → 0** (página e cartão), 7 de 7 células visíveis, altura da
linha **102px**, excluir a **44px** (UX-36 — e sem custo de largura: a pista da direita já é
dimensionada pelo lucro, ~86px).

**Três armadilhas de cascata/escopo, todas medidas, nenhuma óbvia:**
1. **Ordem, não especificidade.** O bloco `@media` escrito ANTES de `.recibo-items td` perdia o
   desempate (0,1,1 contra 0,1,1 — `@media` não soma nada) e o recuo de tabela seguia valendo: cada
   faixa ia a **38px** em vez de 21. → o bloco mora no **FIM do arquivo**, com o aviso escrito lá.
2. **`> td`, não `td`.** Dentro do dropdown do UX-06 mora **outra tabela** (a `CostBreakdownTable`
   de precificado × real). O `display: block` descia até as células dela e as duas colunas de número
   viravam uma pilha.
3. **`> tbody`, não `tbody`** — a mesma armadilha, mais sutil: o `<tbody>` da tabela de dentro
   também virava bloco, cada linha remontava uma tabela anônima própria e as colunas paravam de se
   alinhar **entre si** (medido: cabeçalho em 121/96/96px contra corpo em 76/63/62). → **todo**
   seletor de elemento do bloco usa combinador de filho.

De quebra: o ▼ é `inline` e o nome é um `inline-flex` ao lado — com o nome em duas linhas (e no
celular ele fica em duas), a seta sobrava **sozinha numa linha só dela**. Os dois viraram itens de
flex.

### UX-40 — alvo E grade ao mesmo tempo

As 3 ações por **subitem** (vender/produzir/orçar só esta parte) mediam **24×24px**. Crescer sozinhas
era impossível, e a conta é o motivo: medido a 375, a linha tem **297px úteis** e as 4 faixas já os
consomem inteiros — **nome 32 · meta 101 · preço 58 · ações 76**, mais 3 folgas de 10. Ir a 44px pedia
136px de ações: o nome, **já espremido em 32px**, ia a zero.

Por ser alvo **e** grade, a saída é a mesma do UX-38: **a linha vira duas**. Em cima o nome (agora
**151px**, quase 5× o que tinha) e as ações — que é o par que se lê junto, o botão ao lado do que ele
opera; embaixo a meta e o preço, alinhado à direita sob os botões. Botões a **44px** (3×44 + 2 folgas
= 136 numa faixa de 297). A linha do total ("Produto inteiro") não tem ação nem meta, então o preço
**sobe para a 1ª faixa** — sem isso ela gastaria duas linhas para dizer nome + preço.

**No desktop nada muda** (24px, uma linha só) — mesma lógica do UX-36: o painel expandido não tem
faixa sobrando ali. E o `1fr` puro do `catalog.css` ganhou a guarda `minmax(0, …)` que a auditoria de
2026-08-17 tornou regra; a versão do celular **reescreve a linha inteira com a guarda junto**, porque
dentro de `@media` ela não se herda.

### A11Y-01 — `title` não é rótulo

Tema e Sair, no cabeçalho, tinham **só** `title`. Ele é o **último recurso** do cálculo do nome
acessível, não sai em toque nenhum e alguns leitores de tela o ignoram por configuração. E aqui o
caso é pior que o genérico: no celular o `.header-utils-label` **some por CSS** (UX-33), então
sobrava um emoji `aria-hidden` e mais nada. Os dois ganharam `aria-label` — nomeando a **ação**
("mudar para tema claro"), não o estado, e contendo a palavra do rótulo visível do desktop (WCAG
2.5.3). Os botões da `NavBar` (☰, ✕) já tinham o seu; o emoji ☀️/🌙 continua sendo **[DEC-05]**, que
sai junto do rebrand.

### Verificação

Medição no DOM em 375, 700 e 961px, nas duas telas, com o dropdown do recibo aberto. `lint` ✅ ·
**389/389** ✅ · `build` ✅. Efeito colateral registrado: entre **641 e 760px** o custo real volta a
aparecer no recibo (o `col` de 184px já estava reservado, então a rolagem da faixa não mudou — só
deixou de haver uma coluna vazia).

## ✅ UX-36 + UX-37 — alvo de toque e o peso do destrutivo (2026-08-17)

> **Os 2 itens** saíram do cluster da auditoria de layout do mesmo dia. O fio comum: **controle
> importante em alvo pequeno demais**. Decisões do dono nesta rodada: o Excluir ganha **separação
> E cor**, "normalizado com o que aparece no resto do site"; e o **[UX-39] é lixo de teste** que
> some no recadastro (fechado sem código — ver abaixo).

### O que a medição corrigiu no próprio item

O backlog dizia "as 5 ações do catálogo medem **24×24px**". **Medido no DOM, elas medem 32×32** —
os 24px são de OUTRO grupo, os 3 ícones por subitem (`.sp-actions`), que ficam no mesmo painel
expandido. A auditoria juntou as duas fileiras numa frase só. Os 32px vieram do UX-15 e continuam
abaixo dos 44px, então o item vale — só não pela largura que estava escrita.

### UX-36 — o alvo cresce onde é dedo, não onde é ponteiro

| Onde | Antes | Depois | Por quê |
|---|---|---|---|
| Celular (`.main-row.open td.col-actions`) | 32×32 | **44×44** | Cabe: a faixa mede **317px** e 5×44 + 4 folgas de 8 + o divisor pedem **265px**. E é a **única** forma de agir sobre o produto ali — a linha fechada esconde a coluna inteira |
| Desktop (`td.col-actions`) | 32×32 | **32×32** (fica) | "Ações" é pista **FIXA de 196px**; 5×44 pediriam ~250px, e os 54px sairiam das faixas flexíveis que a **826px já estão no piso** (sobram 33px na linha). Crescer aqui reabriria o corte que o UX-21 fechou |

**O Excluir sai do repouso neutro.** O UX-25 acertou o diagnóstico — **cinco** cores não
hierarquizam nada — mas **uma** hierarquiza. Agora ele usa o vocabulário que a página inteira já
tem para "cuidado", o do `.btn.danger`: `--danger` + `--danger-soft` + `--danger-line`, com
`--danger-tint` no hover. **Vale no app inteiro** (as 9 telas com `.icon-button.danger` excluem
algo); os outros quatro seguem neutros, então a fileira continua parecendo uma fileira.

⚠ O contorno é `box-shadow: inset`, **não** `border` — 1px de borda somaria 2px à caixa e o ícone
pularia de tamanho no meio da fileira (mesma razão do UX-32).

**Medido — 375×812, linha aberta:** os 5 botões em **44×44** · folga Editar→Excluir **29px** contra
**8px** entre os demais · `scrollWidth 375 = clientWidth` (sem rolagem lateral). **1280×900:**
botões **32×32**, pistas **idênticas** (`259,9 / 119,1 / 65 / 108,3 / 75,8 / 130 / 196px`), linha
em **62px** — zero regressão.
**Contraste do Excluir sobre o fundo composto** (transições mortas antes de ler): claro
`rgb(198,40,40)` sobre `rgb(249,234,234)` = **4,81** · escuro `rgb(232,96,96)` sobre
`rgb(47,33,51)` = **4,53**. Passa o AA de texto nos dois — e ícone é objeto gráfico, que pede 3.

### UX-37 — o gatilho da composição, pela receita do UX-28

`.cost-detail-trigger` media **15–17px**: metade do alvo, num controle que abre a composição inteira
do custo. Cresceu pela **mesma receita do UX-28** (`.link-button`) — o alvo sobe, a caixa no fluxo
não: `padding-block: 8px` + `margin-block: -8px` + `min-height: 32px`.

⚠ **Por que não virou `inline-flex`** (que seria o jeito óbvio de centralizar): o conteúdo é texto +
`<strong>` + `<span>` com **espaços significativos** entre eles; em flex cada um vira item próprio e
os espaços somem — o rótulo colaria no número.

**Medido:** `/estoque` **15 → 32px** (linha-mãe `.sales-total-sub` segue em **16px**) · `/producao`
**17 → 33px** (`.prod-summary-line` segue em **17px**) · SaleModal **→ 32px**. O texto do gatilho
continua com os espaços (`"custo real gasto R$ 10,88 · composição ▾"`).
**Sondagem de sobreposição** (`elementFromPoint` nas bordas): a 4px acima e abaixo do alvo só há
`div` não-interativo (`.prod-summary`/`.prod-note`, `strong`/`.sales-total-card`, `.cesta-item`) —
**o alvo maior não rouba clique de vizinho**.

### UX-39 — fechado sem código

O dono confirmou: os "coffee prank coffee part" ×4 e "Arraia Flexível" ×2 são **lixo de teste**, e
somem no recadastro (Diretriz 7). Nada a desempatar no seletor.

### O achado que ficou aberto

Os **24px dos `.sp-actions`** (as 3 ações por subitem) **não** foram tocados: a 375px a linha já
está espremida — o nome do subitem ocupa **37,6px** de 297px úteis — e crescer os ícones de 76 para
136px o mataria de vez. É alvo **e** grade ao mesmo tempo, então virou item próprio: **[UX-40]** no
backlog.

**Verificação:** `lint` ✅ · `test` **389/389** ✅ · `build` ✅ · medições acima nos dois temas.

## 🔍 Auditoria de layout responsivo (2026-08-17) — o LEVANTAMENTO + os 4 consertos

> **Gatilho:** o dono mandou um print do `/estoque` → aba Produtos, no celular: num produto com mais
> de um subitem, o nome da peça aparecia **quebrado letra por letra, na vertical**. O pedido foi uma
> auditoria nova do site inteiro — "tudo que dá pra abrir, interagir" — porque uma falha assim
> sugeria outras iguais.

**Método:** servidor local, dados reais, **medição no DOM** (não olhômetro). Um auditor injetado
varreu cada rota classificando 5 sintomas — `W-ZERO` (elemento com texto e 0px de largura),
`ESMAGADO` (largura < 40px e altura > 2,2× a largura), `ESTOURA` (borda direita além da viewport),
`CORTADO` (`scrollWidth > clientWidth` sem `overflow` declarado) e `ALVO-MINI` (< 28px). Rodou nas
**7 rotas**, em **375px e 1280px**, com os acordeões abertos **um a um** (o do `/estoque` é
exclusivo: abrir o segundo fecha o primeiro, então varrer "tudo aberto" não enxerga nada).
Depois, um segundo passe mediu **contraste WCAG** de todo texto folha, compondo o fundo real camada
a camada (alfa incluído) e **matando `transition` antes de ler**, conforme a regra do `CLAUDE.md`.

### A causa raiz — uma só, em três lugares: `1fr` sem `minmax(0, …)`

O mínimo implícito de `1fr` é `auto`, ou seja, o **min-content** da célula. Quando a célula guarda
algo que não quebra — um `<select>` cujas options são longas, um `<input type="date">` (widget
nativo de largura fixa) — a coluna **cresce além do container** em vez de encolher.

| # | Onde | Sintoma medido | Conserto |
|---|---|---|---|
| 1 | `stock.css` `.fg-part` | Coluna do nome a **0px**, linha de **80 a 294px** de altura | Media query < 620px: a linha vira **duas** (nome em cima; saldo/custo/ação embaixo) |
| 2 | `responsive.css` `.grid` | Home **rolava 14px de lado** a 375px, no carregamento limpo. Trilha da grade a **374,9px** dentro de 347px — piso vindo do `<select>` de cor (min-content 200px) | `1fr` → `minmax(0, 1fr)` |
| 3 | `forms.css` `.two-col` | `input[type=date]` (177px intrínsecos) tomava a linha: no SaleModal o par virava **119px + 177px** (placeholder "Nome do cliente" cortado); a `/producao` rolava de lado | `1fr 1fr` → `minmax(0,1fr) minmax(0,1fr)` + `min-width: 0` no date |
| 4 | `forms.css` / `responsive.css` | Canal × Forma de pagamento **15px fora de linha** (rótulo de 2 linhas empurra o select); e o date a **38px** contra 42px do vizinho no celular | `align-items: end` no `.two-col`; e a compensação do UX-22 recalibrada sobre o recuo de 10px da faixa móvel |

⚠ **O caso 2 é o mais instrutivo:** o `forms.css:3` **já declarava** `minmax(0, 1fr)` na versão de
desktop. A guarda se perdia no override do `responsive.css`, ou seja, **exatamente onde o espaço é
apertado e ela importa**. Ao sobrescrever `grid-template-columns` numa media query, reescreva a
guarda junto — ela não é herdada.

⚠ **O caso 4 tem a mesma forma:** o UX-22 devolvia 1px por lado ao controle de data assumindo o
recuo base de **8px**; no celular o `.field-input` sobe pra 10px e o seletor do date, mais
específico, continuava em 7px. **Compensação calibrada sobre um token tem de acompanhar o token.**

### Medições — antes → depois

| Item | Antes | Depois |
|---|---|---|
| `.fg-part-name` (largura / altura) | **0px / 80–294px** | **313px / 16px** |
| Linha da peça (altura) | 80px | **62px** |
| Home a 375px (`scrollWidth`) | **389px** (rola de lado) | **375px** |
| Trilha da `.grid` no celular | 374,9px em 347px | **347px** |
| SaleModal — par Cliente/Data | 119px + 177px | **138px + 138px** |
| SaleModal — Canal × Pagamento (topo dos selects) | 318px × 333px | **333px × 333px** |
| Campo de data no celular (altura) | 38px | **42px** (= o vizinho) |

**Cards do `/estoque` varridos um a um: 15/15 sem achado.** `lint` ✅ · **389/389** ✅ · `build` ✅.
Sem regressão em desktop: `/orcamento` manteve os dois cartões na mesma altura e no mesmo `y`
(UX-22 intacto), e todos os `.two-col` da calculadora seguem em colunas iguais (307/307).

### O que a auditoria descartou (para não voltar como achado novo)

- **`mm/dd/yyyy` nos campos de data** — é o locale do NAVEGADOR de teste (`navigator.language` =
  `en-US`), não do código: o `<html lang>` está correto em `pt-BR`. No Chrome pt-BR do dono sai
  `dd/mm/aaaa`.
- **Círculo escuro com "N" no canto inferior** — overlay de desenvolvimento do Next; não existe em
  produção.
- **Nomes com reticências no `/catalogo`** — é o UX-21 funcionando (faixa de nome trunca, faixa de
  número tem piso).
- **Rolagem horizontal da tabela de recibo em `/vendas`** — é a "válvula" `min-width` prevista no
  `CLAUDE.md`. Continua **aberto como leitura ruim no celular** (ver `BACKLOG.md`), não como bug.
- **Contraste** — **zero** falhas WCAG AA nos dois temas, em todas as telas medidas. O TD-014 e o
  UX-19 se sustentaram sob medição independente.

## ✅ [micro] O botão do celular volta a 14px (2026-08-17)

> Resíduo do UX-17b, fora de qualquer onda: lá, **campo e botão** subiram pra 16px no celular. O
> campo **precisa** (abaixo de 16px o iOS dá zoom ao focar); o botão só acompanhou "pra não
> destoar do campo ao lado". **Martelo do dono (2026-08-17): 14px.**

**A mudança é uma remoção:** o `.btn` do `responsive.css` perdeu a linha `font-size` e volta a
herdar o `--text-lg` (14px) do `forms.css` — o `padding` continua igual. O comentário do bloco foi
reescrito pra registrar que o campo sobe **sozinho**, e por quê.

**Medido no DOM (375px, tema escuro, servidor local, `transition` morta antes de ler — sem isso a
leitura pega a fonte no meio da animação do `transition: all` do `.btn` e mede 14px mesmo com
`!important` inline):**

| Botão | Antes | Depois |
|---|---|---|
| `Salvar` (calculadora) | 48px | **45px** |
| `Registrar produção` | 48px | **45px** |
| `Carregar mais …` (/vendas, /producao) | 50px | **47px** |

Página inteira: `/` −7px · `/producao` −6px · `/vendas` −3px. **Bem menos que os +57/+70px que o
UX-17b tinha somado** — aquele ganho era quase todo do CAMPO (há muitos por tela), não do botão,
que aparece 1–2 vezes por rota. O item valia pela coerência, não pelo pixel.

⚠ **Alvo de toque preservado:** o menor ficou em **45px**, acima do mínimo de 44px do UX-30.

ℹ️ **Não afetados** (e nunca estiveram em 16px): os três `.btn.btn-secondary` do card de resultado
(`Vender`/`Produzir`/`Orçar`) medem **34px** com fonte 13px — quem manda neles é uma regra mais
específica, que sempre venceu o `.btn` do `responsive.css`. Ficam **abaixo dos 44px**; é anterior a
esta mudança e não foi tocado aqui.

**Verificação:** `lint` ✅ · `test` **389/389** ✅ · `build` ✅ · medição no DOM acima.

## ✅ Onda 5 do backlog — matemática e leitura (2026-08-17) — **a ÚLTIMA da fila**

> **Os 3 itens:** `UX-26` (a matemática das barras de custo) · `TD-016` (o ritmo de lucro do ROI) ·
> `UX-34` (a ressalva do payback). O fio comum: **número que engana o olho** — nos três, o dado
> estava certo e a APRESENTAÇÃO dele respondia outra pergunta.
> **Decisões do dono nesta rodada:** UX-26 vira **barra empilhada 100%** (o desenho do `/estoque`),
> mas com a legenda mostrando **R$ e %** — não só a % · TD-016 usa janela de **90 dias** · UX-34
> vira **`<details>` fechado**, não ícone com dica.

### UX-26 — a barra mentia porque a régua era o maior item

**O estado:** `maxValue = Math.max(...items)` — o MAIOR custo sempre desenhava barra inteira.
Medido no cenário base (custo total R$ 12,48): mão de obra R$ 5,00 desenhava **100%** sendo **40%**;
material R$ 4,40 desenhava **88%** sendo **35%**. Como o bloco termina em "Custo total", o olho lia
fatia do total. A parte de COR já tinha saído na onda 2 (`--cost-*`); sobrou a régua.

**O que mudou:** as 8 categorias somam **exatamente** `result.totalCost` (`stagesCost` é subtotal
informativo, já dobrado dentro das categorias) — então empilhar sobre o total é exato, não
aproximação. As 8 barras viraram **uma faixa empilhada** com legenda `● Material R$ 4,40 35%`.
Medido no DOM depois: material **109,3px de 310** = 35,3% e mão de obra **124,2 de 310** = 40,1%.

**A reutilização que o item destravou:** o `/estoque` já desenhava esse mesmo conceito
(`.fg-comp`, faixa `flex-grow` proporcional) desde o FEAT-06 — o TD-014 tinha unificado a PALETA e
deixado dois DESENHOS. O `.fg-comp` virou o componente **`CostStack`** (exportado do `CostBars.tsx`)
e o CSS virou `.cost-stack*` no `sections.css`, com as duas chaves que faltavam (`failure`,
`fixed`). O `StockPage` passou a consumi-lo **sem `showValue`** — a aba Produtos ficou pixel a pixel
igual (conferido: legenda "Material 33% … Desgaste 50%", 6 segmentos, `.cost-stack-val` = 0).
O bloco `.hbar-*` foi **removido**.

**Altura (com margens, medida no DOM):** desktop **120px → 108px**; celular 375 **120px → 90px**.
A economia é modesta porque o card do resultado é estreito e a legenda quebra em 3 linhas — o ganho
do item é a **honestidade da largura**, não a tela.

### TD-016 — o ritmo respondia "quanto rendeu", não "quanto rende"

**O estado:** `profitPerMonth = lucro ÷ (agora − 1ª venda)` — média de vida inteira. Um mês forte
seguido de período parado fazia a média **decair sozinha**, e a projeção de payback afastar a data.

**O que mudou:** janela móvel de **90 dias** (e não 60: no volume de vendas de hoje, a janela curta
deixa um mês vazio zerar a projeção). Só o RITMO usa a janela — `profit`, `revenue`,
`paybackFraction`, `surplus` e `remaining` continuam acumulados de vida inteira, porque é o
acumulado que paga a máquina. Dois detalhes que o desenho exigiu:
- **A janela encurta quando o histórico é menor que ela** (`min(elapsed, 90d)`) — senão uma máquina
  com 30 dias de vida teria o ritmo diluído por 3 meses que não existiram.
- **Ritmo 0 é resposta legítima**, não ausência de dado: máquina lucrativa mas parada há mais de 90
  dias mostra `R$ 0,00/mês` e **nenhuma data**. Isso criou uma 2ª causa para "sem projeção", e a
  frase do cartão distingue as duas (histórico curto × parada) — dizer "junte 2 semanas" para quem
  já tem 8 meses de histórico seria mentira.
- O KPI virou **"Ritmo (90d)"**, com o número saindo de `recentWindowDays` (a UI não crava "90").

**Nos dados de hoje o número não mudou** — e isso é o esperado: as vendas de teste têm ~36 dias de
histórico, ou seja **tudo cabe dentro da janela** e ela encurta para o histórico. Quem prova o
comportamento são os 3 testes novos (venda fora da janela ignorada · máquina parada → ritmo 0 sem
projeção · histórico curto divide pelo histórico). **389/389.**

### UX-34 — a ressalva ocupava mais tela que o dado

O UX-09 pôs o aviso do payback em 3 pontos **de propósito**, e funcionou. O efeito colateral era o
do topo: um parágrafo antes do 1º cartão. Virou `<details>` fechado, no mesmo padrão do
`.result-advanced`/`.stock-spent` (marcador nativo fora, chevron lucide que gira). **`<details>` e
não dica por hover** porque hover não existe no toque — e é justamente no celular que a caixa doía.
Os outros 2 pontos (sub-linha do KPI e a linha italic por cartão) **não foram tocados**.

**Medido no DOM:** desktop **36px → 18px**; celular 375 **108px → 36px** (6 linhas → 2). Aberto,
60px. Foco por teclado confere: Tab chega no `summary` logo depois da navegação e ele casa
`:focus-visible` com `outline: 2px solid rgb(255,107,53)` + offset 2px (UX-31, sem nada declarado).

### Verificação

`lint` ✅ · **389/389** ✅ (386 + 3 do TD-016) · `build` ✅. No navegador, com dado real e nos dois
temas: `/` (soma das % fecha com o "Custo total" logo abaixo) · `/catalogo` (faixa dentro do
`.cd-cost`, 423px de 423px — sem estouro; material 63% = R$ 7,04 de R$ 11,21) · `/estoque` aba
Produtos (idêntica) · `/maquinas` (`<details>` abre/fecha por clique e por teclado; "Ritmo (90d)").
375×812 sem rolagem horizontal.

## ✅ Onda 4 do backlog — sistema (2026-08-17)

> **Os 5 itens + 1 de carona:** `TD-015` (casca de modal) · `UX-29` (semântica) · `UX-31` (foco) ·
> `UX-28` (alvo de toque) · `UX-32` (primário desabilitado) · `UX-35` (contraste, que não estava
> em onda nenhuma). O fio comum: **em todos, o padrão certo já existia em algum canto do app e
> nunca tinha sido propagado.**
> **Decisões do dono nesta rodada:** a onda inteira, em **2 pushes** (TD-015 sozinho, depois o
> resto) · o UX-32 vira **contorno + linha do que falta** (e não só o conserto de contraste) · o
> UX-35 **entra junto**, no mesmo trabalho de cor.

### TD-015 — a casca de modal (push 1)

**O estado:** 8 dos 9 modais eram `<div>` sobre `<div>` — sem `role="dialog"`, sem `aria-modal`,
sem nome acessível, sem Escape, sem ✕, e nenhum travava a rolagem do fundo. O padrão certo estava
escrito em dois lugares e nunca saiu de lá: o `ConfirmDialog` (UX-15) já fazia papel/Escape/foco,
e a gaveta da nav (UX-14) já travava o fundo.

**O que entrou:** `Modal.tsx`. Papel + `aria-modal` + `aria-labelledby` (id do `useId`), Escape,
trava de rolagem **com salvar-e-restaurar** do `overflow` anterior (copiado da gaveta — zerar
direto destravaria a página que ela quer travada), foco inicial no primeiro focável do **corpo**
(não do box: o primeiro nó do box é o ✕) com o ✕ de reserva, armadilha de Tab consultada **no
momento da tecla** (o corpo do SaleModal muda de tamanho conforme a cesta cresce), e o ✕.

**A grade de 3 faixas.** O `overflow-y: auto` estava no `.modal-box` inteiro, então os botões
rolavam junto do formulário. `grid-template-rows: auto 1fr auto` + `min-height: 0` no corpo:
cabeçalho e rodapé param de rolar. **Medido no `SaleModal` em edição, a 1280×900:** o corpo pede
**812px** e mostra **580** — rola por dentro — e o rodapé fica em **745–832** numa viewport de
**900**. A 375×812, rodapé em **656–750**, sem rolagem horizontal.

O `ConfirmDialog` virou consumidor e ficou só com o que é decisão do UX-15: a ordem dos botões e o
foco no *Cancelar*. É por causa dele que o `Modal` aceita `initialFocusRef` — no resto do app o
foco vai pro primeiro controle, que ali seria o botão que APAGA.

**Verificado nos 9:** 1 `role="dialog"` por modal aberto, nome acessível igual ao título,
`body.style.overflow` travado e **restaurado** no Escape, ✕ presente, rodapé acima da dobra.

### UX-29 — o documento ganha sumário e marcos (push 2)

⚠ **Duas correções ao achado da auditoria (F3):** o **`<nav>` JÁ EXISTIA** (`NavBar.tsx:55`, com
`aria-label`) — o levantamento errou nesse ponto. E o `/catalogo` **já tinha** `h2` + 93 `h3`
(`.cd-product-name`) corretamente aninhados; o "h3 10×, todos `.modal-title`" era a contagem com
um modal aberto, não o estado da rota.

**O que faltava de verdade e entrou:** `<header>` (o `div.header` do `PageHeader` — um arquivo só,
porque o UX-33 já unificou as 7 cópias) · **skip-link** no `layout.tsx` apontando pro
`<main id="conteudo">` das 7 rotas (medido: é o **primeiro focável** da página; sem ele o teclado
atravessava as 7 abas + 2 utilitários em toda troca de rota) · e os títulos de seção viraram
`<h2>`: **calculadora 0 → 5**, **/orcamento 0 → 4**, **/vendas 0 → 1**. O `.modal-title` desceu de
`h3` para `h2` — era ele o salto h1→h3, e dentro de um `role="dialog"` é o heading do topo.

**O mecanismo do "zero pixel":** um reset no `base.css` (`h1..h4 { font-size: inherit;
font-weight: inherit; margin: 0 }`). Sem ele o `<h2>` traria a margem de `0.83em` do navegador.
Quem manda no tamanho continua sendo a classe — que já mandava quando o elemento era `<div>`.
**Medido:** todos os headings novos com `margin 0px/0px` e a fonte da classe (12px/600 etc.).
Junto veio a higiene do TD-013: o `h1 { }` **cru** que morava no `header.css` (regra de elemento
global no CSS de uma área) virou `.header h1`.

**O que NÃO foi promovido, de propósito:** as linhas de lista (`.stock-title` do /estoque,
`.roi-title` do /maquinas, `.prod-card` do /producao). São dezenas por página: virariam ruído no
sumário em vez de estrutura. Essas 3 rotas ficam com `h1` só — o que é um documento plano, não um
salto. E a **marca continua sendo o `<h1>` da calculadora**: trocá-la pelo nome da rota mudaria a
identidade da home, e `<h1>` = nome do site é correto numa página inicial.

### UX-31 — o foco vira sistema

Token novo `--focus-ring` no `base.css` (próprio, e não `var(--accent)` direto: o anel tem de
aparecer sobre qualquer superfície, e a marca não tem essa obrigação — o rebrand pode precisar
separá-los). Regra `:focus-visible` global, **sem `border-radius`** (cada controle já tem o seu;
um raio comum deformaria o anel do `.btn` e do `.icon-button`). Os dois focos que já existiam
(`.back-to-top`, `.brand-reset`) passaram a consumir o token.

⚠ **A armadilha que a verificação pegou:** a devolução do anel aos campos **não pode morar no
`base.css`**. `.field-input:focus` e `.field-input:focus-visible` têm a MESMA especificidade
(0,2,0) — quem vence é a ordem dos `@import`, e o `base.css` é o primeiro. Medido: com a regra lá,
o campo focado por Tab lia `outline: none`. A correção ficou **colada em cada `outline: none`**,
no arquivo dele (`forms.css`, `fees.css`, `sections.css`). Depois: campo focado por Tab lê
`outline: rgb(255,107,53) solid 2px` **e** a borda laranja — os dois indicadores juntos.

### UX-28 · UX-32 · UX-35

**UX-28 (alvo).** `min-height: 32px` no `.link-button` + `margin-block: -8px` — o alvo cresce, a
caixa no fluxo não. Sem a margem negativa o `.section-head` de cada seção subiria de ~16px para
32px só porque o botão ao lado do título ficou mais alto. **Medido a 375×812:** "Gerenciar"
`79×15 → 79×32`, "detalhar refugo" `286×15 → 287×32`, `.section-head` do "Máquina" segue em 16px.
⚠ **O que mudou de verdade:** `.link-button.bordered`/`.add-line` **crescem 2px** (30 → 32) — eles
são caixas visíveis e devem crescer mesmo.

**UX-32 (desabilitado).** Contorno em vez de preenchimento. O contorno é `box-shadow: inset`, e
**não** `border`: 1.5px de borda somaria 3px à altura e o botão **pularia** no instante em que o
formulário fica válido. **Medido:** contraste `4,43 → 5,61` no tema claro, e altura **41 → 41** ao
digitar o nome (não pula). A linha do que falta entrou nas 3 rotas: *"dê um nome ao produto para
salvar"* · *"adicione ao menos um item para gerar o PDF"* · *"escolha o que foi impresso para
registrar"* — só quando é FALTA; `saving` não conta, porque o próprio rótulo já diz "Gerando...".

**UX-35 (contraste).** O `--danger-rgb` do tema escuro era `224, 82, 82` = **4,47** contra 4,5 —
e o `base.css` documentava esse 0,03 como aceito de propósito, herdado do UX-19. Subiu para
`232, 96, 96`: **5,10** no card sólido (na faixa do claro, 5,38/5,62) e **4,79** sobre o
tingimento, que a auditoria não tinha medido e também passava raspando.

**Varredura final:** 7 rotas × 2 temas, com `*{transition:none}` injetado e reflow forçado antes
de ler (sem isso a leitura pega a cor no meio da transição do `body` e inventa reprovação) →
**zero elemento reprovando AA**. `lint` ✅ · **386/386** ✅ · `build` ✅.

## ✅ Onda 3 do backlog — grade e alinhamento (2026-08-16)

> **Os 4 itens:** `UX-21` (o resto — uma grade só nas listas) · `UX-22` (linha de base do
> /orcamento) · `UX-23` (`PageIntro`) · `UX-33` (hierarquia de navegação + `PageHeader`).
> É o bloco que o dono viu com os próprios olhos — *"textos descentralizados"*.
> **Decisões dele nesta rodada:** o UX-33 vai **completo** (inclui extrair o `PageHeader` e subir
> Escuro/Sair) · o UX-23 **não inventa texto** para /catalogo e /vendas · o UX-22 resolve com
> **rótulo visível**, não com compensação de CSS.

### UX-21 — as listas não tinham UMA grade só

**(a) Catálogo, a deriva.** Cabeçalho e linhas eram duas grades independentes: o `thead tr` tinha
recuo de **20px**, a `.main-row` tem **16px + 1px de borda = 17px efetivos**. Os 3px de cada lado
viravam 6px de largura útil a mais no cabeçalho e, como as faixas são `fr`, a diferença se
redistribuía e acumulava até "AÇÕES". O cabeçalho passou a `calc(var(--space-16) + 1px)`.
**Medido depois, a 1280 e a 826:** `left` de cada `th` contra o `td` correspondente → **deriva 0
nas 7 colunas** (não "1px": zero).

**(b) Catálogo, o número cortado — pior do que a auditoria tinha visto.** A auditoria registrou a
coluna de preço transbordando. Medido no DOM com os 93 produtos a **826px de viewport (737px de
largura útil)**, o `overflow: hidden` do `.main-row td` cortava:

| Coluna | Faixa | Linhas cortadas |
|---|---|---|
| Margem | 52,78px | **93 de 93** |
| Máquina | 77px | 13 |
| Preço/peça | 70,58px | 9 |
| Custo/peça | 75,98px | 1 |

**A descoberta que mudou o conserto:** em 4 colunas quem define a largura mínima é o **RÓTULO**, não
o dado — "Custo/peça" mede **93px** de cabeçalho contra 88,4px do maior valor. E o `th` **não** tem
`overflow: hidden`: sem piso ele não cortava, **invadia o vizinho**. Por isso os pisos são
`max(rótulo, conteúdo)` medidos, e não "o maior número + folga".

O critério do que ganha piso: **um número cortado vira outro número** (`R$ 617,90` → `R$ 617,9`),
então coluna de valor tem piso obrigatório; **nome e máquina continuam com reticências**, porque
nome cortado continua sendo o nome. A rolagem horizontal voltou ao `.table-scroll` como *válvula*:
`min-width: 740px` = a soma das faixas + folgas + recuo. Acima disso nada rola e o desktop é
idêntico ao de antes (medido a 1280: as 7 faixas com os MESMOS valores de antes da mudança).
**Depois: zero número cortado nas duas larguras.**

**(c) /vendas, cada recibo com colunas próprias.** Cada recibo é uma `<table>` independente em
layout automático → as colunas se dimensionavam pelo nome mais longo *daquele* recibo. A auditoria
mediu 8px entre dois vizinhos; **medido com os 23 recibos na tela, o desalinhamento chega a 39px**.
Conserto: `table-layout: fixed` + `<colgroup>` — a mesma receita que a `.cost-detail-table` já usava
no próprio arquivo. **Depois: spread 0,00 nas 7 colunas.** No celular (≤640px) o recibo volta ao
layout automático: ali a comparação entre recibos não acontece (cabe um por tela) e a grade fixa
custaria ~450px de rolagem contra os ~126px de hoje.

### UX-22 — os dois cartões do /orcamento

Duas causas, não uma. **(1)** O 1º campo da esquerda ("Nome do negócio") era o único da tela **sem
rótulo visível** — só `aria-label` — enquanto o da direita começa com rótulo: daí o Δ15. **(2)** Os
dois cartões tinham **duas réguas verticais** para o mesmo tipo de conteúdo: `.field-block.compact`
= 12px contra `.two-col` = 20px. Corrigido na régua (um valor para os dois seletores, escopado ao
/orcamento porque `.two-col` é compartilhado com a calculadora, o SaleModal e a /producao), e não
empurrando um cartão com número fixo.

**(3) O campo de data.** Media 37px contra 35px do vizinho: o Chrome dá 18px de conteúdo ao
`::-webkit-datetime-edit` onde o texto recebe 16. `line-height` **não resolve** (testado: 36 contra
34 — a diferença sobrevive). Como o `box-sizing` é `border-box`, devolver 1px em cada lado do recuo
vertical dá os 35px exatos. Vale para os **9** `type="date"` do app, todos em `.field-input`.

**Medido depois:** topo dos campos — esquerda `[67, 133, 199]`, direita `[67, 133]` → **Δ0** nas
duas linhas compartilhadas (era Δ15 e Δ35). Alturas: `text`, `number` e `date` **todas 35px**.

### UX-23 — `PageIntro`

Eram **seis** introduções (a auditoria contou 4 tratamentos; a 5ª e a 6ª estavam nas abas do
estoque) com três CSS diferentes: `.subtitle` (14px/560px), `.stock-intro` (**12px**/640px, e
espremido ao lado do botão dentro da `.stock-bar`), `.roi-note`. Viraram um componente com **uma**
medida de linha (`70ch`), uma posição e um espaçamento. **Medido: `max-width` computada de
618,2px, idêntica nas 6.**

Duas consequências registradas: no /estoque a `.stock-bar` ficou só com a ação (numa das duas
ocorrências ela não tinha nem botão — era invólucro só para carregar o parágrafo); e a regra do
UX-14 que escondia o texto no celular valia só para a calculadora porque só ela tinha `.subtitle`
— com o componente, ela passa a valer para as 6. É o mesmo conteúdo pelo mesmo motivo (o texto do
/estoque tinha 4 linhas), e reverter é uma regra só.
**/catalogo e /vendas seguem sem introdução** — decisão do dono: texto de produto é a voz dele.

### UX-33 — os dois níveis de navegação

**(a) Hierarquia.** O UX-17b deixou as abas do estoque byte a byte iguais às da NavBar: resolveu o
*estilo* e criou um problema de *hierarquia*. A resposta não foi voltar a dois estilos, e sim
**mesma família com pesos diferentes** — a NavBar mantém o chip **preenchido**
(`--chip-active-bg`), a aba interna fica só com contorno e letra em accent. O terceiro paradigma (o
segmentado de desconto do `SaleModal`) **não entrou**: é controle de formulário, não navegação —
fica registrado em comentário para não voltar como achado novo.

**(b) `PageHeader`.** O bloco `.header` estava **copiado em 7 arquivos**, junto com o mapa
`statusLabel`, variando só em título, meta, ícone e presença do chip de status. Virou um componente
com `{title, meta, status?, icon?, theme, onToggleTheme}`. O `Header.tsx` da calculadora virou
invólucro fino (o que sobrou de próprio é o título ser o botão da marca).

**(c) A faixa de utilitários.** "Escuro" e "Sair" saíram da `.navbar-utils` para a linha do título.
**Medido:** a 1024 de viewport a `.navbar-bar` tinha **98px** e passou a **53px** — **45px** de
faixa devolvidos em toda página (a auditoria estimou "~40px"). ⚠ **A 1280 a economia é 0** — ali os
7 destinos + 2 utilitários já cabiam numa linha; o ganho é da faixa 761–1100, e a 1280 o que muda é
só a hierarquia. No celular os dois viram ícone puro de 40px e se juntam ao ☰ no canto (o rótulo
sai por CSS, não por renderização condicional, para não haver dois nós disputando a ordem de
tabulação); a reserva do `.header` subiu de 52px para 144px. **Medido a 375×812 com o título mais
longo:** sem colisão brand↔utils, sem sobreposição utils↔☰, 8px entre eles, 43px de folga abaixo,
rolagem horizontal 0.

### Verificação e as duas ressalvas honestas

`pnpm lint` ✅ · `pnpm test` **386/386** ✅ · `pnpm build` ✅.

**Varredura de contraste (não-regressão da onda 2): 3.610 textos, 7 rotas × 2 temas.** Duas
reprovações sobreviveram, **ambas anteriores a esta onda e em cores que ela não tocou** (conferido
no `git diff`: nenhuma linha de `margin-bad`/`--danger` mudou):
- **escuro, /catalogo:** `.margin-bad` a **4,47** contra 4,5 — `rgb(224,82,82)` sobre o card sólido
  `rgb(26,26,46)`, **sem tingimento no meio**, então 4,47 é o valor exato, não erro de medida. É a
  cor da régua da DEC-04.
- **claro, 3 rotas:** o `.btn.primary` **desabilitado** a **4,43** — que é exatamente o
  **[UX-32]** da onda 4.

⚠ **Armadilha de medição, para a próxima varredura:** o `body` tem `transition: background 0.2s`.
Medir contraste logo após trocar de tema lê a cor **no meio da transição** e produz reprovação
fantasma — na primeira passada apareceram 9 falsos positivos, incluindo um texto a "1,02". A
varredura precisa injetar `*{transition:none}` e forçar um reflow antes de ler.

⚠ **O ambiente ficou sem memória** (7,7 GB de RAM, ~1,2 GB livres): `lint`, `test` e `build`
abortaram com OOM várias vezes antes de passarem, e o renderizador de screenshot travou no fim. Não
tem relação com o código — o primeiro `pnpm lint` já abortava assim antes das mudanças.

## ✅ Onda 2 do backlog — o bloco COR (2026-08-16)

> **Os 5 itens:** `TD-014` (tokenizar a cor) · `UX-20` (a cor do lucro) · `UX-24` (contraste AA) ·
> `UX-25` (as 5 ações) · a **parte de cor** do `UX-26`. A matemática das barras do `UX-26` **não**
> foi tocada — segue na onda 5.
>
> **Por que esta onda primeiro:** era a única com prazo externo (a marca). Com a cor tokenizada, o
> rebrand vira troca de paleta; sem ela, eram 14 edições à mão em literais que fixam o RGB do laranja.

### A descoberta que organizou o TD-014

O `UX-19` **já tinha construído a paleta semântica sem saber**. As três cores da faixa de margem
(`bad`/`ok`/`good`) eram as únicas do app medidas com cuidado — 5,07–5,62 no claro — e estavam
presas dentro do nome "margem". Elas subiram para `--danger` / `--warn` / `--success`, e
`--margin-*` passou a apontar de volta. **Nenhum tom novo foi inventado**: é a cor que já tinha
passado no teste, agora com o nome do que ela significa.

Junto veio uma separação que não existia: `--danger` (erro, prejuízo, falha, destrutivo) × `--warn`
(atenção que **não** é erro: estoque baixo, cor sumida, saída de material). Antes os dois eram o
mesmo terracota `#c4836b`, e não dava para distinguir "deu ruim" de "olha isso".

**A escada de opacidade:** as 13 opacidades soltas (`.05 .06 .08 .1 .12 .14 .15 .16 .2 .22 .24 .3
.35 .4 .5`) viraram 3 degraus — `-soft` (.10, fundo) · `-tint` (.20, fundo forte/hover/borda sutil)
· `-line` (.35, borda). Órfãos colapsam pro vizinho, mesma política do `UX-17b`.

**A tinta mora no `-rgb`; o resto deriva.** `--danger: rgb(var(--danger-rgb))` e os três alfas saem
do mesmo `-rgb`, e `var()` resolve na hora do uso — por isso o tema escuro redeclara **só** o
`-rgb`. Trocar a marca = trocar uma linha por cor.

**Números:** 49 hex distintos + 8 bases `rgba()` → **~80 literais convertidos** em 15 arquivos.
Sobraram de propósito os `#fff` de texto sobre preenchimento e as 7 sombras `rgba(0,0,0,·)` — não
são cor de marca e não travam o rebrand.

### Três defeitos achados na passada (nenhum estava no backlog)

1. **Duas paletas independentes para o MESMO conceito.** `.fg-comp` (stock.css, 6 cores, com
   variante escura) e `CostBars.tsx` (8 cores cravadas no JSX, **sem** variante escura) pintavam a
   composição de custo — e discordavam: energia `#d9a021` × `#E0A96D`, manutenção `#a8617a` ×
   `#5FA8A0`. Venceu a do `.fg-comp`, que já tinha sido pensada para os dois temas; virou `--cost-*`
   no `base.css` e as duas passaram a consumir. As 2 categorias que só o CostBars tinha entraram
   agora — e é aí que a **parte-cor do UX-26** se resolveu: reserva de falha (`#D2726B`) e custo
   fixo (`#C4836B`) eram quase a mesma tinta em linhas vizinhas → falha virou o vermelho semântico
   (é risco) e custo fixo virou o neutro (é o balde do não-atribuível).
2. **`--surface-2` nunca existiu.** `production.css` usava `var(--surface-2, rgba(127,127,127,.08))`
   — o fallback cinza **era** o valor real, em todo tema.
3. **O trilho do interruptor não respondia ao tema.** `#d8d4c8` cru no `sections.css`: o mesmo
   cinza claro no escuro. Virou `--toggle-off`, com valor por tema.

### UX-24 — o AA, e por que a auditoria subestimou

A auditoria tinha listado **3** reprovações. Medindo a paleta inteira, eram **12** — as que faltavam
eram justamente as mais usadas: `.sale-neg` (`#e05252` = **3,65/3,82**, o vermelho do prejuízo no app
inteiro), o terracota do erro de formulário (**2,95/3,09**) e o verde do "salvo" (**3,12/3,26**).
Quase todas se resolveram sozinhas ao herdar a semântica, porque a semântica veio do UX-19.

**Decisão do dono: separar marca de texto** (em vez de escurecer a marca). Três papéis:
`--accent` = a marca em tudo que **não** carrega letra · `--accent-strong` = o que carrega texto
**branco** em cima (botão primário; não muda com o tema, porque branco-sobre-cor não depende do
fundo da página) · `--accent-text` = o laranja que **é** texto (no escuro aponta pro `--accent`, que
lá já passa em 6,71/6,02).

**⚠ A lição que custou duas iterações: o tom tem de sobreviver ao PRÓPRIO tingimento.** As primeiras
escolhas foram feitas contra o card branco e **passavam** ali — e reprovavam nos fundos que a mesma
cor pinta. O `--accent-text` a `#c74a0b` media 4,76 no card e **4,29** no `.prod-badge` (que é
`--accent-soft`, laranja 10%); o `--muted2` a `#767263` media 4,82 no card e **4,22** no painel de
capacidade (verde 10%); o `--success` a `#2e7d32` media 4,90 e **4,49** no mesmo painel — reprovava
por um centésimo. Os três foram reescolhidos **medindo no DOM o pior fundo real**, não o card.
Por isso o `--success` desceu 2 pontos em relação ao valor do UX-19 (e o `--margin-good` junto).

**Custo assumido e registrado no código:** o degrau `--muted` → `--muted2` quase sumiu nos dois
temas. A saída melhor seria o texto de 11px crescer, mas "não aumentar o texto" é instrução do dono
desde o `UX-17a` — então quem cede é o degrau.

**Medição final** (varredura de nós de TEXTO, com composição de alfa, 7 rotas × 2 temas):
**4.561 textos medidos, ZERO reprovações**, exceto o `.margin-bad` em 4,47 no escuro — que é a
exceção **deliberada** herdada do UX-19 e já documentada no `base.css`.
⚠ O primeiro script de medição dava 1,34 num ponto: era **bug do script** (ignorava o alfa de um
fundo `rgba`), não do app. Quem repetir a medição precisa compor as camadas.

### UX-20 — a cor mora na %

Regra do app inteiro, escrita num bloco no `auth-sale.css` (o dono do `.sale-pos`): **a cor mora na
%; sem % companheira, mora no R$.** Reverte o UX-19, e os **dois** comentários que registravam a
decisão antiga (`SalesPage` e `StockPage`) foram reescritos junto.

- **Aplica em 4 pontos** (têm % ao lado): KPI e cabeçalho do recibo em `/vendas`, total do
  `SaleModal`, `fg-margin-val` no `/estoque`.
- **⚠ Exceção deliberada em 5**, cada uma com o motivo escrito no TSX ao lado: linha do item em
  `/vendas`, lucro do item no `SaleModal`, `ProfitSummary`, os 2 cartões do `/maquinas`.
  **O dono tinha enumerado 3** — o do `SaleModal` foi achado conferindo ponto a ponto se havia %; o
  comentário no código diz isso e pede confirmação.
- **⚠ Buraco que o item não previa:** o total do `SaleModal` era a única "(NN%)" do app **sem** a
  régua da DEC-04 (saía em `--muted`). Tirar o verde do R$ ali teria **apagado** o sinal em vez de
  mudá-lo de lugar — a % teve de ganhar `marginTierClass` antes.
- **A armadilha da cascata:** a faixa vai num `<span>` PRÓPRIO por dentro, nunca junto de uma classe
  que já declara `color` e mora num CSS importado depois do `base.css` — na mesma especificidade o
  último vence. A regra já estava escrita no `base.css`, acima do `.margin-bad`.
- **Terceira implementação unificada:** `.fg-margin-val` tirava o verde da própria classe e pintava
  o prejuízo de **laranja** contra o vermelho do resto do app. Duas cores para o mesmo significado.
- `.sale-neg` **fica** em todo valor negativo (guarda do caso receita = 0, em que `marginTier`
  devolve `null`), e os 3 usos que **não** são lucro/prejuízo (entrada×saída de material, preço
  acima×abaixo do sugerido) ficaram intactos.

**Prova nos dados reais:** o caso que motivou o item — `R$ 20,11 (61%)` — agora tem o R$ em `--ink`
e só a % em âmbar. Antes eram R$ **verde** ao lado de % **âmbar**, dois recados opostos.

### UX-25 — as 5 ações

`sale #5faa80 · produce #b8925a · quote #8f6bc4 · edit #6b88c4 · danger #c4836b` (todas entre 2,66 e
4,14 no AA). Repouso agora é **neutro** para as cinco — a fileira volta a parecer uma fileira e quem
diferencia é a forma do ícone; a cor entra no **hover**, que é quando ela informa. O Excluir é o
único com cor própria ali (o vermelho semântico), porque é o único irreversível.
Junto, `sale`/`produce`/`quote` saíram do `catalog.css` — era CSS de UMA página estilizando classe
global (o defeito do `TD-013`), e por isso a busca por `icon-button` nunca achava as 5 juntas.

### Verificação

`pnpm lint` limpo · **386 testes intactos** · `pnpm build` ok · varredura de contraste no DOM nas 7
rotas × 2 temas · capturas a 1280×900 e 375×812.

---

## ✅ Ondas 0 e 1 do backlog — as 2 decisões + os 5 consertos (2026-08-16)

> **Contexto:** primeira execução depois que o backlog ganhou ORDEM. A **onda 0 eram perguntas ao
> dono** (não código) e a **onda 1** era o lote "quebra, ou é conserto de 1 linha". Saíram juntas,
> no mesmo dia e no mesmo commit.

### As duas decisões da onda 0

**[DEC-06] — `machines` = N cópias idênticas do conjunto; a conta FICA, o aviso ENTRA.**
A pergunta era se `× machines` deveria continuar multiplicando sobre produto multi-máquina, já que o
gargalo (TD-003) **já** credita o paralelismo entre máquinas distintas. As opções eram (a) barato —
`machines` = cópias idênticas, e (b) caro — `machines` vira a lista de máquinas físicas da oficina.
**O dono escolheu (a), mas recusou a parte em que o multiplicador "deixaria de funcionar"**: em vez
de silenciar o campo em produto multi-máquina, o app passa a **dizer o que ele significa**.

O ponto fino: com a definição (a), os **400 ciclos** travados em `calculateCapacity.test.ts:103`
(A1 3h + X2D 2h, `machines: 2`) estão **certos** — pressupõem 2 A1 e 2 X2D. O problema nunca foi a
conta, foi ela ser **muda**: a oficina real tem 2 máquinas, uma de cada, e `DEFAULT_FIXED_COSTS.
machines = 2`, então quem preenche o campo pensando "tenho 2 impressoras" projeta o dobro sem que
nada na tela avise. A saída escolhida ataca exatamente isso — e **não conserta** o número de quem
preencheu errado; devolve a informação para o dono decidir o valor certo.

Onde caiu: o aviso reaproveita a condição que o `CapacityPanel` **já** usava para o bloco do
gargalo (`machineBreakdown.length > 1`), somada a `machines > 1` — só aparece quando as duas
coexistem, que é quando a premissa deixa de ser óbvia. O `calculateCapacity.ts` e o teste ganharam o
comentário que registra a intenção; **nenhum número mudou** (386 testes passando, intactos).

**[UX-20] — sub-decisão (c): a cor mora na %; sem % companheira, mora no R$.**
Em 3 pontos (linha do item em `/vendas`, `ProfitSummary`, cards do `/maquinas`) o valor não tem %
ao lado. As opções eram (a) passar a exibir a % ali, (b) aceitar o número neutro, (c) manter a cor
onde não há %. O dono escolheu **(c)**. ⚠ Isso cria uma **exceção deliberada** à regra do UX-20, e
ela **tem de ficar escrita no código** quando a onda 2 executar — senão o próximo a passar por ali
"conserta" a exceção e apaga a leitura desses três pontos. **O UX-20 segue aberto na onda 2**; o que
fechou aqui foi só a pergunta.

### Os 5 consertos da onda 1

| Item | O que era | O que entrou | Prova medida |
|---|---|---|---|
| **BUG-06** | `.recibo-card` tem `overflow: hidden` e a tabela é mais larga → o excedente **não rolava, era cortado** | `div.recibo-items-scroll` com `overflow-x: auto` (mesmo padrão do `.table-scroll` do catálogo); o `overflow: hidden` do cartão fica, é ele que arredonda | 375×812: **23/23** recibos com `client 345px` × `scroll 445…471px`. O botão de excluir estava em **x=456** com a borda do cartão em **x=360**; rolando 108px vai pra **x=348** — alcançável |
| **BUG-07** | o reset cobria `button, input, select` e esquecia `textarea` → observações em `monospace` | uma palavra no `base.css` | `/orcamento`: textarea agora `Inter 16px`, **idêntico** ao input vizinho |
| **UX-27** | `tabular-nums` em 3 declarações locais, num app inteiro de números | subiu pro `body`; as 3 locais saíram | `getComputedStyle(body).fontVariantNumeric === "tabular-nums"` |
| **UX-21 (só o `text-align`)** | colunas de dinheiro do catálogo em `start` → a vírgula nunca alinhava | `.num` — a convenção que `sales.css` e `cesta-recibo.css` já usavam — chegou ao catálogo | 1280×900: **um único x** (`485.28`) para `R$ 33,64` e `R$ 617,90`; custo em `684.33/684.34` (0,01px de arredondamento) |
| **UX-30** | o preço mudava em silêncio | `role="status"` + `aria-live="polite"` no `.result-price` (**só** ali — a `MobilePriceBar` espelha o mesmo número e duplicaria a fala) + `aria-valuetext` nos 2 dials de markup | DOM: `aria-valuetext="3.0x"`, igual ao rótulo visível |

⚠ **Achado NOVO que a verificação levantou e foi PRO BACKLOG (onda 3, dentro do UX-21):** a 1280 a
coluna de preço do catálogo cabe, mas a **826px de largura útil não** — `R$ 617,90` mede 75,61px numa
faixa de 73,7px (`1.1fr`), o texto transborda e o `overflow: hidden` do `.main-row td` **corta**.
É defeito de **grade**, pré-existente: com o alinhamento à esquerda ele cortava igual, só não
aparecia. Não é regressão do `text-align`.

## 🔍 Auditoria de UI/UX + cálculo (2026-08-16) — o LEVANTAMENTO

> **O que é:** o *porquê* e a MEDIÇÃO dos **33 achados** da auditoria pedida pelo dono depois do
> fechamento do cluster UI/UX. Os itens **abertos** que saíram daqui vivem no
> [`BACKLOG.md`](BACKLOG.md), seção "Cluster da auditoria de 2026-08-16" — **21 itens**
> (`UX-21…UX-34`, `TD-014…TD-016`, `BUG-06/07`, `DEC-06`), porque vários achados eram o **mesmo
> defeito em lugares diferentes** e foram consolidados. Este arquivo guarda o número medido; o
> backlog guarda a tarefa. **O código-referência antigo (A1…I3) está anotado em cada item** — é
> como o relatório original numerava.
>
> **Método (o mesmo do cluster anterior, e vale repetir):** site **rodando** com dados reais
> (93 produtos, 47 vendas, 53 produções), **7 rotas + 9 modais**, em **1280×900** e **375×812**,
> nos **dois temas**, com medição no DOM — não é leitura de código. `pnpm test`: **386 passando**
> antes e depois (nada foi alterado).
>
> ⚠ **Um erro de método que quase virou achado falso, registrado para não se repetir:** a
> primeira sonda de foco chamou `el.focus()` e comparou o estilo antes/depois — deu "nenhum
> controle tem indicador de foco", o que era **falso**. O painel do navegador não estava em
> primeiro plano, então `document.hasFocus()` era `false` e **`:focus` não casa**. A conclusão
> certa veio de ler as regras do CSS, não o estado vivo. Sonda de estado só vale com a janela
> focada.

### A — Alinhamento (o que o dono viu como "textos descentralizados")

**→ `UX-21` (A1+A2+A3) · `UX-22` (A4) · `UX-23` (A5)**

**A1 — no catálogo, cabeçalho e linhas são duas grades independentes.** O `<tr>` do cabeçalho e
o `.main-row` são dois `display: grid` com caixas de conteúdo **diferentes**, e o erro **acumula
da esquerda para a direita**:

| | padding | borda | conteúdo | trilhas |
|---|---|---|---|---|
| cabeçalho | `0 20px 8px` | 0 | **906px** | `205.0 \| 94.0 \| 51.3 \| 85.4 \| 59.8 \| 102.5 \| 196` |
| linha | `14px 16px` | 1px | **904px** | `207.1 \| 94.9 \| 51.8 \| 86.3 \| 60.4 \| 103.5 \| 196` |

Deriva medida: PRODUTO **3px** · PREÇO 1px · MÁQUINA **2px** · AÇÕES **3px**.

**A2 — as colunas de dinheiro são `text-align: start`.** `R$ 33,64`, `R$ 617,90` e `R$ 141,30`
começam **todos** em `x=256` → a vírgula decimal nunca alinha. A fonte já é **JetBrains Mono**
(dígito de largura fixa), então `text-align: right` faz as vírgulas se empilharem sozinhas. É a
mudança de **maior retorno visual por linha de CSS** do lote inteiro.

**A3 — em `/vendas` cada recibo é uma `<table>` própria em layout automático**
(`grid-template-columns: none`), então as colunas se dimensionam pelo **nome de produto mais
longo daquele recibo**. Dois recibos vizinhos, medidos:

```
recibo 1   qtd 410–449   preço 449–536   total 536–622
recibo 2   qtd 402–442   preço 442–528   total 528–614
                 −8px           −8px           −8px
```

A última coluna não escorrega porque está presa à coluna de ações, à direita — o que faz o miolo
parecer "solto". Rolando o histórico, os números balançam de recibo em recibo.

**A4 — no `/orcamento` os dois cartões lado a lado nunca compartilham linha de base.** O da
esquerda abre com um campo de largura inteira; o da direita, com uma linha de dois. Topo de cada
linha de campo: esquerda `235 · 297 · 379`, direita `250 · 250 · 332 · 332` → **Δ15** e **Δ35**.
Junto: o campo `type="date"` mede **37px** contra **35px** do vizinho na mesma linha (altura do
controle nativo).

**A5 — o texto de introdução de página tem 4 tratamentos.** `/estoque` espreme o parágrafo à
esquerda do botão "Nova cor"; `/producao` usa largura inteira acima do cartão; `/maquinas`
empilha **dois** (~120px antes do primeiro dado); `/catalogo` e `/vendas` não têm nenhum. O
conceito nunca virou componente, então cada página inventou o seu.

### B — Cor: o buraco que o UX-17 deixou

**→ `TD-014` (B2+B3+C3) · `UX-24` (B1) · `UX-25` (B4)**

O UX-17 tokenizou **espaço, raio e tipografia** e parou antes da **cor**. É a maior lacuna
estrutural que sobrou — e ela tem **prazo**, porque cada literal vira edição manual quando a
marca chegar.

**B1 — contrastes medidos (calculados da paleta viva, WCAG AA pede 4,5 para texto normal):**

```
                         claro   escuro
branco sobre --accent     2.84    2.84   ← BOTÃO PRIMÁRIO, reprova nos dois
--muted2 sobre cartão     2.93    3.18   ← 52 usos, e é o texto de 10–11px
--accent como texto       2.84    6.02   ← 57 usos; só reprova no claro
--muted  sobre cartão     5.61    6.01     ok
--ink    sobre cartão    17.06   14.56     ok
```

⚠ **O ponto que dói:** o **UX-19 mediu com todo cuidado** as três cores de margem (5,13 a 5,62)
— mas **a paleta em que elas vivem nunca foi auditada**. O rigor existiu no item novo e não na
base. E `--muted2` é justamente o texto **menor** do app.

**B2 — 51 hex distintos + 8 bases `rgba()`, e nenhuma cor SEMÂNTICA.** O `base.css` declara ~23
cores de superfície; as outras ~28 são literais espalhados. Não existe token para os papéis que o
app mais usa: **perigo, aviso, sucesso, informação**. `#c4836b` aparece **11×** e `#e05252` **5×**
— os dois fazendo o papel de "perigo/aviso", sem nome.

**B3 — a mesma tinta em 6 opacidades.** É o problema dos **órfãos** do UX-17b, de novo, agora em
cor: `rgba(255,107,53, ·)` em `0.08 · 0.1 · 0.12 · 0.2 · 0.22 · 0.3` e
`rgba(196,131,107, ·)` em `0.1 · 0.14 · 0.24 · 0.35 · 0.5`. **0,2 e 0,22 são indistinguíveis.**
⚠ **E o argumento de prazo:** esses literais **fixam o RGB do laranja**. Trocar a marca obriga a
editar os 14 na mão. Tokenizar **antes** transforma o rebrand em troca de paleta.

**B4 — cinco ações, cinco cores.** Na linha do catálogo: vender `#5faa80` · produzir `#b8925a` ·
orçar `#8f6bc4` · editar `#6b88c4` · excluir `#c4836b`. Quando tudo está destacado, nada está — e
o Excluir não se distingue por cor, só por posição.

### C — Gráficos e números

**→ `UX-26` (C1+C2) · `UX-27` (C4) · C3 vai no `TD-014` · C5 já é o `UX-20`**

**C1 — as barras de custo são escaladas pelo MAIOR item, não pelo total.**
`maxValue = Math.max(...items)`, então o maior custo **sempre** desenha barra de largura inteira.
O bloco termina em "Custo total", então o olho lê as barras como fatia dele — e não são. Medido no
cenário base da tela:

```
                valor    barra   fatia real
mão de obra    R$ 5,00    100%       40%
material       R$ 4,40     88%       35%
desgaste       R$ 2,12     42%       17%
custo total   R$ 12,48
```

Todas as fatias aparecem **maiores do que são**. Ou normalizar pelo total, ou virar barra
empilhada 100% (que ainda devolve as 6 linhas que o bloco ocupa).

**C2 — duas cores do gráfico são praticamente a mesma:** reserva de falha `#D2726B` e custo fixo
`#C4836B` → Δ `14/17/0` em RGB. São **linhas vizinhas do mesmo gráfico**.

**C3 — a paleta do gráfico não responde ao tema:** 6 hex crus dentro do `CostBars.tsx`, misturados
com `var(--accent)` e `var(--green)`. As duas primeiras cores mudam com o tema; as seis seguintes
não.

**C4 — `tabular-nums` aparece em 3 lugares** de um app inteiro de números. Onde o valor é
monoespaçado os dígitos já alinham; onde não é (cartões de KPI, margens, os `(76%)`) cada
algarismo tem largura própria e a coluna treme.

**C5 — virou o [UX-20]** (cor do lucro × faixa de margem), já no backlog e **decidido** pelo dono
no mesmo dia. Detalhe lá.

### D — Celular

**→ `BUG-06` (D1) · `UX-28` (D2)**

**D1 — em `/vendas`, parte de cada recibo é CORTADA e fica inalcançável.** `.recibo-card` tem
`overflow: hidden` (provavelmente para arredondar o cabeçalho), mas a tabela de itens é mais larga
que o cartão — então o excedente **não rola, é cortado**. Medido a 375×812, **todos** os recibos da
1ª página: `clientWidth 345px`, `scrollWidth 414…471px`, ou seja **69 a 126px cortados**. A coluna
de lucro e o botão de excluir **não existem no telefone**.
⚠ **O TD-013 encostou nisso e leu ao contrário:** ele registrou que o recibo caiu de 600px para
"453px (108px)" e tratou como ganho. Os 108px são **exatamente o pedaço cortado** — o problema
encolheu, não sumiu.

**D2 — os `.link-button` inline têm 15px de altura.** O UX-15 subiu os alvos do catálogo para
32px e deixou esses de fora: "Gerenciar" `79×15`, "detalhar refugo (…)" `286×15` (contra
"Adicionar cor" `127×29`). São ações reais em alvos de menos de metade do mínimo confortável.

### E — Modais

**→ `TD-015` (E1+E2+E3)**

**O padrão certo JÁ EXISTE no projeto** — o `ConfirmDialog` (UX-15) e a gaveta da nav (UX-14)
fazem tudo direito. Ele só **nunca foi propagado** para os modais que já existiam. Levantado nos
9 componentes com `.modal-overlay`:

```
                       role  Escape  nome acessível
ConfirmDialog            ok     ok        ok
SaleModal               não    não       não
MachineManagerModal     não    não       não
StockColorModal         não    não       não
StockRollModal          não    não       não
StockAdjustModal        não    não       não
SupplyModal             não    não       não
SupplyLotModal          não    não       não
SupplyAdjustModal       não    não       não
```

**E2 — nenhum modal trava a rolagem do fundo.** Com o `SaleModal` aberto, `document.body` segue
com `overflow: visible` e a página atrás rola junto. A gaveta do UX-14 **já faz** o
`body.style.overflow = "hidden"`; os modais não herdaram.

**E3 — no `SaleModal` os botões ficam abaixo da dobra.** Medido: modal de **774px** numa viewport
de **910px**, `max-height: 85vh` com `overflow-y: auto` — o rodapé rola junto do miolo, então
"Registrar venda"/"Cancelar" só aparecem depois de rolar. E **não há ✕ no cabeçalho**: sem Escape
(E1) e sem ✕, a única saída visível exige rolar até o fim.

### F — Estrutura e semântica

**→ `UX-29` (F1+F2+F3) · `UX-30` (F4)**

O **UX-16** ligou rótulo a campo em 15 componentes — trabalho sério. A camada de cima, a que dá
**estrutura ao documento**, não foi tocada.

**F1 — na calculadora o único título é a MARCA.** O `<h1>` da rota `/` é "Lopo Lab" (vem do
`Header`), e **não há mais nenhum título na página**: `h1=1, h2=0, h3=0`. Todos os nomes de seção
("Filamento por cor", "Acessórios", "Preço sugerido") são `<div>`. Quem navega por títulos não tem
para onde ir. As outras 6 rotas **já** têm `<h1>` de página — só a calculadora não.

**F2 — os modais pulam de h1 para h3.** No app inteiro: `h1` 10× (páginas + AuthGate), `h2` **1×**
(só `ProductCatalog`), `h3` 10× (todos `.modal-title`).

**F3 — não existe `<nav>` nem `<header>`.** As 8 rotas têm `<main>` (isso está certo), mas a
NavBar e o Header são `<div>` → os 7 destinos não estão num marco de navegação, e não há link
para pular ao conteúdo.

**F4 — o preço muda em silêncio.** A interação central do app (mexer no dial e ver o número) não
anuncia nada. O `FeedbackNote` **já estabeleceu** `role="status"` no projeto — o preço é o caso
óbvio para o mesmo recurso. Junto: o `<input type="range">` deveria ter `aria-valuetext` com o
preço resultante, senão o valor falado é "54" e não "R$ 27,14".

### G — Formulários e controles

**→ `BUG-07` (G1) · `UX-31` (G3) · `UX-32` (G4) · G2 anexado à `DEC-05`**

**G1 — `textarea` não é estilizado em NENHUM arquivo do app.** O reset do `base.css` cobre
`button, input, select` e **esquece dele**; e o `.field-input` define `font-size` mas **não**
`font-family`. Resultado medido em `/orcamento`: todos os campos em **Inter 14px** e o de
observações em **`monospace` 14px**. Atinge os 2 textarea do sistema (orçamento e `SaleModal`).
**Conserto de uma palavra.**

**G2 — os emoji nos rótulos não seguem regra nenhuma.** A DEC-05 já decidiu "lucide no que é
controle", mas o argumento mais forte é anterior ao sistema de ícones: **dentro do mesmo
formulário**, metade dos rótulos tem emoji e metade não, sem nada que distinga os grupos —
`🏷️ nome da etapa`, `🎨 filamento`, `⏱ tempo`, `⚡ tarifa`, `🔢 peças`, `🎲 taxa de falha` têm;
`nome do produto`, `máquina`, `cor`, `filamento (R$/kg)`, `total (g)`, `mão de obra`,
`seu valor-hora` não têm. **Não é decoração deliberada, é acaso** — o emoji só marca quando
alguém lembrou de pôr.

**G3 — o foco de teclado não tem tratamento próprio.** Nos 16 arquivos de estilo: `:focus-visible`
**2×** (`.back-to-top`, `.brand-reset`) · `:focus` 6× (campos e selects, **todos** com
`outline: none` + troca de cor da borda) · **botões: nenhum**, então ficam com o anel padrão do
navegador, que não combina com nada. Os dois que têm foco decente são recentes — a intenção
existe, só não virou sistema.

**G4 — o primário desabilitado parece defeito.** `background: var(--border)` + `color:
var(--muted2)`, largura inteira, 45px. Na calculadora sem nome e em `/producao` sem produto, é o
**maior elemento da tela** e lê como erro, não como "ainda não".

### H — Hierarquia de navegação

**→ `UX-33` (H1+H2+H3)**

**H1 — navegação de página e abas internas usam o MESMO chip.** O UX-17b deixou as abas do estoque
"byte a byte iguais" às da NavBar. Resolveu a inconsistência de **estilo** e criou uma de
**hierarquia**: "em que página estou" e "em que aba estou" passaram a ter a mesma aparência, a
poucos pixels de distância.

**H2 — existe um TERCEIRO paradigma de seleção:** no `SaleModal`, o desconto
(Nenhum/Por item/No total) é um controle segmentado preenchido e emendado — diferente dos dois
chips. Três formas de dizer "escolha uma destas".

**H3 — "Escuro" e "Sair" ocupam uma faixa inteira sozinhos** no desktop: os 7 destinos preenchem
a 1ª linha e os 2 utilitários caem numa 2ª, alinhados à direita (~40px de altura em todas as
páginas, para dois botões).

### I — Matemática

**→ `DEC-06` (I1) · `TD-016` (I2) · `UX-34` (I3)**

O núcleo de cálculo é **a parte mais sólida do sistema**: 386 testes, decisões documentadas no
ponto de uso, efeito de cada mudança de fórmula rastreado em reais. Sobraram três pontos.

**I1 — a capacidade conta as máquinas DUAS VEZES em produto multi-máquina.** O modelo do gargalo
(TD-003) já credita o paralelismo entre máquinas **distintas**: quem limita é a mais ocupada.
Depois disso, `× machines` multiplica **de novo** — e isso só é correto com N cópias do conjunto
inteiro. **Travado em teste** (`calculateCapacity.test.ts:103`):

```
produto   A1 3h  +  X2D 2h     (um ciclo usa as DUAS)
gargalo   3h → 200 ciclos/mês
machines  2
esperado  400 ciclos

400 ciclos exige 2 A1 E 2 X2D = 4 máquinas.
A oficina tem 2, uma de cada. E DEFAULT_FIXED_COSTS.machines = 2.
```

⚠ Ou seja: **todo produto que roda nas duas impressoras projeta o dobro** do que cabe no mês. Não
é bug de digitação — é ambiguidade do que `machines` significa, e por isso virou **DEC-06**
(decisão antes de código).

**I2 — o ritmo de lucro do ROI é média de vida inteira.**
`profitPerMonth = lucro ÷ (agora − primeira venda)`. Um mês forte no começo seguido de período
parado faz a média **decair sozinha**, e a projeção de payback afasta a data mesmo com ritmo
recente bom (ou o contrário). Responde a "quanto rendeu até aqui", não a "quanto rende agora".
Janela móvel de 60–90 dias resolve, **sem depender do Dashboard**.

**I3 — a ressalva do payback aparece 3× na mesma tela.** O UX-09 pôs o aviso em três pontos de
propósito e **funcionou** — a informação está clara. O efeito colateral é visual: em `/maquinas` a
ressalva ocupa mais área que o número que ela ressalva (subtítulo do KPI + caixa de aviso no topo
+ linha italic em cada um dos 2 cartões).

### O que a auditoria confirmou que está BEM resolvido (não mexer)

- **O núcleo de cálculo** — 386 testes, DEC-01/DEC-03/TD-011 documentadas onde a fórmula mora, e o
  efeito de cada mudança medido em reais. É raro e vale proteger.
- **O modelo de gargalo do TD-003** — máquinas distintas em paralelo é a modelagem certa; o
  problema do I1 é o multiplicador que veio **depois**, não o modelo.
- **A régua de margem do UX-19** — módulo puro, testado, com contraste medido **antes** de escolher
  o tom. Foi assim que a paleta inteira deveria ter sido feita (ver B1).
- **O UX-16** — rótulo ligado a campo em 15 componentes, com a distinção correta entre rótulo de
  campo, cabeçalho e grupo.
- **Os snapshots congelados** — custo congelado na produção, na camada do acabado e na venda é a
  fundação que faz o custo real ser decomponível ponta a ponta.
- **Os tokens de escala (UX-17)** — consumidos pelos 16 arquivos, órfãos mortos, prova por
  medição. O `TD-014` é literalmente "fazer isso de novo, para cor".

---

## ✅ Cluster UI/UX passo ⑦ — UX-17b: os 16 CSS passam a consumir os tokens (2026-08-16)

**Fecha o cluster UI/UX.** O passo ① tinha **declarado** os tokens no `base.css` e parado ali de
propósito; este é o outro lado — **875 declarações trocadas** nos 16 arquivos de `styles/`.

**A contradição que a medição expôs, e o martelo do dono.** O `base.css` prometia *"converter não
deve mexer no visual"* e o item do backlog mandava *"matar os órfãos"*. Medido antes de começar:
**~70 declarações caem fora da escala** (o número final foi **96**). **As duas coisas não podem ser
verdade.** O dono escolheu a **escala curta**, aceitando o drift de 1–2px — e a promessa foi
**retirada** do comentário do `base.css`, que hoje registra o que de fato aconteceu. Placar:
**779 trocas literais** (zero pixel) + **96 órfãos colapsados**; tipografia de **23 tamanhos → 9**,
raio de **15 → 8**.

**A conversão foi feita por script, não à mão** (`tokenize.mjs`, no scratchpad): ele só mexe nas
propriedades de escala (`font-size`, `border-radius`, `padding*`, `margin*`, `gap*`), pula linha com
`var()`/`calc()`, e **qualquer valor sem token é deixado intacto e REPORTADO** — nada é adivinhado em
silêncio. Sobraram 7 valores crus, todos de propósito: margem negativa de ajuste fino (`-1/-2/-6/-12`)
e reserva de espaço (`60px` do rodapé do `.wrap`, `52px` que segura o botão ☰).
⚠ **Armadilha que quase passou batido:** metade dos arquivos está em **CRLF** e em JS o `.` do regex
**não casa `\r`** — a primeira rodada converteu 539 declarações e deixou 6 arquivos inteiros intactos
(`header.css`, `forms.css`, `sections.css`, `responsive.css`, `quote.css`, `base.css`) **sem erro
nenhum**. Só apareceu porque o relatório por arquivo não batia com o inventário.

**O medo herdado do TD-013 quase não se aplicou.** O aviso do backlog mandava tratar todo seletor de
elemento nu como suspeito. Levantamento: o app inteiro tem **4** (`button, input, select { font:
inherit }`, `button { color: inherit }` e `h1` em dois arquivos) — e **nenhum** declara espaço, raio
ou tamanho arbitrário além do `font-size` do `h1`, que tem dono claro. O risco real era outro.

**Como a prova foi feita (o que dá pra reusar).** `lint`/`test`/`build` não veem CSS. A sonda mede
cada elemento (`getBoundingClientRect` + `font-size`/raio/padding/margin/gap/cor computados) e
**guarda a linha de base no `localStorage` da própria página** — sobrevive ao reload e ao HMR, e o
diff roda dentro do navegador, então o relatório que sai é só o agrupamento. Dois ajustes que a
prática exigiu: (a) a 1ª versão gastou **2,7 MB só no catálogo** e ia estourar a cota — os estilos
viram **dicionário** (15.508 elementos, só **173** estilos distintos) e caiu para 1,1 MB; (b) o diff
**agrupa** por mudança em vez de listar elemento a elemento, senão o `.wrap` de 28→24px sozinho
produziria milhares de linhas de "moveu 4px".

**Resultado: 25 estados medidos** (7 rotas × 2 tamanhos + as 3 abas do estoque, 3 modais e a gaveta
aberta). **Toda** diferença de estilo, em todos eles, cai na lista de órfãos ou nas 2 mudanças
deliberadas — e **`sumiram: []` em todos**. Altura das páginas: `/` 1384→1368 · `/catalogo`
6984→6974 · `/vendas` 3442→3431 · `/orcamento` 2082→2067 · `/producao` 2438→2422 · `/maquinas` e
`/estoque` **idênticas**.

**Duas exceções deliberadas, com o motivo:**
- **`15px → 16px` (e não 14) em `.field-input`/`.btn` no celular** — abaixo de 16px o **iOS dá zoom
  automático ao focar o campo**, e o zoom desfaz o espaço vertical que o UX-13b/14 acabou de ganhar.
  ⚠ **Custo medido, e é o maior do lote:** `/vendas` **+57px** e `/producao` **+70px**; no catálogo o
  bump pega **1.674 elementos** (todo botão dos 93 cards, com os `svg`/`path` que herdam). O `.btn`
  acompanha o campo só para não destoar — se o dono preferir 14px (= igual ao desktop), é **uma
  linha** no `responsive.css`.
- **`0.78rem` → `--text-xs`** — era o único valor em `rem` do app e dava 12.48px: o órfão `12.5px`
  disfarçado.

**As duas faxinas que viajaram junto:**
- **`.btn:disabled` saiu do `stock.css` para o `forms.css`** — era a última regra global de `.btn`
  morando no CSS de uma página (o defeito do TD-013; o `.btn.danger` já tinha saído no UX-15).
  Cascata conferida: os únicos outros `:disabled` são `.fee-toggle:disabled` (outra classe) e
  `.btn.primary:disabled` (0,3,0), que segue vencendo o fundo.
- **As abas da `/estoque` viraram chip** (decisão do dono: a NavBar aparece em toda página, então é
  ela que define a linguagem de "escolher 1 de N"). Só CSS — o `StockPage.tsx` já usava
  `role="tablist"` + `.stock-tab`/`.active`. Medido: `radius 0→8` · `padding 9px 16px → 8px 12px` ·
  `margin-bottom -1px → 0` · inativa passa a ter fundo e borda. **Verificado nos 2 temas: aba e chip
  da NavBar saem byte a byte idênticos** (claro e escuro).
  - ➕ **Achado ao ler o chip pra copiar:** `.icon-label-button[aria-current="page"]` pintava o fundo
    com `rgba(74, 158, 118, 0.12)` — **verde cru**, ao lado de borda e texto em `--accent` (laranja),
    e sem responder ao tema. Existia token exato (`--chip-active-bg`, definido nos dois temas). Não
    dava pra copiar o bug pra dentro da `/estoque`.

**Dois falsos positivos que a medição levantou e que NÃO são bugs** (registrados pra não serem
"redescobertos"): (1) na `/` o `innerWidth` mede **388** contra `clientWidth` 375 — parece overflow
horizontal, mas `scrollX` não sai de 0; é contabilidade de barra de rolagem do navegador embutido.
(2) `.capacity-box` tem retângulo **fora da área rolável** — está dentro do `<details>` **fechado**,
onde o Chrome usa `content-visibility`, então o box existe geometricamente mas não é renderizado.
Ambos idênticos antes e depois.

**Conferido no fim:** a corrente do UX-13b sobreviveu à tokenização — `.wrap.has-price-bar` mantém
`calc(60px + var(--price-bar-h))` (o script pula `calc`), a folga do último card até a barra mede
**60px** (o número exato da entrega do UX-13b) e o `.back-to-top` continua subindo os 56px da barra.
386 testes, `lint` e `build` limpos.

## ✅ Cluster UI/UX passo ⑥ — UX-19: a cor passa a trabalhar (2026-08-16)

**O problema.** Num app cuja função é dizer se o preço está bom, todo número de margem saía da
mesma cor: catálogo em cinza (49% a 72%), `/vendas` em verde (61% a 100%). A régua era a
**[DEC-04]** (`< 50` ruim · `50–65` ok · `> 65` bom, a mesma nas duas telas), decidida em 2026-08-15.

**A régua virou código, não CSS.** `lib/marginTier.ts` (novo, puro, 12 testes — molde do
`roundPrice.ts`): `MARGIN_TIER_CUTS` guarda os dois cortes num lugar só, `marginTier()` devolve a
faixa e `marginTierClass()`/`marginTierTitle()` são o que os componentes chamam. O `title` existe
pra faixa **não ser transmitida só por cor**.

**Escopo dobrou de 2 para 4 superfícies (dono aprovou no plano):** o item citava catálogo e
`/vendas`, mas o mesmo número mora também no **card de preço da calculadora** (onde o dial de markup
é mexido — o lugar mais útil de todos) e na **margem congelada da aba Produtos do estoque**.

**A regra de cascata que evitou retrabalho.** `base.css` é o **1º `@import`**, então classe declarada
lá **perde todo empate de especificidade** com os 15 CSS de área (`.muted` mora no `catalog.css`;
`.cd-ph-margin`, `.result-margin`, `.fg-margin-val`, `.sales-total-sub` declaram cor na própria
classe). Por isso a faixa vai sempre num **`<span>` próprio** em volta do número — e o resultado é
que **nenhuma regra CSS existente precisou ser editada**.

**Duas coisas que só apareceram MEDINDO** (método do TD-013 — as duas eram invisíveis no diff):
1. **`.sale-pos`/`.sale-neg` estavam MORTOS no cabeçalho do recibo.** `.recibo-head-totals strong`
   (0,1,1) vencia as classes (0,1,0) desde sempre: o lucro saía cor de `--ink` e **a Taxa nunca ficou
   vermelha**. Ou seja, o "todos no mesmo verde" que a auditoria viu era das **linhas de item**, não
   do cabeçalho — lá não havia cor nenhuma. Consertado com `:not(.sale-pos):not(.sale-neg)` no
   seletor base, no **dono legítimo** da regra e **sem repetir valor de cor** em arquivo alheio.
2. **`65%` aparecia âmbar E verde na mesma tela.** A faixa lia o valor cru (65,4 × 65,6) e a tela
   mostra o `toFixed(0)`. `marginTier` passou a arredondar **antes** de comparar: a cor explica o
   número escrito, não um decimal invisível. Depois disso: **0 conflitos** em 93 produtos.

**Contraste medido, não estimado.** O âmbar claro nasceu `#b26a00` e mediu **4,24/4,05** contra o
card e o fundo — abaixo do AA (4,5). Escureceu pra `#a05a00` = **5,31/5,07**, alinhado com o vermelho
(5,62/5,38) e o verde (5,13/4,90). No escuro: 4,47 · 7,69 · 6,14 — o vermelho fica 0,03 abaixo **de
propósito**, é o `#e05252` que o app inteiro já usa pra prejuízo.

**Medido no site rodando (1280, tema claro e escuro, dados reais):**
- Catálogo, 93 produtos: **20 bom · 63 ok · 10 ruim** — a régua da DEC-04 distribui o catálogo
  inteiro nas 3 faixas, que era exatamente o motivo dos cortes escolhidos.
- Calculadora, mexendo o dial ao vivo: markup 2,4 → **45% vermelho**; 3,0 → **54% âmbar**;
  4,2 → **65% verde**. A tela responde sozinha.
- **Zero mudança de geometria, provado**: clonando o `<main>` e desfazendo os 372 `<span>` no clone,
  no mesmo instante — página **7114px idêntica**, 187 linhas comparadas, **0 diferenças**. Em
  `/vendas` (incluindo o "Sem cliente" voltando a negrito no clone): **3674px idêntica**, 23
  cabeçalhos, 0 diferenças.

**Junto:** "Sem cliente" — um campo **vazio** em negrito/`--ink` em 17 das 23 vendas, ocupando a
posição de maior ênfase da linha — ficou mudo (`.recibo-customer.is-empty`: `--muted2`, peso 400).
Continua escrito: a ausência do nome sozinha não diria que o campo existe.

**Ficou de fora de propósito:** a linha de item do recibo (`ri-profit`) mostra **só R$, sem %** —
pintar por faixa ali seria informação transmitida **apenas por cor**. Segue `sale-pos`/`sale-neg`.

**Onde:** `lib/marginTier.ts` (+teste) · `base.css` (3 tokens × 2 temas + 3 classes) ·
`ProductCatalog.tsx` · `PricingResultCard.tsx` · `StockPage.tsx` · `SalesPage.tsx` ·
`cesta-recibo.css`. **386 testes.**

## ✅ Cluster UI/UX passo ④ — UX-15: alvos de ação + como o app confirma e avisa (2026-08-16)

**Alvo de 32px no catálogo.** As 95 linhas terminavam em 5 ícones de 24px colados, com o **Excluir**
vizinho imediato do mais clicado. Agora: `td.col-actions .icon-button` = **32px**, o divisor mudou de
lugar (era entre *orçar* e *editar*; virou o separador **antes do Excluir**) e ganhou margem de 6px de
cada lado. A faixa "Ações" do grid foi de **146 → 196px**. **Medido a 1280×900:** botões 32×32, folga
*Carregar → Excluir* **4 → 21px**, e a coluna Nome caiu de 276 → 259px **sem truncar nada a mais** —
os mesmos **3 de 95** nomes truncam antes e depois, e a página mede os mesmos 7128px (comparação feita
injetando a geometria antiga na página ao vivo, não lendo o diff). A 375×838 os 5 alvos medem 32px numa
linha só, com 29px de folga antes do Excluir.

**`ConfirmDialog` + `useConfirm`.** Os **8** `window.confirm` de 7 arquivos viraram modal próprio,
reusando a casca do `modal.css` (nada de segundo sistema de diálogo). O hook devolve
`ask(): Promise<boolean>` **de propósito**: o formato do `window.confirm` preservado deixou os 8
handlers inteiros (`if (!(await ask({...}))) return;`) — estado por call-site partiria cada um em dois.
Fecha no Escape, no fundo e no Cancelar; **o foco nasce no Cancelar** e o destrutivo é o **segundo**
botão. O texto passou a nomear o alvo e a dizer **o que NÃO é afetado** (venda e acabado guardam nome +
custo congelados ⇒ o histórico sobrevive a excluir um produto).

⚠ **Isto REVERTE a decisão do [TD-004]** de manter nativos os `confirm` destrutivos. Legítimo e
consciente (o dono decidiu na sessão): o TD-004 decidiu sobre *feedback de escrita*, e o problema aqui
era **alvo de 24px com o Excluir colado no mais clicado** — contexto que não estava na mesa lá.

**Os avisos viraram um só componente** (`FeedbackNote` + `useFeedback`). Levantado no código: já **não
existia nenhum `window.alert`** (o TD-004 os matou) — o defeito estava nos substitutos. O estado
`{kind,msg}` + o `<div>` estavam copiados em **5** telas, `guardOnline`/`errorMessage` em **4** (3
cópias idênticas + uma inline na QuotePage, agora em `src/lib/errors.ts`), o ✓ era **emoji dentro da
string** (virou ícone lucide, resíduo da DEC-05) e nada sumia nem fechava. Agora **sucesso some sozinho
em 5s, erro persiste com ✕** (decisão do dono).

**O buraco real que isso fechou:** a `/vendas` **não tinha aviso nenhum** — `handleDelete` estornava
acabado + filamento e chamava `reconcileRecibo` **sem `try/catch`, sem `guardOnline` e sem mensagem**.
Falha de estorno era silenciosa: a linha só não sumia. **Verificado no site rodando** (com
`navigator.onLine` forçado a false): antes, nada; agora o aviso nomeia a venda e o motivo, persiste
além de 6s e fecha no ✕ — e nada foi gravado, porque o guarda dispara antes do primeiro `await`.

**Faxina junto (TD-013):** `.btn.danger` morava no `stock.css` — regra global no CSS de uma página, e
**sem consumidor nenhum**; foi pro `forms.css` (dono do `.btn`) e ganhou corpo, porque virou a ação
afirmativa do diálogo. O `.btn:disabled` ao lado tem o mesmo defeito mas **tem** consumidores → anotado
no BACKLOG para o UX-17b.

**Onde:** `ConfirmDialog.tsx` · `FeedbackNote.tsx` · `src/lib/errors.ts` (novos) · `ProductCatalog` ·
`SalesPage` · `StockPage` · `SuppliesTab` · `ProductionPage` · `QuotePage` · `LogoutButton` ·
`catalog.css` · `modal.css` · `forms.css` · `stock.css`. 376 testes (a matemática não foi tocada).

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
- ⚠ **[TD-004] — a parte dos `confirm` foi REVERTIDA pelo [UX-15] (2026-08-16):** os destrutivos
  deixaram de ser nativos e passaram pelo `ConfirmDialog`. O resto do item (avisos inline no lugar do
  `alert`) continua valendo — e o UX-15 unificou esses avisos num componente só.
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

## 📒 Arquivo do BACKLOG — itens FECHADOS movidos para cá (faxina de 2026-08-16)

> **Por que este bloco existe:** o `BACKLOG.md` chegou a **671 linhas / 61KB** carregando o writeup
> completo de dezenas de itens JÁ CONCLUÍDOS — exatamente o que a Diretriz 8 manda morar aqui.
> O texto abaixo veio **verbatim** de lá (nada foi reescrito nem resumido: as medições e os ⚠ de
> cada item estão intactos). O `BACKLOG.md` ficou só com o que está **aberto**.
> Vários destes itens também têm um writeup próprio e mais longo nas seções `## ✅` acima —
> este bloco é o registro curto que vivia na fila, não substitui aqueles.

### Ordem de prioridade — os 11 blocos JÁ FECHADOS (itens 1–11 da fila antiga)

1. ~~**UX / organização**~~ ✅ **FECHADA** — UX-01 · FEAT-07 · UX-02 · FEAT-08.
2. ~~**7e — Insumos/acessórios no estoque**~~ ✅ **FECHADO (2026-07-20)**.
3. ~~**FEAT-06** (aba Produtos rica / composição congelada)~~ ✅ **FECHADO (2026-07-20)**.
4. ~~**Tier 4 inteiro**~~ ✅ **FECHADO (2026-07-31)** — numeração atômica · DEC-01 renomeado · ROI real ·
   labor na reserva mantido.
5. ~~**TD-003** (capacidade por-máquina) · **UX-04** (catálogo multi-máquina)~~ ✅ **FECHADO (2026-08-04)**
   · ~~**TD-006** (paginação) + **UX-05 Fase 2/3** (busca em vendas/produção)~~ ✅ **FECHADO (2026-08-10)**.
6. ~~**Cluster "linha + dropdown de detalhe"**~~ ✅ **FECHADO (2026-08-10)** — **UX-06** (`/vendas` +
   `/producao`) **+ UX-07(a)** (aba Produtos do estoque) viraram linha + dropdown; o popover `CostDetail`
   virou a tabela compartilhada `CostBreakdownTable`. **UX-07(b)** segue adiado pro Dashboard.
7. **⏸ Tier 2 comerciais — ADIADO (dono, 2026-08-12)** — **FEAT-03** (PDF melhor) · **branding/logo real**.
   **Bloqueado por dado externo: a marca ainda não existe.** Fazer o PDF antes da logo obriga a refazer o
   cabeçalho depois. Destrava quando o dono avisar que a identidade visual está pronta.
   (~~**FEAT-09** desconto na venda~~ ✅ **FECHADO 2026-08-10**.)
8. ~~**Achados da auditoria (2026-08-13)**~~ ✅ **FECHADO (2026-08-13)** — ~~**UX-09**~~ · ~~**UX-10**~~ ·
   ~~**TD-010**~~ · ~~**TD-011**~~ · ~~**TD-012**~~ **FEITOS** · ~~**DEC-02**~~ · ~~**DEC-03**~~
   **DECIDIDAS**.
9. ~~**Cluster da calculadora (dono, 2026-08-13)**~~ ✅ **FECHADO (2026-08-13)** — **FEAT-10** ·
   **UX-12** · **UX-11** feitos.
10. ~~**FEAT-11 — trocar a cor na hora de produzir/vender**~~ ✅ **FECHADO (2026-08-13)** — opção
   **A + C** (dono): troca pontual na `/producao` **e** cor como dimensão da SKU do acabado.
11. ~~**Cluster UI/UX (auditoria de 2026-08-15)**~~ ✅ **FECHADO (2026-08-16)** — **UX-13 → UX-19 +
   TD-013**, os 7 passos: ~~① TD-013 + UX-17a (tokens)~~ · ~~② UX-13a (desktop)~~ · ~~③ UX-13b + UX-14
   (chrome mobile)~~ · ~~④ UX-15 (alvos + confirmação + avisos)~~ · ~~⑤ UX-16 (rótulo foca o campo)~~ ·
   ~~⑥ UX-19 (cor por faixa)~~ · ~~⑦ UX-17b (conversão dos 16 CSS)~~ — **todos FEITOS**.
   As 2 decisões que saíram do cluster: **[DEC-04]** ✅ (faixas de margem, virou o UX-19) e
   **[DEC-05]** (lucide nos controles) — esta **segue aberta como tarefa de código**, sem posição na
   fila; ver "Decisões em aberto".

### Porquês da ordem — decisões de 2026-07-20 e do cluster UI/UX de 2026-08-15

### Porquês da ordem (decisões de 2026-07-20)

- **UX-02 subiu do Tier 4 pro 1º lugar:** não é cosmético — `DEFAULT_FIXED_COSTS` diz `machines: 2` e
  `DEFAULT_CAPACITY` diz `machines: 1` (`constants.ts:68-75`). Duas fontes de verdade discordando: o
  rateio de custo fixo (que entra no preço) assume 2 máquinas, o painel do catálogo assume 1. Com 2
  impressoras reais, o catálogo subestima peças/mês e dispara o alerta de capacidade cedo demais.
- **7e veio antes do FEAT-06 (e já fechou):** o FEAT-06 **congela a composição de custo inteira** na
  produção; com o 7e feito, ele congela o quadro completo (já com insumos) de uma vez. O buraco de
  COGS que motivava a ordem está fechado — o `frozenCost` soma insumos desde 2026-07-20.
- **TD-003/TD-006 antes do Dashboard:** TD-003 é a base da visão de "gargalo" — consertar antes evita
  construir o painel sobre conta errada e refazer. TD-006 sobe porque **o marco** (recadastro de tudo:
  produtos, filamentos, acessórios, impressões e vendas) chega como um volume grande de documentos de
  uma vez — paginação importa *no* marco, não meses depois.
- **NÃO confundir (verificado no código):** nem TD-003 nem TD-006 afetam a **gravação** dos dados. As
  horas de máquina do histórico vêm dos eventos de produção somados por `machineId`
  (`machineRoi.ts:87-89`) — dado real, já correto. TD-003 afeta só a **projeção** de capacidade na
  tela; TD-006 é custo/desempenho de **leitura**. O registro do `/maquinas` não está contaminado.
- **UX-06 + UX-07(a) viraram a próxima (dono, 2026-08-10):** os dois são o mesmo padrão "linha +
  dropdown de detalhe" e são só reempacotamento de apresentação (o dado já existe) — baratos e
  coerentes de fazer juntos. Ficam à frente do FEAT-03 (polimento comercial, sem bloquear nada).
  **UX-07(b) fica de fora do cluster** (decisão do dono, mesmo dia): as **informações de produção**
  na aba Produtos do estoque (ligar o acabado aos eventos que o geraram) **vão pro Dashboard** — é a
  mesma agregação server-side (buscar `producao` por `productId` sob demanda). O dropdown de Produtos
  entra só com o que já existe no card (composição do valor parado, custo/un, margem congelada).
- **FEAT-03 desceu pra penúltimo (dono, 2026-07-31):** o PDF/branding é comercial mas não bloqueia
  nada do fluxo de custo/estoque; o dono preferiu fechar a infra de cálculo (Tier 4 + TD-003/TD-006)
  antes de investir no acabamento do orçamento. Segue **antes** do Dashboard (que é sempre o último —
  só vale com venda real acumulada).

### Porquês da ordem do cluster UI/UX (2026-08-15)

> A ordem por número (13→19) era só a ordem em que a auditoria achou os problemas. Estes são os
> porquês da ordem de **execução** — todos verificados no código, não impressão de leitura.

- **① TD-013 e os tokens vêm ANTES, não depois.** Os dois são pré-condição do resto:
  - **TD-013** é um seletor de **elemento** (`table`) global morando no CSS de uma página
    (`catalog.css:72`) e **já obrigou um antídoto** (`cesta-recibo.css:330`). Normalizar o visual com
    ele mentindo por baixo é caçar fantasma em 16 arquivos. Correção de 2 linhas.
  - **UX-17a** (só declarar `--space-*`/`--radius-*`/`--text-*` no `base.css`) é barato, mexe em **1**
    arquivo e **não quebra nada** porque ninguém consome os tokens ainda. Feito antes, os passos
    ②–⑥ **já nascem usando token** e a conversão do ⑦ encolhe.
- **② UX-17b (conversão) fica por ÚLTIMO, e é por isso que o UX-17 foi partido.** Medido: **5.055
  linhas de CSS em 16 arquivos e 219 declarações de `font-size`**. Os passos ②–⑥ escrevem CSS novo
  (colapso do card, navbar→painel lateral, botões de 32px, cor por faixa). Converter antes = reescrever
  duas vezes; converter tudo depois **sem** os tokens existirem = escrever com valores velhos e refazer.
  Partir em `17a` (tokens) + `17b` (conversão) resolve os dois lados. **Metade do CSS da navbar vai ser
  jogada fora pelo UX-14** — não faz sentido normalizá-la antes disso.
- **③ UX-13b e UX-14 são a MESMA tarefa e devem ir juntos.** Os dois disputam o chrome do celular: o
  UX-13b põe barra fixa no rodapé com requisito explícito de **não cobrir nada** (`padding-bottom` no
  `.wrap` + convivência com o `.back-to-top`), e o UX-14 reconstrói o topo. Separados, a conta de
  espaço vertical e o `.back-to-top` são reavaliados duas vezes.
- **④ Mas o UX-13a (desktop) vai sozinho ANTES.** É só o `<details>` — isolado, não toca mobile e
  resolve o item **mais grave** do lote (o preço sumindo ao mexer no markup) já no passo ②.
- **⑤ UX-18 e UX-19 não eram tarefas de código.** O UX-18 diz no próprio texto que "precisa do martelo
  do dono" e tem overlap com o branding, que está **⏸ por tempo indeterminado** — na posição 6 da fila
  antiga ele **travaria** o UX-19 e o UX-17 atrás de uma decisão que pode não vir tão cedo. Virou
  **[DEC-05]**. O UX-19 precisa das faixas de margem (**[DEC-04]**): o código continua na fila, só a
  pergunta saiu na frente.

> Diretriz 7 (dados descartáveis, marco futuro) cobre o backlog inteiro → **nenhum item precisa de
> migração**. Não reordenar por causa disso.

### Bugs fechados (BUG-02…BUG-05) e UX/navegação fechada (UX-01…UX-12)

### Bugs
- ~~**[BUG-05] Produto multi-etapa não aparece inteiro no estoque (mostra 0 un.)**~~ ✅ **FEITO
  (2026-08-10)** — era só na **venda** do inteiro (a aba Produtos já mostrava conjuntos = min das partes).
  A produção do inteiro-com-subitens credita as SKUs das **partes** (não uma SKU `__whole__`), então a
  venda do inteiro lia/consumia a SKU vazia → **0 disp.** e sem baixa. Nova primitiva **`consumeWholeFifo`**
  (`finishedGoods.ts`) drena uma de cada parte; a reconciliação (caminho `acabado`) e o saldo do `SaleModal`
  (`assemblableWholes`) passam a usá-la p/ o inteiro. +6 testes.
- ~~**[BUG-04] Métricas do card de ROI vazam pra fora da caixa**~~ ✅ **FEITO (2026-08-10)** — `.roi-metrics`
  passou de `repeat(4, 1fr)` (não cabia "R$ 861,92/mês" em card de 340px) p/ **2×2** + `min-width: 0` nas
  células. **Onde:** `machines.css`.
- ~~**[BUG-03]** Histórico de vendas e extrato de rolos fora de ordem~~ **✅ FEITO (2026-07-19)** — `Recibo`
  ganhou `createdAt` (max dos itens) e os sorts por data usam `(saleDate, createdAt)`; `colorStatement`
  desempata por `seq` (createdAt do evento no consumo). Rolos/ajustes seguem só com o dia.
- ~~**[BUG-02]** Produção/estoque ignoravam o `piecesCount`~~ **✅ FEITO (2026-07-19)** — 1 evento = 1
  placa credita N acabados a custo÷N; encomenda ÷pieces; `/producao` com campo "Quantas placas". Detalhe
  em `HISTORICO.md`.

### UX / navegação e organização
- ~~**[UX-01] Barra de navegação unificada**~~ **✅ FEITO (2026-07-19)** — componente `NavBar.tsx`
  (6 destinos fixos + tema + logout; rota ativa via `usePathname`/`aria-current`) reusado pelo `Header`
  e pelos 5 headers de página; "Início/Calculadora" = navegação limpa. Detalhe em `HISTORICO.md`.
- ~~**[FEAT-07] Página de catálogo dedicada**~~ **✅ FEITO (2026-07-20)** — rota `/catalogo` +
  `CatalogPage`; "editar" navega pra `/?load=<id>` (ajuste no render + `replaceState`; `<Suspense>` na
  raiz p/ o `useSearchParams`, `/` seguiu estática). `SaleFlow` extraído p/ não duplicar a fiação do
  `SaleModal`. **Habilitado por ele (não feito):** reorganizar o form da principal e enriquecer o card
  do catálogo com mais dados (composição, margem…).
- ~~**[UX-02] Capacidade do catálogo congelada**~~ **✅ FEITO (2026-07-20)** — `capacitySettings` virou
  derivação (`useMemo`) do `fixedCostRate` persistido, mesma fonte do rateio de custo fixo.
- ~~**[FEAT-08] Ações "Produzir"/"Orçar" no card**~~ **✅ FEITO (2026-07-20)** — as 3 ações (vender,
  produzir, orçar) na coluna Ações e no painel expandido, **para o inteiro e por subitem**; seed
  `?produto=&subitem=`. Detalhe (inclusive por que a "derivação pura" não servia) em `HISTORICO.md`.
- ~~**[UX-03] Nome do produto truncado sem escape no catálogo**~~ ✅ **FEITO (2026-08-10)** — o painel
  expandido agora abre com o **nome inteiro** (`.cd-product-name`, `overflow-wrap: anywhere`), resolvendo
  o que o `title` não cobria (toque/mobile sem hover + o expandido não repetia o nome). `title` na linha
  fechada mantido pro hover no desktop. **Onde:** `ProductCatalog.tsx` + `catalog.css`.
- ~~**[UX-04] Catálogo mostra só a 1ª máquina em produto multi-etapa**~~ ✅ **FEITO (2026-08-04, junto do
  TD-003)** — `MachineCell` lista as máquinas distintas de `machineUsage` ("A1 +1" compacto na linha,
  lista inteira no painel expandido); mantém o `machine-missing-badge` (TD-009).
- ~~**[UX-05] Busca/filtro nas listas**~~ ✅ **FECHADO** *(guarda-chuva; pedido do dono, 2026-08-04)*.
  - ✅ **Fase 1 (2026-08-07)** — busca **client-side** nas listas de **teto natural**: catálogo + 3 abas do
    estoque. Helper `src/lib/text.ts` (`matchesQuery`) + `SearchBox.tsx`.
  - ✅ **Fase 2/3 = TD-006 (2026-08-10)** — vendas + produção **paginam** e a busca virou **filtro no
    Firestore** (produto por `where(==)` + período por range no mesmo campo do `orderBy` → sem índice
    composto) **+** caixa de nome que refina a janela (`HistoryFilterBar`). Detalhe em `HISTORICO.md`.
  ⚠ **Ressalva:** paginar resolve a **lista**, não a **análise** — ROI (`/maquinas`) e o Dashboard
  **agregam o histórico inteiro**; eliminar de vez exige agregação server-side (adiar pro Dashboard).
- ~~**[UX-06] Detalhe expansível por item em `/vendas` e `/producao`**~~ ✅ **FEITO (2026-08-10)** — item do
  recibo (`/vendas`) e produção recente (`/producao`) viraram **linha clicável + dropdown**; o dropdown
  **absorveu** o popover `CostDetail` (composição precificado × real inline) e ganhou máquina, horas,
  filamento por cor e desconto congelado. **Onde:** `SalesPage.tsx`/`ProductionPage.tsx` +
  `cesta-recibo.css`/`production.css`.
- ~~**[UX-07(a)] Aba Produtos do estoque em linha + dropdown**~~ ✅ **FEITO (2026-08-10)** — os cards em
  grade viraram **linhas + dropdown** (`.fg-list`/`.fg-head`/`.fg-details`); o "valor parado" saiu do
  popover pra linha e a composição (barras + `CostBreakdownTable`), partes e margem congelada desceram pro
  dropdown. **Onde:** `StockPage.tsx` (`renderProductCard`) + `stock.css`.
  - **[UX-07(b)] — produção do acabado:** ligar cada acabado aos eventos de `producao` que o geraram
    (camadas da SKU têm `sourceEventId`). Puxa buscar `producao` por `productId` sob demanda (pós-TD-006 a
    coleção não é assinada inteira) = a mesma agregação server-side do painel. **Adiado pro Dashboard**
    (dono, 2026-08-10) — ver o item [Dashboard].

- ~~**[UX-08] Vender + produzir direto do estoque**~~ ✅ **FEITO (2026-08-11)** — a aba **Produtos** ganhou,
  por linha (grid alinhado + rótulos de seção), **"Vender"** e **"Produzir"** pro inteiro/conjunto E por
  subitem: "Vender conjunto (N)" + "Produzir conjunto" no topo, "Vender"/"Produzir" em cada peça (o Produzir
  da parte **fecha conjunto** — imprime só a que falta). Vender semeia o `SaleModal`
  (`saleContextFromResult`/`FromSubitem`); Produzir roteia pra `/producao?produto=&subitem=` (FEAT-08, default
  1 placa) e **"Ver no catálogo"** abre o produto expandido lá (`/catalogo?produto=`; `ProductCatalog` ganhou
  `initialOpenId` + scroll; página em `<Suspense>`). `StockPage` computa o `PricingResult` completo
  (`pricingByProduct`) e fia o `SaleFlow`. Só p/ produto vivo no catálogo. **Correções no polimento:** botão
  não estica (especificidade `.fg-details .btn.fg-sell-btn` vs `flex:1` do `.btn.primary`) + **bug do origem**
  que abria como "encomenda" (`SaleModal` abre com `goods=[]`; `useEffect` reavalia quando os acabados chegam,
  `touchedOrigem` preserva escolha manual). **Onde:** `StockPage.tsx` + `SaleModal.tsx` + `CatalogPage.tsx` +
  `ProductCatalog.tsx` + `catalogo/page.tsx` + `stock.css`.

- ~~**[UX-09] Rótulo do payback em `/maquinas`**~~ ✅ **FEITO (2026-08-13)** — aviso em 3 pontos: nota
  no topo (`.roi-note.roi-warn`), linha por card sob a barra de payback (`.roi-caveat`, viaja junto do
  número) e o sub do "Lucro acumulado" ("líquido de taxas · bruto de custo fixo"). **Paliativo por
  design** — o número honesto (menos fixo, menos perdas) só existe no [Dashboard], que deve virar a
  fonte do payback. **Onde:** `MachinesPage.tsx` + `machines.css`.
- ~~**[UX-10] Margem líquida no catálogo**~~ ✅ **FEITO (2026-08-13)** — `worstPaymentFee` +
  `netMarginPct` (puras, em `paymentFees.ts`; a segunda delega ao **mesmo** `saleItemFinancials` da
  venda real) + componente `NetMarginHint` em 3 superfícies: célula "Margem" da tabela (compacta),
  card expandido do catálogo e card de preço da **calculadora** (onde o markup é decidido). Some
  quando toda taxa é 0. `CatalogPage`/`PricingCalculator` passaram a chamar `useFees()` — só
  exibição, nenhuma taxa entra no preço. +7 testes. Writeup em `HISTORICO.md`.

- ~~**[UX-11] Ações da calculadora no painel da direita**~~ ✅ **FEITO (2026-08-13)** — o `.btn-row` e o
  erro de validação saíram do `ProductForm` e viraram o bloco **`.result-actions`** no **topo** do card
  (Salvar largura total · Vender/Produzir/Orçar em 3 colunas · Cancelar/Salvar como novo ao editar);
  esquerda = só input. **Decisão do dono (a mais importante):** as **4** ações exigem produto salvo —
  vender sem id caía em `missingProduct` e gravava receita **sem** evento de produção, **sem** baixa de
  filamento/insumo e **sem** horas no ROI. `ensureSavedProductId` valida → salva (update ou create) →
  age, e **mantém o form editando** o produto (não limpa, ao contrário do botão Salvar). `createProduct`
  passou a devolver o id do `addDoc`. **Onde:** `ProductForm`/`PricingResultCard`/`PricingCalculator` +
  `usePricingForm` (expõe `setEditingProductId`) + `productsRepository`/`useProducts` + `sections.css`.
- ~~**[UX-12] Break-even abaixo do custo total**~~ ✅ **FEITO (2026-08-13)** — o balão desceu pra
  depois do `breakdown-total` (e da linha "Total da impressão", pra não partir o bloco de custo em
  produto multi-peça); `.break-even-box` ganhou `margin-top`. Só JSX + CSS, cálculo intacto.

### Cluster UI/UX — auditoria de 2026-08-15 (UX-13→17 + UX-19 + TD-013): os 7 passos, todos fechados

### Cluster UI/UX — auditoria de 2026-08-15 (UX-13→17 + UX-19 + TD-013; o UX-18 virou DEC-05)

> **Origem:** auditoria de UI/UX pedida pelo dono, feita com o site **rodando** (`pnpm dev`, login real),
> em **1280×900** e **375×838**, com medições no DOM — não é impressão de leitura de código. As decisões
> de escopo abaixo (marcadas **Decidido**) são do **dono, 2026-08-15**, no mesmo chat da auditoria.
> **Situação (2026-08-16): CLUSTER FECHADO** — os 7 passos (①–⑦) estão feitos. Nada aqui segue aberto.
> **Os blocos seguem em ordem de ID** (fácil de achar pelo número); a **ordem de execução** é o
> `①②③…` marcado em cada um — ver "Ordem de prioridade" item 11 e os porquês acima.

- ~~**[UX-13] O preço some justo quando se mexe no markup**~~ ✅ **FECHADO (2026-08-15)** — *era o mais
  grave do lote.* **▸ ~~Passo ② = UX-13a (desktop)~~ ✅ · ~~Passo ③ = UX-13b (celular, com o UX-14)~~ ✅.**
  **Medido:** `.result-card` é `position: sticky; top: 20px`, mas mede **1286px** de altura contra uma
  viewport de **910px**. Um `sticky` mais alto que a tela **nunca prende no topo** — rola junto até o
  próprio fim. Com o slider de markup à vista, o `R$ 27,14` estava **403px acima** da borda superior.
  No celular é pior: `responsive.css:26` força `position: static`, a página vai a **3314px** e o preço
  (offset 2080px) fica **569px abaixo** do slider (1511px). Ou seja: a interação central de uma
  calculadora de preço — mexer no dial e ver o número — **não funciona em nenhum dos dois tamanhos**.
  **Decidido (dono):**
  - ~~**[UX-13a] Desktop — colapso, sem código novo de layout**~~ ✅ **FEITO (2026-08-15, passo ②)** —
    break-even + rentabilidade + capacidade foram pra um `<details className="result-advanced">`
    ("Ver informações avançadas", chevron lucide) **uncontrolled** (sem prop `open`): nasce fechado e o
    estado do usuário sobrevive aos re-renders — o card redesenha a cada tecla. O `<details>` é
    renderizado **sempre**, com o break-even condicional **dentro** (condicionar o próprio `<details>`
    o remontaria e fecharia sozinho quando o break-even aparecesse/sumisse). **Ficou de fora:** o
    "Total da impressão (N peças)" (decisão do dono — é preço, não info avançada).
    **Medido no site rodando (1280×900, produto real):** card **1392px → 624px** fechado (−55%); com o
    slider de markup no centro da tela o `.result-price` passou de **−509px** (fora de vista) para
    **+63px**. ⚠ **A ressalva do dono confirmada:** **aberto**, o card volta a 1392px e o preço vai a
    −509px — custo aceito de abrir, não regressão.
    **Junto (feito):** o painel de custo fixo **desativado** deixou de renderizar o `.fc-body` (banner
    **319 → 85px**). Não se perdeu nada: o `.fc-body.disabled` já era `pointer-events: none`, ou seja
    os campos nunca foram editáveis com o toggle off — ligar o toggle segue sendo o caminho pra editar
    `machines`/`hoursDay`/`daysMonth`, que são a fonte de onde a capacidade deriva (TD-010).
    **Onde:** `PricingResultCard.tsx` · `FixedCostsPanel.tsx` · `sections.css` (`.result-advanced` novo,
    já escrito em token do UX-17a; `.fc-body.disabled` apagado). O `sticky` do `.result-card` **não foi
    tocado** — o ponto do item era que ele já estava certo.
  - ~~**[UX-13b] Celular — barra fina fixa**~~ ✅ **FEITO (2026-08-15, passo ③)** — componente novo
    `MobilePriceBar.tsx`: faixa de **56px** fixa no rodapé com preço/peça · margem · markup ao vivo, e
    **um toque rola até o `.result-card`** (decisão do dono nesta sessão). Só a calculadora a tem
    (`<main class="wrap has-price-bar">`) e só abaixo de 760px. **O requisito de "não cobrir nada" é
    garantido por três regras amarradas ao MESMO token `--price-bar-h` (base.css):** a própria barra, o
    `padding-bottom` do `.wrap.has-price-bar` (60 → **116px**) e o `.back-to-top`, que sobe a altura da
    barra via `body:has(.price-bar)` — regra posta no **dono legítimo** do botão, não como antídoto em
    outro arquivo (lição do TD-013). **Medido com a página rolada até o fim: 60px de folga** entre o
    último card e o topo da barra; sem `:has()` o navegador só perde o deslocamento (degrada, não quebra).
  - ~~**Junto — painel de custos fixos desativado colapsa**~~ ✅ **FEITO no passo ②** (com o UX-13a).
  **Onde:** `PricingResultCard.tsx` · `FixedCostsPanel.tsx` · `MobilePriceBar.tsx` · `PricingCalculator.tsx`
  · `sections.css` · `base.css`.

- ~~**[UX-14] No celular, metade da tela é cabeçalho**~~ ✅ **FEITO (2026-08-15, passo ③, junto do
  UX-13b)** — abaixo de 760px a `.navbar-bar` **sai do fluxo e vira gaveta** (280px, entra pela direita,
  fundo escurecido) e no lugar dela fica a `.navbar-mobile-head`: **nome da página + ☰**. Fecha no ✕, no
  fundo, no **Escape** e ao navegar (o `onClick` do `<Link>`, e não um efeito no `pathname` — setState
  dentro de effect é erro de lint aqui). Fechada, a gaveta é `visibility: hidden`, então os 7 links
  **saem da ordem de tabulação** em vez de ficarem focáveis fora da tela; aberta, o fundo não rola.
  **Medido antes × depois (mesma sessão, 375×838):** `.navbar` **227 → 46px** e o 1º campo **421 →
  172px** = **48,7% → 19,9%** da tela. Desktop **idêntico** (navbar 53px, 1º campo 240px, página 1384px).
  **Junto (feito):** os 7 `<Link>` perderam o sublinhado (`text-decoration: none` na classe
  `.icon-label-button`, nunca num seletor `a` nu — TD-013); e o **`.subtitle` some no celular**
  (decisão do dono nesta sessão: ~60px de texto decorativo no topo; marca, h1 e status ficam).
  **Faxina obrigatória junto:** o bloco mobile da navbar morava no **`quote.css`** (CSS da página de
  orçamento) — mesmo defeito de escopo do TD-013 e, por ordem de `@import` (12º vs 2º), venceria o novo.
  Foi **apagado** e o que sobrevivia (`.navbar-page-actions > * { flex: 1 }`) foi pro `header.css`.
  **Onde:** `NavBar.tsx` · `header.css` · `forms.css` · `responsive.css` · `quote.css`.
  ⚠ Alternativa **descartada** pelo dono: barra fixa no rodapé com os 4 mais usados + "•••".

- ~~**[UX-15] Alvos de ação minúsculos no catálogo + `window.confirm` genérico**~~ ✅ **FEITO
  (2026-08-16, passo ④)** — alvos de **32px** e o **Excluir afastado** (divisor mudou de lugar; faixa
  "Ações" 146 → 196px). Os **8** `window.confirm` viraram `ConfirmDialog` + `useConfirm`
  (`ask(): Promise<boolean>`, foco no Cancelar, Escape), com texto que **nomeia o alvo e diz o que NÃO
  é afetado**. ⚠ **Reverteu** a decisão do TD-004 (confirm destrutivo nativo) — registrado lá.
  **Junto, a pedido do dono:** os avisos inline viraram **um** componente (`FeedbackNote`/`useFeedback`;
  sucesso some em 5s, erro fica com ✕), `guardOnline`/`errorMessage` foram pro `src/lib/errors.ts`
  (eram 4 cópias) e a **`/vendas` ganhou o aviso que nunca teve** — a exclusão que estorna acabado +
  filamento gravava sem `try/catch` e falhava em silêncio. Writeup e as medições: `HISTORICO.md`.

- ~~**[UX-16] Rótulo não foca o campo**~~ ✅ **FEITO (2026-08-16, passo ⑤)** — `useId()` +
  `htmlFor`/`id` (**não** aninhado: `.section-label` é `display:flex`, o input viraria filho de flex).
  ⚠ **O escopo dobrou na medição, e o dono aprovou:** além dos 44 `<label>` havia **67
  `<div className="section-label">`** — rótulo *falso*, quase todos nos **modais e páginas** (o item
  original, medido só por `<label>`, teria consertado a calculadora e deixado o resto do app igual).
  **As 3 regras aplicadas:** rotula **campo** → vira `<label htmlFor>`; rotula **cabeçalho ou valor
  só-leitura** → segue `div` (label sem controle engana o leitor de tela); rotula **grupo** (chips de
  máquina, caixas do subitem) → `role="group"` + `aria-labelledby`. `aria-label` redundante foi
  **removido** (com label real ele vence o texto visível — WCAG 2.5.3); campo em linha de tabela
  (acessórios, filamento da `/producao`), que não tinha nome nenhum, **ganhou** `aria-label`.
  **Medido rodando:** rótulo clicável **1 → 19** (`/`), **0 → 8** (`/orcamento`), **2 → 11**
  (`/producao`), **0 → 7** (SaleModal), **0 → 5** (StockColorModal); **zero** campo sem nome acessível.
  **Zero visual, provado:** desfazendo a troca de tag ao vivo (método do TD-013) deu **0 diferenças**
  em 49 rótulos e altura idêntica em toda página. **Onde:** 15 componentes de formulário.

- **[UX-17] Sistema visual: escala uniforme (sem perder densidade) + tokens**
  **▸ PARTIDO EM DOIS (2026-08-15), e é a mudança de ordem mais importante do cluster:**
  - ~~**[UX-17a] — passo ①: só DECLARAR os tokens**~~ ✅ **FEITO (2026-08-15)** — bloco `:root` próprio
    no `base.css` (separado das cores, que mudam com o tema): **12** `--space-*` (nomeados pelo valor em
    px, pra conversão mecânica), **8** `--radius-*` (+`pill`/`circle`) e **9** de tipografia
    (`--text-2xs`…`--text-xl` + 3 `--display-*`). Escala **extraída do inventário real**, não inventada —
    os dominantes (font 11/12/13, espaço 8/10/12, raio 8/10/12) foram preservados, então converter **não
    deve mexer no visual**. Os órfãos (9.5/11.5/12.5px, raio 2/5/7/9/14/20…) **não ganharam token de
    propósito** — a lista deles está no comentário do `base.css` e eles morrem no UX-17b.
    Zero consumidor ainda ⇒ zero mudança visual neste passo.
  - ~~**[UX-17b] — passo ⑦ (último): CONVERTER os 16 arquivos de `styles/`**~~ ✅ **FEITO
    (2026-08-16)** — **875 declarações trocadas: 779 literais + 96 ÓRFÃOS colapsados.** Tipografia de
    **23 tamanhos → 9**, raio de **15 → 8**. ⚠ **A contradição que a medição expôs, e o martelo do
    dono:** o `base.css` prometia "converter não deve mexer no visual" e o item mandava "matar os
    órfãos" — **as duas coisas não podem ser verdade**; o dono escolheu a **escala curta**, aceitando
    o drift de 1–2px, e a promessa foi retirada do comentário. Única exceção que **sobe** em vez de
    descer: `15px → 16px` em `.field-input`/`.btn` no celular (abaixo de 16px o iOS dá zoom ao focar).
    **O medo do TD-013 quase não se aplicou:** só existiam **4** seletores de elemento nu no app
    inteiro (`button, input, select`, `button`, `h1`×2) e nenhum segurava espaço/raio de outra página.
    **Prova:** 25 estados medidos antes×depois no DOM (7 rotas × 2 tamanhos + 3 abas + 3 modais +
    gaveta) — **toda** diferença cai na lista de órfãos, **0 elemento sumiu**. Writeup e as medições
    por rota: `HISTORICO.md`. ➕ **Junto:** `.btn:disabled` foi do `stock.css` pro `forms.css` (última
    regra global de `.btn` fora do dono) e as **abas da `/estoque` viraram chip**, byte a byte iguais
    às da NavBar nos 2 temas — resolvendo os "dois paradigmas de aba". ➕ **Achado de brinde:** o
    destino ativo da NavBar tinha fundo `rgba(74,158,118,.12)` — **verde cru**, ao lado de borda e
    texto laranja, sem responder ao tema; virou `--chip-active-bg`.
  **Medido antes (2026-08-15):** das ~220 declarações de `font-size`, **155 entre 10 e 13px** (65×
  `12px`, 50× `11px`, 40× `13px`), **23 tamanhos distintos** incluindo `11.5`/`12.5`/`9.5px`. Idem
  `border-radius`: **15 valores**. O `base.css` tinha 19 variáveis, **todas de cor**.
  ⚠ **Decidido (dono): manter DENSO, mas UNIFORME.** **Não** era para aumentar o corpo do texto (a
  proposta de subir pra 13–14px foi **recusada** — o dono prefere mais linhas por tela).
  **Onde:** `base.css` (tokens) + os **16** arquivos de `styles/`.

> **[UX-18] saiu daqui em 2026-08-15** → virou **[DEC-05]**, na seção "Decisões em aberto (DEC-*)".
> Motivo: o próprio item dizia "precisa do martelo do dono" e tem overlap com o branding (⏸ sem data);
> deixá-lo na fila de código travaria por tempo indeterminado tudo que viesse depois dele.

- ~~**[UX-19] Números sem gradação + ênfase no lugar errado**~~ ✅ **FEITO (2026-08-16, passo ⑥)** —
  a régua da **[DEC-04]** virou o módulo puro **`lib/marginTier.ts`** (+12 testes) e a cor entrou em
  **4 superfícies**: o item citava 2, mas o dono aprovou incluir o **card de preço da calculadora**
  (onde o dial de markup é mexido) e a **margem congelada do estoque**. **Nenhuma regra CSS existente
  foi editada** — `base.css` é o 1º `@import` e perde todo empate, então a faixa vai sempre num
  `<span>` próprio. **Medido:** 93 produtos = **20 bom · 63 ok · 10 ruim**; dial ao vivo 45% vermelho
  → 54% âmbar → 65% verde; **0 mudança de geometria** (clone do `<main>` sem os 372 spans: 7114px
  idêntica, 0 de 187 linhas diferentes). **2 achados que só a medição pegou:** `.sale-pos`/`.sale-neg`
  estavam **mortos** no cabeçalho do recibo (a Taxa nunca ficou vermelha) e `65%` saía âmbar E verde
  na mesma tela (a faixa lia o valor cru, a tela o arredondado). **Junto:** "Sem cliente" ficou mudo.
  Writeup + os contrastes medidos: `HISTORICO.md`.

- ~~**[TD-013] `table { min-width: 600px }` é seletor global morando no CSS do catálogo**~~ ✅ **FEITO
  (2026-08-15, passo ①)** — os 3 seletores de elemento (`table`/`th`/`td`) viraram `.catalog-card *` e o
  antídoto do `.cost-detail-table` (`cesta-recibo.css`) saiu junto. **Achado na execução:** o
  `min-width: 600px` foi **apagado**, não escopado — o próprio catálogo já o anulava mais abaixo
  (`.catalog-card table { min-width: 0 }`, do bloco "cartões também no desktop"), ou seja era regra
  **morta no catálogo e viva em todo mundo**. A especificidade subiu 0,0,1 → 0,1,1 e passou a empatar
  com `.main-row td`/`.details-row td`/`td.col-name`, todos posteriores na cascata → seguem vencendo.
  ⚠ **Um efeito colateral pego na verificação visual:** o `border-top` do `td` global era o que separava
  o 1º item do cabeçalho do recibo em `/vendas` — e em recibo de UM item era a **única** borda da linha
  (o `border-bottom` cai no `tr:last-child`). Foi **reposto explicitamente** em `.recibo-items td`, o
  dono legítimo da regra. **Medido no site rodando:** com isso a altura da página de `/vendas` voltou a
  **3975px**, byte a byte igual ao estado anterior, e catálogo (desktop e mobile) mediu **idêntico**.
  **Ganho real, não só higiene:** no celular o recibo era forçado a **600px** (255px de scroll lateral
  dentro do card) e agora mede **453px** (108px) — o global estava apertando uma tabela que não era dele.

### Tier 2 — comerciais já fechados (FEAT-09 · FEAT-10 · FEAT-11 · FEAT-06)

### Tier 2 — comerciais
- ~~**[FEAT-09] Desconto na venda**~~ ✅ **FEITO (2026-08-10)** — por item **XOR** no total do recibo, em
  **R$ ou %**, congelado no snapshot (`discountKind`/`discountInput`/`discountAmount`). Taxa incide sobre o
  valor COM desconto; rateio do total **proporcional à receita** da linha. Matemática em `paymentFees.ts`
  (`discountAmountOf`/`apportionDiscount`/`saleItemFinancials`), UI no `SaleModal`, exibição em `/vendas`+CSV.
  Writeup em `HISTORICO.md`. **≠ FEAT-03:** lá o desconto é semente do PDF do orçamento (proposta); aqui é a
  venda real (podem se conversar no futuro).
- ~~**[FEAT-10] Arredondamento "final 4,90 ou 9,90"**~~ ✅ **FEITO (2026-08-13)** — nasceu como "final
  X9,90" e o **dono ampliou pra 4,90 OU 9,90** (passo **5**, não 10), o que suaviza o salto: R$ 21 para
  em R$ 24,90 em vez de R$ 29,90. **Um** modo novo no seletor. Os dois modos psicológicos viraram a
  tabela `NINETY_STEP` + um bloco só (`"0.90"` inalterado). +3 testes (**329**).
  ⚠ **Piso assumido:** não há degrau abaixo de R$ 4,90 — preço menor sobe pra lá (travado em teste).
- ~~**[FEAT-11] Trocar a cor/filamento na hora de produzir ou vender**~~ ✅ **FEITO (2026-08-13)** —
  escopo **A + C** (dono). O `<select>` de cor da `/producao` vale para **qualquer** linha (não só
  avulso), com "avulso livre" mantido; e a **cor virou dimensão da SKU** do acabado
  (`skuKey(subitemId, colorKey)`), com `colorKeyOf` (chave **composta** em peça multicor) no
  `filaments.ts`. **A montagem do conjunto IGNORA a cor** — corpo azul + tampa vermelha é um produto
  legítimo, e cada parte tem a sua (`FilRow.stageKey` + `Subitem.stageKeys` levam a cor da linha até
  a parte certa). A venda de peça pronta ganhou **seletor de cor por parte** (só quando há 2+ cores
  com saldo), congelado no recibo; a **encomenda** segue na cor do cadastro. **Aviso ativo** na
  `/producao`: quanto a troca custou por peça e a margem resultante. +40 testes (**369**).
  ⚠ Diretriz 7: o saldo de acabados anterior vira o balde **"Sem cor"** e não se mistura com o novo.
  Writeup + as 5 decisões em `HISTORICO.md`.
- ~~**[FEAT-06] Aba Produtos rica / composição congelada**~~ ✅ **FEITO (2026-07-20)** — evento, camada
  do acabado e venda passaram a guardar o `FrozenCostBreakdown`; `CostDetail` ganhou o modo de 2 colunas
  (precificado × real); `/producao` rotulou os dois números órfãos; aba Produtos ganhou composição,
  custo/un, mini-barras e margem congelada. Writeup + as 3 decisões em `HISTORICO.md`.
  - ~~**Follow-up (ROI real)**~~ ✅ **FEITO (2026-07-31, Tier 4)** — ver abaixo.

### Tier 3 (TD-003 · TD-006 · TD-010 · TD-011 · TD-012) e Tier 4 inteiro — fechados

- ~~**[TD-010] Capacidade: os dois restos do UX-02**~~ ✅ **FEITO (2026-08-13)** — `CapacitySettings`
  ganhou `daysMonth` (subconjunto exato do `FixedCostRate`) e o horizonte virou `hoursDay × daysMonth`;
  a calculadora derivou o painel de `config/negocio` e o literal `DEFAULT_CAPACITY` foi **apagado**. Os
  campos do painel viraram **simulação local** (decisão do dono: não persistem, com aviso + "voltar ao
  padrão") + 3º campo "Dias de impressão/mês". Detalhe em `HISTORICO.md`.
- ~~**[TD-011] Capacidade ignora a própria taxa de falha**~~ ✅ **FEITO (2026-08-13)** — `piecesMonth`/
  `piecesDay` (e o breakdown por máquina) passaram por `× (1 − falha)`; `cyclesMonth` **não** mudou (a
  impressão que falha ocupa a máquina). O clamp da taxa virou `failureFractionOf` compartilhada com o
  `calculatePricing` — o mesmo número que infla o custo deflaciona o volume. Detalhe em `HISTORICO.md`.
- ~~**[TD-012] Teste do `chargedWithFee` + comentário da tarifa**~~ ✅ **FEITO (2026-08-13)** — novo
  `saleContext.test.ts` (10 casos, 326 no total) trava a composição `grossUp → roundPrice → round2`:
  idempotência sem taxa, os 6 modos de arredondamento sobre o preço inflado, "nunca abaixo do exato",
  bordas (preço 0/NaN, taxa negativa, clamp de 95%) e monotonicidade. Documenta a borda do `round2`
  final (corta até R$ 0,005). Comentário da `energyTariff` reescrito (o valor R$ 0,80 **fica**).
  Detalhe em `HISTORICO.md`.
- ~~**[TD-003] Capacidade não é por-máquina**~~ ✅ **FEITO (2026-08-04)** — modelo do **gargalo**: máquinas
  distintas rodam em paralelo, quem limita é a mais ocupada (`max` das horas por máquina, não a soma).
  Mantém os dois botões (máquinas dedicadas + horas/dia) — é estimativa branda por decisão do dono.
  `machineBreakdown` no `CapacityResult` mostra gargalo × folga. Detalhe em `HISTORICO.md`.
- ~~**[TD-006] Paginação**~~ ✅ **FEITO (2026-08-10)** — /vendas e /produção paginam (limite crescente +
  realtime), totais via aggregation query, estorno resolve eventos por id, busca server-side (junto do
  UX-05 Fase 2/3). Produtos/estoque seguem inteiros (teto natural). Detalhe em `HISTORICO.md`.

### Tier 4 — menores/oportunistas ✅ FECHADO (2026-07-31)
- ~~**Numeração de orçamento derivada no browser**~~ ✅ **FEITO** — contador atômico `config/orcamentoSeq`
  (transação), reservado ANTES do PDF; `reserveQuoteNumber` em `quotesRepository.ts`. Efeito colateral
  aceito: offline não gera mais orçamento (o número precisa ser reservado no servidor).
- ~~**Labor incluído na reserva de falha**~~ ✅ **DECIDIDO: manter** (dono, 2026-07-31) — labor segue no
  `printingCost` e, portanto, na reserva de falha. Sem mudança de código.
- ~~**[ROI pela depreciação real]**~~ ✅ **FEITO** — `machineRoi.ts` usa `realCostBreakdown.depreciation`
  (FEAT-06) na depreciação recuperada, repartida entre máquinas na proporção da precificada; venda antiga
  (sem o campo) cai no fallback precificado. Payback/lucro não mudaram (seguem por horas).
- ~~**[DEC-01] Semântica do `contributionMargin`**~~ ✅ **FEITO: opção A (renomear)** (dono, 2026-07-31) —
  `contributionMargin` → `profitPerPiece`; cálculo e ponto de equilíbrio idênticos. Opção B (corrigir o
  break-even) descartada.

### Decisões DEC-01…DEC-05 — todas já marteladas

### Decisões em aberto (DEC-*) — martelo do dono, não tarefa de código
> Molde do `DEC-01` e do "labor na reserva de falha" (Tier 4): o trabalho aqui é **decidir**, não
> implementar. **2 em aberto (2026-08-15)** — as duas saíram do cluster UI/UX e devem ser perguntadas
> **em paralelo com o passo ①**, pra não virarem bloqueio lá na frente.

- ~~**[DEC-04] Faixas de margem**~~ ✅ **DECIDIDO (dono, 2026-08-15): `< 50%` ruim · `50–65%` ok ·
  `> 65%` bom.** Cortes centrados na realidade atual (o catálogo varia de 49% a 72%, então a régua
  distribui o catálogo inteiro nas 3 faixas em vez de pintar tudo de uma cor só). **Mesma régua nas
  duas telas** — a opção "régua diferente por tela" foi oferecida e **não** escolhida. ⚠ Quem
  implementar o **UX-19** (passo ⑥) deve saber que os números medem coisas diferentes: catálogo =
  margem **precificada**; `/vendas` = lucro **realizado**, já líquido de taxa. **Destravou o passo ⑥.**

- ~~**[DEC-05] Dois sistemas de ícone competindo**~~ ✅ **DECIDIDO (dono, 2026-08-15): lucide em tudo
  que é CONTROLE**, emoji só como decoração deliberada (era o **[UX-18]**). Motivo do problema: emoji
  não herda `currentColor` (não responde ao tema), renderiza diferente em cada SO e desalinha ao lado
  de um lucide — hoje convivem em **9 componentes** (🧮 📚 🧾 📄 🖨️ 📦 🏭 · 🏷️ ⚡ 🔢 🎲 📈 🎯).
  ⚠ **Ressalva do dono, registrada:** **a marca está chegando** — fazer a troca já, mas contando com
  **um ajuste depois**, quando a identidade visual existir (overlap com **[branding/logo real]**);
  não tratar o resultado como final. **Volta como tarefa de código** — sem posição na fila do cluster
  (o dono decide quando entra; não bloqueia nenhum dos passos ②–⑦).

- ~~**[DEC-02] `lifeHours` = 10.000 h**~~ ✅ **DECIDIDO: 7.500 h** (dono, 2026-08-13) — meio da faixa;
  A1 passa de R$ 0,65/h a R$ 0,83/h e o cenário base sobe R$ 35,81 → R$ 37,45 (+4,6%) isoladamente.
  ⚠ O constante só **semeia** — as 2 máquinas salvas precisam ser editadas à mão em `/maquinas`.
  Detalhe em `HISTORICO.md`.
- ~~**[DEC-03] Markup incide sobre a mão de obra**~~ ✅ **DECIDIDO: NÃO incide mais** (dono, 2026-08-13) —
  adotada a fórmula de referência `(custo sem labor) × markup + labor + fixo`. A reserva de falha **continua
  cobrindo o labor** (preserva a decisão irmã do Tier 4), então o repasse é `labor × (1 + failureK)`.
  Cenário base: R$ 35,81 → **R$ 27,14** com as duas decisões juntas. Detalhe em `HISTORICO.md`.

### 7e — Insumos no estoque (fechado)

### 7e — Insumos no estoque
- ~~**[7e] Insumos no estoque**~~ ✅ **FEITO (2026-07-20)** — coleção `insumos` com FIFO por lote, 3ª
  aba na `/estoque`, `Accessory.supplyId` (avulso continua valendo) e baixa por unidade na produção.
  O `frozenCost` passou a somar insumos ⇒ **o lucro por peça de produções NOVAS caiu** (ficou
  correto); produções antigas não mudaram. Writeup em `HISTORICO.md`.


### Nota antiga do cabecalho do Tier 3 (TD-004 x UX-15) — movida na mesma faxina

### Tier 3 — infra de cálculo/leitura (TD-*) e, por último, o Dashboard
> Ordem interna: **TD-003 → TD-006 → TD-010/011 → TD-012 → Dashboard** (o Dashboard é o último item
> do backlog). **TD-001 a TD-012 fechados**; nesta seção só o **Dashboard** segue aberto.
> ⚠ **Correção 2026-08-15:** a linha antiga dizia "todos os TD-* fechados" — **falso desde 2026-08-15**,
> quando a auditoria abriu o **[TD-013]**, que mora na seção do cluster UI/UX (é o passo ① dele).
> **Sobre o [TD-004]:** está fechado (`HISTORICO.md`), **não** parcialmente aberto — mas a decisão
> registrada nele ("os `window.confirm` destrutivos seguem nativos por escolha") é **revertida pelo
> [UX-15]**. Quem for pegar o UX-15 deve saber que está mudando uma decisão, não completando uma.


---

## 📒 Arquivo do BACKLOG — os clusters de auditoria AUD-07…AUD-16 (faxina de 2026-08-31)

> **Por que este bloco existe.** O `BACKLOG.md` passou a valer ~2.170 linhas porque as **nove
> varreduras** foram escritas lá e **nenhuma foi movida depois de fechar** — ~85% do arquivo era
> material concluído, e o cabeçalho tinha 90 linhas de "⚠ LEIA PRIMEIRO" empilhados, um por
> varredura, cada um anulando parcialmente o anterior ("o backlog voltou a ZERO" aparecia três
> vezes, com três datas). Contra a Diretriz 8: o backlog é só o que está **aberto**.
>
> Abaixo, **na íntegra e sem edição** (só os títulos rebaixados um nível, para não competir com as
> seções deste arquivo), os clusters **AUD-07, AUD-09, AUD-12, AUD-13, AUD-14, AUD-15 e AUD-16**,
> as ondas de prioridade de 2026-08-16, os dois clusters de auditoria de UI/UX e layout responsivo,
> e o resíduo FORM-01/AUD-02. Tudo fechado. O que continuou aberto — e só isso — ficou no
> `BACKLOG.md`.
>
> ⚠ **O que sobreviveu à faxina e mora hoje no `BACKLOG.md`:** a frente do dono, o `[FEAT-03]`, o
> `[branding/rebrand]` (+ `[DEC-05]`/`[G2]`), o `[Dashboard]`, o `[AUD-08]`, as lacunas de prova
> que nenhuma varredura cobriu e as ressalvas vivas. Ao citar qualquer coisa daqui, lembre que é
> **registro**, não fila.
### ✅ ZERADO — cluster da varredura AUD-16 (2026-08-28) — a 9ª, varredura TOTAL por outra IA

> Relatório cru: `AUD-16-RELATORIO.md` (fora do repo, veio com o dono). 63 casos de import/export,
> 38 de rota/UI, 8 de matemática, 11 de persistência. Base dela: **778/778**, `lint`/`typecheck`/
> `build` verdes, 35/35 medições sem rolagem horizontal, matemática batendo com contas externas,
> 1 ciclo produção→acabado→venda→estorno real no Firestore.
>
> **Reconferido AQUI, com sonda rodando o parser real (2026-08-29)** — os 7 se reproduzem. E a
> reconferência **corrigiu o relatório em 3 pontos**:
> · `[E4]`, metade do subitem: `name: 2` **não estoura** — entra gravado como NÚMERO num campo que
>   o tipo declara `string`. Pior que o throw, porque é calado.
> · **caso novo que ela não achou:** `Filamentos JSON = [null]` estourava em
>   `Cannot read properties of null (reading 'id')` — mesma causa raiz do `[E4]`.
> · o **lote 3 dela (import >500 / timeout) NÃO é defeito**: os dois pontos já estão escritos e
>   tratados (`productsRepository.ts:99` informa quantos entraram; `withWriteTimeout` manda **não**
>   repetir a ação). É tradeoff documentado — vira ressalva, não item.
>
> ⚠ **O que este lote NÃO fez, de propósito:** o relatório pedia **bloquear** a confirmação quando
> houver erro de domínio. Este app **avisa e deixa o dono decidir** (TD-009, escrito na
> `CsvImportResult`: "Nada disso bloqueia"). Mantive a regra da casa — **bloquear é decisão do
> dono**, e é uma linha de código no dia em que ele mandar.

#### ✅ FECHADO — a fronteira de ingestão (lote 1, 2026-08-29)

`[E1]` `[E2]` `[E3]` `[E4]` — mesma causa raiz: **a normalização acontecia ANTES de uma validação
que não cobria tudo**, então o importador ora avisava, ora corrigia calado, ora estourava com erro
técnico. A assimetria denunciava: `Mao de obra (min) = -30` entrava negativa e acendia
`linha-invalida`; `Tempo (h) = -1` virava 0 com `issues: []`, porque tinha um clamp na frente.

| Repro | Antes | Agora |
|---|---|---|
| `Tempo (h) = -1` | `printHours: 0`, sem aviso | entra cru → `linha-invalida` ("Tempo de impressão") |
| `Taxa Falha (%) = -1 / 96 / 500` | 0 / 95 / 95, sem aviso | entra cru → `linha-invalida` ("Taxa de falha") |
| `[{"desc":"X","supplyId":"sup"}]` | `qty:0, unitPrice:0`, sem aviso | `acessorio-zerado` |
| `colorName: []` | **derruba a carga inteira** | `json-tipo-errado`, cor entra com nome vazio |
| `subitem name: 2` | grava número em campo `string` | `json-tipo-errado`, vira `"2"` |
| `[null]` / `[[]]` na lista | **throw** / cor fantasma de 0 g | `json-item-invalido`, item descartado |
| linha boa | sem aviso | **sem aviso** (nenhum falso positivo) |

O que mudou no código: o clamp do tempo (`Math.max(0, …)`) e o da taxa (`Math.min(95, Math.max(0,
…))`) **saíram**; `validateProduct` ganhou o **domínio 0–95 da taxa de falha**, que passa a valer
igual para o formulário e para o CSV; dois ajudantes novos (`textoJson`, `objetoJson`) cuidam da
FORMA do JSON, e as cores de etapa deixaram de ser uma **segunda cópia** do bloco de cores
(`parseFilamentList`). A matemática não corre risco com o valor cru: `failureFractionOf` tem o teto
de 95% dele, compartilhado com a capacidade (TD-011). **806/806 · lint ✅ typecheck ✅ build ✅.**

#### ✅ FECHADO — a dívida sem lote (lote 3, 2026-08-29)

`[E7]` — **decisão do dono (2026-08-29): representar a dívida, não bloquear.** Era a opção coerente
com a casa: o D4 já diz que saldo negativo é permitido e *visível*; o que faltava era um lugar onde
ele coubesse. Sem rolo lançado, `simulateFifo([], 200)` devolvia `moves: []` — a impressão não
baixava e não custava, enquanto a tela prometia "o saldo da cor fica negativo" (R$ 1,22 sem rolo ×
R$ 4,89 com, medido ao vivo pela auditoria).

O conserto **não é uma exceção nova — é tirar a exceção**: quando a cor (ou o insumo) existe no
Estoque e não tem lote nenhum, `planProduction`/`planSupplies` materializam um **lote de acerto**
(0 g / 0 un, preço o do cadastro, `note` que o nomeia no extrato) ANTES de simular. Daí em diante
não há caso especial: o overdraft do D4 cai nele, o custo entra pelo preço estimado, o `stockMove`
aponta um `rollId` que existe e o estorno devolve por ele.

| Repro (`planProduction`, cor sem rolo, 200 g a R$ 110/kg) | Antes | Agora |
|---|---|---|
| baixa | `moves: []` | 1 move de 200 g no `acerto_evt-1_verde` |
| custo real | **R$ 0,00** | **R$ 22,00** |
| saldo da cor | 0 (a dívida sumia) | **−200 g**, à vista |
| lançar a compra depois | — | −200 + 1000 = **800 g**, acerta sozinho |
| estorno | nada a devolver | round-trip fecha em **0** |
| 2 linhas da mesma cor | — | **1** lote de acerto, 250 g |
| cor avulsa / modo histórico | fallback sem baixa | **igual** (nada mudou) |

Detalhes: o id é determinístico (`acerto_<evento>_<doc>`), então **a prévia e o documento salvo
nomeiam o mesmo rolo** — que era a outra metade do "pronto quando". `planProduction`, `planSupplies`
e `planEventRows` ganharam um `at` opcional (só data: ordena o FIFO e datilha o extrato); a
`/producao` passa a data da produção e a venda-encomenda passa a da venda. O aviso da prévia deixou
de prometer o que não acontecia: agora nomeia a cor/insumo e diz que a falta vira lote de acerto
pelo preço do cadastro. **824/824 · lint ✅ typecheck ✅ build ✅.**

#### ✅ FECHADO — a perda calada (lote 2, 2026-08-29)

`[E5]` `[E6]` — dois lugares onde o app **descartava texto sem dizer**. Um custa uma SKU no
estorno, o outro custa a legibilidade do orçamento; a resposta é a mesma nos dois: **o que não
passa tem de aparecer**.

| Repro | Antes | Agora |
|---|---|---|
| `[{part:""},{part:"corpo",colorKey:"x"}]` | `corpo` volta, `malformed: false` | `corpo` volta, **`malformed: true`** |
| `[{part:123, colorKey:{}}]` | `part:"123"`, `colorKey:"[object Object]"` | descartado + `malformed` |
| `[{part:"corpo", colorKey:7}]` | `colorKey:"7"` (SKU inventada) | descartado + `malformed` |
| `sanitizeForPdf("um\ndois")` | `"umdois"` | `"um dois"` |
| Observações em 2 linhas no PDF | uma linha colada | **2 linhas** (a vazia inclusive) |

O que mudou: `readFinishedColors` passou a contar **qualquer** entrada perdida (antes só a perda
TOTAL) e **parou de coagir com `String(...)`** — parte tem de ser string não-vazia, chave de cor
tem de ser string ou ausente; coerção cega é pior que descarte porque não deixa rastro. O aviso
saiu do `console.warn` de dev e virou faixa na `/vendas`, **nomeando o documento** (campo novo
`Sale.finishedColorsMalformed`, escrito só pelo `toSale`). No PDF, `sanitizeForPdf` trata a
quebra como **separador de linha** (vira espaço) e o novo `sanitizeBlockForPdf` **preserva** o
`\n` das Observações — medido: o `splitTextToSize` do jsPDF já quebra nele. **814/814 · lint ✅
typecheck ✅ build ✅.**

#### ⚠️ Ressalvas da AUD-16 (não são itens; viram item se o dono mandar)

- **Import >500 não é atômico** — commits sequenciais de 500, com o erro dizendo quantos entraram.
  Tradeoff **já escrito** no código; o `withWriteTimeout` é `Promise.race` e não cancela o commit
  do Firestore (a mensagem dele manda **não** repetir a ação).
- **Steppers dos campos numéricos** medem 28×20px no celular, mas são `aria-hidden` **dentro** de um
  campo de 44px — não são alvo independente.
- **Console não está em zero:** um recibo real (`yoRC0YZjQAq2piItJojG`) tem `finishedColors`
  ilegível e avisa a cada leitura de `/vendas`. O `console.warn` continua (é diagnóstico); o que
  mudou no lote 2 é que **o dono agora vê o recado na tela**, com o id do documento.
- **Simulações, não Excel de verdade:** BOM, CRLF, latin-1 e notação científica foram simulados.
- **Não coberto:** regras publicadas no Console Firebase, segunda conta Google, Safari/iOS/Firefox,
  duas abas, corte de rede no meio da transação de venda, import real de 501+.

### ✅ ZERADO — cluster da varredura AUD-15 (2026-08-26) — a 8ª, REGRESSÃO dos lotes da AUD-14

> **O alvo não foi o sistema, foi o código de ontem.** Os 4 lotes da AUD-14 mexeram em 46 arquivos
> e na camada de escrita inteira, e ninguém além de quem os escreveu os exercitou. Relatório
> completo, com as medições cruas:
> [artifact 20582690](https://claude.ai/code/artifact/20582690-a94f-4d52-8fca-d6dec7244a00).
> Números de base: **764/764 em 5 execuções sem flake** · **escrita real autorizada** (4 eventos de
> produção gravados e estornados) · **diff campo a campo contra backup integral: 0 documentos com
> dado alterado** · `lint` ✅ `build` ✅ · **`tsc` acusa 2 erros** (1 pré-existente + 1 novo, o `[E5]`).
> **4 achados dela caíram como falso positivo e estão declarados no relatório** (o BOM do CSV de
> vendas, o `material`/`brand` do round-trip, o `0.90` no Excel, e o teste da rejeição solta).
>
> **Os 2 que entravam CALADOS:** `[E4]` (status "Sincronizado" com a rede caída — sem aviso na
> hora e sem divergência visível depois) e `[E6]` (valor de magnitude absurda vindo da planilha
> externa, com `issues: []` e `warnings: []`) — **os dois fecharam** (`[E6]` em 26/08, `[E4]` em
> 28/08). Os outros 4 eram visíveis.
>
> **Reconferido no código em 2026-08-26** (não é só o relatório falando): `[E1]` `[E2]` `[E3]`
> `[E5]` `[E6]` e a ressalva `[R1]` foram todos reproduzidos estaticamente — ordem dos `@import`,
> ausência de regra de alvo, a regex, a saída do `tsc` e o `git show c990679~1`.

#### Ordem sugerida (não decidida pelo dono)

| Lote | Itens | Por que esses | Estado |
|---|---|---|---|
| **1 — a trava do recadastro** | `[E6]` | É o único que morde dado que o dono **não digita**, e o recadastro é a próxima frente. Uma linha de checagem | ✅ **FECHADO 2026-08-26** |
| **2 — a régua do dedo, de novo** | `[E1]` `[E2]` `[E3]` | Um commit de CSS só. A conclusão "0 abaixo de 44" do lote 4 vale nas rotas, **não** em 641–760px nem com diálogo aberto | ✅ **FECHADO 2026-08-26** |
| **3 — o tipo que se perdeu** | `[E5]` | Uma linha na fixture. Nasceu no `c990679` | ✅ **FECHADO 2026-08-26** |
| **4 — o indicador que mente** | `[E4]` | O mais caro dos quatro (exige sonda de conectividade real, não `navigator.onLine`) e o que entra mais calado | ✅ **FECHADO 2026-08-28** |

#### ✅ FECHADO — a trava do recadastro (lote 1, 2026-08-26)

- ✅ **[E6] `isMilharMultiplo` era trava de PONTUAÇÃO, e a premissa que a justificava era de
  MAGNITUDE — agora a trava é a premissa.** O comentário do `number.ts` argumentava que 2+ grupos
  de milhar bastavam *"porque nenhuma coluna deste app tem valor plausível acima de 999.999"*, mas
  o teste era a regex `/^-?\d{1,3}(?:\.\d{3}){2,}$/`, **ancorada no fim** — qualquer parte decimal
  a desarmava, e en-US ou inteiro cru nunca a acionavam.
  **Conserto:** `isMilharMultiplo` **saiu**; no lugar entrou `isMagnitudeAbsurda`, que lê o valor
  (`parseDecimalPtBr`) e acende quando `Math.abs(parsed) > MAGNITUDE_MAXIMA` (999.999). É estrita-
  mente mais forte: dois grupos de milhar já valem 1.000.000, então o caso do Excel da AUD-14
  (`5.283.333.333.333.330`) continua coberto.
  **Três ganhos de tabela**, todos com teste: **científica** entra pelo mérito (`5,28E+15` acende;
  a versão de forma tinha de excluí-la para não mentir, CSV-29) · **número cru** entra (dentro do
  JSON o `1234567` chega como `number`, e a versão de forma devolvia `false` para tudo que não
  fosse string) · e a **borda** ficou declarada (999.999 atravessa; 999.999,99 acende).
  **Classes renomeadas** porque a mensagem antiga descrevia a pontuação, não o defeito:
  `milhar-multiplo` → `magnitude-absurda` e `milhar-multiplo-json` → `magnitude-absurda-json`
  (a chave só agrupa e serve de `key` no React — nada fora dos testes a lia).
  **`isMilharAmbiguo` não se mexeu:** UM grupo (`1.234`) continua sendo ambiguidade de leitura, com
  a lista curada de colunas dele.
  Arquivos: `src/lib/formatting/number.ts`, `productCsv.ts` (as 2 chamadas + as 2 mensagens),
  `number.test.ts` (describe reescrito) e `productCsvIssues.test.ts` (chaves + describe novo do E6).
  **Prova:** as 4 formas medidas na AUD-15 (`1.234.567,89`, `1,234,567.89`, `1.234.567,00`,
  `1234567`) em `Valor-hora (R$)` acendem `magnitude-absurda` citando a coluna e a célula crua;
  `999.999,00` atravessa calado e entra como 999999. **773/773** · `lint` ✅ · `build` ✅ ·
  `tsc --noEmit` segue com os **mesmos 2** erros de antes (nenhum novo; o 2º é o `[E5]`).

#### ✅ FECHADO — a régua do dedo, de novo (lote 2, 2026-08-26)

> Um commit de CSS só, e a varredura dos **9 diálogos** junto, como o `[E3]` pedia.
> **Resultado medido:** 320 / 375 / 641 / 760px → **0 alvos abaixo de 44** nas rotas afetadas e
> nos 9 diálogos · 1280px → **0 abaixo de 32** nos 9 diálogos · **rolagem lateral 0** em todas as
> larguras · **773/773** · `lint` ✅ `build` ✅.

- ✅ **[E1] O regime de 44 do `.roi-warn > summary` mudou de ARQUIVO, porque de onde estava ele não
  alcançava.** Confirmado ao vivo antes do conserto: 641px → 600×32 e 760px → 719×32, `min-height`
  computado **32px**. O `responsive.css` é o 8º `@import` e o `machines.css` é o 14º; os dois
  seletores são `.x > summary` (mesma especificidade) e `@media` **não soma** — a regra do 14º
  vencia por ordem, inclusive dentro da media query do 8º.
  **Conserto:** a linha `.roi-warn > summary` **saiu** da lista do `responsive.css` (lá ela era
  código morto, e a devolução de −8px nem era a certa para este elemento) e o bloco de 44 nasceu
  no `machines.css`, num `@media (max-width: 760px)` próprio, onde ele é o último a falar.
  **Padding de 13px por lado com margem negativa igual** (18 de conteúdo + 26 = 44): a margem
  cancela o padding, então a conta se mantém quando a frase quebra em duas linhas.
  **Prova:** 641px → 600×**44** ocupando 18 · 760px → 719×**44** ocupando 18 · 375px → 334×**62**
  (2 linhas) ocupando **36**, os mesmos 36 de antes · 1280px → 1047×**32** ocupando 18, desktop
  intacto. Em nenhuma largura o `.roi-warn` mudou de altura.
  **A afirmação falsa do `machines.css` saiu** e no lugar ficou a medição, com o nome da armadilha.

- ✅ **[E2] `.toggle-wrap` ganhou a primeira regra de alvo da vida dele.** Os dois interruptores
  das seções recolhíveis da calculadora ("Vende por subitens" e "Custos fixos") não tinham
  `min-height` em arquivo nenhum. Confirmado antes: 317,8×**33** a 641 e a 760px.
  **Conserto:** no `responsive.css` (o `sections.css` é o 4º, então aqui a ordem *ajuda*),
  `min-height: 44px` + `padding-block: 6px` + `margin-block: -6px`.
  **Prova:** 641 e 760px → 317,8×**45**, ocupando os mesmos **33** · 375px → 196,8×**59** e
  201,6×**87**, ocupando **47** e **75** — exatamente os números naturais de antes · 1280px
  inalterado (`min-height: auto`, 33 e 47). Altura do pai idêntica em todas.

- ✅ **[E3] Os 9 diálogos foram varridos. Só o de venda tinha defeito — e eram 18, não 4.**
  A varredura abriu os 9 (`SaleModal`, `MachineManagerModal`, `ConfirmDialog`, `StockColorModal`,
  `StockRollModal`, `StockAdjustModal`, `SupplyModal`, `SupplyLotModal`, `SupplyAdjustModal`) nas
  **duas** réguas. **8 estavam sãos**; o de venda rendeu os 4 previstos **mais 14 que a AUD-15 não
  tinha visto**, porque só aparecem depois de interagir:
  · `.fee-edit-link` 84,5×**23** · `.discount-mode-toggle button` ×3 → **40** de altura (os 4 da
  previsão) · `.fee-editor-item input` ×12 → 81×**38**, atrás do botão "Ajustar taxas"
  · `.discount-unit-toggle button` ×2 ("R$" / "%") → **36,7×42** e **33,8×42**, só visíveis com
  item na cesta e desconto **por item** escolhido.
  **Conserto:** o regime de 44 foi escrito **dentro do `fees.css` (10º) e do `cesta-recibo.css`
  (12º)**, não no `responsive.css` (8º) — pelo mesmo motivo do `[E1]`: os seletores empatam em
  especificidade e lá perderiam por ordem. Fica registrado como regra: **todo arquivo depois do 8º
  `@import` carrega o próprio regime de 44.**
  ⚠ **Uma armadilha nova, medida durante o conserto:** `min-width: 44px` sozinho nos botões
  "R$/%" **estoura a fileira** — os dois pedem 90px e sobravam 70, e como o `.discount-unit-toggle`
  tem `overflow: hidden` o "%" era **CORTADO** em vez de vazar (o UX-44 pela porta dos fundos).
  A largura veio de dar **linha própria ao rótulo** "Desconto" (`flex-wrap` na `.cesta-discount` +
  `flex: 0 0 100%` no rótulo), que é a receita de UX-38/UX-40 para fileira que não cabe.
  ⚠ **Achado de tabela, do mesmo commit:** a régua de **DESKTOP** (32px) também tinha buraco no
  mesmo modal — `.fee-edit-link` **23** e os 3 `.discount-mode-toggle button` **24** a 1280px. A
  afirmação "0 abaixo de 32 a 1280px" do lote 4 também era **só das rotas**. Os dois pisos entraram
  na regra base (fora da media query).
  **Prova:** modal de venda com editor de taxas aberto, item na cesta e desconto por item →
  **0 abaixo de 44** a 320, 375 e 760px e **0 abaixo de 32** a 1280px, `overflow` horizontal **0**
  na caixa, na fileira e no documento. Fluxo preservado onde importa: `.fee-row` 68→**68** no
  celular e 54→**54** no desktop. O que cresceu, cresceu de propósito: editor de taxas 491→521,
  seletor de modo 42→46, fileira de desconto 44→**69** (o rótulo subiu de linha).
  ⚠ **`.num-spin` ficou de fora da conta, como nas varreduras anteriores** — 28×~20, `tabindex="-1"`,
  é o stepper ao lado do campo e o alvo de verdade é o campo (exceção já declarada no lote 4).

#### ✅ FECHADO — o tipo que se perdeu (lote 3, 2026-08-26)

- ✅ **[E5] `tsc --noEmit` está verde — e agora é rotina, que é o que impedia o próximo `[E5]`.**
  Os **2** erros caíram, não 1. **(a)** `productionPlan.test.ts(256,9)`, TS2322: a fixture
  `const laranja: StockFilament` ganhou `material: "PLA"`, `brand: "Bambu"` e `minG: 0` — os mesmos
  valores da outra fixture do mesmo arquivo, pra não inventar um terceiro estilo. Nenhum
  deles entra na conta do `[D9]` (catálogo × FIFO), então a prova segue idêntica.
  **(b)** `calculatePricing.test.ts(205,30)`, TS2352, o **pré-existente**: era o cast do documento
  antigo com `energyTariff`/`laborRate` dentro da etapa. Virou `as unknown as Partial<ProductInput>`
  — a forma que o próprio compilador sugere — com o comentário dizendo o porquê: o erro é o TS
  avisando que o lixo **não existe mais no tipo**, que é exatamente o que o teste simula. Deixá-lo
  de fora manteria o `tsc` vermelho e a rotina abaixo seria decorativa.
  **Decisão tomada (a que o item pedia):** **`pnpm typecheck` entra em "concluir a tarefa"**, ao
  lado de `lint`/`test`/`build`. Script novo no `package.json`; `CLAUDE.md` atualizado na Diretriz 4,
  na 8 e nos Comandos. **O motivo, medido:** `pnpm build` **não typa arquivo de teste** — ele passou
  verde com o TS2322 vivo o tempo todo — e `pnpm lint` não roda `tsc`. Sem o comando próprio, todo
  erro de tipo em teste é invisível.
  ⚠ **Achado de tabela, fora do item:** `pnpm test` **morria antes de rodar um teste sequer**
  (`memory allocation of 248752 bytes failed`) — reproduzido **na árvore limpa** via `git stash`,
  logo não é regressão de código: o Vitest abre 1 worker por CPU (**16** nesta máquina) e sobravam
  **0,5 GB de 7,7 GB**. `maxWorkers: 4` no `vitest.config.ts`, com o porquê no comentário; a suíte
  fecha em ~1s de teste, então não custa nada. ⚠ `minWorkers` **não existe** no tipo do Vitest 4 —
  e quem pegou foi o `pnpm build`, que typa o `vitest.config.ts`. O **build** também caiu uma vez
  pela mesma memória (`worker exited with code: 3221226505`, na geração das páginas) e passou na
  segunda — ambiente, não código.
  **Prova:** `pnpm typecheck` sai **limpo** (era 2 erros) · **773/773** · `lint` ✅ · `build` ✅.

#### ✅ FECHADO — o indicador que mente (lote 4, 2026-08-28)

- ✅ **[E4] O chip parou de perguntar "chegou dado?" e passou a perguntar "de ONDE veio?".**
  O defeito medido pela AUD-15: com `disableNetwork(db)`, 12 leituras em 18s, o chip ficava em
  `.cloud-status synced :: "Sincronizado"` o tempo inteiro, com `navigator.onLine = true` sempre.
  O `onSnapshot` **entrega** quando a rede cai — serve do cache e chama o mesmo callback de
  sucesso —, e os 9 hooks liam esse callback como prova de vida (`setStatus("synced")`).
  **Conserto:** `src/lib/cloudStatus.ts` (novo), com a função pura `cloudStatusOf({fromCache,
  hasPendingWrites})` → `pending` | `offline` | `synced`, mais a `COM_METADATA` compartilhada.
  As 9 assinaturas de coleção passaram a pedir `includeMetadataChanges` e a repassar
  `snapshot.metadata` como 2º (ou 3º) argumento do callback; os 9 hooks trocaram
  `setStatus("synced")` por `setStatus(cloudStatusOf(origin))`. Dois rótulos novos no `PageHeader`:
  **"Sem conexão"** (`--warn`) e **"Gravando..."** (muted, como o `connecting`), com a consequência
  inteira num `title`.
  ⚠ **A ORDEM da função é o item inteiro:** `hasPendingWrites` é testado ANTES de `fromCache`,
  porque **online** o snapshot otimista de toda gravação também chega com `fromCache: true` (é a
  compensação de latência). Invertendo os dois, o chip piscaria "Sem conexão" a cada save — a
  mentira oposta. Nenhum dos dois ramos novos afirma "Sincronizado".
  ⚠ **`includeMetadataChanges` não é detalhe:** sem ela o Firestore **não reemite** quando só o
  metadado muda, e a queda de rede é exatamente isso (os documentos continuam iguais, muda a
  origem). Era o evento que faltava para a tela saber.
  ⚠ **Achado de tabela, do mesmo commit:** o "X de N" da `/producao` tinha o mesmo TD-019 que as
  vendas já tinham consertado — a aggregation query disparava no snapshot otimista e voltava o
  número de ANTES da gravação, e a confirmação nunca chegava. Agora chega, e o
  `!origin.hasPendingWrites` espera por ela.
  **Prova ao vivo** (dev server, sessão autenticada do dono; transporte para
  `firestore.googleapis.com` cortado no XHR/fetch, que é o cenário "Wi-Fi conectado sem internet"
  do `[D2]` — o `navigator.onLine` fica `true` o tempo todo, e é esse o ponto):
  · `/estoque` → `synced → offline` em **≤1s**, e **"Sem conexão" nas 20 amostras de 20s**
  (a AUD-15 tinha conjunto de 1 valor: "Sincronizado"); restaurado o transporte, volta a
  "Sincronizado" em ≤1s · `/producao` (`useProductionPage`, o callback de 3 argumentos) e
  `/vendas` (`useSalesPage`) → mesma ida e volta, e os cards de agregação seguem em
  **47 / R$ 2.620,70 / R$ 853,05 / R$ 1.762,87 / 67%** antes e depois · `/` (`useProducts`) idem.
  **Contraste do rótulo novo:** escuro `rgb(224,163,58)` ≈ 8,6:1 · claro `rgb(160,90,0)` sobre
  `rgb(250,250,247)` ≈ **5,1:1** — os dois passam de 4,5:1.
  **Sem regressão no caminho feliz:** "Editar + Salvar" numa cor (gravação real, `runTransaction`)
  → **0 transições** do chip em 3s de `MutationObserver`. É o esperado: transação do Firestore
  **não** aplica local, então nem chega a existir snapshot pendente.
  ⚠ **O que NÃO foi medido ao vivo:** o rótulo `pending` ("Gravando..."), que só aparece nos
  caminhos que aplicam local — `addDoc` / `deleteDoc` / `writeBatch` (criar produto, criar cor,
  criar insumo, excluir produto, importar CSV). Exigiria escrever dado de teste no Firestore do
  dono. A precedência dele sobre o `offline` está fixada em teste unitário
  (`src/lib/cloudStatus.test.ts`, 5 casos).
  **778/778** · `lint` ✅ · `typecheck` ✅ · `build` ✅.

#### ⚠️ Ressalvas da AUD-15 (não são itens; viram item se o dono mandar)

- ⚠️ **[R1] `readFinishedColors` conta a perda TOTAL e cala a PARCIAL.**
  `finishedGoods.ts:199` — `malformed = raw.length > 0 && entries.length === 0`. Um item torto no
  MEIO de uma lista boa some sem nada dizer, que é a classe de coisa que o `[D6]` existe para
  impedir. **Medido:** `1 torto + 3 bons` → `entries: 3`, `malformed: false` (perde 1 calado) ·
  `{part: "a"}` sem `colorKey` → entra com `colorKey: ""` · `{part: 0}` (falsy) → `malformed: true`,
  inconsistente com o caso acima. Alcançar isso exige documento escrito à mão — por isso é
  ressalva.

- ⚠️ **[R2] Os "9 escalares" do `[D1]` são 8 — e sobra uma célula com ponto que nenhuma lista cita.**
  Varredura de TODA célula escalar do export: `"Pecas" = "2.5"` (ponto, fora do `numeroPtBr`) e
  `"Arredondamento" = "0.90"` (ponto, em nenhuma das duas listas); **as outras 22 com vírgula** ✓.
  Round-trip real no Excel 16 pt-BR: `"0.90"` volta **intacto** (o Excel a trata como TEXTO, não é
  agrupamento pt-BR válido) e, se `"2.5"` virasse `25`, o `validateProduct` **reprova**
  `piecesCount` não-inteiro nos DOIS caminhos (form e importação) → não chega ao banco.
  ⚠️ **A afirmação é que está errada, não o comportamento.** O arquivo é pt-BR na prática; a conta
  de 9 é 8.

#### O que a AUD-15 NÃO cobriu

- **Regras de segurança do Firestore** — 6ª varredura seguida. Exige uma 2ª conta Google.
- **Escala acima de 500 produtos** — o corte do `createProductsBatch`, onde o lote pode entrar pela
  metade, segue sem prova (exigiria ~1.040 escritas).
- **Google Sheets** — o Excel fechou; o Sheets exigiria login e envio de arquivo.
- ~~**Os outros 7 diálogos**~~ — **coberto**: os 9 foram varridos no lote 2 (ver `[E3]`).
- **Duas abas com timeout no meio** — o guarda `rev` foi lido no código e a AUD-14 o mediu; a
  corrida com o prazo de 12s no meio não foi reproduzida.
- **Tema escuro na geometria** — mediu um tema só. A geometria não depende de tema (token de cor
  não entra em `min-height`/`flex`), mas o contraste não foi reconferido.
- **iOS Safari real** e navegadores fora do Chromium embutido.
- **O `<select>` que corta sem reticências** — segue ressalva do dono, reconfirmada em **8,5%** no
  modal de venda.

#### ✅ O que está SÃO — medido, não presumido (o resumo; o cru está no relatório)

- **Lote 1:** round-trip real no Excel 16 pt-BR — `4,75` volta exato, `5,283333333333333` custa
  **3,333×10⁻¹⁰ h**, `warnings: []` nas duas pontas · `[D8]` round-trip campo a campo com
  acessório + `supplyId` + `subitemId` + etapa extra + multicolor: **`csv1 === csv2` byte a byte**,
  0 escalares divergentes em 13 campos · CSV do `/vendas` (nunca exercitado antes): 22×48, **0
  células com ponto**, BOM `EF BB BF` presente nos bytes crus, `—` e `Ç` intactos no Excel.
- **Lote 2:** offline REAL — `t=1,0s` "Salvando…" `disabled` · `t=13,0s` a frase do timeout **com o
  nome ainda no campo** · `enableNetwork` → produtos **99 → 100**: **a escrita entrou sozinha**, e a
  frase que manda CONFERIR está certa ("nada foi salvo" teria mentido) · **21** chamadas de
  `withWriteTimeout` nos repositórios e **0 escritas exportadas fora dele** · a escrita mais pesada
  do app (transação nas 4 coleções) confirmada em **776 ms** → folga de ~15× contra os 12.000 ms.
- **Lote 3:** `[D4]` select 259×44 com 8,5% cortado (dentro dos "5 a 9%" que o lote 4 corrigiu) ·
  `[D5]` ao vivo: "só para os 23 recibos já carregados" → um clique → **23 → 41**, topo por receita
  vai de `88,00 / 87,59` para `159,34 / 105,30`, `totals.count = 47` = docs no Firestore.
- **Lote 4:** `[D7]` **0 referências** ao código morto, nenhuma função órfã · `[D9]` **escrita real**:
  `catalogPricePerKg` em 100% das linhas, `pricePerKg` ausente, `catalogUnitPrice` no insumo, e a
  conta à mão do FIFO (`40×100/1000 + 15×110/1000 = 5,65`) **bate dígito a dígito** com o
  `frozenBreakdown.material`, com a divergência de **R$ 0,375** nomeada no mesmo documento · os 57
  eventos antigos com `pricePerKg` continuam legíveis pelo `??`.
- **Padrão nº 9 (o defeito que só aparece na 2ª vez):** o mesmo produto produzido duas vezes
  seguidas — 57 → 59 → 61 eventos, FIFO andou certo nas duas.
- **Balanço da escrita real:** `producao` 57→57 · `estoque` 2 docs / 1.646 g → idem · `insumos` 306
  un → idem · `acabados` 22 / 39 peças → idem · `vendas` 47 → 47 · `products` 99 → 99.
  **0 documentos com dado alterado** (só o `rev` subiu, de propósito: estoque 18→30, acabados
  22→26 = as 6 transações gravadas e estornadas). O **overdraft de −370 g na Bege** continua
  idêntico (é o furo de contagem física que o `[D4]` preserva de propósito).
- **Layout, 4 fronteiras × 7 rotas com acordeões abertos:** 375px → **0** abaixo de 44 · 641 e
  760px → **2** (os `[E1]`/`[E2]`) · 1280px → **0** abaixo de 32 · **rolagem lateral 0 em todas** ·
  `document.scrollWidth === innerWidth` em **28 combinações**.

### ✅ ZERADO — cluster da varredura AUD-14 (2026-08-25) — a 7ª, v4 da geral

> **Os 4 lotes fecharam no mesmo dia (2026-08-25).** Não há item aberto de código nesta seção; o
> que sobra são as **ressalvas** (que só viram item se o dono mandar) e a lista do que a varredura
> não cobriu.

> **A pergunta que ela existiu para responder:** *a Diretriz 7 pode expirar?* Resposta medida:
> **sim, com uma trava** — havia um caminho que corrompia a carga **em silêncio** (o `[D1]`, que
> fechou no lote 1). Relatório completo, com as medições cruas:
> [artifact 99e19ac1](https://claude.ai/code/artifact/99e19ac1-7b0b-4d05-8640-2fb3217eab71).
> Números de base: **729/729 em 4 execuções sem flake** · divergência máxima contra a conta à mão
> **8,0×10⁻¹²** · 1.902 medições de contraste, 0 falhas · backup de **251 documentos**, **0 docs com
> dado alterado ao fim** · **32 afirmações anteriores refeitas: 25 bateram, 7 não** (4 delas são
> comentários no código descrevendo comportamento que mudou).
>
> **Os 6 erros que entram CALADOS** (a 2ª pergunta do dono): `[D1]` horas ×10¹⁵ · `[D2]` escrita
> perdida offline · `[D3]` exclusão offline · `[D6]` `finishedColors` em formato antigo · `[D5]`
> ranking parcial · `[D9]` preço divergente no evento. Três deles (`[D2]` `[D3]` `[D6]`) são
> invisíveis **mesmo depois**.

#### Ordem dos lotes AUD-14 (dono, 2026-08-25: "lote 1 e ir aos outros depois, um commit por lote")

| Lote | Itens | Por que esses | Estado |
|---|---|---|---|
| **1 — a planilha da carga** | `[D1]` · `[D8]` | Era o único que **bloqueava o recadastro**: corrompe no caminho exato que o dono desenhou (sistema externo gera → confere no Excel → reimporta) | ✅ **FEITO (2026-08-25)** |
| **2 — a escrita que evapora** | `[D2]` · `[D3]` | Quiosque tem rede ruim, e o app afirma "Sincronizado" enquanto perde o produto. Cada clique repetido enfileira outra escrita | ✅ **FEITO (2026-08-25)** |
| **3 — a tela que informa errado** | `[D4]` · `[D5]` · `[D6]` | Não corrompem dado; informam errado uma decisão de negócio | ✅ **FEITO (2026-08-25)** — medido ao vivo no lote 4, **com 2 correções** |
| **4 — poeira e verdade escrita** | `[D7]` · `[D9]` + alvos de toque + as afirmações falsas | Inerte hoje; é o padrão nº 10 (código morto que volta a ser chamado) e o comentário que envelhece | ✅ **FEITO (2026-08-25)** — com a prova ao vivo do lote 3 junto |

#### ✅ FECHADOS no lote 1 (2026-08-25)

- ✅ **[D1] FEITO — o arquivo é pt-BR INTEIRO, e o ponto repetido passou a ACUSAR.**
  Duas metades, porque a planilha da carga é **gerada por máquina que o app não controla**:
  · **o export** — 11 colunas de dinheiro já saíam pelo `formatDecimal`; **9 escalares** saíam pelo
  `String(number)` do `join`, ou seja com PONTO decimal (`Tempo (h)`, `Tarifa Energia`,
  `Valor-hora`, `Markup`, `Filamento (R$/kg)`, `Mao de obra (min)`, `Taxa Falha`, `Pecas`,
  `Margem`). Agora todas saem com vírgula, **sem agrupar o milhar** (agrupar reintroduziria a
  ambiguidade do CSV-07 no arquivo do próprio app).
  · **a importação** — classe nova `milhar-multiplo` (+ `milhar-multiplo-json`): **2 grupos ou mais**
  de milhar não é ambiguidade a resolver, é número corrompido, e **nenhuma coluna deste app tem
  valor plausível acima de 999.999**. A lista é TODA coluna que entra no documento, inclusive as
  duas que o `isMilharAmbiguo` exclui de propósito — `Tempo (h)` (a coluna do defeito) e
  `Taxa Falha (%)`, onde o **clamp de 95 ESCONDE o estrago**.
  **Medido no Excel 16 pt-BR de verdade (COM), com os 6 valores reais da varredura:** formato velho
  → `5.283333333333333` volta `5.283.333.333.333.330`, `printHours` = 5283333333333330 e o aviso
  **acende 6×** citando a célula crua; formato novo → `5,283333333`, **0 avisos**. A truncagem do
  Excel na volta custa **3,3×10⁻¹⁰ h** (1,2 µs), não os 10¹⁵ de antes.
  ⚠ **Para a spec da planilha:** o número vai com **vírgula decimal**. Dentro dos JSONs continua
  ponto (é o decimal do JSON — vírgula quebraria o `JSON.parse`), e `Arredondamento = 0.90` é
  **nome de modo**, não número.
  ⚠ O CSV do `/vendas` foi conferido junto e **não tem o defeito**: escreve tudo por `formatDecimal`.

- ✅ **[D8] FEITO — o export não depende mais da ordem de chave do banco (fecha o `[CSV-30]`).**
  `Acessorios JSON` e `Subitens JSON` eram dumpadas **cruas** do documento, e o Firestore não
  preserva ordem de chave em mapa: duas exportações do mesmo banco, sem nada mudar, davam arquivos
  diferentes — **24 células** (18 + 5), **0 com dado diferente**. Agora são remontadas campo a campo
  na ordem que a importação produz, como as etapas já eram.
  ⚠ **Consequência declarada:** o `id` do acessório **não é exportado**, porque o `parseAccessories`
  não o lê de volta — dumpar cru escrevia um id que o round-trip descartava calado.
  ⚠ O `productCsvRoundTrip` não pegava isto: lá a origem é o **parser** (ordem fixa), não o banco.

#### ✅ FECHADOS no lote 2 (2026-08-25)

- ✅ **[D2] FEITO — a espera tem prazo, e o botão para de mentir.** Duas metades, porque o defeito
  também era duplo:
  · **o prazo** — `withWriteTimeout` (`src/lib/errors.ts`), **12s** (45s na importação em lote).
  A decisão do "só o salvar ou os 15 caminhos" foi pelos **15**: o timeout mora na **borda do
  repositório**, e as **21** escritas exportadas passam por ele (`addDoc`/`setDoc`/`deleteDoc`/
  `runTransaction`/`batch.commit`). Deixar 14 fora seria o mesmo defeito com outro botão, e na UI
  seriam 15 diffs em vez de 12 linhas.
  ⚠ **A frase é diferente da do `guardOnline` de propósito.** O guarda barra ANTES do `await` e por
  isso pode prometer "nada foi salvo ainda"; o timeout **não pode** — ele desiste da espera, mas a
  escrita **continua enfileirada** no SDK e pode entrar sozinha (foi o modo 2 da varredura: 97 → 98,
  atrasado). Então ela manda **conferir**, não repetir. Um teste trava essa diferença.
  · **o botão** — a calculadora era a única tela que gravava sem estado de "salvando". Agora um
  `saving` só apaga as **4** ações que gravam o mesmo produto (Salvar · Vender · Produzir · Orçar),
  e o `saveAsNewProduct` — a única gravação da tela **sem `try/catch`** — ganhou o dele. **O
  formulário não é mais limpo quando a gravação falha.**
  **Medido ao vivo** (rede pendurada na página, `navigator.onLine` = `true`, ou seja o modo 1):
  t=2,0s o botão vira **"Salvando…" + desabilitado** (os 2 cliques seguintes não fazem nada) e
  t=14,2s (12,2s depois) sai a frase do timeout, com o **nome ainda no campo**. Online, o mesmo
  caminho: "Salvando…" → "✓ Salvo!" em ~350 ms; catálogo **99 → 100**.

- ✅ **[D3] FEITO — o 15º caminho ganhou a guarda.** `guardOnline()` no `useProducts.deleteProduct`,
  e não no `ProductCatalog`: vale para qualquer chamador, e o catálogo já mostrava o erro no `fail`.
  **Medido ao vivo** (com `navigator.onLine` forçado a `false`): a exclusão é **recusada**, o
  catálogo continua em **99** e a mensagem sai por extenso ("Não foi possível excluir "…": Sem
  conexão com a internet…"). Com a rede de volta, excluir funciona: **100 → 99**.
  ⚠ A ressalva de honestidade da varredura vale ao contrário agora: o que se mediu foi a guarda
  **funcionando**; o comportamento do `deleteDoc` no código velho continua não reproduzido ao vivo.

#### ✅ FECHADOS no lote 3 (2026-08-25)

> ✅ **A prova ao vivo saiu no lote 4** (mesmo dia, sessão seguinte — o painel do navegador voltou a
> navegar). As medições que faltavam estão abaixo, e **duas afirmações do lote 3 não bateram**: o
> `[D4]` **não** volta a ser uma linha no desktop, e os "241px de texto" eram medida de FONTE, não
> de `<select>` (a caixa nativa cobra a seta por cima). As duas viraram correção no comentário do
> `cesta-recibo.css` — e entram na conta como a 8ª e a 9ª afirmação falsa da varredura.

- ✅ **[D4] FEITO — a fileira vira CARTÃO, e sem media query.** O defeito era o padrão nº 8 na forma
  flex: `flex: 1 1 0%` com `min-width: auto` contra um vizinho rígido (o `CostDetail`, 242–250px),
  em 259px de linha — 22 + 8 + 250 = 280, e o select ficava com **22,0px** para 241px de texto.
  A saída é a regra da casa (UX-38/UX-40), mas escrita **sem `@media`**: `flex-wrap: wrap` no
  `.cesta-origem` e `flex: 1 1 260px; min-width: 0` no select. **O gatilho certo aqui não é a
  largura da TELA, é a do MODAL** — e a base de 260px (os 241 do texto mais folga) faz a quebra
  acontecer exatamente onde o texto começaria a ser cortado, em vez de num número escolhido a dedo.
  ⚠ O `min-width: 0` é obrigatório e vem junto: sem ele o mínimo implícito do flex é o min-content,
  o `<select>` não encolhe, e a base de 260 viraria piso de 241 — a mesma armadilha da coluna `1fr`
  pura nas grades.
  **✅ MEDIDO ao vivo (375×812)**: a fileira quebrou, o select ficou com a **linha inteira — 259px**
  (contra os **22,0px** de antes) e o `CostDetail` desceu para a linha de baixo. O texto que ele
  mostra passou de **9% para 95%**.
  ⚠ **Duas correções do que o lote 3 escreveu**, as duas medidas:
  · **no desktop ela também é cartão** — o `.sale-modal` tem `max-width: 560px`, ou seja 469px de
    linha, e uma linha só pediria **502** (244 do texto + 8 de gap + 250 do custo). A fileira quebra
    em TODA largura, e a alternativa seria voltar a espremer o select. O desenho está certo; a frase
    "volta a ser uma linha no desktop" é que estava otimista.
  · **os 241px eram medida de FONTE** — a caixa nativa cobra a seta por cima: "Estoque de acabados
    (2 disp.)" pede **273px** e "Sob encomenda (produz agora)" **283**, contra os 259 da linha. Então
    sobra **5 a 9% cortado**, não zero — e isso cai na ressalva já registrada dos `<select>` que
    cortam sem reticências, que é decisão do dono.

- ✅ **[D5] FEITO — a ordem parcial passou a se declarar, e dá pra completá-la.** Não dá para
  empurrar o ranking ao servidor: a receita do recibo é a **soma dos itens** dele, agrupada no
  cliente, e o Firestore não ordena por agregado. Então a tela ficou honesta em duas metades:
  · **o aviso** — `partialRanking = hasMore && sortMode !== "recent"` acende uma faixa `--warn`
  ("Esta ordem vale só para os N recibos já carregados"). **"Mais recentes" é a única isenta**, e
  por um motivo, não por gentileza: é a ordem da própria consulta (`saleDate desc`), então os 25
  carregados **são** os 25 do topo. Todas as outras — inclusive **"Mais antigas"**, que o achado não
  citava — reordenam a janela e chamam o resultado de ranking do histórico.
  · **a saída** — `loadAll()` no `useSalesPage` mira o `totals.count` (a aggregation query conta
  DOCUMENTOS, a mesma unidade do `limit`, porque cada item de venda é um doc), com piso de uma
  página a mais. Se o count vier atrasado ou curto, o `hasMore` — que é medido no servidor
  (`docs.length > pageLimit`) — mantém o aviso na tela e outro clique avança. O aviso **não some
  por conta própria**.
  ⚠ Com filtro de PRODUTO o `hasMore` é sempre `false` (a consulta traz o conjunto inteiro), então
  ali não há o que avisar — e é o desenho, não um furo.
  **✅ MEDIDO ao vivo**: com a janela de 25 documentos = **23 recibos**, "Receita (maior)" acende a
  faixa `--warn` por extenso — *"Esta ordem vale só para os 23 recibos já carregados — há mais
  vendas no histórico"* + "Carregar tudo e reordenar". Um clique: **41 recibos**, faixa some, e o
  topo passa de `386,41 · 294,36 · 88,00 · 87,59` para `386,41 · 294,36 · 159,34 · 105,30` — os dois
  recibos que a janela escondia (159,34 e 105,30) sobem para o lugar que era deles.

- ✅ **[D6] FEITO — "não tem" deixou de ser a mesma coisa que "tem, e eu não consigo ler".**
  `readFinishedColors` (em `finishedGoods.ts`, ao lado do par `colorEntriesOf`/`colorRecordOf`, e
  coberta por 4 testes) devolve `{ entries, malformed }`. Campo ausente e lista vazia → `malformed:
  false` (a venda de encomenda, a venda pré-FEAT-11: não há nada a lamentar); **mapa** ou lista cujos
  itens não sobrevivem → `malformed: true`.
  · **Sem migração, de propósito** (Diretriz 7): a forma de mapa nem consegue representar a peça
  INTEIRA — o Firestore recusa `__whole__` como nome de campo, que é a razão de a lista existir.
  Aceitá-la seria ressuscitar um formato que o app não sabe escrever.
  · **O que mudou de verdade é o `finishedColorLabel`**: ele deixou de sobreviver sozinho. Era outro
  campo, era lido e exibido, e com a lista descartada a tela dizia "Cor vendida: Azul" enquanto o
  estorno não tinha prateleira de onde devolver. Rótulo sem lista agora **não aparece** — a ausência
  é a informação honesta. Some junto um `console.warn` (fora de produção) com o id do recibo.
  ⚠ A lição é do leitor, não do documento: os 2 docs concretos morrem no recadastro.
  ⚠ **Sem prova ao vivo, e de propósito:** produzir o sintoma exigiria gravar à mão um documento no
  formato ANTIGO no banco de produção. Os 4 testes de unidade cobrem os quatro casos (ausente ·
  vazio · mapa · lista podre) e o `finishedColorLabel` cai junto no teste.

#### ✅ FECHADOS no lote 4 (2026-08-25) — o último

- ✅ **[D7] FEITO — o código morto SAIU, e os comentários que mentiam foram refeitos.**
  · **`saveRecibo` (salesRepository) apagado** — 0 chamadores, nem em teste. Sozinho ele era uma
  armadilha esperando quem o reencontrasse: escrevia `batch.set(ref, payload)` **cru**, sem passar
  pelo `saleToDocument` (o passo 8 sairia sem origem/moves/ids) e sem o `lerEConferirRevs`.
  · **`removeSale` + `useSales.deleteSale` apagados junto** — a cadeia inteira era morta (nenhum
  componente destruturava o `deleteSale`), e ela apagava a venda **sem estornar** filamento, insumo
  nem acabado. Quem exclui recibo é o `reconcileRecibo`, que ajusta as 4 coleções na mesma
  transação. Mesma decisão do TD-030 no `finishedGoodsRepository`: o morto sai em vez de esperar um
  botão que o ressuscite. No lugar dos dois ficou o registro do **porquê não voltam**.
  · **`serializeSkus` deixou de ser exportada** — o comentário dizia que a exportação existia "para
  a baixa da produção reusar esta serialização". Medido: **0 importadores fora do arquivo**, nem em
  teste. Quem os dois repositórios de escrita importam é o `finishedGoodToDocument`, que já a
  embrulha. API pública que ninguém usa é convite a divergir da escrita normal — justo o que o
  comentário dizia evitar.
  · **as 4 outras afirmações falsas em comentário:** o `finishedEventReferences` dizia, no presente,
  que o estorno "não acha o id e devolve o doc intacto, calado" — isso é o código de ANTES do
  TD-028; hoje o `shiftLayers` **lança erro** · o `quoteConfigRepository` dizia que a numeração é
  "derivada do histórico, então zera sozinha quando o histórico esvazia" — hoje é **reservada no
  servidor** (`config/orcamentoSeq`), **monotônica**, e o histórico entra só como piso · o
  `ReciboWrite` dizia "num ÚNICO `writeBatch`" e é `runTransaction` desde o TD-022 · o rabicho do
  TD-030 dizia "os serializadores, que os dois repositórios importam" — é **um** serializador.
  · ⚠ **E o `writeBatch` era um bando, não um caso:** grep no fonte achou o nome em **15 comentários**
  de 10 arquivos descrevendo escritas que viraram `runTransaction` no TD-022 — quem lesse e fosse
  procurar o `writeBatch` não acharia nada. Todos passaram a dizer "transação". Ficaram de fora, de
  propósito, os três que estão CERTOS: o `createProductsBatch` (que usa `writeBatch` de verdade), o
  `revGuard` (que descreve a semântica dele) e a própria nota do TD-022. Os 2 do `CLAUDE.md` foram
  junto.

- ✅ **[D9] FEITO — o campo passou a dizer qual dos dois preços ele é.**
  `ProductionFilament` é tipo próprio do evento (a `FilamentUsage` sem o `id` de formulário), e o
  preço lá se chama **`catalogPricePerKg`**. O gêmeo do insumo veio junto — `SupplyUsage.unitPrice`
  → **`catalogUnitPrice`** — porque tinha o mesmo defeito e o mesmo comentário mentiroso ("resolvido
  no momento, FIFO real ou congelado"). O custo que a impressão pagou continua onde sempre esteve: o
  `frozenBreakdown.material`.
  **3 testes travam o cenário medido** (`productionPlan.test.ts`): rolo velho a R$ 110/kg + rolo novo
  a R$ 85/kg, 40 g → a linha do evento grava **85** (catálogo) e o `frozenBreakdown.material` **4,40**
  (FIFO), **R$ 1,00 de divergência no mesmo documento**, exatamente como em
  `producao/32Fa5M0jFy2wvCe7dDod`. Um terceiro fixa que no modo `historico` os dois coincidem (não há
  rolo a consumir). O `pricePerKg` e o `id` **não sobrevivem** à travessia — é o que o teste afirma,
  campo a campo.
  ⚠ **Sem migração (Diretriz 7), mas a LEITURA é tolerante**: doc anterior aceita `pricePerKg` /
  `unitPrice` como o que eles sempre foram (preço de cadastro). Escrever, só com o nome novo.
  ⚠ A tela do `/producao` passou a dizer **"R$ 85,00/kg no cadastro"** na etiqueta de cor — o número
  sozinho era metade da informação.

- ✅ **ALVOS DE TOQUE — a régua voltou a valer nos dois eixos, nas 7 rotas.**
  A ressalva herdada falava em "1–4px"; a faixa real ia de **2 a 24px**, e o método mudou: em vez de
  conferir uma lista, **varri o DOM inteiro de cada rota** (`button, a, input, select, summary,
  [role=button], textarea`) atrás de qualquer caixa abaixo da régua — 44px a 375×812, 32px a 1280.
  Isso achou **alvos que a varredura não tinha listado**.
  · **canto do cabeçalho, 40×40** (☰ + tema + sair, nas 7 rotas): 44×44, e a reserva do `.header`
  acompanhou (144 → 156px, a mesma folga de antes). O `.header-utils` era o caso mais traiçoeiro —
  **40 de largura por 44 de altura**, porque a altura vinha do `min-height` do `responsive.css` e a
  largura continuava presa no `width: 40px` do `header.css`.
  · **`.back-to-top` 42×42** — os 2px que ele economizava no celular não devolviam espaço a ninguém
  (é `position: fixed`). O override saiu; quem afasta do canto é o `right`/`bottom`, e esses ficam.
  · **`.skip-link` 162,6×32** (só no foco) · **`.collapse-head` 311×41** · **`.stock-hex-input`
  285×37** · **`.icon-button.edit` 38,6×44 no `/vendas`, ×23** — este não era tamanho, era **FLEX**:
  o botão é item de uma fileira e o padrão é `flex-shrink: 1`, então quando o nome do cliente
  apertava a linha, o único item de largura fixa era justamente quem cedia.
  · **os que a varredura não listou:** `.cost-detail-trigger` 106,7×32 (aba Produtos do `/estoque`)
  · `.details-links a` **119×16** — link para site EXTERNO, o pior do app · e no DESKTOP o
  `.brand-reset` 111×20 (o botão que LIMPA o formulário) e o `.result-advanced > summary` 313×27,
  além do `.roi-warn > summary` **1047×18** que a varredura já tinha achado.
  ⚠ **Duas armadilhas medidas, e as duas viraram comentário no código:**
  · **ORDEM de @import vence media query** — o `.stock-hex-input` (`stock.css`, 15º) e o
  `.cost-detail-trigger`/`.icon-button` do recibo (`cesta-recibo.css`, 12º) **ignoraram** o override
  escrito no `responsive.css` (8º). Media query não soma especificidade. As regras foram para o dono
  legítimo de cada um — a lição do TD-013, medida de novo.
  · **margem negativa COLAPSA através do pai** — no `.roi-warn` a devolução de −7px não devolvia
  nada (caixa 18 → **25px**), porque o bloco não tem borda nem recuo no eixo vertical. `display:
  flow-root` no pai conserta: caixa de volta aos 18px, alvo em 32.
  ⚠ **A exceção que FICA:** as setinhas do stepper (28×20/21). É a decisão do UX-51 — o alvo de
  verdade é o campo, e ele agora É de 44px.
  ⚠ **Onde o alvo cresce SEM devolução, e por quê:** `.details-links a`. A fileira tem `flex-wrap`
  com `gap` de 8px, e devolver a diferença faria duas linhas de link se sobreporem — dois alvos de
  44px a 24px de distância é pior que o alvo pequeno. O painel de detalhes cresce, e é o preço certo.
  **Medição final, com recarga antes de cada leitura:** 375×812 → **0 alvos abaixo de 44** nas 7
  rotas (fora a exceção); 1280×800 → **0 abaixo de 32**. Nenhuma rota ganhou rolagem lateral
  (`scrollWidth` = 375 em todas).

#### ⚠️ Ressalvas da AUD-14 (não são itens; viram item se o dono mandar)

- ✅ **A régua de 44px** — era ressalva, **virou item e fechou no lote 4** (acima). Fica o registro
  do diagnóstico: a afirmação do `CLAUDE.md` de que a régua já valia era minha e estava errada, e a
  ressalva herdada falava em "1–4px" quando a faixa real ia de **2 a 24px**.
- ✅ **Nome acessível por `title`, não por `aria-label`** — **FECHADA em 2026-08-31.** Eram **21
  sítios no fonte** (os "48 + 5" eram instâncias renderizadas: 24 recibos × 2 botões). Varredura por
  script, não a olho — casa cada `<button>` com `title` e sem `aria-label` e checa se o corpo é só
  ícone; re-rodado depois dá **0**. Medido ao vivo nas 7 rotas: **678 botões só-ícone renderizados,
  0 sem nome** (`/catalogo` 545 · `/vendas` 51 · `/orcamento` 49 · `/producao` 27 · as outras 3 × 2).
  ⚠ **Fiz mais que a régua:** em fileira repetida o rótulo **nomeia o quê** — `"Excluir"` virou
  `"Excluir ovo fidget"`, `"Editar venda"` virou `"Editar a venda de <cliente>"`. Ouvir "Excluir" 97
  vezes seguidas não diz o que se vai excluir; o `title` continua o texto curto do hover, onde o
  contexto visual já está na tela.
  ⚠ **Falso positivo declarado:** a varredura ao vivo acusou **4 botões sem nome** no `/orcamento`
  que o scanner de fonte não via (não têm `title`). São os `.num-spin`, dentro de um wrapper
  `aria-hidden="true"` com `tabindex="-1"` — **não existem para leitor de tela, por desenho**. Filtro
  corrigido para ignorar `[aria-hidden='true']`; o número real é 0. É a mesma ressalva de steppers
  já registrada na AUD-16.
- ✅ **Os `<select>` cortavam texto sem reticências** — **a metade MUDA fechou em 2026-08-31.**
  `select { text-overflow: ellipsis }` global no `base.css`: o defeito é do elemento, não de uma
  tela. **Prova no pixel** (o mesmo `<select>` duplicado no mesmo quadro, o clone com `clip`
  forçado): `Avulso (fora d…` ⌄ contra `Avulso (fora do est` ⌄ — sem a regra o texto entra **por
  baixo da seta** e some no meio da palavra. Medido a 375px nas 7 rotas + o modal de venda aberto:
  **0 `<select>` sem `ellipsis`**, rolagem lateral **0**, e o pior corte (`.cesta-add`, **300px**)
  agora se anuncia. Escolhido por ser o único item da lista que **piora com o recadastro** — nome de
  cor tem a diferença no FIM da string ("PLA Azul Bebê" vs "PLA Azul Bebê Seda").
  ⚠ **O que NÃO fechou:** o `<select>` continua sem encolher (`min-content`), por isso as colunas
  seguem em `minmax(0, 1fr)` — a regra trata o que acontece DEPOIS de encolher, não o encolher.
  ⚠ **A receita de medição fica valendo:** a caixa nativa **cobra a seta por cima do texto**, então
  medir só com a largura da FONTE subestima. Mede-se com um `<select>` clone em
  `width: max-content`, nunca com `measureText` — foi assim que os 300px saíram.
- **Lixo que o recadastro leva embora** (registrado só para não voltar como achado novo): 18 dos 97
  produtos carregam um campo `id` **dentro** do documento, e um deles aponta para **outro produto**
  (resíduo do "salvar como novo") · 65 dos 97 ainda têm `markupOnFixed`, morto desde a DEC-01 · **4**
  docs de `acabados` órfãos com saldo 0 (a AUD-13 disse 2; eram 3, e o 4º é da própria AUD-14) · um
  acabado com saldo **−1** (`teste 3 avisos etapa 8`, −R$ 13,07) · dois contadores de orçamento
  (`config/orcamentoSeq.last = 21`, o vivo, e `config/orcamento.lastNumber = 2`, lixo).
  ⚠ **A mecânica que sobrevive ao recadastro:** `saveProduct` usa `tx.update`, que faz **merge** —
  campo que o `buildProductPayload` deixe de gravar fica no documento **para sempre**.
- **`roundPrice("0.90")` devolve 48,899999999999998579** em vez de 48,90 exato — ruído de ponto
  flutuante abaixo do centavo, mas é assim que vai para o `suggestedPrice`.
- **Reconferidas e idênticas:** o **overdraft de −370 g na Bege** (saldo 243 g = −370 do rolo de
  18/07 + 613 do de 10/08; furo de contagem física, o D4 preserva de propósito) · o **`[A11Y-02]`**
  continua **falso positivo**, agora confirmado no fonte · o **`[TD-021]`** segue ressalva do dono.

#### O que a AUD-14 NÃO cobriu

- **Dos 7 buracos herdados, 4 fecharam** (offline real → virou o `[D2]` · duas abas com o guarda
  `rev` → passou · forma dos documentos no Firestore → virou o `[D6]` e três ressalvas · `/maquinas`
  além da leitura → watts editados, 60 produtos recalculados, tudo restaurado). **Seguem abertos:**
  **escala acima de 500 produtos** (o dono não autorizou as 1.040 escritas; o corte de 500 do
  `createProductsBatch`, onde o lote pode entrar pela metade, segue **sem prova**) · **regras de
  segurança do Firestore** (5ª varredura seguida, exige 2ª conta Google) · **Google Sheets** (o
  Excel fechou; o Sheets exigiria login e envio de arquivo).
- Importação/exportação de **vendas** (o botão "Exportar CSV" do `/vendas` existe e não foi
  exercitado) · navegadores fora do Chromium embutido e **iOS Safari real** · o **modal de máquinas
  nas larguras de celular** · a exclusão de produto **offline ao vivo** · **screenshots** (o painel
  não estava compondo quadros; toda medição visual saiu do DOM).
- ⚠ **Armadilha nova, para a próxima varredura:** a regra do projeto sobre `transition` na leitura
  de cor tem forma pior que a documentada — **quando o painel não está compondo quadros, a transição
  não avança nunca**, e esperar não resolve. Só `transition: none` antes de ler devolve o valor
  real. Custou um falso positivo (147 falsas falhas de contraste em 7 rotas).

### Ordem de prioridade — ondas (dono, 2026-08-16)

> **O que mudou nesta data:** a fila antiga tinha 14 linhas, **11 riscadas**, e o único bloco vivo
> (o cluster da auditoria de 2026-08-16, com 20 itens) estava marcado *"sem ordem interna"* — ou
> seja, o backlog **não ordenava nada do que sobrou**. As ondas abaixo são o martelo do dono sobre
> os 21 itens abertos de código.
>
> **O critério que decidiu a ordem — prazo externo, e ele corta pros DOIS lados:**
> - **[TD-014] feito ANTES da marca ECONOMIZA** — com a cor tokenizada, o rebrand vira troca de
>   paleta; sem ela, são 14 edições à mão em literais que fixam o RGB do laranja. → **sobe**.
>   ✅ **Feito (onda 2)** — a tinta agora mora num `-rgb` por cor no `base.css`, e todo o resto
>   deriva dela. O prazo externo **deixou de existir**.
> - **[DEC-05] feito antes da marca CUSTA** — o próprio item registra a ressalva do dono de que
>   vai precisar de ajuste depois. É o simétrico do TD-014. → **desce, sai da fila.**
>
> ⚠ Dentro de cada onda **não há ordem** — são do mesmo tamanho e do mesmo tipo. O que a onda fixa
> é *quando o bloco entra*, não a sequência interna.

> ✅ **Ondas 0, 1, 2 e 3 FECHADAS em 2026-08-16** (mesmo dia) e as **4 e 5 em 2026-08-17**. A 0 eram
> as duas perguntas — respondidas (ver abaixo); a 1 eram os 5 consertos; a 2 era o bloco COR, com o
> **prazo externo da marca já neutralizado** (a cor virou token: o rebrand agora é troca de
> paleta); a 3 era grade e alinhamento; a 4 era sistema (modal, semântica, foco, alvo, estado
> desabilitado) e levou o **[UX-35]** de carona; a 5 era matemática e leitura (barra empilhada,
> ritmo em janela de 90 dias, ressalva em `<details>`). Writeups: `HISTORICO.md`.

| Onda | Itens | Por que aqui |
|---|---|---|
| ~~5 — matemática e leitura~~ | ~~[UX-26] · [TD-016] · [UX-34]~~ | ✅ **Fechada em 2026-08-17.** Era a última da fila. |
| **fora da fila** | **[DEC-05]** (lucide) + **[G2]** | Fazer **junto do rebrand**, não antes — ver o critério acima. |
| **⏸ bloqueadas** | **[FEAT-03]** + **[branding/logo real]** (a marca não existe) · **[Dashboard]** (precisa de ~1-2 meses de venda real) | Sempre por último; nenhuma das duas depende de decisão nossa. |

> ⚠ **Com o cluster da auditoria zerado (2026-08-18), esta tabela é o backlog INTEIRO** — e as três
> linhas dependem de algo de fora: a logo (dono/designer) ou ~1-2 meses de venda real no banco.
>
> ⚠ **Vencido em 2026-08-23:** a **AUD-12** reabriu o backlog de código com 15 itens, e eles **não
> estão nesta tabela** — não passaram pelo martelo do dono. A fila de ondas continua valendo só para
> o que sobrou do rebrand; a ordem dos itens novos é a decisão pendente.

> Diretriz 7 (dados descartáveis, marco futuro) cobre o backlog inteiro → **nenhum item precisa de
> migração**. Não reordenar por causa disso.

### Itens abertos

#### ✅ Cluster da auditoria de layout responsivo (2026-08-17) — ZERADO

> Auditoria pedida pelo dono a partir de um print (nome de peça quebrado letra a letra no
> `/estoque`). Medição no DOM nas 7 rotas, em 375px e 1280px, acordeões abertos um a um, mais um
> passe de contraste WCAG nos dois temas — que **passou sem nenhuma falha**.
> **10 achados, 10 fechados:** os 4 bugs de layout na hora (causa raiz única, `1fr` sem
> `minmax(0, …)`) · **[UX-36]** + **[UX-37]** (alvo de toque + peso do destrutivo) · **[UX-39]** sem
> código · e **[UX-38]** + **[UX-40]** + **[A11Y-01]** em **2026-08-18**. Writeups e medições no
> [`HISTORICO.md`](HISTORICO.md).
>
> ℹ️ **Os 2 achados que NÃO viraram item** (registrados pra não voltarem como achado novo): o range
> do markup transborda **2px** do container (folga nativa do thumb); e os `.btn-sm` medem 31–33px —
> abaixo dos 44px, mas isso é anterior à auditoria e já está no writeup do `[micro]` de 14px.

#### ✅ Cluster da auditoria de 2026-08-16 (UX-20…UX-34 · TD-014…TD-016) — ZERADO

> A auditoria de UI/UX + cálculo (site rodando, dados reais, 7 rotas + 9 modais, dois temas,
> medição no DOM) rendeu **33 achados → 21 itens**, distribuídos nas ondas 0–5. **Todas fechadas
> entre 2026-08-16 e 2026-08-17** — nenhum item do cluster está aberto.
> O levantamento (A1…I3, com os números medidos) e os writeups vivem no
> [`HISTORICO.md`](HISTORICO.md): seção "🔍 Auditoria de UI/UX + cálculo (2026-08-16)" e as
> seções "✅ Onda N".
>
> O único resíduo é o **[G2]** (os emoji dos rótulos não seguem regra nenhuma) — nunca foi item
> próprio: está anexado à **[DEC-05]**, logo abaixo, que foi pro rebrand.


### Aberto — resíduo da auditoria FORM-01 (2026-08-20)

> Os dois defeitos do FORM-01 foram corrigidos. Sobrou o que ficou **fora** daquela varredura.

- ~~**[AUD-01] Auditar o estorno/reedição de recibo**~~ — **FEITO na varredura AUD-02
  (2026-08-22)**, e a previsão estava certa: o defeito era mesmo *"função que reconstrói um objeto
  campo a campo e esquece um"* — o `SaleModal` montava o `ReciboWrite` sem `supplyUpdates`. A
  matemática do estorno passou exata nos dois caminhos (`encomenda` e `acabado`, incluindo o
  overdraft D4). Detalhe: [`HISTORICO.md`](HISTORICO.md).

#### Sobrou da varredura AUD-02 (2026-08-22) — ✅ TODOS FECHADOS pela AUD-07 (2026-08-22)

- ~~**[AUD-03] Ponta a ponta contra o Firestore**~~ — **FEITO na AUD-07** (com aval do dono para
  gravar): cor + insumo criados, produção real, venda de peça pronta, 3 reedições e exclusão. Tudo
  apagado no fim; banco devolvido ao estado inicial, conferido campo a campo.
- ~~**[AUD-04] Offline de verdade**~~ — **PARCIAL na AUD-07**: exercitado com `navigator.onLine`
  forçado a `false` (calculadora e importação travam com aviso e não gravam). **Continua sem** o
  teste com a rede realmente caída (fila do Firestore, promise pendente, reconexão) → virou
  ressalva do **[AUD-08]**.
- ~~**[AUD-05] Orçamento/PDF**~~ — **FEITO na AUD-07**: PDF gerado de verdade e o texto extraído do
  arquivo. Os números batem com a tela. Rendeu **[TD-017]** e **[UX-43]**.
- ~~**[AUD-06] Taxas + tempo real**~~ — **FEITO na AUD-07**: margem líquida recalculada à mão nas 3
  combinações (3,14% à vista · 6,11% em 3× · repasse com gross-up arredondado) e tempo real
  confirmado em duas abas. Máquina editada recalculando o catálogo **não** foi exercitada (escreve
  no doc compartilhado `config/machines`) → **[AUD-08]**.

### Ordem aprovada pelo dono — 4 lotes (2026-08-22)

> O cluster AUD-07 é o backlog inteiro de código hoje. O dono aprovou esta ordem. O critério: **o
> que sai errado pro cliente primeiro**, depois **o que destrava a carga em massa**, depois o resto.
>
> **A descoberta que reagrupou a lista:** CSV-06, CSV-07, CSV-08 e UX-41 **não são 4 itens** — são o
> MESMO defeito em 4 portas: um número em pt-BR lido por um parser que não fala pt-BR. O app tem
> `formatDecimal` (formata pt-BR pra fora) e **nada** que leia pt-BR pra dentro; cada porta
> improvisou a sua. → uma primitiva `parseDecimalPtBr` em `lib/formatting/`, e as 4 portas a chamam.

| Lote | Itens | Estado |
|---|---|---|
| **0** | **[TD-017]** | ✅ **FEITO (2026-08-22)** |
| **1** | **[CSV-06]** + [CSV-07] + [CSV-08] + **[UX-41]** | ✅ **FEITO (2026-08-22)** |
| **2** | [UX-42] · [TD-018] · [TD-019] | ✅ **FEITO (2026-08-22)** |
| **3** | [UX-43] · [TD-020] | ✅ **FEITO (2026-08-22)** — fecha o cluster AUD-07 |

**[AUD-08] fica FORA dos lotes de propósito:** metade da lista dele (*"escrita de 100 produtos de
verdade"*) é **exercitada de graça pela carga em massa real**. Varrer antes é ensaiar o que vai
acontecer sozinho depois. Reavaliar **depois** da carga.

#### Aviso resolve no import, NÃO resolve na digitação — medido (2026-08-22)

> O dono perguntou, com razão, se não bastava avisar quando o dado viesse errado. **No import, sim**
> — é o que o CSV-06 faz: o texto chega inteiro no código, dá pra ver que `"1,5"` é vírgula pt-BR e
> apontar. **Na digitação, não.**
>
> Uma tecla de vírgula de verdade num `<input type="number">` produz:
>
> ```
> keydown      key=","   → chega, e é identificável
> beforeinput  data=","  → dispara
> input                  → NÃO dispara: o Chrome recusa a inserção
> value: "3" → "5" → "35"        a vírgula some e os dígitos colam
> validity.badInput: false       nada denuncia depois
> selectionStart: null           e setRangeText lança InvalidStateError
> ```
>
> O `"35"` é o mesmo mecanismo do `143,53 → 14353` que a auditoria mediu à mão. **O que impede o
> aviso é o `badInput: false`:** o que chega no código é um número VÁLIDO, 100× maior. Não há erro a
> detectar depois do fato.
>
> ⚠ **Correção de um registro anterior deste arquivo.** Numa primeira medição eu afirmei que a tecla
> chegava anônima (`key:""`, `code:""`, sem `beforeinput`) e que interceptar era *impossível*. Estava
> **errado**: aquele evento vazio era a ferramenta de automação não mapeando a tecla `comma` — o
> mesmo evento vazio aparecia num `<input type="text">`, onde a vírgula obviamente funciona. Passando
> o caractere `,` em vez do nome `comma`, o evento chega normal. **Interceptar no `beforeinput` É
> possível.** Não foi o caminho escolhido por três motivos concretos, não por impossibilidade:
> sem `selectionStart` só dá pra acrescentar no fim (editar no meio do número quebra); um campo
> numérico não exibe os estados intermediários `"143,"` nem `"143."`, o que exige um "decimal
> pendente" com aresta em backspace, colagem e seleção; e o celular continuaria sem setinha.
>
> ⚠ **Armadilha de método, que vale pra próxima varredura:** digitação sintética mente de duas
> formas. `type` manda a string inteira num `beforeinput` só (`data:"1,5"`), e `key` com o NOME da
> tecla (`comma`) entrega um evento vazio. Só `key` com o **caractere** reproduz o teclado humano.

#### Decisão do dono: setinhas artesanais, não perder o incremento — ✅ FEITO

O dono usa muito as setinhas de incremento, e `type="text"` não as tem. → **`type="text"` +
`inputMode="decimal"` + stepper próprio.** Protótipo medido nas 4 frentes: `143,53` → 143.53 ✓ ·
`27.14` (ponto) → 27.14 ✓ · clicar ▲▲ em `143,53` → `143,55` ✓ · tecla ↓ em `27.14` → `27,13` ✓.
Devolve o valor **em pt-BR**, aceita `step` por campo, e passa a ter setinha **no celular** — que a
nativa nunca renderizou. Os **40 usos não mudam** (`value: number` / `onChange` intactos); muda o
`NumberInput` + CSS do stepper, que precisa respeitar o alvo de 44px (UX-28/UX-37).

### Aberto — cluster da varredura AUD-07 (2026-08-22)

> 2ª varredura ponta a ponta, pedida pelo dono **antes da carga em massa**, com a regra de que a
> passada anterior **não é referência** (nem as correções dela). Método e medições:
> [`HISTORICO.md`](HISTORICO.md). Eram **10 defeitos**, reportados sem correção (a varredura tinha
> regra de só reportar). ✅ **Os 10 foram corrigidos em 2026-08-22**, nos 4 lotes acima — o
> [CSV-06], que bloqueava a carga em massa, incluído.
>
> ⚠ **Dois itens tinham o diagnóstico errado**, e a correção está registrada em cada um: o
> **[CSV-06]** (a coluna escalar não zerava; o `cor-sem-peso` disparava; mas os filamentos nem
> parse tinham) e o **[UX-43]** (o travessão nunca foi comido — era artefato de extração; o
> defeito real é a string inteira virar UTF-16). Vale reler os dois antes de citá-los.

#### 🔴 Bloqueante da carga

- ~~**[CSV-06] Vírgula pt-BR DENTRO das células JSON vira 0, em silêncio.**~~ — ✅ **FEITO
  (Lote 1).** Primitiva `parseDecimalPtBr` em `lib/formatting/number.ts` nas 4 portas + classe
  `numero-nao-reconhecido`. A reprodução corrigiu o diagnóstico deste item em 3 pontos, anotados
  abaixo. Descrição original: Fora das colunas
  escalares (que passam pelo `parseNumber`), todo número do JSON é lido com `Number(x) || 0` →
  `Number("1,5")` é `NaN` → **0**. Medido ponta a ponta: linha com `printHours:"1,5"`,
  `pricePerKg:"200,00"`, `unitPrice:"12,50"` e `modelG:"140,0"` importou **sem um único aviso** e
  nasceu a **R$51,58 em vez de R$223,32** (custo 25,78 vs 83,03); o documento gravado ficou com
  `printHours: 0`, `pricePerKg: 0`, `unitPrice: 0`, `totalG: 3.53`.
  **A checagem `cor-sem-peso` da AUD-02 não cobre o pior caso**: ela roda `filamentsTotalG` no array
  **cru** (`productCsv.ts:808-814`), onde `totalG` ainda vale 143,53 — mas `makeFilament`
  (`filaments.ts:41`) recalcula `totalG` como a soma do detalhe, e o `modelG` com vírgula zerou.
  **Onde:** `productCsv.ts:314` (`parseStages`) · `:343` (`parseAccessories`) · `:363`
  (`parseSubitems`) · `:665` (filamentos entram crus).
  ⚠ **O que a reprodução corrigiu neste diagnóstico** (medido antes de consertar):
  · `printHours` **não** zerava na coluna escalar `Tempo (h)` — ela passa pelo `parseNumber`; quem
    zerava era o `printHours` DENTRO do `Etapas JSON`;
  · a checagem `cor-sem-peso` **disparava** no caso relatado (`num("143,53")` já é 0), ao contrário
    do que este item dizia;
  · mas os filamentos eram **piores** que o descrito: não havia parse nenhum, só um
    `as FilamentUsage[]` — a string `"143,53"` viajava até o Firestore num campo tipado `number`.
    O `Acessorios JSON` e o `markup` do `Subitens JSON` eram os silenciosos de verdade.

  **Correção proposta:** um `numFromCsv()` (o `parseNumber` pt-BR) em **todo** campo numérico dos 4
  JSONs (`printHours`, `laborMinutes`, `weightG`, `filamentPricePerKg`, `totalG`, `modelG`,
  `supportG`, `purgedG`, `towerG`, `pricePerKg`, `qty`, `unitPrice`, `markup`) + classe de issue
  `numero-nao-reconhecido` nomeando o campo + rodar `cor-sem-peso` sobre as cores **normalizadas**.

#### 🟠 Alto (não bloqueia, mas morde cedo)

- ~~**[TD-017] `/vendas` e `/orcamento` precificam SEM o preço vivo do rolo.**~~ — ✅ **FEITO
  (Lote 0, 2026-08-22).** A `SalesPage` já tinha o `stock` em mãos (linha 201) — faltava só passá-lo;
  a `QuotePage` ganhou o `useStock`. Varri as **11** chamadas de `calculatePricing`: eram as 2 únicas
  sem o argumento, e agora nenhuma está. `lint` ✅ · 483/483 ✅ · `build` ✅.
  `SalesPage.tsx:232` e `QuotePage.tsx:122` chamavam `calculatePricing(product, machines, fixedCosts)`
  — falta o 4º argumento `stock`, que as outras 6 chamadas passam (`CatalogPage:91`,
  `PricingCalculator:128`, `ProductCatalog:171`, `ProductionPage:142`, `SaleFlow:67`,
  `StockPage:236`). Medido: o MESMO produto vale **R$51,58 no catálogo** e **R$18,47** no seletor da
  venda, no orçamento e no PDF. Com o catálogo todo ligado ao Estoque, isso dispara na primeira
  compra de rolo com preço novo. **Correção:** passar `stock` nos dois pontos.
- ~~**[UX-41] O campo numérico engole a vírgula e concatena os dígitos.**~~ — ✅ **FEITO (Lote 1):**
  `type="text"` + `inputMode="decimal"` + stepper artesanal (o dono não quis perder o incremento).
  Medido no app: vírgula ✓ ponto ✓ clique ▲▼ ✓ teclas ↑↓ ✓ · 0 cortes em 18 campos · 375px sem
  rolagem lateral · console limpo. Efeito colateral corrigido: a coluna "Vida (h)" do modal de
  máquinas cortava "7500" em "750" (UX-21) — stepper 18→14px e a grade alargada. Original:
  `NumberInput.tsx:58` (`type="number"`) + `:50` (`Number(raw)`). Medido digitando de verdade:
  **`143,53` → `14353`** (100×), preço R$27,14 → **R$4.896,51**; `R$ 118,90` → `11890`. Com ponto
  funciona. Nada avisa. **Correção:** `type="text"` + `inputMode="decimal"` normalizando a vírgula
  para ponto (a mesma função do CSV), ou no mínimo um `onKeyDown` que faça a troca.

#### 🟡 Médio

- ~~**[UX-42] Aviso FALSO de saldo negativo ao editar recibo.**~~ — ✅ **FEITO (Lote 2).** O
  `planReciboReconciliation` passou a **delegar** ao `reconcileReciboWrite` em vez de repetir o
  cálculo: eram duas implementações que PRECISAM concordar, e por isso divergiram. Ele agora aceita
  o mesmo `old`, que no `SaleModal` saiu de dentro do salvar e virou um `useMemo` que o preview
  também lê. Verificado no app, sem gravar: com saldo 3 e venda antiga de 1, **QTD 4 não avisa** e
  **QTD 5 avisa "1 além"** — o limiar e o número certos. Original: O preview usa
  `planReciboReconciliation` (forward puro, `SaleModal.tsx:588`) enquanto a gravação usa
  `reconcileReciboWrite(..., old, ...)` (`:715`) — o preview não credita de volta o que o recibo
  antigo consumiu. Medido: com 1 conjunto em estoque, editar 1→2 avisou *"o saldo fica negativo"* e
  o resultado real foi **0**, sem overdraft. Atinge também `crossesRoll`/`filamentShortfallG` e o
  **custo real exibido** durante a edição (pode divergir do gravado quando o FIFO atravessa rolo).
- ~~**[TD-018] Chave React duplicada no extrato do Estoque.**~~ — ✅ **FEITO (Lote 2):** o índice do
  move entra na chave, e é o índice da lista **COMPLETA** (não da filtrada), senão a chave mudaria
  conforme a cor/insumo que se está olhando. Extrato aberto nas duas abas do `/estoque` com o
  console limpo. Original: `stock.ts:319` e `supplies.ts:237`
  montam a chave com id do evento + id do rolo, o que **não é único** quando um evento tem ≥2 baixas
  do mesmo rolo/lote. Medido: `Encountered two children with the same key` repetido no console do
  `/estoque`. Hoje o extrato ainda soma certo (2000−597=1403 ✓), mas o React pode omitir/duplicar
  linha — no extrato que serve justamente para auditar estoque. **Correção:** juntar o índice do
  move na chave.
- ~~**[TD-019] Os KPIs de `/vendas` não atualizam depois de gravar.**~~ — ✅ **FEITO (Lote 2).** Além
  do que o item descrevia, faltava a causa de o número nunca se corrigir sozinho: **o `onSnapshot`
  não reemite quando só o metadata muda**, então o snapshot de confirmação simplesmente não chegava.
  A assinatura passou a pedir `includeMetadataChanges` e o callback leva `pending`
  (`hasPendingWrites`); a aggregation query só roda com a escrita **já confirmada**, e enquanto isso
  o total anterior fica na tela em vez de piscar um número errado. O caminho de PRODUTO não mudou
  (soma no cliente, e o doc otimista já está lá).
  ⚠ **Verificado por código, `build` e `lint` — NÃO ao vivo:** a prova exige gravar uma venda de
  verdade no Firestore, e isso não estava combinado nesta sessão. Fica como insumo do **[AUD-08]**.
  Original: `useSalesPage.ts:63` dispara
  `fetchSalesTotals` dentro do `onSnapshot`, que chega **antes** do servidor confirmar (latency
  compensation); o snapshot de confirmação é só metadata e não refaz a busca. Medido: registrei a
  venda, a linha apareceu e o topo continuou **47 / R$2.620,70**; após recarregar, **48 /
  R$2.729,60**.

#### 🟢 Baixo

- ~~**[UX-43] O PDF do orçamento come o travessão e as aspas curvas.**~~ — ✅ **FEITO (Lote 3), mas
  o DIAGNÓSTICO DESTE ITEM ESTAVA ERRADO.** O travessão nunca foi comido: o jsPDF declara
  `/Encoding /WinAnsiEncoding` e grava `—` no byte **0x97**, que nessa tabela É o travessão. Quem
  extrai o texto lendo o stream como Latin-1 (onde 0x97 é um controle invisível) vê o caractere
  "sumir" — foi artefato de extração da varredura. O mesmo vale para as aspas curvas, `…`, `•`, `€`
  e `·`: todos têm byte e sempre renderizaram certo.

  **O defeito real está ao lado e é MAIOR.** Um único caractere SEM byte no cp1252 não se perde
  sozinho: o jsPDF reescreve a **string inteira** em UTF-16BE e deixa a fonte declarada WinAnsi.
  Medido no bloco de texto do arquivo:

  ```
  "A—B"  (travessão, tem byte) → (A<97>B) Tj             1 byte por char, ok
  "A‐B"  (U+2010, sem byte)    → (<00>A <10><00>B) Tj     UTF-16BE
  "A🐱B" (emoji, sem byte)     → (<00>A<d8>=<dc>1<00>B)   UTF-16BE
  ```

  Como o leitor lê byte a byte pela tabela WinAnsi, **a linha toda vira lixo** — um nome de produto
  com emoji levaria junto o nome inteiro. O saneador é cirúrgico por isso: preserva tudo que tem
  byte (mantém a linha no caminho de 1 byte) e troca só o que não tem. Rebaixar o travessão para
  hífen, como a "correção proposta" original pedia, pioraria um PDF que já estava certo.

  ⚠ **Lição de método, para a próxima varredura:** extrair texto de PDF só vale como medição se a
  extração respeitar o `/Encoding` do arquivo. Descrição original: Medido no PDF real:
  `"ZZ AUDIT Produto  Corpo · PLA azul"` (o travessão sumiu; o `·` sobrevive) e o rodapé
  `"7 dias  até 29/08/2026"`. Como o app monta o nome do subitem com travessão e usa `option.name`
  como descrição (`QuotePage.tsx:174`), **todo orçamento de subitem sai sem o separador**.
  **Correção:** sanitizar os caracteres fora do WinAnsi antes de escrever, ou embutir fonte Unicode.
- ~~**[CSV-07] A checagem "milhar ambíguo" erra dos dois lados.**~~ — ✅ **FEITO (Lote 1).** O falso
  negativo saiu testando no texto limpo. O falso positivo NÃO tem conserto estrutural ("2.375" e
  "1.234" são idênticos): quem decide é a coluna — `Tempo (h)` e `Tarifa Energia` saíram da
  checagem, porque nelas a leitura de milhar é absurda. Original: `productCsv.ts:197` testa o regex no
  texto **bruto**: `"R$ 1.234"` vira 1,234 e **não avisa** (o prefixo quebra o regex); e
  `Tempo (h) = 2.375` — valor que o **próprio export escreve** — **acende** o aviso (falso positivo
  no round-trip). **Correção:** testar depois da limpeza de moeda/espaço.
- ~~**[CSV-08] Formato EN e milhar com 2 pontos passam mudos.**~~ — ✅ **FEITO (Lote 1):** com os
  dois separadores, o ÚLTIMO é o decimal; separador repetido é milhar. Original: `parseNumber` (`productCsv.ts:175`):
  `"1,234.56"` → **1.23456** (1000× menor) e `"1.234.567"` → **1.234**. Relevante se a planilha for
  gerada no Google Sheets em locale en-US.
- ~~**[TD-020] Máquinas e taxas gravam sem `guardOnline`.**~~ — ✅ **FEITO (Lote 3).** `saveMachines`
  virou `async` e devolve a **mensagem de erro** (ou `null`): o `MachineManagerModal` mostra e **não
  fecha**, em vez de fechar por cima de um save que não aconteceu. `saveFees` é chamada a cada tecla
  e sem `await`, então lançar viraria unhandled rejection por dígito — ela expõe um `error` que o
  editor de taxas renderiza. Nos dois casos o `guardOnline` vem ANTES do `await`, porque offline a
  Promise do Firestore não resolve nem rejeita. Original: `useMachines.ts:87`
  (`void persistMachines(...)`, fire-and-forget, sem tratar erro) e `useFees.saveFees`. Offline a UI
  mostra o valor novo (estado local + localStorage) e a escrita fica enfileirada — "finge que
  salvou". **Verificado só no código** (escrever em `config/machines` estava fora do combinado).

#### Observação registrada (não é defeito — decisão do dono)

- A produção com desfecho **falha** também dá baixa do insumo (medido: 4 unidades). Se o ímã só é
  montado depois da impressão boa, a falha não deveria consumi-lo. A tela declara isso antes de
  registrar, então é escolha, não silêncio.

#### O que a AUD-07 NÃO cobriu

- **[AUD-08] Insumo da próxima varredura.** ~~Escrita de 100 produtos de verdade~~ (✅ **coberto
  pela AUD-09, 2026-08-23**: 100 gravados de fato, atomicidade confirmada, banco restaurado); **edição de máquina** recalculando o
  catálogo (escreve no doc compartilhado); **offline real** (só simulei `navigator.onLine`);
  ~~round-trip do form via CSV **não cobre** `createdAt` nem os 3 nulos legados~~ (✅ **coberto pela
  AUD-09** — viraram [CSV-15] e [CSV-20]); só **um**
  produto-cobaia (faltou produto sem subitens vendendo acabado, multicolor com cor por etapa —
  SKU composta — e `piecesCount` > 2); importação/exportação de **vendas**, filtros e paginação do
  histórico, `/maquinas` além da leitura, tema claro; **concorrência** (duas abas gravando o mesmo
  recibo); e o **saldo negativo pré-existente** no banco (contador "SALDO NEGATIVO 1"), cuja origem
  não investiguei.

### Aberto — cluster da varredura AUD-09 (2026-08-23) — IMPORTAÇÃO/EXPORTAÇÃO DE CSV

> 3ª varredura, pedida pelo dono **imediatamente antes da carga em massa** e restrita a
> `productCsv.ts` + o fluxo de import do `ProductCatalog.tsx`. Mesma regra das anteriores: o que
> está marcado como corrigido **não é referência**, e diagnóstico registrado também não — cada
> item abaixo foi **reproduzido** antes de virar achado. Reportado sem correção (o dono decide os
> lotes).
>
> **Método:** harness local em vitest sobre as funções puras (≈120 casos) + **escrita real no
> Firestore de produção**, com aval do dono: backup dos 97 produtos em disco, round-trip do
> catálogo real (97 cópias), carga de 100 produtos escritos à mão, teste de atomicidade, e
> **limpeza verificada** no fim — 198 documentos criados e apagados, banco de volta a **97/97
> idênticos por conteúdo e mesmos ids**. Cores (2) e insumos (2) intactos.
> `lint` ✅ · **523/523 em 5 execuções** ✅.
>
> ⚠ **Armadilha de método que eu mesmo pisei e vale registrar:** o helper de dump escrevia
> `{ id: doc.id, ...doc.data() }` — o spread sobrescreve o id do caminho quando o documento tem um
> campo `id`, e isso **mascarou um produto legítimo** na lista de "originais". Se eu tivesse
> limpado por aquela lista, teria apagado um produto real. Dump de Firestore põe o id do caminho
> **por último** e com nome que não colide (`__id`). Foi também o que revelou o [CSV-18].

### Ordem aprovada pelo dono — AUD-09 (2026-08-23)

> O dono aprovou **A + B** antes da carga. O **C** (tabela de-para cor → id + planilha-modelo)
> fica pendente até ele **cadastrar as cores e os insumos definitivos** — hoje o banco só tem os
> 2 de teste, e a de-para nasceria com id que vai ser jogado fora.

| Lote | Itens | Estado |
|---|---|---|
| **A** | [CSV-09] + [CSV-10] + [CSV-11] — os 3 bloqueantes | ✅ **FEITO (2026-08-23)** |
| **B** | [CSV-12] · [CSV-13] · [CSV-14] · [CSV-15] | ✅ **FEITO (2026-08-23)** |
| **C** | ~~tabela de-para (cor → id) + planilha-modelo~~ | ❌ **CANCELADO** — vira spec escrita no chat, sem botão (ver acima) |
| **D** | [CSV-16] + [CSV-21] + [CSV-22] | ✅ **FEITO (2026-08-23)** |

**Fora dos lotes:** só o [CSV-17] (o arredondamento pede o token e **avisa** quando não recebe) —
entra na spec da planilha. [CSV-18], [CSV-19] e [CSV-20] são resíduo legado que o round-trip limpa.

> **O [CSV-16] mudou de lado.** Estava classificado como "doc, não código" com o argumento de que *o
> parser não tem como saber que 'Tempo (min)' é minuto*. **O argumento é falso: o cabeçalho DIZ a
> unidade.** O que faltava era ler. Reclassificado e fechado no lote D — e o dono apontou o motivo
> de valer o esforço: o formulário já aceita horas **e** minutos (`PrintTimeField`), e o sistema que
> vai gerar a planilha tira o tempo da impressão, que reporta em minutos.

#### 🔴 Bloqueia a carga

- ✅ **[CSV-09] FEITO (Lote A).** Coluna escalar PRESENTE e vazia (ou ilegível) virava 0 — sem um
  único aviso. Helper `cellNumber` em `productCsv.ts`: **coluna ausente e célula vazia caem no MESMO
  default**, e a célula escrita que não dá pra ler fica no default + acende a classe nova
  `coluna-numero-nao-reconhecido`, nomeando a coluna. Vale nas 7 escalares (a 8ª, `Markup`, já
  tinha checagem própria). **Efeito colateral bom: a "regra de ouro" morreu** — pôr a coluna e
  deixar em branco agora é seguro. Descrição original:
  **Mecanismo:** o default só vale quando a coluna está **AUSENTE** (`indexX >= 0 ? parseNumber(...)
  : DEFAULT`). Presente, passa pelo `parseNumber`, que é `parseDecimalPtBr(value) ?? 0` — o wrapper
  leniente. O comentário dele diz "use nas colunas cujo vazio JÁ significa zero", mas em
  `Tarifa Energia`, `Valor-hora`, `Mao de obra (min)` e `Taxa Falha` o vazio **não** significa zero:
  significa o default 0,8 / 30 / 15 / 3.
  **Medido** (mesma linha, única diferença = as 4 colunas presentes e em branco):
  custo **R$ 15,19 → R$ 7,08** · preço **R$ 30,10 → R$ 21,24**. `warnings: []`, `issues: [cor-avulsa]`.
  **Medido por coluna** (valor `"abc"`, referência preço R$ 27,52):
  `Peso (g)` → **10,51** · `Filamento (R$/kg)` → **10,51** · `Mao de obra (min)` e `Valor-hora` →
  **22,37** · `Tempo (h)` → **22,16** · `Tarifa Energia` → **27,05** · `Taxa Falha (%)` → **26,70**.
  **Das 8, só `Markup` avisa** (`markup-invalido`). As outras 7 são mudas.
  **Por que bloqueia:** a carga é uma planilha escrita à mão. Célula em branco é o erro mais
  provável que existe — e é justamente o único sem sinal. É o mesmo defeito que o [CSV-06] fechou
  **dentro** dos JSONs, sobrevivendo **fora** deles.

- ✅ **[CSV-10] FEITO (Lote A).** A 2ª passada do `resolveColumns` roda **do needle mais LONGO para
  o mais curto** (era a ordem de declaração), e `filaments` passou a ter needle `"filamentos"`.
  Comprimento é o desempate certo: needle mais longo é o mais específico, e o par
  `filamentos`/`filamento` se resolve sozinho em qualquer ordem de cabeçalho. Descrição original:
  **Cabeçalho `Filamentos` (sem a palavra "JSON") é capturado pela coluna de PREÇO — e a
  lista de cores inteira vira um número absurdo, calada.**
  **Mecanismo:** `resolveColumns` faz 2 passadas. O `claimed` do CSV-02 só protege quando **uma
  das duas** casou por nome EXATO. Quando nenhuma casa, a passada por `needle` roda na ordem de
  declaração de `COLUMN_SPECS`, e `filamentPrice` (needle `"filamento"`) é declarada **antes** de
  `filaments` (needle `"filamentos json"`) — então `"Filamentos"` é reclamada pelo preço, e a
  coluna de cores não acha mais nada.
  **Medido:** cabeçalho `Produto;Tempo (h);Filamentos` com JSON de cor válido →
  `filamentPricePerKg: 11050`, `weightG: 0`, **sem** `filaments`. `warnings: []` — e nem entra em
  "coluna ignorada", porque foi reclamada. Duplamente silencioso.

- ✅ **[CSV-11] FEITO (Lote A), e melhor do que "só avisar".** A lista `CALCULADAS` (`includes` sobre
  substring) virou `COLUNAS_CALCULADAS`, com os **10 nomes exatos** que o próprio export escreve, e
  ganhou **dois** usos: suprime o aviso só por **igualdade exata**, e **impede captura por needle**.
  É essa segunda trava que permitiu encurtar os needles pra `"energia"` e `"inclui"` sem risco de
  roubarem as calculadas `Energia (R$)`/`Custo Fixo (R$)` — então `Tarifa de Energia`,
  `Energia (R$/kWh)` e `Inclui custo fixo` passaram a ser **LIDAS**, não só apontadas.
  (`"inclui"` e não `"fixo"`: "fixo" casaria com qualquer coluna de custo fixo inventada ao lado.)
  Descrição original: **A supressão do aviso "coluna ignorada" engole variantes de DUAS colunas de
  ENTRADA.**
  **Mecanismo:** a lista `CALCULADAS` suprime o aviso por `includes` sobre o cabeçalho inteiro, e
  contém `"energia"` e `"custo fixo"` — que também casam com nomes das colunas de entrada
  `Tarifa Energia` e `Inclui Fixo`. Resultado: o nome não é reconhecido (needle não bate) **e** não
  é avisado.
  **Medido** (varredura sistemática: 19 colunas × variantes plausíveis, todo o resto exato):
  `"Tarifa de Energia"` → `energyTariff` 0,8 (planilha dizia 99) · `"Energia (R$/kWh)"` → 0,8 ·
  `"Inclui custo fixo"` → `includeFixed` false (planilha dizia "sim"). **Os três, calados.**
  As outras 12 variantes que erraram **avisaram** — a mecânica geral está certa; são estes dois
  vazamentos.

#### 🟠 Alto (não bloqueia, mas morde na carga)

- ✅ **[CSV-12] FEITO (Lote B).** O `numFromJson` passou a testar `isMilharAmbiguo` também quando CONSEGUE ler, e o reporter ganhou um `kind` para carregar as duas notícias sobre o mesmo campo. Classe própria (`milhar-ambiguo-json`), porque o conselho é outro: na coluna a saída é escrever com vírgula decimal; dentro do JSON, onde o decimal já é o ponto, a saída é tirar o ponto. Descrição original: **`milhar-ambiguo` não roda DENTRO das células JSON.** A checagem cobre 4 colunas
  escalares; o JSON é onde moram os pesos de verdade do modelo. **Medido:** `"totalG":"1.234"` →
  **1,234 g**, sem aviso, e o `cor-sem-peso` **não** dispara (1,234 > 0). Um produto de 1234 g
  entra 1000× mais leve, invisível.

- ✅ **[CSV-13] FEITO (Lote B).** A checagem roda **cor a cor** sobre as normalizadas, e o exemplo NOMEIA a cor zerada (ou a posição, quando ela não tem nome). Descrição original: **`cor-sem-peso` só olha a SOMA da lista, não cada cor.** **Mecanismo:**
  `filamentsTotalG(lista.map(makeFilament)) === 0`. **Medido:** 2 cores, uma com `totalG: 0` →
  **nenhum aviso**. Em produto multicolor — a feature-bandeira do app — uma cor zerada por engano
  passa batida.

- ✅ **[CSV-14] FEITO (Lote B), em duas metades.** (1) Quem decide o separador é o próprio `parseLine`: entre `;`, TAB e `,`, vence o que PARTE o cabeçalho em mais células (empate fica com `;`, que é o que o export escreve) — contar caractere seria frágil, porque vírgula dentro de célula citada conta igual. Se dois candidatos partem o cabeçalho, um aviso diz qual usei. (2) O caso que a detecção sozinha NÃO resolve — vírgula com decimal pt-BR sem aspas, onde o separador está certo e a linha desalinha — virou a classe `celulas-demais`: célula A MAIS que o cabeçalho não tem outra explicação. A MENOS tem (planilha enxuta) e segue calada, e separador sobrando no fim da linha não conta. Descrição original: **O separador sai só do cabeçalho, e vírgula/TAB degradam em silêncio.**
  **Mecanismo:** `const separator = rawLines[0].includes(";") ? ";" : ","`.
  **Medido:** planilha com `,` e decimais pt-BR **sem aspas** — `Caneca,2,5,50` → `printHours: 2`,
  `weightG: 5`, terceiro valor descartado, `warnings: []`. Planilha com **TAB** → a linha inteira
  vira o NOME do produto, todo o resto no default; só acendem `linha-invalida`/`cor-avulsa`.
  Com `,` **e** aspas (o que o Excel faz) funciona.

#### 🟡 Médio

- ✅ **[CSV-15] FEITO (Lote B).** Um só instante de referência por arquivo, mais o índice da linha: instante distinto por produto E ordem da planilha preservada (linha de baixo = mais recente). Descrição original: **`createdAt: Date.now()` no parse → a carga inteira nasce no mesmo instante.**
  **Medido na escrita real:** 100 produtos → **3 valores distintos** de `createdAt`; o round-trip de
  97 → **6**. Consequência: "Mais recentes"/"Mais antigos" fica arbitrário para o lote todo (a
  tela ordenou 047, 095, 061, 049…). Não corrompe nada; atrapalha achar o que acabou de entrar.

- ✅ **[CSV-16] FEITO (Lote D)** — e reclassificado: **era código, não doc.** `Tempo (min)` virou
  coluna própria (`timeMinutes`, needle `"tempo (min"`, que vence `"tempo"` na ordenação por
  comprimento do CSV-10) e **soma** com `Tempo (h)`, a mesma conta do `PrintTimeField` do
  formulário. Pro cabeçalho que o needle não pega (`"Tempo de impressao (min)"`), a 2ª trava é
  `headerEmMinutos`, que lê a unidade no texto da coluna que a de horas reclamou — com
  `\bmin(utos?)?\b`, pra "Tempo mínimo" não virar coluna de minutos. Descrição original: o needle
  `"tempo"` casa; **medido:** 120 → `printHours: 120`. Erro de 60×, sem aviso.

- **[CSV-17] `Arredondamento` pede o TOKEN, não o rótulo da tela.** O dono vê "Final ,90
  (psicológico)" na UI e precisa escrever `0.90`. **Medido:** `"0,9"` → `arredondamento-invalido`
  (avisa certo), `"0.90"` e `"0,90"` → ok. Como avisa, é item de modelo, não de código.

#### 🟢 Baixo / informativo (não é da importação)

- ✅ **[CSV-21] FEITO (Lote D).** Set de classes já contadas na linha corrente, zerado a cada volta
  do laço. Os **exemplos** seguem por ocorrência (até 3) de propósito: numa linha só eles nomeiam
  campos diferentes, que é a informação acionável. Os 2 testes que travavam o comportamento antigo
  viraram "1 linha + N exemplos". Descrição original: o `addIssue` somava 1 por chamada, então uma
  única linha com 3 células ruins da mesma classe era reportada como **"3 linhas"** — e é esse
  número que decide se o dono confirma a carga ou volta pro Excel.

- ✅ **[CSV-22] FEITO (Lote D) — aberto nesta conversa, a partir de uma pergunta do dono**
  (*"usar o id aleatório do Firestore pode dar problema?"*). **Um `filamentId` errado mas
  EXISTENTE amarra o produto na cor errada, calado.** A checagem do CSV só pergunta se o id existe.
  O id é auto-id do Firestore (`addDoc`), ninguém digita, todo mundo cola — paste deslocado ou
  `PROCV` mal ancorado na planilha não deixa rastro. Conserto: cruzar com o `colorName` da MESMA
  célula JSON (o export escreve os dois). Divergiu, avisa (`cor-nome-divergente`) e **não escolhe**:
  vale o id, o dono decide. Por `normalizeText` (acento/caixa não contam); nome vazio é ausência;
  id inexistente acende só o `cor-inexistente`; vale também pra cor de etapa.
  ⚠ **Não vale pros insumos:** o acessório tem `desc` (texto livre, "ima"), não o nome do insumo —
  cruzar daria falso positivo em série.

- **[CSV-18] 18 documentos do catálogo carregam um campo `id` DENTRO do dado.** O `id` é o caminho,
  não campo (CLAUDE.md). Em 17 o valor é igual ao id do caminho (eco inofensivo); em **1** —
  caminho `4MKTY5K6OGldKp0zDZNB`, "Clicker The Sheep - Rosto cor da orelha" — aponta para **outro**
  documento (`nTpe34KAcIQf4rxhmYjL`). **Não vem da importação:** medido, **0 dos 100** importados
  têm o campo, e o `buildProductPayload` de hoje faz `delete base.id`. É resíduo legado — e o
  round-trip por CSV, aliás, **limpa**.

- **[CSV-19] `markupOnFixed` em 65 documentos** — campo que não existe no `ProductPayload`, nem no
  `toSavedProduct`, nem no CSV. Morto; o round-trip descarta. Só registro.

- **[CSV-20] Etapa legada `combineEnabled`/`stage2` não sobrevive ao round-trip.** O export lê
  `product.stages`, não `normalizeStages`. **Medido:** a 2ª etapa legada some e o custo cai — **mas
  a rede do CSV-03 pega** (`custo 19,08 → 5,11` no aviso de divergência). E, medido no banco real,
  **nenhum** dos 97 documentos tem `stage2` preenchido → hoje é inalcançável.

#### ✅ O que está SÃO — medido, não presumido

> Registrado porque a pergunta do dono era "vai dar certo?", e a maior parte da resposta é **sim**.

- **Round-trip do arquivo do app é estável:** `export → parse → export` deu arquivo **idêntico**
  (97 produtos reais + 4 sintéticos com etapa/acessório/subitem/markup/links/detalhamento de cor).
  A 3ª volta também.
- **Diff campo a campo dos 97 reais:** toda diferença é normalização **documentada** — defaults
  preenchidos (`sellBySubitems`, `subitems`, `roundingMode`, links…), escalares migrando para
  `filaments`, `stages[].energyTariff`/`laborRate` descartados de propósito,
  `accessories[].supplyId`/`subitemId` virando `null`. **`recalc`: 0 divergências em 97 linhas.**
  ⚠ Sem *stringify canônico* apareciam 33 falsos positivos em `stages[].filaments` — só ordem de
  chave. A regra do CLAUDE.md se confirmou na prática.
- **O que caiu no banco bate com o parse:** os 97 documentos gravados casaram **exatamente**
  (0 sem par) com os payloads que o `parseProductsCsv` produziu; os 100 da carga saíram com forma
  **uniforme** (as mesmas 24 chaves em 100/100), sem `undefined`, com os 3 nulos legados e sem
  campo `id`.
- **As 13 classes de aviso: nenhum falso positivo.** Nos ~45 casos de controle, todas acenderam
  quando deviam e ficaram caladas quando não deviam — incluindo os limítrofes (`[]` e `[ ]` não são
  JSON inválido, `{}` é; markup vazio não avisa, `"abc"` avisa; detalhamento sem `totalG` não é
  cor-sem-peso; subitem apontando `"main"` ou `stage_0` sem id explícito é válido).
- **Encoding e formato:** ANSI lido como UTF-8 é **detectado** (3 caracteres ilegíveis → aviso
  certo). CRLF, BOM, célula com quebra de linha citada, aspas dobradas, linha em branco no meio,
  linha `;;`: todos corretos. Nome repetido conta certo (arquivo + catálogo).
- **pt-BR:** vírgula decimal, ponto de milhar, `R$`, espaço não-separável — corretos, inclusive
  **dentro** do JSON quando o número vem como string (`"143,53"` → 143,53). `1.234` acende
  `milhar-ambiguo` nas 4 colunas certas e **não** acende em `Tempo (h) = 2.375`.
- **Escala e atomicidade:** 100 produtos = 17,7 KB, parse **5,1 ms**, e da confirmação até
  aparecerem na tela **1,48 s**. Lote com 1 payload inválido → **nada entra** (294 → 294), nos dois
  modos de falha (`undefined` barrado pelo SDK; documento > 1 MiB barrado no commit).
- **Uma linha ruim entre 100 não derruba as outras:** no parse ela entra degradada e é apontada;
  na escrita, ou entra tudo ou nada (≤ 500 é um `writeBatch` atômico).

#### 📋 Resposta direta: o conjunto MÍNIMO de colunas

- **Obrigatória: `Produto`. Só ela.** Sem essa coluna a importação lança
  `Coluna "Produto" não encontrada.` e **nada** entra. Linha sem nome é pulada em silêncio.
- **Todo o resto é opcional** e cai em default **quando a coluna está AUSENTE**: máquina = a 1ª
  (A1), Tempo 0, Peças 1, Tarifa 0,8, Mão de obra 15 min, Valor-hora 30, Markup 3, Taxa de falha 3,
  Inclui Fixo "não", Arredondamento `exact`, links vazios, sem etapa/acessório/subitem.
- **Mínimo RECOMENDADO — as 15 colunas que eu carreguei com 100 linhas e ZERO avisos:**
  `Produto` · `Maquina` · `Peso (g)` · `Tempo (h)` · `Pecas` · `Filamento (R$/kg)` · `Markup` ·
  `Taxa Falha (%)` · `Tarifa Energia` · `Mao de obra (min)` · `Valor-hora (R$)` · `Inclui Fixo` ·
  `Arredondamento` · `Filamentos JSON` · `Acessorios JSON`.
- ~~**Regra de ouro enquanto o [CSV-09] estiver aberto: coluna que você NÃO vai preencher, não
  coloque.**~~ **Morreu com o lote A:** coluna ausente e célula **vazia** agora caem no MESMO
  default. Deixar em branco é seguro; o que aponta é o valor escrito e ilegível.
- **Nomes:** acento e caixa não importam ("Máquina" = "Maquina"). **Depois do lote A**,
  `Filamentos` (sem "JSON"), `Tarifa de Energia`, `Energia (R$/kWh)` e `Inclui custo fixo` também
  funcionam. Use `;` como separador e salve como **CSV UTF-8** — TAB e `,` são detectados, mas com
  `,` todo decimal precisa ir **entre aspas** (`"1,5"`), senão a linha desalinha (a importação
  avisa, mas o excedente é descartado).
- **Depois do lote D:** o tempo pode vir em **horas, em minutos, ou nos dois** — `Tempo (h)` e
  `Tempo (min)` são colunas distintas e **somam** (2 h + 30 min = 2,5 h), e hora decimal continua
  valendo. Um cabeçalho que diga minuto de outro jeito (`Tempo de impressao (min)`, `Tempo em
  minutos`) também é lido como minuto ([CSV-16]).
- **Continua valendo:** `Arredondamento` pede o **token** — `exact`, `0.90`, `4.90`, `0.5`, `1`,
  `5`, `10` —, não o rótulo da tela ([CSV-17], que ao menos avisa).
- ✅ **O de-para (nome → id) sai pelo app** — botão **"Copiar de-para"** nas abas Filamentos e
  Insumos do `/estoque` (2026-08-23), em TSV: cola no Sheets/Excel já em colunas. Cores saem com
  `Cor · Material · Marca · Arquivada · id` — material e marca vão junto porque `colorName` sozinho
  repete entre materiais, e é aí que um de-para cego amarra na cor errada. Antes disso o único
  caminho era o console do Firebase (medido: nada na `/estoque` renderizava o id, e o export do
  catálogo só revela id de cor **já usada** por algum produto).
- **Decisão do dono:** segue com o auto-id — a alternativa (slug) colide entre materiais/marcas e exigiria esquema de desempate.
  **A regra que isso cria:** depois da carga, cor se **edita** (nome, preço, arquivar — tudo
  preserva o id); **excluir e recriar gera id novo** e mata o vínculo de todos os produtos que a
  usam. A exclusão já lista os produtos/vendas afetados antes de confirmar (`filamentReferences`).
- **Pré-requisito confirmado (item E):** a importação **não cria** cor nem insumo — medido, 2 cores
  e 2 insumos antes e depois de importar 100 produtos que os referenciam. Referência órfã **entra
  assim mesmo**, avisando (`cor-inexistente` / `insumo-inexistente`); máquina que não casa cai na
  primeira e avisa; máquina em **branco** cai na primeira **sem** avisar. Ou seja: **cadastre as
  cores e os insumos definitivos ANTES**, e ponha os ids reais no JSON.

#### O que a AUD-09 NÃO cobriu

- **Acima de 500 produtos** (lotes sequenciais, estado parcial possível): li o código e o próprio
  repositório documenta, mas **não medi** — exigiria criar 500+ documentos. A carga prevista é ~100.
- **Excel de verdade:** sintetizei ANSI/CRLF/BOM/separadores em bytes. Não abri o arquivo no Excel
  nem no Google Sheets para ver o que ELES escrevem ao salvar.
- **O seletor de arquivo do sistema:** injetei o `File` via `DataTransfer` — `FileReader`, parse,
  modal e `writeBatch` rodaram de verdade, mas o diálogo do SO não.
- **A planilha-modelo / spec** continua por fazer; esta varredura define o que ela precisa conter,
  não a entrega. A **tabela de-para (cor → id)** saiu de cena: o dono pega os ids no console do
  Firebase depois de cadastrar as cores e alimenta o sistema externo dele (2026-08-23).

### Aberto — cluster da varredura AUD-12 (2026-08-23) — SISTEMA INTEIRO, 2ª passada

> 5ª varredura (a **v2** da geral), pedida pelo dono **imediatamente antes da carga em massa**, com
> a regra mais dura até aqui: **nada é verdade até ser reproduzido** — inclusive os `✅ FEITO` deste
> arquivo, os comentários do código, os nomes dos testes, as mensagens de commit e **o relatório da
> AUD-11**, cujas duas listas (4 defeitos corrigidos + 78 verificações sãs) entraram como hipótese.
> Reportado **sem correção**: o dono decide os lotes.
>
> **Relatório com todas as medições:**
> <https://claude.ai/code/artifact/b7e0753b-ec6a-4e1a-9418-91ac4667766c>
>
> **Método:** 10 arquivos de harness em vitest (~350 casos) · sonda instalada em `window` medindo o
> DOM nas **7 rotas × 2 temas × 4 larguras** (375 / 400–430 / 700 / 1280) com os acordeões abertos ·
> os **9 modais** medidos um a um (o buraco declarado da AUD-11) · PDF gerado em node e o texto
> extraído do stream · **importação real** montada em JS, disparada no `input[type=file]`, o diálogo
> lido e **cancelada**. `lint` ✅ · `build` ✅ · **603/603** ✅ · `git status` vazio ·
> **0 escritas no Firestore** (a de duas abas gravando ficou pendente de aval — ver o fim da seção).
>
> ⚠ **Três falsos positivos MEUS, declarados** (valem mais que achado inflado): (1) "o
> `buildProductPayload` perde o `weightG` de etapa legada" — errado, montei o estado do formulário à
> mão; o caminho real passa por `createStage` → `normalizeFilaments`, que migra o escalar antes de
> qualquer save (refeito pelo documento: `doc1 === doc2`, preço 78,80 → 78,80); (2) "`marginTier(65)`
> está errado" — é a DEC-04 escrita, faixa fechada nas duas pontas, e o arredondamento antes do
> faixeamento é de propósito; (3) "`worstPaymentFee` devolve 2% havendo 6%" — meu fixture usava
> `t1`/`t2` em vez de `visamaster`/`amexelo`; com as constantes reais devolve 7,19%.
>
> ✅ **O lote AUD-11 segura.** Os 4 foram reproduzidos e nenhum criou falso positivo: auditei **toda**
> coluna escalar numérica do `COLUMN_SPECS` e nenhuma ficou fora da checagem de milhar; a 2ª trava do
> CSV-16 acende nos 3 cabeçalhos testados; o `cor-sem-preco` fica **mudo** com cor real que tem rolo
> (confirmado ao vivo com o id do Bege) e nunca coexiste com `cor-sem-peso` na mesma cor; o
> round-trip do próprio export dá **0 avisos** apesar de `printHours: 2.375`; e `"2 e 5"` não vira
> 200000.

#### ✅ 🔴 Entra CALADO na carga — os 5 FECHADOS nos lotes A e B (2026-08-23)

- ✅ **[CSV-23] FEITO (Lote A, 2026-08-23).** `parseBool` passou a aceitar `sim/s/true/verdadeiro/v/1/x/yes/y` (e `nao/n/false/falso/f/0/no/-` para negar), e a grafia fora das duas listas acende `booleano-nao-reconhecido` nomeando a coluna — o default calado era o defeito, não a grafia. Célula VAZIA continua sendo ausência, e segue calada. Descrição original: **`parseBool` só aceita `"sim"` — `TRUE`/`1`/`VERDADEIRO` viram `false`, sem um aviso.**
  Atinge as duas colunas booleanas: `Inclui Fixo` e `Vende por Subitens`. **Medido**, 13 grafias na
  mesma linha: `"sim"`/`"SIM"`/`" sim "` → `true` (custo fixo 4,76 · total 27,65 · **preço 57,98**);
  `"TRUE"`/`"true"`/`"VERDADEIRO"`/`"1"`/`"S"`/`"Y"`/`"yes"` → `false` (fixo **0,00** · total 22,89 ·
  **preço 53,22**), com **0 avisos** nos três canais (`warnings`, `recalc`, `issues`).
  **Impacto:** a planilha vem de um sistema externo; se ele escrever em inglês, o catálogo inteiro
  nasce sem repassar aluguel e fixos — **−R$ 4,76/peça (−8,2%)** — e a margem exibida continua
  "normal", porque é calculada sobre o custo que ficou. Mesmo formato do `Tempo (min)` da AUD-11.
  **Onde:** `productCsv.ts:247`. **Saída:** aceitar o vocabulário de planilha (`sim/s/true/1/x/v/
  verdadeiro`) **e** acender uma classe nova para a grafia não reconhecida — o default calado é o
  defeito, não a grafia.

- ✅ **[CSV-24] FEITO (Lote A, 2026-08-23).** O casamento por substring continua — vira `maquina-por-aproximacao`, classe AGRUPADA e não um `warnings.push` por linha (o palpite erra em bloco: se o sistema externo escrever "AnyCubic A1 Mini", são as 100 linhas de uma vez). E o desempate deixou de ser a ordem do array: vence o **id mais longo** contido no nome, o mesmo critério do CSV-10 — "Maquina X2D e A1" agora dá **x2d**. Descrição original: **Nome de máquina casado por SUBSTRING, e o palpite não se anuncia.**
  `machineNameToId` tenta o nome exato; falhando, procura a 1ª máquina cujo **id** esteja contido no
  nome. Esse 2º caminho **nunca chama o `onFallback`** — só o fracasso total avisa. **Medido**,
  8 nomes: `"AnyCubic A1 Mini"` → **a1**, `"Elegoo Neptune A1"` → **a1**, `"meu x2d antigo"` → x2d,
  `"Maquina X2D e A1"` → **a1** (a 1ª do array vence, não a mais específica) — os quatro **sem
  aviso**; só `"Prusa MK4"` avisa.
  **Impacto:** energia, desgaste e manutenção saem da máquina errada e `machineMissing` fica
  `false`, então nem o badge ⚠ do catálogo aparece. Diferença A1 × X2D no mesmo produto:
  **R$ 53,22 → R$ 65,13 (+22%)**, quase tudo desgaste (2,1196 → 5,5996). O id `a1` tem 2
  caracteres: casa dentro de quase qualquer nome de impressora. **Onde:** `productCsv.ts:625`.
  **Saída:** é o padrão 11 (*o palpite que não se anuncia*) — o casamento aproximado pode continuar,
  desde que vire aviso, como o [CSV-10]/D-3 da AUD-11 fez com as colunas.

- ✅ **[UX-44] FEITO (Lote B, 2026-08-23), e a correção foi APAGAR, não reescrever.** O override de `grid-template-columns` do bloco de 760px saiu inteiro: além do `1fr` puro, as larguras eram as **pré-UX-41**, e sem ele a regra boa do `modal.css` vale de 641px para cima. Abaixo de 640px (a fronteira de cartão que o resto do arquivo já usa) a fileira **vira cartão**, com colocação EXPLÍCITA nos 6 itens — colocar só o botão em `3 / 1` não tira a coluna 3 do fluxo automático, e o campo Watts caía nela (32px de caixa para 44px de conteúdo). ⚠ **Achado NOVO, que o relatório não tinha:** a grade cortava `13999` (71px numa caixa de 64) e `7500` (62 numa de 54) **também de 641 a 760px** — a varredura mediu o NOME a 700px, que estava bem, e não os números. Medido depois, em 320/375/400/430/561/641/1013px e nos 2 temas: **0 estouro, 0 corte, 0 rolagem lateral**, botão dentro da caixa. Descrição original: **"Gerenciar Máquinas" quebra no celular: `13999` aparece como `1399` e `7500` como
  `750`.** Único dos **9 modais** que falha (os outros 8 medidos limpos a 375 px). São dois padrões
  do próprio catálogo deste repositório somados:
  · **`1fr` puro em vez de `minmax(0, 1fr)`** — `responsive.css:93` sobrescreve a regra boa do
  `modal.css:87` (`minmax(0, 1fr) 82px 72px 68px 78px 32px`) por `1fr 64px 54px 52px 66px 32px`;
  · **a correção que não foi para a irmã em media query** — o comentário do `modal.css:85` descreve
  exatamente este bug (UX-41: *"7500 deixava de caber e aparecia como 750"*) e alargou as colunas
  **só no desktop**.
  **Medido a 375 px:** colunas resolvidas `22px 64px 54px 52px 66px 32px`; grade com 285 px para
  326 px de conteúdo → **estoura 41 px**; botão de excluir em `right: 371` contra a borda do diálogo
  em `right: 355` → **fora da caixa**; campo Nome com **22 px** para conteúdo de 90–100 px;
  `13999` corta (caixa 64 / precisa 71), `7500` corta (54 / 62), `150` corta (52 / 53).
  **A conta que explica:** 64+54+52+66+32 = 268 px fixos + 5 gaps de 8 px = **308 px** consumidos
  antes de o Nome ganhar 1 px → só cabe a partir de viewport **≥ 416 px**. Medido a 400 px: ainda
  estoura 16 px. A 430 px: 0 estouro, mas Nome com 32 px. A 700 px: Nome com 202 px ✅.
  **Impacto:** as máquinas moram no doc compartilhado `config/machines` e alimentam energia +
  desgaste de **todos** os produtos; editá-las pelo celular hoje é adivinhação. **Saída:** a regra do
  próprio projeto — `minmax(0, 1fr)` na media query e a fileira **virando cartão** (receita do
  `.fg-part`) abaixo dos ~300 px úteis, em vez de rolar.

- ✅ **[CSV-25] FEITO (Lote A, 2026-08-23).** Classe `linha-sem-nome`, com até 3 exemplos mostrando as células que a linha trazia. ⚠ A guarda distingue **linha de dado sem nome** de **linha em branco escrita com separador**: `";;"` sobrevive ao `splitRecords` (`";;".trim()` não é vazio) e a AUD-09 registrou o silêncio dela como SÃO — quem separa as duas é ter, ou não, conteúdo em alguma outra célula. Um teste trava isso. Descrição original: **Linha sem nome desaparece sem entrar em contador nenhum.**
  `if (!name) return []` no `flatMap`: sem `warning`, sem `issue`, sem contagem. O diálogo já mostra
  o total **depois** do descarte. **Medido:** arquivo com 5 linhas de dado, 3 com a célula `Produto`
  vazia (vazia, só espaços, e `""` citada) → **2 produtos**, `warnings: []`.
  **Impacto:** numa planilha de ~100 linhas gerada fora, uma coluna deslocada ou uma linha de
  subtotal zeram o nome — e só se descobre contando o catálogo contra a planilha à mão.
  **Onde:** `productCsv.ts:970`. **Saída:** um `addIssue("linha-sem-nome", …)`; é irmã do
  `celulas-demais`, que já avisa.

- ✅ **[CSV-26] FEITO (Lote A, 2026-08-23).** Os três problemas nasciam de espremer leitura, default e aviso numa expressão só; a separação em `markupCell` (o que a planilha escreveu, e é o que o aviso cita) / `markupRaw` (sem o sufixo `x`) / `markupLido` (o número, `null` se ilegível) resolve os três: `-2` e `0` agora entram **com 3x**, como o aviso sempre prometeu; `"x"` sozinho não vira string vazia e **aponta**; e `<1x` ganhou classe própria (`markup-abaixo-de-1`), porque foi LIDO certo — a linha entra como está, mas o dono sabe que o preço sai abaixo do custo. Descrição original: **O aviso do markup MENTE sobre o que entrou no documento** *(era a ressalva "markup
  negativo entrando no documento", promovida a defeito)*. Três problemas na mesma checagem:
  · `markup: parseNumber(raw) || 3` — **`-2` é truthy**, então o `|| 3` nunca dispara e o documento
  recebe **−2** (preço **−R$ 22,59**), enquanto o aviso diz *"a linha entra com 3x"*;
  · `"0,5"` entra a 0,5× (preço R$ 15,31, **abaixo** do custo R$ 22,89) **sem** a classe
  `markup-invalido` — o teste é `<= 0`;
  · `"x"` vira string vazia no `replace("x","")` e o guarda `if (markupRaw && …)` pula: entra a 3×
  **sem aviso nenhum**.
  **Atenuante:** o `linha-invalida` (que roda o `validateProduct`) pega os dois casos de preço
  absurdo — o que se perde é a confiança no texto. **Onde:** `productCsv.ts:1124` e `:1224`.

#### Ordem aprovada pelo dono — AUD-12 (2026-08-23)

| Lote | Itens | O que é | Estado |
|---|---|---|---|
| **A — o parser volta a avisar** | [CSV-23] · [CSV-24] · [CSV-25] · [CSV-26] | tudo em `productCsv.ts`; a disciplina do CSV-10 (*o palpite que não se anuncia*) | ✅ **FEITO (2026-08-23)** |
| **B — celular** | [UX-44] | CSS; `minmax(0, 1fr)` + fileira virando cartão | ✅ **FEITO (2026-08-23)** |
| **C — qualidade do aviso** | [CSV-27] · [CSV-28] · [CSV-29] · [CSV-31] | falso positivo e conselho errado — o que ensina a ignorar aviso | ✅ **FEITO (2026-08-23)** |
| **D — dívida barata** | ~~[TD-023]~~ · ~~[TD-024]~~ · ~~[TD-025]~~ | comentário que afirma garantia inexistente + 2 guardas | ✅ **FEITO (2026-08-23)** |
| **E — toque e responsivo** | [UX-45] · [UX-46] | faixa 641–760px + os alvos abaixo de 44px; o maior dos cinco | ✅ **FEITO (2026-08-23)** |
| **fora de lote** | ~~[TD-022]~~ · ~~[TD-021]~~ · ~~[CSV-30]~~ | TD-022 reproduzido e corrigido; CSV-30 e TD-021 viraram ressalva (dono) | ✅ **nada aberto aqui** |

#### 🟠 Alto (não bloqueia a carga, mas morde)

- ✅ **[TD-022] FEITO (2026-08-23) — REPRODUZIDO com escrita real e corrigido nas duas metades.**
  Contador `rev` conferido dentro de `runTransaction`, que **RECUSA** em vez de mesclar (mesclar
  produziria um documento que nenhuma das duas pontas quis, e no estoque o FIFO poderia atravessar
  outro rolo). (a) **produtos:** medido — aba A peso 40→99, aba B mão de obra 10→55, B salva antes,
  A depois, e o documento fica com **mão de obra 10**; o formulário de A ainda exibia 10 no instante
  do salvar, porque a assinatura atualiza a LISTA, não a cópia em edição. Depois da correção a
  gravação velha é recusada e o formulário fica intacto. (b) **estoque/insumos/acabados:**
  `reconcileRecibo`, `saveProduction` e `removeProduction` deixaram de ser `writeBatch` (atômico,
  mas **não isolado**), com a conferência num lugar só (`revGuard.ts`). ⚠ O guarda seria inútil se a
  tela do `/estoque` gravasse sem incrementar — `saveStockFilament`/`saveSupply` entraram na mesma
  transação. Recusa medida ao vivo (2 cliques no mesmo tick do React, cor Laranja); e a tentativa
  pelo diálogo "Ajustar" **não** reproduziu, porque o `adjustFor` é derivado da lista viva — o que é
  elogio ao app. Writeup e o estado do banco: [`HISTORICO.md`](HISTORICO.md). Descrição original:
  **Escrita concorrente é last-write-wins, sem controle nenhum.**
  Leitura dos 12 repositórios: `saveProduct` faz `updateDoc(ref, {...payload})` — **documento
  inteiro**; idem `estoque` (`stockRepository.ts:135`) e `insumos` (`suppliesRepository.ts:130`). O
  **único** `runTransaction` do app é a numeração do orçamento (`quotesRepository.ts:86`).
  Consequência: duas abas editando o mesmo produto — a que salvar por último **apaga** a mudança da
  outra em silêncio; duas vendas simultâneas da mesma cor podem perder uma baixa (as duas leem o
  mesmo saldo e escrevem o mesmo resultado). ⚠ **Mecanismo lido no código, NÃO reproduzido** — exige
  escrita real, que ficou pendente de aval (plano no fim desta seção).

- ✅ **[UX-46] FEITO (Lote E, 2026-08-23) — escopo ENXUTO, aprovado pelo dono: só os controles que o
  dedo busca.** Quatro mudanças, todas medidas no DOM antes e depois:
  · **`.icon-button` 28 → 32px** (a régua de desktop; o catálogo já corrigia isso localmente desde o
  UX-15 — era o global que estava atrás) **e → 44px no celular**. O caso comum era o botão de
  excluir SOLTO numa fileira: os quatro aglomerados que já subiam para 44 tinham regra própria,
  quem estava sozinho não tinha ninguém.
  · **`input[type="range"]` 313×4 → 313×44** (celular) / ×32 (desktop): os 4px viraram DESENHO
  (`::-webkit-slider-runnable-track`), com margem negativa devolvendo o crescimento ao fluxo — a
  linha do markup ocupava 14px e continua ocupando 14.
  · **`.btn-sm` 29 → 32/44px** via `min-height`, sem mexer no `padding`.
  · **`.num-spin` 14 → 28px no celular.** A trava dos 14px é do `[micro]` e a razão era medida — mas
  a coluna de 64px que a motivou **não existe mais no celular** (o UX-44 virou a fileira em cartão).
  Remedido: a pior folga vira 18px, no `13999`. No desktop fica em 14, onde a coluna estreita segue
  existindo.
  **Resultado medido:** `/producao` a 1280px **25 → 0** abaixo da régua de 32 · `/producao` a 375px
  43 → 16 · `/estoque` 27 → 19 (os 8 `.btn-sm`) · `/orcamento` 67 → 27. `overflow` horizontal 0 e
  **0 números cortados** em todas as medições.
  ⚠ **Duas exceções DECLARADAS, com a conta:** `.accessory-row` e `.machine-edit-row` (na grade de 6
  colunas, 641–760px) são fileiras de **trilha FIXA** e não têm de onde tirar — medido, o botão de 44
  estourava a fileira de acessórios em 12px e jogava o Excluir para FORA da linha, que é o UX-44
  reaberto pela porta dos fundos. Nelas o botão fica em 32 e o stepper em 14. Onde a fileira JÁ é
  cartão (`.machine-edit-row` ≤640px) a exceção se desfaz e o 3º trilho sobe para 44 junto.
  ⚠ **Armadilha nova, registrada:** `::-webkit-slider-runnable-track` e `::-moz-range-track` NÃO
  podem ir na mesma lista de seletores — um pseudo-elemento desconhecido invalida a **regra inteira**,
  e o Chrome descartava a pista (barra do markup sumia). Duas regras separadas.
  Descrição original:
  **Alvos de toque abaixo da régua — mais largo do que a ressalva antiga dizia.**
  A ressalva falava do *"slider de markup com ~15px de área real"*. **Medido:** o slider tem caixa
  de **313×4 px** com `padding: 0`. E a 375 px, contra os 44 px da regra do projeto:
  `/orcamento` **67** elementos abaixo · `/producao` **41** (25 deles `.icon-button.danger` de
  28×28) · `/vendas` 42 · `/estoque` 27 · `/catalogo` 18. Os steppers `.num-spin` medem **14×20 px**
  (têm `tabindex="-1"`, então não quebram teclado — o dedo é que não acerta). No desktop,
  `.icon-button` 28×28 e `.btn-sm` 29 px contra os 32 da régua.
  ⚠ A técnica documentada (`padding` + margem negativa igual, UX-28/UX-37) **apareceria** no
  `getBoundingClientRect` — ela não foi aplicada nesses lugares.

#### 🟡 Médio

- ✅ **[UX-45] FEITO (Lote E, 2026-08-23).** O corte de cartão do catálogo e do recibo subiu de 640
  para **760px**. Não é número novo: é a outra fronteira que o `responsive.css` já usa, e é o que o
  comentário do `catalog.css` **já afirmava** (*"em 760 o layout já vira cartão"*) — o código é que
  divergia da intenção escrita. **Medido a 700px, depois:** `/catalogo` 68 → **0** de rolagem;
  `/vendas` 130 → **0** em 23 recibos. O editor de máquinas FICOU em 640 de propósito: a grade dele é
  confortável de 641 a 760, e fronteira igual não é virtude quando as larguras mínimas diferem.
  ⚠ **Resíduo medido (a válvula, não é regressão):** a `.recibo-items` pede `min-width: 800px`, então
  de **761 a 841px** ela ainda rola — 81px a 761. É o mesmo desenho da válvula do catálogo (que rola
  19px a 761 e zera em 782). Fica registrado; fechar exigiria cartão até ~842px, que é decisão do
  dono. Descrição original:
  **Faixa 641–760 px: tabela rolando de lado em vez de virar cartão.**
  *(era ressalva aberta; agora medida)*. A regra "vira cartão" só entra em `max-width: 640px`.
  **Medido a 700 px:** `/catalogo` → `.table-scroll` 672 → 740 = **68 px de rolagem**, com a célula
  de nome em 66 px para conteúdo de 99–135 px; `/vendas` → `.recibo-items-scroll` 670 → 800 =
  **130 px**, repetido em 6+ recibos. `/estoque` e `/producao`: **0** ✅.

- ✅ **[TD-023] FEITO (Lote D, 2026-08-23) — o CÓDIGO passou a honrar o comentário (escolha do dono).**
  `addProductionLayers` confere `layer.id` antes do `push`: reaplicar o mesmo evento na mesma SKU não
  soma nada. ⚠ **A outra metade do achado foi resolvida ao contrário, de propósito:** `shiftLayers`
  (e portanto `applyFinishedConsumption`/`reverseFinishedConsumption`) é **DELTA**, e deduplicar por
  `layerId` ali seria BUG — dois recibos diferentes drenando a mesma camada são dois movimentos
  legítimos, e engolir o 2º faria o estorno de um devolver o material do outro. Ganhou comentário
  explicando a assimetria (lá a `layerId` identifica O EVENTO; aqui só aponta DE ONDE tirar).
  5 testes, incluindo os dois lados. Descrição original:
  **`addProductionLayers` NÃO é idempotente, apesar do comentário afirmar que é.**
  O comentário diz *"a `layerId` é evento+SKU, então um mesmo evento nunca duplica camada na mesma
  SKU (idempotente por evento)"* — e o código só faz `existing.layers.push(layer)`, sem checar o id.
  **Medido:** mesmo `eventId` aplicado 2× → **2 camadas com o id idêntico**
  (`EV1____whole__::__nocolor__`) e o saldo dobra de 4 para 8. O mesmo vale para
  `reverseFinishedConsumption` (8 → 12 no estorno duplo). **Risco prático baixo:** o `batch.set`
  grava o doc inteiro já computado, então repetir o batch grava o mesmo valor; e o
  `removeEventLayers` limpa as duas camadas. → **ou o comentário muda, ou o código o honra** (dedup
  por `layer.id`). Um comentário que afirma garantia inexistente é armadilha para quem confiar.

- ✅ **[CSV-27] FEITO (Lote C, 2026-08-23).** O sufixo passa a olhar `rolls.length`: sem rolo mantém
  a frase original (ali ela está certa); **com** rolo diz *"TEM rolo, mas o rolo mais novo está com
  preço 0 — corrija no Estoque"*, que é o que o `catalogPricePerKg` de fato lê. O corpo do aviso
  deixou de mandar "cadastre um rolo" e passou a pedir *"um rolo COM preço"*. 3 testes. Descrição
  original: o sufixo era anexado sempre que a cor existia, sem olhar se havia rolo — cor com 1 rolo
  de `pricePerKg: 0` recebia ordem de cadastrar um rolo que já estava cadastrado.

- ✅ **[CSV-28] FEITO (Lote C, 2026-08-23).** O `resolveColumns` passou a devolver `duplicadas` (os
  índices cujo texto normalizado casa com o de uma coluna JÁ reclamada). Elas saem do aviso de "nome
  não reconhecido" e ganham o seu, com o conselho **oposto**: lá a saída é renomear, aqui é apagar a
  sobra — e a mensagem diz qual das duas venceu (*"vale a PRIMEIRA da esquerda para a direita"*).
  A leitura não mudou. 3 testes. Descrição original: `Produto;Peso (g);Peso (g)` reportava *"o nome
  não foi reconhecido"* — o nome **foi** reconhecido, e a razão errada mandava renomear.

- ✅ **[CSV-29] FEITO (Lote C, 2026-08-23).** A regex de científica virou o helper `matchCientifica`,
  usado pelos **dois** lados do `number.ts`: o `parseDecimalPtBr` a lê antes da limpeza (como já
  fazia) e o `isMilharAmbiguo` sai **mudo** quando ela casa. O milhar ambíguo de verdade (`"1.234"`,
  `"R$ 1.234"`, `"(1.234)"`) continua acendendo, e `"2 e 5"` segue sem virar 200000 — o espaço
  preservado na limpeza é o que o impede. 4 testes. Descrição original: `"1.5E+03"` era lido
  **corretamente como 1500**, mas a limpeza transformava o texto em `"1.503"` e casava o padrão,
  produzindo um aviso que se contradizia.

#### 🟢 Baixo / informativo

- ✅ **[CSV-31] FEITO (Lote C, 2026-08-23) — REPROVA, não arredonda (escolha do dono).**
  `validateProduct` passou a exigir `Number.isInteger(piecesCount)`, então a linha cai no
  `linha-invalida` que a importação já mostra, junto do `milhar-ambiguo` que já acendia. **O motivo
  de não arredondar:** se a planilha queria dizer 1234, virar 1 troca um número absurdo (que salta
  aos olhos) por um plausível (que ninguém acha depois). 0 e ausente continuam passando — o default
  é do chamador (`Math.max(1, …)` no CSV). 5 testes. Descrição original: `Pecas = "1.234"` gravava
  **1,234 peça** e o preço caía de 29,71 para 24,08 — o aviso acendia e o valor absurdo entrava.

- 📌 **[TD-021] RESSALVA, não item (dono, 2026-08-23).** A planilha da carga é **gerada por máquina**
  pelo sistema externo do dono — as entradas abaixo são de escrita à mão, que não é o caminho real.
  Fica registrado para não voltar como achado novo; se a planilha um dia passar a ser editada à mão,
  reabrir. Descrição original: **`parseDecimalPtBr` cola pedaços e devolve número plausível**
  *(padrão 12 do roteiro)*.
  **Medido, 83 entradas:** `"1/2"` → **12** · `"1a2"` → 12 · `"1,2,3"` → 123 · `"2 e 5"` → 25 ·
  `"1E"` → 1 · `"e5"` → 5 · `"(5) (6)"` → −56. Nenhum devolve `null`, então nenhum vira aviso. Em
  compensação `"1-2"`, `"--5"`, `"N/A"` e `"n.d."` viram `null` corretamente, e `"1E+400"` também
  (não vira `Infinity`). **Risco baixo numa planilha gerada por máquina; alto numa escrita à mão.**

- ✅ **[TD-024] FEITO (2026-08-23) — guarda barata.** `machines[0] ?? MAQUINA_AUSENTE` (uma máquina
  de zeros): energia, desgaste e manutenção saem 0, `machineMissing` continua `true` — que é o que a
  tela já sabe mostrar — e o material continua entrando. `lifeHours: 0` é seguro porque a
  depreciação já era guardada por `lifeHours > 0`. "Não achei caminho pela UI" não é "não existe", e
  o preço inteiro depende de a função não explodir. 3 testes. Descrição original:
  **`calculatePricing` com lista de máquinas VAZIA lança `TypeError`.**
  **Medido:** `Cannot read properties of undefined (reading 'watts')`. Alcançável só se
  `useMachines` devolver lista vazia — ele semeia dos defaults e cai em fallback local, então **não
  reproduzi pela UI**. Máquina *inexistente* (id órfão) é tratada certo: cai na 1ª e marca
  `machineMissing: true`.

- ✅ **[TD-025] FEITO (2026-08-23) — guarda barata.** O `|| 1` existe para o campo AUSENTE
  (`undefined`/`NaN`), onde 1 é o default certo — mas 0 e negativo são números que alguém escreveu,
  e responder "vendeu 1" a eles é inventar receita. Agora `Number.isFinite` separa os dois casos:
  ausente → 1, zero/negativo → 0 (receita, custo, taxa e lucro saem 0). 4 testes. Descrição
  original: **`saleItemFinancials` com quantidade 0 vende 1.**
  **Medido:** `quantity: 0` e `quantity: -2` devolvem os dois `totalRevenue: 100, totalCost: 30,
  profit: 70` — é o `Math.max(1, …)`. **Não achei caminho pela UI** que produza qty 0; fica como
  ressalva de biblioteca.

- 📌 **[CSV-30] RESSALVA, não item (dono, 2026-08-23).** Os **dados** são idênticos (diff canônico
  limpo); só a ordem das chaves de `Acessorios JSON` muda no texto. Importa apenas para quem comparar
  arquivos com `diff`, e ninguém no fluxo faz isso. Fica registrado para não voltar como achado novo.
  Descrição original: **O texto do CSV não é estável byte a byte no round-trip.**
  Export → import → export produz a mesma linha com a ordem das chaves de `Acessorios JSON` trocada
  (`subitemId`/`supplyId`). Os **dados** são idênticos (diff canônico limpo); só o texto difere.
  Importa apenas para quem comparar arquivos com `diff`.

#### ✅ Fechado — o resíduo de UI (2026-08-24): os dois últimos itens de código

- ✅ **[UX-47] A fileira de acessórios virou CARTÃO no celular** *(fechado 2026-08-24, medido no
  DOM)*. Era a única fileira do app que nunca virou: `1fr 60px 90px 32px` em TODA largura, com a
  conta fechando no talo a 375px (77 + 60 + 90 + 32 + 3 folgas de 8 = 283px = a largura da linha).
  Por isso ela era EXCEÇÃO à régua de 44px do dedo. Aplicada a receita do projeto (UX-38/UX-40), a
  mesma do `.machine-edit-row` que fechou o UX-44: cada campo ganhou invólucro com rótulo próprio
  (`.acc-field`/`.acc-label`), a `.acc-header` some no celular e a fileira quebra em 2 faixas
  (descrição + excluir em cima, os dois números embaixo). **A exceção morreu inteira, nos dois
  pedaços do range** — abaixo de 640 pelo cartão; de 641 a 760 alargando a TRILHA
  (`minmax(0,1fr) 96px 110px 44px`), porque ali sobra espaço e o certo é dar largura, não tirar
  tamanho do dedo. Medido a 375px: descrição **77 → 229px**, excluir **32 → 44×44** e agora DENTRO
  da linha (right 329 = a borda, contra 341 de antes), stepper **14 → 28px** com **67px** de folga
  para o número (eram 16 — o caso do `[micro]`), rolagem horizontal **0**. A 641 e a 700 a fileira
  segue em pé, com 44px de altura e o excluir de 44 dentro da linha. Desktop **inalterado**
  (`394px 60px 90px 32px`, altura 35, rótulos escondidos).
  ⚠ **A fronteira do cartão é 640, não os 760 do catálogo/recibo** — e isso foi medido antes de
  escolher: a 700px o cartão dava 554px à descrição e **272px a CADA campo de número**, com a
  fileira indo de 44 para 124px de altura. Largura de sobra virando rolagem não é a regra; o cartão
  entra onde a fileira realmente não cabe.
- ✅ **[UX-52] O rótulo passou a dizer as DUAS coisas** *(fechado 2026-08-24, escolha do dono: o
  rótulo, não o aviso)*. O seletor de origem agora lê **"Estoque de acabados (7 disp. · 3 nesta
  cor)"**. Os dois números sempre foram certos e mediam coisas diferentes — `partBalance` soma
  todas as cores (FEAT-11, de propósito) e o aviso vem do `consumeFifo`, que drena da cor ESCOLHIDA
  —, mas lado a lado a leitura era contraditória. Com o segundo número na tela a conta FECHA à
  vista: medido ao vivo no Chaveiro Charmander (Laranja 4 · Bege 3), com Bege escolhida e
  quantidade 7, o rótulo diz "7 disp. · 3 nesta cor" e o aviso "⚠ 4 além" — **7 − 3 = 4**.
  O parêntese só aparece quando os dois DIVERGEM (peça em mais de uma cor); com uma cor só eles
  coincidem e ele seria ruído. Conjunto multicor diz "nestas cores" e usa o **mínimo entre as
  partes**, a mesma conta do `assemblableWholes` — o que limita o conjunto é a parte mais escassa.
  **Nenhum cálculo mudou**: o `colorBalanceOf` só lê o que o seletor de cor já mostrava.
- 📌 **Ressalva medida: o `.icon-button.edit` do `/vendas` renderiza 39×44** dentro do
  `.recibo-head-side` (5px a menos na horizontal, contra 28×28 antes). O contêiner não estoura
  (`overflow: 0`) e `flex: none` não muda o número — a compressão não vem do flex-shrink. Não vale
  turno de investigação por 5px num botão que triplicou de área; fica registrado para não voltar
  como achado novo.
- 📌 **Ressalva: alvos a 1–4px da régua no celular.** Fora do escopo enxuto aprovado, porque todos
  são LARGOS (fáceis de acertar) e falham em um eixo só. **Atualizada pelo lote E da AUD-13
  (2026-08-24):** o `.icon-label-button` (43), o `.search-box-input` (36) e o `.stock-tab` (34)
  **saíram da lista — estão em 44**; os três que sobram são `.back-to-top` 42×42 e a navbar
  (`navbar-toggle` e `navbar-close`) 40×40, remedidos em todas as 7 rotas.

#### Ressalva que FECHA (não é mais item)

- ~~**`filamentId` sem `trim`**~~ — **não é mais silencioso.** `"sc9LAy…ZLb "` (espaço no fim) não
  bate no `Set` e o parser acende `cor-inexistente` **nomeando o id com o espaço visível entre
  aspas**. Nada a fazer.

#### Observação registrada (não é código)

- **O overdraft de −370 g na cor Bege continua exato, no banco de produção.** A tela mostra saldo
  total **243 g** com *"Rolo #5 em uso · 613 g restantes"* — ou seja, os rolos #1–#4 somam
  **−370 g**. Número idêntico ao reportado antes. A matemática está certa (o preço de repor lido é
  R$ 100,00/kg = rolo mais novo ✅); o furo é de **contagem física** e o remédio é o `adjustRoll`
  (D6), que grava o `beforeG` negativo como prova do tamanho do furo.

#### ✅ O que está SÃO — medido, não presumido (64 verificações)

A lista longa, com os números, vive no relatório (link no topo desta seção). O resumo do que foi
**refeito à mão** e bateu dígito a dígito: `calculatePricing` componente a componente no cenário
40 g/3 h/A1 (material 4,4000 · energia 0,2280 · desgaste 2,1196 · manut 0,3600 · labor 7,5000 ·
reserva 0,45178 · total 15,05938 · **preço 29,71423**) · preço ponta a ponta de um produto escalar
(à mão 106,098145 = código 106,10) · FIFO misto (R$ 42,00) · overdraft D4 (R$ 134,40, shortfall
370 g) · gross-up (104,71204188) · `saleItemFinancials` nos 5 campos · custo fixo/hora
(1,5865384615). O round-trip documento→formulário→documento fecha **campo a campo** na 2ª volta
(`doc1 === doc2`, 24 chaves, com *stringify* canônico), e **0 `undefined`** chega ao payload (o
Firestore os rejeita — o client não liga `ignoreUndefinedProperties`). Contraste WCAG AA:
**0 falhas** em 7 rotas × 2 temas. PDF: travessão, aspas curvas, ‰, € e todo o acentuado intactos;
total R$ 1.390,26 = conta à mão. Importação real cancelada: **Catálogo (97) → Catálogo (97)**.
E o cache `calc3d-machines` confirma que `config/machines` em produção é **idêntico** aos
`DEFAULT_MACHINES` — o que valida todas as contas à mão acima contra o banco real.

#### O que a AUD-12 NÃO cobriu

- ~~**Escrita real no Firestore**~~ — ✅ **FEITA em 2026-08-23, com aval do dono**, no conserto do
  [TD-022]: sonda de produto criada e apagada (catálogo 97 → 98 → 97) e a corrida encenada na cor
  Laranja. Banco restaurado aos números exatos; o único resíduo (2 lançamentos no rastro D6, que é
  append-only) está declarado no writeup. O plano abaixo é o que foi executado, com uma diferença:
  a corrida do estoque NÃO precisou de duas abas — dois cliques no mesmo tick do React reproduzem-na
  de forma determinística.
  **Plano, se for autorizado:** 1 produto sonda `__SONDA_VARREDURA__` criado pela importação (1 doc
  em `products`), aberto em **duas abas**, editado em campos diferentes nas duas, salvo em ordem
  invertida, e o documento relido campo a campo para provar ou refutar o **[TD-022]**. Backup em
  disco antes e depois; limpeza pelo id retornado no `addDoc`, com releitura confirmando
  `exists: false`. ⚠ No dump, o id do caminho vai **por último** e com nome `__id` — a armadilha do
  `{ id: doc.id, ...doc.data() }` da AUD-09 não se repete.
- ~~**Duas abas gravando o mesmo documento**~~ — ✅ **FEITO**: o [TD-022] deixou de ser leitura de
  código e virou experimento, com o defeito reproduzido e corrigido.
- **Offline de verdade** (rede caída, fila do Firestore, reconexão). Verifiquei a *guarda*
  (`guardOnline` antes do `await`, nos 5 pontos de escrita) por leitura. Continua sendo o resíduo do
  antigo [AUD-04].
- **Regras de segurança do Firestore** (usuário fora da lista) — exige uma segunda conta Google.
- **PDF contra a tela do `/orcamento` com dado real** — gerei e extraí um PDF sintético completo, com
  os números conferidos à mão. A ponte tela → `QuotePdfData` não foi exercitada.
- **Fluxo completo de venda e produção pela UI** (SaleFlow, submissão, estorno de recibo) — todo
  caminho grava. Matemática medida por harness, atomicidade por leitura.
- **Acima de 500 produtos** (onde o batch deixa de ser atômico). Testei 200 linhas no parser; a carga
  prevista é ~100.
- **Navegadores além do Chromium embutido**, e iOS Safari real.

### ✅ FECHADO — cluster da varredura AUD-13 (2026-08-24) — SISTEMA INTEIRO, 3ª passada

> 6ª varredura (a **v3** da geral), pedida pelo dono **imediatamente antes da carga em massa**, para
> quebrar o ciclo fechado da AUD-12 (mesmo agente escrevendo o conserto e o teste do conserto, 15
> itens no mesmo dia). Regra: **nada é verdade até ser reproduzido** — inclusive os `✅ FEITO` deste
> arquivo, os comentários do código, os nomes dos testes e **as duas listas da AUD-12** (15 defeitos
> corrigidos + 64 verificações sãs). Reportado **sem correção**: o dono decide os lotes.
>
> **Relatório com todas as medições:**
> <https://claude.ai/code/artifact/0eda95a1-d7d0-4a71-9c09-f5834953b6d4>
>
> **Método:** 10 arquivos de harness em vitest (previsão escrita ANTES, conta à mão em aritmética
> decimal depois; apagados no fim) · sonda no DOM medindo **7 rotas × 2 temas × 8 larguras**
> (375/430/700/759/761/800/841/1280), cada rota carregada num `<iframe>` de largura fixa · os 9
> modais · **escrita real no Firestore de produção** com aval do dono: 2 produtos-sonda criados pela
> importação, 2 produções, 1 venda editada e estornada, 1 orçamento com PDF · PDF lido do `Blob` pela
> tabela WinAnsi · offline com `navigator.onLine` forçado.
> `lint` ✅ · `build` ✅ · **672/672 em 4 execuções** ✅ (sem flake) · `git status` vazio.
>
> ⚠ **A varredura ACHOU O QUE PROCURAVA: a AUD-12 quebrou o `/producao`.** O `[TD-022]` (o item
> "fora de lote") deixou cada produto produzível **uma única vez**. Não foi pego porque o defeito só
> aparece na SEGUNDA produção, e ninguém produziu duas vezes o mesmo produto depois de 2026-08-23.
>
> ✅ **A limpeza do banco está LIBERADA desde o lote A (2026-08-24).** Ela tinha parado de propósito
> porque o próprio `[TD-026]` impedia excluir as 2 produções das sondas. Fechado o lote A, "Excluir e
> estornar" apaga os eventos E devolve os 50 g da cor Laranja (1353 → 1403) — é o dono quem roda,
> pela UI, e serve de conferência ao vivo do conserto. Balanço completo no fim da seção.
>
> ⚠ **Três falsos positivos MEUS, declarados:** (1) "a capacidade está 8% errada" — eu esqueci o
> `Math.floor` por conjunto de máquinas; (2) "o `buildProductPayload` corrompe o `includeFixed`" — eu
> chamei a função com a assinatura errada; (3) "o catálogo esconde as ações no celular" — a linha
> ABERTA entrega os 5 botões a 44×44, é o desenho declarado.
>
> ✅ **O que da AUD-12 SEGUROU** (refeito por fora): lotes A e B inteiros (`parseBool` nas 37
> grafias, `linha-sem-nome` vs `";;"`, markup, modal de máquinas a 375/641/700/760 sem corte) · lote
> C (`cor-sem-preco` nomeia certo os dois casos opostos; `isMilharAmbiguo` mudo sobre científica e
> aceso no milhar real; peça fracionária reprova) · `TD-024`/`TD-025` · no desktop o lote E entrega
> **0** alvos abaixo de 32px em `/catalogo`, `/vendas`, `/producao` e `/estoque`, e os resíduos
> declarados batem (`/catalogo` 19px e `/vendas` 81px em 23 recibos, a 761px).

#### 🔴 Entra calado na carga, ou trava a operação

- ✅ **[TD-026] FEITO (lote A, 2026-08-24).** Os TRÊS construtores de payload do acabado passaram a
  chamar um só — `finishedGoodToPayload` —, e o `addProductionLayers` devolve o doc com `rev`. Um dos
  três (o `toPayload` do `saleReconciliation`) já estava certo, e é por isso que a venda escapava: a
  correção foi unificar, não remendar dois. ⚠ O teste é o
  `src/lib/firebase/productionRevRoundTrip.test.ts` — **não é unitário**, como a AUD-13 exigiu:
  Firestore falso em memória + o repositório e os serializadores de verdade nos dois sentidos,
  cobrindo 2ª/3ª produção, "Excluir e estornar" com a cor voltando a 1403 g, produzir depois de
  excluir, e o contraponto (versão velha CONTINUA sendo recusada). Revertido o conserto, 4 dos 5
  falham com a frase literal de produção. Writeup no [`HISTORICO.md`](HISTORICO.md).
  ⚠ **Isto ABRE o `[TD-028]`** (lote C) — leia a ordem obrigatória lá.
  ⚠ **As 2 sondas `ZZ AUDIT` já podem ser limpas pela UI** (nenhuma foi vendida, então não passam
  pelo caminho do TD-028). Descrição original: **cada produto podia ser produzido para o estoque UMA
  ÚNICA VEZ — depois o `/producao` recusava para sempre**, com mensagem FALSA de concorrência,
  porque os dois construtores montavam o payload sem copiar o `rev` e a versão esperada era sempre 0.

- ✅ **[CSV-32] FEITO (lote B, 2026-08-24), em duas metades.** (1) **Reconhecer** — o fallback
  varre os ids explícitos da lista INTEIRA antes de gerar qualquer `sub_<n>` e só usa o que estiver
  livre; o acidente clássico (id explícito + id ausente na mesma lista) morre aí, sem aviso, porque
  não há nada que o dono precise corrigir na planilha. (2) **Avisar** — id explícito REPETIDO é
  outra coisa: o segundo recebe um id livre (a peça não some) e a classe nova `subitem-id-repetido`
  NOMEIA os dois subitens, dizendo também que acessório atribuído àquele id ficou com o PRIMEIRO.
  ⚠ O id do formulário (`sub_<timestamp>_<i>`, em `usePricingForm`) nunca colidiu — o defeito era
  só do parser. Descrição original: **Id de subitem repetido entra calado na carga e come um quarto
  do custo congelado.**
  **Mecanismo:** `parseSubitems` dá ao subitem sem id o nome `sub_<índice>`. Um id explícito `sub_1`
  em qualquer posição + um subitem SEM id na posição 1 → os dois viram `sub_1`. Ninguém precisa
  repetir id: basta misturar id explícito com id ausente, o acidente clássico de planilha gerada
  fora. `validateProduct` passa, o preço fica certo, o diálogo da importação mostra **0 avisos**.
  **Medido ao vivo, com dinheiro:** produção de custo **R$ 15,75** creditou **R$ 11,69** no acabado —
  **R$ 4,06 (25,8%) sumiram** e a SKU "Tampa" nunca existiu. O seletor do `/producao` lista **duas
  opções com o MESMO `value`** (`sub:…:sub_1` para "Corpo" e para "Tampa" — escolher Tampa produz
  Corpo) e o seletor de acabados da venda oferece **a mesma peça física três vezes** ("inteiro",
  "Corpo" e "Tampa", 1 em estoque cada). A tela ainda anuncia "2 subitens · 1 conjunto completo".
  **Onde:** `productCsv.ts:646`; o dano se materializa em `finishedGoods.ts:308` (ver `[TD-027]`).
  **Saída:** duas metades, como no CSV-23. **Reconhecer:** o fallback só usa `sub_<índice>` se o id
  estiver livre na lista inteira (varre os explícitos primeiro). **Avisar:** classe nova
  `subitem-id-repetido` nomeando os dois subitens — sem ela, planilha que repita id de propósito
  segue entrando calada.

#### 🟠 Alto (não bloqueia a carga, mas morde)

- ✅ **[TD-027] FEITO (lote B, 2026-08-24).** As duas perguntas se separaram: a idempotência por
  evento se decide UMA vez por chamada, contra o doc que CHEGOU (SKU que já traz camada com aquele
  `sourceEventId` é replay e se ignora inteira), e entrada repetida DENTRO da chamada **soma** —
  `qty` acumula na mesma camada e o `unitCost` vira a média ponderada, para `qty × unitCost` seguir
  sendo o custo submetido. Uma camada só, com o id determinístico intacto: duplicar o id quebraria
  `removeEventLayers` e `shiftLayers`. O `costBreakdown` funde junto (`sumFrozen === unitCost` de
  graça) e só sobrevive se TODAS as entradas o trouxerem — meia composição mentiria sobre o total.
  Descrição original: **A idempotência do `[TD-023]` engole entrada legítima DENTRO da mesma chamada.**
  `if (existing.layers.some((l) => l.id === layer.id)) continue;` — a `layerId` é *evento + SKU*, e o
  `continue` não distingue "reaplicaram o mesmo evento" de "esta chamada trouxe duas entradas para a
  mesma SKU". A segunda é descartada em silêncio, com a fatia de custo dela.
  **Medido:** 2 entries da mesma SKU (2 un a R$ 30 cada) → saldo **2** em 1 camada e valor **R$ 60**,
  quando a submissão custou R$ 120. E reaplicar o mesmo `eventId` com quantidade DIFERENTE (6 un,
  custo 300) sobre uma camada de 2/R$ 100 não muda nada.
  Hoje só alcançável pelo `[CSV-32]`; fechado o CSV-32 vira latente — mas continua sendo um
  `continue` que descarta dado sem contar. **Onde:** `finishedGoods.ts:308`.
  **Saída:** separar as duas perguntas — idempotência por evento se resolve UMA vez por chamada (a
  SKU já tem camada com aquele `sourceEventId`?); entradas duplicadas na mesma chamada **somam**.

- ✅ **[TD-028] FEITO (lote C, 2026-08-24) — BARRAR (escolha do dono).** O `/producao` passou a ler
  o histórico de vendas e a chamar o `finishedEventReferences` novo (`finishedGoods.ts`, espelho
  exato do `filamentReferences`): recibo vivo em cima das camadas do evento **recusa** a exclusão
  nomeando quem segura ("24/08/2026 · Maria") e quantas peças já saíram. E o `shiftLayers` deixou de
  ser mudo — move deste produto cujo `layerId` não existe mais **lança** com a frase de estoque
  inconsistente, em vez de devolver o doc intacto. O `delta === undefined` no lugar do `!delta`
  entrou junto: delta 0 é camada ACHADA, e o `!delta` a acusaria de órfã. **14 testes novos;
  revertido o `shiftLayers`, os 3 do cenário medido falham** (os outros 11 cobrem a função nova).
  O comentário mentiroso do `removeEventLayers` foi reescrito no lugar. Descrição original:
  **Excluir uma produção já vendida apaga a camada — e o estorno do recibo devolve NADA.**
  `finishedForRemove` chamava `removeEventLayers` sem perguntar se alguma camada do evento já foi
  drenada por venda. A camada some; a venda continua guardando um `FinishedMove` apontando para ela;
  no estorno o `shiftLayers` procura pelo id, não acha e devolve o doc intacto — sem erro, sem aviso.
  **Medido (harness):** produzir 10 un/R$ 100 → vender 4 (saldo 6, valor 60, COGS 40) → excluir a
  produção (**0 camadas**, valor 0) → estornar o recibo → **0 un devolvidas**, quando deveriam voltar
  4 un / R$ 40.
  ⚠ De quebra, o comentário do `removeEventLayers` afirma que manter a SKU vazia serve para que *"o
  custo já vendido não some do rastro"* — **medido, some** (valor 60 → 0). Mesma classe que o próprio
  TD-023 levantou, do outro lado do arquivo.
  ⚠ **ORDEM OBRIGATÓRIA:** hoje este defeito está **mascarado pelo `[TD-026]`** (nenhuma produção que
  creditou acabado pode ser excluída). Consertar o TD-026 sem consertar este **abre** o caminho.
  **Onde:** `ProductionPage.tsx:424-441` e `:508-541` (o diálogo de confirmação não menciona venda) ·
  `finishedGoods.ts:336-354` e `:507-533`.
  **Saída (decisão do dono):** **(a) barrar** — camada com `qty` menor que a original faz a exclusão
  recusar nomeando o recibo, a disciplina que a exclusão de cor já usa (`filamentReferences`); ou
  **(b) preservar** a camada drenada e remover só o saldo não vendido, o que faz o comentário virar
  verdade. Nos dois casos, o `shiftLayers` precisa CONTAR o move que não achou camada.

#### 🟡 Médio

- ✅ **[UX-48] FEITO (lote B, 2026-08-24).** O `machineNameToId` casa pelo **id exato** antes de
  qualquer palpite — id inteiro é identidade, e devolve sem chamar o `onFuzzy`. A comparação de NOME
  passou a colapsar espaços nos dois lados, então `A1  Combo` também deixa de ser palpite. Medido no
  teste: `a1`, `A1`, `x2d`, `X2D`, ` A1 `, `A1  Combo` e **100 linhas com `Maquina = A1`** → **0**
  em `maquina-por-aproximacao`; o palpite de verdade (`AnyCubic A1 Mini`, id DENTRO de um nome maior)
  continua avisando, como o CSV-24 quis. Descrição original: **O aviso `maquina-por-aproximacao`
  acende em 100% das linhas de uma planilha CERTA.**
  O `machineNameToId` só casa por NOME exato antes de partir para o palpite por substring — e o valor
  mais preciso que a planilha pode trazer é o **id** da máquina.
  **Medido:** `A1`, `a1`, `x2d`, `X2D`, `A1  Combo` (espaço duplo) e `combo a1` **todos avisam**,
  todos resolvendo certo. Em escala: **100 linhas com `Maquina = A1` → `maquina-por-aproximacao =
  100`**. O dono vê que 100% das linhas "foram adivinhadas" e ou desiste da carga ou aprende a
  ignorar o aviso — o defeito que o lote C inteiro existiu para evitar.
  **Onde:** `productCsv.ts:696-703`. **Saída:** tentar `machine.id === normalizado` antes do
  `filter/sort` — id inteiro é identidade, não palpite, e devolve sem chamar o `onFuzzy`. O espaço
  duplo se resolve normalizando espaços nos dois lados da comparação de nome.

- ✅ **[TD-029] FEITO (lote D, 2026-08-24).** Os três ganharam o `guardOnline` **antes do
  `await`**, cada um no molde que o chamador comporta: `saveFixedCostRate` expõe `error` e NÃO lança
  (é a cada tecla — molde do `saveFees`), e o `FixedCostsPanel` recebeu a linha `.form-error`;
  `saveBusiness` DEVOLVE a mensagem (molde do `saveMachines`), e os 4 `onBlur` da `/orcamento`
  pararam de engolir a falha; `addQuote`/`deleteQuote` **lançam**, porque os dois chamadores já
  esperam dentro de um `try` que reporta pelo `FeedbackNote`. O `reserveQuoteNumber` **já estava
  guardado** — por uma 5ª cópia inline do `navigator.onLine`, com frase própria e legítima (lá o
  motivo é o número no servidor). O que virou dedupe: `isOffline()` + `OFFLINE_MESSAGE` no
  `errors.ts`, e as cópias da `QuotePage` e do `SaleModal` passaram a usá-los.
  ⚠ **A repro escrita no item mirava o campo ERRADO** (registrado no `HISTORICO.md`): "Dias de
  impressão/mês" é o `CapacityPanel`, simulação local por desenho (TD-010) — a tela até diz
  *"Simulando — os valores salvos do negócio não mudaram"*. O defeito era real, mas mora nos campos
  do **painel de custos fixos**. **Medido ao vivo** com `navigator.onLine = false`: Aluguel
  1500 → 1501 agora acende a frase do offline no painel (antes: 0 avisos); "Dados do negócio não
  foram salvos: …" ao sair do campo Telefone; e "Excluir orçamento" offline devolve erro nomeando o
  nº **e não exclui** (21 → 21 orçamentos). Online, os três voltam a gravar em silêncio.
  Descrição original: **Três caminhos de escrita ficaram sem `guardOnline`.**
  O `[TD-020]` fechou máquinas e taxas. Restaram: `useBusinessSettings.saveFixedCostRate`
  (`hooks/useBusinessSettings.ts:51-57`, `void persistFixedCostRate`, fire-and-forget — e `:38`, a
  semeadura) · `useQuoteConfig.saveBusiness` (`:28-31`) · `useQuotes.addQuote/deleteQuote` (`:31-37`)
  + `reserveQuoteNumber` (`QuotePage.tsx:261`, que é `runTransaction`: offline a Promise não resolve
  nem rejeita e o botão fica em "gerando" para sempre).
  **Medido ao vivo com `navigator.onLine = false`:** `/producao` **bloqueia** com a frase certa
  (eventos 58→58); mudar "Dias de impressão/mês" 26→27 na calculadora — que é `config/negocio` e
  alimenta o custo fixo por hora do **catálogo inteiro** — muda na tela, **0 avisos**, e o badge segue
  dizendo **"Sincronizado"**. **Saída:** `guardOnline()` ANTES do `await` nos três; em
  `saveFixedCostRate`, que é chamada a cada tecla, o molde é o `saveFees` (expõe `error`, não lança).

- ✅ **[UX-49] FEITO (lote D, 2026-08-24).** No `@media (max-width: 760px)` o `.modal-close` vai a
  **44×44** com `margin: calc(-1 * var(--space-6))` — os 12px de crescimento voltam ao fluxo
  (receita UX-28/UX-37). ⚠ `padding` sozinho não cresceria nada: o `box-sizing` é `border-box` e a
  classe fixa `width`/`height`. **Medido a 375px**, no mesmo diálogo, antes e depois: 32×32 → 44×44,
  cabeçalho **84px nos dois**, título e ✕ **no mesmo lugar** (24px e 40px do topo do
  `.modal-head`, idênticos); o ponto a 3px do canto superior-direito do alvo novo — **fora** dos
  32×32 antigos — dá `elementFromPoint` = `BUTTON.modal-close` e fecha o diálogo. No desktop
  (1280px) segue **32×32, margem 0**. Descrição original: **o ✕ mede 32×32 no celular — e no
  celular não há Escape.**
  `.modal-close` tem largura/altura fixas em `var(--space-32)` e nenhum override em media query. O
  UX-46 levou o `.icon-button` a 44px no celular, mas o fechar do diálogo é classe própria e ficou de
  fora. **Medido** no modal de máquinas a 375px: **32×32**. Vale para os nove (a casca é uma só). As
  alternativas que o `<Modal>` oferece — Escape e clique no overlay — não existem num toque de dedo.
  **Onde:** `modal.css:48-51`. **Saída:** `padding` + margem negativa igual (UX-28/UX-37) dentro do
  `@media (max-width: 760px)`, para o alvo crescer sem empurrar o cabeçalho do diálogo.

#### 🟢 Baixo / informativo — ✅ OS 11 FECHADOS (lote E, 2026-08-24)

> Um deles fechou como **falso positivo declarado** (o `[A11Y-02]`), com o porquê medido. Writeup
> completo dos 11 no [`HISTORICO.md`](HISTORICO.md); aqui fica só o veredito de cada um.

- ✅ **[UX-50] FEITO (lote E).** Todos subiram para 44 no `@media (max-width: 760px)`, pela receita
  UX-28/UX-37, e o custo foi medido rota a rota: `/` **+27px**, `/estoque` +18, `/vendas` +12,
  `/producao` +12, `/orcamento` +10, `/catalogo` +8 e `/maquinas` **0**. **Nada mexeu em
  `font-size`** — o `[micro]` recusou o `.btn` maior pela FONTE em cascata, e altura de alvo é outra
  conta. Entraram também os que a varredura não viu porque mediu outra rota (`.catalog-actions
  select` e `.search-box-input` 36, as 3 abas do `/estoque` 34, o `summary` do payback 36 e a família
  inteira de campos que não é `.field-input`, incluindo as duas fileiras de trilha fixa — a exceção
  delas é de LARGURA, e foi remedida: o excluir da `.accessory-row` continua terminando em 329px
  dentro de uma linha que vai até 329). Desktop remedido a 1280: **inalterado**. Descrição original:
  **Controles 9–12px abaixo da régua no celular, fora da ressalva de "1–4px" da AUD-12:**
  `select` do Arredondamento 178×**32** · `.link-button` ×**32** (3 em `/`, 2 em `/estoque`) · `.btn`
  e `.icon-label-button` ×**34** · inputs do `.ci-item` ×**35** · `summary` ×27 · `.brand-reset` ×20.

- ✅ **[UX-51] FEITO (lote E) — subiu o CAMPO, não a seta.** A justificativa escrita era falsa
  (`.field-input` = 42, `.ci-item` = 35): agora os dois vão a 44 no celular e a frase fica de pé, com
  a seta em 21px de altura como ATALHO de um alvo que existe. O comentário do `forms.css` foi
  reescrito com a medição no lugar. Descrição original: **O stepper cresceu só na horizontal, e a
  justificativa escrita não se sustenta.** Cada seta mede **28×19,5** no celular (o UX-46 mediu a
  largura). ⚠ Subir a altura da seta mexe na altura do campo, que é a trava do `[micro]` de 14px.

- ⚠ **[A11Y-02] FALSO POSITIVO (lote E) — nada a corrigir.** Os botões não têm nome porque o
  `<span class="num-spin">` que os envolve tem `aria-hidden="true"`: pela especificação a subárvore
  inteira sai da árvore de acessibilidade, e a sonda da varredura leu **elemento a elemento**. Dar
  `aria-label` (tirando o `aria-hidden` do pai) poria **40 paradas novas** no leitor de tela, que é o
  que o comentário do `NumberInput` já recusava. A régua A11Y-01 vale para botão que ESTÁ na árvore.
  Descrição original: **Botão só-ícone sem nome acessível**: **20** em `/` e **4** em `/orcamento`.

- ✅ **[TD-030] FEITO (lote E) — saiu o código morto INTEIRO.** `deleteGood`, `saveGood` e os dois do
  repositório (`saveFinishedGood`/`removeFinishedGood`) nunca tiveram chamador; o hook virou leitura
  pura. Quem escreve no acabado é sempre o `writeBatch` de outra coleção — atalho por fora seria a
  porta para o saldo descolar do rastro. ⚠ **Consequência declarada:** doc de acabado com saldo 0
  fica na coleção, invisível (inclusive os 2 das sondas da AUD-13), e **não há caminho de UI para
  apagá-lo** — é o retrato certo do que aconteceu.

- ✅ **[TD-031] FEITO (lote E).** `.sales-table`/`.sales-table-wrap` (~45 linhas) apagadas: eram a
  tabela de antes de o histórico virar lista de recibos, e o `min-width: 760px` delas é o oposto da
  regra de hoje (fileira que não cabe vira CARTÃO).

- ✅ **[CSV-33] FEITO (lote E).** Classe nova `pecas-invalida`: `"0"` e `"-1"` entram como 1 **e
  contam a linha**, citando a célula crua. Ausente/vazia seguem caladas, ilegível continua só com a
  classe do CSV-09 e a fracionária > 1 segue com o dono dela (o `validateProduct`, CSV-31).

- ✅ **[CSV-34] FEITO (lote E).** O rótulo passou a ler uma cópia creditada
  (`reverseFinishedConsumption`, o mesmo estorno da gravação, sem gravar nada) — a mesma prateleira
  que o aviso do UX-42 já usava; o seletor de cor foi junto. ⚠ O `oldRecibo` teve de subir para o
  topo do componente: o `stockItems` o lê durante o render.

- ✅ **[CSV-35] FEITO (lote E).** A sobra vira "coluna repetida" quando é o próprio needle ou uma
  ABREVIAÇÃO do nome canônico (`"peso"` dentro de `"peso (g)"`). ⚠ Reusar o `includes(needle)` da
  passada por pedaço quebrou o teste do AUD-11/D-3 — `"Tempo de cura (h)"` não é repetição, é outra
  coluna, e continua em "nome não reconhecido".

- ✅ **[CSV-36] FEITO (lote E).** As duas frases do portão flexionam. Os outros plurais fixos do app
  foram conferidos e estão certos (só aparecem com contagem > 1).

- ✅ **[TD-032] FEITO (lote E).** `MAX_FEE_PCT = 95` num lugar só, exportado do `paymentFees`, e o
  editor clampa a ENTRADA nele (mais `max` nos 5 campos). O ×20 continua sendo a conta certa de uma
  taxa de 95% — o defeito era chegar nele digitando 100 e a tela guardar um número que a conta não
  usava.

- ✅ **[CSV-37] FEITO (lote E).** A trava é uma linha no `parseDecimalPtBr`: **letra ENTRE dígitos →
  `null`**. A culpa não era do `replace` do markup (ancorado no fim), era da limpeza que apaga e
  COLA. `"5x"`, `"X5"` e `"5 x"` seguem valendo 5; `"2h30"` deixa de virar 230 em qualquer coluna.

#### Ordem dos lotes AUD-13 — ✅ OS CINCO FECHADOS (2026-08-24)

| Lote | Itens | Por que esses | Custo / risco |
|---|---|---|---|
| ~~**A — destravar a produção**~~ ✅ **FEITO (2026-08-24)** | ~~[TD-026]~~ | Era o único que deixava o app **inoperante**. O aviso do custo se confirmou: o conserto foi de 3 linhas, o teste é que exigiu montar o ciclo inteiro | — |
| ~~**B — o que entra calado na carga**~~ ✅ **FEITO (2026-08-24)** | ~~[CSV-32] · [TD-027] · [UX-48]~~ | O diagnóstico se confirmou: consertar só o parser deixaria a bomba armada no `finishedGoods` — os dois foram no mesmo commit, com 20 testes novos (14 falham contra o código velho; os 6 restantes são os contrapontos) | — |
| ~~**C — o estorno que fica mudo**~~ ✅ **FEITO (2026-08-24)** | ~~[TD-028]~~ | O dono martelou **barrar**. O custo bateu com o previsto (baixo): o guarda é uma função pura de 30 linhas + 5 linhas no `remove` — o que cresceu foi o teste, como no lote A | — |
| ~~**D — offline e o dedo no diálogo**~~ ✅ **FEITO (2026-08-24)** | ~~[TD-029] · [UX-49]~~ | Confirmado: nenhum tocou lógica de negócio e os dois se verificaram na mesma sessão. A ressalva da cascata do `@media` se pagou ao contrário — a ordem estava certa (`responsive.css` vem depois), o que enganou foi o CSS **em cache no navegador**: só depois do reload o 44 apareceu | — |
| ~~**E — a poeira**~~ ✅ **FEITO (2026-08-24)** | ~~os 11 🟢~~ | Foi numa sessão só, não duas: o parser e o CSS não se cruzam, então o custo real foi a MEDIÇÃO (7 rotas × 375px, antes e depois) e não o código. Um item fechou como falso positivo declarado (`A11Y-02`) e 5 alvos que a varredura não tinha visto entraram de carona | — |

**O que eu deixaria de FORA de propósito (ressalva registrada, não item):** os alvos a 1–4px da
régua e o `.icon-button.edit` **38,6×44** do `/vendas` (reconfirmados, 23 ocorrências — uma por
recibo) · o **overdraft de −370 g na cor Bege** (remedido idêntico: saldo 243 g com o rolo #5 em
613 g; é furo de contagem física) · o **[UX-47]** (confirmado ao pixel, mas já é item aberto:
`77px 60px 90px 32px` + 3 folgas de 8 = **283px** = exatamente a largura da linha a 375px) · e
**acima de 500 produtos** (o `createProductsBatch` fatia em lotes de 500 e o erro já informa quantos
entraram; li, não medi — provar exigiria criar 500+ documentos).

#### ✅ O que está SÃO — medido, não presumido

A lista longa, com os números, vive no relatório (link no topo desta seção). O resumo:
**matemática refeita à mão num cenário NOVO** (2 etapas em máquinas diferentes, 3 peças, falha 7%,
markup 2,4×, acessório, fixo ligado, arredondamento `0.90`) — os 11 componentes batem com divergência
máxima de **4,9×10⁻¹¹**: material 6,7695 · energia 0,2434166667 · desgaste 3,0941888889 · manut 0,35
· labor 8,1666666667 · reserva 1,4017893070 · fixo 3,0408653846 · total **30,5664269139** · exato
**56,8083062448** · arredondado 56,90. Os 7 modos de arredondamento, FIFO misto (R$ 19,60 = 120×0,090
+ 80×0,110) e overdraft D4 (R$ 85,60, shortfall 380 g) conferidos à mão · **estorno de filamento
exato nas 5 quantidades**, e o rolo não é apagável pela UI, então o caminho do move órfão **não
existe** do lado do filamento (ao contrário do acabado) · gross-up e margem líquida · **rateio de
desconto: 20.000 sorteios, 0 falhas** nas duas invariantes · capacidade pelo gargalo com `floor` por
conjunto (**641** peças/mês) · `marginTier` na régua do número arredondado (49,4 ruim / 49,5 ok /
65,4 ok / 80 bom) · **round-trip documento→formulário→documento** fecha campo a campo (`doc1 ===
doc2`, 24 chaves, 0 `undefined`) e **CSV export→parse→export dá arquivo IDÊNTICO com 0 avisos**,
preservando `filamentId`/`supplyId`/`subitemId` · **600 linhas em 11,3 ms com 600 `createdAt`
distintos** (o CSV-15 segura em escala) · **contraste WCAG AA: 0 falhas** em 7 rotas × 2 temas ·
rolagem lateral 0 a 375/430/700px · o catálogo no celular entrega os **5 botões a 44×44** com
`aria-label` na linha aberta · **venda ao vivo exata** (+18,41 receita, +11,69 custo, +6,72 lucro) e
os **KPIs do `/vendas` atualizaram sem recarregar** (o `[TD-019]` verificado ao vivo pela 1ª vez) ·
**UX-42 ao vivo**: qtd 1 não avisa, 2 avisa "1 além", 3 avisa "2 além" · **estorno de recibo ida e
volta ao centavo** (acabado −1 e de volta a 0, contador de saldo negativo 1→2→1) · **PDF do
`/orcamento` com dado real** (o buraco da AUD-12): 8.157 bytes, `/Encoding /WinAnsiEncoding`, **19
strings e nenhuma em UTF-16**, travessão/aspas curvas/`·`/`½`/`‰` intactos, `‐` (U+2010) rebaixado
sozinho sem arrastar a linha, total R$ 18,41 = a tela.

#### O que a AUD-13 NÃO cobriu

- **Dump documento a documento do Firestore.** Eu ia ler o token de sessão para consultar a REST API
  e o **classificador de segurança bloqueou a chamada** — corretamente, porque ler token de
  autenticação do IndexedDB é indistinguível de exfiltração. Não retentei por outro caminho: o
  retrato do banco saiu **pela própria UI** (contadores, saldos, extratos, rolos e lotes abertos um a
  um). Isso prova os NÚMEROS, não a forma dos documentos — um campo que mudasse sem mover saldo
  passaria batido.
- **Offline com a rede realmente caída** (fila do Firestore, Promise pendente, reconexão). Forcei
  `navigator.onLine`, que é o que o `guardOnline` lê — e é por isso que o contraste guardado × não
  guardado ficou nítido. Resíduo do antigo `[AUD-04]`, agora pela **quarta** varredura.
- ~~**O caminho da camada órfã na UI**~~ ✅ **RODADO ao vivo no lote C (2026-08-24)**, no banco real
  e no cenário que já estava armado (a venda de R$ 18,41 drenava a camada da produção
  `ZZ AUDIT sonda D1`). Ida e volta inteira: excluir a produção **recusou** nomeando o recibo →
  a produção NÃO vendida (`sonda REV`) abriu o diálogo normal e excluiu, devolvendo os 10 g
  (Laranja 1353 → 1363) → apagar a venda estornou ao centavo (48→47 itens, −18,41 receita,
  −11,69 custo, −6,72 lucro) e o `shiftLayers` **achou** a camada, porque o guarda impediu que ela
  fosse apagada → aí a `sonda D1` LIBEROU e excluiu (Laranja 1363 → **1403 g**). Não sobrou item da
  AUD-13 sem prova ao vivo.
- **Regras de segurança do Firestore** (exige 2ª conta Google) · **acima de 500 produtos** contra o
  banco · **duas abas gravando ao mesmo tempo** (a AUD-12 já fez; aqui o guarda `rev` foi exercitado
  e foi ele que denunciou o TD-026) · **Excel/Google Sheets de verdade** e o diálogo de arquivo do SO
  · **navegadores fora do Chromium embutido** e iOS Safari real · **importação/exportação de vendas,
  filtros e paginação do histórico**, e o `/maquinas` além da leitura.

#### Balanço do banco — 7 documentos criados, ✅ LIMPEZA FEITA no lote C (2026-08-24)

> A limpeza rodou pela UI durante a prova ao vivo do `[TD-028]` e serviu de conferência: `products`
> **99 → 97** · `producao` **59 → 57** · `vendas` **48 → 47** · `estoque` Laranja **1353 → 1403 g**,
> exatamente os 50 g previstos. Sobraram só os **2 docs de `acabados`** (saldo 0, invisíveis na
> tela): é o `[TD-030]` — não existe caminho de UI para apagá-los, e o `deleteGood` é código morto.
> A tabela abaixo é o retrato de quando as sondas foram criadas.

| Coleção | Antes | Depois | O quê | Sai pela UI? |
|---|---|---|---|---|
| `products` | 97 | **99** | `ZZ AUDIT sonda D1` = `4I1pyH6F9fcWV2OpJpq9` · `ZZ AUDIT sonda REV` = `KGFRWOheghVBdEUzVVEV` | sim |
| `producao` | 56 | **58** | 2 eventos "ZZ AUDIT", 24/08/2026 | ✅ **sim, desde o lote A** |
| `acabados` | — | **+2** | id = o id do produto (os dois acima) | não existe caminho (TD-030) |
| `vendas` | 47 · R$ 2.620,70 | **48** · R$ 2.639,11 | 1 recibo de R$ 18,41 | sim |
| `orcamentos` | — | **+1** | Nº 0021 (contador 21 → 22, liberado pelo dono) | sim |
| `estoque` Laranja | 1403 g | **1353 g** | −40 g e −10 g das 2 produções | ✅ volta ao excluir as 2 produções |

Tudo o mais bate com o retrato inicial: **Bege 243 g / 5 rolos · Argola 198 un · Clicker Azul 108 un
· `config/machines` intacto**. A alteração offline em `config/negocio` foi desfeita ainda offline e o
doc terminou com o valor original (26 dias). **Nenhum lançamento novo no rastro D6.**


---

### O cabeçalho de "⚠ LEIA PRIMEIRO" que o `BACKLOG.md` tinha até 2026-08-31

> Eram **91 linhas**: um aviso por varredura, empilhados por data, cada um anulando parcialmente
> o anterior — a razão principal do inchaço. Guardado aqui na íntegra porque contém correções de
> contagem e decisões (a planilha gerada por sistema externo, o recount da AUD-12) que não estão
> em outro lugar.

# LopoLabCalc — Backlog (a fazer)

> **Roadmap dos itens ABERTOS + ordem de prioridade.** Curto de propósito — é o que se lê pra
> escolher/rever a próxima tarefa (não precisa do histórico pesado pra isso).
> O *porquê* / detalhe de design (D1–D8, auditoria, writeups do que já foi feito) vive em
> [`.claude/HISTORICO.md`](HISTORICO.md) — abra sob demanda ao pegar o item.
> A foto do AGORA + a próxima tarefa sugerida vivem no `CLAUDE.md`.
>
> ⚠ **LEIA PRIMEIRO — a varredura AUD-16 (2026-08-28, a 9ª) é a varredura TOTAL do sistema, feita
> por outra IA sobre uma cópia ZIP.** Ela abriu **7 defeitos** (`[E1]`…`[E7]`) — **os 7 FECHARAM em 2026-08-29**, em
> três lotes: **1** (`[E1]`…`[E4]`, a fronteira de ingestão), **2** (`[E5]` `[E6]`, a perda
> calada) e **3** (`[E7]`, a dívida sem lote). O cluster está **ZERADO**; sobram as ressalvas. A seção dela é a **primeira** deste arquivo. ⚠ Os 7 foram
> **reconferidos aqui com sonda rodando o parser real** — e a reconferência **corrigiu o
> relatório em 3 pontos** (ver a seção). O lote 3 dele (import >500 / timeout) **não é defeito**:
> é tradeoff já escrito e tratado no código.
>
> ⚠ **LEIA — a varredura AUD-15 (2026-08-26, a 8ª) é de REGRESSÃO: o alvo foi o código
> dos 4 lotes da AUD-14, não o sistema.** Ela **reabriu o backlog de código**: **6 defeitos**
> (`[E1]`…`[E6]`) + **2 ressalvas** — os lotes **1** (`[E6]`), **2** (`[E1]` `[E2]` `[E3]`) e
> **3** (`[E5]`) FECHARAM em 2026-08-26 e o **4** (`[E4]`) em **2026-08-28**: o cluster está
> **ZERADO**, sobram as 2 ressalvas.
> A seção deles está **logo abaixo deste
> cabeçalho**, ACIMA da AUD-14. Placar: **47 afirmações de ontem refeitas — 38 bateram, 8 não,
> 1 parcial** (a AUD-14 tinha derrubado 7 de 32; o padrão do repositório se repetiu). **Os 9 itens
> da AUD-14 continuam fazendo o que esta seção diz que fazem** — o que caiu foram *afirmações
> sobre* eles. **A pergunta "pode recadastrar?" já era SIM com uma trava, o `[E6]` — e a trava
> caiu:** ele era o único que mordia dado que o dono **não digita** (a planilha vem do sistema
> externo), e fechou. O de tela (`[E4]`) fechou depois, e nunca mordeu o dado da carga.
>
> ⚠ **LEIA ISTO ANTES DO RESTO — a varredura AUD-14 (2026-08-25, a 7ª e v4 da geral) abriu 9
> defeitos e os 4 lotes FECHARAM no mesmo dia.** A seção deles está **logo abaixo da seção da
> AUD-15**: lote 1 (`[D1]` `[D8]`), 2 (`[D2]` `[D3]`), 3 (`[D4]` `[D5]` `[D6]`) e 4 (`[D7]` `[D9]`
> + alvos de toque + as afirmações falsas, este com a prova ao vivo do lote 3 junto). **O backlog
> de código voltou a ZERO** — ⚠ isso valeu **só até 2026-08-25**: a AUD-15 o reabriu (ver a nota
> acima). O que sobra na seção da AUD-14 são as ressalvas dela e a lista do que ela não cobriu. Tudo que os parágrafos seguintes chamam de "ZERADO"
> descreve o estado **até 2026-08-24** e continua valendo como registro do que fechou. Vários
> parágrafos abaixo dizem "está ZERADO" descrevendo o estado **antes** da varredura **AUD-12** (a v2
> da geral); a **AUD-13** (a v3) abriu 18 itens depois deles e **fechou os cinco lotes no mesmo
> dia** — A, B, C, D e E (os 11 🟢). A seção dela é a **última** deste arquivo, logo acima de
> "## Fechado", e vale reler por dois motivos: ela **refuta parte da AUD-12** (o lote D daquela
> quebrou o `/producao`, `[TD-026]` 🔴) e ela deixa **ressalvas registradas** — os alvos a 1–4px da
> régua, o overdraft de −370 g na cor Bege, o `[CSV-30]`/`[TD-021]` e o `[A11Y-02]`, que fechou como
> **falso positivo declarado**. Os dois últimos abertos — o `[UX-47]` (a fileira de acessórios) e o
> `[UX-52]` (o "N disp." somando as cores contra um aviso de UMA cor) — **fecharam em 2026-08-24**,
> medidos no DOM e ao vivo; a seção deles agora é a de fechados, logo antes de "## Fechado".
> **Não sobrou item de código.** O que resta é a frente do DONO (cadastro de cores/insumos, religar
> os acessórios) e o branding do `[FEAT-03]`, adiado por ele.
>
> **Da AUD-12 (a v2), para o registro:** ela abriu **17 itens** — o cabeçalho dizia 15, e a conta
> estava errada: o rótulo "4 🟡" vinha
> seguido de **cinco** nomes. São 5 🔴 (`[CSV-23]` `[CSV-24]` `[UX-44]` `[CSV-25]` `[CSV-26]`),
> 2 🟠 (`[TD-022]` `[UX-46]`), **5** 🟡 (`[UX-45]` `[TD-023]` `[CSV-27]` `[CSV-28]` `[CSV-29]`) e
> 5 🟢 (`[CSV-31]` `[TD-021]` `[TD-024]` `[TD-025]` `[CSV-30]`).
>
> ✅ **Fecharam em 2026-08-23:** os 5 🔴 (lotes A e B, com os três que entravam calados na carga), o
> `[TD-022]` inteiro (reproduzido com escrita real), as duas guardas baratas `[TD-024]`/`[TD-025]`
> e os lotes **C** (`[CSV-27]` `[CSV-28]` `[CSV-29]` `[CSV-31]`), **D** (`[TD-023]`) e **E**
> (`[UX-45]` `[UX-46]`). `[CSV-30]` e `[TD-021]` viraram **ressalva** por decisão do dono.
> **O cluster AUD-12 está ZERADO** — e com ele o backlog de código, de novo. O que sobrou virou o
> `[UX-47]`, fechado em 2026-08-24, e as ressalvas medidas dentro do UX-45/UX-46.
>
> **Tier 0, Tier 1, Tier 4, o 7e, o cluster UI/UX de 2026-08-15, as ondas 0–5 e o `[micro]` do
> botão de 14px (2026-08-17) ✅ FECHADOS.** O
> registro deles (com as medições) vive no `HISTORICO.md` — seção "📒 Arquivo do BACKLOG" e os
> writeups das ondas 1 a 5. **Este arquivo só tem o que está ABERTO.**
>
> ⚠ **Estado em 2026-08-23, DEPOIS dos lotes A, B e D: o código da importação está ZERADO.** A
> varredura **AUD-09** abriu 12 itens (`CSV-09`…`CSV-20`), mais o [CSV-21] achado no lote A e o
> [CSV-22] aberto e fechado no lote D. **Tudo que era código da AUD-09 está fechado** — mas a
> **AUD-12** abriu `CSV-23`…`CSV-31` depois (ver o aviso do topo). Sobra: o [CSV-17]
> (token do arredondamento, item de **doc** — e ele avisa), que entra na spec da planilha; e
> [CSV-18]/[CSV-19]/[CSV-20], resíduo legado que o round-trip limpa sozinho.
>
> **A planilha-modelo mudou de forma (dono, 2026-08-23): NÃO vira botão no app.** Quem gera a
> planilha de importação é um **sistema externo do dono**, que lê os dados das impressões. O que
> falta é a **spec/planilha-modelo escrita no chat** com ele, *depois* que ele cadastrar as cores e
> os insumos definitivos e tiver os ids em mãos. O que era o "lote C" virou isso.
> O parágrafo abaixo descreve o estado de 2026-08-22.
>
> ⚠ **Estado em 2026-08-22: o backlog de código está ZERADO de novo.** A fila de ondas acabou em
> 2026-08-17; a auditoria de layout responsivo fechou em 2026-08-18; e o cluster da varredura
> **AUD-07** (10 defeitos) fechou nos **4 lotes** de 2026-08-22 — tabela logo abaixo.
> **O que sobra não é tarefa a pegar:** está acoplado ao rebrand (**DEC-05** + **G2**) ou bloqueado
> por algo de fora (**FEAT-03**, **branding/logo**, **Dashboard**, **AUD-08**).
> → **A próxima coisa é a CARGA EM MASSA**, que é trabalho e decisão do dono (planilha gerada por
> ele; as cores definitivas precisam estar cadastradas ANTES). Depois dela, a decisão é destravar o
> rebrand (a logo) ou abrir frente nova.
> **Atualização 2026-08-23:** os 3 bloqueantes da AUD-09 ([CSV-09], [CSV-10], [CSV-11]) e os 4 do
> lote B foram fechados no mesmo dia. **O que falta antes da carga é do dono:** cadastrar as cores
> e os insumos definitivos — só então eu gero a de-para e a planilha-modelo (lote C).

