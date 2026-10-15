/* AlterCast Agency — on-site onboarding form.
   Answers are keyed by the exact Google Forms question title (data-title) so the backend can
   write them into the matching column of the response sheet. */

/* Onboarding videos: nothing is loaded from Vimeo until the visitor presses play.
   Then the poster button is swapped for the player (same parameters as on altercast.ai);
   starting another video puts the previous one back to its poster, which stops it. */
(function () {
  var active = null;
  function restore(slot) {
    if (!slot || !slot._btn) return;
    slot.innerHTML = '';
    slot.appendChild(slot._btn);
  }
  Array.prototype.forEach.call(document.querySelectorAll('.vp-btn[data-vimeo]'), function (btn) {
    btn.addEventListener('click', function () {
      var slot = btn.parentNode;
      if (active && active !== slot) restore(active);
      var p = new URLSearchParams({ autoplay: '1', title: '0', byline: '0', portrait: '0', dnt: '1', playsinline: '1', vimeo_logo: '0' });
      var h = btn.getAttribute('data-h');
      if (h) p.set('h', h);
      var f = document.createElement('iframe');
      f.src = 'https://player.vimeo.com/video/' + btn.getAttribute('data-vimeo') + '?' + p.toString();
      f.title = btn.getAttribute('data-title') || 'Vimeo';
      f.allow = 'autoplay; fullscreen; picture-in-picture; clipboard-write';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      slot._btn = btn;
      slot.replaceChild(f, btn);
      active = slot;
    });
  });
})();

(function () {
  var cfg = window.AC_FORM || {};
  var ui = cfg.ui || {};
  var form = document.getElementById('ac-form');
  if (!form) return;

  var steps = Array.prototype.slice.call(form.querySelectorAll('.fstep'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('[data-step-dot]'));
  var btnBack = form.querySelector('[data-back]');
  var btnNext = form.querySelector('[data-next]');
  var btnSubmit = form.querySelector('[data-submit]');
  var alertBox = form.querySelector('.form-alert');
  var done = document.querySelector('.form-done');
  var draftNote = document.querySelector('.draft-note');
  var current = 0;
  var startedAt = Date.now();
  var photos = {};               // data-title -> {name, type, data}
  var DRAFT_KEY = 'acForm:' + cfg.lang;

  // Chinese / Arabic forms: fields marked data-latin must not contain Han or Arabic script (or full-width forms)
  var NON_LATIN = /[\u0600-\u06FF\u0750-\u077F\u0870-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u2E80-\u2FDF\u3000-\u303F\u3040-\u30FF\u3100-\u31BF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;
  function $all(sel, root) { return Array.prototype.slice.call((root || form).querySelectorAll(sel)); }
  // hidden by a condition (e.g. company fields for private persons), regardless of which step is open
  function condHidden(el) { var c = el.closest('[data-show-if]'); return !!(c && c.hidden); }

  /* ---------- conditional fields ---------- */
  function flags() {
    var f = {};
    $all('input[data-flag]').forEach(function (i) { if (i.checked) f[i.getAttribute('data-flag')] = true; });
    return f;
  }
  function applyConditions() {
    var f = flags();
    $all('[data-show-if]').forEach(function (el) {
      var show = !!f[el.getAttribute('data-show-if')];
      el.hidden = !show;
    });
  }

  /* ---------- steps ---------- */
  function show(n, focus) {
    current = Math.max(0, Math.min(steps.length - 1, n));
    steps.forEach(function (s, i) { s.hidden = i !== current; });
    dots.forEach(function (d, i) {
      d.classList.toggle('is-current', i === current);
      d.classList.toggle('is-done', i < current);
      if (i === current) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
    });
    btnBack.hidden = current === 0;
    btnNext.hidden = current === steps.length - 1;
    btnSubmit.hidden = current !== steps.length - 1;
    hideAlert();
    if (focus) {
      var top = form.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: top, behavior: 'smooth' });
      var h = steps[current].querySelector('.step-title');
      if (h) setTimeout(function () { h.focus({ preventScroll: true }); }, 250);
    }
    saveDraft();
  }

  /* ---------- validation ---------- */
  function setError(field, msg) {
    field.classList.toggle('has-error', !!msg);
    var e = field.querySelector('.f-err');
    if (e) e.textContent = msg || '';
    $all('input, textarea', field).forEach(function (i) {
      if (msg) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
    });
  }
  function validateField(field) {
    if (condHidden(field)) { setError(field, ''); return true; }
    var ty = field.getAttribute('data-ty');
    var req = field.hasAttribute('data-req');
    var title = field.getAttribute('data-title');
    var msg = '';
    if (ty === '13') {
      if (field.closest('[data-show-if="photo-upload"]') && !photos[title]) msg = ui.photo_required;
    } else if (ty === '2' || ty === '4') {
      if (req && !field.querySelector('input:checked')) msg = ui.required_choice;
    } else {
      var inp = field.querySelector('input, textarea');
      var v = inp ? inp.value.trim() : '';
      var conditionalReq = !!field.closest('[data-show-if="photo-link"]') || field.getAttribute('data-show-if') === 'photo-link';
      if ((req || conditionalReq) && !v) msg = conditionalReq && !req ? ui.link_required : ui.required;
      else if (v && inp.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = ui.invalid_email;
      else if (v && field.hasAttribute('data-latin') && NON_LATIN.test(v)) msg = ui.latin_only;
    }
    setError(field, msg);
    return !msg;
  }
  function validateStep(i) {
    var bad = $all('[data-q]', steps[i]).filter(function (f) { return !validateField(f); });
    if (bad.length) {
      showAlert(ui.fix);
      var first = bad[0];
      if (first.tagName === 'DETAILS') first.open = true;
      var focusable = first.querySelector('input, textarea');
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (focusable) setTimeout(function () { focusable.focus({ preventScroll: true }); }, 300);
      return false;
    }
    return true;
  }
  function showAlert(html) { alertBox.innerHTML = html; alertBox.hidden = false; }
  function hideAlert() { alertBox.hidden = true; alertBox.textContent = ''; }

  form.addEventListener('input', function (e) {
    var f = e.target.closest('[data-q]');
    if (f && f.classList.contains('has-error')) validateField(f);
    saveDraftSoon();
  });
  form.addEventListener('change', function (e) {
    if (e.target.matches('input[type=radio], input[type=checkbox]')) {
      applyConditions();
      var f = e.target.closest('[data-q]');
      if (f && f.classList.contains('has-error')) validateField(f);
      updateCounters();
    }
    saveDraftSoon();
  });

  btnNext.addEventListener('click', function () { if (validateStep(current)) show(current + 1, true); });
  btnBack.addEventListener('click', function () { show(current - 1, true); });
  dots.forEach(function (d, i) {
    d.addEventListener('click', function () { if (i < current) show(i, true); });
  });
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.matches('input:not([type=checkbox]):not([type=radio])')) {
      e.preventDefault();
      if (current < steps.length - 1) btnNext.click();
    }
  });

  /* ---------- helpers: industries select all, context counters ---------- */
  $all('[data-select-all]').forEach(function (b) {
    b.addEventListener('click', function () {
      $all('input[name="' + b.getAttribute('data-select-all') + '"]').forEach(function (i) { i.checked = true; });
      var f = b.closest('[data-q]'); if (f) validateField(f); saveDraftSoon();
    });
  });
  $all('[data-clear-all]').forEach(function (b) {
    b.addEventListener('click', function () {
      $all('input[name="' + b.getAttribute('data-clear-all') + '"]').forEach(function (i) { i.checked = false; });
      saveDraftSoon();
    });
  });
  function updateCounters() {
    $all('.ctx-group').forEach(function (g) {
      var n = g.querySelectorAll('input:checked').length;
      var c = g.querySelector('.ctx-count');
      c.textContent = n ? n + ' ' + c.getAttribute('data-sel') : c.getAttribute('data-none');
      c.classList.toggle('has', n > 0);
    });
  }

  /* ---------- photos ---------- */
  function readAsDataURL(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }
  function compress(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var max = 2400, w = img.naturalWidth, h = img.naturalHeight;
          var s = Math.min(1, max / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.round(w * s); c.height = Math.round(h * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          var data = c.toDataURL('image/jpeg', 0.9);
          resolve({ name: (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', data: data.split(',')[1], preview: data });
        } catch (err) { URL.revokeObjectURL(url); reject(err); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  function handlePhoto(field, file) {
    var dz = field.querySelector('.dropzone');
    var title = field.getAttribute('data-title');
    if (!file) return;
    dz.classList.add('is-busy');
    compress(file).catch(function () {
      if (file.size <= 10 * 1024 * 1024 && /^image\//.test(file.type)) {
        return readAsDataURL(file).then(function (d) { return { name: file.name, type: file.type, data: d.split(',')[1], preview: '' }; });
      }
      throw new Error('bad');
    }).then(function (p) {
      photos[title] = { name: p.name, type: p.type, data: p.data };
      var img = dz.querySelector('img');
      img.src = p.preview || '';
      img.alt = file.name || '';
      dz.classList.add('has-file');
      setError(field, '');
    }).catch(function () {
      delete photos[title];
      dz.classList.remove('has-file');
      setError(field, ui.photo_bad);
    }).then(function () { dz.classList.remove('is-busy'); });
  }
  $all('.photo-field').forEach(function (field) {
    var input = field.querySelector('.photo-input');
    var dz = field.querySelector('.dropzone');
    input.addEventListener('change', function () { handlePhoto(field, input.files && input.files[0]); });
    field.querySelector('.dz-remove').addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      delete photos[field.getAttribute('data-title')];
      input.value = '';
      dz.classList.remove('has-file');
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('is-over'); });
    });
    dz.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handlePhoto(field, f);
    });
  });

  /* ---------- draft (this browser only; photos are not stored) ---------- */
  var saveTimer = null;
  function collectValues() {
    var v = {};
    $all('[data-q]').forEach(function (f) {
      var ty = f.getAttribute('data-ty');
      if (ty === '13') return;
      var q = f.getAttribute('data-q');
      if (ty === '2') { var c = f.querySelector('input:checked'); if (c) v[q] = c.value; }
      else if (ty === '4') { var arr = $all('input:checked', f).map(function (i) { return i.value; }); if (arr.length) v[q] = arr; }
      else { var i = f.querySelector('input, textarea'); if (i && i.value) v[q] = i.value; }
    });
    return v;
  }
  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 1, step: current, values: collectValues() })); } catch (e) {}
  }
  function saveDraftSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 400); }
  function restoreDraft() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { d = null; }
    if (!d || !d.values || !Object.keys(d.values).length) return 0;
    Object.keys(d.values).forEach(function (q) {
      var f = form.querySelector('[data-q="' + q + '"]');
      if (!f) return;
      var val = d.values[q];
      var ty = f.getAttribute('data-ty');
      if (ty === '2' || ty === '4') {
        var vals = [].concat(val);
        $all('input', f).forEach(function (i) { i.checked = vals.indexOf(i.value) > -1; });
      } else {
        var i = f.querySelector('input, textarea'); if (i) i.value = val;
      }
    });
    return Math.max(0, Math.min(steps.length - 1, d.step || 0));
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }
  var clearBtn = document.querySelector('[data-draft-clear]');
  if (clearBtn) clearBtn.addEventListener('click', function () {
    clearDraft();
    form.reset();
    photos = {};
    $all('.dropzone').forEach(function (dz) { dz.classList.remove('has-file'); });
    $all('[data-q]').forEach(function (f) { setError(f, ''); });
    draftNote.hidden = true;
    applyConditions(); updateCounters(); show(0, true);
  });

  /* ---------- submit ---------- */
  function buildPayload() {
    var answers = {};
    $all('[data-q]').forEach(function (f) {
      var ty = f.getAttribute('data-ty');
      if (ty === '13') return;
      var title = f.getAttribute('data-title');
      if (condHidden(f)) { answers[title] = ''; return; }
      if (ty === '2') { var c = f.querySelector('input:checked'); answers[title] = c ? c.value : ''; }
      else if (ty === '4') { answers[title] = $all('input:checked', f).map(function (i) { return i.value; }); }
      else { var i = f.querySelector('input, textarea'); answers[title] = i ? i.value.trim() : ''; }
    });
    var emailField = form.querySelector('[data-q="' + cfg.emailQ + '"] input');
    var uploadOn = flags()['photo-upload'];
    var hp = form.querySelector('input[name="website"]');
    return {
      lang: cfg.lang,
      source: 'altercast.agency',
      email: emailField ? emailField.value.trim() : '',
      answers: answers,
      photos: uploadOn ? photos : {},
      elapsedMs: Date.now() - startedAt,
      hp: hp ? hp.value : ''
    };
  }
  function failure(msgHtml) {
    var alt = cfg.gform ? ' ' + ui.err_alt + ' <a href="' + cfg.gform + '" target="_blank" rel="noopener">Google Forms ↗</a>' : '';
    showAlert('<strong>' + ui.err_title + '</strong> ' + msgHtml + alt);
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = ui.submit + ' <span class="arr" aria-hidden="true">→</span>';
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (current < steps.length - 1) { btnNext.click(); return; }
    for (var i = 0; i < steps.length; i++) {
      var bad = $all('[data-q]', steps[i]).filter(function (f) { return !validateField(f); });
      if (bad.length) { show(i, false); validateStep(i); return; }
    }
    if (!cfg.endpoint) { failure(ui.not_ready); return; }
    btnSubmit.disabled = true;
    btnSubmit.textContent = ui.sending;
    hideAlert();
    var controller = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 120000);
    fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(buildPayload()),
      redirect: 'follow',
      credentials: 'omit',
      signal: controller ? controller.signal : undefined
    }).then(function (r) { return r.json(); }).then(function (res) {
      clearTimeout(timer);
      if (!res || !res.ok) throw new Error((res && res.error) || 'error');
      clearDraft();
      form.hidden = true;
      if (draftNote) draftNote.hidden = true;
      dots.forEach(function (d) { d.classList.remove('is-current'); d.classList.add('is-done'); });
      done.hidden = false;
      window.scrollTo({ top: done.getBoundingClientRect().top + window.scrollY - 110, behavior: 'smooth' });
      setTimeout(function () { done.focus({ preventScroll: true }); }, 300);
    }).catch(function () {
      clearTimeout(timer);
      failure(ui.err_body + ' <button type="button" class="link-btn" data-retry>' + ui.err_retry + '</button>');
      var r = alertBox.querySelector('[data-retry]');
      if (r) r.addEventListener('click', function () { form.requestSubmit ? form.requestSubmit(btnSubmit) : btnSubmit.click(); });
    });
  });

  /* ---------- init ---------- */
  var startStep = restoreDraft();
  applyConditions();
  updateCounters();
  if (startStep || Object.keys(collectValues()).length) {
    draftNote.querySelector('.dn-text').textContent = ui.draft_restored;
    draftNote.hidden = false;
  }
  show(startStep, false);
})();
