/**
 * Saveetha MBA — Events Store
 *
 * Unified data layer for News & Events across the site.
 *
 * PUBLIC pages (news.html, event.html, index.html teaser):
 *   - Always load from /data/events.json (so all visitors see the same data).
 *
 * ADMIN page (admin.html):
 *   - Reads + writes a localStorage overlay keyed 'mba-events-draft'.
 *   - On first visit, seeds the overlay from /data/events.json.
 *   - "Publish" = download the current draft as events.json; the site owner
 *     uploads that file to the server to make edits go live.
 *
 * Upgrade path: swap the load/save functions with Firestore calls without
 * changing any of the rendering code.
 */
(function (global) {
  'use strict';

  const LS_KEY = 'mba-events-draft';
  const JSON_URL = 'data/events.json';

  // ---------- PUBLIC: used by news/event/index rendering ----------

  async function loadPublished() {
    // Always fetch from server-hosted JSON for public pages
    try {
      const res = await fetch(JSON_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const list = Array.isArray(data.events) ? data.events : [];
      return list
        .filter(e => e.published !== false)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch (err) {
      console.warn('[EventsStore] failed to load events.json', err);
      return [];
    }
  }

  async function getById(id) {
    const list = await loadPublished();
    return list.find(e => e.id === id) || null;
  }

  async function getRelated(id, type, limit) {
    const list = await loadPublished();
    const same = list.filter(e => e.id !== id && e.type === type);
    const others = list.filter(e => e.id !== id && e.type !== type);
    return same.concat(others).slice(0, limit || 3);
  }

  async function getFeatured(limit) {
    const list = await loadPublished();
    const featured = list.filter(e => e.featured);
    const rest = list.filter(e => !e.featured);
    return featured.concat(rest).slice(0, limit || 3);
  }

  // ---------- ADMIN: localStorage draft ----------

  function readDraft() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeDraft(payload) {
    payload.updated = new Date().toISOString().slice(0, 10);
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    return payload;
  }

  async function loadDraft() {
    // If a local draft exists, use it — unless the published file is a newer data
    // version (e.g. the sample placeholder draft from before the real register was loaded).
    const local = readDraft();
    if (local && Array.isArray(local.events)) {
      try {
        const res = await fetch(JSON_URL, { cache: 'no-store' });
        const pub = res.ok ? await res.json() : null;
        if (!pub || (local.version || 1) >= (pub.version || 1)) return local;
      } catch (e) { return local; }
    }
    // Otherwise seed from published JSON
    try {
      const res = await fetch(JSON_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      writeDraft(data);
      return data;
    } catch (err) {
      console.warn('[EventsStore] seed failed', err);
      return writeDraft({ events: [] });
    }
  }

  async function saveEvent(ev) {
    const draft = await loadDraft();
    const list = draft.events;
    const id = ev.id || slugify(ev.title || 'event') + '-' + Date.now().toString(36);
    ev.id = id;
    const idx = list.findIndex(e => e.id === id);
    if (idx >= 0) list[idx] = ev;
    else list.unshift(ev);
    writeDraft(draft);
    return ev;
  }

  async function removeEvent(id) {
    const draft = await loadDraft();
    draft.events = draft.events.filter(e => e.id !== id);
    writeDraft(draft);
  }

  function exportJSON() {
    const draft = readDraft() || { events: [] };
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'events.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importJSON(fileOrText) {
    return new Promise((resolve, reject) => {
      const apply = (txt) => {
        try {
          const parsed = JSON.parse(txt);
          if (!parsed || !Array.isArray(parsed.events)) throw new Error('Invalid shape — must have .events array');
          writeDraft(parsed);
          resolve(parsed);
        } catch (err) { reject(err); }
      };
      if (typeof fileOrText === 'string') return apply(fileOrText);
      const reader = new FileReader();
      reader.onload = () => apply(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(fileOrText);
    });
  }

  function resetDraft() {
    localStorage.removeItem(LS_KEY);
  }

  // ---------- helpers ----------

  function slugify(s) {
    return String(s).toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  function formatDateParts(iso) {
    if (!iso) return { d: '--', m: '---', y: '----', pretty: '' };
    const d = new Date(iso + (iso.length <= 10 ? 'T00:00:00' : ''));
    if (Number.isNaN(d.getTime())) return { d: '--', m: '---', y: '----', pretty: iso };
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return {
      d: String(d.getDate()).padStart(2, '0'),
      m: months[d.getMonth()],
      y: String(d.getFullYear()),
      pretty: d.getDate() + ' ' + monthsLong[d.getMonth()] + ' ' + d.getFullYear()
    };
  }

  function kindLabel(type) {
    return { event: 'Event', news: 'News', award: 'Award', placement: 'Placement' }[type] || 'News';
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function hrefFor(ev) {
    if (ev.externalUrl) return ev.externalUrl;
    return 'event.html?id=' + encodeURIComponent(ev.id);
  }

  // ---------- event register helpers (categories, financial years, counts) ----------

  // Categories used on events.html; the admin form offers the same list.
  const CATEGORIES = {
    'conference': 'Conferences & conclaves',
    'fdp': 'FDPs & faculty workshops',
    'workshop': 'Workshops',
    'guest-lecture': 'Guest lectures, seminars & talks',
    'student-activity': 'Student activities'
  };

  // Indian academic/financial year runs June–May: 2025-06-01 .. 2026-05-31 => "2025-26".
  function fyOf(iso) {
    if (!iso) return '';
    const y = +iso.slice(0, 4), m = +iso.slice(5, 7);
    const start = m >= 6 ? y : y - 1;
    return start + '-' + String(start + 1).slice(2);
  }
  function fyLabel(fy) { return fy ? 'FY ' + fy.replace('-', '–') : ''; }
  function currentFy() { return fyOf(new Date().toISOString().slice(0, 10)); }
  // Most recent financial year that has fully ended.
  function lastCompleteFy() {
    const cur = currentFy(); const s = +cur.slice(0, 4) - 1;
    return s + '-' + String(s + 1).slice(2);
  }
  function resolveFy(spec) {
    if (!spec) return '';
    if (spec === 'current') return currentFy();
    if (spec === 'last-complete') return lastCompleteFy();
    return spec;
  }
  function kindOf(ev) { return (ev.kind || (ev.tag || '').split(' · ')[0] || '').trim(); }
  function listOf(v) { return String(v || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean); }

  // Filter events: { cat: 'guest-lecture,fdp', kind: 'Guest lecture', fy: '2025-26' | 'current' | 'last-complete' }
  function filterEvents(events, f) {
    f = f || {};
    const cats = listOf(f.cat), kinds = listOf(f.kind), fy = resolveFy(f.fy);
    return events.filter(ev =>
      (ev.type || 'event') === 'event' &&
      (!cats.length || cats.includes(String(ev.category || '').toLowerCase())) &&
      (!kinds.length || kinds.includes(kindOf(ev).toLowerCase())) &&
      (!fy || fyOf(ev.date) === fy));
  }
  // Organisations that sent speakers/trainers (conclave panels are listed separately, so excluded).
  function industrySessions(events) {
    return events.filter(ev => (ev.type || 'event') === 'event' && ev.category !== 'conference' &&
      Array.isArray(ev.organisations) && ev.organisations.length);
  }
  function industryOrgs(events) {
    const s = new Set();
    industrySessions(events).forEach(ev => ev.organisations.forEach(o => s.add(o)));
    return s;
  }

  // ---------- exports ----------
  global.EventsStore = {
    // public
    loadPublished, getById, getRelated, getFeatured,
    // admin
    loadDraft, saveEvent, removeEvent, exportJSON, importJSON, resetDraft,
    // helpers
    formatDateParts, kindLabel, escapeHTML, hrefFor, slugify,
    // register helpers
    CATEGORIES, fyOf, fyLabel, currentFy, lastCompleteFy, resolveFy, kindOf,
    filterEvents, industrySessions, industryOrgs
  };
})(window);
