#!/usr/bin/env node
// e2e-day18: multi-estate dashboard (3+ estates, archive/restore, open, show-archived)
const WebSocket = require("C:/Users/MiniPC/Projects/estate-ledger/node_modules/ws");
let passed=0, failed=0;
function ok(n,c,e){ if(c){passed++;console.log("  \u2713",n);} else {failed++;console.log("  \u2717",n,e||"");} }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let mid=0; const pend=new Map(); let ws;
function send(m,pa,sid){return new Promise((res,rej)=>{const id=++mid;pend.set(id,{res,rej});const msg={id,method:m,params:pa||{}};if(sid)msg.sessionId=sid;ws.send(JSON.stringify(msg));setTimeout(()=>{if(pend.has(id)){pend.delete(id);rej(new Error("t "+m));}},9000);});}
(async()=>{
  const ver=await(await fetch("http://127.0.0.1:9333/json/version")).json();
  ws=new WebSocket(ver.webSocketDebuggerUrl,{perMessageDeflate:false,maxPayload:256*1024*1024});
  ws.on("message",m=>{const d=JSON.parse(m);if(d.id&&pend.has(d.id)){const x=pend.get(d.id);pend.delete(d.id);d.error?x.rej(new Error(d.error.message)):x.res(d);}});
  await new Promise(r=>ws.on("open",r));
  const cr=await send("Target.createTarget",{url:"file:///C:/Users/MiniPC/Projects/estate-ledger/site/app.html"});
  const ti=cr.result.targetId;
  const att=await send("Target.attachToTarget",{targetId:ti,flatten:true});
  const sid=att.result.sessionId; await send("Runtime.enable",{},sid);
  const J=async e=>(await send("Runtime.evaluate",{expression:e,returnByValue:true},sid)).result.result.value;
  await J("localStorage.clear()");
  await send("Page.enable",{},sid); await send("Page.reload",{ignoreCache:true},sid);
  await new Promise(r=>setTimeout(r,1500));
  // live-safety: state may survive (localStorage partition) — force clean until 0
  for (let k=0;k<4;k++){
    const cnt = await J("(function(){try{return Object.keys(JSON.parse(localStorage.getItem('el_state')||'{}').estates||{}).length;}catch(e){return 0;}})()");
    if (!cnt) break;
    await J("localStorage.clear(); location.reload();");
    await new Promise(r=>setTimeout(r,1800));
  }
  const cnt0 = await J("(function(){try{return Object.keys(JSON.parse(localStorage.getItem('el_state')||'{}').estates||{}).length;}catch(e){return 0;}})()");
  ok("clean state at start", cnt0 === 0 || cnt0 === 'ERR' || !cnt0, 'got ' + cnt0);

  // create 3 estates via UI
  async function makeEstate(name, state){
    await J("document.getElementById('btn-create-first').click()");
    await sleep(150);
    await J(`document.getElementById('f-decedent').value='${name}'; document.getElementById('f-state').value='${state}'; document.getElementById('f-dod').value='2026-01-0${(name.length % 8) + 1}';`);
    await J(`document.getElementById('form-estate').requestSubmit()`);
    await sleep(350);
  }
  await makeEstate('Alpha A', 'CA');
  await makeEstate('Beta B', 'NY');
  await makeEstate('Gamma G', 'IL');
  ok("3 estates in state", Object.keys(JSON.parse(await J("JSON.stringify(__ELStore.state.estates)"))).length === 3);
  ok("dash-link visible at 3", await J("!document.getElementById('dash-link').hidden"));

  // open dashboard
  await J("document.getElementById('dash-link').click()");
  await sleep(400);
  ok("dash panel visible", await J("(function(){const p=document.getElementById('panel-dash'); return !p.hidden && getComputedStyle(p).display!=='none';})()"));
  ok("3 dash cards", (await J("document.querySelectorAll('.dash-card').length")) === 3);
  const first = await J("document.querySelector('.dash-card .h-name').textContent");
  ok("card shows decedent name", /Alpha|Beta|Gamma/.test(first), first);
  ok("days-since shown", /d/.test((await J("document.querySelector('.dash-card').textContent")) || ''));
  ok("next-action shown", (await J("document.querySelector('.dash-card .next').textContent")).length > 10);

  // archive the FIRST card's estate
  const idFirst = await J("document.querySelector('[data-archive]').dataset.archive");
  await J("document.querySelector('[data-archive]').click()");
  await sleep(400);
  ok("card count → 2 (archived hidden by default)", (await J("document.querySelectorAll('.dash-card').length")) === 2);
  ok("toast archived", await J("[...document.querySelectorAll('.toast')].some(x=>/archived/i.test(x.textContent))"));
  // archived estate not in switcher
  const selText = await J("JSON.stringify([...document.getElementById('estate-select').options].map(o=>o.textContent))");
  ok("archived absent from switcher", !selText.includes('Alpha A'), selText);
  // show archived → card is there + Restore
  await J("document.getElementById('dash-show-archived').click()");
  await sleep(300);
  ok("show archived shows 3", (await J("document.querySelectorAll('.dash-card').length")) === 3);
  ok("archived styled", await J("document.querySelector('.dash-card.archived') ? true : false"));
  // restore
  await J("document.querySelector('[data-unarchive]').click()");
  await sleep(300);
  ok("restored → 3 without archived", (await J("document.querySelectorAll('.dash-card').length")) === 3);
  ok("restored: no archived flag", !await J("!!document.querySelector('.dash-card.archived')"));
  // Open button switches active + shows setup of that estate
  await J("document.querySelector('[data-open-estate]').click()");
  await sleep(400);
  const st = JSON.parse(await J("JSON.stringify(__ELStore.state)"));
  ok("open: panel-dash closed", st && await J("document.getElementById('panel-dash').hidden"));
  ok("open: some panel active", await J("[...document.querySelectorAll('.panel')].some(p=>p.classList.contains('active') && p.id!=='panel-dash')"));

  // fewer than 3 → hidden link (archive 2 → 1 left)
  await J("document.getElementById('dash-link').click()");
  await sleep(300);
  await J("document.querySelector('[data-archive]').click()");
  await sleep(300);
  ok("2 archived → 1 active → link hidden", await J("document.getElementById('dash-link').hidden"));
  // unarchive both back
  await J("(()=>{const c=document.getElementById('dash-show-archived'); c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await sleep(250);
  for (let k=0;k<5;k++){
    const has = await J("!!document.querySelector('[data-unarchive]')");
    if (!has) break;
    const before = Object.values(JSON.parse(await J("JSON.stringify(__ELStore.state.estates)"))).filter(e=>e.archived).length;
    await J("document.querySelector('[data-unarchive]').click()");
    await sleep(300);
    const after = Object.values(JSON.parse(await J("JSON.stringify(__ELStore.state.estates)"))).filter(e=>e.archived).length;
    console.log("   unarchive iter " + k + ": archived " + before + "→" + after);
  }
  const stF = JSON.parse(await J("JSON.stringify(__ELStore.state.estates)"));
  const unarchived = Object.values(stF).filter(e=>!e.archived).length;
  console.log("   both-restored check: active=" + unarchived + " / total=" + Object.keys(stF).length);
  ok("both restored", unarchived === 3 && Object.keys(stF).length === 3, 'active='+unarchived+' total='+Object.keys(stF).length);

  await J("document.querySelector('.dash-card') && (()=>{document.querySelector('.dash-card').scrollIntoView({block:'start'});})()");
  await new Promise(r=>setTimeout(r,300));
  const s=(await send("Page.captureScreenshot",{format:"png"},sid)).result;
  require("fs").writeFileSync("C:/Users/MiniPC/Projects/estate-ledger/docs/landing/build-d18-dash.png", Buffer.from(s.data,"base64"));
  await send("Target.closeTarget",{targetId:ti});
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed?1:0);
})().catch(e=>{console.log("FATAL:",(e.message||String(e)).slice(0,250));process.exit(2);});
