# AUD-10 — varredura geral do sistema, ANTES da carga em massa

> **Como usar:** abra um chat NOVO no Claude Code, na raiz do projeto, e cole tudo daqui pra baixo.
> A varredura é longa — conte com um chat inteiro só pra ela.

---

Faça uma **varredura completa do sistema**, do zero. Eu vou fazer a carga em massa do catálogo
depois disso e quero confirmar, mais uma vez, que está tudo certo.

## A regra que manda em todas as outras: NADA é verdade até você reproduzir

Você vai encontrar muita afirmação neste repositório. **Trate todas como hipótese não verificada**,
inclusive:

- O `CLAUDE.md`, o `BACKLOG.md` e o `HISTORICO.md` — leia pra saber **onde as coisas moram**, nunca
  pra concluir que funcionam. Todo `✅ FEITO`, todo "medido: X", todo número de auditoria anterior
  precisa ser **remedido por você**.
- Os comentários no código. Eles explicam a intenção, não provam o comportamento.
- Os nomes dos testes. Um teste verde pode estar **travando o comportamento errado** — isso já
  aconteceu aqui: um teste afirmava `linhas: 2` numa linha só e o número estava errado, o teste é
  que consagrava o defeito.
- As mensagens de commit, incluindo as minhas.
- Esta lista. Se você achar que ela deixou algo de fora, cubra assim mesmo e diga que cobriu.

Cada achado só é achado **depois de reproduzido**. Nada de "provavelmente", "pode ser que", "o
código sugere". Se não conseguiu reproduzir, diga isso explicitamente e classifique como
**não confirmado**.

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

No fim, três seções obrigatórias:

1. **Defeitos**, ordenados por *o que sai errado pro cliente / pra carga primeiro*, cada um com
   mecanismo + reprodução + impacto. **Não corrija nada** — eu decido os lotes.
2. **✅ O que está são — medido, não presumido.** Lista longa, com os números.
3. **O que esta varredura NÃO cobriu**, e por quê (custo, risco, faltou dado). Seja honesto: um
   buraco declarado vale mais que uma cobertura fingida.

## Escopo — o sistema inteiro

Não é uma varredura de CSV. É tudo. Descubra a superfície você mesmo (não confie na lista abaixo
como se fosse completa), mas ela precisa estar coberta:

**Matemática pura** (`features/pricing-calculator/lib/`) — precificação, capacidade, FIFO e
overdraft, estoque em gramas, insumos em unidades, produção (baixa por evento + custo congelado),
acabados (camadas FIFO, SKU = subitem × cor), reconciliação da venda e o **estorno**, régua de
margem, taxas de pagamento (bandeira × parcela, gross-up, desconto, margem líquida), arredondamento.
Refaça as contas **à mão** em pelo menos um caso de cada e compare.

**Round-trip de dados** — o par `buildLoadedProduct` ⇄ `buildProductPayload`, o `toSavedProduct`, o
`parseProductsCsv` e o export. Diff **campo a campo do documento**, com *stringify canônico* nos
mapas. Preço não serve de canário: um campo pode sumir sem mover um centavo.

**Importação/exportação de CSV** — inclusive as mudanças mais recentes, que são as menos testadas:
`Tempo (h)` + `Tempo (min)` somando, o contador de linhas dos apontamentos, e o cruzamento entre o
`colorName` e o `filamentId`. Trate-as com **mais** desconfiança que o resto, não menos.

**As 7 rotas e os diálogos** — calculadora, catálogo, vendas, orçamento, máquinas, produção,
estoque. Nos **dois temas**, em **375px e 1280px**, com os acordeões abertos. Meça no DOM: nada de
"parece ok" olhando screenshot.

**Escrita e integridade** — atomicidade dos lotes, escrita nas 4 coleções da venda, o que acontece
com uma linha ruim no meio de um lote, offline, e o comportamento em **duas abas ao mesmo tempo**.

**O que só existe em produção** — máquinas moram num doc compartilhado (`config/machines`): editar
watts/`lifeHours` recalcula o catálogo inteiro. Isso nunca foi exercitado de verdade.

**PDF do orçamento** — gere o arquivo e **extraia o texto dele**; confira contra a tela.

## Método

- **Funções puras:** harness em vitest, muitos casos, incluindo os limítrofes e os absurdos (zero,
  negativo, vazio, gigante, texto onde se espera número, pt-BR vs ponto).
- **UI:** navegador embutido (`preview_start` + `read_page`/`computer`/`javascript_tool`), com
  `.claude/launch.json`. Meça no DOM. Se cair na tela de login do Google, **pare e me peça** — eu
  logo e te devolvo. Você nunca digita credencial.
- **Escrita real no Firestore:** **me peça autorização explícita antes**, com o plano na mão —
  o que vai criar, quantos documentos, como vai limpar, e como vai **provar** que limpou. Faça
  backup em disco antes. No fim, confira o banco documento a documento contra o backup.
  ⚠ **Armadilha já pisada aqui:** um dump que faz `{ id: doc.id, ...doc.data() }` tem o id do
  caminho **sobrescrito** quando o documento carrega um campo `id` — isso mascarou um produto
  legítimo numa auditoria anterior, e limpar por aquela lista teria apagado dado real. Ponha o id
  do caminho **por último** e com nome que não colide (`__id`).
- **Nunca apague nada meu** sem me perguntar.

## Onde este código costuma quebrar (terreno de caça, não verdade)

São os padrões de defeito que já apareceram aqui mais de uma vez. Use como roteiro de onde cavar —
e confirme se ainda existem, em vez de assumir que foram resolvidos:

1. **Função que remonta um objeto campo a campo e esquece um.** O campo vira `null` no save
   seguinte, sem mover o preço.
2. **Default silencioso.** Célula vazia, coluna ausente, campo opcional num tipo de escrita — o
   valor errado entra calado, com aparência de normal.
3. **Casamento por substring.** Nome de coluna, id, needle: o mais curto rouba o do mais longo.
4. **Número em pt-BR lido por parser que não fala pt-BR** — e o inverso, ponto de milhar virando
   decimal.
5. **Escrita não atômica**, ou lote que entra pela metade.
6. **Snapshot congelado que congelou o campo errado** (ou não congelou).
7. **Aviso que não acende** — ou que acende quando não devia (falso positivo é defeito também:
   ensina o usuário a ignorar avisos).
8. **Coluna de grade com `1fr` puro** em vez de `minmax(0, 1fr)`, e fileira que rola de lado no
   celular em vez de virar cartão.

## Duas coisas que eu quero respondidas em números, no fim

1. **A carga em massa vai dar certo?** Não quero "sim" — quero o que você mediu que sustenta a
   resposta, e o que ainda te deixa desconfortável.
2. **Se eu importar ~100 produtos e algo estiver errado, eu descubro?** Ou seja: quais erros
   entrariam **em silêncio**, sem aviso na tela nem divergência visível depois.

Comece me dizendo o plano e o que você vai precisar de mim (login, autorização de escrita). Depois
toque a varredura inteira e me traga o relatório.
