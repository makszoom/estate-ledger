/**
 * Estate Ledger — Sample Estate (D7): fictional read-only demo.
 * Installs a fully-worked sample estate (assets, ledger, sale, balanced report)
 * so a first-time visitor can inspect the product without entering real data.
 *
 * Usage: /app.html?sample=1  → window.EstateLedgerSample.install(store)
 */
(function (global) {
  'use strict';

  const Sample = {
    id: 'el-sample-estate',

    install(store) {
      // Don't duplicate: if already present, just set active + exit
      if (store.state.estates[this.id]) {
        store.setActive(this.id);
        return { ok: true, existed: true };
      }
      const eid = this.id;
      store.state.estates[eid] = Object.assign(
        global.EstateLedgerCore.emptyEstateFields(), {
        id: eid,
        decedent: 'Jane E. Sample (fictional)',
        caseNumber: 'SAMPLE-114',
        state: 'CA',
        role: 'executor',
        dateOfDeath: '2025-01-15',
        sample: true,
        createdAt: global.EstateLedgerCore.todayISO()
      });
      store.state.activeEstateId = eid;

      const A = (name, cls, val, prob, src, ref) =>
        store.addAsset(eid, { name, assetClass: cls, dodValue: val, outsideProbate: prob, valuationSource: src, reference: ref });

      // Assets (6)
      A('Home at 414 Larkspur Dr', 'real_estate', 412000, 'no', 'appraisal', 'Valley Appraisal Co., Jan 20');
      A('Chase checking account ••4521', 'bank_account', 18240.55, 'no', 'account_statement', 'Statement 01/15');
      A('Vanguard brokerage ••7730', 'brokerage', 96410, 'no', 'account_statement', 'Statement 01/15');
      A('2019 Honda CR-V', 'vehicle', 14500, 'no', 'market_estimate', 'KBB private-party');
      A('Life insurance policy (TOD to daughter)', 'other', 50000, 'yes', 'account_statement', '');
      A('Coin collection (value unclear)', 'personal_property', null, 'unknown', 'other', 'Needs professional appraisal');
      A('Personal jewelry', 'personal_property', 6800, 'no', 'market_estimate', 'Estate sale quote');

      // Sell the home (gain)
      const home = store.listAssets(eid).find(a => a.name.startsWith('Home at'));
      store.recordSale(eid, home.id, {
        date: '2025-04-11', grossProceeds: 445000, saleExpenses: 28400,
        expenseDetail: 'brokerage commission + closing costs', reference: 'escrow 2025-04-11'
      });

      const T = (date, kind, amt, acct, desc, payee, benef, ref) =>
        store.addTx(eid, { date, kind, amount: amt, account: acct, description: desc, payee: payee || '', beneficiary: benef || '', reference: ref || '' });

      // Ledger (11 movements, chronological)
      T('2025-02-20', 'reimbursable', 128.40, 'principal', 'County certified copies of death certificate (12 × $10.70)', 'Executor (self)', '');
      T('2025-02-28', 'money_out', 18000, 'principal', 'Funeral and burial — payment in full', 'Pacific Crest Funeral Home', '', 'check 1041');
      T('2025-03-04', 'money_in', 214.32, 'income', 'Interest earned — estate checking account', '', '', 'Chase ••4521');
      T('2025-03-06', 'money_out', 435, 'principal', 'Probate court filing fee — petition for probate', 'Superior Court of California', '', 'check 1042');
      T('2025-03-10', 'money_out', 620, 'principal', 'Homeowner insurance premium — Larkspur property (2 months)', 'Waverly Mutual Insurance', '', 'check 1043');
      T('2025-03-15', 'money_out', 2850, 'principal', 'Property cleanup and landscaping — Larkspur property', 'GreenScape Services', '', 'check 1044');
      T('2025-03-04', 'money_in', 1180.66, 'income', 'Rental income — nothing; dividend from brokerage', '', '', '');
      T('2025-04-15', 'money_in', 96.15, 'income', 'Interest earned — estate checking account', '', '', 'Chase ••4521');
      T('2025-05-01', 'money_out', 6400, 'principal', 'Executor statutory commission — partial payment', 'Executor (self)', '', 'check 1045');
      T('2025-05-18', 'distribution', 25000, 'principal', 'Preliminary distribution — cash to beneficiary', '', 'Emily Marshal (daughter)', 'wire 0518');
      T('2025-05-30', 'money_out', 1200, 'income', 'Bank service fees and maintenance (estate account)', 'Chase Bank', '');

      store.save();
      return { ok: true, estateId: eid, installed: true };
    },

    uninstall(store) {
      if (!store.state.estates[this.id]) return false;
      store.deleteEstate(this.id);
      return true;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Sample;
  else global.EstateLedgerSample = Sample;
})(typeof window !== 'undefined' ? window : globalThis);