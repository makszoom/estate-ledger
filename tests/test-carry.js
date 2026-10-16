#!/usr/bin/env node
// D9 unit tests: migration v1→v2 + accountingBasis + carry report (test-first)
let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log("  \u2713", name); }
  else { fail++; console.log("  \u2717", name, extra || ""); }
}

// --- load core.js in a window-like scope ---
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('C:/Users/MiniPC/Projects/estate-ledger/site/js/core.js', 'utf8');
const sandbox = { window: {}, console, Date, Math, JSON, isNaN, parseFloat, setTimeout,
  localStorage: { getItem: () => null, setItem: () => {} } };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const Core = sandbox.window.EstateLedgerCore;
const Store = Core.Store;

// ---------- fixture: v1 state ----------
function makeV1State() {
  return { version: 1, activeEstateId: 'e1',
    estates: { e1: { id: 'e1', decedent: 'John Old', state: 'NY', dateOfDeath: '2025-01-01',
      createdAt: '2025-01-02', assets: [], transactions: [], sales: [] } } };
}

// richer fixture: estate with assets + sale + txs (for carry report)
function makeEstateWithSale() {
  const st = makeV1State();
  const e = st.estates.e1;
  e.state = 'CA';
  e.accountingBasis = 'carry';
  e.assets = [
    { id: 'a1', name: 'Home on Vine St', assetClass: 'real_estate', dodValue: 412000,
      outsideProbate: 'no', valuationSource: 'appraisal', reference: 'APN 123', createdAt: '2025-01-02',
      sold: true, saleId: 's1', soldDate: '2025-04-15' },
    { id: 'a2', name: 'Chase checking', assetClass: 'bank_account', dodValue: 20000,
      outsideProbate: 'no', valuationSource: 'account_statement', createdAt: '2025-01-02' },
    { id: 'a3', name: 'Brokerage AAPL', assetClass: 'brokerage', dodValue: 50000,
      outsideProbate: 'no', valuationSource: 'account_statement', createdAt: '2025-01-02' }
  ];
  e.sales = [
    { id: 's1', assetId: 'a1', date: '2025-04-15', grossProceeds: 445000, sellingExpenses: 28400,
      netProceeds: 416600, dodValue: 412000, direction: 'gain', gainOrLoss: 4600 }
  ];
  e.transactions = [
    { id: 't1', kind: 'money_in', date: '2025-04-15', amount: 416600, account: 'principal',
      description: 'Net proceeds — sale of Home on Vine St', saleId: 's1' },
    { id: 't2', kind: 'money_in', date: '2025-03-01', amount: 120, account: 'income',
      description: 'Interest, Chase checking Q1' },
    { id: 't3', kind: 'money_out', date: '2025-02-10', amount: 800, account: 'principal',
      description: 'County filing fee', payee: 'Superior Court' },
    { id: 't4', kind: 'distribution', date: '2025-06-01', amount: 25000, account: 'principal',
      description: 'Interim distribution to beneficiary', beneficiary: 'Sam Old' }
  ];
  return st;
}

// ---------- MIGRATION TESTS ----------
{
  const mem = {};
  mem['el_state'] = JSON.stringify(makeV1State());
  const s = new Store(k => mem[k], (k, v) => { mem[k] = v; });
  t("v1 state → version 2 after load", s.state.version === 2, 'got ' + s.state.version);
  t("v1 estate gets accountingBasis='standard'", s.state.estates.e1.accountingBasis === 'standard');
  t("v1 data preserved (decedent)", s.state.estates.e1.decedent === 'John Old');
  t("migration persisted to storage", JSON.parse(mem['el_state']).version === 2);

  // fresh store has no estates — nothing breaks
  const mem2 = {};
  const s2 = new Store(k => mem2[k], (k, v) => { mem2[k] = v; });
  t("empty state version 2", s2.state.version === 2);

  // importState with old backup → migrated too
  const mem3 = {};
  const s3 = new Store(k => mem3[k], (k, v) => { mem3[k] = v; });
  const r = s3.importState(JSON.stringify(makeV1State()));
  t("importState(v1) ok", r.ok === true);
  t("importState(v1) → migrated version 2", s3.state.version === 2);
  t("importState(v1) estate has accountingBasis", s3.state.estates.e1.accountingBasis === 'standard');
}

// ---------- setAccountingBasis ----------
{
  const mem = {};
  mem['el_state'] = JSON.stringify(makeEstateWithSale());
  const s = new Store(k => mem[k], (k, v) => { mem[k] = v; });
  const r1 = s.setAccountingBasis('e1', 'carry');
  t("setAccountingBasis('carry') ok", r1.ok === true);
  t("basis stored", s.state.estates.e1.accountingBasis === 'carry');
  const r2 = s.setAccountingBasis('e1', 'bogus');
  t("invalid basis rejected", r2.ok === false);
  const r3 = s.setAccountingBasis('nope', 'carry');
  t("unknown estate rejected", r3.ok === false);
}

// ---------- CARRY REPORT (the core of D9) ----------
{
  const mem = {};
  mem['el_state'] = JSON.stringify(makeEstateWithSale());
  const s = new Store(k => mem[k], (k, v) => { mem[k] = v; });

  const rep = s.buildAccountReport('e1', { basis: 'carry' });
  t("carry report builds", !!rep);
  t("carry report marks basis", rep.basis === 'carry');

  // CHARGES (carry): inventory at carrying value + receipts (interest etc., proceeds NOT
  // re-counted) + gains on dispositions. Inventory = 412000+20000+50000 = 482000
  t("carry inventory at carrying value (incl sold)", rep.charges.inventory === 482000, 'got ' + rep.charges.inventory);
  const receiptsTotal = rep.charges.receiptsPrincipal + rep.charges.receiptsIncome;
  t("carry receipts = 120 (proceeds enter via gain+onHand, no double-count)", receiptsTotal === 120, 'got ' + receiptsTotal);
  // gains = 4600
  t("carry gains = 4600", rep.charges.gains === 4600, 'got ' + rep.charges.gains);
  // total charges = 482000 + 120 + 4600 = 486720
  t("total charges = 486720", rep.totals.charges === 486720, 'got ' + rep.totals.charges);

  // CREDITS: disb 800 + losses 0 + distributions 25000 + onHand(unsold carry: 20000+50000=70000 + cash 416720-800-25000=390920) = 
  // onHand = 70000 + 390920 = 460920; total = 800 + 0 + 25000 + 460920 = 486720+... let me recompute:
  // 800+25000 = 25800; 460920+25800 = 486720? no: credits = disb + losses + distr + onHand = 800+0+25000+460920 = 486720.
  // Hmm but charges 903320. UNBALANCED?! Let me check identity instead of raw numbers:
  const C = rep.totals.charges, K = rep.totals.credits;
  t("carry report BALANCED (identity holds)", rep.balanced === true, `charges=${C} credits=${K} diff=${rep.balanceDiff}`);
  // carry credits: onHand must NOT include the sold asset (discharged), must include cash 390920
  t("carry onHand = 460920 (unsold 70000 + cash 390920)", rep.credits.assetsOnHand === 460920, 'got ' + rep.credits.assetsOnHand);

  // market-value movements of UNsold assets must NOT appear (brokerage worth 60000 now — invisible in carry)
  t("no market-change entries in carry report", !rep.charges.changesToInventory);

  // redFlags array exists
  t("redFlags present", Array.isArray(rep.redFlags));

  // scheduleSales present with the gain
  t("scheduleSales has the home sale", rep.scheduleSales.length === 1 && rep.scheduleSales[0].gainOrLoss === 4600);
}

// ---------- STANDARD REPORT UNCHANGED (regression via same fixture) ----------
{
  const mem = {};
  const st = makeEstateWithSale();
  st.estates.e1.accountingBasis = 'standard';
  mem['el_state'] = JSON.stringify(st);
  const s = new Store(k => mem[k], (k, v) => { mem[k] = v; });
  const rep = s.buildAccountReport('e1');  // default basis = estate's = standard
  t("standard report still builds", !!rep && rep.basis === 'standard');
  // standard: receipts EXCLUDE proceeds → 120 only
  t("standard receipts exclude proceeds (120)", rep.charges.receiptsPrincipal + rep.charges.receiptsIncome === 120,
    'got ' + (rep.charges.receiptsPrincipal + rep.charges.receiptsIncome));
  t("standard report balanced", rep.balanced === true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
