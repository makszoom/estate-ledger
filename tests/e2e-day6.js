
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

  // estate + asset + tx
  await evalJS(`
    document.getElementById('btn-create-first').click();
    document.getElementById('f-decedent').value = 'Export E2E';
    document.getElementById('f-state').value = 'TX';
    document.getElementById('f-dod').value = '2025-01-15';
    document.getElementById('form-estate').dispatchEvent(new Event('submit', {cancelable:true}));
    document.querySelector('[data-tab=assets]').click();
    document.getElementById('a-name').value = 'Land parcel';
    document.getElementById('a-class').value = 'real_estate';
    document.getElementById('a-value').value = '50000';
    document.getElementById('a-probate').value = 'no';
    document.getElementById('form-asset').dispatchEvent(new Event('submit', {cancelable:true}));
    document.querySelector('[data-tab=ledger]').click();
    document.getElementById('t-date').value = '2025-02-01';
    document.getElementById('t-kind').value = 'money_in';
    document.getElementById('t-kind').dispatchEvent(new Event('change'));
    document.getElementById('t-amount').value = '300';
    document.getElementById('t-acct').value = 'income';
    document.getElementById('t-desc').value = 'Interest';
    document.getElementById('form-tx').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  const backupJSON = await evalJS("localStorage.getItem('el_state')");
  ok("backup JSON non-empty", (backupJSON || '').length > 200, 'len ' + (backupJSON || '').length);

  // export tab
  await evalJS(`document.querySelector('[data-tab=export]').click()`);
  ok("export panel active", await evalJS("document.getElementById('panel-export').classList.contains('active')"));
  ok("3 export cards", (await evalJS("document.querySelectorAll('#panel-export .exp-card').length")) === 3);

  // JSON download button wired (click triggers download; verify via stub)
  await evalJS(`
    window.__dl = [];
    const origBlob = URL.createObjectURL;
    URL.createObjectURL = (b) => { window.__dl.push(b.size); return 'blob:stub'; };
    URL.revokeObjectURL = () => {};
  `);
  await evalJS(`document.getElementById('btn-json-download').click()`);
  ok("json download fired", (await evalJS("window.__dl.length")) === 1);
  ok("json size > 200 bytes", (await evalJS("window.__dl[0]")) > 200);

  // CSV downloads
  await evalJS("window.__dl = []");
  await evalJS(`document.getElementById('btn-csv-totals').click()`);
  await evalJS(`document.getElementById('btn-csv-assets').click()`);
  await evalJS(`document.getElementById('btn-csv-ledger').click()`);
  ok("3 csv downloads fired", (await evalJS("window.__dl.length")) === 3, 'got ' + await evalJS("window.__dl.length"));

  // restore: simulate import through store API directly (file picker not scriptable)
  const restored = await evalJS(`
    (function(){
      const jsonStr = localStorage.getItem('el_state');
      // wipe
      localStorage.removeItem('el_state');
      // re-import via core
      const s = new window.EstateLedgerCore.Store();
      const r = s.importState(jsonStr);
      return { ok: r.ok, estates: Object.keys(s.state.estates).length, dec: s.getActive() && s.getActive().decedent };
    })()
  `);
  ok("restore via core: ok", restored.ok === true, JSON.stringify(restored));
  ok("restore: 1 estate", restored.estates === 1);
  ok("restore: decedent", restored.dec === 'Export E2E');

  // garbage rejected
  const garbage = await evalJS(`
    (function(){
      const s = new window.EstateLedgerCore.Store();
      const r1 = s.importState('{bad{');
      const r2 = s.importState('{"foo":1}');
      return { g1: r1.ok, g2: r2.ok };
    })()
  `);
  ok("garbage rejected", garbage.g1 === false && garbage.g2 === false, JSON.stringify(garbage));

  // banner dismiss + backup-reminder update
  await evalJS(`document.querySelector('[data-tab=setup]').click()`);
  const bannerShown = await evalJS("!document.getElementById('backup-banner').classList.contains('show')");
  ok("banner not shown for fresh estate (lastBackupReminder today)", bannerShown, 'banner state: ' + bannerShown);

  console.log(`\n${passed} passed, ${failed} failed`);
  await send("Target.closeTarget", { targetId: ti });
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log("FATAL:", e.message.slice(0, 300)); process.exit(2); });
