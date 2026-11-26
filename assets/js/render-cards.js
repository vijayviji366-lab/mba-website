/**
 * Saveetha MBA — Card renderer
 *
 * Renders an array of events into a container as editorial news cards.
 * Used by news.html (full list + filter) and by the homepage teaser.
 */
(function () {
  'use strict';

  const ARROW_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12h14m0 0l-6-6m6 6l-6 6"/></svg>';

  function cardHTML(ev, opts) {
    const S = window.EventsStore;
    const dp = S.formatDateParts(ev.date);
    const kind = S.kindLabel(ev.type);
    const href = S.hrefFor(ev);
    const targetAttr = (ev.externalUrl && /^https?:/.test(ev.externalUrl)) ? ' target="_blank" rel="noopener"' : '';
    const tagHTML = ev.tag ? '<span class="news-tag">' + S.escapeHTML(ev.tag) + '</span>' : '';
    // Fall back to the first gallery photo when the event has no cover image
    const firstPhoto = (Array.isArray(ev.gallery) && ev.gallery[0] && ev.gallery[0].url) || '';
    const coverUrl = (ev.cover && String(ev.cover).trim()) || firstPhoto;
    const hasCover = !!coverUrl;
    const coverClass = hasCover ? ' has-cover' : '';
    const mediaHTML = hasCover
      ? (
          '<a class="news-card-media" href="' + href + '"' + targetAttr + ' aria-hidden="true" tabindex="-1">' +
            '<img src="' + S.escapeHTML(coverUrl) + '" alt="" loading="lazy">' +
            '<span class="news-kind overlay">' + kind + '</span>' +
          '</a>'
        )
      : '';
    // If we have a cover, the kind pill lives on the image — keep the header strip but drop the secondary kind chip.
    const metaKindHTML = hasCover ? '' : '<span class="news-kind">' + kind + '</span>';
    return (
      '<article class="news-card reveal show' + coverClass + '" data-type="' + S.escapeHTML(ev.type) + '" data-id="' + S.escapeHTML(ev.id) + '">' +
        mediaHTML +
        '<div class="news-card-body">' +
          '<div class="news-card-meta">' +
            '<div class="news-date-strip">' +
              '<span class="d">' + dp.d + '</span>' +
              '<span class="m">' + dp.m + '</span>' +
              '<span class="y">' + dp.y + '</span>' +
            '</div>' +
            metaKindHTML +
          '</div>' +
          tagHTML +
          '<h3>' + S.escapeHTML(ev.title) + '</h3>' +
          '<p>' + S.escapeHTML(ev.summary) + '</p>' +
          '<div class="news-foot">' +
            '<span class="ctx">' + S.escapeHTML(ev.context || '') + '</span>' +
            '<a href="' + href + '"' + targetAttr + ' class="news-arrow" aria-label="Read more">' + ARROW_SVG + '</a>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function teaserHTML(ev) {
    // Homepage teaser uses the same anatomy but the whole card is a link
    const S = window.EventsStore;
    const dp = S.formatDateParts(ev.date);
    const kind = S.kindLabel(ev.type);
    const href = S.hrefFor(ev);
    const targetAttr = (ev.externalUrl && /^https?:/.test(ev.externalUrl)) ? ' target="_blank" rel="noopener"' : '';
    const hasCover = !!(ev.cover && String(ev.cover).trim());
    const coverClass = hasCover ? ' has-cover' : '';
    const mediaHTML = hasCover
      ? (
          '<div class="news-teaser-media">' +
            '<img src="' + S.escapeHTML(ev.cover) + '" alt="" loading="lazy">' +
            '<span class="news-teaser-kind overlay">' + kind + '</span>' +
          '</div>'
        )
      : '';
    // If the cover is present, the kind chip lives on the image. Otherwise keep it in the header strip.
    const metaKindHTML = hasCover ? '' : '<span class="news-teaser-kind">' + kind + '</span>';
    return (
      '<a class="news-teaser-card k-' + S.escapeHTML(ev.type) + coverClass + ' reveal show" href="' + href + '"' + targetAttr + ' data-id="' + S.escapeHTML(ev.id) + '">' +
        mediaHTML +
        '<div class="news-teaser-body">' +
          '<div class="news-teaser-meta">' +
            '<div class="news-teaser-date"><span class="d">' + dp.d + '</span><span class="m">' + dp.m + '</span></div>' +
            metaKindHTML +
          '</div>' +
          '<h3>' + S.escapeHTML(ev.title) + '</h3>' +
          '<p>' + S.escapeHTML(ev.summary) + '</p>' +
          '<div class="news-teaser-foot">' +
            '<span class="ctx">' + S.escapeHTML(ev.context || '') + '</span>' +
            '<span class="arrow">' + ARROW_SVG + '</span>' +
          '</div>' +
        '</div>' +
      '</a>'
    );
  }

  async function renderGrid(selector) {
    const host = document.querySelector(selector);
    if (!host) return;
    const events = await window.EventsStore.loadPublished();
    if (!events.length) {
      host.innerHTML = '<div class="news-empty"><p>No items yet — this page is updated regularly by the MBA Department.</p></div>';
      return;
    }
    host.innerHTML = events.map(cardHTML).join('');
    wireFilter(events);
  }

  async function renderTeaser(selector, limit) {
    const host = document.querySelector(selector);
    if (!host) return;
    const events = await window.EventsStore.getFeatured(limit || 3);
    if (!events.length) { host.innerHTML = ''; return; }
    host.innerHTML = events.map(teaserHTML).join('');
  }

  function wireFilter(allEvents) {
    const btns = document.querySelectorAll('.news-filter-btn');
    const grid = document.getElementById('newsGrid');
    const empty = document.getElementById('newsEmpty');
    if (!btns.length || !grid) return;
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(x => { x.classList.remove('is-active'); x.setAttribute('aria-selected', 'false'); });
        b.classList.add('is-active'); b.setAttribute('aria-selected', 'true');
        const f = b.getAttribute('data-filter');
        let shown = 0;
        grid.querySelectorAll('.news-card').forEach(function (c) {
          const t = c.getAttribute('data-type');
          const match = (f === 'all') || (t === f);
          c.style.display = match ? '' : 'none';
          if (match) shown++;
        });
        if (empty) empty.hidden = shown > 0;
      });
    });
  }

  window.EventRender = { renderGrid, renderTeaser, cardHTML, teaserHTML };
})();
