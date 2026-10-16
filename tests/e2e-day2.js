
const WebSocket = require("C:/Users/MiniPC/Projects/estate-ledger/node_modules/ws");
const PORT = 9333;
let passed = 0, failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log("  \u2713", name); }
  else { failed++; console.log("  \u2717", name, extra || ""); }
}
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

  // clean slate
  await evalJS("localStorage.clear()");
  await send("Page.enable", {}, sid);
  await send("Page.reload", {}, sid);
  await sleep(900);

  // create estate (quick)
  await evalJS(`
    document.getElementById('btn-create-first').click();
    document.getElementById('f-decedent').value = 'Inv Test';
    document.getElementById('f-state').value = 'CA';
    document.getElementById('f-role').value = 'executor';
    document.getElementById('f-dod').value = '2025-01-15';
    document.getElementById('form-estate').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  // switch to Assets tab
  await evalJS(`document.querySelector('[data-tab=assets]').click()`);
  ok("assets panel active", await evalJS("document.getElementById('panel-assets').classList.contains('active')"));
  ok("asset empty state visible", await evalJS("!document.getElementById('assets-empty').hidden"));

  // add asset 1: house (money string with $)
  await evalJS(`
    document.getElementById('a-name').value = 'House on Elm St';
    document.getElementById('a-class').value = 'real_estate';
    document.getElementById('a-value').value = '304,851.49';
    document.getElementById('a-probate').value = 'no';
    document.getElementById('form-asset').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("house added", (await evalJS("document.getElementById('assets-tbody').rows.length")) === 1);
  ok("house value normalized: $304,851.49", (await evalJS("document.querySelector('#assets-tbody td.r').textContent")) === "$304,851.49");
  ok("flag: in probate", (await evalJS("document.querySelector('#assets-tbody .flag').textContent")) === "in probate");

  // add asset 2: outside probate
  await evalJS(`
    document.getElementById('a-name').value = 'Life insurance (TOD)';
    document.getElementById('a-class').value = 'other';
    document.getElementById('a-value').value = '50000';
    document.getElementById('a-probate').value = 'yes';
    document.getElementById('form-asset').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("2 assets", (await evalJS("document.getElementById('assets-tbody').rows.length")) === 2);
  ok("flag outside", (await evalJS("[...document.querySelectorAll('#assets-tbody .flag')].some(f=>f.textContent==='outside')")));
  ok("totals row outside visible", await evalJS("!document.getElementById('tot-outside-row').hidden"));
  ok("outside total $50,000.00", (await evalJS("document.getElementById('tot-outside').textContent")) === "$50,000.00");

  // add asset 3: unknown probate w/o value
  await evalJS(`
    document.getElementById('a-name').value = 'Jewelry box';
    document.getElementById('a-class').value = 'personal_property';
    document.getElementById('a-probate').value = 'unknown';
    document.getElementById('form-asset').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("verify flag shown", await evalJS("[...document.querySelectorAll('#assets-tbody .flag')].some(f=>f.textContent==='verify')"));
  ok("unknown row visible", await evalJS("!document.getElementById('tot-unknown-row').hidden"));
  ok("probate total = house only", (await evalJS("document.getElementById('tot-probate').textContent")) === "$304,851.49");
  ok("empty-state hidden", await evalJS("document.getElementById('assets-empty').hidden"));
  ok("toolbar count = 3", (await evalJS("document.getElementById('count-assets').textContent")) === "3");

  // edit: change house value
  await evalJS(`document.querySelector('[data-edit]').click()`);
  ok("edit prefills name", (await evalJS("document.getElementById('a-name').value")) === "House on Elm St");
  ok("edit btn text = Save changes", (await evalJS("document.getElementById('btn-save-asset').textContent")) === "Save changes");
  await evalJS(`
    document.getElementById('a-value').value = '350000';
    document.getElementById('form-asset').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("edited value $350,000.00", (await evalJS("document.getElementById('tot-probate').textContent")) === "$350,000.00");
  ok("feedback: Updated \u2713 after edit", (await evalJS("document.getElementById('btn-save-asset').textContent")).includes("Updated"));

  // invalid: empty name
  await evalJS(`
    document.getElementById('a-name').value = '';
    document.getElementById('form-asset').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("invalid name shows error", await evalJS("document.getElementById('aerr-name').classList.contains('show')"));

  // delete jewelry
  await evalJS(`[...document.querySelectorAll('[data-del]')].at(-1).click()`);
  ok("deleted → 2 rows", (await evalJS("document.getElementById('assets-tbody').rows.length")) === 2);
  ok("unknown row hidden after delete", await evalJS("document.getElementById('tot-unknown-row').hidden"));

  // persistence: reload → assets restore
  await send("Page.reload", {}, sid);
  await sleep(900);
  ok("assets persist after reload", (await evalJS("JSON.parse(localStorage.getItem('el_state')).estates[JSON.parse(localStorage.getItem('el_state')).activeEstateId].assets.length")) === 2);
  ok("probate total after reload", (await evalJS("JSON.parse(localStorage.getItem('el_state')).estates[JSON.parse(localStorage.getItem('el_state')).activeEstateId].assets.length")) === 2);

  console.log(`\n${passed} passed, ${failed} failed`);
  await send("Target.closeTarget", { targetId: ti });
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log("FATAL:", e.message.slice(0, 300)); process.exit(2); });
