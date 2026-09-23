# Pedido do LopoLabCalc → LopoLabPrintPipeline (2026-09-23)

> **Para o dono levar ao projeto `LopoLabPrintPipeline`.** Saiu do brainstorm de 2026-09-22/23 no
> LopoLabCalc (registro completo, com o que foi descartado e por quê, no `HISTORICO.md` de lá, seção
> "📐 Brainstorm: dados da impressora"). Este arquivo é autocontido: dá pra colar numa sessão do
> pipeline sem o resto. Nada aqui foi implementado ainda, de nenhum dos dois lados.

## A regra que vale pra tudo

- **O pipeline entrega FATOS da impressora; o LopoLabCalc decide o SIGNIFICADO** (produto, unidades,
  desfecho, marca, preço). Nada de produto, preço ou marca decidido em Python, fora da carga inicial.
- **O site nunca depende do pipeline.** Se a API da Bambu parar, o site continua 100% manual. Por
  isso: nada de escrever direto no Firestore, nada de credencial de serviço, nada de agendamento
  automático. A ponte continua sendo **arquivo levado à mão**.
- **Formato neutro:** o site não deve precisar saber que é Bambu. Tudo que é específico da Bambu
  (`amsDetailMapping`, `repetitions`, `designId`, token) é resolvido aqui.

## Duas fases

- **Fase A — carga inicial (antes do "marco" do LopoLabCalc):** o curador é a ferramenta de trabalho.
  Liga impressões a produtos, conta a prateleira, exporta catálogo + produção + imagens.
- **Fase B — uso real (depois do marco):** o curador **não é necessário**. O coletor gera o arquivo
  de produção (mesmo formato) e a revisão acontece no site. O curador pode ficar como visualizador.

## 1. Obrigatório, antes do recadastro

1. **Corrigir o bug do `repetitions`** em `build_review.py`, `parts_counter` (~l. 84): tirar o
   `* rep`. Os objetos e o peso da API **já incluem as cópias** (33 impressões com rep > 1). Hoje o
   CSV de catálogo sai com peças infladas e peso/tempo por unidade subestimados. Reexportar depois.

## 2. Curador (fase A)

1. **Mostrar a capa (`cover.png`) em cada card.** Identificar pela imagem é muito mais rápido que
   por "Assembly"/hash.
2. **Agrupar por APELIDO**, não por título, com botões **juntar** (mesmo produto, títulos diferentes)
   e **separar** (mesmo título, plates de etapas diferentes). Apelido = campos, não texto único:
   - `fonte`: `codigo` | `mw` | `arquivo`
   - `chave`: código do produto (`LL-0042`, extraído do título/nome do arquivo por regex tolerante:
     `LL-0042`, `LL0042`, `ll-42`) · `designId` (MakerWorld) · nome de arquivo/perfil normalizado
     (personalizado sem código)
   - `variante`: `instanceId` (MakerWorld; o mesmo design tem instâncias com peças diferentes)
   - `plate`: `plateIndex`
   - ⚠ **Não** usar `modelId`/`profileId` (mudam a cada envio: o mesmo Zipper tem `modelId`
     diferente na A1 e na X2D; 268 `profileId` distintos em 332).
3. **Ordenar os grupos por nº de impressões** (os mais frequentes primeiro).
4. **Destino explícito pra toda impressão**, com contador "sem destino" que precisa zerar:
   - ligada a **produto + etapa + objetos por unidade** (1 na maioria; ex.: 1 puxador + 2 cursores =
     quantos zippers?) — a ligação do grupo **vira o apelido** exportado no CSV;
   - **avulsa** (personalizado antigo que nunca vai se repetir, coisa que não é produto);
   - **teste/calibração**;
   - **falha** (cancelada, ou concluída mas descartada — marcável à mão).
   Nem todo grupo precisa virar produto: avulso é destino válido e economiza trabalho.
5. **Contagem da prateleira por produto × COR (× parte, quando o produto vende por partes)**. O
   curador marca como `estoque` as impressões **mais recentes** daquela cor até cobrir a contagem; o
   resto fica `historico`. Cada impressão marcada leva **unidades produzidas** (da mesa) **e unidades
   creditadas** (a parte que ainda está na prateleira — ex.: produziu 10, tem 7). Contagem que
   nenhuma impressão cobre (peça feita antes de 11/06) aparece como **"faltam N"** — o dono lança à
   mão no site.
6. **Cor:** traduzir o hex **carregado** (`targetColor`, não o planejado) + tipo em **material + cor
   da lista do site** (o dono exporta a lista de cores do `/estoque` do LopoLabCalc — o de-para
   nome→id em TSV já existe lá). Ex.: `161616` + PLA → "Preto PLA". **Sem marca**: na fase A nada
   mexe em rolo. Somar por cor carregada (1081441249: 3 cores planejadas caíram no mesmo slot verde).
7. **Cancelada:** peso e tempo da API são do PLANO. Estimar o consumido com
   `plano × min(1, (endTime − startTime) ÷ costTime)` e marcar `fonteDosNumeros: "estimativa"`.
   Ex.: 1214307195 → 1358 s de 5824 s ≈ 23% → ~7 g de 31 g. (Na concluída, tempo = `costTime`,
   **nunca** o relógio — já divergiu 1295%.)
8. **Catálogo (CSV):** exportar só o **objetivo** — peso, tempo, etapas, máquinas que já rodaram,
   cores (material+cor), link, personalizado — **+ a coluna de apelidos** de cada produto. Markup e
   taxa de falha: no máximo um **padrão em lote**. **Não investir** mais em mão de obra/acessórios
   aqui: isso é preenchido no site (acessório precisa do insumo do site; lá o dono vê o preço real).
   Nome de coluna novo: combinar com o LopoLabCalc na hora de codar o import (S2/S3 de lá).
9. **Salvar a curadoria em arquivo** além do `localStorage`.

## 3. O arquivo de produção (formato definitivo — o mesmo nas fases A e B)

Um evento por impressão. **Só fatos + a interpretação da fase A** (na fase B o site interpreta).
Nomes finais dos campos: fechar junto com o S4/S6 do LopoLabCalc; o preview do import do site é o
validador. Proposta:

- `schema_version`, `gerado_em`
- `task_id` (idempotência — cada impressão tem o seu)
- `maquina` (NOME já mapeado pelo `maquinas_conhecidas.json`) + `serial`
- `inicio`, `fim` (UTC), `duracao_s` (`costTime`), `duracao_relogio_s` (fim − início)
- `status` traduzido **e** `status_cru` (código novo não pode virar "concluída" calado)
- `peso_total_g` (da API, já com cópias)
- `filamentos[]`: cor **carregada** (hex), cor **planejada** (hex), material/tipo, gramas, slot
  (`ams`/`slot`/bico), `filament_id_bambu` (pode vir vazio)
- `objetos[]`: nome **original** (sem normalizar — normalização é do site) + quantidade real na mesa
- `apelido` `{fonte, chave, variante, plate}` + `design_id`/`titulo` quando houver + `personalizado`
- `imagens`: nomes dos arquivos (ou `null`)
- **Só na fase A** (vem do curador): `apelido_produto` (ou `null` = avulso), `destino`
  (`historico` | `estoque` | `falha` | `teste`), `unidades_produzidas`, `unidades_creditadas`,
  `fonteDosNumeros` (`impressora` | `estimativa`), cor já traduzida (material+cor do site).

**Não mandar:** configurações do slicer, chaves sobrescritas por plate, `metros` (a conversão
peso↔metragem é descartada no site), assinaturas calculadas (o site calcula — a regra e o
comparador têm de ser o mesmo código), caminhos de mídia além da capa/foto.

## 4. Imagens

- Exportar numa pasta ao lado do arquivo: **só** `{task_id}_capa.png` (o `cover.png`, 512×512,
  ~20 KB — é **idêntico** ao `plate_N_thumbnail.png`, não mandar os dois) e `{task_id}_foto.jpg` (o
  `snapshot.jpg`, 876×324, ~16 KB, só X2D concluída). Sem conversão: já são pequenas.
- Não mandar vista de cima, máscara, render sem luz (este ainda dá 403 no MakerWorld).
- A capa mostra as cores do ARQUIVO, não as carregadas — só a foto mostra a cor real.

## 5. Coletor

- **Aviso de "última coleta há X dias / faltam ~Y dias pra perder a janela"** (API guarda ~3 meses).
  Uma coleta por mês basta; token vencido = login manual nesse dia.
- **Não** agendar, **não** escrever no Firestore, **não** subir imagem pra lugar nenhum.

## 6. Fatos dos dados que o pipeline deve respeitar

- Peso, tempo e objetos **sempre da API**, nunca do 3mf (22 de 109 `cloud_slice` foram refatiados
  no app: 1191103713 tem 3mf com 2 objetos/65 g e foi impresso com 4/130 g).
- `skipObjects` já vem excluído da lista de objetos.
- Nomes de objeto sujos (`Assembly`, `Object_1`, `Body1`, hash, `_1`/`_2` que nem sempre é cópia).
- 60 impressões de 11–23/06 nunca terão mídia; A1 e A1 mini nunca têm foto.
- Dado antigo (junho) traz os slots como `ams 0 / slot 0` — não confiável.

## Código do produto (o que o dono precisa saber pra usar)

O LopoLabCalc vai gerar um código **eterno** por produto (`LL-0001`…, sequencial, nunca
reaproveitado, sem significado embutido). Em arquivo próprio, o dono copia o código do produto no
site e salva o projeto com ele no nome (`LL-0042 Quatto face`). É o apelido mais forte: a impressão
já chega reconhecida desde a 1ª vez. No MakerWorld não precisa fazer nada — o apelido `mw` é
aprendido na 1ª ligação.

⚠ **Na fase A o produto ainda não tem código** (o site gera ao importar o CSV). Por isso a produção
da fase A referencia o produto **pelo apelido**, que vai no CSV junto com o produto.
