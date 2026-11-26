/**
 * Saveetha MBA — Life @ DoMS photo gallery (events.html)
 *
 * Builds a date-wise gallery from data/events.json: every published event that
 * has photos becomes an album, grouped by month, newest first. Year and
 * event-type chips filter the albums; any photo opens the lightbox, which steps
 * through that album. Adding photos to an event in the admin page adds it here.
 *
 * Markup hooks on events.html:
 *   #lgTimeline   where the months and albums are drawn
 *   #lgYears      year chips          #lgTypes   event-type chips
 *   #lgIC         Industry Connect group chips (ev.industry; same groups as industry-connect.html)
 *   #lgSummary    "N events · N photos" line
 *   #lightbox …   the shared lightbox markup (same as event.html)
 */
(function () {
  'use strict';

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MON = MONTHS.map(m => m.slice(0, 3));
  const TYPES = {
    'guest-lecture': 'Guest lectures & talks',
    'workshop': 'Workshops',
    'fdp': 'FDPs',
    'conference': 'Conferences & conclaves',
    'student-activity': 'Student activities',
    'industrial-visit': 'Industrial visits',
    'placement': 'Campus drives',
    'partnership': 'MoUs & partnerships'
  };

  const parse = iso => { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? null : d; };

  function dateLabel(ev) {
    const a = parse(ev.date), b = ev.end ? parse(ev.end) : null;
    if (!a) return '';
    if (!b || +b === +a) return a.getDate() + ' ' + MON[a.getMonth()] + ' ' + a.getFullYear();
    if (a.getMonth() === b.getMonth()) return a.getDate() + '-' + b.getDate() + ' ' + MON[a.getMonth()] + ' ' + a.getFullYear();
    return a.getDate() + ' ' + MON[a.getMonth()] + ' - ' + b.getDate() + ' ' + MON[b.getMonth()] + ' ' + b.getFullYear();
  }

  function photosOf(ev) {
    const list = (ev.gallery || []).filter(g => g && g.url);
    if (!list.length && ev.cover) list.push({ url: ev.cover, alt: ev.coverAlt || ev.title, caption: '' });
    return list;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const S = window.EventsStore;
    const timeline = document.getElementById('lgTimeline');
    if (!S || !timeline) return;
    const esc = S.escapeHTML;
    const IC = S.INDUSTRY || {};

    const all = (await S.loadPublished())
      .map(ev => Object.assign({}, ev, { photos: photosOf(ev) }))
      .filter(ev => ev.photos.length && parse(ev.date))
      .sort((a, b) => b.date.localeCompare(a.date));

    if (!all.length) {
      timeline.innerHTML = '<p class="lg-empty">Photos could not be loaded just now. The full list of events is on the <a href="research.html#guest-lectures">Research</a> page.</p>';
      return;
    }

    // ---------- search index: everything a visitor might type ----------
    const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, '');
    const strip = html => String(html || '').replace(/<[^>]+>/g, ' ');
    all.forEach(ev => {
      const d = parse(ev.date);
      ev._text = fold([
        ev.title, ev.cardTitle, ev.tag, ev.kind, TYPES[ev.category], ev.industry ? 'industry connect ' + IC[ev.industry].label : '', ev.speakers, ev.summary, ev.note, ev.context,
        (ev.organisations || []).join(' '), strip(ev.body), ev.photos.map(g => g.caption).join(' '),
        dateLabel(ev), MONTHS[d.getMonth()], d.getFullYear()
      ].join(' '));
    });

    // ---------- state (kept in the address bar so a filtered view can be shared) ----------
    const years = [...new Set(all.map(e => e.date.slice(0, 4)))].sort().reverse();
    const types = Object.keys(TYPES).filter(t => all.some(e => e.category === t));
    const ics = Object.keys(IC).filter(k => all.some(e => e.industry === k));
    const qs = new URLSearchParams(location.search);
    const state = {
      q: qs.get('q') || '',
      year: years.includes(qs.get('year')) ? qs.get('year') : 'all',
      month: /^(0[1-9]|1[0-2])$/.test(qs.get('month') || '') ? qs.get('month') : 'all',
      type: types.includes(qs.get('type')) ? qs.get('type') : 'all',
      ic: qs.get('ic') === 'any' || ics.includes(qs.get('ic')) ? qs.get('ic') : 'all'
    };

    const searchEl = document.getElementById('lgSearch');
    const clearEl = document.getElementById('lgClear');
    const monthEl = document.getElementById('lgMonth');
    const resetEl = document.getElementById('lgReset');

    const terms = () => fold(state.q).split(/\s+/).filter(Boolean);
    const icMatch = (e, v) => v === 'all' || (v === 'any' ? !!e.industry : e.industry === v);
    function matches(e, skip) {
      const t = terms();
      return (skip === 'year' || state.year === 'all' || e.date.startsWith(state.year)) &&
        (skip === 'month' || state.month === 'all' || e.date.slice(5, 7) === state.month) &&
        (skip === 'type' || state.type === 'all' || e.category === state.type) &&
        (skip === 'ic' || icMatch(e, state.ic)) &&
        t.every(w => e._text.includes(w));
    }

    // ---------- filter controls ----------
    const chip = (group, value, label) =>
      '<button type="button" class="lg-chip" data-group="' + group + '" data-value="' + value + '" aria-pressed="' + (state[group] === value) + '">' +
      esc(label) + ' <span></span></button>';
    document.getElementById('lgYears').innerHTML =
      chip('year', 'all', 'All years') + years.map(y => chip('year', y, y)).join('');
    document.getElementById('lgTypes').innerHTML =
      chip('type', 'all', 'All events') + types.map(t => chip('type', t, TYPES[t])).join('');
    const icEl = document.getElementById('lgIC');
    if (icEl) icEl.innerHTML = '<span class="lg-chips-label">Industry Connect</span>' +
      chip('ic', 'any', 'All Industry Connect') + ics.map(k => chip('ic', k, IC[k].short)).join('');

    // month list follows the chosen year (and only lists months that have events)
    function fillMonths() {
      const pool = all.filter(e => state.year === 'all' || e.date.startsWith(state.year));
      const ms = [...new Set(pool.map(e => e.date.slice(5, 7)))].sort().reverse();
      if (state.month !== 'all' && !ms.includes(state.month)) state.month = 'all';
      monthEl.innerHTML = '<option value="all">All months</option>' +
        ms.map(m => '<option value="' + m + '">' + MONTHS[Number(m) - 1] + '</option>').join('');
      monthEl.value = state.month;
    }

    function updateCounts() {
      document.querySelectorAll('.lg-chips .lg-chip').forEach(b => {
        const g = b.dataset.group, v = b.dataset.value;
        const n = all.filter(e => matches(e, g) && (v === 'all' || (g === 'year' ? e.date.startsWith(v) : g === 'ic' ? icMatch(e, v) : e.category === v))).length;
        b.querySelector('span').textContent = n;
        b.classList.toggle('is-empty', n === 0 && v !== 'all');
      });
    }

    function syncUrl() {
      const p = new URLSearchParams();
      if (state.q.trim()) p.set('q', state.q.trim());
      if (state.year !== 'all') p.set('year', state.year);
      if (state.month !== 'all') p.set('month', state.month);
      if (state.type !== 'all') p.set('type', state.type);
      if (state.ic !== 'all') p.set('ic', state.ic);
      const s = p.toString();
      history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
    }

    function update() {
      clearEl.hidden = !state.q;
      const any = state.q || state.year !== 'all' || state.month !== 'all' || state.type !== 'all' || state.ic !== 'all';
      resetEl.hidden = !any;
      updateCounts();
      syncUrl();
      render();
    }

    document.querySelectorAll('.lg-chips .lg-chip').forEach(btn => btn.addEventListener('click', () => {
      const g = btn.dataset.group;
      // the Industry Connect chips toggle: pressing the active one again shows every event
      state[g] = g === 'ic' && state.ic === btn.dataset.value ? 'all' : btn.dataset.value;
      document.querySelectorAll('.lg-chip[data-group="' + g + '"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === state[g])));
      if (g === 'year') fillMonths();
      update();
    }));
    monthEl.addEventListener('change', () => { state.month = monthEl.value; update(); });

    let timer = null;
    searchEl.value = state.q;
    searchEl.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = searchEl.value; update(); }, 160);
    });
    searchEl.addEventListener('keydown', e => { if (e.key === 'Escape' && searchEl.value) { searchEl.value = ''; state.q = ''; update(); } });
    clearEl.addEventListener('click', () => { searchEl.value = ''; state.q = ''; update(); searchEl.focus(); });

    function resetAll() {
      Object.assign(state, { q: '', year: 'all', month: 'all', type: 'all', ic: 'all' });
      searchEl.value = '';
      document.querySelectorAll('.lg-chips .lg-chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === 'all')));
      fillMonths();
      update();
    }
    resetEl.addEventListener('click', resetAll);
    timeline.addEventListener('click', e => {
      if (e.target.closest('[data-reset]')) resetAll();
      if (e.target.closest('[data-more]')) {
        const first = limit;
        limit += PAGE;
        render(true);
        // move focus to the first newly shown album so keyboard users keep their place
        const next = timeline.querySelectorAll('.lg-album')[first];
        const link = next && next.querySelector('h3 a');
        if (link) link.focus({ preventScroll: true });
      }
    });

    // highlight the search words in album titles
    function mark(text) {
      const safe = esc(text), t = terms().map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (!t.length) return safe;
      return safe.replace(new RegExp('(' + t.join('|') + ')', 'gi'), '<mark>$1</mark>');
    }

    // Mosaic tiles use the 1000px copies in <gallery>/thumbs/ (made by sample-tools/make-gallery-thumbs.sh);
    // if a thumbnail is missing the tile quietly falls back to the full photo. The lightbox always uses the full photo.
    function thumbOf(url) {
      return /\/events\/gallery\/[^/]+\/[^/]+\.(jpe?g|png)$/i.test(url) ? url.replace(/\/([^/]+)$/, '/thumbs/$1') : url;
    }
    timeline.addEventListener('error', e => {
      const img = e.target;
      if (img.tagName === 'IMG' && img.dataset.full && img.src.indexOf('/thumbs/') > -1) img.src = img.dataset.full;
    }, true);

    // ---------- album markup ----------
    function album(ev, i) {
      const p = ev.photos, shown = p.slice(0, 3), more = p.length - shown.length;
      const tiles = shown.map((g, k) =>
        '<button type="button" class="lg-tile" data-ev="' + i + '" data-idx="' + k + '" aria-label="Open photo ' + (k + 1) + ' of ' + p.length + ': ' + esc(ev.title) + '">' +
          '<img src="' + esc(thumbOf(g.url)) + '" data-full="' + esc(g.url) + '" alt="' + esc(g.alt || ev.title) + '" loading="lazy" decoding="async">' +
          (k === shown.length - 1 && more > 0 ? '<span class="lg-more">+' + more + '</span>' : '') +
        '</button>').join('');
      return (
        '<article class="lg-album" id="ev-' + esc(ev.id) + '">' +
          '<div class="lg-mosaic lg-n' + shown.length + '">' + tiles + '</div>' +
          '<div class="lg-info">' +
            '<span class="lg-meta"><time datetime="' + esc(ev.date) + '">' + dateLabel(ev) + '</time>' +
              (ev.tag ? ' · ' + esc(ev.tag) : '') + '</span>' +
            (ev.industry && IC[ev.industry] ? '<a class="lg-ic" href="industry-connect.html#' + esc(ev.industry) + '">Industry Connect · ' + esc(IC[ev.industry].short) + '</a>' : '') +
            '<h3><a href="' + esc(S.hrefFor(ev)) + '">' + mark(ev.cardTitle || ev.title) + '</a></h3>' +
            '<span class="lg-count">' + p.length + (p.length === 1 ? ' photo' : ' photos') + '</span>' +
          '</div>' +
        '</article>'
      );
    }

    let visible = [];
    // Show events a page at a time so the page stays short on phones (audit fix 2026-11-26)
    const PAGE = 12;
    let limit = PAGE;
    function render(keepLimit) {
      visible = all.filter(e => matches(e));
      if (!keepLimit) limit = PAGE;
      if (location.hash && /^#ev-/.test(location.hash)) {
        const at = visible.findIndex(e => 'ev-' + e.id === location.hash.slice(1));
        if (at >= limit) limit = Math.ceil((at + 1) / PAGE) * PAGE;
      }

      const nPhotos = visible.reduce((n, e) => n + e.photos.length, 0);
      document.getElementById('lgSummary').textContent =
        visible.length + (visible.length === 1 ? ' event · ' : ' events · ') + nPhotos + (nPhotos === 1 ? ' photo' : ' photos') +
        (visible.length ? ', ' + MONTHS[parse(visible[visible.length - 1].date).getMonth()] + ' ' + visible[visible.length - 1].date.slice(0, 4) +
          ' to ' + MONTHS[parse(visible[0].date).getMonth()] + ' ' + visible[0].date.slice(0, 4) : '');

      if (!visible.length) {
        timeline.innerHTML = '<div class="lg-empty"><p>No events match ' +
          (state.q.trim() ? '"' + esc(state.q.trim()) + '"' : 'these filters') +
          '. Try another word, or clear the filters.</p><button type="button" class="lg-chip lg-reset-all" data-reset>Clear all filters</button></div>';
        return;
      }

      // group by month, newest first
      const groups = [];
      visible.slice(0, limit).forEach((ev, i) => {
        const key = ev.date.slice(0, 7);
        if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, items: [] });
        groups[groups.length - 1].items.push([ev, i]);
      });

      timeline.innerHTML = groups.map(g => {
        const d = parse(g.key + '-01');
        return (
          '<section class="lg-month" id="m-' + g.key + '" aria-label="' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + '">' +
            '<h2 class="sr-only">' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + '</h2>' +
            '<header class="lg-when" aria-hidden="true"><span class="lg-mon">' + MONTHS[d.getMonth()] + '</span><span class="lg-yr">' + d.getFullYear() + '</span>' +
              '<span class="lg-n">' + g.items.length + (g.items.length === 1 ? ' event' : ' events') + '</span></header>' +
            '<div class="lg-grid">' + g.items.map(([ev, i]) => album(ev, i)).join('') + '</div>' +
          '</section>'
        );
      }).join('') +
      (visible.length > limit
        ? '<div class="lg-loadmore"><button type="button" class="lg-more-btn" data-more>Show more events</button>' +
          '<span>Showing ' + limit + ' of ' + visible.length + ' events</span></div>'
        : '');

      timeline.querySelectorAll('.lg-tile').forEach(t => {
        t.addEventListener('click', () => openBox(Number(t.dataset.ev), Number(t.dataset.idx)));
        // posters (square or portrait) are shown whole rather than cropped
        const img = t.querySelector('img');
        const mark = () => { if (img.naturalHeight > img.naturalWidth * 0.9) t.classList.add('is-poster'); };
        if (img.complete && img.naturalWidth) mark(); else img.addEventListener('load', mark, { once: true });
      });
    }

    // ---------- lightbox ----------
    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lbImage');
    const lbCap = document.getElementById('lbCaption');
    const lbCount = document.getElementById('lbCounter');
    let cur = null, idx = 0, lastFocus = null;

    function show(i) {
      const p = cur.photos;
      idx = ((i % p.length) + p.length) % p.length;
      const g = p[idx];
      lbImg.src = g.url;
      lbImg.alt = g.alt || cur.title;
      lbCap.innerHTML = '<b>' + esc(cur.title) + '</b>' + (g.caption ? '<br>' + esc(g.caption) : '');
      lbCount.textContent = dateLabel(cur) + ' · ' + (idx + 1) + ' / ' + p.length;
      const multi = p.length > 1;
      document.getElementById('lbPrev').hidden = !multi;
      document.getElementById('lbNext').hidden = !multi;
    }
    function openBox(evIndex, i) {
      cur = visible[evIndex];
      if (!cur) return;
      lastFocus = document.activeElement;
      show(i);
      lb.hidden = false;
      lb.setAttribute('aria-hidden', 'false');
      document.body.classList.add('no-scroll');
      document.getElementById('lbClose').focus();
    }
    function closeBox() {
      lb.hidden = true;
      lb.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
      if (lastFocus) try { lastFocus.focus(); } catch (e) {}
    }
    document.getElementById('lbClose').addEventListener('click', closeBox);
    document.getElementById('lbPrev').addEventListener('click', () => show(idx - 1));
    document.getElementById('lbNext').addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', e => { if (e.target === lb) closeBox(); });
    document.addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeBox();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
    });

    fillMonths();
    update();

    // a link to events.html#ev-<id> scrolls to that album once it exists
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  });
})();
