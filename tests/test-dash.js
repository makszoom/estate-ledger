#!/usr/bin/env node
// D18 unit: multi-estate dash (archive, dash rows, progress)
let pass = 0, fail = 0;
function t(name, cond, extra) { if (cond) { pass++; console.log("  \u2713", name); } else { fail++; console.log("  \u2717", name, extra || ""); } }
const fs = require('fs'), vm = require('vm');
const dir = 'C:/Users/MiniPC/Projects/estate-ledger/site/js/';
const sandbox = { window: {}, console, Date, Math, JSON, isNaN, parseFloat, localStorage: { getItem: () => null, setItem: () => {} } };
sandbox.window.EstateLedgerCore = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(dir + 'core.js', 'utf8'), sandbox);
const Core = sandbox.window.EstateLedgerCore;
const Store = Core.Store;

// fixture: 3 estates
function fixture() {
  const s = { version: 2, activeEstateId: 'a', estates: {
    a: { id: 'a', decedent: 'Al Pacino', caseNumber: '26P-111', state: 'CA', accountingBasis: 'carry', dateOfDeath: '2025-01-01', role: 'executor', archived: false, assets: [{id:'x1',name:'H',assetClass:'real_estate',dodValue:100000,outsideProbate:'no',createdAt:''}], transactions: [{id:'x2',kind:'reimbursable',date:'2025-02-01',amount:200,account:'principal',description:'Hotel stay for estate matters',payee:'Al'}], sales: [], createdAt: '2025-01-02' },
    b: { id: 'b', decedent: 'Bea Smith', caseNumber: '26P-222', state: 'NY', accountingBasis: 'standard', dateOfDeath: '2025-03-01', role: 'executor', archived: false, assets: [], transactions: [], sales: [], createdAt: '2025-03-02' },
    c: { id: 'c', decedent: 'Cy Mann', caseNumber: '', state: 'IL', accountingBasis: 'standard', dateOfDeath: '2026-01-01', role: 'trustee', archived: true, assets: [], transactions: [], sales: [], createdAt: '2026-01-02' }
  }};
  // make estate a unbalanced? a: asset 100k; no receipts — report balances by construction; reimbursable pending=200
  return s;
}
const mem = {};
mem['el_state'] = JSON.stringify(fixture());
const store = new Store(k => mem[k], (k, v) => { mem[k] = v; });

// ---------- archive API ----------
{
  const r1 = store.archiveEstate('a');
  t("archiveEstate('a') ok", r1 && r1.ok, JSON.stringify(r1));
  t("archived flag stored", store.state.estates.a.archived === true);
  const list1 = store.listEstates(true);  // includeArchived
  t("listEstates(true) includes archived", list1.some(e => e.id === 'a'));
  const list2 = store.listEstates(false);
  t("listEstates(false) excludes archived", !list2.some(e => e.id === 'a'));
  const list3 = store.listEstates();  // default excludes archived
  t("default list excludes archived", !list3.some(e => e.id === 'a'));
  const r2 = store.archiveEstate('nope');
  t("archive unknown rejected", r2 && !r2.ok);
  const r3 = store.unarchiveEstate('c');
  t("unarchive ok", r3 && r3.ok && store.state.estates.c.archived === false);
}

// ---------- dash summary ----------
{
  const s2 = JSON.parse(JSON.stringify(fixture()));
  mem['el_state'] = JSON.stringify(s2);
  const store2 = new Store(k => mem[k], (k, v) => { mem[k] = v; });
  const dash = store2.buildDash();
  t("buildDash exists + rows", Array.isArray(dash) && dash.length === 3, JSON.stringify(dash).slice(0,200));
  const rowA = dash.find(r => r.id === 'a');
  ok2 = rowA;
  t("row has decedent/case/state/days", rowA.decedent === 'Al Pacino' && rowA.caseNumber === '26P-111' && rowA.state === 'CA' && rowA.daysSinceDOD >= 0);
  t("row: assets count", rowA.assetsCount === 1);
  t("row: reimbursable pending = 200", rowA.reimbursablePending === 200, JSON.stringify(rowA));
  t("row: balanced boolean", typeof rowA.balanced === 'boolean');
  t("row: basis present", rowA.basis === 'carry');
  t("row: archived flag", rowA.archived === false);
  // archived estate 'c' listed too (dash shows all, flagged)
  const rowC = dash.find(r => r.id === 'c');
  t("archived estate listed w/ flag", rowC && rowC.archived === true);
  // next action hint: unvalued? assets have values; reimbursable pending → hint
  t("next action hint present", rowA.nextAction && rowA.nextAction.length > 5, JSON.stringify(rowA.nextAction));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
