
/* Estate Ledger unit tests — assets module (D2) */
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
function newStore() {
  return new Core.Store(k => mock.getItem(k), (k, v) => mock.setItem(k, v));
}
function estateWith(store, overrides = {}) {
  const r = store.createEstate(Object.assign({ decedent: 'T Pers', state: 'CA', dateOfDeath: '2025-01-15' }, overrides));
  assert(r.ok, 'estate create: ' + JSON.stringify(r.errors));
  return r.estateId;
}

console.log('\n[D2] Asset validation');
test('validateAsset: missing name → error', () => {
  const errs = Core.Store.validateAsset({ name: '', assetClass: 'bank_account', dodValue: 1000 });
  assert(errs.name);
});
test('validateAsset: missing class → error', () => {
  const errs = Core.Store.validateAsset({ name: 'House', assetClass: '', dodValue: 1000 });
  assert(errs.assetClass);
});
test('validateAsset: unknown class → error', () => {
  const errs = Core.Store.validateAsset({ name: 'X', assetClass: 'spaceship', dodValue: 1000 });
  assert(errs.assetClass);
});
test('validateAsset: negative dodValue rejected', () => {
  const errs = Core.Store.validateAsset({ name: 'X', assetClass: 'cash', dodValue: -5 });
  assert(errs.dodValue, 'negative flagged');
});
test('validateAsset: $0 allowed (empty accounts happen)', () => {
  const errs = Core.Store.validateAsset({ name: 'Old Wallet', assetClass: 'cash', dodValue: 0 });
  assert(!errs.dodValue);
});
test('validateAsset: null/value-empty allowed (estimate later)', () => {
  const errs = Core.Store.validateAsset({ name: 'Unknown Jewelry', assetClass: 'personal_property', dodValue: null });
  assert(!errs.dodValue, 'null value ok: ' + JSON.stringify(errs));
});
test('validateAsset: string money parsed/validated ("$304,851.49")', () => {
  const errs = Core.Store.validateAsset({ name: 'House', assetClass: 'real_estate', dodValue: '$304,851.49' });
  assert(!errs.dodValue);
});
test('validateAsset: unknown flag value rejected', () => {
  const errs = Core.Store.validateAsset({ name: 'X', assetClass: 'cash', dodValue: 10, outsideProbate: 'maybe' });
  assert(errs.outsideProbate, 'flag validated');
});
test('validateAsset: valid full entry passes', () => {
  const errs = Core.Store.validateAsset({
    name: 'House on Elm St', assetClass: 'real_estate', dodValue: 304851.49,
    outsideProbate: 'no', valuationSource: 'appraisal'
  });
  assert(Object.keys(errs).length === 0, JSON.stringify(errs));
});

console.log('\n[D2] Asset CRUD');
test('addAsset: ok + persisted + count reflects', () => {
  mock = mockStorage();
  const s = newStore();
  const eid = estateWith(s);
  const r = s.addAsset(eid, { name: 'House', assetClass: 'real_estate', dodValue: 304851.49, outsideProbate: 'no' });
  const res = r.ok ? r : JSON.stringify(r);
  assert(r.ok === true, 'added: ' + res);
  assert(s.state.estates[eid].assets.length === 1, '1 asset');
  assert(r.asset.dodValue === 304851.49, 'money normalized');
  const persisted = JSON.parse(mock.getItem(Core.STORAGE_KEY));
  assert(persisted.estates[eid].assets.length === 1, 'persisted');
});
test('addAsset: invalid → rejected, not stored', () => {
  mock = mockStorage();
  const s = newStore();
  const eid = estateWith(s);
  const r = s.addAsset(eid, { name: '', assetClass: 'cash', dodValue: 'x' });
  assert(!r.ok && r.errors.name, 'rejected');
  assert(s.state.estates[eid].assets.length === 0, 'nothing stored');
});
test('addAsset: unknown estate → error', () => {
  mock = mockStorage();
  const s = newStore();
  const r = s.addAsset('nope', { name: 'X', assetClass: 'cash', dodValue: 1 });
  assert(!r.ok && !r.errors.name, 'estate-level error');
});
test('addAsset fills defaults (outsideProbate=no? нет — unknown по умолчанию для честости)', () => {
  mock = mockStorage();
  const s = newStore();
  const eid = estateWith(s);
  const r = s.addAsset(eid, { name: 'Watch', assetClass: 'personal_property', dodValue: 250 });
  assert(r.asset.outsideProbate === 'unknown', 'default unknown: ' + r.asset.outsideProbate);
});
test('updateAsset + deleteAsset roundtrip', () => {
  mock = mockStorage();
  const s = newStore();
  const eid = estateWith(s);
  const a = s.addAsset(eid, { name: 'Watch', assetClass: 'personal_property', dodValue: 250 }).asset;
  const u = s.updateAsset(eid, a.id, { dodValue: 320 });
  assert(u.ok && s.state.estates[eid].assets[0].dodValue === 320);
  assert(s.deleteAsset(eid, a.id), 'deleted');
  assert(s.state.estates[eid].assets.length === 0);
});
test('updateAsset invalid value rejected', () => {
  mock = mockStorage();
  const s = newStore();
  const eid = estateWith(s);
  const a = s.addAsset(eid, { name: 'W', assetClass: 'cash', dodValue: 10 }).asset;
  const u = s.updateAsset(eid, a.id, { dodValue: -99 });
  assert(!u.ok && u.errors.dodValue, 'rejected');
  assert(s.state.estates[eid].assets[0].dodValue === 10, 'untouched');
});

console.log('\n[D2] Probate-инвентарь (totals): outside-probate исключается');
test('inventoryTotals: only probate assets counted', () => {
  mock = mockStorage();
  const s = newStore();
  const eid = estateWith(s);
  s.addAsset(eid, { name: 'House', assetClass: 'real_estate', dodValue: 300000, outsideProbate: 'no' });
  s.addAsset(eid, { name: 'Life insurance (TOD)', assetClass: 'other', dodValue: 50000, outsideProbate: 'yes' });
  s.addAsset(eid, { name: 'Bank account', assetClass: 'bank_account', dodValue: 12000.55, outsideProbate: 'no' });
  s.addAsset(eid, { name: 'Unknown jewelry', assetClass: 'personal_property', dodValue: null, outsideProbate: 'unknown' });
  const t = s.inventoryTotals(eid);
  assert(t.probateTotal === 312000.55, 'probate only: ' + t.probateTotal);
  assert(t.outsideTotal === 50000, 'outside separately');
  assert(t.unknownCount === 1, 'unknown flagged count');
  assert(t.count === 4, 'all listed');
});
test('inventoryTotals: unknown-asset assets НЕ двигают probate total', () => {
  mock = mockStorage();
  const s = newStore();
  const eid = estateWith(s);
  s.addAsset(eid, { name: 'Car', assetClass: 'vehicle', dodValue: 8000, outsideProbate: 'unknown' });
  const t = s.inventoryTotals(eid);
  assert(t.probateTotal === 0, 'unknown not counted: ' + t.probateTotal);
  assert(t.unknownCount === 1);
});
test('inventoryTotals: empty estate → zeros', () => {
  mock = mockStorage();
  const s = newStore();
  const eid = estateWith(s);
  const t = s.inventoryTotals(eid);
  assert(t.probateTotal === 0 && t.outsideTotal === 0 && t.count === 0);
});
test('inventoryTotals: unknown estate id → null', () => {
  mock = mockStorage();
  const s = newStore();
  assert(s.inventoryTotals('nope') === null);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
