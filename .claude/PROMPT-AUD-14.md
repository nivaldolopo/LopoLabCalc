# AUD-14 — varredura FINAL do site, com o backlog de código zerado

> **Como usar:** abra um chat NOVO no Claude Code, na raiz do projeto, e cole tudo daqui pra baixo.
> A varredura é longa — conte com um chat inteiro só pra ela.
> Ela substitui o `PROMPT-AUD-10.md` (aquele mirava a carga em massa; este mira o **marco de
> maturidade**). O de lá continua no repositório só como registro.

---

Faça uma **varredura final do sistema inteiro**, do zero. É a **7ª varredura** e a **v4 da geral**
(AUD-07 → AUD-09 → AUD-10 → AUD-12 → AUD-13 → esta). O contexto mudou: **o backlog de código está
ZERADO desde 2026-08-24** — nenhum item aberto, de UI ou de cálculo. Então a pergunta desta
varredura **não é mais "a carga vai dar certo?"**. É:

> **A ferramenta está madura o bastante pra eu recadastrar TUDO em cima dela e a Diretriz 7
> (dados descartáveis) expirar?**

Isso muda o que conta como achado. A partir do momento em que a Diretriz 7 cai, **migração volta a
ser obrigatória** e dado errado deixa de ser descartável: um campo que entra torto hoje eu carrego
pra sempre. Calibre a severidade por aí.

## A regra que manda em todas as outras: NADA é verdade até você reproduzir

Você vai encontrar muita afirmação neste repositório. **Trate todas como hipótese não verificada**,
inclusive:

- O `CLAUDE.md`, o `BACKLOG.md` e o `HISTORICO.md` — leia pra saber **onde as coisas moram**, nunca
  pra concluir que funcionam. Todo `✅ FEITO`, todo "medido: X", todo número de auditoria anterior
  precisa ser **remedido por você**.
- **As duas listas da AUD-13** (os 18 itens fechados nos 5 lotes + o "✅ o que está são"), e as duas
  irmãs da AUD-12 (15 corrigidos + 64 sãs). São exatamente o tipo de coisa que já se provou errada
  aqui.
- Os comentários no código. Explicam a intenção, não provam o comportamento.
- Os nomes dos testes. Um teste verde pode estar **travando o comportamento errado** — já aconteceu
  aqui: um teste afirmava `linhas: 2` numa linha só, e era o teste que consagrava o defeito.
- As mensagens de commit, incluindo as minhas.
- Esta lista. Se achar que ela deixou algo de fora, cubra assim mesmo e diga que cobriu.

Cada achado só é achado **depois de reproduzido**. Nada de "provavelmente", "pode ser que", "o
código sugere". Se não conseguiu reproduzir, diga isso e classifique como **não confirmado**.
E quando o falso positivo for **seu**, declare — a AUD-13 declarou três dos dela, e isso vale.

## Por que desconfiar mais do que foi consertado por último

O padrão que já mordeu duas vezes: **o mesmo agente escreve o conserto e o teste do conserto, no
mesmo dia, e o teste passa.** A AUD-12 fechou 15 itens assim, e a AUD-13 descobriu que o lote D dela
tinha **quebrado o `/producao`** — o `[TD-026]` deixava cada produto produzível **uma única vez**, e
ninguém pegou porque o defeito só aparece na **segunda** produção do mesmo produto.

A AUD-13 fechou **18 itens em 5 lotes no mesmo dia**, e o `[UX-47]`/`[UX-52]` no dia seguinte. Esse
é o código **menos exercitado do repositório**. Dê a ele o dobro de desconfiança, em particular:

- **`finishedGoodToPayload`** — os três construtores de payload do acabado viraram um só, e o
  `addProductionLayers` passou a devolver o doc com `rev`. Toque nos três caminhos (produção, venda,
  estorno) **em sequência**, no mesmo produto, mais de uma vez.
- **O guarda de concorrência (`rev`)** — foi ele que denunciou o TD-026. Duas abas gravando.
- **`guardOnline` nos três pontos novos** — escrita offline que antes gravava calada.
- **O parser que passou a recusar número falso**, e o resto do CSV: `parseBool`, `cor-sem-preco`,
  `isMilharAmbiguo`, peça fracionária, `Tempo (h)` + `Tempo (min)`.
- **A régua de 44px sem exceção** (cartão abaixo de 640, trilha alargada de 641 a 760) e o
  **"N disp. · N nesta cor"** — meça no DOM, não no screenshot.
  ⚠ Armadilha medida no lote D: **CSS em cache no navegador** fez a medição mentir; só depois do
  reload o valor certo apareceu. Recarregue antes de medir.

## Os buracos que quatro varreduras declararam e ninguém fechou — AGORA É A VEZ DELES

A superfície fácil está exaurida: seis varreduras passaram por ela. O valor desta está no que ficou
declarado como não coberto. **Priorize esta lista** — e para cada linha, ou entregue a medição, ou
me diga por que continua impossível (aí eu decido se resolvo do meu lado):

1. **Offline de verdade** — rede realmente caída (fila do Firestore, Promise pendente, reconexão),
   não `navigator.onLine` forçado. É a **quinta** varredura em que isso aparece como buraco. No
   navegador embutido dá pra derrubar a rede pelo CDP/devtools; tente por aí antes de desistir.
2. **Duas abas gravando ao mesmo tempo**, com o guarda `rev` no meio: produção na aba A, venda do
   mesmo produto na aba B, estorno cruzado.
3. **A forma dos documentos no Firestore**, não só os números. A AUD-13 saiu **pela UI** porque ler
   o token de sessão foi (corretamente) bloqueado — e isso prova saldo, não esquema: *um campo que
   mudasse sem mover saldo passaria batido*. Caminho legítimo: use o **SDK já autenticado na própria
   página** (`javascript_tool` na aba logada) pra ler e serializar os documentos. Não leia token de
   autenticação de lugar nenhum.
   ⚠ **Armadilha já pisada:** dump que faz `{ id: doc.id, ...doc.data() }` tem o id do caminho
   **sobrescrito** quando o documento carrega um campo `id` — isso já mascarou um produto legítimo, e
   limpar por aquela lista teria apagado dado real. Ponha o id do caminho **por último** e com nome
   que não colide (`__id`).
4. **Escala** — acima de 500 produtos contra o banco (hoje são ~97), e o histórico de vendas com
   filtro e paginação, que nenhuma varredura tocou.
5. **`/maquinas` além da leitura** — máquinas moram no doc compartilhado `config/machines`: editar
   watts/`lifeHours` recalcula energia e desgaste do **catálogo inteiro**, e os produtos guardam só
   o `machineId`. Isso nunca foi exercitado de verdade, em nenhuma das seis.
6. **CSV em Excel/Google Sheets de verdade** — não é mais detalhe: quem vai **gerar** a planilha é o
   **sistema externo do dono**, e a spec vai ser escrita comigo depois. Abra o arquivo exportado num
   dos dois, salve por lá, reimporte. Separador, BOM, aspas, `;` vs `,`, número em pt-BR, data.
7. **Regras de segurança do Firestore** — exige uma 2ª conta Google. Me diga se quer que eu arranje;
   não tente contornar.

## O que precisa sair no relatório — inclusive o que estiver SÃO

Este é o ponto mais importante do pedido: **eu quero ver o resultado de tudo que você testou, mesmo
quando não achou nada.** Um relatório com "3 defeitos" e silêncio sobre o resto não me diz se você
olhou os outros 200 casos ou se nem chegou lá.

Para **cada** item verificado, reporte:

| campo | o que é |
|---|---|
| **O quê** | o comportamento testado, em uma frase |
| **Como** | o método concreto (harness em vitest / medição no DOM / escrita real / leitura de código) |
| **Medido** | o número, o texto, o diff — o dado cru, não a conclusão |
| **Veredito** | ✅ são · 🔴 defeito · ⚠️ ressalva · ❓ não consegui verificar (e por quê) |

No fim, quatro seções obrigatórias:

1. **Defeitos**, ordenados por *o que me custa mais caro depois que a Diretriz 7 cair*, cada um com
   mecanismo + reprodução + impacto. **Não corrija nada** — eu decido os lotes.
2. **✅ O que está são — medido, não presumido.** Lista longa, com os números.
3. **O que esta varredura NÃO cobriu**, e por quê (custo, risco, faltou dado). Seja honesto: um
   buraco declarado vale mais que uma cobertura fingida — e diga quais dos 7 buracos herdados
   continuam abertos.
4. **O veredito de maturidade** — é o que esta varredura existe pra responder (as 3 perguntas do fim).

## Escopo — o sistema inteiro

Descubra a superfície você mesmo (não trate a lista abaixo como completa), mas ela precisa estar
coberta:

**Matemática pura** (`features/pricing-calculator/lib/`) — precificação, capacidade, FIFO e
overdraft, estoque em gramas, insumos em unidades, produção (baixa por evento + custo congelado),
acabados (camadas FIFO, SKU = subitem × cor), reconciliação da venda e o **estorno**, régua de
margem, taxas de pagamento (bandeira × parcela, gross-up, desconto, margem líquida), arredondamento.
Refaça as contas **à mão** em pelo menos um caso de cada, num **cenário novo** (não repita o da
AUD-13), e compare dígito a dígito.

**Round-trip de dados** — o par `buildLoadedProduct` ⇄ `buildProductPayload`, o `toSavedProduct`, o
`parseProductsCsv` e o export. Diff **campo a campo do documento**, com *stringify canônico* nos
mapas. Preço não serve de canário: um campo pode sumir sem mover um centavo.

**As 7 rotas e os 9 diálogos** — calculadora, catálogo, vendas, orçamento, máquinas, produção,
estoque. Nos **dois temas**, com os acordeões abertos, em pelo menos 375 / 641 / 760 / 1280 (as três
primeiras são as fronteiras que o `[UX-47]` acabou de mexer). Meça no DOM: nada de "parece ok"
olhando screenshot.

**Escrita e integridade** — atomicidade dos lotes, as 4 coleções da venda, linha ruim no meio de um
lote, offline, duas abas.

**PDF do orçamento** — gere o arquivo e **extraia o texto dele**; confira contra a tela.

**As ressalvas herdadas, que eu quero reconferidas** (não são itens hoje, mas se mudaram, viraram):
o **overdraft de −370 g na cor Bege** (saldo 243 g, rolo #5 com 613 g) · os alvos que ficaram a
**1–4px da régua** · `[CSV-30]`/`[TD-021]` · o `[A11Y-02]`, que fechou como **falso positivo
declarado** — confirme que é mesmo.

## Método

- **Funções puras:** harness em vitest, muitos casos, incluindo limítrofes e absurdos (zero,
  negativo, vazio, gigante, texto onde se espera número, pt-BR vs ponto). **Escreva a previsão
  ANTES** de rodar; conta à mão em aritmética decimal depois. Apague os harness no fim e deixe o
  `git status` limpo.
- **Suíte:** `pnpm lint`, `pnpm build` e `pnpm test` — a suíte tem **729 testes**; rode **3 a 4
  vezes** e me diga se houve flake. E lembre: teste verde não é prova, é hipótese.
- **UI:** navegador embutido (`preview_start` + `read_page`/`computer`/`javascript_tool`), com
  `.claude/launch.json` — nunca `pnpm dev` no Bash. Meça no DOM, com reload antes de medir CSS.
  Se cair na tela de login do Google, **pare e me peça** — eu logo e te devolvo. Você nunca digita
  credencial.
- **Escrita real no Firestore:** **me peça autorização explícita antes**, com o plano na mão — o que
  vai criar, quantos documentos, como vai limpar, e como vai **provar** que limpou. Faça backup em
  disco antes. No fim, confira o banco documento a documento contra o backup e me entregue o balanço
  (antes → depois, coleção a coleção), como a AUD-13 entregou.
- **Nunca apague nada meu** sem me perguntar.

## Onde este código costuma quebrar (terreno de caça, não verdade)

Padrões que já apareceram aqui mais de uma vez. Confirme se ainda existem, em vez de assumir que
foram resolvidos:

1. **Função que remonta um objeto campo a campo e esquece um.** O campo vira `null` no save
   seguinte, sem mover o preço.
2. **Default silencioso.** Célula vazia, coluna ausente, campo opcional num tipo de escrita — o
   valor errado entra calado, com aparência de normal.
3. **Casamento por substring.** Nome de coluna, id, needle: o mais curto rouba o do mais longo.
4. **Número em pt-BR lido por parser que não fala pt-BR** — e o inverso, ponto de milhar virando
   decimal.
5. **Escrita não atômica**, ou lote que entra pela metade.
6. **Snapshot congelado que congelou o campo errado** (ou não congelou).
7. **Aviso que não acende** — ou que acende quando não devia (falso positivo ensina a ignorar aviso).
8. **Coluna de grade com `1fr` puro** em vez de `minmax(0, 1fr)`, e fileira que rola de lado no
   celular em vez de virar cartão.
9. **Conserto que só falha na SEGUNDA vez** (o `[TD-026]` é o retrato disso). Todo caminho que você
   testar, teste **duas vezes seguidas no mesmo dado**.
10. **Código morto que volta a ser chamado** — a AUD-13 apagou vários; confirme que nada ficou
    apontando pra eles, e que nada novo virou órfão.

## O que eu quero respondido em números, no fim

1. **A Diretriz 7 pode expirar?** Ou seja: se eu recadastrar tudo agora, em cima deste código, o que
   você mediu que sustenta o "sim" — e o que ainda te deixa desconfortável.
2. **Se algo entrar errado, eu descubro?** Quais erros entrariam **em silêncio**, sem aviso na tela
   nem divergência visível depois.
3. **Quanto do que as varreduras anteriores declararam são continua são?** Diga o número: quantas
   afirmações você refez, quantas bateram, quantas não.

Comece me dizendo o plano e o que você vai precisar de mim (login, autorização de escrita, 2ª conta
Google). Depois toque a varredura inteira e me traga o relatório — **em artifact**, como a AUD-13,
com as medições cruas dentro.
