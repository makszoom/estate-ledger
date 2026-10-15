/**
 * Estate Ledger — app.js (D1): UI wiring for Setup + estate switching + backup reminder.
 * Pure logic lives in core.js (tested in tests/test-core.js).
 */
(function () {
  'use strict';
  const { Store, US_STATES, ROLES, fmtMoney } = window.EstateLedgerCore;
  const store = new Store();

  const $ = (id) => document.getElementById(id);
  const els = {
    switcher: $('estate-switcher'), sel: $('estate-select'),
    setupEmpty: $('setup-empty'), setupForm: $('setup-form'),
    form: $('form-estate'),
    decedent: $('f-decedent'), caseNo: $('f-case'), state: $('f-state'),
    role: $('f-role'), dod: $('f-dod'),
    err: { decedent: $('err-decedent'), case: $('err-case'), state: $('err-state'), role: $('err-role'), dod: $('err-dod') },
    saveBtn: $('btn-save-estate'), deleteBtn: $('btn-delete-estate'),
    banner: $('backup-banner'), bannerDl: $('banner-download'), bannerDismiss: $('banner-dismiss'),
    modalDelete: $('modal-delete'), cancelDelete: $('btn-cancel-delete'), confirmDelete: $('btn-confirm-delete'),
    backupLink: $('backup-link'),
    counts: { assets: $('count-assets'), ledger: $('count-ledger') }
  };
  let editingId = null;
  let deletingId = null;

  // ---- state select options ----
  US_STATES.forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    els.state.appendChild(o);
  });

  // ---- tabs ----
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('panel-' + tab.dataset.tab).classList.add('active');
      render();
    });
  });

  // ---- validation error helpers (single source: core.js) ----
  function showErr(key, msg) {
    const el = els.err[key];
    if (!el) return;
    if (msg) { el.textContent = msg; el.classList.add('show'); }
    else { el.textContent = ''; el.classList.remove('show'); }
  }
  function clearErrs() { Object.keys(els.err).forEach(k => showErr(k, null)); }

  // ---- estate switching ----
  function renderSwitcher() {
    const list = store.listEstates();
    els.switcher.hidden = list.length === 0;
    els.sel.innerHTML = '';
    if (!list.length) { els.sel.appendChild(new Option('No estates', '')); return; }
    list.forEach(e => {
      els.sel.appendChild(new Option(
        `${e.decedent}${e.caseNumber ? ' · ' + e.caseNumber : ''}`, e.id));
    });
    els.sel.value = store.state.activeEstateId || (list[0] && list[0].id);
  }
  els.sel.addEventListener('change', () => {
    store.setActive(els.sel.value);
    editingId = els.sel.value;
    fillForm();
    render();
  });

  // ---- setup form ----
  function fillForm() {
    clearErrs();
    const e = store.getActive();
    for (const k of ['decedent', 'caseNumber', 'state', 'role', 'dateOfDeath']) {
      const input = { decedent: els.decedent, caseNumber: els.caseNo, state: els.state, role: els.role, dateOfDeath: els.dod }[k];
      if (e) input.value = e[k] || (k === 'role' ? 'executor' : '');
      else if (k === 'role') input.value = 'executor';
      else input.value = '';
    }
    els.setupEmpty.hidden = !!e;
    els.setupForm.hidden = !e;
    els.deleteBtn.hidden = !e;
    // Кнопку saveBtn здесь НЕ трогаем: submit-обработчик показывает 'Saved ✓' сам;
  }

  els.form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    clearErrs();
    const fields = {
      decedent: els.decedent.value.trim(),
      caseNumber: els.caseNo.value.trim(),
      state: els.state.value,
      role: els.role.value,
      dateOfDeath: els.dod.value
    };
    let res;
    if (editingId && store.state.estates[editingId]) {
      res = store.updateEstate(editingId, fields);
    } else {
      // editing an existing form state that lost its estate? create new
      res = store.createEstate(fields);
      if (res.ok) editingId = res.estateId;
    }
    if (!res.ok) {
      Object.entries(res.errors).forEach(([k, m]) => {
        const key = k === 'dateOfDeath' ? 'dod' : k === 'caseNumber' ? 'case' : k;
        showErr(key, m);
      });
      return;
    }
    // confirm visual feedback: button pulse
    els.saveBtn.textContent = 'Saved ✓';
    setTimeout(() => { els.saveBtn.textContent = 'Save estate'; }, 1200);
    renderSwitcher(); render();
  });

  // ---- delete flow ----
  els.deleteBtn.addEventListener('click', () => {
    deletingId = editingId;
    els.modalDelete.classList.add('open');
  });
  els.cancelDelete.addEventListener('click', () => {
    els.modalDelete.classList.remove('open');
  });
  els.confirmDelete.addEventListener('click', () => {
    if (deletingId) store.deleteEstate(deletingId);
    els.modalDelete.classList.remove('open');
    editingId = store.state.activeEstateId;
    fillForm();
    renderSwitcher(); render();
  });
  // modal close on overlay click
  els.modalDelete.addEventListener('click', (ev) => {
    if (ev.target === els.modalDelete) els.modalDelete.classList.remove('open');
  });

  // ---- create empty → auto-open create form ----
  $('btn-create-first').addEventListener('click', () => {
    editingId = null;
    els.setupEmpty.hidden = true;
    els.setupForm.hidden = false;
    els.deleteBtn.hidden = true;
    fillForm(); // keeps defaults but shows fresh
    els.setupForm.hidden = false; els.setupEmpty.hidden = true;
  });
  // link to sample
  document.querySelector('#setup-empty a').addEventListener('click', (ev) => {
    if (!window.EstateLedgerSample) { /* sample module lands in D7; no-op for now */ }
  });

  // ---- backup banner: weekly reminder ----
  function maybeShowBanner() {
    const e = store.getActive();
    if (!e) return;
    const last = e.lastBackupReminder || '';
    const tooSoon = last && Date.now() - new Date(last).getTime() < 7 * 864e5;
    els.banner.classList.toggle('show', !tooSoon);
    els.bannerDismiss.onclick = () => {
      e.lastBackupReminder = new Date().toISOString().slice(0, 10);
      store.save();
      els.banner.classList.remove('show');
    };
    els.bannerDl.onclick = () => exportJSON();
  }
  els.backupLink.addEventListener('click', (ev) => { ev.preventDefault(); exportJSON(); });

  function exportJSON() {
    const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const e = store.getActive();
    a.download = `estate-ledger-backup-${(e && e.decedent || 'all').replace(/\W+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
    if (e) { e.lastBackupReminder = new Date().toISOString().slice(0, 10); store.save(); els.banner.classList.remove('show'); }
  }
  // restore: file input hidden (D6 full flow)
  function restoreJSON(file) {
    file.text().then(txt => {
      const parsed = JSON.parse(txt);
      // light-weight validation, full in D6
      if (!parsed || !parsed.estates) { alert('This does not look like an Estate Ledger backup.'); return; }
      localStorage.setItem('el_state', JSON.stringify(parsed));
      store.load();
      editingId = store.state.activeEstateId;
      renderSwitcher(); fillForm(); render();
    }).catch(() => alert('Could not parse the backup file.'));
  }
  const restoreInput = document.createElement('input');
  restoreInput.type = 'file'; restoreInput.accept = '.json'; restoreInput.style.display = 'none';
  document.body.appendChild(restoreInput);
  restoreInput.addEventListener('change', () => { if (restoreInput.files[0]) restoreJSON(restoreInput.files[0]); });
  // Hold Shift + click on "Backup data" to restore (documented in D6 UI)
  els.backupLink.addEventListener('click', (ev) => {
    if (ev.shiftKey) { ev.preventDefault(); restoreInput.click(); }
  });

  // ---- render (tab counts + panels) ----
  function render() {
    const e = store.getActive();
    // counts placeholders for D2/D3 (0 for now)
    const assets = (e && e.assets && e.assets.length) || 0;
    const txs = (e && e.transactions && e.transactions.length) || 0;
    els.counts.assets.hidden = !assets; els.counts.assets.textContent = assets;
    els.counts.ledger.hidden = !txs; els.counts.ledger.textContent = txs;
    maybeShowBanner();
    fillForm();
  }

  // ---- init: ?sample=1 → D7 sample module (noop today) ----
  const params = new URLSearchParams(location.search);
  if (params.get('sample') === '1' && window.EstateLedgerSample) {
    window.EstateLedgerSample.install(store);
  }
  editingId = store.state.activeEstateId;
  renderSwitcher();
  render();
})();