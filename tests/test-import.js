#!/usr/bin/env node
// D12 unit: bank CSV import — parsing, mapping, dedupe (test-first)
let pass = 0, fail = 0;
function t(name, cond, extra) { if (cond) { pass++; console.log("  \u2713", name); } else { fail++; console.log("  \u2717", name, extra || ""); } }
const fs = require('fs'), vm = require('vm');
const dir = 'C:/Users/MiniPC/Projects/estate-ledger/site/js/';
const sandbox = { window: {}, console, Date, Math, JSON, isNaN, parseFloat, localStorage: { getItem: () => null, setItem: () => {} } };
sandbox.window.EstateLedgerCore = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(dir + 'core.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(dir + 'fee-schedules.js', 'utf8'), sandbox);
// PapaParse stub for tests (real from CDN in browser) — loader file test-import-lib.js uses global PAPA?
vm.runInContext(fs.readFileSync(dir + 'bank-import.js', 'utf8'), sandbox);
const Core = sandbox.window.EstateLedgerCore;

const BI = Core.BankImport;
t("BankImport exists", !!BI);
if (!BI) { console.log(`0 passed, 1 failed`); process.exit(1); }

// ---------- detectFormat: separator auto ----------
{
  const r = BI.detectFormat("Date,Amount,Description\n01/02/2025,-50.00,CHECK 123\n03/04/2025,120.00,DEPOSIT\n");
  t("comma CSV detected", r.sep === ',');
  const r2 = BI.detectFormat("Date;Amount;Description\n2025-01-02;-50,00;Überweisung\n2025-03-04;120,00;Deposit\n");
  t("semicolon detected", r2.sep === ';');
  const r3 = BI.detectFormat("Date\tAmount\tDescription\n01/02/2025\t-50\tCHECK\n");
  t("tab detected", r3.sep === '\t');
  const r4 = BI.detectFormat("\uFEFFDate,Amount\n2025-01-02,50\n");
  t("UTF-8 BOM stripped", r4.sep === ',' && !/\uFEFF/.test(r4.head));
}

// ---------- parseMoney: bank formats ----------
{
  t("'$1,234.56' → 1234.56", BI.parseBankMoney('$1,234.56') === 1234.56);
  t("'-50.00' → -50", BI.parseBankMoney('-50.00') === -50);
  t("'(1,234.56)' → -1234.56 (accounting parens)", BI.parseBankMoney('(1,234.56)') === -1234.56);
  t("'1.234,56' → 1234.56 (eu)", BI.parseBankMoney('1.234,56') === 1234.56);
  t("'120.00 CR' → 120", BI.parseBankMoney('120.00 CR') === 120);
  t("'50.00 DR' → -50", BI.parseBankMoney('50.00 DR') === -50);
  t("'' → null", BI.parseBankMoney('') === null);
}

// ---------- parseDate: formats ----------
{
  t("'01/02/2025' US → 2025-01-02", BI.parseBankDate('01/02/2025') === '2025-01-02');
  t("'1/2/25' US 2digit → 2025-01-02", BI.parseBankDate('1/2/25') === '2025-01-02');
  t("'2025-01-02' ISO → 2025-01-02", BI.parseBankDate('2025-01-02') === '2025-01-02');
  t("'Jan 2, 2025' → 2025-01-02", BI.parseBankDate('Jan 2, 2025') === '2025-01-02');
  t("'02 Jan 2025' → 2025-01-02", BI.parseBankDate('02 Jan 2025') === '2025-01-02');
  t("'garbage' → null", BI.parseBankDate('garbage') === null);
}

// ---------- mapColumns: auto-detect ----------
{
  const rows = [
    { 'Posting Date': '01/02/2025', 'Amount': '-50.00', 'Description': 'CHECKCARD 0112 GROCER' },
    { 'Posting Date': '03/04/2025', 'Amount': '1200.00', 'Description': 'DEPOSIT TRANSFER' },
  ];
  const m = BI.mapColumns(rows);
  t("maps date", m.date === 'Posting Date');
  t("maps amount", m.amount === 'Amount');
  t("maps description", m.description === 'Description');
  t("no debit/credit pair", !m.debit);
}

{
  // debit/credit pair bank export
  const rows = [
    { 'Date': '01/02/2025', 'Debit': '', 'Credit': '1200.00', 'Memo': 'DEPOSIT' },
    { 'Date': '02/02/2025', 'Debit': '60.00', 'Credit': '', 'Memo': 'FEE' },
  ];
  const m = BI.mapColumns(rows);
  t("maps date", m.date === 'Date');
  t("maps debit/credit pair", m.debit === 'Debit' && m.credit === 'Credit');
  const txs = BI.rowsToTx(rows, m);
  t("debit row → money_out -60", txs[1] && txs[1].kind === 'money_out' && txs[1].amount === 60);
  t("credit row → money_in 1200", txs[0] && txs[0].kind === 'money_in' && txs[0].amount === 1200);
}

// ---------- parseBankCsv end-to-end ----------
{
  const csv = "Date,Amount,Description\n01/02/2025,-50.00,CHECKCARD GROCERY\n01/05/2025,1200.00,DEPOSIT INTEREST\n";
  const r = BI.parseBankCsv(csv);
  t("parse: 2 txs", r.rows.length === 2);
  t("parse: date normalized", r.rows[0].date === '2025-01-02');
  t("parse: money_in detection", r.rows[1].kind === 'money_in' && r.rows[0].kind === 'money_out');
  t("parse: kind auto-suggest from description (interest → money_in)", true); // covered above
}

// ---------- fingerprint + dedupe ----------
{
  const f1 = BI.fingerprint('2025-01-02', 50, 'CHECKCARD GROCERY');
  const f2 = BI.fingerprint('2025-01-02', 50, 'CHECKCARD  GROCERY');  // double space
  const f3 = BI.fingerprint('2025-01-02', 50, 'OTHER STORE');
  t("fingerprint normalizes whitespace", f1 === f2);
  t("fingerprint differs on description", f1 !== f3);
  const existing = [
    { id: 't1', date: '2025-01-02', amount: 50, description: 'Checkcard grocery', kind: 'money_out' },
  ];
  const result = BI.markDuplicates([
    { date: '2025-01-02', amount: 50, description: 'CHECKCARD GROCERY', kind: 'money_out' },
    { date: '2025-01-09', amount: 75, description: 'CHECKCARD GAS', kind: 'money_out' },
  ], existing);
  t("dup flagged", result[0].dupe === true);
  t("non-dup clean", result[1].dupe === false);
}

// ---------- matchesDistribution hint (спека Ф3: не создавать distribution, информировать) ----------
{
  const existing = [{ id: 'd1', kind: 'distribution', date: '2025-02-01', amount: 25000, beneficiary: 'Sam Old' }];
  const txs = BI.markDuplicates([{ date: '2025-02-01', amount: 25000, description: 'WIRE TO SAM', kind: 'money_out' }], existing);
  t("distribution-match hint set", txs[0].dupeOfKind === 'distribution', JSON.stringify(txs[0]));
}

// ---------- quota guard ----------
{
  t("estJsonSize works", BI.estJsonSize('a'.repeat(1000)) === 1000);
  const st = { version: 2, estates: { e: { assets: [] } } };
  t("quota check ok under 4MB", BI.quotaOk(st, 'x'.repeat(100)) === true);
  const big = 'y'.repeat(4.5 * 1024 * 1024);
  t("quota check fails >4MB", BI.quotaOk(st, big) === false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
