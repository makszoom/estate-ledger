/* Estate Ledger unit tests — core.js (D1: store + validation + estate setup) */
const assert = require('assert');
const path = require('path');
const Core = require(path.join(__dirname, '..', 'site', 'js', 'core.js'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '→', e.message); }
}

// ---- mock storage (per-test isolation) ----
function mockStorage() {
  const m = new Map();
  return {
    getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => m.set(k, v),
    removeItem: k => m.delete(k)
  };
}
function newStore() {
  const s = new Core.Store(
    k => mock.getItem(k),
    (k, v) => mock.setItem(k, v)
  );
  return s;
}
let mock;

// ---- Validation ----
console.log('\n[1] Estate validation');
test('rejects missing decedent', () => {
  const errs = Core.Store.validateEstate({ decedent: '', state: 'CA', dateOfDeath: '2025-01-01' });
  assert(errs.decedent, 'should flag decedent');
});
test('rejects non-US state', () => {
  const errs = Core.Store.validateEstate({ decedent: 'J Marshal', state: 'ZZ', dateOfDeath: '2025-01-01' });
  assert(errs.state, 'should flag state');
});
test('accepts DC as state', () => {
  const errs = Core.Store.validateEstate({ decedent: 'J Marshal', state: 'DC', dateOfDeath: '2025-01-01' });
  assert(!errs.state, 'DC valid: ' + errs.state);
});
test('rejects future date of death', () => {
  const errs = Core.Store.validateEstate({ decedent: 'J Marshal', state: 'CA', dateOfDeath: '2099-01-01' });
  assert(errs.dateOfDeath, 'future rejected');
});
test('rejects pre-1900 date (typo guard)', () => {
  const errs = Core.Store.validateEstate({ decedent: 'J Marshal', state: 'CA', dateOfDeath: '1899-12-31' });
  assert(errs.dateOfDeath, 'pre-1900 rejected');
});
test('valid date passes', () => {
  const errs = Core.Store.validateEstate({ decedent: 'J Marshal', state: 'CA', dateOfDeath: '2025-01-15' });
  assert(Object.keys(errs).length === 0, 'clean: ' + JSON.stringify(errs));
});
test('rejects unknown role', () => {
  const errs = Core.Store.validateEstate({ decedent: 'J', state: 'CA', dateOfDeath: '2025-01-01', role: 'wizard' });
  assert(errs.role, 'role flagged');
});
test('executor role passes', () => {
  const errs = Core.Store.validateEstate({ decedent: 'J', state: 'CA', dateOfDeath: '2025-01-01', role: 'executor' });
  assert(!errs.role);
});
test('rejects case number > 40 chars', () => {
  const errs = Core.Store.validateEstate({ decedent: 'J', state: 'CA', dateOfDeath: '2025-01-01', caseNumber: 'x'.repeat(41) });
  assert(errs.caseNumber);
});

// ---- Store CRUD ----
console.log('\n[2] Store: create/list/update/delete');
mock = mockStorage();
test('createEstate valid → ok + activeEstateId set + persisted', () => {
  const s = newStore();
  const r = s.createEstate({ decedent: 'J Marshal', state: 'CA', dateOfDeath: '2025-01-15', role: 'executor' });
  assert(r.ok, 'create ok');
  assert(s.state.activeEstateId === r.estateId, 'active set');
  const persisted = JSON.parse(mock.getItem(Core.STORAGE_KEY));
  assert(persisted.estates[r.estateId].decedent === 'J Marshal', 'persisted');
});
test('createEstate invalid → NOT saved, errors returned', () => {
  mock = mockStorage(); // изолировать: первый тест [2] пишет в общий mock
  const s = newStore();
  const r = s.createEstate({ decedent: '', state: 'CA', dateOfDeath: '2025-01-15' });
  assert(!r.ok && r.errors.decedent, 'errors surfaced');
  assert(Object.keys(s.state.estates).length === 0, 'nothing persisted');
});
test('createEstate fills defaults (role, createdAt)', () => {
  const s = newStore();
  const r = s.createEstate({ decedent: 'A Doe', state: 'NY', dateOfDeath: '2025-01-15' });
  const e = s.state.estates[r.estateId];
  assert(e.role === 'executor', 'default role');
  assert(e.createdAt, 'createdAt stamped');
});
test('updateEstate merges + validates', () => {
  const s = newStore();
  const r = s.createEstate({ decedent: 'A Doe', state: 'NY', dateOfDeath: '2025-01-15' });
  const u = s.updateEstate(r.estateId, { caseNumber: 'NY-123' });
  assert(u.ok, 'update ok');
  assert(s.state.estates[r.estateId].caseNumber === 'NY-123', 'merged');
  const bad = s.updateEstate(r.estateId, { dateOfDeath: '2099-01-01' });
  assert(!bad.ok && bad.errors.dateOfDeath, 'bad update rejected');
});
test('deleteEstate removes + clears active', () => {
  const s = newStore();
  const r = s.createEstate({ decedent: 'A', state: 'TX', dateOfDeath: '2025-01-15' });
  assert(s.deleteEstate(r.estateId), 'deleted');
  assert(s.state.activeEstateId === null, 'active cleared');
});
test('setActive rejects unknown id', () => {
  const s = newStore();
  assert(!s.setActive('nope'), 'unknown rejected');
});
test('listEstates returns array', () => {
  mock = mockStorage(); // изолировать
  const s = newStore();
  s.createEstate({ decedent: 'A', state: 'TX', dateOfDeath: '2025-01-15' });
  s.createEstate({ decedent: 'B', state: 'CA', dateOfDeath: '2025-02-15' });
  assert(s.listEstates().length === 2, 'two estates');
});
test('getActive returns null when none', () => {
  mock = mockStorage(); // изолировать
  const s = newStore();
  assert(s.getActive() === null);
});

// ---- Persistence roundtrip / corruption guard ----
console.log('\n[3] Persistence: reload & corruption');
test('reload restores state from storage', () => {
  mock = mockStorage();
  const s1 = newStore();
  const r = s1.createEstate({ decedent: 'Persist', state: 'FL', dateOfDeath: '2025-01-15' });
  const s2 = newStore(); // fresh store, same storage
  assert(s2.getActive().decedent === 'Persist', 'restored');
});
test('corrupt storage → empty state, no crash', () => {
  mock = mockStorage();
  mock.setItem(Core.STORAGE_KEY, '{corrupted{');
  const s = newStore();
  assert(Object.keys(s.state.estates).length === 0, 'reset to empty');
});
test('missing estates field → treated as corrupt', () => {
  mock = mockStorage();
  mock.setItem(Core.STORAGE_KEY, JSON.stringify({ foo: 1 }));
  const s = newStore();
  assert(s.state.estates, 'reset');
});

// ---- Money parsing/formatting (needed for ledger D3) ----
console.log('\n[4] Money utils');
test('parseMoney: "$304,851.49" → 304851.49', () => {
  assert(Core.parseMoney('$304,851.49') === 304851.49);
});
test('parseMoney: garbage → null', () => {
  assert(Core.parseMoney('abc') === null);
  assert(Core.parseMoney('') === null);
});
test('parseMoney: number passthrough + round2', () => {
  assert(Core.parseMoney(10.005) === 10.01, 'rounded to cents');
});
test('fmtMoney formats en-US', () => {
  assert(Core.fmtMoney(304851.49) === '$304,851.49', 'got ' + Core.fmtMoney(304851.49));
});
test('fmtMoney: null → dash', () => {
  assert(Core.fmtMoney(null) === '—');
});

// ---- Constants ----
console.log('\n[5] Constants');
test('50 states + DC', () => {
  assert(Core.US_STATES.length === 51, '51: ' + Core.US_STATES.length);
});
test('asset classes = 8', () => {
  assert(Core.ASSET_CLASSES.length === 8);
});
test('tx kinds = 4 (settled semantics)', () => {
  assert(JSON.stringify(Core.TX_KINDS) === JSON.stringify(['money_in','money_out','distribution','reimbursable']));
});
test('account types = principal/income', () => {
  assert(JSON.stringify(Core.ACCOUNT_TYPE) === JSON.stringify(['principal','income']));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);