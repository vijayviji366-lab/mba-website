/* Corporate page system: sticky in-page section bar (body.sxp pages).
   Built from <main> sections that have an id; the label is the section's
   data-nav attribute, else its eyebrow, else its first h2. Shown only when a
   page has three or more such sections. */
(function () {
  var head = document.querySelector('.sxp-head');
  if (!head) return;
  var nav = document.getElementById('mainNav'), root = document.documentElement;
  function setTop() { if (nav) root.style.setProperty('--sxp-top', nav.getBoundingClientRect().height + 'px'); }
  setTop(); addEventListener('resize', setTop); addEventListener('scroll', setTop, { passive: true });

  var secs = [].slice.call(document.querySelectorAll('main > section[id]')).filter(function (s) {
    return !s.classList.contains('sxp-head') && s.style.display !== 'none';
  });
  function label(s) {
    if (s.dataset.nav) return s.dataset.nav;
    var e = s.querySelector('.eyebrow'); var h = s.querySelector('h2');
    var t = (e && e.textContent.trim()) || (h && h.textContent.trim()) || s.id;
    t = t.replace(/\s+/g, ' ');
    return t.length > 28 ? t.slice(0, 26).replace(/\s+\S*$/, '') + '…' : t;
  }
  secs = secs.filter(function (s) { return s.querySelector('h2'); });
  if (secs.length < 3) return;

  var bar = document.createElement('nav');
  bar.className = 'sxp-sub'; bar.setAttribute('aria-label', 'On this page');
  var inner = '<div class="container"><div class="sxp-sub-in">';
  secs.forEach(function (s) { inner += '<a href="#' + s.id + '">' + label(s).replace(/</g, '&lt;') + '</a>'; });
  bar.innerHTML = inner + '</div></div>';
  head.insertAdjacentElement('afterend', bar);

  var links = [].slice.call(bar.querySelectorAll('a')), map = {};
  links.forEach(function (l) { map[l.getAttribute('href').slice(1)] = l; });
  if (!('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (l) { l.classList.remove('on'); });
      var l = map[e.target.id]; if (!l) return;
      l.classList.add('on');
      var row = l.parentNode;
      row.scrollTo({ left: l.offsetLeft - row.clientWidth / 2 + l.clientWidth / 2, behavior: 'smooth' });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  secs.forEach(function (s) { io.observe(s); });
})();
