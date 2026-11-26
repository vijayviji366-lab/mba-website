/**
 * Saveetha MBA — Industry Connect page (industry-connect.html)
 *
 * "In action" gallery: one area at a time. A tab list picks the area; the
 * area's latest event is shown large (photo strip, description, people,
 * organisation, participants) and its other events are slim rows that swap
 * into the feature when chosen.
 *
 * Events come from data/events.json. An event belongs to an area through its
 * "industry" field (keys and labels in EventsStore.INDUSTRY). The same events
 * are photo albums in Life @ DoMS (events.html?ic=<key>), so an event added or
 * edited once shows up in both places.
 *
 * Markup hooks:
 *   [data-ic-area="<key>"]  overview index entry (data-intro = the area's intro text)
 *   [data-ic-count="<key>"] "N events" on an index entry
 *   [data-ic-stat="<key>"]  number of events in an area (key figures)
 *   #icxTabs / #icxPanel    the gallery
 * Deep links: industry-connect.html#<area key> opens that area;
 *             industry-connect.html#ic-<event id> opens that event.
 */
(function () {
  'use strict';

  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const parse = iso => { const d = iso ? new Date(iso + 'T00:00:00') : null; return d && !isNaN(d) ? d : null; };
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  function dateLabel(ev) {
    const a = parse(ev.date), b = parse(ev.end);
    if (!a) return 'Date to be confirmed';
    const one = d => d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
    if (!b || +b === +a) return one(a);
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear())
      return a.getDate() + '-' + b.getDate() + ' ' + MON[a.getMonth()] + ' ' + a.getFullYear();
    return one(a) + ' - ' + one(b);
  }

  const photosOf = ev => (ev.gallery || []).filter(p => p && p.url);
  // lead with an action photo rather than a poster
  function ordered(ev) {
    const g = photosOf(ev);
    const i = g.findIndex(p => !/poster/i.test(p.url));
    return i > 0 ? [g[i]].concat(g.slice(0, i), g.slice(i + 1)) : g;
  }

  // "Faculty coordinators: Dr. A and Dr. B" -> [label, text]; otherwise "Resource person(s)".
  function people(sp) {
    const m = /^([A-Z][A-Za-z -]{2,30}):\s*(.+)$/.exec(sp || '');
    if (m) return [m[1], m[2]];
    return sp ? ['Resource person' + (/;| and |, (Mr|Ms|Mrs|Dr)\.?\s/.test(sp) ? 's' : ''), sp] : null;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const S = window.EventsStore;
    const tabsEl = document.getElementById('icxTabs');
    const panel = document.getElementById('icxPanel');
    if (!S || !tabsEl || !panel) return;
    const esc = S.escapeHTML;
    const IC = S.INDUSTRY || {};

    // areas in page order, with the intro text written in the overview index
    const areas = [...document.querySelectorAll('[data-ic-area]')].map((a, i) => ({
      key: a.getAttribute('data-ic-area'),
      n: String(i + 1).padStart(2, '0'),
      title: a.querySelector('.icx-area-t').textContent,
      intro: a.getAttribute('data-intro') || ''
    })).filter(a => IC[a.key]);

    const byArea = {};
    areas.forEach(a => { byArea[a.key] = []; });
    (await S.loadPublished()).forEach(e => { if (byArea[e.industry]) byArea[e.industry].push(e); });
    Object.values(byArea).forEach(l => l.sort((a, b) => (b.date || '0').localeCompare(a.date || '0')));

    // ---------- figures and overview counts ----------
    document.querySelectorAll('[data-ic-count]').forEach(el => {
      const n = (byArea[el.getAttribute('data-ic-count')] || []).length;
      el.textContent = n ? n + (n === 1 ? ' event' : ' events') : '';
    });
    document.querySelectorAll('[data-ic-stat]').forEach(el => {
      const l = byArea[el.getAttribute('data-ic-stat')];
      if (l) el.textContent = l.length;
    });

    // ---------- tabs ----------
    tabsEl.innerHTML = areas.map(a =>
      '<button type="button" class="icx-tab" role="tab" id="icx-tab-' + a.key + '" aria-controls="icxPanel" aria-selected="false" data-key="' + a.key + '">' +
        '<span class="n">' + a.n + '</span><span class="t">' + esc(IC[a.key].short) + '</span>' +
        '<span class="c">' + byArea[a.key].length + '</span>' +
      '</button>').join('');
    const tabs = [...tabsEl.querySelectorAll('.icx-tab')];

    let area = null, current = null;

    function featureHTML(ev) {
      const g = ordered(ev);
      const first = g[0];
      const facts = [];
      const who = people(ev.speakers);
      if (who) facts.push(who);
      const orgs = ev.organisations || [];
      if (orgs.length && !(who && who[1].includes(orgs[0])))
        facts.push(['Organisation' + (orgs.length > 1 ? 's' : ''), orgs.join(', ')]);
      if (ev.audience) facts.push(['Participants', ev.audience]);
      const inGallery = g.length && parse(ev.date);
      return (
        '<article class="icx-feature" id="ic-' + esc(ev.id) + '">' +
          (first ?
            '<div class="icx-media">' +
              '<figure class="icx-main"><img src="' + esc(first.url) + '" alt="' + esc(first.alt || ev.title) + '" decoding="async">' +
                '<figcaption>' + esc(first.caption || '') + '</figcaption></figure>' +
              (g.length > 1 ? '<div class="icx-thumbs">' + g.map((p, i) =>
                '<button type="button" class="icx-thumb" aria-pressed="' + (i === 0) + '" data-i="' + i + '" aria-label="Show photo ' + (i + 1) + ' of ' + g.length + '">' +
                  '<img src="' + esc(p.url) + '" alt="" loading="lazy" decoding="async"></button>').join('') + '</div>' : '') +
            '</div>' : '') +
          '<div class="icx-body">' +
            '<span class="icx-meta"><time' + (ev.date ? ' datetime="' + esc(ev.date) + '"' : '') + '>' + dateLabel(ev) + '</time>' +
              (ev.kind || ev.tag ? ' · ' + esc(ev.kind || ev.tag) : '') + '</span>' +
            '<h4>' + esc(ev.cardTitle || ev.title) + '</h4>' +
            (ev.summary && ev.summary !== ev.speakers ? '<p class="icx-sum">' + esc(ev.summary) + '</p>' : '') +
            (facts.length ? '<dl class="icx-facts">' + facts.map(f => '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>').join('') + '</dl>' : '') +
            '<div class="icx-links">' +
              '<a class="icx-btn icx-btn-primary" href="' + esc(S.hrefFor(ev)) + '">Read the report</a>' +
              (inGallery ? '<a class="icx-btn icx-btn-line" href="events.html?ic=' + esc(ev.industry) + '#ev-' + esc(ev.id) + '">' + g.length + (g.length === 1 ? ' photo' : ' photos') + ' in Life @ DoMS</a>' : '') +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }

    function rowHTML(ev) {
      const p = ordered(ev)[0];
      const orgs = (ev.organisations || []).join(', ');
      return '<li><button type="button" class="icx-row" data-id="' + esc(ev.id) + '">' +
        '<span class="icx-row-img">' + (p ? '<img src="' + esc(p.url) + '" alt="" loading="lazy" decoding="async">' : '') + '</span>' +
        '<span class="icx-row-t"><small>' + dateLabel(ev) + (ev.kind ? ' · ' + esc(ev.kind) : '') + '</small>' +
          '<b>' + esc(ev.cardTitle || ev.title) + '</b>' + (orgs ? '<span>' + esc(orgs) + '</span>' : '') + '</span>' +
        ARROW + '</button></li>';
    }

    function markPoster(fig) {
      const img = fig && fig.querySelector('img');
      if (!img) return;
      const set = () => fig.classList.toggle('is-poster', img.naturalHeight > img.naturalWidth * 0.95);
      if (img.complete && img.naturalWidth) set(); else img.addEventListener('load', set, { once: true });
    }

    function show(key, evId, focusPanel) {
      const a = areas.find(x => x.key === key) || areas[0];
      const list = byArea[a.key];
      const ev = list.find(e => e.id === evId) || list[0];
      area = a.key; current = ev ? ev.id : null;
      tabs.forEach(t => {
        const on = t.dataset.key === a.key;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', 'icx-tab-' + a.key);
      const rest = list.filter(e => e !== ev);
      panel.innerHTML =
        '<header class="icx-panel-head"><h3>' + esc(IC[a.key].label) + '</h3>' +
          (a.intro ? '<p>' + esc(a.intro) + '</p>' : '') +
          '<a href="events.html?ic=' + a.key + '">All photos in Life @ DoMS</a></header>' +
        (ev ? featureHTML(ev) : '<p class="icx-loading">Events for this area are being added.</p>') +
        (rest.length ? '<h4 class="icx-more-h">More in this area · ' + rest.length + '</h4><ol class="icx-list">' + rest.map(rowHTML).join('') + '</ol>' : '');
      markPoster(panel.querySelector('.icx-main'));
      if (focusPanel) {
        const top = panel.getBoundingClientRect().top;
        if (top < 100 || top > innerHeight * 0.6) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    // photo strip, rows (event delegation: panel content is redrawn)
    panel.addEventListener('click', e => {
      const th = e.target.closest('.icx-thumb');
      if (th) {
        const ev = byArea[area].find(x => x.id === current);
        const p = ordered(ev)[Number(th.dataset.i)];
        const fig = panel.querySelector('.icx-main');
        fig.querySelector('img').src = p.url;
        fig.querySelector('img').alt = p.alt || ev.title;
        fig.querySelector('figcaption').textContent = p.caption || '';
        panel.querySelectorAll('.icx-thumb').forEach(b => b.setAttribute('aria-pressed', String(b === th)));
        markPoster(fig);
        return;
      }
      const row = e.target.closest('.icx-row');
      if (row) {
        show(area, row.dataset.id, true);
        const f = panel.querySelector('.icx-feature');
        if (f) f.setAttribute('tabindex', '-1'), f.focus({ preventScroll: true });
      }
    });

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => { show(t.dataset.key, null, false); history.replaceState(null, '', '#' + t.dataset.key); });
      t.addEventListener('keydown', e => {
        const k = e.key, dir = k === 'ArrowDown' || k === 'ArrowRight' ? 1 : k === 'ArrowUp' || k === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        const nx = tabs[(i + dir + tabs.length) % tabs.length];
        nx.focus(); nx.click();
      });
    });

    // overview entries open their area in the gallery (common.js does the smooth scroll to #in-action)
    document.querySelectorAll('[data-ic-area]').forEach(a => a.addEventListener('click', () => {
      const key = a.getAttribute('data-ic-area');
      show(key, null, false);
      setTimeout(() => history.replaceState(null, '', '#' + key), 0);
    }));

    // ---------- #<area> or #ic-<event id> in the address opens that area / event ----------
    function fromHash() {
      const h = decodeURIComponent(location.hash.slice(1));
      if (byArea[h]) return [h, null];
      if (h.startsWith('ic-')) {
        const id = h.slice(3);
        const k = Object.keys(byArea).find(x => byArea[x].some(e => e.id === id));
        if (k) return [k, id];
      }
      return null;
    }
    const start = fromHash();
    show(start ? start[0] : areas[0].key, start ? start[1] : null, false);
    if (start) requestAnimationFrame(() => document.getElementById('in-action').scrollIntoView());
    window.addEventListener('hashchange', () => {
      const t = fromHash();
      if (t && (t[0] !== area || (t[1] && t[1] !== current))) {
        show(t[0], t[1], false);
        document.getElementById('in-action').scrollIntoView();
      }
    });
  });
})();
