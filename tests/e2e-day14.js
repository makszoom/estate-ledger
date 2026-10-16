#!/usr/bin/env node
// e2e-day14: CA companion worksheet (open, fields, GC-400 hint, print CSS, back)
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
  const cr=await send("Target.createTarget",{url:"file:///C:/Users/MiniPC/Projects/estate-ledger/site/app.html?sample=1"});
  const ti=cr.result.targetId;
  const att=await send("Target.attachToTarget",{targetId:ti,flatten:true});
  const sid=att.result.sessionId; await send("Runtime.enable",{},sid);
  const J=async e=>(await send("Runtime.evaluate",{expression:e,returnByValue:true},sid)).result.result.value;
  await J("localStorage.clear()");
  await send("Page.enable",{},sid);
  await send("Page.reload",{ignoreCache:true},sid);
  await new Promise(r=>setTimeout(r,1500));
  // sample installed (carry sample)
  ok("sample carry installed", (await J("JSON.parse(localStorage.getItem('el_state')).estates['el-sample-estate'].accountingBasis")) === "carry");
  // open Account tab → CA worksheet button
  await J("document.querySelector('[data-tab=account]').click()");
  await new Promise(r=>setTimeout(r,400));
  ok("CA worksheet button exists", await J("!!document.getElementById('btn-ca-worksheet')"));
  await J("document.getElementById('btn-ca-worksheet').click()");
  await new Promise(r=>setTimeout(r,400));
  ok("ws panel visible", await J("(function(){const p=document.getElementById('panel-ws'); return p.hidden===false && getComputedStyle(p).display!=='none';})()") !== false && await J("!document.getElementById('panel-ws').hidden"));
  ok("ws body rendered", (await J("document.getElementById('ws-body').innerHTML.length")) > 500);
  const body = await J("document.getElementById('ws-body').innerHTML");
  ok("badge GC-405 field order", body.includes('GC-405'));
  ok("NOT official form disclaimer", body.includes('companion worksheet') && body.includes('not an official court form'));
  ok("carry-value note present", /carry/i.test(body));
  ok("scope note: conservatorship/guardianship", body.includes('CONSERVATORSHIPS') || body.includes('conservatorship'));
  // sample has 4 receipts (interest×3+...) — >5? sample: check GC-400 hint absent for small
  const wsSmall = await J("window.EstateLedgerCore.CourtForms.buildCAWorksheet(__ELStore.state.activeEstateId, JSON.parse(JSON.stringify(__ELStore.state)))");
  ok("small estate: no GC-400 hint", !JSON.stringify(wsSmall.notes).match(/More than 5/));
  // big estate: inject 4 more money_in to exceed 5 receipts → GC-400 hint
  await J(`(()=>{ const e=__ELStore.getActive(); const base=e.transactions.filter(t0=>t0.kind==='money_in').length; for(let k=0;k<3;k++){ __ELStore.addTx(e.id,{kind:'money_in',date:'2026-02-0'+(k+1),amount:5,account:'income',description:'Service fee refund '+k}); } return 'ok'; })()`);
  const wsBig = await J("window.EstateLedgerCore.CourtForms.buildCAWorksheet(__ELStore.state.activeEstateId, JSON.parse(JSON.stringify(__ELStore.state)))");
  ok("big receipts → GC-400 hint", JSON.stringify(wsBig.notes).match(/More than 5/), JSON.stringify(wsBig.notes).slice(0,300));
  // schedule figures printed in ws-body (Superior Court etc.)
  ok("workbook shows amounts", body.includes('$'));
  // print CSS: panel-ws prints (display block) and chrome hidden
  const printRule = await J(`(()=>{ let found=false; for (const sheet of document.styleSheets){ try{ for (const r of sheet.cssRules){ if(r.media && /print/.test(r.media.mediaText)){ if(r.cssRules && [...r.cssRules].some(rr=>rr.cssText.includes('#panel-ws'))) found=true; } } }catch(e0){} } return found; })()`);
  ok("print CSS: ws prints", printRule);
  // back button restores account
  await J("document.getElementById('btn-ws-back').click()");
  await new Promise(r=>setTimeout(r,300));
  ok("back: ws hidden", await J("document.getElementById('panel-ws').hidden"));
  ok("back: account tab visible", await J("(function(){const p=document.getElementById('panel-report'); return !p.classList.contains('ws-shelved') && !p.hidden;})()"));
  // screenshot for vision
  await J("document.getElementById('btn-ca-worksheet').click()");
  await new Promise(r=>setTimeout(r,350));
  const s=(await send("Page.captureScreenshot",{format:"png"},sid)).result;
  require("fs").writeFileSync("C:/Users/MiniPC/Projects/estate-ledger/docs/landing/build-d14-worksheet.png", Buffer.from(s.data,"base64"));
  await send("Target.closeTarget",{targetId:ti});
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed?1:0);
})().catch(e=>{console.log("FATAL:",(e.message||String(e)).slice(0,250));process.exit(2);});
