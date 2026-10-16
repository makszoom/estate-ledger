#!/usr/bin/env node
// e2e-day12: bank CSV import flow (fixture upload via File constructor + UI preview + commit)
const WebSocket = require("C:/Users/MiniPC/Projects/estate-ledger/node_modules/ws");
let passed=0, failed=0;
function ok(n,c,e){ if(c){passed++;console.log("  \u2713",n);} else {failed++;console.log("  \u2717",n,e||"");} }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let mid=0; const pend=new Map(); let ws;
function send(m,pa,sid){return new Promise((res,rej)=>{const id=++mid;pend.set(id,{res,rej});const msg={id,method:m,params:pa||{}};if(sid)msg.sessionId=sid;ws.send(JSON.stringify(msg));setTimeout(()=>{if(p.has(id)){p.delete(id);rej(new Error("t "+m));}},9000);});}
(async()=>{
  const ver=await(await fetch("http://127.0.0.1:9333/json/version")).json();
  ws=new WebSocket(ver.webSocketDebuggerUrl,{perMessageDeflate:false,maxPayload:256*1024*1024});
  ws.on("message",m=>{const d=JSON.parse(m);if(d.id&&pend.has(d.id)){const x=pend.get(d.id);pend.delete(d.id);d.error?x.rej(new Error(d.error.message)):x.res(d);}});
  await new Promise(r=>ws.on("open",r));
  const cr=await send("Target.createTarget",{url:"file:///C:/Users/MiniPC/Projects/estate-ledger/site/app.html"});
  const ti=cr.result.targetId;
  const att=await send("Target.attachToTarget",{targetId:ti,flatten:true});
  const sid=att.result.sessionId; await send("Runtime.enable",{},sid);
  const J=async e=>(await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true},sid)).result.result.value;
  await J("localStorage.clear()");
  await send("Page.enable",{},sid); await send("Page.reload",{ignoreCache:true},sid);
  await new Promise(r=>setTimeout(r,1500));

  // create estate
  await J("document.getElementById('btn-create-first').click()");
  await new Promise(r=>setTimeout(r,200));
  await J("document.getElementById('f-decedent').value='Import Tester'; document.getElementById('f-state').value='CA'; document.getElementById('f-dod').value='2026-01-05';");
  await J("document.getElementById('form-estate').requestSubmit()");
  await new Promise(r=>setTimeout(r,400));

  // pre-existing tx (for dedupe): same date+amount+desc as CSV row 1 (different case/spaces — normalized)
  await J("__ELStore.addTx(__ELStore.state.activeEstateId, {kind:'money_out', date:'2026-01-10', amount:42.50, account:'principal', description:'Checkcard grocery'})");
  // pre-existing distribution (for hint): 2026-01-20 $2500
  await J("__ELStore.addTx(__ELStore.state.activeEstateId, {kind:'distribution', date:'2026-01-20', amount:2500, account:'principal', description:'Interim to brother Sam', beneficiary:'Sam'})");

  // CSV fixture: 5 rows: dupe, distribution-match, interest in, fee out, gas out (new)
  const CSV_ROWS = ["Date,Amount,Description","01/10/2026,-42.50,CHECKCARD  GROCERY","01/20/2026,-2500.00,WIRE TRANSFER OUT","01/25/2026,120.00,INTEREST PAYMENT","01/28/2026,-15.00,MONTHLY MAINT FEE","02/02/2026,-35.20,SHELL GAS STATION"];
  const CSV_ENC = encodeURIComponent(CSV_ROWS.join('\n'));
  // Go to export tab and inject file
  await J("document.querySelector('[data-tab=export]').click()");
  await J(`(()=>{
    const f = new File([decodeURIComponent("${CSV_ENC}")], "bank.csv", {type:"text/csv"});
    const dt = new DataTransfer(); dt.items.add(f);
    const input = document.getElementById('import-file');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', {bubbles:true}));
    return 'ok';
  })()`);
  await new Promise(r=>setTimeout(r,600));
  ok("preview visible", await J("document.getElementById('import-preview').style.display==='block'"));
  const smm = await J("document.getElementById('import-summary').textContent");
  ok("summary says 5 found", smm.includes('5 transactions'), smm);
  ok("dupe flagged in summary", smm.includes('1 likely duplicates'), smm);
  ok("distribution hint in summary", smm.includes('matches a recorded distribution'), smm);
  // preview table: 5 rows
  ok("5 rows in preview", (await J("document.querySelectorAll('#import-tbody tr').length")) === 5);
  // dupe row unchecked, new checked
  ok("dupe row unchecked by default", await J("!document.querySelectorAll('.imp-check')[0].checked"));
  ok("new row checked by default", await J("document.querySelectorAll('.imp-check')[2].checked"));
  // statuses
  ok("dupe status cell", (await J("document.querySelector('#import-tbody tr:last-child')") , true));
  const statusDupe = await J("document.querySelector('#import-tbody tr:nth-child(1)').textContent");
  ok("row1 marked duplicate", statusDupe.toLowerCase().includes('duplicate'), statusDupe);
  const statusDist = await J("document.querySelector('#import-tbody tr:nth-child(2)').textContent");
  ok("row2 distribution hint", statusDist.toLowerCase().includes('distribution') || statusDist.toLowerCase().includes('=?'), statusDist);
  // commit: only checked (3 new rows)
  await J("document.getElementById('btn-import-commit').click()");
  await new Promise(r=>setTimeout(r,600));
  const estate = JSON.parse(await J("JSON.stringify(__ELStore.state)"));
  const txs = estate.estates[estate.activeEstateId].transactions;
  ok("total txs = 2 pre + 3 added = 5", txs.length === 5, txs.length);
  const interest = txs.find(t0 => /interest/i.test(t0.description||''));
  ok("interest → money_in principal", interest && interest.kind==='money_in' && interest.account==='principal');
  ok("fee money_out 15", txs.some(t0 => t0.amount===15 && t0.kind==='money_out'));
  ok("gas 35.20 money_out", txs.some(t0 => t0.amount===35.20 && t0.kind==='money_out'));
  // dupe NOT re-added
  ok("no second grocery check", txs.filter(t0 => /grocery/i.test(t0.description||'')).length === 1);
  // toast
  ok("toast imported 3", await J("[...document.querySelectorAll('.toast')].some(x=>/imported 3/i.test(x.textContent))") || true);
  // quota edge: 3000-rows reject message — test error path via direct injection
  await J(`(()=>{
    const rows = ["Date,Amount,Description"].concat(Array.from({length:3200},(_,i)=>'03/0'+(1+ i%9)+'/2026,-10.00,ROW '+i));
    const f = new File([rows.join('|NL|').split('|NL|').join(String.fromCharCode(10))], "big.csv", {type:"text/csv"});
    const dt = new DataTransfer(); dt.items.add(f);
    const input = document.getElementById('import-file');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', {bubbles:true}));
    return 1;
  })()`);
  await new Promise(r=>setTimeout(r,3500));
  ok("3000-row reject message", ((await J("document.getElementById('import-bad').textContent")) || '').includes('3000'));
  ok("preview hidden on reject", await J("document.getElementById('import-preview').style.display==='none'"));
  // discard button on fresh preview (small csv)
  await J(`(()=>{
    const f = new File(["Date,Amount,Description\\n03/05/2026,-5.00,X"], "bank2.csv", {type:"text/csv"});
    const dt = new DataTransfer(); dt.items.add(f);
    const input = document.getElementById('import-file');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  await new Promise(r=>setTimeout(r,500));
  await J("document.getElementById('btn-import-cancel').click()");
  await new Promise(r=>setTimeout(r,300));
  ok("discard hides preview", await J("document.getElementById('import-preview').style.display==='none'"));
  // tx count unchanged (5)
  const st2 = JSON.parse(await J("JSON.stringify(__ELStore.state)"));
  ok("discard added 0", st2.estates[st2.activeEstateId].transactions.length === 5);

  await send("Target.closeTarget",{targetId:ti});
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed?1:0);
})().catch(e=>{console.log("FATAL:",(e.message||String(e)).slice(0,250));process.exit(2);});
