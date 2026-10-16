
const WebSocket = require("C:/Users/MiniPC/Projects/estate-ledger/node_modules/ws");
const PORT = 9333;
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
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  ws = new WebSocket(ver.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  ws.on("message", m => { const d = JSON.parse(m); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.reject(new Error(d.error.message)) : p.resolve(d); } });
  await new Promise(res => ws.on("open", res));
  await sleep(200);
  const created = await send("Target.createTarget", { url: "file:///C:/Users/MiniPC/Projects/estate-ledger/site/app.html" });
  const ti = created.result.targetId;
  const att = await send("Target.attachToTarget", { targetId: ti, flatten: true });
  const sid = att.result.sessionId;
  await send("Runtime.enable", {}, sid);
  const evalJS = async expr => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sid)).result.result.value;
  await evalJS("localStorage.clear()");
  await send("Page.enable", {}, sid);
  await send("Page.reload", {}, sid);
  await sleep(900);

  // estate + 2 assets
  await evalJS(`
    document.getElementById('btn-create-first').click();
    document.getElementById('f-decedent').value = 'Sale E2E';
    document.getElementById('f-state').value = 'CA';
    document.getElementById('f-dod').value = '2025-01-15';
    document.getElementById('form-estate').dispatchEvent(new Event('submit', {cancelable:true}));
    document.querySelector('[data-tab=assets]').click();
    document.getElementById('a-name').value = 'Brokerage shares';
    document.getElementById('a-class').value = 'brokerage';
    document.getElementById('a-value').value = '10000';
    document.getElementById('a-probate').value = 'no';
    document.getElementById('form-asset').dispatchEvent(new Event('submit', {cancelable:true}));
    document.getElementById('a-name').value = 'Old sedan';
    document.getElementById('a-class').value = 'vehicle';
    document.getElementById('a-value').value = '5000';
    document.getElementById('a-probate').value = 'no';
    document.getElementById('form-asset').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("2 assets", (await evalJS("document.getElementById('assets-tbody').rows.length")) === 2);
  ok("Sell button visible", await evalJS("[...document.querySelectorAll('[data-sell]')].length === 2"));

  // Sale: net mode with GAIN preview
  await evalJS(`[...document.querySelectorAll('[data-sell]')][0].click()`);
  ok("sale modal open", await evalJS("document.getElementById('modal-sale').classList.contains('open')"));
  ok("asset line shows DOD", (await evalJS("document.getElementById('sale-asset-line').textContent")).includes("$10,000.00"));
  await evalJS(`
    document.getElementById('s-date').value = '2025-03-01';
    document.getElementById('s-net').value = '11,500';
    document.getElementById('s-net').dispatchEvent(new Event('input'));
  `);
  ok("preview shows gain", (await evalJS("document.getElementById('sale-preview').textContent")).includes("gain"));
  ok("preview gain = $1,500", (await evalJS("document.getElementById('sale-preview').textContent")).includes("$1,500.00"));

  await evalJS(`document.getElementById('form-sale').dispatchEvent(new Event('submit', {cancelable:true}))`);
  ok("modal closed after sale", await evalJS("!document.getElementById('modal-sale').classList.contains('open')"));
  ok("asset row shows SOLD", (await evalJS("document.getElementById('assets-tbody').innerHTML")).includes("SOLD"));
  ok("sold row: no sell btn", await evalJS("[...document.querySelectorAll('[data-sell]')].length === 1"));

  // ledger got 1 money_in principal tx with clean description
  const txs = await evalJS(`JSON.parse(JSON.stringify(JSON.parse(localStorage.getItem('el_state')).estates[JSON.parse(localStorage.getItem('el_state')).activeEstateId].transactions))`);
  ok("1 cash tx created (no double count)", txs.length === 1, 'got ' + txs.length);
  ok("tx: money_in principal 11,500", txs[0].kind === 'money_in' && txs[0].account === 'principal' && txs[0].amount === 11500);
  ok("tx description mentions gain", (txs[0].description || '').includes("gain"));

  // ledger tab: p-in reflects proceeds
  await evalJS(`document.querySelector('[data-tab=ledger]').click()`);
  ok("ledger p-in = $11,500.00", (await evalJS("document.getElementById('p-in').textContent")) === "$11,500.00");
  ok("p-cash = $11,500.00", (await evalJS("document.getElementById('p-cash').textContent")) === "$11,500.00");

  // delete attempt on sold asset → blocked
  await evalJS(`document.querySelector('[data-tab=assets]').click()`);
  const blocked = await evalJS(`
    (function(){
      const soldRow = [...document.querySelectorAll('#assets-tbody tr')].find(r => r.textContent.includes('SOLD'));
      const delBtn = [...soldRow.querySelectorAll('[data-del]')];
      return delBtn.length === 0; // sold rows have no delete button
    })()
  `);
  ok("sold row has no delete button", blocked);

  // Gross+expenses mode on sedan (LOSS)
  await evalJS(`[...document.querySelectorAll('[data-sell]')][0].click()`);
  await evalJS(`
    document.getElementById('s-date').value = '2025-04-01';
    document.querySelector('input[name=s-mode][value=gross]').click();
  `);
  ok("gross mode shows expense field", await evalJS("!document.getElementById('sg-exp').hidden"));
  await evalJS(`
    document.getElementById('s-gross').value = '4800';
    document.getElementById('s-exp').value = '200';
    document.getElementById('s-gross').dispatchEvent(new Event('input'));
  `);
  ok("preview shows loss", (await evalJS("document.getElementById('sale-preview').textContent")).includes("loss"));
  ok("preview loss = $400 (4600 vs 5000)", (await evalJS("document.getElementById('sale-preview').textContent")).includes("$400.00"));
  await evalJS(`document.getElementById('form-sale').dispatchEvent(new Event('submit', {cancelable:true}))`);
  ok("second sale recorded", (await evalJS("JSON.parse(localStorage.getItem('el_state')).estates[JSON.parse(localStorage.getItem('el_state')).activeEstateId].sales.length")) === 2);

  // saleTotals через UI: sales 2, gains 1500, losses 400
  await evalJS(`
    document.getElementById('t-kind') && document.querySelector('[data-tab=ledger]').click();
  `);
  ok("ledger now 2 money_in", (await evalJS("JSON.parse(localStorage.getItem('el_state')).estates[JSON.parse(localStorage.getItem('el_state')).activeEstateId].transactions.filter(t=>t.kind==='money_in').length")) === 2);

  // unknown asset: cannot sell
  await evalJS(`
    document.querySelector('[data-tab=assets]').click();
    document.getElementById('a-name').value = 'Mystery coins';
    document.getElementById('a-class').value = 'personal_property';
    document.getElementById('a-value').value = '500';
    document.getElementById('a-probate').value = 'unknown';
    document.getElementById('form-asset').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  const unknownSell = await evalJS(`
    (function(){
      const coinsRow = [...document.querySelectorAll('#assets-tbody tr')].find(r => r.textContent.includes('Mystery coins'));
      return [...coinsRow.querySelectorAll('[data-sell]')].length;
    })()
  `);
  // Sell кнопка ЕСТЬ у unknown (модал скажет «verify ownership first») — UX-choice; проверим модал-ошибку
  ok("unknown asset sellable-button present (modal guards)", unknownSell === 1);
  await evalJS(`[...document.querySelectorAll('#assets-tbody tr')].find(r => r.textContent.includes('Mystery coins')).querySelector('[data-sell]').click()`);
  await evalJS(`
    document.getElementById('s-date').value = '2025-05-01';
    document.getElementById('s-net').value = '400';
    document.getElementById('form-sale').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("unknown sale blocked with verify message", (await evalJS("document.getElementById('serr-general').textContent")).includes("Verify"));

  console.log(`\n${passed} passed, ${failed} failed`);
  await send("Target.closeTarget", { targetId: ti });
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log("FATAL:", e.message.slice(0, 300)); process.exit(2); });
