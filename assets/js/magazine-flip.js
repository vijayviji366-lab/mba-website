/* Department magazine flipbook.
   Builds a page-turn reader from pre-rendered page images using StPageFlip
   (assets/js/vendor/page-flip.browser.js, MIT). Each .mzf element reads:
     data-pages  number of pages
     data-path   folder holding page-01.jpg, page-02.jpg, ...                */
(function () {
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function init(root) {
    var total = parseInt(root.getAttribute('data-pages'), 10);
    var path = root.getAttribute('data-path').replace(/\/$/, '');
    var title = root.getAttribute('data-title') || 'Magazine';
    var bookEl = root.querySelector('.mzf-book');
    var stage = root.querySelector('.mzf-stage');
    var label = root.querySelector('.mzf-count');
    var prev = root.querySelector('.mzf-prev');
    var next = root.querySelector('.mzf-next');
    var fs = root.querySelector('.mzf-fs');
    if (!window.St || !total || !bookEl) return;

    var pages = [];
    for (var i = 1; i <= total; i++) {
      var pg = document.createElement('div');
      pg.className = 'mzf-page';
      // Covers turn as stiff boards; inner pages bend.
      if (i === 1 || i === total) pg.setAttribute('data-density', 'hard');
      var img = document.createElement('img');
      img.alt = title + ', page ' + i;
      img.decoding = 'async';
      img.draggable = false;
      img.setAttribute('data-src', path + '/page-' + pad(i) + '.jpg');
      pg.appendChild(img);
      bookEl.appendChild(pg);
      pages.push(img);
    }

    // Load the pages around the reader's position, a few ahead.
    function loadAround(idx) {
      for (var j = Math.max(0, idx - 2); j <= Math.min(total - 1, idx + 5); j++) {
        var im = pages[j];
        if (im.getAttribute('data-src')) {
          im.src = im.getAttribute('data-src');
          im.removeAttribute('data-src');
        }
      }
    }
    loadAround(0);

    var book = new St.PageFlip(bookEl, {
      width: 500,
      height: 707,            // A4 proportions (1 : 1.414)
      size: 'stretch',
      minWidth: 260,
      maxWidth: 1000,
      minHeight: 368,
      maxHeight: 1414,
      showCover: true,
      usePortrait: true,      // single page on narrow screens
      mobileScrollSupport: true,
      maxShadowOpacity: 0.45,
      flippingTime: 800,
      showPageCorners: true
    });
    book.loadFromHTML(bookEl.querySelectorAll('.mzf-page'));

    function update() {
      var idx = book.getCurrentPageIndex();
      loadAround(idx);
      var shown = idx + 1;
      var spread = book.getOrientation && book.getOrientation() === 'landscape' &&
                   idx > 0 && idx < total - 1;
      label.textContent = spread
        ? 'Pages ' + shown + '-' + Math.min(shown + 1, total) + ' of ' + total
        : 'Page ' + shown + ' of ' + total;
      prev.disabled = idx <= 0;
      next.disabled = idx >= total - (spread ? 2 : 1);
    }
    book.on('flip', update);
    book.on('changeOrientation', update);
    book.on('init', update);
    update();

    prev.addEventListener('click', function () { book.flipPrev(); });
    next.addEventListener('click', function () { book.flipNext(); });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { book.flipNext(); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { book.flipPrev(); e.preventDefault(); }
    });

    if (fs) {
      var canFs = stage.requestFullscreen || stage.webkitRequestFullscreen;
      if (!canFs) { fs.hidden = true; }
      fs.addEventListener('click', function () {
        var cur = document.fullscreenElement || document.webkitFullscreenElement;
        if (cur) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
        else { (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage); }
      });
      function onFs() {
        var on = !!(document.fullscreenElement || document.webkitFullscreenElement);
        root.classList.toggle('is-fs', on);
        fs.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
        fs.querySelector('span').textContent = on ? 'Exit full screen' : 'Full screen';
        // Let the book re-measure its new container.
        setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60);
      }
      document.addEventListener('fullscreenchange', onFs);
      document.addEventListener('webkitfullscreenchange', onFs);
    }

    root.classList.add('is-ready');
  }

  function boot() {
    var els = document.querySelectorAll('.mzf');
    for (var k = 0; k < els.length; k++) init(els[k]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
