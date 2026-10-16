#!/usr/bin/env node
// D11 unit: statutory executor fee schedules (test-first — RED before core has calculateStatutoryFee)
let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log("  \u2713", name); }
  else { fail++; console.log("  \u2717", name, extra || ""); }
}
const fs = require('fs');
const vm = require('vm');
const dir = 'C:/Users/MiniPC/Projects/estate-ledger/site/js/';
const sandbox = { window: {}, console, Date, Math, JSON, isNaN, parseFloat, localStorage: { getItem: () => null, setItem: () => {} } };
sandbox.window.EstateLedgerCore = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(dir + 'core.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(dir + 'fee-schedules.js', 'utf8'), sandbox);
const Core = sandbox.window.EstateLedgerCore;

// ---------- FEE_SCHEDULES presence ----------
t("FEE_SCHEDULES exists", !!Core.FEE_SCHEDULES);
const S = Core.FEE_SCHEDULES || {};
['CA','NY','FL','VA','MD','OH','OK','SD','GA','SC','AR','WI','MO','TX','AL'].forEach(st => {
  t("FEE_SCHEDULES has " + st, !!S[st]);
});
const CA = S.CA || {};
t("CA schedule type=tiers on gross", CA.type === 'tiers' && CA.basis === 'gross_probate_estate', JSON.stringify(CA).slice(0,120));
t("CA tiers: 4/3/2/1/0.5", JSON.stringify((CA.tiers||[]).map(x=>x.rate)) === JSON.stringify([4,3,2,1,0.5]), JSON.stringify(CA.tiers));
t("CA statute ref", (CA.statute||'').includes('10810'));

// ---------- calculateStatutoryFee ----------
const calc = Core.calculateStatutoryFee;
t("calculateStatutoryFee exists", typeof calc === 'function');

if (typeof calc === 'function') {
  // CA §10810: known benchmark $1M gross → $23,000 (4%×100k=4k + 3%×100k=3k + 2%×800k=16k)
  let r = calc('CA', 1000000);
  t("CA $1M → $23,000", r && r.fee === 23000, JSON.stringify(r));
  // CA note about gross (mortgage NOT deducted) present in result for UI
  t("CA result carries basis note", r && (r.basisNote||'').toLowerCase().includes('gross') || (r.note||'').toLowerCase().includes('gross'), JSON.stringify(r).slice(0,200));
  // CA boundary: exactly 100k → 4% only = 4000
  r = calc('CA', 100000);
  t("CA $100k → $4,000", r && r.fee === 4000, JSON.stringify(r));
  // CA boundary: 150k → 4k + 3%×50k=1.5k = 5500
  r = calc('CA', 150000);
  t("CA $150k → $5,500", r && r.fee === 5500, JSON.stringify(r));
  // CA big: 25M → 23k(1M part) + 1%×9M=90k + 0.5%×15M=75k = 188000
  r = calc('CA', 25000000);
  t("CA $25M → $188,000", r && r.fee === 188000, JSON.stringify(r));

  // NY SCPA 2307: $500k → 5%×100k=5k + 4%×200k=8k + 3%×200k=6k = 18k? tiers: 100k@5, 200k@4, 700k@3...
  // 500k = 100k(5k) + 200k(8k) + 200k(3%×200k=6k) = 19k?? executor.org said $18,000 for 500k.
  // SCPA 2307: first 100k 5%; next 200k 4%; next 700k 3% → 500k: 5k+8k+3%×(500k-300k)=6k → 19k.
  // executor.org's 18k likely an error; we use statute math (19k) and note the source.
  r = calc('NY', 500000);
  t("NY $500k → $19,000 (per SCPA 2307 tiers)", r && r.fee === 19000, JSON.stringify(r));

  // FL §733.617: 500k → 3%×500k = 15k
  r = calc('FL', 500000);
  t("FL $500k → $15,000", r && r.fee === 15000, JSON.stringify(r));

  // MD: 9% first 20k + 3.6% rest: 100k → 1800 + 3.6%×80k=2880 → 4680
  r = calc('MD', 100000);
  t("MD $100k → $4,680", r && r.fee === 4680, JSON.stringify(r));

  // VA guideline: 5% first 400k + 4% next 300k: 500k → 20k + 4%×100k=4k = 24k (income part separate)
  r = calc('VA', 500000, { income: 0, disbursements: 0 });
  t("VA $500k core → $24,000 (guideline)", r && r.fee === 24000, JSON.stringify(r));
  // VA + 5% on income received: income 50k → +2500
  r = calc('VA', 500000, { income: 50000, disbursements: 0 });
  t("VA income 5% adds", r && r.fee === 26500, JSON.stringify(r));

  // GA: basis = receipts+disbursements: 2.5% in + 2.5% out
  r = calc('GA', 0, { income: 300000, disbursements: 200000 });
  t("GA basis=flows: 2.5%×(300k+200k)? GA is 2.5% money in + 2.5% money out separately", r && r.fee === 12500, JSON.stringify(r));

  // OH: 4/3/2 +1% unsold realty — base tiers on gross; +1% flag
  r = calc('OH', 500000);
  const base_oh = r.fee;  // whatever tier computes
  r = calc('OH', 500000, { unsoldRealty: true });
  t("OH unsoldRealty adds 1%", r && r.fee > 0 && (r.fee === Math.round((base_oh + 5000)*100)/100), JSON.stringify({base: base_oh, with: r.fee}));

  // reasonable-fee state (e.g. Illinois): no schedule
  r = calc('IL', 500000);
  t("IL (not in schedule) → reasonable note", r && r.reasonable === true && (r.fee === null || r.fee === undefined), JSON.stringify(r));

  // unknown state code
  r = calc('XX', 500000);
  t("unknown state → not ok", r && (r.reasonable === true || r.fee === null), JSON.stringify(r));

  // money parse: fee handles numbers/strings
  r = calc('CA', '$1,000,000');
  t("CA accepts money-string", r && r.fee === 23000, JSON.stringify(r));

  // statute ref on result for all scheduled states (YMYL: show source)
  r = calc('NY', 500000);
  t("NY result carries statute", r && r.statute === 'SCPA 2307', JSON.stringify(r).slice(0,120));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
