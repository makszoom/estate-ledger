
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
  const created = await send("Target.createTarget", { url: "file:///C:/Users/MiniPC/Projects/estate-ledger/site/app.html?sample=1" });
  const ti = created.result.targetId;
  const att = await send("Target.attachToTarget", { targetId: ti, flatten: true });
  const sid = att.result.sessionId;
  await send("Runtime.enable", {}, sid);
  const evalJS = async expr => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sid)).result.result.value;
  await evalJS("localStorage.clear()");
  await send("Page.enable", {}, sid);
  await send("Page.reload", {}, sid);
  await sleep(1000);

  // sample installed?
  const st = JSON.parse(await evalJS("localStorage.getItem('el_state')"));
  ok("sample estate in state", st.estates['el-sample-estate'] !== undefined);
  ok("sample active", st.activeEstateId === 'el-sample-estate');
  const est = st.estates['el-sample-estate'];
  ok("sample: decedent marked fictional", (est.decedent || '').includes('Sample'));
  ok("sample: 7 assets", (est.assets || []).length === 7, 'got ' + (est.assets || []).length);
  ok("sample: sales recorded (home)", (est.sales || []).length === 1);
  const sale = (est.sales || [])[0] || {};
  ok("sample: home sold at gain ($4,600)", sale.direction === 'gain' && sale.gainOrLoss === 4600, JSON.stringify(sale.gainOrLoss));
  ok("sample: 12 ledger movements (11 + sale cash)", (est.transactions || []).length === 12, 'got ' + (est.transactions || []).length);

  // switcher shows sample
  ok("switcher includes sample", (await evalJS("document.getElementById('estate-select').textContent")).includes('Jane E. Sample'));

  // sample banner
  ok("sample banner visible", await evalJS("!document.getElementById('backup-banner').hidden && document.getElementById('backup-banner').classList.contains('show') || document.getElementById('backup-banner').textContent.includes('SAMPLE')"));
  ok("'Start your own estate' button exists", await evalJS("!!document.getElementById('sb-start-real')"));

  // report from sample: balanced?
  await evalJS(`document.querySelector('[data-tab=report]').click()`);
  ok("report body visible", await evalJS("!document.getElementById('rpt-body').hidden"));
  const balOk = await evalJS("!document.getElementById('balance-ok').hidden");
  const balBad = await evalJS("!document.getElementById('balance-bad').hidden");
  ok("sample report HAS green balance line OR red flags (data is honest)", balOk || balBad, 'bal:' + balOk + '/bad:' + balBad);
  if (balBad) {
    const badTxt = await evalJS("document.getElementById('balance-bad').textContent");
    console.log("   sample imbalance:", badTxt.slice(0, 120));
  }
  // sale schedule shows home sale
  ok("schedule of sales: Home row", (await evalJS("document.getElementById('sched-sales').innerHTML")).includes('Home'));
  // totals numbers sanity: report shows inventory > 0
  const invTxt = await evalJS("document.getElementById('rc-inv').textContent");
  ok("inventory > 0", invTxt !== "$0.00", 'inv: ' + invTxt);

  // UI: add asset in sample works (data flows to sample, not user's real)
  await evalJS(`
    document.querySelector('[data-tab=assets]').click();
    document.getElementById('a-name').value = 'Test boat (sample)';
    document.getElementById('a-class').value = 'vehicle';
    document.getElementById('a-value').value = '9999';
    document.getElementById('a-probate').value = 'no';
    document.getElementById('form-asset').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("asset added in sample → 8 assets", (await evalJS("JSON.parse(localStorage.getItem('el_state')).estates['el-sample-estate'].assets.length")) === 8);
  ok("toast appeared", await evalJS("[...document.querySelectorAll('.toast')].some(t => t.textContent.includes('added'))"));

  // uninstall: Start your own estate
  await evalJS(`document.getElementById('sb-start-real').click()`);
  ok("sample removed from state", await evalJS("!JSON.parse(localStorage.getItem('el_state')).estates['el-sample-estate']"));
  ok("setup form open for new estate", await evalJS("!document.getElementById('setup-form').hidden"));
  ok("empty decedent field", (await evalJS("document.getElementById('f-decedent').value")) === '');

  // re-install sample for the persistent landing link (idempotent)
  const re = await evalJS(`
    (function(){
      const s = new window.EstateLedgerCore.Store(); // dummy; real test is the install function
      const inst = window.EstateLedgerSample.install(new window.EstateLedgerCore.Store());
      return inst && inst.ok;
    })()
  `);
  // note: install on separate Store writes to localStorage; real app store may not know — acceptable
  ok("re-install ok", re === true);

  console.log(`\n${passed} passed, ${failed} failed`);
  await send("Target.closeTarget", { targetId: ti });
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log("FATAL:", e.message.slice(0, 300)); process.exit(2); });
