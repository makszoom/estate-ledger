/**
 * Estate Ledger — app.js (D1): UI wiring for Setup + estate switching + backup reminder.
 * Pure logic lives in core.js (tested in tests/test-core.js).
 */
(function () {
  'use strict';
  const { Store, US_STATES, ROLES, fmtMoney, calculateStatutoryFee, FEE_SCHEDULES } = window.EstateLedgerCore;
  const store = new Store();
  window.__ELStore = store;  // test/e2e access (read-only usage)

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
    iIn: $('i-in'), iOut: $('i-out'), iDistr: $('i-distr'), iCash: $('i-cash'),
    // D4: sale
    mSale: $('modal-sale'), saleForm: $('form-sale'), saleTitle: $('sale-title'),
    saleAssetLine: $('sale-asset-line'),
    sDate: $('s-date'), sNet: $('s-net'), sGross: $('s-gross'), sExp: $('s-exp'),
    sExpdet: $('s-expdet'), sRef: $('s-ref'),
    sgNet: $('sg-net'), sgGross: $('sg-gross'), sgExp: $('sg-exp'), sgExpdet: $('sg-expdet'),
    sPreview: $('sale-preview'), sErrDate: $('serr-date'), sErrGen: $('serr-general'),
    sCancel: $('btn-cancel-sale'), sSave: $('btn-confirm-sale'),
    // D5 report
    rptSub: $('rpt-sub'), rptNo: $('rpt-noestate'), rptBody: $('rpt-body'),
    rptFlags: $('rpt-flags'), rptDec: $('rpt-dec'), rptCase: $('rpt-case'),
    rptState: $('rpt-state'),
    rcInv: $('rc-inv'), rcRep: $('rc-rep'), rcRei: $('rc-rei'), rcGains: $('rc-gains'),
    rcTot: $('rc-tot'),
    rdDisbP: $('rd-disbP'), rdDisbI: $('rd-disbI'), rdLosses: $('rd-losses'),
    rdDistr: $('rd-distr'), rdOnhand: $('rd-onhand'), rdTot: $('rd-tot'),
    balOk: $('balance-ok'), balBad: $('balance-bad'), rptMemo: $('rpt-memo'),
    schedRecv: $('sched-recv'), schedDisb: $('sched-disb'), schedDist: $('sched-dist'),
    schedSales: $('sched-sales'), schedSalesWrap: $('sched-sales-wrap'),
    rptNonP: $('rpt-nonprobate'), nonPList: $('nonprobate-list'),
    btnPrint: $('btn-print-report'), btnCsv: $('btn-csv-report'),
    // D6 export
    jsonDl: $('btn-json-download'), jsonUp: $('btn-json-upload'), restNote: $('restore-note'),
    csvTotals: $('btn-csv-totals'), csvAssets: $('btn-csv-assets'), csvLedgerBtn: $('btn-csv-ledger')
  };
  let editingId = null;
  let deletingId = null;

  // ---- toast helper (D7) ----
  function toast(msg, warn) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const d = document.createElement('div');
    d.className = 'toast' + (warn ? ' warn' : '');
    d.textContent = msg;
    box.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .4s'; }, 2200);
    setTimeout(() => d.remove(), 2700);
  }

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
      // D14: if worksheet was open, close it and unshelve panels
      document.querySelectorAll('.panel.ws-shelved').forEach(p0 => p0.classList.remove('ws-shelved'));
      $('panel-ws') && ($('panel-ws').hidden = true);
      $('import-zone') && ($('import-zone').style.display = '');
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
    // D9.5: accounting basis radio
    const basisVal = (e && e.accountingBasis) || 'standard';
    const radio = document.querySelector('input[name=basis][value="' + basisVal + '"]');
    if (radio) radio.checked = true;
    els.setupEmpty.hidden = !!e;
    els.setupForm.hidden = !e;
    els.deleteBtn.hidden = !e;
    // Кнопку saveBtn здесь НЕ трогаем: submit-обработчик показывает 'Saved ✓' сам;
  }

  let pendingBasisEstate = null;  // D9.5 fields awaiting modal confirmation
  els.form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    clearErrs();
    const basisRadio = document.querySelector('input[name=basis]:checked');
    const newBasis = basisRadio ? basisRadio.value : 'standard';
    const prev = editingId ? store.state.estates[editingId] : null;
    const basisChanged = prev && (prev.accountingBasis || 'standard') !== newBasis;
    const hasData = prev && ((prev.assets || []).length || (prev.transactions || []).length || (prev.sales || []).length);
    const fields = {
      decedent: els.decedent.value.trim(),
      caseNumber: els.caseNo.value.trim(),
      state: els.state.value,
      role: els.role.value,
      dateOfDeath: els.dod.value,
      accountingBasis: newBasis
    };
    // D9.5: confirm switch on an estate that already holds data (spec: custom modal)
    if (basisChanged && hasData) {
      pendingBasisEstate = { fields };
      $('basis-confirm-text').textContent =
        'Switch this estate from ' + ((prev.accountingBasis || 'standard') === 'carry' ? 'Carry value' : 'Standard') +
        ' to ' + (newBasis === 'carry' ? 'Carry value' : 'Standard') + '? Your records stay the same; only the report presentation changes.';
      $('modal-basis').classList.add('open');
      return;
    }
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

  // ---- D9.5: accounting-basis confirm modal ----
  function applyBasisNow() {
    if (!pendingBasisEstate) return;
    const res = store.updateEstate(editingId, pendingBasisEstate.fields);
    if (res.ok) {
      renderSwitcher(); render(); toast('Basis switched — report presentation updated.');
    }
    pendingBasisEstate = null;
    fillForm();
  }
  $('modal-basis').addEventListener('click', (ev) => {
    if (ev.target === $('modal-basis')) { $('modal-basis').classList.remove('open'); pendingBasisEstate = null; }
  });
  // D9.5: delegated — reliable regardless of init timing
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest ? ev.target.closest('#btn-basis-cancel') : null;
    if (t) {
        $('modal-basis').classList.remove('open'); pendingBasisEstate = null; fillForm();
      return;
    }
    const t2 = ev.target.closest ? ev.target.closest('#btn-basis-confirm') : null;
    if (t2) {
        $('modal-basis').classList.remove('open'); applyBasisNow();
    }
  });

  // ---- D11: statutory fee module ----
  function renderFee() {
    const e = store.getActive();
    const panel = $('fee-panel');
    if (!panel) return;
    if (!e) { panel.hidden = true; return; }
    panel.hidden = false;
    const sch = FEE_SCHEDULES[e.state];
    const value = (e.assets || []).filter(x => x.outsideProbate !== 'yes').reduce((s, x) => s + (x.dodValue || 0), 0);
    const flows = { income: 0, disbursements: 0 };
    (e.transactions || []).forEach(tx => {
      if (tx.kind === 'money_in') flows.income += tx.amount || 0;
      if (tx.kind === 'money_out') flows.disbursements += tx.amount || 0;
    });
    const ohWrap = $('fee-oh-wrap');
    if (ohWrap) ohWrap.hidden = !(sch && sch.unsoldRealtyRate);
    const realty = ohWrap && !$('fee-oh-wrap').hidden && $('fee-oh-realty').checked;
    const r = calculateStatutoryFee(e.state, value, { income: flows.income, disbursements: flows.disbursements, unsoldRealty: !!realty });
    const stEl = $('fee-statute'), amtEl = $('fee-amount'), noteEl = $('fee-note'), btn = $('btn-fee-record');
    if (sch) stEl.textContent = '· (' + sch.statute + ')';
    else stEl.textContent = '';
    if (r.reasonable) {
      amtEl.textContent = '— set by court —';
      noteEl.textContent = r.basisNote;
      noteEl.className = 'fee-note-warn';
      btn.disabled = true;
    } else {
      amtEl.textContent = fmtMoney(r.fee);
      const flowsBasis = sch && sch.basis === 'receipts_and_disbursements';
      noteEl.textContent = r.basisNote || ('Based on ' + (flowsBasis ? 'money received and paid out (from your ledger)' : fmtMoney(value) + ' probate assets at date-of-death value.'));
      noteEl.className = flowsBasis ? 'fee-note-warn' : 'hintfield';
      btn.disabled = false;
    }
    // remember last computed fee for record
    $('fee-panel').dataset.fee = String(r.fee || '');
    $('fee-panel').dataset.statute = r.statute || '';
  }
  $('fee-oh-realty') && $('fee-oh-realty').addEventListener('change', renderFee);
  $('btn-fee-record') && $('btn-fee-record').addEventListener('click', () => {
    const e = store.getActive();
    const panel = $('fee-panel');
    const fee = parseFloat(panel.dataset.fee);
    if (!e || !fee || fee <= 0) return;
    const isOH = e.state === 'OH';
    const desc = 'Executor commission per ' + ((FEE_SCHEDULES[e.state] || {}).statute || 'state statute');
    const res = store.addTx(e.id, { kind: 'money_out', date: new Date().toISOString().slice(0,10),
      amount: fee, account: 'principal', description: desc, payee: 'Executor (self)' });
    if (res.ok) toast('Commission of ' + fmtMoney(fee) + ' recorded in the Ledger.', false);
  });



  // ---- D14: CA companion worksheet ----
  $('btn-ca-worksheet') && $('btn-ca-worksheet').addEventListener('click', () => {
    const e = store.getActive();
    const w = window.EstateLedgerCore.CourtForms.buildCAWorksheet(store.state.activeEstateId, JSON.parse(JSON.stringify(store.state)));
    if (!w || !e) { return; }
    $('ws-body').innerHTML = window.EstateLedgerCore.CourtForms.renderCAWorksheet(w);
    document.querySelectorAll('.panel').forEach(p0 => { if (p0.id !== 'panel-ws') p0.classList.add('ws-shelved'); });
    $('panel-ws').hidden = false;
    $('panel-ws').classList.add('active');  // .panel{display:none} — needs active to show
    // hide import-zone too (it lives inside export panel but was visible in vision review as a stray block)
    $('import-zone').style.display = 'none';
    $('panel-ws').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Worksheet built from your ledger — print it or transfer the figures.', false);
  });
  $('btn-ws-back') && $('btn-ws-back').addEventListener('click', () => {
    document.querySelectorAll('.panel.ws-shelved').forEach(p0 => p0.classList.remove('ws-shelved'));
    $('panel-ws').hidden = true;
    $('panel-ws').classList.remove('active');
    $('import-zone').style.display = '';
  });


  // ---- D18: multi-estate dashboard ----
  function updateDashLink() {
    const cnt = Object.values(store.state.estates).filter(e => !e.archived).length;
    const link = $('dash-link');
    if (link) link.hidden = cnt < 3;  // spec: dashboard at ≥3 estates
  }
  function renderDash() {
    const rows = store.buildDash();
    const showArchived = $('dash-show-archived') && $('dash-show-archived').checked;
    const wrap = $('dash-rows');
    if (!wrap) return;
    wrap.innerHTML = '';
    rows.filter(r => showArchived || !r.archived).forEach(r => {
      const card = document.createElement('div');
      card.className = 'dash-card' + (r.archived ? ' archived' : '');
      const bal = r.balanced
        ? '<b style="color:#2D6A4F">Balanced ✓</b><span>account check</span>'
        : '<b style="color:#B00020">Check needed</b><span>account check</span>';
      card.innerHTML =
        '<div><div class="h-name">' + (r.decedent || '—') + (r.archived ? ' · archived' : '') + '</div>' +
          '<div class="h-sub">' + (r.state || '—') + (r.caseNumber ? ' · ' + r.caseNumber : '') + ' · ' + (r.basis === 'carry' ? 'carry' : 'standard') + '</div></div>' +
        '<div class="stat"><b>' + (r.daysSinceDOD >= 0 ? r.daysSinceDOD + ' d' : '—') + '</b><span>since death</span></div>' +
        '<div class="stat"><b>' + r.assetsCount + '</b><span>assets</span></div>' +
        '<div class="stat">' + bal + '</div>' +
        '<div class="next"><b>Next:</b> ' + r.nextAction + (r.reimbursablePending > 0 ? ' · Executor unpaid: ' + fmtMoney(r.reimbursablePending) : '') + '</div>' +
        '<div class="dash-actions">' +
          '<button class="btn btn-ghost" data-open-estate="' + r.id + '" style="padding:6px 14px">Open</button>' +
          (r.archived
            ? '<button class="btn btn-ghost" data-unarchive="' + r.id + '" style="padding:6px 14px">Restore</button>'
            : '<button class="btn btn-ghost" data-archive="' + r.id + '" style="padding:6px 14px">Archive</button>') +
        '</div>';
      wrap.appendChild(card);
    });
    // delegated actions
    wrap.querySelectorAll('[data-open-estate]').forEach(b => b.onclick = () => {
      store.setActive(b.dataset.openEstate);
      document.querySelectorAll('.panel.ws-shelved').forEach(x => x.classList.remove('ws-shelved'));
      $('panel-dash').hidden = true;
      $('panel-dash').classList.remove('active');
      document.querySelectorAll('.tab[data-tab=setup]')[0] && document.querySelector('[data-tab=setup]').click();
      fillForm(); renderSwitcher(); render();
    });
    wrap.querySelectorAll('[data-archive]').forEach(b => b.onclick = () => {
      store.archiveEstate(b.dataset.archive);
      toast('Estate archived — restore it via Dashboard → Show archived.', false);
      renderDash(); updateDashLink(); renderSwitcher();
    });
    wrap.querySelectorAll('[data-unarchive]').forEach(b => b.onclick = () => {
      store.unarchiveEstate(b.dataset.unarchive);
      toast('Estate restored.', false);
      renderDash(); updateDashLink(); renderSwitcher();
    });
  }
  $('dash-link') && $('dash-link').addEventListener('click', (ev) => {
    ev.preventDefault();
    document.querySelectorAll('.panel').forEach(p0 => p0.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    $('panel-dash').hidden = false;
    $('panel-dash').classList.add('active');
    renderDash();
  });
  $('dash-show-archived') && $('dash-show-archived').addEventListener('change', renderDash);

  // ---- D12: bank CSV import ----
  let importDrafts = [];
  const BI = window.EstateLedgerCore.BankImport;
  // D12: change via delegated listener on document (reliable regardless of init timing)
  document.addEventListener('change', (ev) => {
    const tgt = ev.target && ev.target.closest ? ev.target.closest('#import-file') : null;
    if (!tgt) return;
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { importFail('File is larger than 5 MB — split it in half and import both parts.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = BI.parseBankCsv(text);
        if (!parsed.rows.length) { importFail('Could not find rows with a date and dollar amount. Check that the first line has column names (Date, Amount, Description).'); return; }
        if (parsed.rows.length > 3000) { importFail('More than 3000 rows — split the file to keep the preview usable.'); return; }
        const estate = store.getActive();
        if (!estate) { importFail('Create an estate in Setup first.'); return; }
        // dedupe vs existing txs (±90 days lookback window by spec)
        const existing = (estate.transactions || []);
        importDrafts = BI.markDuplicates(parsed.rows, existing);
        const dupes = importDrafts.filter(d => d.dupe).length;
        const distHints = importDrafts.filter(d => d.dupeOfKind === 'distribution').length;
        $('import-summary').innerHTML = '<b>' + importDrafts.length + ' transactions found</b>' +
          (dupes ? ' · <span style="color:#B00020">' + dupes + ' likely duplicates (pre-checked out)</span>' : '') +
          (distHints ? ' · ' + distHints + ' matches a recorded distribution — check before importing' : '');
        renderImportPreview();
        $('import-preview').style.display = 'block';
        $('import-bad').style.display = 'none';
      } catch (e) {
        importFail('Could not read that file: ' + (e.message || 'unknown error'));
      }
    };
    reader.onerror = () => importFail('Could not read the file.');
    reader.readAsText(file);
  });
  function importFail(msg) {
    $('import-bad').textContent = msg;
    $('import-bad').style.display = 'block';
    $('import-preview').style.display = 'none';
  }
  function renderImportPreview() {
    const tb = $('import-tbody');
    tb.innerHTML = '';
    importDrafts.forEach((d, i) => {
      const tr = document.createElement('tr');
      if (d.dupe) tr.style.background = '#FDECEC';
      if (d.dupeOfKind === 'distribution' && !d.dupe) tr.style.background = '#FFF6E0';
      const account = (d.kind === 'money_in') ? 'principal' : 'principal';
      tr.innerHTML =
        '<td style="padding:8px 10px"><input type="checkbox" class="imp-check" data-i="' + i + '"' + ((d.dupe || d.dupeOfKind === 'distribution') ? '' : ' checked') + '></td>' +
        '<td style="padding:8px 10px">' + d.date + '</td>' +
        '<td style="padding:8px 10px">' + (d.kind === 'money_in' ? '<span style="color:#2D6A4F">Money in</span>' : '<span style="color:#B05A00">Money out</span>') + '</td>' +
        '<td style="padding:8px 10px;text-align:right">' + fmtMoney(d.amount) + '</td>' +
        '<td style="padding:8px 10px">' + (d.description || '<i style="color:#9A958D">no description</i>') + '</td>' +
        '<td style="padding:8px 10px"><select class="imp-account" data-i="' + i + '"><option value="principal">Principal</option><option value="income">Income</option></select></td>' +
        '<td style="padding:8px 10px">' + (d.dupe ? '<b style="color:#B00020">duplicate</b>' : (d.dupeOfKind === 'distribution' ? '<b style="color:#8A5A00">=? existing distribution</b>' : '<span style="color:#2D6A4F">new</span>')) + '</td>';
      tb.appendChild(tr);
    });
  }
  document.addEventListener('click', (ev) => {
    if (ev.target.closest && ev.target.closest('#btn-import-commit')) {
    if (!importDrafts.length) { importFail('Nothing to import.'); return; }
    const checks = [...document.querySelectorAll('.imp-check')];
    const estate = store.getActive();
    if (!estate) { importFail('Create an estate first.'); return; }
    let added = 0, skipped = 0;
    const errors = [];
    checks.forEach(chk => {
      const i = Number(chk.dataset.i);
      if (!chk.checked) { skipped++; return; }
      const d = importDrafts[i];
      if (!d) return;
      const accountSel = document.querySelector('.imp-account[data-i="' + i + '"]');
      const account = accountSel ? accountSel.value : 'principal';
      const desc = d.description || 'Bank transaction ' + d.date + ' (imported)';
      const res = store.addTx(store.state.activeEstateId, { kind: d.kind, date: d.date, amount: d.amount,
        description: desc, account });
      if (res.ok) added++; else errors.push((d.date) + ': ' + Object.values(res.errors || {}).join(' '));
    });
    if (errors.length) {
      importFail('Imported ' + added + ' rows; ' + errors.length + ' rows rejected: ' + errors.slice(0,3).join('; '));
    } else {
      toast('Imported ' + added + ' transactions from bank CSV.', false);
    }
    importDrafts = [];
    $('import-preview').style.display = 'none';
    $('import-file').value = '';
    render();
    return;
    }
    if (ev.target.closest && ev.target.closest('#btn-import-cancel')) {
      importDrafts = [];
      $('import-preview').style.display = 'none';
      $('import-file').value = '';
    }
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

  // ---- SAMPLE-режим маркер ----
  function maybeSampleBanner() {
    const e = store.getActive();
    const b = els.banner;
    if (e && e.sample) {
      b.classList.add('show');
      b.style.background = '#E8EEF8'; b.style.color = 'var(--navy)';
      b.innerHTML = '<b>SAMPLE estate</b> — fictional data you can freely explore. Everything you do here goes to the sample (not your real records). ' +
        '<button class="btn btn-ghost" style="padding:6px 14px;font-size:13px;margin-left:12px" id="sb-start-real">Start your own estate</button>' +
        '<button class="btn" style="padding:6px 14px;font-size:13px;background:transparent;color:var(--navy)" id="sb-dismiss">Dismiss</button>';
      $('sb-start-real').onclick = () => {
        window.EstateLedgerSample && window.EstateLedgerSample.uninstall(store);
        b.classList.remove('show'); b.style.background = ''; b.style.color = '';
        editingId = null;
        toast('Sample removed — create your first estate now.');
        renderSwitcher(); render();
        document.querySelector('[data-tab=setup]').click();
        $('btn-create-first').click();
      };
      $('sb-dismiss').onclick = () => { b.classList.remove('show'); b.style.background=''; b.style.color=''; };
      return true;
    }
    b.style.background = ''; b.style.color = '';
    return false;
  }

  // ---- backup banner: weekly reminder ----
  function maybeShowBanner() {
    const e = store.getActive();
    if (!e) return;
    if (maybeSampleBanner()) return;
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
    toast(wasEdit ? 'Asset updated.' : 'Asset added to the inventory.');
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
      const soldBadge = a.sold ? '<span class="sold-badge">SOLD</span>' : '';
      const actions = a.sold
        ? `<span class="tx-kind k-money_in" style="font-size:11px">sold ${esc(a.soldDate || '')}</span>`
        : `<button class="link-btn" data-edit="${a.id}">Edit</button><button class="link-btn danger" data-del="${a.id}">Delete</button><button class="link-btn" data-sell="${a.id}" style="color:var(--green)">Sell</button>`;
      const nameCell = `<b>${esc(a.name)}</b>${soldBadge}${a.reference ? `<div style="font-size:12px;color:var(--gray-text)">${esc(a.reference)}</div>` : ''}`;
      tr.innerHTML = `<td>${nameCell}</td>` +
        `<td class="aclass">${esc(ASSET_CLASS_LABELS[a.assetClass] || a.assetClass)}</td>` +
        `<td class="r">${val}</td>` +
        `<td><span class="${flagCls}">${flagTxt}</span></td>` +
        `<td><div class="row-actions">${actions}</div></td>`;
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
      const d = store.deleteAsset(estateId, delId);
      if (d === true) { if (editingAssetId === delId) resetAssetForm(); render(); }
      else if (d && d.ok === false) alert(d.error || 'Cannot delete this asset.');
    }
  });

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ---- D4: sale modal ----
  let saleAssetId = null;
  function openSale(aid) {
    const estateId = store.state.activeEstateId;
    const a = estateId && store.listAssets(estateId).find(x => x.id === aid);
    if (!a) return;
    saleAssetId = aid;
    els.saleTitle.textContent = 'Record sale — ' + a.name;
    els.saleAssetLine.innerHTML = `Date-of-death value: <b>${fmtMoney(a.dodValue)}</b> (gain/loss is measured against it)`;
    els.saleForm.reset();
    els.sDate.value = new Date().toISOString().slice(0, 10);
    saleModeSync();
    els.sPreview.hidden = true;
    els.sErrDate && showSaleErr('date', null);
    els.sErrGen.textContent = '';
    els.mSale.classList.add('open');
    setTimeout(() => els.sNet.focus(), 250);
  }
  function saleModeSync() {
    const mode = (els.saleForm.querySelector('input[name=s-mode]:checked') || {}).value || 'net';
    els.sgNet.hidden = mode !== 'net';
    els.sgGross.hidden = mode !== 'gross';
    els.sgExp.hidden = mode !== 'gross';
    els.sgExpdet.hidden = mode !== 'gross';
  }
  els.saleForm.addEventListener('change', (ev) => { if (ev.target.name === 's-mode') saleModeSync(); updatePreview(); });
  els.sGross.addEventListener('input', updatePreview);
  els.sExp.addEventListener('input', updatePreview);
  els.sNet.addEventListener('input', updatePreview);
  function updatePreview() {
    const mode = (els.saleForm.querySelector('input[name=s-mode]:checked') || {}).value || 'net';
    const estate = store.getActive();
    const a = estate && store.listAssets(estate.id).find(x => x.id === saleAssetId);
    if (!a || mode !== 'gross') { if (mode === 'net') maybePreviewNet(); return; }
    maybePreviewNet();
  }
  function maybePreviewNet() {
    const estate = store.getActive();
    const a = estate && store.listAssets(estate.id).find(x => x.id === saleAssetId);
    if (!a) { els.sPreview.hidden = true; return; }
    const mode = (els.saleForm.querySelector('input[name=s-mode]:checked') || {}).value || 'net';
    let net = null;
    if (mode === 'net' && els.sNet.value.trim()) net = window.EstateLedgerCore.parseMoney(els.sNet.value);
    if (mode === 'gross' && els.sGross.value.trim() && els.sExp.value.trim()) {
      const g = window.EstateLedgerCore.parseMoney(els.sGross.value);
      const x = window.EstateLedgerCore.parseMoney(els.sExp.value);
      if (g != null && x != null) net = window.EstateLedgerCore.round2(g - x);
    }
    if (net == null || net <= 0) { els.sPreview.hidden = true; return; }
    const dod = a.dodValue || 0;
    const diff = window.EstateLedgerCore.round2(net - dod);
    const dir = diff > 0 ? 'gain' : diff < 0 ? 'loss' : 'no gain or loss';
    els.sPreview.innerHTML = `Net proceeds: <b>${fmtMoney(net)}</b> vs date-of-death value ${fmtMoney(dod)}` +
      (diff === 0 ? '' : ` → <span class="${diff > 0 ? 'gp' : 'lp'}">${dir} ${fmtMoney(Math.abs(diff))}</span>`);
    els.sPreview.hidden = false;
  }
  function showSaleErr(key, msg) {
    if (key === 'date') {
      if (msg) { els.sErrDate.textContent = msg; els.sErrDate.classList.add('show'); }
      else els.sErrDate.classList.remove('show');
    }
  }
  els.sCancel.addEventListener('click', () => els.mSale.classList.remove('open'));
  els.mSale.addEventListener('click', (ev) => { if (ev.target === els.mSale) els.mSale.classList.remove('open'); });

  els.saleForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const estateId = store.state.activeEstateId;
    if (!estateId || !saleAssetId) return;
    const mode = (els.saleForm.querySelector('input[name=s-mode]:checked') || {}).value || 'net';
    const fields = {
      date: els.sDate.value,
      reference: els.sRef.value,
      expenseDetail: els.sExpdet.value
    };
    if (mode === 'net') fields.netProceeds = els.sNet.value; else { fields.grossProceeds = els.sGross.value; fields.saleExpenses = els.sExp.value; }
    const res = store.recordSale(estateId, saleAssetId, fields);
    if (!res.ok) {
      els.sErrGen.textContent = res.errors.general || res.errors.proceeds || '';
      if (res.errors.date) showSaleErr('date', res.errors.date);
      return;
    }
    els.mSale.classList.remove('open');
    render();
  });

  // Sale click delegation (assets table)
  window.__origAssetClick = els.aTbody.onclick;
  els.aTbody.addEventListener('click', (ev) => {
    const sellId = ev.target.dataset.sell;
    if (sellId) openSale(sellId);
  });

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
    toast(wasEdit ? 'Transaction updated.' : 'Transaction recorded.');
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
      const sign = x.kind === 'money_in' ? '' : x.kind === 'reimbursable' ? '' : '−';  // In/out/distr; reimbursable — не движение estate-денег
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

  // ---- D5: report rendering ----
  function renderReport() {
    const estateId = store.state.activeEstateId;
    if (!estateId) { els.rptNo.hidden = false; els.rptBody.hidden = true; return; }
    const repo = store.buildAccountReport(estateId);
    if (!repo) { els.rptNo.hidden = false; els.rptBody.hidden = true; return; }
    els.rptNo.hidden = true; els.rptBody.hidden = false;

    // D9.5: basis badge + carry note
    const isCarry = (repo.basis || 'standard') === 'carry';
    const badge = $('doc-basis-badge'), note = $('doc-basis-note');
    if (badge) {
      badge.hidden = false;
      badge.textContent = isCarry ? 'Carry value approach (CA/VA format)' : 'Standard · market value';
      badge.classList.toggle('carry', isCarry);
    }
    if (note) note.style.display = isCarry ? 'block' : 'none';

    // flags
    els.rptFlags.innerHTML = '';
    (repo.redFlags || []).forEach(f => {
      const div = document.createElement('div');
      div.className = 'flag-item ' + (f.type === 'negative_cash' ? 'red' : 'amber');
      div.textContent = f.message;
      els.rptFlags.appendChild(div);
    });

    // court doc
    els.rptDec.textContent = repo.estate.decedent || '—';
    els.rptCase.textContent = repo.estate.caseNumber ? ', Case No. ' + repo.estate.caseNumber : '';
    els.rptState.textContent = repo.estate.state || '—';
    els.rcInv.textContent = fmtMoney(repo.charges.inventory);
    els.rcRep.textContent = fmtMoney(repo.charges.receiptsPrincipal);
    els.rcRei.textContent = fmtMoney(repo.charges.receiptsIncome);
    els.rcGains.textContent = fmtMoney(repo.charges.gains);
    els.rcTot.textContent = fmtMoney(repo.totals.charges);
    els.rdDisbP.textContent = fmtMoney(repo.credits.disbursementsPrincipal);
    els.rdDisbI.textContent = fmtMoney(repo.credits.disbursementsIncome);
    els.rdLosses.textContent = fmtMoney(repo.credits.losses);
    els.rdDistr.textContent = fmtMoney(repo.credits.distributions);
    els.rdOnhand.textContent = fmtMoney(repo.credits.assetsOnHand);
    els.rdTot.textContent = fmtMoney(repo.totals.credits);

    const bal = repo.totals.balanced;
    els.balOk.hidden = !bal;
    els.balBad.hidden = bal;
    els.balBad.textContent = 'TOTALS DO NOT MATCH — difference ' + fmtMoney(Math.abs(repo.balanceDiff)) +
      (repo.balanceDiff > 0 ? ' (charges exceed credits)' : ' (credits exceed charges)') +
      '. Check for missing receipts or over-recorded disbursements.';

    els.rptMemo.textContent = repo.reimbursableMemo > 0
      ? 'Memo: the executor has paid personally ' + fmtMoney(repo.reimbursableMemo) +
        ' (recorded as reimbursable). Amount owed to the executor by the estate — not included in the account totals until repaid.' : '';

    // schedules
    fillSched(els.schedRecv, repo.scheduleReceipts.map(r =>
      [r.date, r.description, r.account === 'income' ? 'Income' : 'Principal', fmtMoney(r.amount)]));
    fillSched(els.schedDisb, repo.scheduleDisbursements.map(d =>
      [d.date, d.payee ? d.description + ' — ' + d.payee : d.description,
       d.account === 'income' ? 'Income' : 'Principal', fmtMoney(d.amount)]));
    fillSched(els.schedDist, repo.scheduleDistributions.map(d =>
      [d.date, d.beneficiary, fmtMoney(d.amount)]));
    const sales = repo.scheduleSales || [];
    els.schedSalesWrap.hidden = sales.length === 0;
    els.schedSales.querySelector('tbody').innerHTML = sales.map(s0 => {
      const cls = s0.direction === 'gain' ? 'gp' : s0.direction === 'loss' ? 'lp' : '';
      const gl = s0.direction === 'none' ? '—' : `<span class="${cls}">${s0.direction === 'loss' ? '−' : ''}${fmtMoney(s0.gainOrLoss)}</span>`;
      return `<tr><td>${esc(s0.date)}</td><td>${esc(assetName(repo, s0.assetId))}</td>` +
        `<td class="r">${fmtMoney(s0.dodValue)}</td><td class="r">${fmtMoney(s0.netProceeds)}</td>` +
        `<td class="r">${gl}</td></tr>`;
    }).join('');

    // non-probate
    const np = repo.nonProbate || [];
    els.rptNonP.hidden = !np.length;
    els.nonPList.innerHTML = np.map(a => `· ${esc(a.name)} — ${fmtMoney(a.dodValue)}`).join('<br>');
  }
  function assetName(repo, id) {
    // asset names kept in state; find via store
    const estateId = store.state.activeEstateId;
    if (!estateId) return 'asset';
    const a = store.listAssets(estateId).find(x => x.id === id);
    return a ? a.name : 'asset';
  }
  function fillSched(tableEl, rows) {
    const tb = tableEl.querySelector('tbody');
    tb.innerHTML = rows.length
      ? rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('').replace(/(<td>)([\d,.\-]+(?:\.\d\d))(<\/td>)/g, '<td style="text-align:right">$2</td>')}</tr>`).join('')
      : '<tr><td colspan="4" class="none">No entries</td></tr>';
  }

  els.btnPrint.addEventListener('click', () => window.print());
  els.btnCsv.addEventListener('click', () => {
    const estateId = store.state.activeEstateId;
    const repo = store.buildAccountReport(estateId);
    if (!repo) return;
    const lines = [];
    lines.push('Summary of Account');
    lines.push('Estate of,' + (repo.estate.decedent || ''));
    lines.push('Case number,' + repo.estate.caseNumber);
    lines.push('');
    lines.push('CHARGES,Amount');
    lines.push('Inventory at date of death,' + repo.charges.inventory);
    lines.push('Receipts Principal,' + repo.charges.receiptsPrincipal);
    lines.push('Receipts Income,' + repo.charges.receiptsIncome);
    lines.push('Gains on sales,' + repo.charges.gains);
    lines.push('TOTAL CHARGES,' + repo.totals.charges);
    lines.push('');
    lines.push('CREDITS,Amount');
    lines.push('Disbursements Principal,' + repo.credits.disbursementsPrincipal);
    lines.push('Disbursements Income,' + repo.credits.disbursementsIncome);
    lines.push('Losses on sales,' + repo.credits.losses);
    lines.push('Distributions,' + repo.credits.distributions);
    lines.push('Property on hand,' + repo.credits.assetsOnHand);
    lines.push('TOTAL CREDITS,' + repo.totals.credits);
    lines.push('');
    lines.push('Schedule of Receipts');
    lines.push('Date,Description,Account,Amount');
    repo.scheduleReceipts.forEach(r => lines.push([r.date, '"' + r.description + '"', r.account, r.amount].join(',')));
    lines.push('');
    lines.push('Schedule of Disbursements');
    lines.push('Date,Description,Payee,Account,Amount');
    repo.scheduleDisbursements.forEach(d => lines.push([d.date, '"' + d.description + '"', '"' + d.payee + '"', d.account, d.amount].join(',')));
    lines.push('');
    lines.push('Schedule of Distributions');
    lines.push('Date,Beneficiary,Description,Amount');
    repo.scheduleDistributions.forEach(d => lines.push([d.date, '"' + d.beneficiary + '"', '"' + d.description + '"', d.amount].join(',')));
    lines.push('');
    lines.push('Schedule of Sales');
    lines.push('Date,Asset,DOD value,Net proceeds,Direction,Gain/Loss');
    repo.scheduleSales.forEach(s0 => lines.push([s0.date, '"' + assetName(repo, s0.assetId) + '"', s0.dodValue, s0.netProceeds, s0.direction, s0.gainOrLoss].join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.download = 'summary-of-account-' + (repo.estate.decedent || '').replace(/\W+/g, '-').toLowerCase() + '.csv';
    a.href = URL.createObjectURL(blob); a.click(); URL.revokeObjectURL(a.href);
  });

  // ---- D6: backup/export handlers ----
  function downloadFile(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.download = name;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  }
  const estateSlug = () => {
    const e = store.getActive();
    return ((e && e.decedent) || 'estate').replace(/\W+/g, '-').toLowerCase();
  };

  els.jsonDl.addEventListener('click', () => {
    downloadFile(`estate-ledger-backup-${estateSlug()}-${new Date().toISOString().slice(0, 10)}.json`,
      store.exportState(), 'application/json');
    const e = store.getActive();
    if (e) e.lastBackupReminder = new Date().toISOString().slice(0, 10);
    store.save(); els.banner.classList.remove('show');
  });

  els.jsonUp.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files[0];
      if (!f) return;
      try {
        const txt = await f.text();
        const r = store.importState(txt);
        if (!r.ok) { els.restNote.hidden = false; els.restNote.style.color = 'var(--red)';
          els.restNote.textContent = 'Could not restore: ' + r.errors; return; }
        editingId = store.state.activeEstateId;
        els.restNote.hidden = false; els.restNote.style.color = 'var(--green)';
        els.restNote.textContent = 'Backup restored: ' + store.listEstates().length + ' estate(s).';
        renderSwitcher(); fillForm(); render();
      } catch (e) {
        els.restNote.hidden = false; els.restNote.style.color = 'var(--red)';
        els.restNote.textContent = 'Could not read the file.';
      }
    };
    inp.click();
  });

  els.csvTotals.addEventListener('click', () => {
    const estateId = store.state.activeEstateId;
    if (!estateId) return;
    const csv = store.csvReport(estateId);
    if (csv) downloadFile(`summary-of-account-${estateSlug()}.csv`, csv, 'text/csv');
  });

  els.csvAssets.addEventListener('click', () => {
    const estateId = store.state.activeEstateId;
    if (!estateId) return;
    const { ASSET_CLASS_LABELS } = window.EstateLedgerCore;
    const q = v => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v);
    const L = ['Name,Class,DOD value,In probate?,Value source,Reference,Sold'];
    store.listAssets(estateId).forEach(a => {
      L.push([q(a.name), ASSET_CLASS_LABELS[a.assetClass] || a.assetClass,
        a.dodValue == null ? '' : a.dodValue, a.outsideProbate, a.valuationSource || '',
        q(a.reference || ''), a.sold ? 'yes' : 'no'].join(','));
    });
    downloadFile(`assets-${estateSlug()}.csv`, L.join('\n'), 'text/csv');
  });

  els.csvLedgerBtn.addEventListener('click', () => {
    const estateId = store.state.activeEstateId;
    if (!estateId) return;
    const q = v => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v);
    const L = ['Date,Type,Account,Description,Payee/Beneficiary,Amount,CheckNo,Reference'];
    store.listTx(estateId).forEach(x => {
      L.push([x.date, x.kind, x.account, q(x.description), q(x.payee || x.beneficiary || ''),
        x.amount, x.checkNo || '', q(x.reference || '')].join(','));
    });
    downloadFile(`ledger-${estateSlug()}.csv`, L.join('\n'), 'text/csv');
  });

  // goto tab from hint links
  document.querySelectorAll('[data-goto-tab]').forEach(a => a.addEventListener('click', (ev) => {
    ev.preventDefault();
    const tab = document.querySelector(`.tab[data-tab="${a.dataset.gotoTab}"]`);
    if (tab) tab.click();
  }));

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
    renderReport();
    els.counts.ledger.hidden = !txs; els.counts.ledger.textContent = txs;
    maybeShowBanner();
    fillForm();
    renderFee();  // D11
    updateDashLink();  // D18
  }

  // ---- init: ?sample=1 → D7 sample module (noop today) ----
  const params = new URLSearchParams(location.search);
  if (params.get('sample') === '1' && window.EstateLedgerSample) {
    const si = window.EstateLedgerSample.install(store);
    window.__sampleInstalled = !!(si && si.ok);
  }
  editingId = store.state.activeEstateId;
  renderSwitcher();
  render();
})();