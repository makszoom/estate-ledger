#!/usr/bin/env node
// e2e-day11: "My fee" module — statutory fee panel in Setup + record-as-expense
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
  const cr = await send("Target.createTarget", { url: "file:///C:/Users/MiniPC/Projects/estate-ledger/site/app.html" });
  const ti = cr.result.targetId;
  const att = await send("Target.attachToTarget", { targetId: ti, flatten: true });
  const sid = att.result.sessionId;
  await send("Runtime.enable", {}, sid);
  const evalJS = async expr => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sid)).result.result.value;
  await evalJS("localStorage.clear()");
  await send("Page.enable", {}, sid);
  await send("Page.reload", { ignoreCache: true }, sid);
  await sleep(1200);

  // create own estate: CA + value
  await evalJS(`document.getElementById('btn-create-first').click()`);
  await sleep(200);
  await evalJS(`
    document.getElementById('f-decedent').value = 'Fee Tester';
    document.getElementById('f-state').value = 'CA';
    document.getElementById('f-dod').value = '2026-01-05';
  `);
  await evalJS(`document.getElementById('form-estate').requestSubmit()`);
  await sleep(400);

  // add asset $1,000,000 (gross probate)
  await evalJS(`
    document.querySelector('[data-tab=assets]').click();
    document.getElementById('a-name').value = 'House (gross)';
    document.getElementById('a-class').value = 'real_estate';
    document.getElementById('a-value').value = '1000000';
    document.getElementById('a-probate').value = 'no';
    document.getElementById('form-asset').dispatchEvent(new Event('submit',{cancelable:true}));
  `);
  await sleep(350);

  // fee module appears in Setup
  await evalJS(`document.querySelector('[data-tab=setup]').click()`);
  await sleep(300);
  ok("fee panel exists", await evalJS("!!document.getElementById('fee-panel')"));
  ok("fee computed CA §10810 = $23,000", (await evalJS("document.getElementById('fee-amount').textContent")).includes('23,000'), await evalJS("document.getElementById('fee-amount').textContent"));
  ok("fee basis note shown (gross/mortgage warning)", ((await evalJS("document.getElementById('fee-note').textContent")).toLowerCase()).includes('gross'));
  ok("fee statute shown", ((await evalJS("document.getElementById('fee-statute').textContent")) || '').includes('10810'));

  // record as expense
  await evalJS(`document.getElementById('btn-fee-record').click()`);
  await sleep(400);
  const st = JSON.parse(await evalJS("JSON.stringify(__ELStore.state)"));
  const eid = st.activeEstateId;
  const feeTx = (st.estates[eid].transactions||[]).find(t0 => (t0.description||'').toLowerCase().includes('commission'));
  ok("fee tx created", !!feeTx, JSON.stringify((st.estates[eid].transactions||[]).map(t0=>t0.description)).slice(0,150));
  if (feeTx) {
    ok("fee tx is money_out principal", feeTx.kind === 'money_out' && feeTx.account === 'principal');
    ok("fee tx amount = 23000", feeTx.amount === 23000);
    ok("fee tx not vague", !!feeTx.description && feeTx.description.length > 20);
    ok("toast confirmation", await evalJS("[...document.querySelectorAll('.toast')].some(x=>x.textContent.toLowerCase().includes('commission'))"));
  }

  // reasonable-state UX: switch state to Iowa? IL not in schedule → reasonable panel
  await evalJS(`
    document.getElementById('f-state').value = 'IL';
    document.getElementById('form-estate').requestSubmit();
  `);
  await sleep(400);
  ok("reasonable panel for IL", ((await evalJS("document.getElementById('fee-note') ? document.getElementById('fee-note').textContent : ''")).toLowerCase()).includes('reasonable'));
  // record button disabled for reasonable states
  ok("record disabled for reasonable", await evalJS("document.getElementById('btn-fee-record').disabled"));

  // OH unsold realty checkbox affects fee (switch back to OH estate-level? just check presence of checkbox)
  await evalJS(`
    document.getElementById('f-state').value = 'OH';
    document.getElementById('form-estate').requestSubmit();
  `);
  await sleep(350);
  ok("OH realty checkbox exists", await evalJS("!!document.getElementById('fee-oh-realty')"));
  const feeNo = await evalJS("document.getElementById('fee-amount').textContent");
  await evalJS(`document.getElementById('fee-oh-realty').click()`);
  await sleep(300);
  const feeYes = await evalJS("document.getElementById('fee-amount').textContent");
  ok("OH +1% realty changes fee", feeNo !== feeYes, feeNo + ' → ' + feeYes);
  // assets: house 1M → OH base = 4%×100k+3%×100k+2%×300k = 4k+3k+6k=13k; +1%×1M=10k → 23k
  ok("OH fee = 25,000 → 35,000 with realty (§2113.35 span tiers)", feeNo.includes('25,000') && feeYes.includes('35,000'), feeNo + ' → ' + feeYes);

  await send("Target.closeTarget", { targetId: ti });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log("FATAL:", (e.message||String(e)).slice(0, 300)); process.exit(2); });
