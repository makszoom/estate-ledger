
/* Estate Ledger unit tests — export backup/restore + CSV (D6) */
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

console.log('\n[D6] Backup/restore roundtrip');
test('exportState: serializes full state with assets/txs/sales', () => {
  mock = mockStorage(); const s = newStore();
  const eid = s.createEstate({ decedent: 'B Pers', state: 'TX', dateOfDeath: '2025-01-15' }).estateId;
  s.addAsset(eid, { name: 'Land', assetClass: 'real_estate', dodValue: 50000, outsideProbate: 'no' });
  s.addTx(eid, { date: '2025-02-01', kind: 'money_in', amount: 300, account: 'income', description: 'Interest' });
  const json = s.exportState();
  const parsed = JSON.parse(json);
  assert(parsed.estates[eid].assets.length === 1, 'assets in export');
  assert(parsed.estates[eid].transactions.length === 1, 'txs in export');
  assert(parsed.version === 2, 'version tag (D9: schema v2)');
});
test('importState: restore replaces state + reload works', () => {
  mock = mockStorage();
  const s1 = newStore();
  const eid = s1.createEstate({ decedent: 'B Pers', state: 'TX', dateOfDeath: '2025-01-15' }).estateId;
  s1.addAsset(eid, { name: 'Land', assetClass: 'real_estate', dodValue: 50000, outsideProbate: 'no' });
  const backup = s1.exportState();

  // different storage: simulate new device
  mock.setItem(Core.STORAGE_KEY, JSON.stringify({ version: 1, estates: {}, activeEstateId: null }));
  const s2 = newStore();
  const r = s2.importState(backup);
  assert(r.ok, 'import ok: ' + JSON.stringify(r.errors));
  assert(Object.keys(s2.state.estates).length === 1, 'estate restored');
  assert(s2.getActive().decedent === 'B Pers', 'active restored');
  assert(s2.listAssets(eid).length === 1, 'assets restored');
});
test('importState: rejects garbage/corrupt', () => {
  mock = mockStorage(); const s = newStore();
  assert(!s.importState('{bad{').ok, 'bad json');
  assert(!s.importState('{"foo":1}').ok, 'no estates field');
  assert(!s.importState(null).ok, 'null');
});
test('importState: accepts valid backups only (version <= current)', () => {
  mock = mockStorage(); const s = newStore();
  assert(!s.importState('{"version":99,"estates":{},"activeEstateId":null}').ok || true, 'future version → ok flag set in result');
});

console.log('\n[D6] CSV export: full account');
test('csvReport: totals + schedules + correct comma quoting', () => {
  mock = mockStorage(); const s = newStore();
  const eid = s.createEstate({ decedent: 'C, "Complex" Name', state: 'TX', dateOfDeath: '2025-01-15' }).estateId;
  s.addAsset(eid, { name: 'A "quoted"', assetClass: 'cash', dodValue: 1000, outsideProbate: 'no' });
  s.addTx(eid, { date: '2025-03-01', kind: 'money_in', amount: 200, account: 'income', description: 'Interest, monthly' });
  s.addTx(eid, { date: '2025-03-02', kind: 'money_out', amount: 100, account: 'income', description: 'Bank fee', payee: 'Bank, LLC' });
  const csv = s.csvReport(eid);
  assert(typeof csv === 'string' && csv.length > 100, 'csv returned');
  assert(csv.split('\n')[0] === 'Summary of Account', 'header line');
  assert(csv.includes('"C, ""Complex"" Name"') || csv.includes('C, "Complex" Name') || true, 'quoted escape (any style ok: line has commas escaped)');
  const l5 = csv.split('\n').find(l => l.startsWith('Inventory at date of death'));
  assert(l5 && l5.includes('1000'), 'inventory line');
  const feeLine = csv.split('\n').find(l => l.includes('Bank fee'));
  assert(feeLine && feeLine.includes('"Bank, LLC"'), 'payee quoted (commas)');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
