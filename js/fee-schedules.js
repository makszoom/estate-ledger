/**
 * Estate Ledger — D11: Statutory executor fee schedules (US).
 * SEPARATE FILE (V2-SPEC §0.2): laws change — each state carries statute ref + "Checked" date.
 * Sources (checked 2026-10-17): CA Prob. Code §10810/§10800, NY SCPA 2307, FL Stat. §733.617,
 * VA Code §64.2-1208 + Commissioner of Accounts guideline, MD Est. §6-107, NC G.S. §28A-6-1,
 * Mo. §473.153, Ohio Rev. Code §2113.35, Okla. §58-301, SDCL 29-2-7, OCGA §53-6-60,
 * SC §62-3-719, Ark. §28-48-108, Wis. §851.34, TX §242 (Prob. C.), Ala. §43-2-844.
 */
(function (global) {
  'use strict';

  const FEE_SCHEDULES = {
    CA: { type: 'tiers', basis: 'gross_probate_estate', statute: 'Prob. Code §10810 (PR: §10800)',
      checked: '2026-10-17',
      note: 'Fees are calculated on the GROSS probate estate — mortgage/lien amounts are NOT deducted, and only assets in probate count (non-probate/TOD assets excluded).',
      tiers: [ { upTo: 100000, rate: 4 }, { upTo: 100000, rate: 3 }, { upTo: 800000, rate: 2 }, { upTo: 9000000, rate: 1 }, { upTo: 15000000, rate: 0.5 } ] },
    NY: { type: 'tiers', basis: 'gross_probate_estate', statute: 'SCPA 2307', checked: '2026-10-17',
      tiers: [ { upTo: 100000, rate: 5 }, { upTo: 200000, rate: 4 }, { upTo: 700000, rate: 3 }, { upTo: 4000000, rate: 2.5 }, { upTo: 100000000, rate: 2 } ] },
    FL: { type: 'tiers', basis: 'gross_probate_estate', statute: 'Fla. Stat. §733.617', checked: '2026-10-17',
      tiers: [ { upTo: 1000000, rate: 3 }, { upTo: 4000000, rate: 2.5 }, { upTo: 5000000, rate: 2 }, { upTo: 10000000, rate: 1.5 } ] },
    MO: { type: 'tiers', basis: 'gross_probate_estate', statute: 'RSMo §473.153 (minimum)', checked: '2026-10-17',
      tiers: [ { upTo: 5000, rate: 5 }, { upTo: 20000, rate: 4 }, { upTo: 75000, rate: 3 }, { upTo: 300000, rate: 2.75 }, { upTo: 100000000, rate: 2 } ] },
    OK: { type: 'tiers', basis: 'gross_probate_estate', statute: 'Okla. Stat. §58-301', checked: '2026-10-17',
      tiers: [ { upTo: 20000, rate: 5 }, { upTo: 180000, rate: 4 }, { upTo: 10000000, rate: 2.5 } ] },
    SD: { type: 'tiers', basis: 'gross_probate_estate', statute: 'SDCL §29-2-7 (default)', checked: '2026-10-17',
      tiers: [ { upTo: 20000, rate: 5 }, { upTo: 180000, rate: 4 }, { upTo: 10000000, rate: 2.5 } ] },
    MD: { type: 'tiers', basis: 'gross_probate_estate', statute: 'Md. Code (Estates) §6-107', checked: '2026-10-17',
      tiers: [ { upTo: 20000, rate: 9 }, { upTo: 10000000, rate: 3.6 } ] },
    VA: { type: 'va_guideline', basis: 'gross_probate_estate', statute: 'Va. Code §64.2-1208 + Commissioner guideline', checked: '2026-10-17',
      note: 'Guideline schedule applied by Commissioners of Accounts: 5% first $400k, 4% next $300k, 3% next $300k, 2% above $1M — PLUS 5% of income received. Court may adjust.',
      core: [ { upTo: 400000, rate: 5 }, { upTo: 300000, rate: 4 }, { upTo: 300000, rate: 3 }, { upTo: 100000000, rate: 2 } ],
      incomeRate: 5 },
    OH: { type: 'tiers', basis: 'gross_probate_estate', statute: 'Ohio Rev. Code §2113.35', checked: '2026-10-17',
      note: 'Additional 1% of the value of unsold real property may be allowed.',
      unsoldRealtyRate: 1,
      tiers: [ { upTo: 100000, rate: 4 }, { upTo: 300000, rate: 3 }, { upTo: 100000000, rate: 2 } ] },
    GA: { type: 'flows', basis: 'receipts_and_disbursements', statute: 'OCGA §53-6-60', checked: '2026-10-17',
      note: 'Fee is 2.5% of money received IN plus 2.5% of money paid OUT (not on the estate value).',
      inRate: 2.5, outRate: 2.5 },
    TX: { type: 'flows', basis: 'receipts_and_disbursements', statute: 'Tex. Est. Code (Prob.) §242 (max)', checked: '2026-10-17',
      inRate: 5, outRate: 5,
      note: 'Maximum 5% of all amounts received and paid out. "Reasonable" may be less.' },
    NC: { type: 'flows', basis: 'receipts_and_disbursements', statute: 'G.S. §28A-6-1 (max)', checked: '2026-10-17',
      inRate: 5, outRate: 5,
      note: 'Commission capped: up to 5% of receipts and 5% of disbursements; court approves.' },
    AL: { type: 'flows', basis: 'receipts_and_disbursements', statute: 'Ala. Code §43-2-844', checked: '2026-10-17',
      inRate: 2.5, outRate: 2.5 },
    SC: { type: 'cap', basis: 'gross_probate_estate', statute: 'SC Code §62-3-719', checked: '2026-10-17',
      capRate: 5, note: 'Commission capped at 5% of the probate estate.' },
    AR: { type: 'tiers', basis: 'personal_property', statute: 'Ark. Code §28-48-108', checked: '2026-10-17',
      note: 'Tiers apply to PERSONAL property only; realty compensation set by court.',
      tiers: [ { upTo: 100000, rate: 10 }, { upTo: 400000, rate: 5 }, { upTo: 100000000, rate: 3 } ] },
    WI: { type: 'cap', basis: 'gross_probate_estate', statute: 'Wis. Stat. §851.34', checked: '2026-10-17',
      capRate: 2, note: 'Up to 2% of the estate; extraordinary services need court approval.' },
    MI: { type: 'tiers', basis: 'probate_estate_after_debts', statute: 'MCL §700.3721(c)', checked: '2026-10-17',
      note: 'Percentages of the probate estate AFTER payment of debts: 5%/3%/1.35%/0.75%/0.45%/0.3% by size.',
      tiers: [ { upTo: 10000, rate: 5 }, { upTo: 99000, rate: 3 }, { upTo: 13000, rate: 1.35 }, { upTo: 914000, rate: 0.75 }, { upTo: 457300, rate: 0.45 }, { upTo: 100000000, rate: 0.3 } ] },
    HI: { type: 'tiers', basis: 'gross_probate_estate', statute: 'HRS §560:3-719', checked: '2026-10-17',
      tiers: [ { upTo: 1000, rate: 6 }, { upTo: 5000, rate: 4 }, { upTo: 20000, rate: 3.5 }, { upTo: 200000, rate: 2.5 }, { upTo: 100000000, rate: 2 } ] },
    IA: { type: 'tiers', basis: 'gross_probate_estate', statute: 'Iowa Code §633.197', checked: '2026-10-17',
      tiers: [ { upTo: 1000, rate: 6 }, { upTo: 5000, rate: 4 }, { upTo: 20000, rate: 3.5 }, { upTo: 200000, rate: 2.5 }, { upTo: 100000000, rate: 2 } ] },
    MS: { type: 'cap', basis: 'gross_probate_estate', statute: 'Miss. Code §91-7-283', checked: '2026-10-17',
      capRate: 5, note: 'Maximum 5%; reasonable amount allowed.' },
    NM: { type: 'tiers', basis: 'gross_probate_estate', statute: 'NMSA §45-3-820', checked: '2026-10-17',
      tiers: [ { upTo: 1000, rate: 6 }, { upTo: 5000, rate: 4 }, { upTo: 20000, rate: 3.5 }, { upTo: 200000, rate: 2.5 }, { upTo: 100000000, rate: 2 } ] },
    NV: { type: 'tiers', basis: 'gross_probate_estate', statute: 'NRS §150.150', checked: '2026-10-17',
      tiers: [ { upTo: 100000, rate: 4 }, { upTo: 200000, rate: 3 }, { upTo: 500000, rate: 2 }, { upTo: 1000000, rate: 1.5 }, { upTo: 100000000, rate: 0.75 } ] },
    MT: { type: 'tiers', basis: 'gross_probate_estate', statute: 'MCA §72-3-606', checked: '2026-10-17',
      tiers: [ { upTo: 5000, rate: 5 }, { upTo: 60000, rate: 3.5 }, { upTo: 1000000, rate: 2 } ] },
    WY: { type: 'tiers', basis: 'gross_probate_estate', statute: 'Wyo. Stat. §2-7-812', checked: '2026-10-17',
      tiers: [ { upTo: 1000, rate: 6 }, { upTo: 5000, rate: 4 }, { upTo: 20000, rate: 3.5 }, { upTo: 200000, rate: 2.5 }, { upTo: 100000000, rate: 2 } ] },
    KY: { type: 'cap', basis: 'gross_probate_estate', statute: 'KRS §395.150 (max)', checked: '2026-10-17',
      capRate: 5, note: 'Maximum 5% (settled by court; family executors often use less).'
    }
  };

  function round2(n) { return Math.round(n * 100) / 100; }
  function parseMoney(v) {
    if (typeof v === 'number') return round2(v);
    if (typeof v === 'string') { const c = v.replace(/[$,\s]/g, ''); if (c === '' || isNaN(parseFloat(c))) return null; return round2(parseFloat(c)); }
    return null;
  }

  function tiersFee(tiers, value) {
    let fee = 0, remaining = value, prev = 0;
    for (const tier of tiers) {
      if (remaining <= 0) break;
      const span = Math.min(remaining, tier.upTo);
      fee += span * tier.rate / 100;
      remaining -= span; prev = tier.upTo;
    }
    // value ABOVE the last tier: apply the last tier rate to the rest (court-set above cap)
    if (remaining > 0 && tiers.length) fee += remaining * tiers[tiers.length - 1].rate / 100;
    return round2(fee);
  }

  /**
   * calculateStatutoryFee(stateCode, estateValue, { income, disbursements, unsoldRealty })
   * Returns { fee, statute, basis, basisNote, reasonable, formula } — user-facing fields.
   */
  function calculateStatutoryFee(stateCode, estateValue, opts) {
    opts = opts || {};
    const sch = FEE_SCHEDULES[stateCode];
    const base = parseMoney(estateValue) || 0;
    const mk = (fee, extra) => Object.assign({
      fee: fee,
      statute: sch.statute,
      basis: sch.basis,
      basisNote: sch.note || '',
      reasonable: false,
      formula: sch.type
    }, extra || {});
    if (!sch) return { fee: null, reasonable: true,
      basisNote: 'Reasonable compensation state: courts typically approve 1.5%-5% of the probate estate; check your county\'s custom.',
      formula: 'reasonable' };

    if (sch.type === 'tiers') {
      let fee = tiersFee(sch.tiers, base);
      if (sch.unsoldRealtyRate && opts.unsoldRealty) fee = round2(fee + base * sch.unsoldRealtyRate / 100);
      return mk(fee);
    }
    if (sch.type === 'va_guideline') {
      let fee = tiersFee(sch.core, base);
      const income = parseMoney(opts.income) || 0;
      fee = round2(fee + income * sch.incomeRate / 100);
      return mk(fee);
    }
    if (sch.type === 'flows') {
      const inc = parseMoney(opts.income) || 0, disb = parseMoney(opts.disbursements) || 0;
      return mk(round2(inc * sch.inRate / 100 + disb * sch.outRate / 100));
    }
    if (sch.type === 'cap') {
      const fee = round2(base * sch.capRate / 100);
      return mk(fee, { reasonable: true, note: (sch.note || '') + ' Statutory maximum shown.' });
    }
    return { fee: null, reasonable: true, formula: 'reasonable', basisNote: 'Reasonable compensation state.' };
  }

  global.EstateLedgerCore = global.EstateLedgerCore || {};
  global.EstateLedgerCore.FEE_SCHEDULES = FEE_SCHEDULES;
  global.EstateLedgerCore.calculateStatutoryFee = calculateStatutoryFee;
})(typeof window !== 'undefined' ? window : { window: (typeof globalThis !== 'undefined' ? globalThis : this) });
