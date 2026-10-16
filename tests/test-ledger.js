
/* Estate Ledger unit tests — cashflow ledger (D3) */
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
  const r = store.createEstate({ decedent: 'T Pers', state: 'CA', dateOfDeath: '2025-01-15' });
  assert(r.ok, 'estate: ' + JSON.stringify(r.errors));
  return r.estateId;
}

console.log('\n[D3] Transaction validation');
test('validateTx: missing date → error', () => {
  const errs = Core.Store.validateTx({ date: '', kind: 'money_in', amount: 100, account: 'principal', description: 'x' });
  assert(errs.date);
});
test('validateTx: future date rejected', () => {
  const errs = Core.Store.validateTx({ date: '2099-01-01', kind: 'money_in', amount: 100, account: 'principal', description: 'x' });
  assert(errs.date);
});
test('validateTx: date before DOD rejected (estate money only exists after death)', () => {
  const errs = Core.Store.validateTx({ date: '2024-01-01', kind: 'money_in', amount: 100, account: 'principal', description: 'x' }, { dateOfDeath: '2025-01-15' });
  assert(errs.date, 'pre-DOD flagged');
});
test('validateTx: date after death passes', () => {
  const errs = Core.Store.validateTx({ date: '2025-03-01', kind: 'money_in', amount: 100, account: 'principal', description: 'x' }, { dateOfDeath: '2025-01-15' });
  assert(!errs.date, JSON.stringify(errs));
});
test('validateTx: unknown kind rejected', () => {
  const errs = Core.Store.validateTx({ date: '2025-03-01', kind: 'donation', amount: 100, account: 'principal', description: 'x' });
  assert(errs.kind);
});
test('validateTx: kind required', () => {
  const errs = Core.Store.validateTx({ date: '2025-03-01', amount: 100, account: 'principal', description: 'x' });
  assert(errs.kind);
});
test('validateTx: amount <= 0 rejected', () => {
  assert(Core.Store.validateTx({ date: '2025-03-01', kind: 'money_in', amount: 0, account: 'principal', description: 'x' }).amount);
  assert(Core.Store.validateTx({ date: '2025-03-01', kind: 'money_in', amount: -50, account: 'principal', description: 'x' }).amount);
  assert(Core.Store.validateTx({ date: '2025-03-01', kind: 'money_in', amount: 'abc', account: 'principal', description: 'x' }).amount);
});
test('validateTx: string money ok ("$1,850.00")', () => {
  const errs = Core.Store.validateTx({ date: '2025-03-01', kind: 'money_in', amount: '$1,850.00', account: 'principal', description: 'x' });
  assert(!errs.amount);
});
test('validateTx: account principal/income only', () => {
  assert(Core.Store.validateTx({ date: '2025-03-01', kind: 'money_in', amount: 1, account: 'checking', description: 'x' }).account);
  assert(!Core.Store.validateTx({ date: '2025-03-01', kind: 'money_in', amount: 1, account: 'income', description: 'x' }).account);
});
test('validateTx: description required', () => {
  assert(Core.Store.validateTx({ date: '2025-03-01', kind: 'money_in', amount: 1, account: 'principal', description: '  ' }).description);
});
test('validateTx: reimbursable REQUIRES payee (who paid personally)', () => {
  const errs = Core.Store.validateTx({ date: '2025-03-01', kind: 'reimbursable', amount: 86.2, account: 'principal', description: 'Mileage', payee: '' });
  assert(errs.payee, 'reimbursable needs payee');
});
test('validateTx: reimbursable with payee passes', () => {
  const errs = Core.Store.validateTx({ date: '2025-03-01', kind: 'reimbursable', amount: 86.2, account: 'principal', description: 'Mileage', payee: 'Executor (self)' });
  assert(!errs.payee);
});
test('validateTx: distribution REQUIRES beneficiary', () => {
  const errs = Core.Store.validateTx({ date: '2025-03-01', kind: 'distribution', amount: 5000, account: 'principal', description: 'Cash to heir', beneficiary: '' });
  assert(errs.beneficiary);
});
test('validateTx: description ≥ court standard ("check" rejected as vague)', () => {
  const errs = Core.Store.validateTx({ date: '2025-03-01', kind: 'money_out', amount: 100, account: 'principal', description: 'check' });
  assert(errs.description, 'vague description flagged');
});
test('validateTx: full valid entry (disbursement) passes', () => {
  const errs = Core.Store.validateTx({
    date: '2025-03-06', kind: 'money_out', amount: 9480, account: 'principal',
    description: 'Funeral home — payment in full', payee: 'Sunrise Funeral'
  });
  assert(Object.keys(errs).length === 0, JSON.stringify(errs));
});

console.log('\n[D3] CRUD + normalization');
test('addTx normalizes money + fills missing optional fields', () => {
  mock = mockStorage();
  const s = newStore(); const eid = estateWith(s);
  const r = s.addTx(eid, { date: '2025-03-01', kind: 'money_in', amount: '$1,850.00', account: 'income', description: 'Rent income' });
  assert(r.ok, JSON.stringify(r.errors));
  assert(r.tx.amount === 1850, 'normalized: ' + r.tx.amount);
  assert(r.tx.date === '2025-03-01' && r.tx.account === 'income');
  assert(('payee' in r.tx) && ('beneficiary' in r.tx), 'optional keys normalized');
  assert(s.state.estates[eid].transactions.length === 1);
});
test('addTx invalid → rejected, not stored', () => {
  mock = mockStorage();
  const s = newStore(); const eid = estateWith(s);
  const r = s.addTx(eid, { date: '2024-01-01', kind: 'money_in', amount: 10, account: 'income', description: 'x' });
  assert(!r.ok && r.errors.date, 'pre-DOD rejected');
  assert(s.state.estates[eid].transactions.length === 0);
});
test('updateTx + deleteTx roundtrip', () => {
  mock = mockStorage();
  const s = newStore(); const eid = estateWith(s);
  const tx = s.addTx(eid, { date: '2025-03-01', kind: 'money_in', amount: 100, account: 'income', description: 'Rent income' }).tx;
  const u = s.updateTx(eid, tx.id, { amount: 200 });
  assert(u.ok && s.state.estates[eid].transactions[0].amount === 200);
  assert(s.deleteTx(eid, tx.id));
  assert(s.state.estates[eid].transactions.length === 0);
});
test('updateTx: changing date before DOD rejected', () => {
  mock = mockStorage();
  const s = newStore(); const eid = estateWith(s);
  const tx = s.addTx(eid, { date: '2025-03-01', kind: 'money_in', amount: 100, account: 'income', description: 'x' }).tx;
  const u = s.updateTx(eid, tx.id, { date: '2024-06-01' });
  assert(!u.ok && u.errors.date, 'invalid update rejected');
  assert(s.state.estates[eid].transactions[0].amount === 100, 'untouched');
});

console.log('\n[D3] Ledger totals: charge-discharge semant');
test('ledgerTotals: 4 kinds sum correctly (P/I separate)', () => {
  mock = mockStorage();
  const s = newStore(); const eid = estateWith(s);
  // principal
  s.addTx(eid, { date: '2025-03-04', kind: 'money_in',   amount: 500,  account: 'principal', description: 'Refund closing costs' });
  s.addTx(eid, { date: '2025-03-06', kind: 'money_out',  amount: 9480, account: 'principal', description: 'Funeral home' });
  s.addTx(eid, { date: '2025-03-11', kind: 'money_out',  amount: 435,  account: 'principal', description: 'County filing fee' });
  s.addTx(eid, { date: '2025-04-02', kind: 'distribution', amount: 5000, account: 'principal', description: 'Cash to heir A', beneficiary: 'A Marshal' });
  // income
  s.addTx(eid, { date: '2025-03-04', kind: 'money_in', amount: 312.04, account: 'income', description: 'Estate bank interest' });
  s.addTx(eid, { date: '2025-03-06', kind: 'money_out', amount: 200, account: 'income', description: 'Property tax escrow', payee: 'County' });
  // reimbursable (executor paid personally)
  s.addTx(eid, { date: '2025-04-09', kind: 'reimbursable', amount: 86.2, account: 'principal', description: 'Mileage', payee: 'Executor (self)' });
  const t = s.ledgerTotals(eid);
  assert(t.principal.receipts === 500, 'p receipts: ' + t.principal.receipts);
  assert(t.principal.disbursements === 9915, 'p disb: ' + t.principal.disbursements);
  assert(t.principal.distributions === 5000);
  assert(t.principal.reimbursable === 86.2);
  assert(t.income.receipts === 312.04);
  assert(t.income.disbursements === 200);
  // charge-discharge cash view: receipts - disb - distr (reimbursable = future claim, NOT yet estate cash)
  assert(t.principal.cashOnHand === 500 - 9915 - 5000, 'calc ' + t.principal.cashOnHand);  // reimbursable NOT deducted (future claim, not estate cash)
});
test('ledgerTotals: empty → zeros', () => {
  mock = mockStorage();
  const s = newStore(); const eid = estateWith(s);
  const t = s.ledgerTotals(eid);
  assert(t.principal.receipts === 0 && t.income.receipts === 0 && t.count === 0);
});
test('ledgerSort: transactions chronologically (court listing)', () => {
  mock = mockStorage();
  const s = newStore(); const eid = estateWith(s);
  s.addTx(eid, { date: '2025-04-02', kind: 'money_in', amount: 1, account: 'income', description: 'b rent' });
  s.addTx(eid, { date: '2025-03-04', kind: 'money_in', amount: 2, account: 'income', description: 'a refund' });
  const sorted = s.listTx(eid);
  assert(sorted[0].date === '2025-03-04', 'chronological');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
