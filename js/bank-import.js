/**
 * Estate Ledger — D12: Bank CSV Import (core logic, no DOM).
 * Privacy: file parsed IN BROWSER (FileReader), nothing uploaded.
 * Semantics (V2-SPEC §0.7): only money_in/money_out are ever created;
 * distribution/reimbursable never come from bank — matching sums produce a hint.
 */
(function (global) {
  'use strict';
  const BankImport = {};

  const stripBom = s => s.replace(/^\uFEFF/, '');

  /** Separator auto-detect on first line(s) */
  BankImport.detectFormat = function (csvText) {
    const head = stripBom(String(csvText || '')).split(/\r?\n/, 5).join('\n');
    const commas = (head.match(/,/g) || []).length;
    const semis = (head.match(/;/g) || []).length;
    const tabs = (head.match(/\t/g) || []).length;
    const sep = tabs >= Math.max(commas, semis) && tabs > 0 ? '\t' : (semis > commas ? ';' : ',');
    return { sep, head };
  };

  /** Bank money: "$1,234.56", "-50.00", "(1,234.56)", "1.234,56", "120.00 CR", "50.00 DR" */
  BankImport.parseBankMoney = function (v) {
    if (v == null) return null;
    let s = String(v).trim();
    if (s === '') return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/\bDR\b/i.test(s) && !/\bCR\b/i.test(s)) { neg = true; s = s.replace(/\bDR\b/i, ''); }
    s = s.replace(/\bCR\b/i, '').replace(/\bDB\b/i, '');
    s = s.replace(/[$€£]/g, '').trim();
    const dot = (s.match(/\./g) || []).length, comma = (s.match(/,/g) || []).length;
    if (dot === 1 && comma > 0 && /,\d{1,2}$/.test(s)) { s = s.replace(/\./g, '').replace(',', '.'); } // eu "1.234,56"
    else if (comma === 1 && dot === 0 && /,\d{1,2}$/.test(s)) { s = s.replace(',', '.'); } // "50,00"
    else { s = s.replace(/,/g, ''); } // us thousands
    const n = parseFloat(s);
    if (isNaN(n)) return null;
    const signed = neg || n < 0 ? -Math.abs(n) : Math.abs(n);
    return Math.round(signed * 100) / 100;
  };

  /** dates: ISO, US M/D/Y (2digit year → 20xx), "Jan 2, 2025", "02 Jan 2025" */
  BankImport.parseBankDate = function (v) {
    if (v == null) return null;
    const s = String(v).trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return s;
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
      const yy = m[3], mm = String(+m[1]).padStart(2, '0'), dd = String(+m[2]).padStart(2, '0');
      return yy + '-' + mm + '-' + dd;
    }
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/))) {
      const yy = '20' + m[3], mm = String(+m[1]).padStart(2, '0'), dd = String(+m[2]).padStart(2, '0');
      return yy + '-' + mm + '-' + dd;
    }
    const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
    if ((m = s.match(/^([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/i))) {
      const mo = MONTHS[m[1].slice(0,3).toLowerCase()];
      if (mo) return m[3] + '-' + String(mo).padStart(2, '0') + '-' + String(+m[2]).padStart(2, '0');
    }
    if ((m = s.match(/^(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})$/i))) {
      const mo = MONTHS[m[2].slice(0,3).toLowerCase()];
      if (mo) return m[3] + '-' + String(mo).padStart(2, '0') + '-' + String(+m[1]).padStart(2, '0');
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const yy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,'0'), dd2 = String(d.getDate()).padStart(2,'0');
      return yy + '-' + mm + '-' + dd2;
    }
    return null;
  };

  const DATE_HINT = /date|post|trans/i;
  const AMT_HINT = /amount|sum|value|amt/i;
  const DEB_HINT = /^(debit|withdraw)$/i;
  const CRE_HINT = /^(credit|deposit)$/i;
  const DESC_HINT = /desc|memo|name|detail|particular/i;

  /** mapColumns(rows) → {date, amount, debit, credit, description} column names found */
  BankImport.mapColumns = function (rows) {
    if (!rows || !rows.length) return {};
    const keys = Object.keys(rows[0]);
    const score = {};
    keys.forEach(k => {
      let n = 0;
      rows.slice(0, 5).forEach(r => {
        if (BankImport.parseBankDate(r[k])) n++;
      });
      score[k] = n;
    });
    const best = keys.slice().sort((a, b) => score[b] - score[a])[0];
    const date = score[best] >= (rows.length > 5 ? 3 : 2) ? best : (keys.find(k => DATE_HINT.test(k)) || best);
    // amount: try single-column amount
    let amount = null, debit = null, credit = null;
    const amountCandidates = keys.filter(k => k !== date);
    let bestAmt = null, bestAmtVal = 0;
    amountCandidates.forEach(k => {
      let val = 0;
      rows.slice(0, 5).forEach(r => { if (BankImport.parseBankMoney(r[k]) !== null) val++; });
      if (val > bestAmtVal) { bestAmtVal = val; bestAmt = k; }
    });
    if (bestAmtVal >= 3) amount = bestAmt;
    if (!amount) {
      const d = keys.find(k => DEB_HINT.test(k) || /debit/i.test(k));
      const c = keys.find(k => CRE_HINT.test(k) || /credit/i.test(k));
      if (d && c) { debit = d; credit = c; }
      else if (amountCandidates.length) { amount = bestAmt; }
    }
    const descKeys = keys.filter(k => k !== date && k !== amount && k !== debit && k !== credit);
    const desc = descKeys.find(k => DESC_HINT.test(k)) || descKeys.sort((a, b) => (a.length - b.length))[0] || null;
    return { date, amount, debit, credit, description: desc };
  };

  /** rows + mapping → normalized tx drafts {date, amount(kind-signed), kind, description} */
  BankImport.rowsToTx = function (rows, mapping) {
    const out = [];
    rows.forEach(r => {
      const date = BankImport.parseBankDate(r[mapping.date]);
      let amount = null, kind = null;
      if (mapping.amount) {
        amount = BankImport.parseBankMoney(r[mapping.amount]);
        if (amount === null) { out.push(null); return; }
        kind = amount >= 0 ? 'money_in' : 'money_out';
        amount = Math.abs(amount);
      } else if (mapping.debit && mapping.credit) {
        const dr = BankImport.parseBankMoney(r[mapping.debit]);
        const cr = BankImport.parseBankMoney(r[mapping.credit]);
        if (dr !== null && dr !== 0) { amount = Math.abs(dr); kind = 'money_out'; }
        else if (cr !== null && cr !== 0) { amount = Math.abs(cr); kind = 'money_in'; }
        else { out.push(null); return; }
      } else { out.push(null); return; }
      const description = mapping.description ? String(r[mapping.description] || '').trim() : '';
      out.push({ date, amount, kind, description });
    });
    return out.filter(Boolean);
  };

  /** full parse: text → {rows, format} */
  BankImport.parseBankCsv = function (csvText) {
    const fmt = BankImport.detectFormat(csvText);
    const Papa = global.Papa || (typeof window !== 'undefined' && window.Papa) || null;
    let rows;
    if (Papa) {
      const res = Papa.parse(stripBom(csvText), { delimiter: fmt.sep, header: true, skipEmptyLines: 'greedy' });
      rows = res.data;
    } else {
      // minimal CSV fallback (quoted fields supported)
      const lines = stripBom(csvText).split(/\r?\n/).filter(l => l.trim());
      if (!lines.length) return { rows: [], format: fmt };
      const parseLine = (line, sep) => {
        const cells = []; let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; continue; }
          if (ch === '"') { inQ = !inQ; continue; }
          if (ch === sep && !inQ) { cells.push(cur); cur = ''; continue; }
          cur += ch;
        }
        cells.push(cur); return cells;
      };
      const hdr = parseLine(lines[0], fmt.sep).map(x => x.trim());
      rows = lines.slice(1).map(l => {
        const cells = parseLine(l, fmt.sep), o = {};
        hdr.forEach((k, i) => o[k] = (cells[i] || '').trim());
        return o;
      }).filter(o => Object.values(o).some(x => x !== ''));
    }
    const mapping = BankImport.mapColumns(rows);
    const txs = BankImport.rowsToTx(rows, mapping).map(tx => {
      tx.kind = tx.kind;
      // kind auto-suggest refinements by description (interest etc. are money_in anyway)
      return tx;
    });
    return { rows: txs, format: fmt, mapping };
  };

  /** fingerprint: date + |amount| + normalized description */
  BankImport.fingerprint = function (date, amount, description) {
    const desc = String(description || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    return date + '|' + Math.abs(Math.round(amount * 100) / 100) + '|' + desc;
  };

  /**
   * markDuplicates(txDrafts, existingTxs) — flag dupes + distribution hints.
   * Never touches kind: only notes (V2-SPEC §0.7).
   * window: only ±90 days lookback handled by caller passing filtered list.
   */
  BankImport.markDuplicates = function (drafts, existingTx) {
    const known = new Set();
    (existingTx || []).forEach(tx => known.add(BankImport.fingerprint(tx.date, tx.amount, tx.description)));
    const distrs = (existingTx || []).filter(tx => tx.kind === 'distribution');
    return drafts.map(d => {
      const fp = BankImport.fingerprint(d.date, d.amount, d.description);
      const clone = Object.assign({}, d);
      clone.dupe = known.has(fp);
      if (clone.dupe) clone.dupeOfKind = 'tx';
      // distribution-match hint (informational)
      distrs.forEach(dx => {
        if (!clone.dupe && dx.amount === d.amount && dx.date === d.date) clone.dupeOfKind = 'distribution';
      });
      return clone;
    });
  };

  /** quota guard (V2-SPEC §0.5): current state JSON + added size must stay under ~4MB */
  BankImport.estJsonSize = function (s) { return String(s || '').length; };
  BankImport.quotaOk = function (stateObj, extra) {
    try {
      const cur = BankImport.estJsonSize(JSON.stringify(stateObj || {}));
      return cur + BankImport.estJsonSize(extra) < 4 * 1024 * 1024;
    } catch (e) { return false; }
  };

  global.EstateLedgerCore.BankImport = BankImport;
})(typeof window !== 'undefined' ? window : globalThis);
