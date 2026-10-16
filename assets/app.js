(function () {
  var doc = document.documentElement;
  doc.classList.remove('no-js');

  /* When the page is opened straight from disk (file://), folder links like "en/"
     would show a directory listing - point them at index.html instead. */
  if (location.protocol === 'file:') {
    document.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (!h || h.charAt(0) === '#' || /^[a-z][a-z0-9+.-]*:/i.test(h)) return;
      var m = h.match(/^((?:\.\.?\/)*(?:[\w-]+\/)*)(#.*)?$/);
      if (m) a.setAttribute('href', (m[1] === './' ? '' : m[1]) + 'index.html' + (m[2] || ''));
    });
  }

  /* Header: solid background after leaving the top of the page */
  var header = document.querySelector('.site-header');
  function onScroll() {
    if (!header) return;
    header.classList.toggle('is-solid', window.scrollY > 40);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* Mobile menu */
  var btn = document.querySelector('.menu-btn');
  var panel = document.getElementById('mobile-panel');
  function setMenu(open) {
    if (!btn || !panel) return;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.classList.toggle('is-open', open);
    header.classList.toggle('menu-open', open);
  }
  if (btn && panel) {
    btn.addEventListener('click', function () {
      setMenu(btn.getAttribute('aria-expanded') !== 'true');
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
  }

  /* Language menu: close on outside click, Esc, or after choosing */
  var menus = Array.prototype.slice.call(document.querySelectorAll('.lang-menu'));
  if (menus.length) {
    document.addEventListener('click', function (e) {
      menus.forEach(function (m) { if (m.open && !m.contains(e.target)) m.open = false; });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      menus.forEach(function (m) {
        if (m.open) { m.open = false; var s = m.querySelector('summary'); if (s) s.focus(); }
      });
    });
  }

  /* Reveal on scroll */
  var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduce) {
    // items already on screen stay visible; only those below the fold animate in
    var vh = window.innerHeight || 800;
    items.forEach(function (el) { if (el.getBoundingClientRect().top < vh) el.classList.add('is-in'); });
    doc.classList.add('reveal-ready');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach(function (el) { if (!el.classList.contains('is-in')) io.observe(el); });
    // safety net: never leave content hidden
    setTimeout(function () { items.forEach(function (el) { el.classList.add('is-in'); }); }, 4000);
  }

  /* Pause the hero video for users who prefer reduced motion */
  var vid = document.querySelector('.hero video');
  if (vid && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    try { vid.pause(); vid.removeAttribute('autoplay'); } catch (e) {}
  }

  /* Language suggestion (no redirect; just a small, dismissible hint) */
  var bar = document.querySelector('.lang-suggest');
  if (bar) {
    var pageLang = doc.getAttribute('data-lang') || doc.getAttribute('lang') || 'pl';
    var dismissed = false;
    try { dismissed = sessionStorage.getItem('ac-lang-hint') === '1'; } catch (e) {}
    var prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).map(function (l) { return String(l).toLowerCase().slice(0, 2); });
    var map = { pl: 'pl', en: 'en', ru: 'ru', be: 'ru', kk: 'ru', ky: 'ru', uz: 'ru', tg: 'ru', hy: 'ru', az: 'ru', ka: 'ru', uk: 'ua', zh: 'zh', ar: 'ar' };
    var target = null;
    for (var i = 0; i < prefs.length; i++) {
      if (map[prefs[i]]) { target = map[prefs[i]]; break; }
    }
    if (!target) target = 'en';
    if (!dismissed && target !== pageLang) {
      var opt = bar.querySelector('[data-lang="' + target + '"]');
      if (opt) {
        bar.querySelectorAll('[data-lang]').forEach(function (el) { if (el !== opt) el.hidden = true; });
        bar.classList.add('is-visible');
      }
    }
    var close = bar.querySelector('button');
    if (close) close.addEventListener('click', function () {
      bar.classList.remove('is-visible');
      try { sessionStorage.setItem('ac-lang-hint', '1'); } catch (e) {}
    });
  }
})();
