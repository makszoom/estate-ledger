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
    counts: { assets: $('count-assets'), ledger: $('count-ledger') },
    // D2: assets
    aForm: $('form-asset'), aName: $('a-name'), aClass: $('a-class'), aValue: $('a-value'),
    aProbate: $('a-probate'), aSource: $('a-source'), aRef: $('a-ref'),
    aErr: { name: $('aerr-name'), class: $('aerr-class'), value: $('aerr-value'), probate: $('aerr-probate') },
    aSave: $('btn-save-asset'), aCancel: $('btn-cancel-asset'),
    aTbody: $('assets-tbody'), aEmpty: $('assets-empty'), aWrap: $('assets-table-wrap'),
    tProbate: $('tot-probate'), tOutside: $('tot-outside'), tOutsideRow: $('tot-outside-row'),
    tUnRow: $('tot-unknown-row'), tUn: $('tot-unknown'),
    // D3: ledger
    tForm: $('form-tx'), tDate: $('t-date'), tKind: $('t-kind'), tAmount: $('t-amount'),
    tAcct: $('t-acct'), tDesc: $('t-desc'), tPayee: $('t-payee'), tBenef: $('t-benef'),
    tRef: $('t-ref'), tErr: { date: $('terr-date'), kind: $('terr-kind'), amount: $('terr-amount'),
      acct: $('terr-acct'), desc: $('terr-desc'), payee: $('terr-payee'), benef: $('terr-benef') },
    tkindHint: $('kind-hint'), tSave: $('btn-save-tx'), tCancel: $('btn-cancel-tx'),
    tTbody: $('tx-tbody'), tEmpty: $('tx-empty'), tWrap: $('tx-table-wrap'),
    gPayee: $('group-payee'), gBenef: $('group-beneficiary'),
    pIn: $('p-in'), pOut: $('p-out'), pDistr: $('p-distr'), pReimb: $('p-reimb'), pCash: $('p-cash'),
    iIn: $('i-in'), iOut: $('i-out'), iDistr: $('i-distr'), iCash: $('i-cash')
  };
  let editingId = null;
  let deletingId = null;

  // ---- state select options ----
  US_STATES.forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    els.state.appendChild(o);
  });
  // D2: asset class options
  const { ASSET_CLASSES, ASSET_CLASS_LABELS } = window.EstateLedgerCore;
  ASSET_CLASSES.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = ASSET_CLASS_LABELS[c];
    els.aClass.appendChild(o);
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

  // ---- D2: assets form ----
  let editingAssetId = null;
  function showAssetErr(key, msg) {
    const el = els.aErr[key];
    if (!el) return;
    if (msg) { el.textContent = msg; el.classList.add('show'); }
    else { el.textContent = ''; el.classList.remove('show'); }
  }
  function resetAssetForm() {
    editingAssetId = null;
    els.aForm.reset();
    els.aProbate.value = 'unknown';
    showAssetErr('name', null); showAssetErr('class', null); showAssetErr('value', null); showAssetErr('probate', null);
    els.aSave.textContent = 'Add asset';
    els.aCancel.hidden = true;
  }
  els.aCancel.addEventListener('click', resetAssetForm);

  els.aForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fields = {
      name: els.aName.value,
      assetClass: els.aClass.value,
      dodValue: els.aValue.value.trim() === '' ? null : els.aValue.value,
      outsideProbate: els.aProbate.value,
      valuationSource: els.aSource.value,
      reference: els.aRef.value
    };
    const estateId = store.state.activeEstateId;
    if (!estateId) return;
    const wasEdit = !!editingAssetId;
    const res = wasEdit
      ? store.updateAsset(estateId, editingAssetId, fields)
      : store.addAsset(estateId, fields);
    if (!res.ok) {
      Object.entries(res.errors).forEach(([k, m]) => showAssetErr(k, m));
      return;
    }
    resetAssetForm();  // сброс ДО feedback: editingAssetId уже null
    els.aSave.textContent = wasEdit ? 'Updated ✓' : 'Added ✓';
    setTimeout(() => { els.aSave.textContent = 'Add asset'; }, 1100);
    render();
  });

  function renderAssets() {
    const estateId = store.state.activeEstateId;
    if (!estateId) { els.aTbody.innerHTML = ''; els.aEmpty.hidden = false; els.aWrap.hidden = true; els.aForm.style.display = 'none'; return; }
    els.aForm.style.display = '';
    const list = store.listAssets(estateId);
    els.aEmpty.hidden = list.length > 0;
    els.aWrap.hidden = list.length === 0;
    els.aTbody.innerHTML = '';
    list.forEach(a => {
      const tr = document.createElement('tr');
      const flagCls = a.outsideProbate === 'yes' ? 'flag yes' : a.outsideProbate === 'unknown' ? 'flag unknown' : 'flag';
      const flagTxt = a.outsideProbate === 'yes' ? 'outside' : a.outsideProbate === 'unknown' ? 'verify' : 'in probate';
      const val = a.dodValue == null ? '<span class="none">to appraise</span>' : fmtMoney(a.dodValue);
      tr.innerHTML = `<td><b>${esc(a.name)}</b>${a.reference ? `<div style="font-size:12px;color:var(--gray-text)">${esc(a.reference)}</div>` : ''}</td>` +
        `<td class="aclass">${esc(ASSET_CLASS_LABELS[a.assetClass] || a.assetClass)}</td>` +
        `<td class="r">${val}</td>` +
        `<td><span class="${flagCls}">${flagTxt}</span></td>` +
        `<td><div class="row-actions"><button class="link-btn" data-edit="${a.id}">Edit</button><button class="link-btn danger" data-del="${a.id}">Delete</button></div></td>`;
      els.aTbody.appendChild(tr);
    });
    // totals
    const t = store.inventoryTotals(estateId);
    els.tProbate.textContent = fmtMoney(t.probateTotal);
    els.tOutsideRow.hidden = !(t.outsideTotal > 0);
    els.tOutside.textContent = fmtMoney(t.outsideTotal);
    els.tUnRow.hidden = !t.unknownCount;
    els.tUn.textContent = `${t.unknownCount} asset${t.unknownCount === 1 ? '' : 's'}`;
  }

  // delegation: edit/delete buttons
  els.aTbody.addEventListener('click', (ev) => {
    const editId = ev.target.dataset.edit;
    const delId = ev.target.dataset.del;
    const estateId = store.state.activeEstateId;
    if (!estateId) return;
    if (editId) {
      const a = store.listAssets(estateId).find(x => x.id === editId);
      if (!a) return;
      editingAssetId = editId;
      els.aName.value = a.name;
      els.aClass.value = a.assetClass;
      els.aValue.value = a.dodValue == null ? '' : String(a.dodValue);
      els.aProbate.value = a.outsideProbate;
      els.aSource.value = a.valuationSource || '';
      els.aRef.value = a.reference || '';
      els.aSave.textContent = 'Save changes';
      els.aCancel.hidden = false;
      els.aName.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (delId) {
      if (store.deleteAsset(estateId, delId)) { if (editingAssetId === delId) resetAssetForm(); render(); }
    }
  });

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ---- D3: ledger form ----
  const KIND_LABELS = { money_in: 'In', money_out: 'Out', distribution: 'Distribution', reimbursable: 'Reimbursable' };
  const KIND_HINTS = {
    money_in: 'Estate received money (interest, rent, refund, sale proceeds).',
    money_out: 'The estate paid a bill, tax, filing fee, or professional.',
    distribution: 'Money or property delivered to a beneficiary. Record only after it actually happened.',
    reimbursable: 'You paid personally — tracked as a claim against the estate until the estate repays you.'
  };
  let editingTxId = null;
  function showTxErr(key, msg) {
    const el = els.tErr[key];
    if (!el) return;
    if (msg) { el.textContent = msg; el.classList.add('show'); }
    else { el.textContent = ''; el.classList.remove('show'); }
  }
  function resetTxForm() {
    editingTxId = null;
    els.tForm.reset();
    els.tAcct.value = 'principal';
    els.gBenef.hidden = true;
    els.gPayee.style.display = '';
    els.tkindHint.hidden = true;
    Object.keys(els.tErr).forEach(k => showTxErr(k, null));
    els.tSave.textContent = 'Add transaction';
    els.tCancel.hidden = true;
  }
  // kind selector: hint + conditional fields
  els.tKind.addEventListener('change', () => {
    const k = els.tKind.value;
    els.tkindHint.hidden = !k;
    if (k) els.tkindHint.textContent = KIND_HINTS[k];
    els.gBenef.hidden = k !== 'distribution';
    els.gPayee.style.display = (k === 'money_in') ? 'none' : '';
    if (k === 'reimbursable') els.tPayee.placeholder = 'Who paid? e.g. yourself ("Executor (self)")';
  });

  els.tCancel.addEventListener('click', resetTxForm);

  els.tForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const estateId = store.state.activeEstateId;
    if (!estateId) return;
    Object.keys(els.tErr).forEach(k => showTxErr(k, null));
    const e = store.getActive();
    const fields = {
      date: els.tDate.value,
      kind: els.tKind.value,
      amount: els.tAmount.value.trim(),
      account: els.tAcct.value,
      description: els.tDesc.value,
      payee: els.tPayee.value,
      beneficiary: els.tBenef.value,
      reference: els.tRef.value
    };
    const wasEdit = !!editingTxId;
    const res = wasEdit
      ? store.updateTx(estateId, editingTxId, fields)
      : store.addTx(estateId, fields);
    if (!res.ok) {
      Object.entries(res.errors).forEach(([k, m]) => {
        const key = { account: 'acct', beneficiary: 'benef', description: 'desc' }[k] || k;
        showTxErr(key, m);
      });
      return;
    }
    resetTxForm();
    els.tSave.textContent = wasEdit ? 'Updated ✓' : 'Added ✓';
    setTimeout(() => { els.tSave.textContent = 'Add transaction'; }, 1100);
    render();
  });

  function renderLedger() {
    const estateId = store.state.activeEstateId;
    if (!estateId) { els.tTbody.innerHTML = ''; els.tEmpty.hidden = false; els.tWrap.hidden = true; els.tForm.style.display = 'none'; return; }
    els.tForm.style.display = '';
    const list = store.listTx(estateId);
    els.tEmpty.hidden = list.length > 0;
    els.tWrap.hidden = list.length === 0;
    els.tTbody.innerHTML = '';
    list.forEach(x => {
      const tr = document.createElement('tr');
      const sub = [];
      if (x.account === 'income') sub.push('income');
      if (x.payee) sub.push('to/by ' + x.payee);
      if (x.beneficiary) sub.push(x.beneficiary);
      if (x.reference) sub.push(x.reference);
      const sign = x.kind === 'money_in' ? '' : '−';
      tr.innerHTML = `<td>${esc(x.date)}</td>` +
        `<td><b>${esc(x.description)}</b>${sub.length ? `<div class="tx-sub">${esc(sub.join(' · '))}</div>` : ''}</td>` +
        `<td><span class="tx-kind k-${x.kind}">${KIND_LABELS[x.kind]}</span></td>` +
        `<td class="r">${sign}${fmtMoney(x.amount)}</td>` +
        `<td><div class="row-actions"><button class="link-btn" data-edit-tx="${x.id}">Edit</button><button class="link-btn danger" data-del-tx="${x.id}">Delete</button></div></td>`;
      els.tTbody.appendChild(tr);
    });
    const t = store.ledgerTotals(estateId);
    els.pIn.textContent = fmtMoney(t.principal.receipts);
    els.pOut.textContent = fmtMoney(t.principal.disbursements);
    els.pDistr.textContent = fmtMoney(t.principal.distributions);
    els.pReimb.textContent = fmtMoney(t.principal.reimbursable);
    els.pCash.textContent = fmtMoney(t.principal.cashOnHand);
    els.iIn.textContent = fmtMoney(t.income.receipts);
    els.iOut.textContent = fmtMoney(t.income.disbursements);
    els.iDistr.textContent = fmtMoney(t.income.distributions);
    els.iCash.textContent = fmtMoney(t.income.cashOnHand);
  }

  els.tTbody.addEventListener('click', (ev) => {
    const editId = ev.target.dataset.editTx;
    const delId = ev.target.dataset.delTx;
    const estateId = store.state.activeEstateId;
    if (!estateId) return;
    if (editId) {
      const x = store.listTx(estateId).find(t => t.id === editId);
      if (!x) return;
      editingTxId = editId;
      els.tDate.value = x.date; els.tKind.value = x.kind; els.tAmount.value = String(x.amount);
      els.tAcct.value = x.account; els.tDesc.value = x.description;
      els.tPayee.value = x.payee || ''; els.tBenef.value = x.beneficiary || ''; els.tRef.value = x.reference || '';
      els.tKind.dispatchEvent(new Event('change'));
      els.tSave.textContent = 'Save changes';
      els.tCancel.hidden = false;
      els.tDate.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (delId) {
      if (store.deleteTx(estateId, delId)) { if (editingTxId === delId) resetTxForm(); render(); }
    }
  });

  // ---- render (tab counts + panels) ----
  function render() {
    const e = store.getActive();
    const assets = (e && e.assets && e.assets.length) || 0;
    const txs = (e && e.transactions && e.transactions.length) || 0;
    els.counts.assets.hidden = !assets; els.counts.assets.textContent = assets;
    renderAssets();
    const txs2 = (e && e.transactions && e.transactions.length) || 0;
    els.counts.ledger.hidden = !txs2; els.counts.ledger.textContent = txs2;
    renderLedger();
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