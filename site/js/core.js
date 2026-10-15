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
      dateOfDeath: '', createdAt: todayISO(), lastBackupReminder: todayISO()
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
  }

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
    STORAGE_KEY, US_STATES, ROLES, ASSET_CLASSES, TX_KINDS, ACCOUNT_TYPE,
    Store, todayISO, uid, round2, parseMoney, fmtMoney, emptyState, emptyEstateFields
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.EstateLedgerCore = API;
})(typeof window !== 'undefined' ? window : globalThis);