
/* Estate Ledger unit tests — asset sale / gains & losses (D4) */
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
function estateWithAsset(store, dod, saleOverrides = {}) {
  const eid = store.createEstate({ decedent: 'S Pers', state: 'CA', dateOfDeath: '2025-01-15' }).estateId;
  const a = store.addAsset(eid, { name: 'Brokerage shares', assetClass: 'brokerage', dodValue: dod, outsideProbate: 'no' }).asset;
  return { eid, aid: a.id };
}

console.log('\n[D4] Sale validation');
test('recordSale: netProceeds required > 0', () => {
  mock = mockStorage(); const s = newStore();
  const { eid, aid } = estateWithAsset(s, 10000);
  assert(s.recordSale(eid, aid, { date: '2025-03-01', netProceeds: 0 }).errors.proceeds, 'zero rejected');
  assert(s.recordSale(eid, aid, { date: '2025-03-01', netProceeds: -5 }).errors.proceeds);
  assert(s.recordSale(eid, aid, { date: '2025-03-01', netProceeds: 'abc' }).errors.proceeds);
});
test('recordSale: date required + after DOD', () => {
  mock = mockStorage(); const s = newStore();
  const { eid, aid } = estateWithAsset(s, 10000);
  assert(s.recordSale(eid, aid, { date: '', netProceeds: 100 }).errors.date);
  assert(s.recordSale(eid, aid, { date: '2024-12-01', netProceeds: 100 }).errors.date); // pre-DOD
});
test('recordSale: missing expenses ok (gross), expenses parsed', () => {
  mock = mockStorage(); const s = newStore();
  const { eid, aid } = estateWithAsset(s, 10000);
  const r = s.recordSale(eid, aid, { date: '2025-03-01', grossProceeds: 12000, saleExpenses: 500 });
  assert(r.ok, JSON.stringify(r.errors));
  assert(r.sale.netProceeds === 11500, 'net = gross/expense: ' + r.sale.netProceeds);
});
test('recordSale: netProceeds directly (no gross)', () => {
  mock = mockStorage(); const s = newStore();
  const { eid, aid } = estateWithAsset(s, 10000);
  const r = s.recordSale(eid, aid, { date: '2025-03-01', netProceeds: 11000 });
  assert(r.ok && r.sale.netProceeds === 11000);
});
test('recordSale: both gross and net → conflict error', () => {
  mock = mockStorage(); const s = newStore();
  const { eid, aid } = estateWithAsset(s, 10000);
  const r = s.recordSale(eid, aid, { date: '2025-03-01', grossProceeds: 12000, netProceeds: 11000 });
  assert(r.ok === false && r.errors.general, 'one or the other');
});
test('recordSale: sold-before-DOD asset (outsideProbate unknown) — ok? unknown still saleable? НЕТ: only in-probate/no', () => {
  mock = mockStorage(); const s = newStore();
  const eid = s.createEstate({ decedent: 'X', state: 'CA', dateOfDeath: '2025-01-15' }).estateId;
  const a = s.addAsset(eid, { name: 'Mystery item', assetClass: 'personal_property', dodValue: 100, outsideProbate: 'unknown' }).asset;
  const r = s.recordSale(eid, a.id, { date: '2025-03-01', netProceeds: 90 });
  assert(!r.ok, 'unknown ownership cannot be sold through ledger: ' + JSON.stringify(r));
});

console.log('\n[D4] Gain/Loss math');
test('gain: proceeds > DOD → gain + asset marked sold (no double count)', () => {
  mock = mockStorage(); const s = newStore();
  const { eid, aid } = estateWithAsset(s, 10000);
  const r = s.recordSale(eid, aid, { date: '2025-03-01', netProceeds: 11500 });
  assert(r.sale.gainOrLoss === 1500, 'gain: ' + r.sale.gainOrLoss);
  assert(r.sale.direction === 'gain');
  const asset = s.state.estates[eid].assets.find(a => a.id === aid);
  assert(asset.sold === true, 'asset marked');
  assert(asset.saleId, 'linked');
  // cash appears as ONE money_in principal tx (proceeds are principal money)
  const txs = s.state.estates[eid].transactions;
  assert(txs.length === 1, 'exactly ONE tx created (no double count)');
  assert(txs[0].kind === 'money_in' && txs[0].account === 'principal', 'proceeds = principal cash');
  assert(txs[0].amount === 11500, 'proceeds amount');
  assert(txs[0].saleId === r.sale.id, 'tx linked to sale');
});
test('loss: proceeds < DOD → loss entry', () => {
  mock = mockStorage(); const s = newStore();
  const { eid, aid } = estateWithAsset(s, 10000);
  const r = s.recordSale(eid, aid, { date: '2025-03-01', netProceeds: 8000 });
  assert(r.sale.gainOrLoss === 2000, 'loss magnitude: ' + r.sale.gainOrLoss);
  assert(r.sale.direction === 'loss');
});
test('equal proceeds → neither gain nor loss (direction none)', () => {
  mock = mockStorage(); const s = newStore();
  const { eid, aid } = estateWithAsset(s, 10000);
  const r = s.recordSale(eid, aid, { date: '2025-03-01', netProceeds: 10000 });
  assert(r.sale.direction === 'none' && r.sale.gainOrLoss === 0);
});
test('sale with expenses in description (court sees expenses)', () => {
  mock = mockStorage(); const s = newStore();
  const { eid, aid } = estateWithAsset(s, 10000);
  const r = s.recordSale(eid, aid, { date: '2025-03-01', grossProceeds: 12000, saleExpenses: 500, expenseDetail: 'brokerage commission' });
  assert(r.sale.expenseDetail === 'brokerage commission');
});

console.log('\n[D4] Report integration (totals)');
test('saleTotals: gains/losses summarize + proceeds cash', () => {
  mock = mockStorage(); const s = newStore();
  const eid = s.createEstate({ decedent: 'X', state: 'CA', dateOfDeath: '2025-01-15' }).estateId;
  const a1 = s.addAsset(eid, { name: 'A1', assetClass: 'brokerage', dodValue: 10000, outsideProbate: 'no' }).asset;
  const a2 = s.addAsset(eid, { name: 'A2', assetClass: 'vehicle', dodValue: 5000, outsideProbate: 'no' }).asset;
  s.recordSale(eid, a1.id, { date: '2025-03-01', netProceeds: 11500 });
  s.recordSale(eid, a2.id, { date: '2025-04-01', netProceeds: 4200 });
  const st = s.saleTotals(eid);
  assert(st.gains === 1500, 'gains: ' + st.gains);
  assert(st.losses === 800, 'losses: ' + st.losses);
  assert(st.proceeds === 15700, 'total proceeds cash: ' + st.proceeds);
  assert(st.count === 2);
});
test('deleteSale: undo sale — asset unmarked, cash tx removed', () => {
  mock = mockStorage(); const s = newStore();
  const { eid, aid } = estateWithAsset(s, 10000);
  const r = s.recordSale(eid, aid, { date: '2025-03-01', netProceeds: 11500 });
  assert(s.deleteSale(eid, r.sale.id), 'delete ok');
  const asset = s.state.estates[eid].assets.find(a => a.id === aid);
  assert(!asset.sold, 'asset unmarked');
  assert(s.state.estates[eid].transactions.length === 0, 'cash tx removed');
  assert(s.state.estates[eid].sales.length === 0);
});
test('deleteAsset with sale → blocked (must undo sale first)', () => {
  mock = mockStorage(); const s = newStore();
  const { eid, aid } = estateWithAsset(s, 10000);
  const r = s.recordSale(eid, aid, { date: '2025-03-01', netProceeds: 11500 });
  const d = s.deleteAsset(eid, aid);
  assert(d && d.ok === false, 'blocked: ' + JSON.stringify(d));
});

// undo edge: updateAsset on sold asset value → blocked (gain/loss tied to DOD)
test('updateAsset dodValue on SOLD asset blocked', () => {
  mock = mockStorage(); const s = newStore();
  const { eid, aid } = estateWithAsset(s, 10000);
  s.recordSale(eid, aid, { date: '2025-03-01', netProceeds: 11500 });
  const u = s.updateAsset(eid, aid, { dodValue: 9000 });
  assert(!u.ok, 'sold asset DOD locked');
  const u2 = s.updateAsset(eid, aid, { name: 'A1 renamed' });
  assert(u2.ok, 'rename allowed');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
