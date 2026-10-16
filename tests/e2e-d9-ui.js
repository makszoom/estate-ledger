#!/usr/bin/env node
// e2e-d9-ui: accounting basis UI (radio, confirm-modal, badge, carry sample)
const WebSocket = require("C:/Users/MiniPC/Projects/estate-ledger/node_modules/ws");
let passed = 0, failed = 0;
function ok(name, cond, extra) { if (cond) { passed++; console.log("  \u2713", name); } else { failed++; console.log("  \u2717", name, extra || ""); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
let mid = 0; const pending = new Map(); let ws;
function send(method, params, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++mid; pending.set(id, { resolve, reject });
    const msg = { id, method, params: params || {} };
    if (sessionId) msg.sessionId = sessionId;
    ws.send(JSON.stringify(msg));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error("timeout " + method)); } }, 10000);
  });
}
(async () => {
  const ver = await (await fetch("http://127.0.0.1:9333/json/version")).json();
  ws = new WebSocket(ver.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  ws.on("message", m => { const d = JSON.parse(m); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.reject(new Error(d.error.message)) : p.resolve(d); } });
  await new Promise(res => ws.on("open", res));
  await sleep(200);
  const created = await send("Target.createTarget", { url: "file:///C:/Users/MiniPC/Projects/estate-ledger/site/app.html?sample=1" });
  const ti = created.result.targetId;
  const att = await send("Target.attachToTarget", { targetId: ti, flatten: true });
  const sid = att.result.sessionId;
  await send("Runtime.enable", {}, sid);
  const evalJS = async expr => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sid)).result.result.value;
  await evalJS("localStorage.clear()");
  await send("Page.enable", {}, sid);
  await send("Page.reload", { ignoreCache: true }, sid);
  await sleep(1200);

  const basis = await evalJS("JSON.parse(localStorage.getItem('el_state')).estates['el-sample-estate'].accountingBasis");
  ok("sample estate accountingBasis = carry (CA demo)", basis === "carry", 'got ' + basis);

  await evalJS(`document.querySelector('[data-tab=report]').click()`);
  await sleep(300);
  ok("badge shows carry wording", (await evalJS("document.getElementById('doc-basis-badge').textContent")).includes("Carry value"));
  ok("carry note shown", await evalJS("document.getElementById('doc-basis-note').style.display === 'block'"));

  await evalJS(`document.getElementById('sb-start-real').click()`);
  await sleep(500);
  ok("radio default standard", await evalJS("document.querySelector('input[name=basis][value=standard]').checked"));

  const r1 = await evalJS(`(() => {
    try {
      document.getElementById('f-decedent').value = 'Test Person';
      document.getElementById('f-state').value = 'CA';
      document.getElementById('f-dod').value = '2026-01-01';
      document.querySelector('input[name=basis][value=carry]').checked = true;
      return 'ok';
    } catch (e) { return 'ERR: ' + e.message; }
  })()`);
  console.log('   fill step:', r1);
  await evalJS(`document.getElementById('form-estate').dispatchEvent(new Event('submit',{cancelable:true}))`);
  await sleep(400);
  const st = JSON.parse(await evalJS("localStorage.getItem('el_state')"));
  const eid = st.activeEstateId;
  ok("estate created with carry basis", st.estates[eid].accountingBasis === "carry", 'got ' + st.estates[eid].accountingBasis);

  // give the estate data (asset) so any switch triggers the confirm modal
  await evalJS(`
    document.querySelector('[data-tab=assets]').click();
    document.getElementById('a-name').value = 'Bank account X';
    document.getElementById('a-class').value = 'bank_account';
    document.getElementById('a-value').value = '10000';
    document.getElementById('a-probate').value = 'no';
    document.getElementById('form-asset').dispatchEvent(new Event('submit',{cancelable:true}));
  `);
  await sleep(300);

  // switch carry→standard WITH data → modal; cancel first
  await evalJS(`
    document.querySelector('[data-tab=setup]').click();
    document.querySelector('input[name=basis][value=standard]').checked = true;
    document.getElementById('form-estate').dispatchEvent(new Event('submit',{cancelable:true}));
  `);
  await sleep(300);
  ok("basis-confirm modal opens on switch", await evalJS("document.getElementById('modal-basis').classList.contains('open')"));
  ok("modal text mentions Standard", (await evalJS("document.getElementById('basis-confirm-text').textContent")).includes("Standard"));
  await evalJS(`document.getElementById('btn-basis-cancel').click()`);
  ok("modal closed after cancel", await evalJS("!document.getElementById('modal-basis').classList.contains('open')"));
  ok("cancel keeps carry", (await evalJS("JSON.parse(localStorage.getItem('el_state')).estates['" + eid + "'].accountingBasis")) === "carry");

  // switch carry→standard again → modal → confirm → standard
  await evalJS(`
    document.querySelector('input[name=basis][value=standard]').checked = true;
    document.getElementById('form-estate').dispatchEvent(new Event('submit',{cancelable:true}));
  `);
  await sleep(300);
  ok("modal open again on repeat switch", await evalJS("document.getElementById('modal-basis').classList.contains('open')"));
  await evalJS(`document.getElementById('btn-basis-confirm').click()`);
  await sleep(300);
  ok("confirm switches to standard", (await evalJS("JSON.parse(localStorage.getItem('el_state')).estates['" + eid + "'].accountingBasis")) === "standard");

  // badge in standard view
  await evalJS(`document.querySelector('[data-tab=report]').click()`);
  await sleep(300);
  ok("badge shows standard wording", (await evalJS("document.getElementById('doc-basis-badge').textContent")).includes("market value"));
  ok("carry note hidden in standard", await evalJS("document.getElementById('doc-basis-note').style.display === 'none'"));

  // switch back standard→carry WITH data → modal; confirm → carry
  await evalJS(`
    document.querySelector('[data-tab=setup]').click();
    document.querySelector('input[name=basis][value=carry]').checked = true;
    document.getElementById('form-estate').dispatchEvent(new Event('submit',{cancelable:true}));
  `);
  await sleep(300);
  ok("modal opens on carry-switch too", await evalJS("document.getElementById('modal-basis').classList.contains('open')"));
  await evalJS(`document.getElementById('btn-basis-confirm').click()`);
  await sleep(300);
  ok("confirm switches to carry", (await evalJS("JSON.parse(localStorage.getItem('el_state')).estates['" + eid + "'].accountingBasis")) === "carry");

  await send("Target.closeTarget", { targetId: ti });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log("FATAL:", (e.message||String(e)).slice(0, 300)); process.exit(2); });
