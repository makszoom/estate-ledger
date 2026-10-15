
const WebSocket = require("C:/Users/MiniPC/Projects/estate-ledger/node_modules/ws");
const PORT = 9333;
let passed = 0, failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log("  \u2713", name); }
  else { failed++; console.log("  \u2717", name, extra || ""); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let mid = 0;
const pending = new Map();
let ws;
function send(method, params, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++mid;
    pending.set(id, { resolve, reject });
    const msg = { id, method, params: params || {} };
    if (sessionId) msg.sessionId = sessionId;
    ws.send(JSON.stringify(msg));
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error("timeout: " + method)); }
    }, 10000);
  });
}

(async () => {
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  ws = new WebSocket(ver.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  ws.on("message", (m) => {
    const d = JSON.parse(m);
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id); pending.delete(d.id);
      if (d.error) p.reject(new Error(d.error.message)); else p.resolve(d);
    }
  });
  await new Promise(res => ws.on("open", res));
  await sleep(200);

  // create target for app.html
  const created = await send("Target.createTarget", { url: "file:///C:/Users/MiniPC/Projects/estate-ledger/site/app.html" });
  const targetId = created.result.targetId;
  const attached = await send("Target.attachToTarget", { targetId, flatten: true });
  const sessionId = attached.result.sessionId;
  await sleep(500);

  const evalJS = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
    return r.result.result.value;
  };

  await evalJS("localStorage.clear()");
  await send("Page.enable", {}, sessionId);
  await send("Page.reload", {}, sessionId);
  await sleep(900);
  ok("page title", (await evalJS("document.title")).includes("Ledger"));
  ok("empty state visible", await evalJS("!document.getElementById('setup-empty').hidden && document.getElementById('setup-form').hidden"));

  await evalJS("document.getElementById('btn-create-first').click()");
  ok("form shown after create", await evalJS("!document.getElementById('setup-form').hidden"));
  await evalJS(`
    document.getElementById('f-decedent').value = 'John A. Marshal';
    document.getElementById('f-case').value = '26-P-0814';
    document.getElementById('f-state').value = 'CA';
    document.getElementById('f-role').value = 'executor';
    document.getElementById('f-dod').value = '2025-01-15';
  `);
  await evalJS(`document.getElementById('form-estate').dispatchEvent(new Event('submit', {cancelable:true}))`);
  ok("saved", (await evalJS('document.getElementById("btn-save-estate").textContent')).includes("Saved"));
  ok("persisted 1 estate", (await evalJS('Object.keys(JSON.parse(localStorage.getItem("el_state")).estates).length')) === 1);
  ok("active decedent", (await evalJS('JSON.parse(localStorage.getItem("el_state")).estates[JSON.parse(localStorage.getItem("el_state")).activeEstateId].decedent')) === "John A. Marshal");

  await evalJS(`
    document.getElementById('f-decedent').value = '';
    document.getElementById('form-estate').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("invalid shows error", await evalJS("document.getElementById('err-decedent').classList.contains('show')"));
  ok("invalid: still 1 estate", (await evalJS('Object.keys(JSON.parse(localStorage.getItem("el_state")).estates).length')) === 1);

  await evalJS(`
    document.getElementById('f-decedent').value = 'John A. Marshal';
    document.getElementById('form-estate').dispatchEvent(new Event('submit', {cancelable:true}));
  `);
  ok("update path saved", (await evalJS('document.getElementById("btn-save-estate").textContent')).includes("Saved"));

  ok("switcher 1 option", (await evalJS('document.getElementById("estate-select").options.length')) === 1);

  await evalJS("document.getElementById('btn-delete-estate').click()");
  ok("delete modal open", await evalJS("document.getElementById('modal-delete').classList.contains('open')"));
  await evalJS("document.getElementById('btn-confirm-delete').click()");
  ok("storage cleared", (await evalJS('Object.keys(JSON.parse(localStorage.getItem("el_state")).estates).length')) === 0);
  ok("empty state back", await evalJS("!document.getElementById('setup-empty').hidden"));

  console.log(`\n${passed} passed, ${failed} failed`);
  await send("Target.closeTarget", { targetId });
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log("FATAL:", e.message.slice(0, 300)); process.exit(2); });
