#!/usr/bin/env node
// D14 unit: CA court worksheet mapping (GC-405 companion + carry-value note for decedent CA)
let pass = 0, fail = 0;
function t(name, cond, extra) { if (cond) { pass++; console.log("  \u2713", name); } else { fail++; console.log("  \u2717", name, extra || ""); } }
const fs = require('fs'), vm = require('vm');
const dir = 'C:/Users/MiniPC/Projects/estate-ledger/site/js/';
const sandbox = { window: {}, console, Date, Math, JSON, isNaN, parseFloat, localStorage: { getItem: () => null, setItem: () => {} } };
sandbox.window.EstateLedgerCore = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(dir + 'core.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(dir + 'fee-schedules.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(dir + 'bank-import.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(dir + 'court-forms.js', 'utf8'), sandbox);
const Core = sandbox.window.EstateLedgerCore;
const CF = Core.CourtForms;

t("CourtForms exists", !!CF);
if (!CF) { console.log("0 passed, 1 failed"); process.exit(1); }

// fixture estate
const st = {
  version: 2, activeEstateId: 'e1',
  estates: { e1: {
    id: 'e1', decedent: 'Jane M. Doe', caseNumber: '26P-0456', state: 'CA', role: 'executor',
    accountingBasis: 'carry', dateOfDeath: '2025-07-01',
    assets: [
      { id: 'a1', name: 'Home on Vine St', assetClass: 'real_estate', dodValue: 650000, outsideProbate: 'no', sold: true, saleId: 's1' },
      { id: 'a2', name: 'Chase checking ••4521', assetClass: 'bank_account', dodValue: 18240, outsideProbate: 'no' },
      { id: 'a3', name: 'Vanguard brokerage', assetClass: 'brokerage', dodValue: 41000, outsideProbate: 'no' }
    ],
    sales: [ { id: 's1', assetId: 'a1', date: '2025-10-15', grossProceeds: 700000, sellingExpenses: 35000, netProceeds: 665000, dodValue: 650000, direction: 'gain', gainOrLoss: 15000 } ],
    transactions: [
      { id: 't1', kind: 'money_in', date: '2025-10-15', amount: 665000, account: 'principal', description: 'Net proceeds — Home on Vine St', saleId: 's1' },
      { id: 't2', kind: 'money_in', date: '2025-08-01', amount: 62.40, account: 'income', description: 'Interest — Chase ••4521' },
      { id: 't3', kind: 'money_in', date: '2025-09-01', amount: 58.71, account: 'income', description: 'Interest — Chase ••4521' },
      { id: 't4', kind: 'money_in', date: '2025-10-01', amount: 61.02, account: 'income', description: 'Interest — Chase ••4521' },
      { id: 't5', kind: 'money_out', date: '2025-07-20', amount: 850, account: 'principal', description: 'County filing fee', payee: 'Superior Court' },
      { id: 't6', kind: 'money_out', date: '2025-08-10', amount: 2400, account: 'principal', description: 'Funeral and burial costs', payee: 'Sunset Mortuary' },
      { id: 't7', kind: 'distribution', date: '2025-11-05', amount: 15000, account: 'principal', description: 'Partial distribution', beneficiary: 'Sam Doe' }
    ]
  }}
};
vm.runInContext("window.__ST = " + JSON.stringify(st), sandbox);

// ---------- buildCAWorksheet ----------
const w = CF.buildCAWorksheet('e1', sandbox.window.__ST);
t("worksheet built", !!w);
t("header: decedent", w.header.decedent === 'Jane M. Doe');
t("header: case", w.header.caseNumber === '26P-0456');
t("header: state CA", w.header.state === 'CA');
t("header: role executor", w.header.role === 'executor');
t("summary: receipts income total", w.summary.receiptsIncome === Math.round((62.40+58.71+61.02)*100)/100, JSON.stringify(w.summary));
t("summary: disbursements total", w.summary.disbursementsTotal === 3250, JSON.stringify(w.summary));
t("summary: distribution present", w.summary.distributions === 15000);
t("schedule A rows = receipts (excl. proceeds? proceed is in money_in!) — GC-405(A) Receipts: non-capital items only → proceeds excluded", 
  w.scheduleA.length === 3 && !w.scheduleA.some(r => /proceeds/i.test(r.description)), JSON.stringify(w.scheduleA).slice(0,200));
t("schedule A rows sorted by date", w.scheduleA[0].date <= w.scheduleA[1].date);
t("schedule C rows = disbursements", w.scheduleC.length === 2 && w.scheduleC[0].payee === 'Superior Court', JSON.stringify(w.scheduleC).slice(0,160));
t("schedule C fields complete", w.scheduleC[0].date && w.scheduleC[0].payee && w.scheduleC[0].purpose && w.scheduleC[0].amount);
t("distributions listed", w.scheduleD && w.scheduleD.length === 1 && w.scheduleD[0].beneficiary === 'Sam Doe');

// ---------- basis mapping: CA decedent → carry-value instruction ----------
t("carry note present for CA decedent (basis=carry)", (w.notes||[]).some(n => /carry/i.test(n)), JSON.stringify(w.notes));
t("GC-405 scope note (conservatorship/guardianship)", (w.notes||[]).some(n => /GC-405/i.test(n) && /conservatorship|guardianship/i.test(n)));

// ---------- >5 rows hint → GC-400 ----------
const big = JSON.parse(JSON.stringify(st));
big.estates.e1.transactions.push(
  { id: 'ti' + 1, kind: 'money_in', date: '2025-08-05', amount: 10, account: 'income', description: 'Interest x1' },
  { id: 'ti' + 2, kind: 'money_in', date: '2025-08-06', amount: 10, account: 'income', description: 'Interest x2' },
  { id: 'ti' + 3, kind: 'money_in', date: '2025-08-07', amount: 10, account: 'income', description: 'Interest x3' }
);
const w2 = CF.buildCAWorksheet('e1', big);
t(">5 receipts → GC-400 hint fires", (w2.notes||[]).some(n => /GC-400/i.test(n) && /more than 5/i.test(n)), JSON.stringify(w2.notes));

// small estate: no GC-400 hint
t("small estate: no GC-400 hint", !(w.notes||[]).some(n => /More than 5 receipt rows/i.test(n)));

// render: worksheet→HTML block (no official PDF reproduction)
const html = CF.renderCAWorksheet(w, Core.fmtMoney);
t("render → html string", typeof html === 'string' && html.includes('WORKSHEET'));
t("render lists schedule rows", html.includes('Superior Court') && html.includes('Interest'));
t("render includes carry note text", /carry/i.test(html));
t("render positions itself as companion, not the official form", html.includes('companion worksheet') && !/we provide the official|replace the official/i.test(html));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
