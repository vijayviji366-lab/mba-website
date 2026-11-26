/**
 * Saveetha MBA — live event lists and counts
 *
 * Everything here is computed from data/events.json (the file the admin page
 * edits and exports), so adding an event updates every list and number.
 * The HTML keeps the last-built values as a fallback if the data can't load.
 *
 * Markup hooks:
 *   <b data-ev-stat="count" data-ev-cat="guest-lecture" data-ev-kind="Guest lecture" data-ev-fy="last-complete">24</b>
 *       data-ev-stat: count | orgs | sessions        (orgs/sessions = Industry Connect figures)
 *       data-ev-cat:  conference,fdp,workshop,guest-lecture,student-activity (comma list, optional)
 *       data-ev-kind: kind label(s) such as "Guest lecture" (comma list, optional)
 *       data-ev-fy:   "2025-26" | "current" | "last-complete" (optional; omit for all years)
 *   <span data-ev-fylabel="last-complete">2025–26</span>     -> the resolved year, e.g. 2025–26
 *   <span data-ev-range>June 2025 to October 2026</span>      -> first to latest event month
 *   <span data-ev-latest>October 2026</span>                  -> latest event month
 *   <div data-ev-list="guest-lecture">…</div>                  -> dated list grouped by FY (events.html)
 *   <div data-ev-featured="6">…</div>                          -> highlight cards (featured events with a cover)
 */
(function () {
  'use strict';

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MON = MONTHS.map(m => m.slice(0, 3));

  function parse(iso) { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? null : d; }
  function monthYear(iso) { const d = parse(iso); return d ? MONTHS[d.getMonth()] + ' ' + d.getFullYear() : ''; }

  function dateRangeShort(ev) {
    const a = parse(ev.date), b = ev.end ? parse(ev.end) : null;
    if (!a) return '';
    if (!b || b.getTime() === a.getTime()) return a.getDate() + ' ' + MON[a.getMonth()] + ' ' + a.getFullYear();
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear())
      return a.getDate() + '-' + b.getDate() + ' ' + MON[a.getMonth()] + ' ' + a.getFullYear();
    return a.getDate() + ' ' + MON[a.getMonth()] + ' - ' + b.getDate() + ' ' + MON[b.getMonth()] + ' ' + b.getFullYear();
  }

  function datebox(ev, S) {
    const a = parse(ev.date), b = ev.end ? parse(ev.end) : null;
    if (!a) return '<span class="evl-date evl-date-tba"><b>TBA</b><span>Date to follow</span></span>';
    const day = (b && b.getMonth() === a.getMonth() && b.getDate() !== a.getDate()) ? a.getDate() + '-' + b.getDate() : String(a.getDate());
    return '<time class="evl-date" datetime="' + S.escapeHTML(ev.date) + '"><b>' + day + '</b><span>' +
      MON[a.getMonth()] + ' ' + a.getFullYear() + '</span></time>';
  }

  function hasDetail(ev) { return !!(ev.externalUrl || (ev.body && ev.body.trim()) || (ev.gallery && ev.gallery.length)); }

  function itemHTML(ev, S) {
    const title = S.escapeHTML(ev.title);
    const h4 = hasDetail(ev) ? '<a href="' + S.escapeHTML(S.hrefFor(ev)) + '">' + title + '</a>' : title;
    const who = ev.speakers ? '<p>' + S.escapeHTML(ev.speakers) + '</p>' : (ev.summary ? '<p>' + S.escapeHTML(ev.summary) + '</p>' : '');
    const note = ev.note ? '<p class="evl-note">' + S.escapeHTML(ev.note) + '</p>' : '';
    const tag = ev.tag ? '<span class="evl-tag">' + S.escapeHTML(ev.tag) + '</span>' : '';
    return '<li class="evl-item">' + datebox(ev, S) + '<div class="evl-body">' + tag + '<h4>' + h4 + '</h4>' + who + note + '</div></li>';
  }

  function listHTML(events, S) {
    const byFy = {};
    events.forEach(ev => { const fy = S.fyOf(ev.date) || 'undated'; (byFy[fy] = byFy[fy] || []).push(ev); });
    return Object.keys(byFy).sort().reverse().map(fy => {
      const grp = byFy[fy].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const label = fy === 'undated' ? 'Date to follow' : S.fyLabel(fy);
      return '<h3 class="evl-fy">' + label + ' <span>' + grp.length + (grp.length === 1 ? ' entry' : ' entries') + '</span></h3>' +
        '<ol class="evl reveal in show is-visible visible">' + grp.map(ev => itemHTML(ev, S)).join('') + '</ol>';
    }).join('');
  }

  function featuredHTML(ev, S) {
    const kind = (S.kindOf(ev) || 'Event').replace(/^International conference$/, 'Conference');
    const meta = S.escapeHTML(kind + ' · ' + dateRangeShort(ev));
    const media = ev.coverPoster ? 'ev-media ev-media-poster' : 'ev-media';
    const h3 = S.escapeHTML(ev.cardTitle || ev.title);
    const link = hasDetail(ev) ? ' <a class="seeall" href="' + S.escapeHTML(S.hrefFor(ev)) + '">Read more</a>' : '';
    return '<article class="ev-card reveal in show is-visible visible"><div class="' + media + '"><img src="' + S.escapeHTML(ev.cover) +
      '" alt="' + S.escapeHTML(ev.coverAlt || ev.title) + '" loading="lazy"></div><div class="ev-body"><span class="ev-meta">' + meta +
      '</span><h3>' + h3 + '</h3><p>' + S.escapeHTML(ev.summary || '') + link + '</p></div></article>';
  }

  // Home "Life @ DoMS" grid: newest events that have a photo (cover, else first gallery image).
  function photoOf(ev) {
    if (ev.cover) return { url: ev.cover, alt: ev.coverAlt || ev.title };
    const g = Array.isArray(ev.gallery) ? ev.gallery.find(p => p && p.url) : null;
    return g ? { url: g.url, alt: g.alt || g.caption || ev.title } : null;
  }
  function recentHTML(ev, S, first) {
    const p = photoOf(ev), a = parse(ev.date);
    const kind = S.kindOf(ev) || 'Event';
    const when = a ? MON[a.getMonth()] + ' ' + a.getFullYear() : '';
    const title = S.escapeHTML(ev.cardTitle || ev.title);
    const b = hasDetail(ev) ? '<a href="' + S.escapeHTML(S.hrefFor(ev)) + '">' + title + '</a>' : title;
    const sum = first && ev.summary ? '<span class="sx-life-sum">' + S.escapeHTML(ev.summary) + '</span>' : '';
    return '<img src="' + S.escapeHTML(p.url) + '" alt="' + S.escapeHTML(p.alt) + '" loading="lazy">' +
      '<figcaption><small>' + S.escapeHTML(kind + (when ? ' · ' + when : '')) + '</small><b>' + b + '</b>' + sum + '</figcaption>';
  }

  async function run() {
    const S = window.EventsStore;
    if (!S || !S.filterEvents) return;
    const needs = document.querySelector('[data-ev-stat],[data-ev-list],[data-ev-featured],[data-ev-recent],[data-ev-fylabel],[data-ev-range],[data-ev-latest]');
    if (!needs) return;
    const all = await S.loadPublished();
    if (!all.length) return; // keep the static fallback
    const events = all.filter(ev => (ev.type || 'event') === 'event');

    document.querySelectorAll('[data-ev-stat]').forEach(el => {
      const kind = el.getAttribute('data-ev-stat');
      let n;
      if (kind === 'orgs') n = S.industryOrgs(events).size;
      else if (kind === 'sessions') n = S.industrySessions(events).length;
      else n = S.filterEvents(events, { cat: el.dataset.evCat, kind: el.dataset.evKind, fy: el.dataset.evFy }).length;
      el.textContent = String(n) + (el.dataset.evSuffix || '');
    });
    document.querySelectorAll('[data-ev-fylabel]').forEach(el => {
      el.textContent = S.resolveFy(el.getAttribute('data-ev-fylabel'));
    });
    const dated = events.filter(ev => ev.date).sort((a, b) => a.date.localeCompare(b.date));
    if (dated.length) {
      const first = monthYear(dated[0].date), last = monthYear(dated[dated.length - 1].date);
      document.querySelectorAll('[data-ev-range]').forEach(el => { el.textContent = first + ' to ' + last; });
      document.querySelectorAll('[data-ev-latest]').forEach(el => { el.textContent = last; });
    }
    document.querySelectorAll('[data-ev-list]').forEach(el => {
      const list = S.filterEvents(events, { cat: el.getAttribute('data-ev-list') });
      if (list.length) el.innerHTML = listHTML(list, S);
    });
    document.querySelectorAll('[data-ev-featured]').forEach(el => {
      const max = +el.getAttribute('data-ev-featured') || 6;
      const f = events.filter(ev => ev.featured && ev.cover).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, max);
      if (f.length) el.innerHTML = f.map(ev => featuredHTML(ev, S)).join('');
    });
    document.querySelectorAll('[data-ev-recent]').forEach(el => {
      const max = +el.getAttribute('data-ev-recent') || 5;
      const r = events.filter(ev => ev.date && photoOf(ev)).slice(0, max); // loadPublished is newest-first
      // Fill the existing <figure>s in place: on phones motion.js has already made them carousel slides.
      const figs = [...el.querySelectorAll(':scope > figure')];
      if (r.length >= max && figs.length === r.length) r.forEach((ev, i) => { figs[i].innerHTML = recentHTML(ev, S, i === 0); });
    });
  }

  // Long registers (e.g. 38 guest lectures) show the latest few, with a toggle for the rest.
  const SHOW = 6, MIN = 9;
  function collapseLongLists() {
    document.querySelectorAll('ol.evl').forEach(ol => {
      const n = ol.children.length;
      if (n < MIN || ol.dataset.collapsible) return;
      ol.dataset.collapsible = '1';
      ol.classList.add('evl-collapsed');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'evl-more';
      btn.setAttribute('aria-expanded', 'false');
      const label = () => btn.setAttribute('aria-expanded', String(!ol.classList.contains('evl-collapsed')));
      const text = () => { btn.textContent = ol.classList.contains('evl-collapsed') ? 'Show all ' + n + ' entries' : 'Show fewer'; };
      text();
      btn.addEventListener('click', () => {
        const opening = ol.classList.contains('evl-collapsed');
        ol.classList.toggle('evl-collapsed');
        text(); label();
        if (!opening) ol.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
      ol.after(btn);
    });
  }
  // Research registers: show the first few rows / the latest year, with a toggle for the rest (audit fix 2026-11-26).
  function collapseGroup(items, anchor, label) {
    if (!items.length || anchor.dataset.cx) return;
    anchor.dataset.cx = '1';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'evl-more';
    let open = false;
    const paint = () => {
      items.forEach(el => el.classList.toggle('cx-hide', !open));
      btn.textContent = open ? 'Show fewer' : label;
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', () => {
      open = !open; paint();
      if (!open) anchor.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    paint();
    anchor.after(btn);
  }
  function collapseRegisters() {
    document.querySelectorAll('#patents tbody').forEach(tb => {
      const rows = [...tb.rows];
      if (rows.length >= 9) collapseGroup(rows.slice(6), tb.closest('table').parentElement.matches('.table-wrap,[class*=table]') ? tb.closest('table').parentElement : tb.closest('table'), 'Show all ' + rows.length + ' patents');
    });
    document.querySelectorAll('#books .chapter-list').forEach(ul => {
      const li = [...ul.children];
      if (li.length >= 9) collapseGroup(li.slice(6), ul, 'Show all ' + li.length + ' chapters');
    });
    // year-grouped registers: keep the latest year open, fold earlier years
    document.querySelectorAll('.evl-live').forEach(box => {
      const heads = [...box.querySelectorAll(':scope > .evl-fy')];
      if (heads.length < 2) return;
      const firstList = heads[0].nextElementSibling;
      if (!firstList || firstList.dataset.collapsible) return; // already folded by entry count
      const later = [];
      heads.slice(1).forEach(h => { later.push(h); if (h.nextElementSibling && h.nextElementSibling.matches('ol')) later.push(h.nextElementSibling); });
      const n = later.filter(el => el.matches('ol')).reduce((t, ol) => t + ol.children.length, 0);
      if (n < 3) return; // folding one or two entries saves nothing
      collapseGroup(later, firstList, 'Show earlier years (' + n + (n === 1 ? ' entry' : ' entries') + ')');
    });
  }
  function start() { run().catch(() => {}).finally(() => { collapseLongLists(); collapseRegisters(); }); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
