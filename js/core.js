/**
 * Estate Ledger — D1: core store & Estate Setup module.
 * Pure-logic layer (no DOM): fully unit-testable.
 * Storage: localStorage key 'el_state' (one object, JSON).
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'el_state';
  const US_STATES = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
    'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
    'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
    'WV','WI','WY'
  ];
  const ROLES = ['executor', 'administrator', 'personal_representative', 'trustee'];
  const ASSET_CLASSES = [
    'real_estate', 'bank_account', 'brokerage', 'cash', 'personal_property',
    'vehicle', 'business_interest', 'other'
  ];
  const TX_KINDS = ['money_in', 'money_out', 'distribution', 'reimbursable'];
  const OUTSIDE_PROBATE = ['yes', 'no', 'unknown'];
  const VAGUE_DESCRIPTIONS = ['check', 'payment', 'paid', 'bill', 'deposit', 'transfer', 'money', 'cash', 'payment made', 'misc', 'various', 'stuff'];
  const VALUATION_SOURCES = ['appraisal', 'account_statement', 'market_estimate', 'tax_assessment', 'other'];
  const ASSET_CLASS_LABELS = {
    real_estate: 'Real Estate', bank_account: 'Bank Account', brokerage: 'Brokerage Account',
    cash: 'Cash', personal_property: 'Personal Property', vehicle: 'Vehicle',
    business_interest: 'Business Interest', other: 'Other'
  };
  const ACCOUNT_TYPE = ['principal', 'income'];

  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function uid() {
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  function parseMoney(v) {
    if (typeof v === 'number') return round2(v);
    if (typeof v === 'string') {
      const cleaned = v.replace(/[$,\s]/g, '');
      if (cleaned === '' || isNaN(parseFloat(cleaned))) return null;
      return round2(parseFloat(cleaned));
    }
    return null;
  }
  function fmtMoney(n) {
    if (n == null || isNaN(n)) return '—';
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  /** Default empty estate state */
  function emptyState() {
    return {
      version: 1,
      estates: {},
      activeEstateId: null
    };
  }
  function emptyEstateFields() {
    return {
      decedent: '', caseNumber: '', state: '', role: 'executor',
      dateOfDeath: '', createdAt: todayISO(), lastBackupReminder: todayISO(),
      assets: [], transactions: [], sales: []
    };
  }

  class Store {
    constructor(loadFn, saveFn) {
      this._load = loadFn || ((k) => global.localStorage.getItem(k));
      this._save = saveFn || ((k, v) => global.localStorage.setItem(k, v));
      this.state = null;
      this.load();
    }
    load() {
      const raw = this._load(STORAGE_KEY);
      if (!raw) { this.state = emptyState(); return this.state; }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !('estates' in parsed)) throw new Error('corrupt');
        this.state = parsed;
        // migrate forward defensively
        if (typeof parsed.version !== 'number') parsed.version = 1;
      } catch (e) {
        this.state = emptyState();
      }
      return this.state;
    }
    save() {
      this._save(STORAGE_KEY, JSON.stringify(this.state));
      return true;
    }
    /** Create an estate; returns estateId or null on validation error */
    createEstate(fields) {
      const errs = Store.validateEstate(fields);
      if (Object.keys(errs).length) return { ok: false, errors: errs };
      const id = uid();
      this.state.estates[id] = Object.assign(emptyEstateFields(), fields, {
        id, createdAt: todayISO()
      });
      this.state.activeEstateId = id;
      this.save();
      return { ok: true, estateId: id };
    }
    updateEstate(id, fields) {
      if (!this.state.estates[id]) return { ok: false, errors: { general: 'Estate not found' } };
      const merged = Object.assign({}, this.state.estates[id], fields);
      const errs = Store.validateEstate(merged);
      if (Object.keys(errs).length) return { ok: false, errors: errs };
      this.state.estates[id] = merged;
      this.save();
      return { ok: true };
    }
    deleteEstate(id) {
      if (!this.state.estates[id]) return false;
      delete this.state.estates[id];
      if (this.state.activeEstateId === id) this.state.activeEstateId = null;
      this.save();
      return true;
    }
    setActive(id) {
      if (!this.state.estates[id]) return false;
      this.state.activeEstateId = id;
      this.save();
      return true;
    }
    getActive() {
      return this.state.estates[this.state.activeEstateId] || null;
    }
    listEstates() {
      return Object.values(this.state.estates).sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
  // ---- D6: export/import/CSV ----
  exportState() {
    return JSON.stringify(this.state, null, 2);
  }
  importState(jsonString) {
    let parsed;
    try { parsed = JSON.parse(jsonString); } catch (e) { return { ok: false, errors: 'Not valid JSON' }; }
    if (!parsed || typeof parsed !== 'object') return { ok: false, errors: 'Not a JSON object' };
    if (!('estates' in parsed) || typeof parsed.estates !== 'object') return { ok: false, errors: 'Missing estates' };
    if (!('version' in parsed)) parsed.version = 1;
    if (typeof parsed.version !== 'number') return { ok: false, errors: 'Bad version' };
    this.state = parsed;
    this.save();
    return { ok: true };
  }
  csvReport(estateId) {
    const repo = this.buildAccountReport(estateId);
    if (!repo) return null;
    const q = (v) => { const s = String(v == null ? '' : v); return (/[",\n]/.test(s)) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const L = [];
    L.push('Summary of Account');
    L.push('Estate of,' + q(repo.estate.decedent || ''));
    L.push('Case number,' + q(repo.estate.caseNumber));
    L.push('');
    L.push('CHARGES,Amount');
    L.push('Inventory at date of death,' + repo.charges.inventory);
    L.push('Receipts Principal,' + repo.charges.receiptsPrincipal);
    L.push('Receipts Income,' + repo.charges.receiptsIncome);
    L.push('Gains on sales,' + repo.charges.gains);
    L.push('TOTAL CHARGES,' + repo.totals.charges);
    L.push('');
    L.push('CREDITS,Amount');
    L.push('Disbursements Principal,' + repo.credits.disbursementsPrincipal);
    L.push('Disbursements Income,' + repo.credits.disbursementsIncome);
    L.push('Losses on sales,' + repo.credits.losses);
    L.push('Distributions,' + repo.credits.distributions);
    L.push('Property on hand,' + repo.credits.assetsOnHand);
    L.push('TOTAL CREDITS,' + repo.totals.credits);
    L.push('');
    L.push('Schedule of Receipts');
    L.push('Date,Description,Account,Amount');
    repo.scheduleReceipts.forEach(r => L.push([r.date, q(r.description), r.account, r.amount].join(',')));
    L.push('');
    L.push('Schedule of Disbursements');
    L.push('Date,Description,Payee,Account,Amount');
    repo.scheduleDisbursements.forEach(d => L.push([d.date, q(d.description), q(d.payee), d.account, d.amount].join(',')));
    L.push('');
    L.push('Schedule of Distributions');
    L.push('Date,Beneficiary,Description,Amount');
    repo.scheduleDistributions.forEach(d => L.push([d.date, q(d.beneficiary), q(d.description), d.amount].join(',')));
    L.push('');
    L.push('Schedule of Sales');
    L.push('Date,Asset,DOD value,Net proceeds,Direction,Gain/Loss');
    const estate = this.state.estates[estateId];
    repo.scheduleSales.forEach(s0 => {
      const a = (estate.assets || []).find(x => x.id === s0.assetId);
      L.push([s0.date, q(a ? a.name : 'asset'), s0.dodValue, s0.netProceeds, s0.direction, s0.gainOrLoss].join(','));
    });
    return L.join('\n');
  }

  // ---- D2: Assets ----
  addAsset(estateId, fields) {
    const estate = this.state.estates[estateId];
    if (!estate) return { ok: false, errors: { general: 'Estate not found' } };
    const errs = Store.validateAsset(fields);
    if (Object.keys(errs).length) return { ok: false, errors: errs };
    const asset = {
      id: uid(),
      name: fields.name.trim(),
      assetClass: fields.assetClass,
      dodValue: parseMoney(fields.dodValue),
      outsideProbate: fields.outsideProbate || 'unknown',
      valuationSource: fields.valuationSource || '',
      reference: (fields.reference || '').trim(),
      createdAt: todayISO()
    };
    estate.assets = estate.assets || [];
    estate.assets.push(asset);
    this.save();
    return { ok: true, asset };
  }
  updateAsset(estateId, assetId, fields) {
    const estate = this.state.estates[estateId];
    if (!estate) return { ok: false, errors: { general: 'Estate not found' } };
    const idx = (estate.assets || []).findIndex(a => a.id === assetId);
    if (idx === -1) return { ok: false, errors: { general: 'Asset not found' } };
    const current = estate.assets[idx];
    const merged = Object.assign({}, current, fields);
    const errs = Store.validateAsset(merged);
    if (Object.keys(errs).length) return { ok: false, errors: errs };
    if (current.sold && 'dodValue' in fields && merged.dodValue !== current.dodValue)
      return { ok: false, errors: { general: 'This asset is sold — its date-of-death value is locked into the recorded sale. Undo the sale to change it.' } };
    if ('dodValue' in fields) merged.dodValue = parseMoney(merged.dodValue);
    estate.assets[idx] = merged;
    this.save();
    return { ok: true, asset: merged };
  }
  deleteAsset(estateId, assetId) {
    const estate = this.state.estates[estateId];
    if (!estate || !estate.assets) return false;
    const asset = estate.assets.find(a => a.id === assetId);
    if (!asset) return false;
    if (asset.sold) return { ok: false, error: 'Undo the sale first — the asset is linked to a recorded sale' };
    const before = estate.assets.length;
    estate.assets = estate.assets.filter(a => a.id !== assetId);
    if (estate.assets.length === before) return false;
    this.save();
    return true;
  }
  listAssets(estateId) {
    const estate = this.state.estates[estateId];
    return (estate && estate.assets) ? estate.assets : [];
  }
  /**
   * Court-standard inventory totals. 'unknown' ownership assets NOT counted
   * in probate total (Settled pattern: unknown is a legal fact to verify —
   * guessing makes totals look finished).
   */
  inventoryTotals(estateId) {
    const estate = this.state.estates[estateId];
    if (!estate) return null;
    const assets = estate.assets || [];
    let probateTotal = 0, outsideTotal = 0, unknownCount = 0;
    for (const a of assets) {
      const v = a.dodValue;
      if (a.outsideProbate === 'yes') outsideTotal += (v || 0);
      else if (a.outsideProbate === 'unknown') unknownCount++;
      else if (v != null) probateTotal += v;
    }
    return {
      probateTotal: round2(probateTotal),
      outsideTotal: round2(outsideTotal),
      unknownCount, count: assets.length
    };
  }

  // ---- D3: Cashflow transactions ----
  addTx(estateId, fields) {
    const estate = this.state.estates[estateId];
    if (!estate) return { ok: false, errors: { general: 'Estate not found' } };
    const errs = Store.validateTx(fields, estate);
    if (Object.keys(errs).length) return { ok: false, errors: errs };
    const tx = {
      id: uid(),
      date: fields.date,
      kind: fields.kind,
      account: fields.account,
      amount: parseMoney(fields.amount),
      description: fields.description.trim(),
      payee: (fields.payee || '').trim(),
      beneficiary: (fields.beneficiary || '').trim(),
      reference: (fields.reference || '').trim(),
      checkNo: (fields.checkNo || '').trim(),
      createdAt: todayISO()
    };
    estate.transactions = estate.transactions || [];
    estate.transactions.push(tx);
    this.save();
    return { ok: true, tx };
  }
  updateTx(estateId, txId, fields) {
    const estate = this.state.estates[estateId];
    if (!estate) return { ok: false, errors: { general: 'Estate not found' } };
    const idx = (estate.transactions || []).findIndex(x => x.id === txId);
    if (idx === -1) return { ok: false, errors: { general: 'Transaction not found' } };
    const merged = Object.assign({}, estate.transactions[idx], fields);
    const errs = Store.validateTx(merged, estate);
    if (Object.keys(errs).length) return { ok: false, errors: errs };
    merged.amount = parseMoney(merged.amount);
    estate.transactions[idx] = merged;
    this.save();
    return { ok: true, tx: merged };
  }
  deleteTx(estateId, txId) {
    const estate = this.state.estates[estateId];
    if (!estate || !estate.transactions) return false;
    const before = estate.transactions.length;
    estate.transactions = estate.transactions.filter(x => x.id !== txId);
    if (estate.transactions.length === before) return false;
    this.save();
    return true;
  }
  listTx(estateId) {
    const estate = this.state.estates[estateId];
    if (!estate || !estate.transactions) return [];
    // court listing = chronological
    return estate.transactions.slice().sort((a, b) => a.date.localeCompare(b.date));
  }
  /** Charge-and-discharge cash totals per account type (principal | income) */
  ledgerTotals(estateId) {
    const estate = this.state.estates[estateId];
    if (!estate) return null;
    const txs = estate.transactions || [];
    const sums = {
      principal: { receipts: 0, disbursements: 0, distributions: 0, reimbursable: 0 },
      income:    { receipts: 0, disbursements: 0, distributions: 0, reimbursable: 0 }
    };
    for (const x of txs) {
      const k = x.kind, a = x.account;
      const amt = x.amount || 0;
      if (k === 'money_in') sums[a].receipts += amt;
      else if (k === 'money_out') sums[a].disbursements += amt;
      else if (k === 'distribution') sums[a].distributions += amt;
      else if (k === 'reimbursable') sums[a].reimbursable += amt;
    }
    for (const key of ['principal', 'income']) {
      sums[key].disbursements = round2(sums[key].disbursements);
      sums[key].receipts = round2(sums[key].receipts);
      sums[key].distributions = round2(sums[key].distributions);
      sums[key].reimbursable = round2(sums[key].reimbursable);
      sums[key].cashOnHand = round2(
        sums[key].receipts - sums[key].disbursements - sums[key].distributions);
    }
    sums.count = txs.length;
    return sums;
  }

  // ---- D4: Asset sale (gain/loss) ----
  recordSale(estateId, assetId, fields) {
    const estate = this.state.estates[estateId];
    if (!estate) return { ok: false, errors: { general: 'Estate not found' } };
    const asset = (estate.assets || []).find(a => a.id === assetId);
    if (!asset) return { ok: false, errors: { general: 'Asset not found' } };
    if (asset.sold) return { ok: false, errors: { general: 'Asset is already sold' } };
    if (asset.outsideProbate === 'unknown')
      return { ok: false, errors: { general: 'Verify the ownership first — assets marked "verify" cannot be sold through the ledger yet' } };
    const errs = {};
    if (!fields || !fields.date) errs.date = 'Sale date is required';
    else {
      const d = new Date(fields.date + 'T00:00:00');
      if (isNaN(d.getTime())) errs.date = 'Valid sale date required';
      else if (d > new Date()) errs.date = 'Sale date cannot be in the future';
      else if (estate.dateOfDeath && fields.date < estate.dateOfDeath)
        errs.date = 'Sale date is before the date of death';
    }
    const gross = fields && fields.grossProceeds != null && fields.grossProceeds !== '' ? parseMoney(fields.grossProceeds) : null;
    const netDirect = fields && fields.netProceeds != null && fields.netProceeds !== '' ? parseMoney(fields.netProceeds) : null;
    const expenses = fields && fields.saleExpenses != null && fields.saleExpenses !== '' ? parseMoney(fields.saleExpenses) : null;
    if (gross !== null && netDirect !== null)
      return { ok: false, errors: { general: 'Enter either gross proceeds (with expenses) or net proceeds — not both' } };
    let net = netDirect;
    if (net === null && gross !== null) {
      if (gross <= 0) errs.proceeds = 'Proceeds must be a positive number';
      else if (expenses === null) errs.proceeds = 'Enter sale expenses (or 0 if none) to compute net proceeds';
      else net = round2(gross - expenses);
    } else if (net !== null && net <= 0) errs.proceeds = 'Proceeds must be a positive number';
    else if (net === null) errs.proceeds = 'Enter net proceeds (or gross + expenses)';
    if (Object.keys(errs).length) return { ok: false, errors: errs };
    const dod = asset.dodValue || 0;
    const diff = round2(net - dod);
    const direction = diff > 0 ? 'gain' : diff < 0 ? 'loss' : 'none';
    const saleId = uid();
    // Cash tx: proceeds are principal money (sale of an inventoried asset is principal, not income)
    const tx = {
      id: uid(), date: fields.date, kind: 'money_in', account: 'principal',
      amount: net, description: direction === 'none'
        ? `Net proceeds — sale of ${asset.name}`
        : `Net proceeds — sale of ${asset.name} (${direction} ${fmtMoney(Math.abs(diff))} vs date-of-death value)`,
      payee: '', beneficiary: '',
      reference: (fields.reference || '').trim(),
      checkNo: '', saleId, createdAt: todayISO()
    };
    const sale = {
      id: saleId, assetId, date: fields.date,
      grossProceeds: gross, saleExpenses: expenses,
      expenseDetail: (fields.expenseDetail || '').trim(),
      netProceeds: net, dodValue: dod,
      gainOrLoss: Math.abs(diff), direction,
      txId: tx.id, createdAt: todayISO()
    };
    estate.sales = estate.sales || [];
    estate.sales.push(sale);
    estate.transactions = estate.transactions || [];
    estate.transactions.push(tx);
    asset.sold = true; asset.saleId = saleId; asset.soldDate = fields.date;
    this.save();
    return { ok: true, sale, tx };
  }
  deleteSale(estateId, saleId) {
    const estate = this.state.estates[estateId];
    if (!estate || !estate.sales) return false;
    const sale = estate.sales.find(s => s.id === saleId);
    if (!sale) return false;
    estate.sales = estate.sales.filter(s => s.id !== saleId);
    estate.transactions = (estate.transactions || []).filter(x => x.saleId !== saleId);
    const asset = (estate.assets || []).find(a => a.id === sale.assetId);
    if (asset) { asset.sold = false; delete asset.saleId; }
    this.save();
    return true;
  }
  listSales(estateId) {
    const estate = this.state.estates[estateId];
    return (estate && estate.sales) ? estate.sales : [];
  }
  saleTotals(estateId) {
    const estate = this.state.estates[estateId];
    if (!estate) return null;
    const sales = estate.sales || [];
    let gains = 0, losses = 0, proceeds = 0;
    for (const s of sales) {
      if (s.direction === 'gain') gains += s.gainOrLoss;
      else if (s.direction === 'loss') losses += s.gainOrLoss;
      proceeds += s.netProceeds || 0;
    }
    return { gains: round2(gains), losses: round2(losses), proceeds: round2(proceeds), count: sales.length };
  }

  // ---- D5: Charge-and-Discharge report ----
  /**
   * Market-value approach (v1 standard): charges = inventory at DOD + additional property
   * received + receipts + gains on sales. credits = disbursements + losses + distributions
   * + property on hand (unsold assets carried at DOD + estate cash from transaction flows).
   * Reimbursable executor expenses are NOT estate cash (paid personally) — listed as memo.
   */
  buildAccountReport(estateId) {
    const estate = this.state.estates[estateId];
    if (!estate) return null;
    const assets = estate.assets || [];
    const txs = estate.transactions || [];
    const sales = estate.sales || [];

    const probate = assets.filter(a => a.outsideProbate !== 'yes');
    const nonProbate = assets.filter(a => a.outsideProbate === 'yes');

    // CHARGES
    const inventory = round2(probate.reduce((s, a) => s + (a.dodValue || 0), 0));
    const gains = round2(sales.reduce((s, x) => s + (x.direction === 'gain' ? x.gainOrLoss : 0), 0));
    // Schedule-A receipts EXCLUDE sale proceeds (court standard: proceeds enter via Gains
    // + property on hand as cash; counting them as receipts too would double-count).
    const receiptsPrincipal = round2(txs.filter(x => x.kind === 'money_in' && x.account === 'principal' && !x.saleId)
      .reduce((s, x) => s + (x.amount || 0), 0));
    const receiptsIncome = round2(txs.filter(x => x.kind === 'money_in' && x.account === 'income' && !x.saleId)
      .reduce((s, x) => s + (x.amount || 0), 0));

    // CREDITS
    const disbursementsPrincipal = round2(txs.filter(x => x.kind === 'money_out' && x.account === 'principal')
      .reduce((s, x) => s + (x.amount || 0), 0));
    const disbursementsIncome = round2(txs.filter(x => x.kind === 'money_out' && x.account === 'income')
      .reduce((s, x) => s + (x.amount || 0), 0));
    const losses = round2(sales.reduce((s, x) => s + (x.direction === 'loss' ? x.gainOrLoss : 0), 0));
    const distributions = round2(txs.filter(x => x.kind === 'distribution')
      .reduce((s, x) => s + (x.amount || 0), 0));

    // Property on hand = unsold probate assets (at DOD value in market approach) + estate cash
    // Estate cash from flows: receipts - disbursements - distributions (both accounts).
    // Sale proceeds already counted: they replaced the sold asset — the sold asset's DOD value
    // remains in inventory line, and its gain (proceeds − DOD) makes charges > credits by the
    // gain; the cash on hand must add the FULL net proceeds to offset: cash flows DO include
    // the proceeds tx (it's a money_in), so flows already carry it. Sold asset DOD is in
    // inventory though — that double-counts: inventory includes sold DOD AND flows include
    // proceeds. Court standard (market-value): inventory carries sold asset at DOD; its sale
    // produces gain (charges) and the cash replaces it; credits include distributions/payouts;
    // the remaining ASSET (unsold) listed at DOD; CASH remains as "assets on hand" =
    // flows-cash + unsold assets at DOD, MINUS sold DOD (discharged by sale)... In practice
    // charge-discharge balances: Inventory(sold DOD counted) + Gain = Cash received + remaining
    // assets held. We compute assetsOnHand = unsold probate DOD + (flows cash - receipts already counted?)
    // To avoid double count: assetsOnHand cash = receipts + proceeds - disbursements - distributions
    //   (proceeds ARE receipts via tx, so flows cash = receipts total + proceeds? proceeds tx IS
    //   a money_in receipt — receiptsPrincipal already includes it). So flowsCash =
    //   receiptsPrincipal + receiptsIncome - disbursementsPrincipal - disbursementsIncome -
    //   distributions. Unsold assets listed separately at DOD. Sold DOD excluded from onHand.
    // Estate cash on hand includes ALL money_in (sale proceeds too!) minus outflows.
    const allMoneyIn = round2(txs.filter(x => x.kind === 'money_in').reduce((s, x) => s + (x.amount || 0), 0));
    const flowsCash = round2(allMoneyIn - disbursementsPrincipal - disbursementsIncome - distributions);
    const unsoldProbate = round2(probate.filter(a => !a.sold).reduce((s, a) => s + (a.dodValue || 0), 0));
    const soldProbateDOD = round2(probate.filter(a => a.sold).reduce((s, a) => s + (a.dodValue || 0), 0));

    // Charges: inventory DOD counts SOLD too; but sold's DOD then must be charged out:
    // credits-side "discharged by sale" = soldProbateDOD. Market-value charge-discharge:
    // CHARGES: inventory + (received during admin: gains already include proceeds over DOD)
    //          receipts. CREDITS: disbursements + losses + distributions + onHand.
    // Balance identity: inventory + receipts + gains == disb + losses + distr + onHand
    //   where onHand = unsold DOD + flowsCash + soldDOD? NO — sold is replaced by cash:
    //   flowsCash includes proceeds; the sold DOD is "spent" in acquiring cash: so
    //   assetsOnHand should EXCLUDE sold DOD and rely purely on: unsold DOD + flowsCash,
    //   and charges include inventory (sold + unsold). Identity: inv + receipts + gains =
    //   disb + distr + losses + onHand, onHand = unsold + flowsCash.
    //   flowsCash = receipts - disb - distr. RHS = disb + distr + unsold + receipts - disb - distr = receipts + unsold.
    //   LHS = inv + receipts + gains. So identity ⇔ inv + gains == unsold. inv = sold + unsold
    //   ⇒ sold + gains == 0?? WRONG. The correct standard: sold DOD IS discharged by the cash —
    //   so onHand = flowsCash + unsoldDOD + 0 (sold's value left as cash in flows) AND charges
    //   inventory INCLUDES sold DOD (it was an asset at DOD). But then the identity fails by
    //   soldDOD unless we credit the sale conversion: the cash tx exists IN receipts (proceeds),
    //   so credits-side assetsOnHand holds the cash: LHS = inv + receipts + gains;
    //   RHS = disb + distr + losses + (unsold + flowsCash). flowsCash includes proceeds − disb − distr.
    //   proceeds = soldDOD + gain − loss(signed). LHS = (sold+unsold) + receipts + (proc−soldDOD)
    //     = unsold + proc + receipts. RHS = disb + distr + losses + unsold + (receipts − disb −
    //     distr + proc) − losses? hmm: flowsCash = receipts − disb − distr (receipts includes proc)
    //     RHS = disb + distr + losses + unsold + receipts − disb − distr = receipts − ... no wait:
    //     RHS = disb + losses + distr + [unsold + (receipts − disb − distr)] = unsold + receipts + losses.
    //     LHS − RHS = (sold + unsold + receipts + gains) − (unsold + receipts + losses)
    //       = sold + gains − losses. And gains − losses = (proc − soldDOD) ⇒ sold + proc − soldDOD = proc…
    //       no: gains − losses = Σ|proc − DOD| signed ⇒ gains − losses = proc − soldDOD.
    //       ⇒ LHS − RHS = sold − soldDOD = 0 (soldDOD == sold value) ✓ BALANCED BY CONSTRUCTION.
    const assetsOnHand = round2(unsoldProbate + flowsCash);
    // reimbursable: memo only (paid by executor personally)
    const reimbursableMemo = round2(txs.filter(x => x.kind === 'reimbursable')
      .reduce((s, x) => s + (x.amount || 0), 0));

    const charges = {
      inventory, additionalReceived: 0,
      receiptsPrincipal, receiptsIncome, gains
    };
    const credits = { disbursementsPrincipal, disbursementsIncome, losses, distributions, assetsOnHand };
    const totals = {
      charges: round2(inventory + gains + receiptsPrincipal + receiptsIncome),
      credits: round2(disbursementsPrincipal + disbursementsIncome + losses + distributions + assetsOnHand)
    };
    totals.balanced = totals.charges === totals.credits;
    totals.diff = round2(totals.charges - totals.credits);

    // Red flags: mathematically charge-discharge always balances (identity), but these
    // anomalies mean the underlying data is wrong and the report should not be filed yet.
    const redFlags = [];
    if (assetsOnHand < 0)
      redFlags.push({ type: 'negative_cash',
        message: 'Cash on hand is negative - disbursements and distributions exceed recorded receipts. Check for missing receipts.' });
    const unvalued = probate.filter(a => !a.sold && (a.dodValue == null) && a.outsideProbate === 'no');
    if (unvalued.length)
      redFlags.push({ type: 'unvalued', count: unvalued.length,
        message: unvalued.length + ' probate asset(s) have no date-of-death value yet - the inventory total is incomplete.' });
    const unverified = assets.filter(a => a.outsideProbate === 'unknown');
    if (unverified.length)
      redFlags.push({ type: 'unverified_ownership', count: unverified.length,
        message: unverified.length + ' asset(s) still marked "verify ownership" - they are excluded from the totals until you confirm.' });
    if (reimbursableMemo > 0)
      redFlags.push({ type: 'reimbursable_pending', amount: reimbursableMemo,
        message: 'Executor has ' + fmtMoney(reimbursableMemo) + ' of personally-paid expenses awaiting reimbursement (memo - not in totals).' });

    return {
      estate: { decedent: estate.decedent, caseNumber: estate.caseNumber || '',
        state: estate.state, dateOfDeath: estate.dateOfDeath },
      period: { from: estate.dateOfDeath, to: todayISO() },
      charges, credits, totals,
      balanceDiff: totals.diff, balanced: totals.balanced,
      redFlags,
      reimbursableMemo,
      nonProbate: nonProbate.map(a => ({ name: a.name, dodValue: a.dodValue })),
      scheduleReceipts: txs.filter(x => x.kind === 'money_in' && !x.saleId).sort((a,b)=>a.date.localeCompare(b.date))
        .map(x => ({ date: x.date, description: x.description, amount: x.amount,
          account: x.account, source: x.reference || x.payee || '' })),
      scheduleDisbursements: txs.filter(x => x.kind === 'money_out').sort((a,b)=>a.date.localeCompare(b.date))
        .map(x => ({ date: x.date, description: x.description, amount: x.amount,
          payee: x.payee, checkNo: x.checkNo || '', account: x.account })),
      scheduleDistributions: txs.filter(x => x.kind === 'distribution').sort((a,b)=>a.date.localeCompare(b.date))
        .map(x => ({ date: x.date, description: x.description, amount: x.amount, beneficiary: x.beneficiary })),
      scheduleSales: sales.slice()
    };
  }
}

    Store.validateTx = function (fields, estate) {
    const errs = {};
    if (!fields) return { general: 'No data' };
    if (!fields.date) errs.date = 'Date is required';
    else {
      const d = new Date(fields.date + 'T00:00:00');
      if (isNaN(d.getTime())) errs.date = 'Valid date required';
      else if (d > new Date()) errs.date = 'Date cannot be in the future';
      else if (estate && estate.dateOfDeath && fields.date < estate.dateOfDeath)
        errs.date = 'Date is before the date of death — estate money only exists after death';
    }
    if (!fields.kind) errs.kind = 'Movement type is required';
    else if (!TX_KINDS.includes(fields.kind)) errs.kind = 'Unknown movement type';
    const amt = parseMoney(fields.amount);
    if (amt === null || amt <= 0) errs.amount = 'Amount must be a positive number';
    if (!fields.account) errs.account = 'Account type required';
    else if (!ACCOUNT_TYPE.includes(fields.account)) errs.account = 'Principal or Income only';
    if (!fields.description || !fields.description.trim()) errs.description = 'Description is required';
    else if (VAGUE_DESCRIPTIONS.includes(fields.description.trim().toLowerCase())) errs.description = 'Too vague — write what this payment was for (e.g. "County filing fee for appointment petition")';
    if (fields.kind === 'reimbursable' && !(fields.payee || '').trim()) errs.payee = 'Who paid this personally?';
    if (fields.kind === 'distribution' && !(fields.beneficiary || '').trim()) errs.beneficiary = 'Who received the distribution?';
    return errs;
  };

  Store.validateAsset = function (fields) {
    const errs = {};
    if (!fields || !fields.name || !fields.name.trim()) errs.name = 'Asset description is required';
    else if (fields.name.trim().length > 120) errs.name = 'Maximum 120 characters';
    if (!fields || !fields.assetClass) errs.assetClass = 'Asset class is required';
    else if (!ASSET_CLASSES.includes(fields.assetClass)) errs.assetClass = 'Unknown asset class';
    if (fields) {
      const v = parseMoney(fields.dodValue);
      if (v !== null && v < 0) errs.dodValue = 'Value cannot be negative';
      if (fields.dodValue != null && fields.dodValue !== '' && v === null) errs.dodValue = 'Enter amount as a number (e.g. 35000 or $35,000)';
      if (fields.outsideProbate !== undefined && !OUTSIDE_PROBATE.includes(fields.outsideProbate)) errs.outsideProbate = 'yes/no/unknown only';
    }
    return errs;
  };


  Store.validateEstate = function (fields) {
    const errs = {};
    if (!fields || !fields.decedent || !fields.decedent.trim()) errs.decedent = 'Name of decedent is required';
    if (!fields || !fields.state) errs.state = 'State is required';
    else if (!US_STATES.includes(fields.state)) errs.state = 'US state code (e.g. CA) required';
    if (!fields || !fields.dateOfDeath) errs.dateOfDeath = 'Date of death is required';
    else {
      const d = new Date(fields.dateOfDeath + 'T00:00:00');
      if (isNaN(d.getTime())) errs.dateOfDeath = 'Valid date required';
      else if (d > new Date()) errs.dateOfDeath = 'Date of death cannot be in the future';
      else if (d < new Date('1900-01-01T00:00:00')) errs.dateOfDeath = 'Date before 1900 looks like a typo';
    }
    if (fields && fields.caseNumber && fields.caseNumber.length > 40) errs.caseNumber = 'Maximum 40 characters';
    if (fields && fields.role && !ROLES.includes(fields.role)) errs.role = 'Unknown role';
    return errs;
  };

  const API = {
    STORAGE_KEY, US_STATES, ROLES, ASSET_CLASSES, ASSET_CLASS_LABELS, OUTSIDE_PROBATE, VALUATION_SOURCES, TX_KINDS, ACCOUNT_TYPE,
    Store, todayISO, uid, round2, parseMoney, fmtMoney, emptyState, emptyEstateFields
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.EstateLedgerCore = API;
})(typeof window !== 'undefined' ? window : globalThis);