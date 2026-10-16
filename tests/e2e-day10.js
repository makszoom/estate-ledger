#!/usr/bin/env node
// e2e-day10: print-emulation for carry report + final UI polish checks
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
  const cr = await send("Target.createTarget", { url: "file:///C:/Users/MiniPC/Projects/estate-ledger/site/app.html?sample=1" });
  const ti = cr.result.targetId;
  const att = await send("Target.attachToTarget", { targetId: ti, flatten: true });
  const sid = att.result.sessionId;
  await send("Runtime.enable", {}, sid);
  const evalJS = async expr => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sid)).result.result.value;
  await evalJS("localStorage.clear()");
  await send("Page.enable", {}, sid);
  await send("Page.reload", { ignoreCache: true }, sid);
  await sleep(1500);

  // 1. badge on carry sample report
  await evalJS(`document.querySelector('[data-tab=report]').click()`);
  await sleep(500);
  ok("carry badge wording", (await evalJS("document.getElementById('doc-basis-badge').textContent")).includes("Carry value"));
  ok("carry note visible on screen", await evalJS("document.getElementById('doc-basis-note').style.display === 'block'"));

  // 2. print emulation
  await send("Emulation.setEmulatedMedia", { features: [{ name: 'print' }] }, sid).catch(()=>{});
  // some chrome versions take media param; force via matchMedia check
  const printState = await evalJS(`(()=>{
    const badge = document.getElementById('doc-basis-badge');
    const note = document.getElementById('doc-basis-note');
    // read print stylesheet rules directly (reliable in headless without full print media)
    const rules = [];
    for (const sheet of document.styleSheets) {
      try { for (const r of sheet.cssRules) { if (r.media && r.media.mediaText.includes('print')) {
        for (const rr of r.cssRules) rules.push(rr.cssText); } } } catch(e){}
    }
    const printRules = rules.join(' ');
    return JSON.stringify({
      badgeHiddenInPrint: printRules.includes('.doc-basis-badge') && printRules.includes('display: none'),
      notePrinted: printRules.includes('.doc-basis-note') && printRules.includes('display: block'),
      screenBadgeVisible: getComputedStyle(badge).display !== 'none'
    });
  })()`);
  const ps = JSON.parse(printState);
  ok("print CSS: badge hidden", ps.badgeHiddenInPrint);
  ok("print CSS: carry note prints", ps.notePrinted);
  ok("badge visible on screen (digital)", ps.screenBadgeVisible);

  // 3. CSV basis line via Export panel? — core-level already unit-tested; check UI csv includes basis
  await send("Emulation.clearEmulatedMedia", {}, sid).catch(()=>{});
  await evalJS(`document.querySelector('[data-tab=export]').click()`);
  await sleep(300);
  const csvHas = await evalJS("__ELStore.csvReport(__ELStore.state.activeEstateId).includes('Accounting basis,carry')");
  ok("CSV export carries basis line", csvHas === true);

  // 4. screenshot: carry report with badge (vision-rev next)
  await evalJS(`document.querySelector('[data-tab=report]').click()`);
  await sleep(400);
  const shot = await send("Page.captureScreenshot", { format: "png" }, sid);
  require("fs").writeFileSync("C:/Users/MiniPC/Projects/estate-ledger/docs/landing/build-d10-carry-report.png", Buffer.from(shot.result.data, "base64"));
  const shot2 = await send("Page.captureScreenshot", { format: "png" }, sid);
  // setup with radio
  await evalJS(`document.querySelector('[data-tab=setup]').click()`);
  await sleep(300);
  const shot3 = await send("Page.captureScreenshot", { format: "png" }, sid);
  require("fs").writeFileSync("C:/Users/MiniPC/Projects/estate-ledger/docs/landing/build-d10-setup-basis.png", Buffer.from(shot3.result.data, "base64"));
  console.log("screenshots saved");

  await send("Target.closeTarget", { targetId: ti });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log("FATAL:", (e.message||String(e)).slice(0, 300)); process.exit(2); });
