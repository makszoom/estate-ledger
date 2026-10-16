/**
 * Estate Ledger — D14: CA court worksheet (companion, NOT the official Judicial Council form).
 * V2-SPEC Ф4: GC-400/GC-405 are conservatorship/guardianship forms — NOT decedent estates.
 * For CA decedent estates the court accepts a charge-and-discharge (carry-value) account —
 * which is what our report already produces. This worksheet: (а) maps our data onto the
 * GC-405 field order for conservatorship/guardianship side-cases executors often have,
 * (б) tells the user where each number goes when transferring to the official fillable PDF.
 */
(function (global) {
  'use strict';
  const CourtForms = {};

  const fmt = (n) => (n == null || isNaN(n)) ? '—' : (n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  /**
   * buildCAWorksheet(estateId, stateObj) → structured worksheet
   */
  CourtForms.buildCAWorksheet = function (estateId, stateObj) {
    const estate = stateObj && stateObj.estates && stateObj.estates[estateId];
    if (!estate) return null;
    const txs = estate.transactions || [];
    const receiptsIncome = Math.round(txs.filter(x => x.kind === 'money_in' && x.account === 'income' && !x.saleId)
      .reduce((s, x) => s + (x.amount || 0), 0) * 100) / 100;
    const receiptsPrincipal = Math.round(txs.filter(x => x.kind === 'money_in' && x.account === 'principal' && !x.saleId)
      .reduce((s, x) => s + (x.amount || 0), 0) * 100) / 100;
    const disbursementsTotal = Math.round(txs.filter(x => x.kind === 'money_out')
      .reduce((s, x) => s + (x.amount || 0), 0) * 100) / 100;
    const distributions = Math.round(txs.filter(x => x.kind === 'distribution')
      .reduce((s, x) => s + (x.amount || 0), 0) * 100) / 100;

    const scheduleA = txs.filter(x => x.kind === 'money_in' && x.account === 'income' && !x.saleId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(x => ({ date: x.date, description: x.description, amount: x.amount }));
    const scheduleC = txs.filter(x => x.kind === 'money_out')
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(x => ({ date: x.date, payee: x.payee || '', purpose: x.description, amount: x.amount }));
    const scheduleD = txs.filter(x => x.kind === 'distribution')
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(x => ({ date: x.date, description: x.description, amount: x.amount, beneficiary: x.beneficiary || '' }));

    const notes = [];
    notes.push('This is a companion worksheet — not an official court form. Transfer the figures to your court\u2019s fillable PDF or hand it to your attorney.');
    notes.push('GC-400/GC-405 forms are designed for CONSERVATORSHIPS and GUARDIANSHIPS (living protected persons), not decedent estates. If you also administer a conservatorship, this worksheet matches their field order.');
    notes.push('For a CA decedent estate the court expects an account in charge-and-discharge form at carrying value (Prob. Code §§1060-1064) — the Account tab under the Carry basis produces exactly that. Attach this worksheet only as a supporting schedule.');
    if (scheduleA.length > 5) {
      notes.push('More than 5 receipt rows: in a simplified (GC-405) accounting the Schedule A exceeds five pages — a STANDARD accounting (GC-400 series, Schedule A(1)–(6)) is required instead.');
    }
    if (estate.accountingBasis === 'carry') {
      notes.push('Values reflect the executor\u2019s carrying value of each asset (as taken under your control at the date of death), not current market value.');
    }

    return {
      header: {
        decedent: estate.decedent || '',
        caseNumber: estate.caseNumber || '',
        state: estate.state || '',
        role: estate.role || 'executor',
        dateOfDeath: estate.dateOfDeath || '',
        basis: estate.accountingBasis || 'standard'
      },
      summary: { receiptsIncome, receiptsPrincipal, disbursementsTotal, distributions },
      scheduleA, scheduleC, scheduleD,
      notes
    };
  };

  /** render worksheet → HTML (prints standalone; @media print hides chrome) */
  CourtForms.renderCAWorksheet = function (w) {
    if (!w) return '';
    const rowA = w.scheduleA.map(r =>
      `<div class="wsrow"><span>${r.date}</span><span>${r.description}</span><span>${fmt(r.amount)}</span></div>`).join('');
    const rowC = w.scheduleC.map(r =>
      `<div class="wsrow"><span>${r.date}</span><span>${r.purpose}</span><span>${r.payee}</span><span>${fmt(r.amount)}</span></div>`).join('');
    const rowD = w.scheduleD.map(r =>
      `<div class="wsrow"><span>${r.date}</span><span>${r.beneficiary}</span><span>${r.description}</span><span>${fmt(r.amount)}</span></div>`).join('');
    const notes = w.notes.map(n => `<p class="wsnote">${n}</p>`).join('');
    return `
<div class="wshead">
  <div class="ws-badge">COMPANION WORKSHEET — California GC-405 field order</div>
  <div class="ws-title">FIELD WORKSHEET FOR ${w.header.caseNumber ? 'CASE NO. ' + w.header.caseNumber : 'UNFILED CASE'}</div>
  <div class="ws-cap">In the Matter of the Estate of <b>${w.header.decedent || '—'}</b>${w.header.state ? ' · ' + w.header.state : ''}</div>
  <div class="ws-cap">Filed by the ${({executor:'Executor',administrator:'Administrator',personal_representative:'Personal Representative',trustee:'Trustee'}[w.header.role]) || 'Executor'}${w.header.dateOfDeath ? ' · Date of death: ' + w.header.dateOfDeath : ''}</div>
</div>
${notes}
<div class="wssec"><h4>SUMMARY OF ACCOUNT — key figures</h4>
  <div class="wsrow"><span>Receipts — Income (Schedule A total)</span><span>${fmt(w.summary.receiptsIncome)}</span></div>
  ${w.summary.receiptsPrincipal ? `<div class="wsrow"><span>Receipts — Principal (non-capital)</span><span>${fmt(w.summary.receiptsPrincipal)}</span></div>` : ''}
  <div class="wsrow"><span>Disbursements total (Schedule C total)</span><span>${fmt(w.summary.disbursementsTotal)}</span></div>
  <div class="wsrow"><span>Distributions to beneficiaries</span><span>${fmt(w.summary.distributions)}</span></div>
</div>
<div class="wssec"><h4>SCHEDULE A — RECEIPTS (non-capital items)</h4>
  <div class="wsrow ws-h"><span>Date of Receipt</span><span>Description</span><span>Amounts</span></div>
  ${rowA || '<p class="wsnone">No receipts recorded.</p>'}
</div>
<div class="wssec"><h4>SCHEDULE C — DISBURSEMENTS</h4>
  <div class="wsrow ws-h"><span>Date</span><span>Purpose</span><span>Payee</span><span>Amounts</span></div>
  ${rowC || '<p class="wsnone">No disbursements recorded.</p>'}
</div>
${w.scheduleD.length ? `<div class="wssec"><h4>DISTRIBUTIONS</h4>
  <div class="wsrow ws-h"><span>Date</span><span>Beneficiary</span><span>Description</span><span>Amounts</span></div>
  ${rowD}</div>` : ''}
<p class="ws-tail">Check the amounts against each blank on the official form at courts.ca.gov before filing; voucher copies (cancelled checks, receipts) must be attached.</p>`;
  };

  global.EstateLedgerCore.CourtForms = CourtForms;
})(typeof window !== 'undefined' ? window : globalThis);
