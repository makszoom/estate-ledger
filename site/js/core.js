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
      assets: [], transactions: []
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
    const merged = Object.assign({}, estate.assets[idx], fields);
    const errs = Store.validateAsset(merged);
    if (Object.keys(errs).length) return { ok: false, errors: errs };
    if ('dodValue' in fields) merged.dodValue = parseMoney(merged.dodValue);
    estate.assets[idx] = merged;
    this.save();
    return { ok: true, asset: merged };
  }
  deleteAsset(estateId, assetId) {
    const estate = this.state.estates[estateId];
    if (!estate || !estate.assets) return false;
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