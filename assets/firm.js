/* AlterCast Agency — formularz dla firm (licencje z fakturą VAT) */
(function () {
  var cfg = window.AC_FIRM || {};
  var MAIL = cfg.mail || 'contact@altercast.agency';
  var form = document.getElementById('firm-form');
  if (!form) return;
  var startedAt = Date.now();

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function val(name) { var el = form.elements[name]; return el && typeof el.value === 'string' ? el.value.trim() : ''; }
  function checked(name) { return $all('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; }); }

  var MSG = {
    required: 'To pole jest wymagane.',
    choice: 'Wybierz co najmniej jedną opcję.',
    all: 'Zaznacz obie zgody, żeby wysłać zgłoszenie.',
    email: 'Wpisz poprawny adres e-mail.',
    profile: 'Wklej link do co najmniej jednego profilu na altercast.ai.',
    profileBad: 'To nie wygląda na link do profilu na altercast.ai.',
    fix: 'Uzupełnij zaznaczone pola, żeby wysłać zgłoszenie.',
    fail: 'Nie udało się wysłać zgłoszenia. Sprawdź połączenie i spróbuj ponownie albo',
    failMail: 'wyślij je mailem',
    sending: 'Wysyłam…',
    copied: 'Skopiowano. Wklej treść do nowej wiadomości na adres ' + MAIL + '.',
    copyFail: 'Nie udało się skopiować. Zaznacz tekst i skopiuj go ręcznie.'
  };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PROFILE_RE = /^https?:\/\/([a-z0-9-]+\.)*altercast\.ai(\/|$)/i;

  /* ---------- profile rows ---------- */
  var list = $('[data-profiles]');
  var addBtn = $('[data-add-profile]');
  var MAX = 20;
  var seq = 1;
  var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>';

  function rows() { return $all('.prof-row', list); }
  function renumber() {
    var rs = rows();
    rs.forEach(function (r, i) {
      var n = i + 1;
      $('label', r).textContent = 'Wizerunek ' + n;
      var rm = $('[data-remove]', r);
      rm.setAttribute('aria-label', 'Usuń wizerunek ' + n);
      rm.hidden = rs.length < 2;
    });
    addBtn.hidden = rs.length >= MAX;
  }
  function addRow(value, focus) {
    seq += 1;
    var id = 'prof-' + seq;
    var row = document.createElement('div');
    row.className = 'prof-row';
    row.innerHTML = '<label class="visually-hidden" for="' + id + '"></label>' +
      '<input class="input" id="' + id + '" name="profile" type="url" inputmode="url" autocomplete="off" placeholder="https://altercast.ai/app/talents/…" aria-describedby="prof-help prof-err">' +
      '<button type="button" class="prof-remove" data-remove>' + X + '</button>';
    list.appendChild(row);
    var input = $('input', row);
    if (value) input.value = value;
    renumber();
    if (focus) input.focus();
    return input;
  }
  addBtn.addEventListener('click', function () { addRow('', true); });
  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-remove]');
    if (!b) return;
    var row = b.closest('.prof-row');
    var next = row.nextElementSibling || row.previousElementSibling;
    row.parentNode.removeChild(row);
    renumber();
    if (next) $('input', next).focus();
  });
  function profiles() {
    return $all('input[name="profile"]', list).map(function (i) { return i.value.trim(); }).filter(Boolean);
  }

  /* ---------- price calculator ---------- */
  var priceInput = document.getElementById('calc-price');
  var agencyOut = $('[data-agency]');
  function parsePrice(s) {
    s = String(s || '').replace(/[\s ]/g, '').replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    return parseFloat(s);
  }
  function fmt(n) {
    // "1 150" / "1 419,68": grouped like the prices on the site (toLocaleString('pl-PL') leaves 4-digit numbers ungrouped)
    var parts = (Math.round(n * 100) / 100).toFixed(2).split('.');
    var int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts[1] === '00' ? int : int + ',' + parts[1];
  }
  function agencyPrice() {
    var p = parsePrice(priceInput.value);
    return p === null ? null : Math.round(p * 115) / 100;
  }
  function updateCalc() {
    var cur = (checked('currency')[0]) || 'PLN';
    $all('[data-cur]').forEach(function (el) { el.textContent = cur; });
    var a = agencyPrice();
    agencyOut.textContent = a === null ? '—' : fmt(a);
  }
  priceInput.addEventListener('input', updateCalc);
  $all('input[name="currency"]', form).forEach(function (r) { r.addEventListener('change', updateCalc); });

  /* ---------- prefill from altercast.ai (?profil=…&typ=…&pola=…&branza=…&czas=…&od=…&waluta=…&cena=…) ---------- */
  function prefill() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return false; }
    var used = false;
    var links = [];
    q.getAll('profil').concat(q.getAll('profile')).forEach(function (v) {
      String(v).split(/[\s,]+/).forEach(function (u) { if (PROFILE_RE.test(u) && links.indexOf(u) < 0) links.push(u); });
    });
    links.slice(0, MAX).forEach(function (u, i) {
      if (i === 0) $('input', rows()[0]).value = u; else addRow(u, false);
      used = true;
    });
    var typ = (q.get('typ') || '').toLowerCase();
    if (typ) {
      var excl = /^(w|wyl|wył|excl|exclusive|wyłączna|wylaczna)/.test(typ) && !/^(n|nie)/.test(typ);
      form.querySelector('input[name="licenseType"][value="' + (excl ? 'Wyłączna' : 'Niewyłączna') + '"]').checked = true;
      used = true;
    }
    var pola = (q.get('pola') || q.get('fields') || '').toLowerCase();
    if (pola) {
      var want = { 'Druk': /druk|print/, 'Cyfrowe': /cyfr|digital/, 'TV': /tv/ };
      $all('input[name="fields"]', form).forEach(function (c) { c.checked = want[c.value].test(pola); });
      used = true;
    }
    var br = (q.get('branza') || q.get('industry') || '').toLowerCase();
    if (br) {
      var sel = form.elements.industry;
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value && sel.options[i].value.toLowerCase() === br) { sel.selectedIndex = i; used = true; break; }
      }
    }
    var czas = parseInt(q.get('czas') || q.get('duration') || '', 10);
    if ([3, 6, 12, 24].indexOf(czas) > -1) { form.elements.duration.value = czas + ' mies.'; used = true; }
    var od = q.get('od') || q.get('start') || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(od)) { form.elements.startDate.value = od; used = true; }
    var cur = (q.get('waluta') || q.get('currency') || '').toUpperCase();
    if (['PLN', 'EUR', 'USD'].indexOf(cur) > -1) { form.querySelector('input[name="currency"][value="' + cur + '"]').checked = true; used = true; }
    var cena = parsePrice(q.get('cena') || q.get('price') || '');
    if (cena !== null) { priceInput.value = String(cena).replace('.', ','); used = true; }
    return used;
  }
  if (prefill()) { var note = $('[data-prefill-note]'); if (note) note.hidden = false; }
  renumber();
  updateCalc();

  /* ---------- validation ---------- */
  var alertBox = $('.form-alert', form);
  function errEl(field) { return $('.f-err', field); }
  function setError(field, msg) {
    var e = errEl(field);
    if (e) e.textContent = msg || '';
    field.classList.toggle('has-error', !!msg);
    var ctl = field.matches('fieldset') ? null : $('.input', field);
    if (ctl && !field.hasAttribute('data-profiles-field')) {
      if (msg) ctl.setAttribute('aria-invalid', 'true'); else ctl.removeAttribute('aria-invalid');
    }
  }
  function validateField(field) {
    if (field.hasAttribute('data-profiles-field')) {
      var inputs = $all('input[name="profile"]', field);
      var bad = false;
      inputs.forEach(function (i) {
        var v = i.value.trim();
        var isBad = !!v && !PROFILE_RE.test(v);
        i.classList.toggle('is-bad', isBad);
        if (isBad) { i.setAttribute('aria-invalid', 'true'); bad = true; } else i.removeAttribute('aria-invalid');
      });
      if (bad) { setError(field, MSG.profileBad); return false; }
      if (!profiles().length) { setError(field, MSG.profile); return false; }
      setError(field, ''); return true;
    }
    if (!field.hasAttribute('data-req') && !$('input[type="email"]', field)) { setError(field, ''); return true; }
    if (field.matches('fieldset')) {
      var boxes = $all('input', field);
      var n = boxes.filter(function (b) { return b.checked; }).length;
      if (field.hasAttribute('data-all') && n < boxes.length) { setError(field, MSG.all); return false; }
      if (!n) { setError(field, MSG.choice); return false; }
      setError(field, ''); return true;
    }
    var c = $('.input', field);
    var v = c ? c.value.trim() : '';
    if (field.hasAttribute('data-req') && !v) { setError(field, MSG.required); return false; }
    if (c && c.type === 'email' && v && !EMAIL_RE.test(v)) { setError(field, MSG.email); return false; }
    setError(field, ''); return true;
  }
  function fields() { return $all('.field', form); }
  form.addEventListener('input', function (e) {
    var f = e.target.closest('.field');
    if (f && f.classList.contains('has-error')) validateField(f);
  });
  form.addEventListener('change', function (e) {
    var f = e.target.closest('.field');
    if (f && f.classList.contains('has-error')) validateField(f);
  });
  form.addEventListener('focusout', function (e) {
    var f = e.target.closest('.field');
    if (f && e.target.value && e.target.type === 'email') validateField(f);
  });
  function showAlert(html) { alertBox.innerHTML = html; alertBox.hidden = false; }
  function hideAlert() { alertBox.hidden = true; alertBox.textContent = ''; }

  /* ---------- payload & e-mail text ---------- */
  function payload() {
    var hp = form.querySelector('input[name="website"]');
    var a = agencyPrice();
    return {
      type: 'firm',
      lang: 'pl',
      source: 'altercast.agency/dla-firm',
      company: val('company'),
      taxId: val('taxId'),
      country: val('country'),
      street: val('street'),
      postal: val('postal'),
      city: val('city'),
      invoiceEmail: val('invoiceEmail'),
      contactName: val('contactName'),
      contactEmail: val('contactEmail'),
      phone: val('phone'),
      profiles: profiles(),
      licenseType: checked('licenseType')[0] || '',
      fields: checked('fields'),
      industry: val('industry'),
      duration: val('duration'),
      startDate: val('startDate'),
      currency: checked('currency')[0] || '',
      platformPrice: priceInput.value.trim(),
      agencyPrice: a === null ? '' : fmt(a),
      project: val('project'),
      consents: checked('consents'),
      ref: document.referrer ? String(document.referrer).slice(0, 300) : '',
      elapsedMs: Date.now() - startedAt,
      hp: hp ? hp.value : ''
    };
  }
  function mailText(d) {
    var cur = d.currency || 'PLN';
    var L = [];
    L.push('Dzień dobry,', '', 'proszę o licencję z fakturą VAT przez AlterCast Agency.', '');
    L.push('DANE DO FAKTURY');
    L.push('Nazwa firmy: ' + d.company, 'NIP / VAT UE: ' + d.taxId, 'Adres: ' + d.street + ', ' + d.postal + ' ' + d.city + ', ' + d.country, 'E-mail do faktur: ' + d.invoiceEmail, '');
    L.push('OSOBA KONTAKTOWA');
    L.push(d.contactName, d.contactEmail + (d.phone ? ', ' + d.phone : ''), '');
    L.push('WIZERUNKI');
    d.profiles.forEach(function (p, i) { L.push((i + 1) + '. ' + p); });
    L.push('');
    L.push('ZAKRES LICENCJI');
    L.push('Typ licencji: ' + d.licenseType, 'Pola eksploatacji: ' + d.fields.join(', '), 'Branża: ' + d.industry, 'Czas licencji: ' + d.duration);
    if (d.startDate) L.push('Data rozpoczęcia: ' + d.startDate);
    L.push('Waluta faktury: ' + cur);
    if (d.platformPrice) L.push('Cena z platformy (netto): ' + d.platformPrice + ' ' + cur + (d.agencyPrice ? ' → na fakturze agencji: ' + d.agencyPrice + ' ' + cur + ' netto + VAT' : ''));
    if (d.project) L.push('', 'PROJEKT I UWAGI', d.project);
    L.push('', 'Zgody: ' + d.consents.join('; ') + '.');
    return L.join('\n');
  }
  function mailHref(d, body) {
    return 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Licencja z fakturą VAT — ' + d.company) + '&body=' + encodeURIComponent(body);
  }

  /* ---------- done states ---------- */
  var done = $('[data-done]');
  function showDone(mode, d) {
    form.hidden = true;
    var note = $('[data-prefill-note]'); if (note) note.hidden = true;
    $('[data-done-api]', done).hidden = mode !== 'api';
    $('[data-done-mail]', done).hidden = mode !== 'mail';
    if (mode === 'api') $('[data-done-email]', done).textContent = d.invoiceEmail;
    done.hidden = false;
    window.scrollTo({ top: done.getBoundingClientRect().top + window.scrollY - 110, behavior: 'smooth' });
    setTimeout(function () { done.focus({ preventScroll: true }); }, 300);
  }
  function mailFallback(d) {
    var body = mailText(d);
    var href = mailHref(d, body);
    $('#mail-copy').value = body;
    $('[data-mail-open]').setAttribute('href', href);
    showDone('mail', d);
    try { window.location.href = href; } catch (e) {}
  }
  $('[data-mail-copy]').addEventListener('click', function () {
    var ta = $('#mail-copy');
    var status = $('[data-copied]');
    function ok() { status.textContent = MSG.copied; }
    function legacy() {
      ta.focus(); ta.select();
      try { document.execCommand('copy') ? ok() : (status.textContent = MSG.copyFail); } catch (e) { status.textContent = MSG.copyFail; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(ok, legacy);
    else legacy();
  });

  /* ---------- submit ---------- */
  var btn = $('[data-submit]', form);
  var btnLabel = btn.innerHTML;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideAlert();
    var bad = fields().filter(function (f) { return !validateField(f); });
    if (bad.length) {
      showAlert(MSG.fix);
      var first = bad[0];
      var target = $('.input[aria-invalid="true"], .input, input', first);
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (target) setTimeout(function () { target.focus({ preventScroll: true }); }, 250);
      return;
    }
    var d = payload();
    if (!cfg.endpoint) { mailFallback(d); return; }
    btn.disabled = true;
    btn.textContent = MSG.sending;
    var controller = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 60000);
    fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(d),
      redirect: 'follow',
      credentials: 'omit',
      signal: controller ? controller.signal : undefined
    }).then(function (r) { return r.json(); }).then(function (res) {
      clearTimeout(timer);
      if (!res || !res.ok) throw new Error((res && res.error) || 'error');
      showDone('api', d);
    }).catch(function () {
      clearTimeout(timer);
      btn.disabled = false;
      btn.innerHTML = btnLabel;
      showAlert(MSG.fail + ' <a href="#" data-alert-mail>' + MSG.failMail + '</a>.');
      var a = $('[data-alert-mail]', alertBox);
      if (a) a.addEventListener('click', function (ev) { ev.preventDefault(); mailFallback(d); });
    });
  });
})();
