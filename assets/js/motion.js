/* =========================================================
   Motion layer (2026-11-26): scroll reveals, photo reveals,
   number count-ups, header entrance, swipe sliders and the
   back-to-top progress ring. Loaded on every page after common.js.
   - Nothing is hidden that is already on screen when the script runs,
     so there is no flash of disappearing content.
   - Classes are removed once an animation finishes, so each component's
     own hover/transition rules keep working afterwards.
   - prefers-reduced-motion: reveals/counters are skipped; sliders still work.
   ========================================================= */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  function $$(sel, ctx) { return [].slice.call((ctx || doc).querySelectorAll(sel)); }
  var main = doc.querySelector('main') || doc.body;

  /* Zones the motion layer must not touch: they have their own animation
     or are scrolling strips. */
  var SKIP = '.cine-hero, .placed-ticker, .recruiter-marquee, [data-marquee], .rm-rows, .rs-slider, .mzf, ' +
    '.sxp-sub, .scholarship-popup, dialog, .cta-section, .cta-banner, .reveal, .rev, [data-no-motion], ' +
    '#mainNav, body > header, body > footer, body > nav, .mo-slider, .lg-mosaic, .icx-strip, .editor-bar';

  function skipped(el) { return !!el.closest(SKIP); }

  /* ============ 1. Sliders (run first so reveal skips their items) ============ */
  var SLIDERS = [
    // selector, mode ('always' | max-width breakpoint in px), items per view [desktop, ≤1100, ≤760]
    { sel: '#placements .sx-learners', mode: 'always', per: [5, 3, 1.7], label: 'Placed learners' },
    { sel: '.story-quotes', mode: 900, per: [1, 1, 1.08], label: 'Alumni success stories' },
    { sel: '#why .ab-why', mode: 760, per: [1, 1, 1.15], label: 'Why choose us' },
    { sel: '#objectives .ab-objectives', mode: 760, per: [1, 1, 1.15], label: 'What we work towards' },
    { sel: '#specialisations .spec-grid', mode: 760, per: [1, 1, 1.2], label: 'Specialisations' },
    { sel: '#specialisations .pf-spec-grid', mode: 760, per: [1, 1, 1.2], label: 'Specialisations' },
    { sel: '#campus .inf-campus', mode: 760, per: [1, 1, 1.15], label: 'Campus facilities' },
    { sel: '#centres .cx-cards', mode: 760, per: [1, 1, 1.12], label: 'Centres of Excellence' },
    { sel: '#engagement .teaser-grid', mode: 760, per: [1, 1, 1.15], label: 'Alumni engagement' },
    { sel: '#scholarships .teaser-grid', mode: 760, per: [1, 1, 1.15], label: 'Scholarships' },
    // phones: long card stacks on Home and Research become swipe rows (audit fix 2026-11-26)
    { sel: '#events .sx-life', mode: 760, per: [1, 1, 1.15], label: 'Life at DoMS' },
    { sel: '#explore .rn-cards', mode: 760, per: [1, 1, 1.15], label: 'Explore Research Nexus' },
    { sel: '#books .book-grid', mode: 760, per: [1, 1, 1.15], label: 'Books' },
    { sel: '#conferences .ev-grid', mode: 760, per: [1, 1, 1.15], label: 'Research workshops and FDPs' },
    { sel: '#workshops .photo-trio', mode: 760, per: [1, 1, 1.1], label: 'Workshop photos' },
    { sel: '#guest-lectures .photo-trio', mode: 760, per: [1, 1, 1.1], label: 'Guest lecture photos' }
  ];

  var ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
  var ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  function pad(n) { return ('0' + Math.max(1, n)).slice(-2); }
  function makeSlider(track, cfg) {
    if (track.dataset.moSlider) return;
    var items = [].slice.call(track.children).filter(function (c) { return c.nodeType === 1; });
    if (items.length < 2) return;
    track.dataset.moSlider = '1';

    var wrap = doc.createElement('div');
    wrap.className = 'mo-slider' + (cfg.mode === 'always' ? ' mo-slider--always' : ' mo-slider--m' + cfg.mode);
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-roledescription', 'carousel');
    wrap.setAttribute('aria-label', cfg.label);
    wrap.style.setProperty('--p1', cfg.per[0]);
    wrap.style.setProperty('--p2', cfg.per[1]);
    wrap.style.setProperty('--p3', cfg.per[2]);
    track.parentNode.insertBefore(wrap, track);
    wrap.appendChild(track);
    track.classList.add('mo-track');
    track.setAttribute('tabindex', '0');
    items.forEach(function (it, i) {
      it.classList.add('mo-slide');
      it.setAttribute('aria-roledescription', 'slide');
      it.setAttribute('aria-label', (i + 1) + ' of ' + items.length);
      // Items in a slider should never wait on the old scroll reveal.
      if (it.classList.contains('reveal')) it.classList.add('show');
    });

    var ctrl = doc.createElement('div');
    ctrl.className = 'mo-ctrl';
    ctrl.innerHTML =
      '<button type="button" class="mo-arrow mo-prev" aria-label="Previous">' + ICON_PREV + '</button>' +
      '<div class="mo-bar" aria-hidden="true"><span></span></div>' +
      '<span class="mo-count" aria-hidden="true"><b>01</b> / ' + ('0' + items.length).slice(-2) + '</span>' +
      '<button type="button" class="mo-arrow mo-next" aria-label="Next">' + ICON_NEXT + '</button>';
    wrap.appendChild(ctrl);
    var prev = ctrl.querySelector('.mo-prev'), next = ctrl.querySelector('.mo-next');
    var bar = ctrl.querySelector('.mo-bar span'), count = ctrl.querySelector('.mo-count b');

    function active() { return getComputedStyle(track).display === 'flex' && track.scrollWidth > track.clientWidth + 4; }
    function step() {
      // one "page": as many whole cards as fit in view
      var w = items[1].offsetLeft - items[0].offsetLeft || items[0].getBoundingClientRect().width;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return Math.max(1, Math.floor((track.clientWidth + gap + 2) / w)) * w;
    }
    function first() {
      var x = track.scrollLeft, best = 0, bd = 1e9, base = items[0].offsetLeft;
      items.forEach(function (it, i) { var d = Math.abs(it.offsetLeft - base - x); if (d < bd) { bd = d; best = i; } });
      return best;
    }
    function update() {
      var on = active();
      wrap.classList.toggle('is-active', on);
      if (!on) return;
      var max = track.scrollWidth - track.clientWidth, x = track.scrollLeft;
      var visible = track.clientWidth / track.scrollWidth;
      bar.style.width = (visible * 100).toFixed(2) + '%';
      bar.style.transform = 'translateX(' + (max > 0 ? (x / max) * ((1 / visible) - 1) * 100 : 0).toFixed(2) + '%)';
      prev.disabled = x <= 2;
      next.disabled = x >= max - 2;
      var w = items[1].offsetLeft - items[0].offsetLeft || 1;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      var inView = Math.max(1, Math.floor((track.clientWidth + gap + 2) / w));
      var a = x >= max - 2 ? items.length - inView + 1 : first() + 1;
      var b = Math.min(items.length, a + inView - 1);
      count.textContent = inView > 1 ? pad(a) + '-' + pad(b) : pad(a);
    }
    function go(dir) {
      track.scrollBy({ left: dir * step(), behavior: reduce ? 'auto' : 'smooth' });
    }
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    track.addEventListener('keydown', function (e) {
      if (e.target !== track) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    var raf = 0;
    track.addEventListener('scroll', function () {
      if (raf) return; raf = requestAnimationFrame(function () { raf = 0; update(); });
    }, { passive: true });
    window.addEventListener('resize', update);

    // Mouse drag (touch already swipes natively).
    var down = false, moved = false, sx = 0, sl = 0;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !active()) return;
      down = true; moved = false; sx = e.clientX; sl = track.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add('is-dragging'); }
      if (moved) { track.scrollLeft = sl - dx; e.preventDefault(); }
    });
    window.addEventListener('pointerup', function () {
      if (!down) return; down = false;
      if (moved) {
        track.classList.remove('is-dragging');
        // settle on the nearest card
        var i = first(), base = items[0].offsetLeft;
        track.scrollTo({ left: items[i].offsetLeft - base, behavior: reduce ? 'auto' : 'smooth' });
      }
    });
    track.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    track.addEventListener('dragstart', function (e) { if (active()) e.preventDefault(); });

    update();
    setTimeout(update, 400);
  }

  SLIDERS.forEach(function (cfg) { $$(cfg.sel).forEach(function (t) { makeSlider(t, cfg); }); });

  /* ============ 2. Back-to-top progress ring ============ */
  (function () {
    var ticking = false;
    function ring() {
      ticking = false;
      var btn = doc.querySelector('.to-top'); if (!btn) return;
      var max = root.scrollHeight - root.clientHeight;
      btn.style.setProperty('--mo-p', max > 0 ? Math.min(1, root.scrollTop / max).toFixed(4) : 0);
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(ring); } }, { passive: true });
    setTimeout(ring, 50);
  })();

  if (reduce || !hasIO) return;
  root.classList.add('mo-on');

  /* (3. Page-header entrance is pure CSS in motion.css, so it runs on first paint.) */

  /* ============ 4. Scroll reveal ============ */
  var vh = window.innerHeight || root.clientHeight;
  var LEAF = /^(P|H[1-6]|FIGURE|BLOCKQUOTE|TABLE|IMG|PICTURE|UL|OL|DL|DETAILS|FORM|A|BUTTON|VIDEO|IFRAME|ARTICLE|ASIDE|LI)$/;
  var marked = [];

  function below(el) { var r = el.getBoundingClientRect(); return r.top > vh * 0.92 && r.height > 0; }
  function mark(el, i, kind) {
    if (el.classList.contains('mo') || skipped(el) || !below(el)) return;
    el.classList.add('mo');
    if (kind) el.classList.add(kind);
    el.style.setProperty('--mo-d', Math.min(i, 7) * 75 + 'ms');
    marked.push(el);
  }
  function isGrid(el, cs) {
    if (el.children.length < 2) return false;
    if (cs.display === 'grid' || cs.display === 'inline-grid') return true;
    return cs.display === 'flex' && cs.flexWrap === 'wrap' && cs.flexDirection.indexOf('row') === 0;
  }
  function walk(el, depth) {
    var kids = [].slice.call(el.children), n = 0;
    kids.forEach(function (c) {
      if (c.matches(SKIP) || c.matches('script, style, template, br, hr, svg')) return;
      var cs = getComputedStyle(c);
      if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed' || cs.visibility === 'hidden') return;
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return; // scrolling strips
      if (isGrid(c, cs) && !LEAF.test(c.tagName)) {
        var j = 0;
        [].slice.call(c.children).forEach(function (g) {
          if (g.matches(SKIP) || getComputedStyle(g).display === 'none') return;
          mark(g, j++, 'mo-card');
        });
        return;
      }
      if (depth < 4 && c.children.length && !LEAF.test(c.tagName) && c.getBoundingClientRect().height > vh * 0.6) {
        walk(c, depth + 1);
      } else {
        mark(c, n++);
      }
    });
  }
  $$('main > section, main > div, body > section').forEach(function (sec) {
    if (sec.matches(SKIP) || sec.classList.contains('sxp-head')) return;
    walk(sec, 0);
  });

  /* Photos: a soft expand-in for large content images. */
  $$('main img').forEach(function (img) {
    if (img.classList.contains('mo') || skipped(img) || img.closest('.sxp-head') || img.closest('.mo-slide')) return;
    var r = img.getBoundingClientRect();
    if (r.width < 220 || r.height < 140 || r.top < vh * 0.92) return;
    img.classList.add('mo-photo');
    marked.push(img);
  });

  function done(el) {
    el.classList.remove('mo', 'mo-card', 'mo-photo', 'is-in');
    el.style.removeProperty('--mo-d');
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      io.unobserve(el);
      el.classList.add('is-in');
      var d = parseFloat(el.style.getPropertyValue('--mo-d')) || 0;
      setTimeout(function () { done(el); }, d + 1300);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  marked.forEach(function (el) { io.observe(el); });

  // Safety net: if anything is still hidden (e.g. an observer was missed
  // after a layout change), show it once the user has scrolled past it.
  window.addEventListener('load', function () {
    setTimeout(function () {
      $$('.mo:not(.is-in), .mo-photo:not(.is-in)').forEach(function (el) {
        if (el.getBoundingClientRect().bottom < 0) { el.classList.add('is-in'); setTimeout(function () { done(el); }, 1300); }
      });
    }, 1500);
  });
  window.addEventListener('beforeprint', function () {
    marked.forEach(done);
    (counters || []).forEach(function (c) { c.tn.nodeValue = c.orig; });
  });

  /* ============ 5. Number count-up ============ */
  var COMMON = '.stats-band .big, .p-stats .n, .p-stat .n, .stats-row .n, .sstat b, .ssb-stat b, .stat-item .big, .fi-n, [data-countup]';
  var NUM = /^\s*([₹$]?\s*)(\d[\d,]*(?:\.\d+)?)(\s*[+%]?\s*)$/;
  function firstTextNode(el) {
    var w = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) { if (/\d/.test(n.nodeValue)) return n; }
    return null;
  }
  var counters = [];
  $$('main b, main strong, main dd, main dt, main .n, main .num, main .big, .sxp-head b, .sxp-head dd, .sxp-head dt').forEach(function (el) {
    if (el.dataset.counted || el.matches(COMMON) || el.closest('.cine-hero, .mo-slide, [data-edit-active], .rs-slider')) return;
    if (el.children.length > 1) return;
    var full = el.textContent.trim();
    if (!/^[₹$]?\s*\d[\d,]*(\.\d+)?\s*[+%]?\s*([A-Za-z]{1,3}|\+|%)?\+?$/.test(full)) return;
    var fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 22) return;
    var tn = firstTextNode(el); if (!tn) return;
    var m = tn.nodeValue.match(NUM); if (!m) return;
    var raw = m[2].replace(/,/g, ''), value = parseFloat(raw);
    if (!isFinite(value) || value === 0 || /^0\d/.test(m[2])) return; // skip "01"-style step numbers
    if (!/[^\d]/.test(full) && value >= 1950 && value <= 2100) return; // a year
    var dec = (raw.split('.')[1] || '').length;
    var grouped = /,/.test(m[2]);
    el.dataset.counted = '1';
    counters.push({ el: el, tn: tn, pre: m[1], post: m[3], value: value, dec: dec, grouped: grouped, orig: tn.nodeValue });
  });
  function fmt(c, v) {
    var s = c.dec ? v.toFixed(c.dec) : String(Math.round(v));
    if (c.grouped) s = Number(s).toLocaleString('en-IN', { minimumFractionDigits: c.dec, maximumFractionDigits: c.dec });
    return c.pre + s + c.post;
  }
  function run(c) {
    var t0 = performance.now(), D = 1500;
    (function tick(t) {
      var p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 3);
      c.tn.nodeValue = p < 1 ? fmt(c, c.value * e) : c.orig;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
    // If frames are throttled (background tab), still land on the real value.
    setTimeout(function () { c.tn.nodeValue = c.orig; }, D + 400);
  }
  if (counters.length) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        cio.unobserve(en.target);
        counters.forEach(function (c) { if (c.el === en.target) run(c); });
      });
    }, { threshold: 0.4 });
    counters.forEach(function (c) {
      c.el.style.fontVariantNumeric = 'tabular-nums';
      c.tn.nodeValue = fmt(c, 0);
      cio.observe(c.el);
    });
  }
})();
