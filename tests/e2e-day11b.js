#!/usr/bin/env node
// e2e-day11b: executor-fee-calculator.html landing page calc
const WebSocket = require("C:/Users/MiniPC/Projects/estate-ledger/node_modules/ws");
let passed=0, failed=0;
function ok(n,c,e){ if(c){passed++;console.log("  \u2713",n);} else {failed++;console.log("  \u2717",n,e||"");} }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let mid=0; const p=new Map(); let ws;
function send(m,pa,sid){return new Promise((res,rej)=>{const id=++mid;p.set(id,{res,rej});const msg={id,method:m,params:pa||{}};if(sid)msg.sessionId=sid;ws.send(JSON.stringify(msg));setTimeout(()=>{if(p.has(id)){p.delete(id);rej(new Error("t "+m));}},9000);});}
(async()=>{
  const ver=await(await fetch("http://127.0.0.1:9333/json/version")).json();
  ws=new WebSocket(ver.webSocketDebuggerUrl,{perMessageDeflate:false,maxPayload:256*1024*1024});
  ws.on("message",m=>{const d=JSON.parse(m);if(d.id&&p.has(d.id)){const x=p.get(d.id);p.delete(d.id);d.error?x.rej(new Error(d.error.message)):x.res(d);}});
  await new Promise(r=>ws.on("open",r));
  const cr=await send("Target.createTarget",{url:"file:///C:/Users/MiniPC/Projects/estate-ledger/site/executor-fee-calculator.html"});
  const ti=cr.result.targetId;
  const att=await send("Target.attachToTarget",{targetId:ti,flatten:true});
  const sid=att.result.sessionId;
  await send("Runtime.enable",{},sid);
  const J=async e=>(await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true},sid)).result.result.value;
  await new Promise(r=>setTimeout(r,800));
  ok("24 states in select", (await J("document.getElementById('c-state').options.length")) >= 24);
  await J(`document.getElementById('c-state').value='CA'; document.getElementById('c-value').value='$1,000,000'; document.getElementById('c-value').dispatchEvent(new Event('input'));`);
  ok("CA $1M → $23,000", (await J("document.getElementById('r-amt').textContent")).includes('23,000'), await J("document.getElementById('r-amt').textContent"));
  ok("CA gross-warning shown (in meta)", ((await J("document.getElementById('r-meta').textContent")).toUpperCase()).includes('GROSS'));
  await J(`document.getElementById('c-state').value='NY'; document.getElementById('c-value').value='500000'; document.getElementById('c-value').dispatchEvent(new Event('input'));`);
  ok("NY $500k → $19,000", (await J("document.getElementById('r-amt').textContent")).includes('19,000'), await J("document.getElementById('r-amt').textContent"));
  ok("NY warn hidden", await J("document.getElementById('r-warn').style.display==='none'"));
  await J(`document.getElementById('c-state').value='VA'; document.getElementById('c-income').value='50000'; document.getElementById('c-income').dispatchEvent(new Event('input'));`);
  ok("VA $500k+$50k income → $26,500", (await J("document.getElementById('r-amt').textContent")).includes('26,500'), await J("document.getElementById('r-amt').textContent"));
  await J(`document.getElementById('c-state').value='GA'; document.getElementById('c-value').value='0'; document.getElementById('c-income').value='300000'; document.getElementById('c-disb').value='200000'; document.getElementById('c-income').dispatchEvent(new Event('input')); document.getElementById('c-disb').dispatchEvent(new Event('input'));`);
  ok("GA flows → $12,500", (await J("document.getElementById('r-amt').textContent")).includes('12,500'), await J("document.getElementById('r-amt').textContent"));
  await J(`document.getElementById('c-state').value='OH'; document.getElementById('c-value').value='1000000'; document.getElementById('c-value').dispatchEvent(new Event('input'));`);
  const base = await J("document.getElementById('r-amt').textContent");
  await J(`document.getElementById('c-realty').click(); document.getElementById('c-realty').dispatchEvent(new Event('change'));`);
  const withR = await J("document.getElementById('r-amt').textContent");
  ok("OH realty adds", base !== withR, base+' → '+withR);
  ok("OH: $25,000 → $35,000 (1M tiers+1% realty)", base.includes('25,000') && withR.includes('35,000'), base+' → '+withR);
  ok("FAQPage schema present", await J(`!!document.querySelector('script[type="application/ld+json"]')`));
  await send("Target.closeTarget",{targetId:ti});
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed?1:0);
})().catch(e=>{console.log("FATAL:",(e.message||String(e)).slice(0,300));process.exit(2);});
