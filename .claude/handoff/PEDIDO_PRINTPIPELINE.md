# Pedido do LopoLabCalc → LopoLabPrintPipeline (2026-09-23)

> **Para o dono levar ao projeto `LopoLabPrintPipeline`.** Saiu do brainstorm de 2026-09-22/23 no
> LopoLabCalc (registro completo, com o que foi descartado e por quê, no `HISTORICO.md` de lá, seção
> "📐 Brainstorm: dados da impressora"). Este arquivo é autocontido: dá pra colar numa sessão do
> pipeline sem o resto. **Do lado do site:** o formato do CSV de catálogo (item 8) está fechado e
> codado (2026-09-24), e o arquivo de produção (seção 3) também (2026-09-25).

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
   da lista do site** (o dono exporta a lista de cores do `/estoque` do LopoLabCalc pelo botão
   **"Copiar lista de cores"**: TSV `Cor · Material · Nome no site · Amostras · Arquivada`, uma linha
   por material + cor, com os hex de todas as marcas). Ex.: `161616` + PLA → "Preto PLA". **Sem
   marca**: na fase A nada mexe em rolo, e a prateleira do acabado já conta por material + cor. Somar por cor carregada (1081441249: 3 cores planejadas caíram no mesmo slot verde).
7. **Cancelada:** peso e tempo da API são do PLANO — **mandar o plano como veio**; quem estima é
   o site (`plano × min(1, relógio ÷ plano)`, ex.: 1214307195 → 1358 s de 5824 s ≈ 23% → ~7 g de
   31 g). O curador pode MOSTRAR a estimativa, mas não gravá-la no arquivo (seção 3).
8. **Catálogo (CSV):** exportar só o **objetivo** — peso, tempo, etapas, máquinas que já rodaram,
   cores (material+cor), link, personalizado — **+ a coluna de apelidos** de cada produto. Markup e
   taxa de falha: no máximo um **padrão em lote**. **Não investir** mais em mão de obra/acessórios
   aqui: isso é preenchido no site (acessório precisa do insumo do site; lá o dono vê o preço real).
   **Formato fechado (LopoLabCalc, lote 4, 2026-09-24):**
   - Coluna **`Apelidos JSON`**: uma lista JSON por produto, célula vazia = nenhum apelido.
     Cada item:
     `{"fonte":"mw","chave":"1234567","variante":"998877","plate":2,"etapa":"Tampa","objetosPorUnidade":1}`
     - `fonte`: `mw` ou `arquivo`. **Não mande `codigo`**: na fase A o produto ainda não tem
       código (o site gera ao importar) e o site recusa, com aviso.
     - `chave`: **no ORIGINAL, sem traduzir**. `mw` = o `designId`; `arquivo` = o nome do
       arquivo/projeto como veio. O site normaliza (caixa, acento, `_`, espaço repetido, extensão
       `.3mf`/`.gcode.3mf`/`.stl`), então não precisa pré-normalizar.
     - `variante`: o `instanceId` do MakerWorld, como texto (ou `null`).
     - `plate`: inteiro a partir de 1 (ou `null`).
     - `etapa`: o **nome** da etapa da mesma linha (o "Nome Etapa Principal" ou o `name` de um item
       do "Etapas JSON"), ou o `id` da etapa, ou vazio = etapa principal. Nome que casa com duas
       etapas é recusado (ambíguo).
     - `objetosPorUnidade`: inteiro a partir de 1; ausente = 1.
     - O mesmo `fonte+chave+variante+plate` em duas linhas: **vale o da primeira**, o outro sai com
       aviso (um apelido aponta pra um produto só).
   - Coluna **`Codigo`**: não mande (ou deixe vazia). O site gera um código novo por produto e
     ignora, com aviso, o que vier nela.
   - Item ruim de `Apelidos JSON` é descartado **com aviso** e o produto entra mesmo assim.
9. **Salvar a curadoria em arquivo** além do `localStorage`.

## 3. O arquivo de produção (formato FECHADO — LopoLabCalc, lote 5b, 2026-09-25)

Um item por impressão. **Só fatos + a curadoria da fase A** (na fase B o site interpreta). O botão
**"Importar impressões"** da `/producao` do site é o validador: a prévia diz, por `task_id`, o que
não leu e por quê. Referência do código: `src/features/pricing-calculator/lib/productionImport.ts`.

```json
{
  "schema_version": 1,
  "fonte": "bambu",
  "gerado_em": "2026-09-25T10:00:00Z",
  "impressoes": [
    {
      "task_id": "1214307195",
      "maquina": "X2D Combo",
      "serial": "0948AD5A1200123",
      "inicio": "2026-07-01T12:00:00Z",
      "fim": "2026-07-01T12:22:38Z",
      "duracao_s": 5824,
      "duracao_relogio_s": 1358,
      "status": "cancelada",
      "status_cru": 3,
      "peso_total_g": 31.2,
      "filamentos": [
        { "cor_carregada": "161616", "cor_planejada": "0A2989", "material": "PLA", "g": 31.2,
          "ams": 0, "slot": 2, "filament_id_bambu": "GFA00",
          "cor_site": { "cor": "Preto", "material": "PLA" } }
      ],
      "objetos": [ { "nome": "Assembly", "qtd": 2 } ],
      "apelido": { "fonte": "mw", "chave": "1234567", "variante": "998877", "plate": 2 },
      "design_id": "1234567",
      "titulo": "LL-0042 Quatto face",
      "personalizado": false,
      "imagens": { "capa": "1214307195_capa.png", "foto": null },
      "curadoria": {
        "destino": "falha",
        "apelido_produto": { "fonte": "mw", "chave": "1234567", "variante": "998877", "plate": 2 },
        "unidades_produzidas": 2,
        "unidades_creditadas": 0,
        "submissao": null
      }
    }
  ]
}
```

**Regras de cada campo** (o que o site recusa vem com o motivo na prévia):
- `schema_version`: **1**. Sem ele o site recusa o arquivo inteiro ("formato antigo").
- `fonte`: o adaptador (`"bambu"`). É a identidade junto do `task_id`: reimportar o mesmo arquivo
  não duplica nada.
- `task_id`: texto, só letras, números, `_` e `-` (vira pasta no Storage).
- `maquina`: o NOME já mapeado (`maquinas_conhecidas.json`). Nome que não bate fica fora, com
  motivo.
- `inicio`/`fim`: ISO **com fuso** (`Z` ou `-03:00`). Sem fuso a impressão é recusada (seria lida
  na hora local do navegador).
- `duracao_s` = `costTime` (o plano); `duracao_relogio_s` = fim − início, ou `null`.
- `status`: `concluida` | `cancelada` | `falha` (a impressora parou sozinha). Qualquer outro valor
  é recusado; mande o código original em `status_cru`.
- **Não estimem nada:** mandem as gramas e o tempo **do plano** também na cancelada/falha. O site
  aplica `plano × min(1, relógio ÷ plano)` e marca "estimativa" (a regra e o comparador ficam no
  mesmo código). Na concluída, o site usa o `costTime`, nunca o relógio.
- `filamentos[]`: um item por slot, `g` numérico ≥ 0. O site soma por cor do site (3 cores
  planejadas no mesmo slot verde viram 1 linha). `cor_site` = a cor da lista do site (TSV do
  "Copiar lista de cores"), sem marca; `null` = não traduzida (entra com o hex como nome).
- `objetos[]`: nome **original** + `qtd` inteira ≥ 1.
- `apelido`: fato cru, `{fonte, chave, variante, plate}` sem normalizar (ou `null`).
- `imagens`: o **nome do arquivo** ao lado do JSON (`{task_id}_capa.png`, `{task_id}_foto.jpg`),
  ou `null`. O dono seleciona os arquivos junto no site; o site casa pelo nome citado aqui.
- **Um arquivo é de UMA fase:** todas as impressões com `curadoria` (fase A) ou todas sem (fase B —
  o site abre a revisão linha a linha e grava com baixa de rolo). Arquivo que mistura é recusado.
  Na fase B mandem só os fatos (`curadoria: null`); `cor_site` continua valendo (sem ela, o dono
  escolhe a marca no site, e isso traduz a cor).
- `curadoria` (**só na fase A**; `null`/ausente = fase B):
  - `destino`: `historico` | `estoque` | `falha` | `teste`.
  - `apelido_produto`: o MESMO apelido que foi no CSV do catálogo (`fonte` `mw` ou `arquivo`),
    ou `null` = avulso. O site só aceita apelido **exato** que já exista (importe o CSV antes).
  - `unidades_produzidas` (inteiro ≥ 1, o que a mesa fez) e `unidades_creditadas` (0 até
    produzidas, **só** com `destino: "estoque"`). Custo por peça = total ÷ **produzidas**.
  - `submissao`: produto **vendido inteiro com várias mesas** (corpo numa, tampa noutra): as
    impressões que formam as peças levam o **mesmo texto** aqui, e o mesmo produto, destino e
    unidades. Juntas, creditam o que formam; uma etapa sozinha com `estoque` é recusada
    (mande-a como `historico`). Produto de uma mesa, ou vendido por partes, não precisa.
  - `estoque` exige produto e `cor_site` em todo filamento com grama (a prateleira é material +
    cor).

**Não mandar:** configurações do slicer, chaves sobrescritas por plate, `metros`, assinaturas
calculadas, caminhos de mídia além da capa/foto, estimativa de consumo.

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

O LopoLabCalc gera (desde 2026-09-24) um código **eterno** por produto (`LL-0001`…, sequencial, nunca
reaproveitado, sem significado embutido). Em arquivo próprio, o dono copia o código do produto no
site e salva o projeto com ele no nome (`LL-0042 Quatto face`). É o apelido mais forte: a impressão
já chega reconhecida desde a 1ª vez. No MakerWorld não precisa fazer nada — o apelido `mw` é
aprendido na 1ª ligação.

⚠ **Na fase A o produto ainda não tem código** (o site gera ao importar o CSV). Por isso a produção
da fase A referencia o produto **pelo apelido**, que vai no CSV junto com o produto.
