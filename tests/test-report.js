
/* Estate Ledger unit tests — charge-and-discharge report builder (D5) */
const assert = require('assert');
const path = require('path');
const Core = require(path.join(__dirname, '..', 'site', 'js', 'core.js'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '→', e.message); }
}
function mockStorage() {
  const m = new Map();
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, v) };
}
let mock;
function newStore() { return new Core.Store(k => mock.getItem(k), (k, v) => mock.setItem(k, v)); }
function estateWith(store) {
  const r = store.createEstate({ decedent: 'R Pers', state: 'CA', dateOfDeath: '2025-01-15', caseNumber: '26-P-0814' });
  assert(r.ok, JSON.stringify(r.errors));
  return r.estateId;
}

console.log('\n[D5] buildAccountReport — структура и баланс');
test('clean balanced report: CHARGES = CREDITS, balanced=true', () => {
  mock = mockStorage(); const s = newStore(); const eid = estateWith(s);
  // assets
  s.addAsset(eid, { name: 'Home', assetClass: 'real_estate', dodValue: 300000, outsideProbate: 'no' });
  s.addAsset(eid, { name: 'Checking', assetClass: 'bank_account', dodValue: 18500, outsideProbate: 'no' });
  s.addAsset(eid, { name: 'TOD insurance', assetClass: 'other', dodValue: 50000, outsideProbate: 'yes' });
  // sale: home sold 315000 → gain 15000
  const home = s.listAssets(eid).find(a => a.name === 'Home');
  s.recordSale(eid, home.id, { date: '2025-04-01', netProceeds: 315000 });
  // txs
  s.addTx(eid, { date: '2025-03-04', kind: 'money_in', amount: 480, account: 'income', description: 'Bank interest' });
  s.addTx(eid, { date: '2025-03-06', kind: 'money_out', amount: 9480, account: 'principal', description: 'Funeral home — payment in full', payee: 'Sunrise Funeral' });
  s.addTx(eid, { date: '2025-04-09', kind: 'reimbursable', amount: 86.20, account: 'principal', description: 'Executor mileage', payee: 'Executor (self)' });
  s.addTx(eid, { date: '2025-05-02', kind: 'distribution', amount: 5000, account: 'principal', description: 'Cash distribution — preliminary', beneficiary: 'Alice Marshal' });
  const repo = s.buildAccountReport(eid);
  assert(repo.ok !== false, 'report built');
  // Charges: inventory DOD (300000+18500=318500: home excluded? НЕТ: home SOLD but was inventory at DOD;
  // sale proceeds become cash. Court structure: inventory at DOD 318,500 (incl. home as of death)
  assert(repo.charges.inventory === 318500, 'inventory DOD: ' + repo.charges.inventory);
  assert(repo.charges.gains === 15000, 'gains from sale: ' + repo.charges.gains);
  assert(repo.charges.receiptsPrincipal === 0, 'no principal receipts');
  assert(repo.charges.receiptsIncome === 480);
  assert(repo.credits.disbursementsPrincipal === 9480);
  assert(repo.credits.disbursementsIncome === 0);
  assert(repo.credits.distributions === 5000);
  // on hand: proceeds cash 315k + checking 18.5k is PART of inventory... Court standard (market-value):
  // charges = inventory (DOD) + receipts + gains; credits = disbursements + losses + distributions + remaining assets
  // Remaining assets on hand = unsold probate assets at CURRENT value (checking remains 18,500)
  assert(repo.credits.assetsOnHand === 319500, 'onHand = unsold 18500 + cash flows 301000: ' + repo.credits.assetsOnHand);
  const totC = repo.charges.inventory + repo.charges.gains + repo.charges.receiptsPrincipal + repo.charges.receiptsIncome;
  const totD = repo.credits.disbursementsPrincipal + repo.credits.disbursementsIncome + repo.credits.losses + repo.credits.distributions + repo.credits.assetsOnHand;
  assert(repo.totals.charges === totC, 'charges total: ' + repo.totals.charges);
  assert(repo.totals.credits === totD, 'credits total: ' + repo.totals.credits);
  // BALANCE: 318500+15000+480 = 333980; credits: 9480+0+0+5000+18500 = 32980 → NOT balanced here because
  // the sale proceeds (315000 cash) is IN the estate bank but NOT counted as "asset on hand" —
  // the proceeds tx IS money in the estate checking, and it's already counted as receipts? НЕТ — we counted
  // it as GAIN 15000 + inventory 300000 = 315000 (sale replaces inventory with cash, economically equivalent).
  // So remaining cash = 18500 + 315000 = 333500... The cash-on-hand must COUNT UNRECONCILED estate cash:
  // assetsOnHand should include liquid cash from transactions: 315000 proceeds - 9480 - 5000 + 480 income = 301000
  // + checking 18500 (unsold asset itself) = 319500?? Court charge-discharge (carry-value) treats cash as asset.
  // MARKET-VALUE approach (our v1): assetsOnHand = unsold assets' current value + estate cash balance derived from txs.
  // With sale: the DOD inventory line 300000 is 'discharged' by the sale; net proceeds 315000 IS the estate cash
  // → charges: inventory 318500 (home DOD incl.) + gain 15000 = 333500; credits: disb 9480 + distr 5000 + onHand 319020
  // where onHand cash = 315000 - 9480 - 5000 - 86.20(reimb not estate cash yet? reimb was PAID by executor
  // personally → NOT estate cash until repaid... but court counts it as potential credit: leave reimb out of cash)
  // + 480 income cash + checking 18500 = 319000... check exact:
  // estateCash = proceeds 315000 + interest 480 - disb 9480 - distr 5000 - reimb (paid personally, excluded) = 301000
  // onHand = 301000 + checking (unsold, carries at DOD in market approach → 18500) = 319500
  // charges 333980 vs credits 32980+319500 = 352480?? NO: 9480+5000+319500 = 333980 ✓✓✓
  assert(repo.totals.balanced === true, 'BALANCED: ' + repo.totals.charges + ' vs ' + repo.totals.credits);
});

test('red flag: money_out without inventory → negative cash flag', () => {
  mock = mockStorage(); const s = newStore(); const eid = estateWith(s);
  s.addTx(eid, { date: '2025-03-01', kind: 'money_out', amount: 9500, account: 'principal', description: 'Lawyer retainer', payee: 'Law Firm' });
  const repo = s.buildAccountReport(eid);
  assert(repo.totals.balanced === true, 'math identity holds: ' + repo.totals.charges + '/' + repo.totals.credits);
  assert(repo.redFlags.some(f => f.type === 'negative_cash'), 'negative_cash flag fired');
});

test('red flag: probate asset without DOD value flagged', () => {
  mock = mockStorage(); const s = newStore(); const eid = estateWith(s);
  s.addAsset(eid, { name: 'Coins', assetClass: 'personal_property', dodValue: null, outsideProbate: 'no' });
  const repo = s.buildAccountReport(eid);
  assert(repo.redFlags.some(f => f.type === 'unvalued' && f.count === 1), 'unvalued flag');
});

test('red flag: unverified ownership assets flagged', () => {
  mock = mockStorage(); const s = newStore(); const eid = estateWith(s);
  s.addAsset(eid, { name: 'Jewelry', assetClass: 'personal_property', dodValue: 100, outsideProbate: 'unknown' });
  const repo = s.buildAccountReport(eid);
  assert(repo.redFlags.some(f => f.type === 'unverified_ownership' && f.count === 1));
});

test('red flag: pending reimbursable memo flagged', () => {
  mock = mockStorage(); const s = newStore(); const eid = estateWith(s);
  s.addTx(eid, { date: '2025-04-09', kind: 'reimbursable', amount: 86.20, account: 'principal', description: 'Mileage', payee: 'Executor (self)' });
  const repo = s.buildAccountReport(eid);
  const f = repo.redFlags.find(x => x.type === 'reimbursable_pending');
  assert(f && f.amount === 86.20, 'memo flag');
});

test('income receipts separate: income disb/interest tracked in own schedule lines', () => {
  mock = mockStorage(); const s = newStore(); const eid = estateWith(s);
  s.addAsset(eid, { name: 'Checking', assetClass: 'bank_account', dodValue: 20000, outsideProbate: 'no' });
  s.addTx(eid, { date: '2025-03-04', kind: 'money_in', amount: 300, account: 'income', description: 'Interest' });
  s.addTx(eid, { date: '2025-03-08', kind: 'money_in', amount: 1200, account: 'principal', description: 'Deposit of refund' });
  s.addTx(eid, { date: '2025-03-10', kind: 'money_out', amount: 200, account: 'income', description: 'Bank fee', payee: 'Bank' });
  const repo = s.buildAccountReport(eid);
  const recv = repo.scheduleReceipts.map(x => x.description);
  assert(recv.includes('Interest') && recv.includes('Deposit of refund'), 'both receipts listed');
  assert(repo.scheduleReceipts.find(x => x.description === 'Interest').account === 'income', 'accounts kept');
});

// schedules content
test('schedules: receipts/disbursements/distributions with court fields', () => {
  mock = mockStorage(); const s = newStore(); const eid = estateWith(s);
  s.addTx(eid, { date: '2025-03-06', kind: 'money_out', amount: 9480, account: 'principal', description: 'Funeral home — payment in full', payee: 'Sunrise Funeral', checkNo: '1042' });
  s.addTx(eid, { date: '2025-05-02', kind: 'distribution', amount: 5000, account: 'principal', description: 'Cash distribution — preliminary', beneficiary: 'Alice Marshal' });
  s.addTx(eid, { date: '2025-03-04', kind: 'money_in', amount: 480, account: 'income', description: 'Estate bank interest', reference: 'Chase ••4521' });
  const repo = s.buildAccountReport(eid);
  const d = repo.scheduleDisbursements[0];
  assert(d.date === '2025-03-06' && d.payee === 'Sunrise Funeral' && d.amount === 9480 && d.checkNo === '1042', 'disb fields');
  const dist = repo.scheduleDistributions[0];
  assert(dist.beneficiary === 'Alice Marshal' && dist.amount === 5000, 'dist fields');
  const r = repo.scheduleReceipts[0];
  assert(r.date === '2025-03-04' && r.account === 'income' && r.description.includes('interest'), 'receipt fields');
});

// outside probate: NOT in charges (passes outside) but listed as note
test('outside-probate assets excluded from inventory, listed separately', () => {
  mock = mockStorage(); const s = newStore(); const eid = estateWith(s);
  s.addAsset(eid, { name: 'TOD insurance', assetClass: 'other', dodValue: 50000, outsideProbate: 'yes' });
  s.addAsset(eid, { name: 'Checking', assetClass: 'bank_account', dodValue: 15000, outsideProbate: 'no' });
  const repo = s.buildAccountReport(eid);
  assert(repo.charges.inventory === 15000, 'only probate: ' + repo.charges.inventory);
  assert(repo.nonProbate.length === 1 && repo.nonProbate[0].dodValue === 50000, 'listed as note');
});

test('empty estate → zero report, balanced=true', () => {
  mock = mockStorage(); const s = newStore(); const eid = estateWith(s);
  const repo = s.buildAccountReport(eid);
  assert(repo.totals.charges === 0 && repo.totals.credits === 0 && repo.totals.balanced === true);
});

test('unknown estate → null', () => {
  mock = mockStorage(); const s = newStore();
  assert(s.buildAccountReport('nope') === null);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
