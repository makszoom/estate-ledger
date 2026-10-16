
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
  await evalJS("localStorage.clear()");
  await send("Page.enable", {}, sid);
  await send("Page.reload", {}, sid);
  await sleep(900);

  // estate
  await evalJS(`
    document.getElementById('btn-create-first').click();
    document.getElementById('f-decedent').value = 'Ledger E2E';
    document.getElementById('f-state').value = 'CA';
    document.getElementById('f-role').value = 'executor';
    document.getElementById('f-dod').value = '2025-01-15';
    document.getElementById('form-estate').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  await evalJS(`document.querySelector('[data-tab=ledger]').click()`);
  ok("ledger panel active", await evalJS("document.getElementById('panel-ledger').classList.contains('active')"));
  ok("empty visible", await evalJS("!document.getElementById('tx-empty').hidden"));

  // 1: money_in income — hint appears on kind change
  await evalJS(`
    document.getElementById('t-kind').value = 'money_in';
    document.getElementById('t-kind').dispatchEvent(new Event('change'));
  `);
  ok("kind hint shown", await evalJS("!document.getElementById('kind-hint').hidden"));
  ok("hint text: estate received", (await evalJS("document.getElementById('kind-hint').textContent")).includes("received"));

  // distribution hides payee-group? нет: payee shown; beneficiary shown only for distribution
  await evalJS(`
    document.getElementById('t-kind').value = 'distribution';
    document.getElementById('t-kind').dispatchEvent(new Event('change'));
  `);
  ok("beneficiary group shows on distribution", await evalJS("!document.getElementById('group-beneficiary').hidden"));

  await evalJS(`
    document.getElementById('t-date').value = '2025-04-02';
    document.getElementById('t-amount').value = '5,000';
    document.getElementById('t-acct').value = 'principal';
    document.getElementById('t-desc').value = 'Cash to heir';
    document.getElementById('t-benef').value = 'Alice Marshal';
    document.getElementById('form-tx').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("distribution added (1 row)", (await evalJS("document.getElementById('tx-tbody').rows.length")) === 1);
  ok("benef shown in row-sub", (await evalJS("document.getElementById('tx-tbody').innerHTML")).includes("Alice Marshal"));
  ok("p-distr $5,000.00", (await evalJS("document.getElementById('p-distr').textContent")) === "$5,000.00");
  ok("p-cash -$5,000.00", (await evalJS("document.getElementById('p-cash').textContent")) === "-$5,000.00");

  // 2: pre-DOD rejection
  await evalJS(`
    document.getElementById('t-date').value = '2024-01-01';
    document.getElementById('t-kind').value = 'money_in';
    document.getElementById('t-kind').dispatchEvent(new Event('change'));
    document.getElementById('t-amount').value = '100';
    document.getElementById('t-desc').value = 'Too early income';
    document.getElementById('form-tx').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("pre-DOD rejected with message", (await evalJS("document.getElementById('terr-date').textContent")).includes("before the date of death"));

  // 3: vague description rejection
  await evalJS(`
    document.getElementById('t-date').value = '2025-03-06';
    document.getElementById('t-desc').value = 'check';
    document.getElementById('form-tx').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("vague desc rejected", (await evalJS("document.getElementById('terr-desc').textContent")).includes("vague"));

  // 4: reimbursable без payee
  await evalJS(`
    document.getElementById('t-date').value = '2025-04-09';
    document.getElementById('t-kind').value = 'reimbursable';
    document.getElementById('t-kind').dispatchEvent(new Event('change'));
    document.getElementById('t-desc').value = 'Executor mileage';
    document.getElementById('t-amount').value = '86.20';
    document.getElementById('t-payee').value = '';
    document.getElementById('form-tx').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("reimbursable needs payee", (await evalJS("document.getElementById('terr-payee').textContent")).includes("Who paid"));

  // 5: valid reimbursable + incomes
  await evalJS(`
    document.getElementById('t-payee').value = 'Executor (self)';
    document.getElementById('form-tx').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("reimbursable added (2 rows)", (await evalJS("document.getElementById('tx-tbody').rows.length")) === 2);
  ok("p-reimb $86.20", (await evalJS("document.getElementById('p-reimb').textContent")) === "$86.20");
  // reimbursable не ВЫЧИТАЕТСЯ из cash (future claim)
  ok("cash still -5,000 (reimbursable not deducted)", (await evalJS("document.getElementById('p-cash').textContent")) === "-$5,000.00");

  await evalJS(`
    document.getElementById('t-date').value = '2025-03-04';
    document.getElementById('t-kind').value = 'money_in';
    document.getElementById('t-kind').dispatchEvent(new Event('change'));
    document.getElementById('t-amount').value = '312.04';
    document.getElementById('t-acct').value = 'income';
    document.getElementById('t-desc').value = 'Estate bank interest';
    document.getElementById('form-tx').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("3 rows", (await evalJS("document.getElementById('tx-tbody').rows.length")) === 3);
  ok("i-in $312.04 / i-cash $312.04", (await evalJS("document.getElementById('i-cash').textContent")) === "$312.04");

  // chronological: Mar 04 first
  ok("chronological order (Mar first)", (await evalJS("document.querySelector('#tx-tbody tr td').textContent")) === "2025-03-04");

  // edit: change amount 312.04 → 400
  // edit prefills: выбрать row с 'Estate bank interest' явно (хронология: не последнее)
  await evalJS(`[...document.querySelectorAll('[data-edit-tx]')].find(b => b.closest('tr').textContent.includes('Estate bank interest')).click()`);
  ok("edit prefills desc", (await evalJS("document.getElementById('t-desc').value")) === "Estate bank interest");
  await evalJS(`
    document.getElementById('t-amount').value = '400';
    document.getElementById('form-tx').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("i-in updated $400.00", (await evalJS("document.getElementById('i-in').textContent")) === "$400.00");

  // delete reimbursable row
  const nBefore = await evalJS("document.getElementById('tx-tbody').rows.length");
  await evalJS(`[...document.querySelectorAll('[data-del-tx]')].find(b => b.closest('tr').textContent.includes('Executor mileage')).click()`);
  ok("deleted → 2 rows", (await evalJS("document.getElementById('tx-tbody').rows.length")) === Number(nBefore) - 1);
  ok("p-reimb cleared", (await evalJS("document.getElementById('p-reimb').textContent")) === "$0.00");

  // persist reload
  await send("Page.reload", {}, sid);
  await sleep(900);
  ok("2 tx persist after reload", (await evalJS("JSON.parse(localStorage.getItem('el_state')).estates[JSON.parse(localStorage.getItem('el_state')).activeEstateId].transactions.length")) === 3 - 1);

  console.log(`\n${passed} passed, ${failed} failed`);
  await send("Target.closeTarget", { targetId: ti });
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log("FATAL:", e.message.slice(0, 300)); process.exit(2); });
