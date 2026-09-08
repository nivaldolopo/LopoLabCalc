// AUD-08 — prova das regras do Firestore contra a PRODUCAO real, como um
// estranho: nenhum token, nenhum login. Rode com `node scripts/provaRegrasNaProducao.mjs`.
//
// Complemento do `pnpm test:rules`, que prova o TEXTO do firestore.rules no
// emulador com identidade forjada. Este aqui prova o outro lado: o que o
// servidor de VERDADE responde a quem chega sem credencial. Re-rode depois de
// qualquer mexida nas regras ou em `ALLOWED_EMAILS`.
//
// Nao e destrutivo por construcao:
//  - o PATCH e feito em doc INEXISTENTE com `currentDocument.exists=true`, entao
//    403 = a regra barrou e 404 = a regra deixou passar (mas nada foi escrito);
//  - o unico create de verdade cai numa colecao-sonda e, se passar, e apagado
//    na hora — e passar ja e o achado.
const PROJ = "lopo-lab";
const DBS = ["lopo-lab-calculadora", "(default)"];
const COLS = ["products", "vendas", "estoque", "insumos", "producao", "acabados", "orcamentos", "taxas", "config"];
const API = "https://firestore.googleapis.com/v1";
const linhas = [];

function veredito(status, corpo) {
  // O runQuery devolve o erro dentro de um ARRAY; os outros, num objeto.
  let erro = null;
  try {
    const j = JSON.parse(corpo || "{}");
    erro = (Array.isArray(j) ? j[0]?.error : j?.error) ?? null;
  } catch {}
  if (status === 403 && erro?.status === "PERMISSION_DENIED") return "BARRADO";
  if (status === 404) return "NAO-EXISTE";
  if (status === 401) return "NAO-AUTENTICADO";
  if (status >= 200 && status < 300) return "PASSOU";
  return "OUTRO";
}

async function sonda(banco, nome, url, init) {
  try {
    const r = await fetch(url, init);
    const corpo = await r.text();
    const v = veredito(r.status, corpo);
    const icone = v === "BARRADO" || v === "NAO-EXISTE" ? "ok " : v === "PASSOU" ? "!!!" : "?  ";
    const extra = v === "PASSOU" ? " <<< " + corpo.slice(0, 160).replace(/\s+/g, " ") : "";
    console.log(`  ${icone} [${banco}] ${nome} -> HTTP ${r.status} ${v}${extra}`);
    linhas.push({ banco, nome, status: r.status, veredito: v });
    return v;
  } catch (e) {
    console.log(`  ?   [${banco}] ${nome} -> ERRO DE REDE: ${e.message}`);
    linhas.push({ banco, nome, status: 0, veredito: "ERRO-REDE" });
    return "ERRO-REDE";
  }
}

for (const db of DBS) {
  const base = `${API}/projects/${PROJ}/databases/${encodeURIComponent(db)}/documents`;
  const json = { "content-type": "application/json" };
  console.log(`\n===== BANCO ${db} — SEM TOKEN =====`);
  for (const c of COLS) await sonda(db, `list ${c}`, `${base}/${c}?pageSize=1`);
  await sonda(db, "get config/machines", `${base}/config/machines`);
  await sonda(db, "runQuery products", `${base}:runQuery`, {
    method: "POST", headers: json,
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "products" }], limit: 1 } }),
  });
  const criou = await sonda(db, "create aud08probe/stranger", `${base}/aud08probe?documentId=stranger`, {
    method: "POST", headers: json,
    body: JSON.stringify({ fields: { at: { stringValue: new Date().toISOString() } } }),
  });
  if (criou === "PASSOU") {
    console.log("  !!! ESCRITA ACEITA — removendo o doc-sonda que acabei de criar");
    await sonda(db, "delete aud08probe/stranger (limpeza)", `${base}/aud08probe/stranger`, { method: "DELETE" });
  }
  await sonda(db, "create products/aud08-probe", `${base}/products?documentId=aud08-probe`, {
    method: "POST", headers: json,
    body: JSON.stringify({ fields: { at: { stringValue: "aud08" } } }),
  });
  for (const c of ["products", "vendas", "config", "estoque"]) {
    await sonda(db, `patch ${c}/aud08-inexistente`, `${base}/${c}/aud08-inexistente?currentDocument.exists=true`, {
      method: "PATCH", headers: json, body: JSON.stringify({ fields: { aud08: { integerValue: "1" } } }),
    });
  }
  await sonda(db, "delete products/aud08-inexistente", `${base}/products/aud08-inexistente`, { method: "DELETE" });
}

const passou = linhas.filter((l) => l.veredito === "PASSOU");
const barrado = linhas.filter((l) => l.veredito === "BARRADO");
const inexistente = linhas.filter((l) => l.veredito === "NAO-EXISTE");
console.log(
  `\n===== ${linhas.length} sondas | BARRADAS ${barrado.length} | banco inexistente ${inexistente.length} | PASSARAM ${passou.length}`,
);
for (const p of passou) console.log(`  !!! PASSOU: [${p.banco}] ${p.nome}`);
process.exitCode = passou.length ? 1 : 0;
