# AUD-15 — varredura de REGRESSÃO dos 4 lotes do mesmo dia

> **Como usar:** abra um chat NOVO no Claude Code, na raiz do projeto, e cole tudo daqui pra baixo.
> Não é uma varredura geral — é dirigida, e deve caber com folga num chat.
> Ela **não substitui** o `PROMPT-AUD-14.md`: aquele é a varredura geral (v4), rodada em
> 2026-08-25 e já fechada. Este mira só o que **aquela varredura fez nascer**.

> ⚠ **Conflito de interesse declarado, leia antes:** este prompt foi escrito pelo **mesmo agente que
> escreveu o código que ele manda auditar**. Ou seja, a lista de suspeitas abaixo tem exatamente o
> ponto cego que se quer cobrir. **Trate-a como o piso, nunca como o teto** — e se você achar defeito
> em lugar que este prompt não cita, isso é o resultado mais valioso que a varredura pode dar.

---

Faça uma **varredura de regressão** do código escrito em **2026-08-25**. É a **8ª varredura**, mas a
primeira que **não** é geral: as sete anteriores (AUD-07 → AUD-09 → AUD-10 → AUD-12 → AUD-13 →
AUD-14) já passaram pela superfície inteira, e a última fechou **horas antes** desta.

A pergunta desta varredura, portanto, não é mais "a ferramenta está madura?" — a AUD-14 respondeu
isso. É:

> **O que os 4 lotes de hoje quebraram sem que o autor deles visse?**

## Por que AGORA, e não depois do recadastro

Porque a janela em que o conserto é **de graça** fecha no recadastro. Enquanto a **Diretriz 7**
(dados descartáveis) vale, um defeito nestes caminhos custa um commit. Quando o dono recadastrar,
ela **expira** — e aí o mesmo defeito custa migração, em cima de dado real que ele digitou à mão.

E o alvo é grande. Em um único dia, os 4 lotes mexeram em:

| | |
|---|---|
| Arquivos de código | **46** |
| Linhas | **+1.609 / −187** |
| Dessas, em teste | **+528** (35 testes novos: 729 → **764**) |
| Repositórios do Firestore tocados | **11 de 11** — a camada de escrita INTEIRA |
| CSS | **9 arquivos**, incluindo `base.css` e `responsive.css` |

**Nada disso foi exercitado por ninguém além de quem escreveu.** E os 35 testes novos foram escritos
pelo mesmo agente, no mesmo dia, para cobrir os próprios consertos dele.

## O padrão que já mordeu duas vezes neste repositório

Não é hipótese, é histórico:

- A **AUD-12** fechou 15 itens num dia. A **AUD-13** descobriu que o lote D dela tinha **quebrado o
  `/producao`**: o `[TD-026]` deixava cada produto produzível **uma única vez**, e ninguém pegou
  porque o defeito só aparece na **SEGUNDA** produção do mesmo produto.
- A **AUD-13** fechou 18 itens em 5 lotes num dia. A **AUD-14** refez 32 afirmações daquele período:
  **25 bateram, 7 não** — e 4 das 7 eram comentários no código descrevendo comportamento que já
  tinha mudado.

Hoje foram 4 lotes num dia. **Assuma que a taxa se repete** e vá procurar as 7.

⚠ **Regra prática que sai desse histórico:** todo caminho que você testar, **teste duas vezes
seguidas no mesmo dado**. Metade dos defeitos daqui só aparece na segunda passada.

## A regra que manda em todas as outras: NADA é verdade até você reproduzir

Vale igual à da AUD-14, e com um alvo a mais:

- O `CLAUDE.md`, o `BACKLOG.md` e o `HISTORICO.md` dizem **onde as coisas moram**, não que
  funcionem. Todo `✅ FEITO` e todo "medido: X" de hoje precisa ser **remedido por você**.
- **Os 4 blocos "✅ FECHADOS no lote N" da seção AUD-14 do `BACKLOG.md`** são a lista de afirmações
  a derrubar. Eles estão cheios de números ("22px → 259px", "R$ 1,00 de divergência", "0 alvos
  abaixo de 44"). **Refaça cada medição.**
- **Os 35 testes novos.** Teste verde não é prova — já houve aqui um teste que afirmava `linhas: 2`
  numa linha só, consagrando o defeito. Leia o que cada teste novo **realmente** assere, e pergunte
  o que ele deixaria passar.
- Os comentários que eu **reescrevi hoje** dizendo que os antigos mentiam. Confira se os novos não
  mentem também.
- As mensagens de commit de hoje, inclusive as minhas.
- Este prompt.

Achado só é achado **depois de reproduzido**. Se não reproduziu, diga e classifique como **não
confirmado**. Falso positivo seu, declare — vale, e a AUD-13 declarou três dos dela.

## Alvo 1 — os 4 lotes, e o que temer em cada

### Lote 1 (`1b1e023`) — a planilha da carga: `[D1]` `[D8]`

O que mudou: **9 colunas escalares** do export passaram de `String(number)` (ponto decimal) para
vírgula pt-BR · classe de aviso nova **`milhar-multiplo`** (2+ grupos de milhar = número corrompido,
não ambiguidade) · `Acessorios JSON` / `Subitens JSON` deixaram de ser dumpadas cruas e passaram a
ser **remontadas campo a campo**.

O que temer:
- **Falso positivo do `milhar-multiplo`.** Ele recusa valor com 2+ grupos de milhar em TODA coluna
  que entra no documento. Existe algum valor **legítimo** que ele passe a barrar? A premissa escrita
  é "nenhuma coluna deste app tem valor plausível acima de 999.999" — **essa premissa é verificável,
  verifique**. Preço de máquina? Total acumulado? Campo que o dono digite em centavos?
- **O aviso que não acende.** O inverso: número corrompido que ainda atravessa. Teste `Tempo (h)` e
  `Taxa Falha (%)`, que são as duas onde o clamp **esconde** o estrago.
- **A remontagem campo a campo do `[D8]` é o padrão nº 1 da casa** (função que remonta objeto e
  esquece um campo). O `id` do acessório foi deixado de fora **de propósito** — confirme que nada
  mais foi junto sem querer. Diff campo a campo do documento, com *stringify canônico*.
- **Round-trip completo**: exporta → abre no Excel pt-BR → salva → reimporta → diff contra o
  documento original. A AUD-14 fez isso com 6 valores; faça com um produto que tenha **acessório com
  `supplyId`, subitem, etapa extra e multicolor** ao mesmo tempo.

### Lote 2 (`5a2877c`) — a escrita que evaporava: `[D2]` `[D3]`

O que mudou: **`withWriteTimeout` (12s; 45s na importação em lote) na BORDA de todos os 11
repositórios** — 21 escritas exportadas passam por ele · estado `saving` em 4 ações da calculadora ·
`guardOnline` no `useProducts.deleteProduct`.

Este é o lote de **maior superfície de risco do dia**: ele toca **toda escrita do aplicativo**.

O que temer:
- **O timeout que dispara numa escrita legítima e lenta.** 12s é chute. Uma escrita grande (produto
  com muitos subitens, recibo com muitos itens, transação das 4 coleções) em rede ruim de quiosque
  passa disso? Meça o tempo REAL das escritas mais pesadas e diga a margem.
- **A frase do timeout promete "confira" e não "repita"** — porque a escrita continua enfileirada no
  SDK e pode entrar sozinha depois. **Reproduza esse caso**: dispare o timeout e veja se o documento
  entra atrasado. Se entrar, a tela mente em algum ponto?
- **O `saving` travando o formulário.** Se a escrita falha, o botão volta? Se o componente
  desmontar no meio (o dono navega), sobra estado preso? E o `saveAsNewProduct`, que era a única
  gravação da tela **sem `try/catch`**?
- **`guardOnline` no hook e não no componente**: algum outro chamador de `deleteProduct` passou a
  ser barrado sem mostrar erro?
- **Duas abas.** Com timeout no meio: aba A grava, estoura o prazo, aba B grava o mesmo doc. O
  guarda `rev` ainda protege?

### Lote 3 (`24d86f4`) — a tela que informa errado: `[D4]` `[D5]` `[D6]`

O que mudou: `.cesta-origem` virou cartão sem media query · `partialRanking` + `loadAll()` no
`useSalesPage` · `readFinishedColors` passou a separar "não tem" de "tem e não dá pra ler".

O que temer:
- **`loadAll()` mira o `totals.count`** — uma *aggregation query* que conta DOCUMENTOS, enquanto a
  tela agrupa por RECIBO. A conta bate quando o count vem atrasado? Quando alguém grava durante o
  carregamento? Quando há filtro de data? **Meça com o histórico real** (41 recibos hoje).
- **O aviso de ranking parcial acende quando não devia?** Ele é `hasMore && sortMode !== "recent"`.
  Com filtro de produto o `hasMore` é sempre `false` — confirme, porque aviso falso ensina a
  ignorar aviso (padrão nº 7).
- **`readFinishedColors` recusando lista VÁLIDA.** É o risco simétrico do que ele conserta: ele
  derruba junto o `finishedColorLabel`. Um falso positivo aqui **esconde informação verdadeira** do
  dono. Que formas de lista ele aceita, exatamente? Cor com nome vazio? Lista com 1 item torto e 3
  bons?

### Lote 4 (`c990679`) — poeira e verdade escrita: `[D7]` `[D9]` + alvos de toque

O que mudou: `saveRecibo` + `removeSale` + `useSales.deleteSale` **apagados** · `serializeSkus`
deixou de ser exportada · **renome de campo gravado**: `pricePerKg` → `catalogPricePerKg` no evento
de produção (tipo novo `ProductionFilament`) e `unitPrice` → `catalogUnitPrice` no insumo · CSS em
8 arquivos · 15 comentários trocando "writeBatch" por "transação".

O que temer — **este é o mais perigoso do dia, porque muda o que é GRAVADO**:
- **O renome do `[D9]` atravessa 3 caminhos**: o que escreve (`buildProductionPayloads` →
  `productionToDocument`), o que lê (`toProduction`, tolerante ao campo antigo) e o que exibe
  (`/producao`, `/vendas`). **Grave um evento de verdade** (com autorização, ver Método) e leia o
  documento cru no Firestore: o campo novo está lá? o antigo sumiu mesmo? o valor é o de catálogo?
- **A leitura tolerante é um default silencioso** (padrão nº 2): `num(data.catalogPricePerKg ??
  data.pricePerKg)`. Se os dois faltarem, entra **0** calado. Isso aparece na tela como "R$ 0,00/kg
  no cadastro"? É aceitável?
- **O `SupplyUsage.catalogUnitPrice` mudou a conta em `planSupplies`.** No modo `historico` o custo
  sai DAQUI. Refaça a conta à mão e compare dígito a dígito.
- **Código apagado que ainda tem quem aponte** (padrão nº 10): confirme que nada — nem componente,
  nem teste, nem tipo exportado — ficou órfão ou apontando para o que saiu. E o inverso: alguma
  função ficou sem chamador **por causa** das remoções?
- **O CSS.** Ver o alvo 2, que é onde eu sei que deixei buraco.

## Alvo 2 — o buraco que eu SEI que deixei, e por isso vale mais

**Medi as larguras 375 e 1280. Não medi 641 nem 760** — que são as duas outras fronteiras declaradas
do projeto, e justamente as que o `[UX-47]` mexeu por último. O CSS de hoje encostou em **9
arquivos**, entre eles `base.css`, `header.css` e `responsive.css`, que valem para o app inteiro.

Meça nas 4 fronteiras (**375 / 641 / 760 / 1280**), nos **dois temas**, com **reload antes de cada
leitura de CSS** (a armadilha do cache já fez medição mentir aqui), e nas 7 rotas com os acordeões
abertos e os 9 diálogos abertos. Especificamente:

- **`.header { padding-right: 156px }`** (era 144). Vale até 760px. Em 641 e 760 o `<h1>` e o status
  de nuvem ainda cabem, ou o título passou a quebrar linha onde não quebrava?
- **`.navbar-toggle` / `.navbar-close` / `.header-utils` a 44px**, e o `.header-utils { right:
  calc(var(--wrap-pad-x) + 52px) }`. Os três controles do canto se sobrepõem em alguma largura?
- **`.details-links a { min-height: 32px }`** (44 no celular) — cresce **sem devolução**, de
  propósito. Quanto o painel de detalhes do catálogo cresceu de fato? Com 3+ links?
- **`.roi-warn` com `display: flow-root`** — mudou o contexto de formatação do bloco. Com o
  `<details>` **aberto**, o parágrafo dentro ainda se comporta?
- **`.cost-detail-trigger` e `.icon-button` do recibo** ganharam regra no `cesta-recibo.css` porque
  o `responsive.css` não os alcançava. Confirme que a regra nova não vazou para outro consumidor das
  mesmas classes.
- **`.result-advanced > summary { margin-block: -2.5px }`** — meio pixel. Some em algum zoom ou
  densidade de tela?
- E o de sempre: **nenhuma rota pode ganhar rolagem lateral** em nenhuma das 4 larguras.

⚠ Duas armadilhas que eu medi hoje e que valem para qualquer conserto de CSS aqui — **use-as, e
confirme que continuam verdadeiras**: (a) **ORDEM de `@import` vence media query**, porque media
query não soma especificidade — foi por isso que o override do `responsive.css` (8º) não alcançava
`stock.css` (15º) nem `cesta-recibo.css` (12º); (b) **margem negativa COLAPSA através do pai** quando
o pai não tem borda nem recuo vertical — a devolução não devolve nada, e só `display: flow-root`
conserta.

## Alvo 3 — os buracos herdados que NÃO dependem do dono

A AUD-14 deixou 7 declarados. Três exigem coisa que só o dono resolve (2ª conta Google para as
regras do Firestore, autorização das 1.040 escritas da escala, login do Google Sheets) — **pule
esses e diga que pulou**. Os outros ficaram por falta de tempo, não de permissão:

1. **O "Exportar CSV" do `/vendas`** — o botão existe e **nunca foi exercitado** por varredura
   nenhuma. Exporte, abra em Excel pt-BR, confira. O `[D1]` conferiu que este CSV escreve tudo por
   `formatDecimal` e não tem o defeito do outro — **reconfira, é afirmação minha de hoje**.
2. **O modal de máquinas nas larguras de celular.** As máquinas moram no doc compartilhado
   `config/machines`: editar watts/`lifeHours` recalcula energia e desgaste do **catálogo inteiro**.
3. **A exclusão de produto offline, ao vivo.** O `[D3]` mediu a guarda **funcionando**; o
   comportamento do `deleteDoc` no código velho continua sem reprodução — e isso é ressalva escrita
   no `BACKLOG.md`.
4. **Offline de verdade** (rede caída pelo CDP, não `navigator.onLine` forçado) — é a **sexta**
   varredura em que isso aparece. Com o `withWriteTimeout` novo no meio, mudou de figura: agora há
   um prazo competindo com a fila do SDK. Se conseguir, é o achado mais valioso possível aqui.

## O que precisa sair no relatório — inclusive o que estiver SÃO

Mesma regra da AUD-14, e ela é o ponto mais importante: **quero ver o resultado de tudo que você
testou, mesmo quando não achou nada.** Para cada item verificado:

| campo | o que é |
|---|---|
| **O quê** | o comportamento testado, em uma frase |
| **Como** | o método concreto (harness em vitest / medição no DOM / escrita real / leitura de código) |
| **Medido** | o número, o texto, o diff — o dado cru, não a conclusão |
| **Veredito** | ✅ são · 🔴 defeito · ⚠️ ressalva · ❓ não consegui verificar (e por quê) |

Quatro seções obrigatórias no fim:

1. **Defeitos**, ordenados por *o que custa mais caro depois que a Diretriz 7 cair*, com mecanismo +
   reprodução + impacto. **Não corrija nada** — o dono decide os lotes.
2. **✅ O que está são — medido, não presumido.** Lista longa, com os números.
3. **O que esta varredura NÃO cobriu**, e por quê. Buraco declarado vale mais que cobertura fingida.
4. **O placar das afirmações de hoje** (ver o fim deste prompt).

## Método

- **Funções puras:** harness em vitest, com limítrofes e absurdos (zero, negativo, vazio, gigante,
  texto onde se espera número, pt-BR vs ponto). **Escreva a previsão ANTES** de rodar. Apague os
  harness no fim e deixe o `git status` limpo.
- **Suíte:** `pnpm lint`, `pnpm build`, `pnpm test` — hoje são **764 testes**. Rode **3 a 4 vezes** e
  diga se houve flake.
  ⚠ **`npx tsc --noEmit` acusa 1 erro pré-existente** em `calculatePricing.test.ts:205` (um cast de
  `stages`). Ele é anterior a hoje e o `pnpm build` não o vê porque não typa os testes. Não é achado
  novo — mas se quiser tratá-lo como item, diga.
- **UI:** navegador embutido (`preview_start` + `read_page` / `computer` / `javascript_tool`), com o
  `.claude/launch.json` — **nunca `pnpm dev` no Bash**. Meça no DOM, com reload antes de medir CSS.
  Se cair na tela de login do Google, **pare e peça ao dono** — ele loga e devolve a aba. Você nunca
  digita credencial.
  ⚠ Pode haver um `pnpm dev` já rodando na porta 3000 de sessão anterior; `preview_start` cai em
  outra porta e você acaba medindo o servidor errado. Confirme em qual porta está o que você mediu.
- **Escrita real no Firestore:** **peça autorização explícita antes**, com o plano na mão — o que vai
  criar, quantos documentos, como vai limpar e como vai **provar** que limpou. Backup em disco
  antes; no fim, balanço antes → depois, coleção a coleção.
  ⚠ Para o `[D9]` isso é praticamente obrigatório: o renome só se prova lendo o **documento cru**
  depois de uma gravação de verdade. Peça.
- **Ler os documentos do Firestore:** use o **SDK já autenticado na própria página**
  (`javascript_tool` na aba logada). Não leia token de autenticação de lugar nenhum.
  ⚠ Dump que faz `{ id: doc.id, ...doc.data() }` tem o id do caminho **sobrescrito** quando o
  documento carrega um campo `id` — 18 dos 97 produtos carregam. Ponha o id do caminho **por último**
  e com nome que não colide (`__id`).
- **Nunca apague nada do dono** sem perguntar.

## Terreno de caça (padrões que já apareceram aqui, não verdades)

1. Função que remonta objeto campo a campo e **esquece um** — vira `null` no save seguinte, sem
   mover o preço.
2. **Default silencioso** — célula vazia, coluna ausente, campo opcional, `?? 0`.
3. **Casamento por substring** — o nome mais curto rouba o do mais longo.
4. **Número em pt-BR lido por parser que não fala pt-BR**, e o inverso.
5. **Escrita não atômica**, ou lote que entra pela metade.
6. **Snapshot congelado que congelou o campo errado** (ou não congelou).
7. **Aviso que não acende** — ou que acende quando não devia.
8. **`1fr` puro** em vez de `minmax(0, 1fr)`; fileira que rola de lado em vez de virar cartão.
9. **Conserto que só falha na SEGUNDA vez.**
10. **Código morto que volta a ser chamado** — ou que deixou órfão ao sair.
11. **(novo, do lote 4) Comentário que descreve a API antiga.** Hoje 15 diziam "writeBatch" para
    escritas que são `runTransaction` desde o TD-022. Procure os que sobraram, e os que eu criei.

## O que quero respondido em números, no fim

1. **Dos 4 lotes de hoje, quantos sobreviveram intactos?** Item a item — `[D1]` `[D8]` `[D2]` `[D3]`
   `[D4]` `[D5]` `[D6]` `[D7]` `[D9]` + alvos de toque: cada um continua fazendo o que o
   `BACKLOG.md` diz que faz?
2. **O placar das afirmações:** quantas afirmações de hoje você refez, quantas bateram, quantas não.
   (A AUD-14 refez 32 e derrubou 7. Este é o mesmo teste, aplicado ao dia seguinte do conserto.)
3. **Se um erro entrar por um desses caminhos novos, o dono descobre?** Quais entrariam em
   **silêncio** — sem aviso na tela nem divergência visível depois.
4. **Pode recadastrar?** Com o que você mediu: os caminhos que o recadastro vai usar (importação de
   CSV, gravação de produto, evento de produção, venda) estão prontos para receber dado que **não é
   mais descartável**?

Comece dizendo o plano e o que vai precisar do dono (login, autorização de escrita). Depois toque a
varredura e traga o relatório **em artifact**, com as medições cruas dentro.
