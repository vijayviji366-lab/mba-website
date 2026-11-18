/* =========================================================
   SAVEETHA MBA — COMMON SITE BEHAVIORS
   (nav toggle, scroll reveal, FAQ accordion, form UX)
   ========================================================= */
(function(){
  'use strict';

  // ============ Mobile menu toggle ============
  const mt = document.getElementById('mt');
  const menu = document.getElementById('menu');
  if(mt && menu){
    mt.addEventListener('click', ()=> menu.classList.toggle('open'));
    // Close the mobile menu on leaf-link clicks (not on parent submenu triggers, which expand)
    menu.querySelectorAll('a:not(.submenu-trigger)').forEach(a => {
      a.addEventListener('click', ()=> menu.classList.remove('open'));
    });
  }

  // ============ Submenu click-to-expand (mobile) + hover (desktop) ============
  (function(){
    const subMenus = document.querySelectorAll('.has-submenu');
    const isMobile = () => window.matchMedia('(max-width:1180px)').matches; // matches the hamburger breakpoint in styles.css
    subMenus.forEach(sm => {
      const trigger = sm.querySelector('.submenu-trigger');
      if(!trigger) return;
      trigger.addEventListener('click', (e) => {
        if(isMobile()){
          e.preventDefault();
          // Toggle this one; close siblings
          subMenus.forEach(other => { if(other !== sm) other.classList.remove('open'); });
          sm.classList.toggle('open');
        }
      });
    });
    // Click outside closes open submenus (desktop safety for touch-hover mismatch)
    document.addEventListener('click', (e) => {
      if(!e.target.closest('.has-submenu')){
        subMenus.forEach(s => s.classList.remove('open'));
      }
    });
  })();

  // ============ Scroll reveal (with stagger when siblings share a parent) ============
  if('IntersectionObserver' in window){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(entry => {
        if(entry.isIntersecting){
          // Stagger index within parent — 80ms step, capped at 640ms
          const el = entry.target;
          const siblings = Array.from(el.parentElement ? el.parentElement.querySelectorAll(':scope > .reveal') : []);
          const idx = Math.max(0, siblings.indexOf(el));
          const delay = Math.min(640, idx * 80);
          el.style.transitionDelay = delay + 'ms';
          el.classList.add('show');
          io.unobserve(entry.target);
        }
      });
    }, {threshold: 0.1, rootMargin: '0px 0px -60px 0px'});
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  }

  // ============ Number count-up ============
  (function(){
    if(!('IntersectionObserver' in window)) return;
    if(window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;

    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const fmt = (n, decimals) => decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString('en-IN');

    // Auto-targets: any stat number container we want to animate
    const targets = document.querySelectorAll(
      '.stats-band .big, .p-stats .n, .p-stat .n, .stats-row .n, .sstat b, .ssb-stat b, .stat-item .big, .fi-n, [data-countup]'
    );

    const parse = (el) => {
      // Capture the raw HTML (includes <sup>) so we can preserve suffix markup
      const raw = el.textContent.trim();
      // Match optional prefix (₹, $), number (with optional decimal), and trailing non-numeric
      const m = raw.match(/^([^\d.,-]*)([\d.,]+)(.*)$/);
      if(!m) return null;
      const prefix = m[1] || '';
      const numStr = m[2].replace(/,/g,'');
      const suffix = m[3] || '';
      const value = parseFloat(numStr);
      if(isNaN(value)) return null;
      const decimals = (numStr.split('.')[1] || '').length;
      return { prefix, value, suffix, decimals, originalHTML: el.innerHTML };
    };

    const animate = (el, parsed) => {
      const DURATION = 1400;
      const start = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - start) / DURATION);
        const v = parsed.value * easeOut(p);
        // Render: prefix + number + suffix (suffix may contain <sup>)
        el.innerHTML = parsed.prefix + fmt(v, parsed.decimals) + parsed.suffix;
        if(p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(!entry.isIntersecting) return;
        const el = entry.target;
        if(el.dataset.counted === '1') return;
        const parsed = parse(el);
        if(!parsed){ io.unobserve(el); return; }
        el.dataset.counted = '1';
        // Reset to 0 before animating
        el.innerHTML = parsed.prefix + fmt(0, parsed.decimals) + parsed.suffix;
        requestAnimationFrame(() => animate(el, parsed));
        io.unobserve(el);
      });
    }, { threshold: 0.35 });

    targets.forEach(el => {
      // Preserve the suffix tag (e.g. <sup>%</sup>) by working with textContent
      // but store originalHTML for fallback
      if(parse(el)) io.observe(el);
    });
  })();

  // ============ Recruiter marquee (home) ============
  (function(){
    const tracks = document.querySelectorAll('[data-marquee]');
    if(!tracks.length) return;
    // Duplicate children for seamless loop on every track
    tracks.forEach(track => {
      const kids = Array.from(track.children);
      kids.forEach(k => track.appendChild(k.cloneNode(true)));
    });
    // Pause on hover handled via CSS :hover
  })();

  // ============ FAQ accordion single-open ============
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(it => it.addEventListener('toggle', () => {
    if(it.open) faqItems.forEach(other => { if(other !== it) other.open = false; });
  }));

  // ============ Cinematic hero — magazine-style chapter slider (home only) ============
  (function(){
    const hero = document.getElementById('cineHero');
    if(!hero) return;
    const bgSlides  = hero.querySelectorAll('.cine-bg-slide');
    const txtSlides = hero.querySelectorAll('.cine-slide-txt');
    const chapBtns  = hero.querySelectorAll('.cine-chap');
    const thumbsSet = hero.querySelectorAll('.cine-thumbs');
    const total = chapBtns.length;
    if(!total) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

    let idx = 0, timer = null, paused = false;
    const AUTO_MS = 7000;

    // --- Word-wrap (lede) : each word becomes <span class="cw">
    const wrapWords = (el) => {
      if(!el || el.dataset.wrapped === '1') return;
      const tmp = document.createElement('div');
      tmp.innerHTML = el.innerHTML;
      let counter = 0;
      const walk = (node) => {
        const kids = Array.from(node.childNodes);
        kids.forEach(ch => {
          if(ch.nodeType === 3){ // text
            const parts = ch.textContent.split(/(\s+)/);
            const frag = document.createDocumentFragment();
            parts.forEach(p => {
              if(/^\s+$/.test(p)){ frag.appendChild(document.createTextNode(p)); }
              else if(p.length){
                const span = document.createElement('span');
                span.className = 'cw';
                span.style.setProperty('--i', counter++);
                span.textContent = p;
                frag.appendChild(span);
              }
            });
            node.replaceChild(frag, ch);
          } else if(ch.nodeType === 1){
            walk(ch);
          }
        });
      };
      walk(tmp);
      el.innerHTML = tmp.innerHTML;
      el.dataset.wrapped = '1';
    };

    // --- Letter-wrap (title) : each letter becomes <span class="cl">
    //     inside a word-level <span class="cw"> so whitespace wraps cleanly.
    //     Also appends a blinking caret and sets --titleLen so the caret
    //     can time its fade-out to the last letter.
    const wrapLetters = (el) => {
      if(!el || el.dataset.wrapped === '1') return;
      const tmp = document.createElement('div');
      tmp.innerHTML = el.innerHTML;
      let wIdx = 0;   // word index
      let jIdx = 0;   // running letter index across whole title
      const walk = (node) => {
        const kids = Array.from(node.childNodes);
        kids.forEach(ch => {
          if(ch.nodeType === 3){ // text
            const parts = ch.textContent.split(/(\s+)/);
            const frag = document.createDocumentFragment();
            parts.forEach(p => {
              if(/^\s+$/.test(p)){
                frag.appendChild(document.createTextNode(p));
              } else if(p.length){
                const word = document.createElement('span');
                word.className = 'cw';
                word.style.setProperty('--i', wIdx++);
                for (const c of p){
                  const letter = document.createElement('span');
                  letter.className = 'cl';
                  letter.style.setProperty('--j', jIdx++);
                  letter.textContent = c;
                  word.appendChild(letter);
                }
                frag.appendChild(word);
              }
            });
            node.replaceChild(frag, ch);
          } else if(ch.nodeType === 1){
            walk(ch);
          }
        });
      };
      walk(tmp);
      el.innerHTML = tmp.innerHTML;
      // Append caret at end of title
      const caret = document.createElement('span');
      caret.className = 'cine-caret';
      caret.setAttribute('aria-hidden', 'true');
      el.appendChild(caret);
      // Publish letter count so caret animation can time its fade-out
      el.style.setProperty('--titleLen', jIdx);
      el.dataset.wrapped = '1';
    };

    txtSlides.forEach(s => {
      wrapLetters(s.querySelector('.cine-title'));
      wrapWords(s.querySelector('.cine-lede'));
    });

    // --- Counter animation for [data-count] stat blocks ---------
    const animateCounter = (b) => {
      const target = parseFloat(b.dataset.count);
      if(isNaN(target)) return;
      const decimals = parseInt(b.dataset.decimals || '0', 10);
      const prefix = b.dataset.prefix || '';
      const suffix = b.dataset.suffix || '';
      if(prefersReduced){
        b.textContent = prefix + target.toFixed(decimals) + suffix;
        return;
      }
      const duration = 1400;
      const startT = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - startT) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const v = target * eased;
        b.textContent = prefix + v.toFixed(decimals) + suffix;
        if(t < 1) requestAnimationFrame(tick);
        else b.textContent = prefix + target.toFixed(decimals) + suffix;
      };
      requestAnimationFrame(tick);
    };
    const runCountersForSlide = (k) => {
      const slide = hero.querySelector(`.cine-slide-txt[data-slide="${k}"]`);
      if(!slide) return;
      slide.querySelectorAll('.cine-facts.is-counter b[data-count]').forEach(animateCounter);
    };

    // --- Progress ring on active chapter ------------------------
    const resetRings = () => {
      chapBtns.forEach(b => b.classList.remove('is-running'));
    };
    const startRing = () => {
      // Ring animation disabled — it implied auto-advance, which is off per user request.
      resetRings();
    };

    // --- Main slide change --------------------------------------
    const go = (i) => {
      idx = ((i % total) + total) % total;
      const k = idx + 1;
      bgSlides.forEach(s  => s.classList.toggle('active', +s.dataset.slide === k));
      txtSlides.forEach(s => s.classList.toggle('active', +s.dataset.slide === k));
      chapBtns.forEach(b  => b.classList.toggle('active', +b.dataset.go === k));
      thumbsSet.forEach(s => s.classList.toggle('active', +s.dataset.slide === k));

      // Re-run reveal: strip + re-add 'active' cleared above does the CSS re-trigger.
      // Kick counters + progress ring after a tick.
      setTimeout(() => runCountersForSlide(k), 820);
      startRing();
    };
    const next = () => go(idx + 1);
    // Auto-advance disabled per user request — hero background stays static.
    // Chapter clicks still work; there's just no automatic cycling or ring timer.
    const start = () => { stop(); };
    const stop  = () => { if(timer){ clearInterval(timer); timer = null; } resetRings(); };

    // --- Scroll-pinned advancer ---------------------------------
    // On desktop, the hero is wrapped in a 400vh .cine-pin-wrap.
    // Scrolling through that wrap advances the active chapter; once
    // chapter 04 is past, the pin releases and the next section appears.
    // On tablet/mobile the pin is disabled and chapters behave as tabs.
    const pinWrap = document.getElementById('cinePin');
    const mqDesktop = window.matchMedia('(min-width:1025px)');

    const pinScrollRange = () => {
      if(!pinWrap) return 0;
      return Math.max(0, pinWrap.offsetHeight - window.innerHeight);
    };

    // Convert chapter index → absolute page Y so clicks jump accurately
    const scrollTargetFor = (i) => {
      const range = pinScrollRange();
      if(!range) return 0;
      // Land a few pixels inside the target slice so the scroll handler
      // settles on chapter i (not i±1 due to floor rounding at boundaries).
      return pinWrap.offsetTop + (i / total) * range + 8;
    };

    const updateChapterFromScroll = () => {
      if(!mqDesktop.matches || !pinWrap) return;
      const range = pinScrollRange();
      if(!range) return;
      const rect = pinWrap.getBoundingClientRect();
      const scrolled = Math.max(0, Math.min(range, -rect.top));
      const p = scrolled / range;
      const newIdx = Math.min(total - 1, Math.max(0, Math.floor(p * total)));
      if(newIdx !== idx) go(newIdx);
    };

    // Chapter clicks — jump to that chapter's scroll offset on desktop,
    // fall back to direct swap on mobile (no pin).
    chapBtns.forEach(b => b.addEventListener('click', (e) => {
      const target = +b.dataset.go - 1;
      if(mqDesktop.matches && pinWrap){
        e.preventDefault();
        window.scrollTo({ top: scrollTargetFor(target), behavior: prefersReduced ? 'auto' : 'smooth' });
      } else {
        go(target); start();
      }
    }));

    // Passive scroll/resize listeners — cheap, no throttling needed
    // since go() short-circuits when the index hasn't changed.
    window.addEventListener('scroll', updateChapterFromScroll, { passive:true });
    window.addEventListener('resize', updateChapterFromScroll);
    // Initial sync in case the page loads deep-linked or mid-scroll
    requestAnimationFrame(updateChapterFromScroll);

    // Hover pauses (only when not reduced motion)
    hero.addEventListener('mouseenter', () => { paused = true;  stop(); });
    hero.addEventListener('mouseleave', () => { paused = false; start(); });

    // Keyboard: ← → to move, Esc to pause toggle
    document.addEventListener('keydown', (e) => {
      if(document.activeElement && /input|textarea|select/i.test(document.activeElement.tagName)) return;
      // On desktop (pinned mode), arrow keys should scroll to the next/prev
      // chapter's slice so the scroll position stays in sync with the view.
      if(mqDesktop.matches && pinWrap){
        if(e.key === 'ArrowRight' && idx < total - 1){
          e.preventDefault();
          window.scrollTo({ top: scrollTargetFor(idx + 1), behavior: prefersReduced ? 'auto' : 'smooth' });
        } else if(e.key === 'ArrowLeft' && idx > 0){
          e.preventDefault();
          window.scrollTo({ top: scrollTargetFor(idx - 1), behavior: prefersReduced ? 'auto' : 'smooth' });
        }
        return;
      }
      if(e.key === 'ArrowRight'){ next(); start(); }
      else if(e.key === 'ArrowLeft'){ go(idx - 1); start(); }
      else if(e.key === 'Escape'){ paused = !paused; paused ? stop() : start(); }
    });

    if(prefersReduced){ paused = true; }

    // Touch swipe
    let tx = 0;
    hero.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, {passive:true});
    hero.addEventListener('touchend',   (e) => {
      const dx = (e.changedTouches[0].clientX - tx);
      if(Math.abs(dx) > 60){ dx < 0 ? next() : go(idx - 1); start(); }
    }, {passive:true});

    // Mouse parallax disabled per user request — background stays static
    // regardless of cursor position. --tiltX/Y and --bgDX/DY remain at 0.

    // Initial — fire counters for slide 1. No auto-advance start() per user request.
    setTimeout(() => runCountersForSlide(1), 820);

    // ------------------------------------------------------------
    // Particle field — floating champagne dots with faint links.
    // Lives above the overlay, below the stage content. Pauses when the
    // tab is hidden or when the hero leaves the viewport (saves CPU while
    // the user is further down the page). Static snapshot if the user
    // prefers reduced motion.
    // ------------------------------------------------------------
    (function particles(){
      const canvas = hero.querySelector('.cine-particles');
      if(!canvas) return;
      const ctx = canvas.getContext('2d');
      if(!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      let w = 0, h = 0, pts = [], rafId = null, visible = true, onScreen = true;

      const seed = () => {
        const count = Math.min(70, Math.max(28, Math.floor(w / 26)));
        pts = Array.from({length: count}, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 1.4 + 0.7
        }));
      };

      const resize = () => {
        const rect = hero.getBoundingClientRect();
        w = Math.max(1, rect.width);
        h = Math.max(1, rect.height);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        seed();
      };

      const render = () => {
        ctx.clearRect(0, 0, w, h);
        // Connecting web
        const D = 135;
        for(let i = 0; i < pts.length; i++){
          const a = pts[i];
          for(let j = i + 1; j < pts.length; j++){
            const b = pts[j];
            const dx = a.x - b.x, dy = a.y - b.y;
            const d2 = dx*dx + dy*dy;
            if(d2 < D*D){
              const d = Math.sqrt(d2);
              ctx.strokeStyle = 'rgba(255,215,181,' + ((1 - d/D) * 0.14).toFixed(3) + ')';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
        // Dots
        ctx.fillStyle = 'rgba(255,215,181,0.62)';
        for(const p of pts){
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      const tick = () => {
        if(visible && onScreen){
          for(const p of pts){
            p.x += p.vx;
            p.y += p.vy;
            if(p.x < 0 || p.x > w) p.vx *= -1;
            if(p.y < 0 || p.y > h) p.vy *= -1;
          }
          render();
        }
        rafId = requestAnimationFrame(tick);
      };

      resize();
      if(prefersReduced){
        render(); // one static frame
        return;
      }
      rafId = requestAnimationFrame(tick);

      // Lifecycle
      window.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
      // IntersectionObserver to stop drawing when hero is scrolled past
      if('IntersectionObserver' in window){
        const io = new IntersectionObserver(es => {
          onScreen = es.some(e => e.isIntersecting);
        }, { threshold: 0 });
        io.observe(hero);
      }
    })();
  })();

  // ============ Specialisations tabs (WAI-ARIA compliant) ============
  (function(){
    const tablist = document.getElementById('specTabs');
    if(!tablist) return;
    const tabs = Array.from(tablist.querySelectorAll('button[role="tab"], button'));
    const panels = Array.from(document.querySelectorAll('.spec-panel'));

    function activate(tab, focusIt){
      const key = tab.dataset.spec;
      tabs.forEach(x => {
        const on = x === tab;
        x.classList.toggle('active', on);
        x.setAttribute('aria-selected', on ? 'true' : 'false');
        x.setAttribute('tabindex', on ? '0' : '-1');
      });
      panels.forEach(p => {
        const on = p.dataset.panel === key;
        p.classList.toggle('active', on);
        if(on){ p.removeAttribute('hidden'); } else { p.setAttribute('hidden', ''); }
      });
      if(focusIt) tab.focus();
    }

    tabs.forEach((b, i) => {
      b.addEventListener('click', () => activate(b, false));
      b.addEventListener('keydown', (e) => {
        const last = tabs.length - 1;
        if(e.key === 'ArrowRight'){ e.preventDefault(); activate(tabs[i === last ? 0 : i + 1], true); }
        else if(e.key === 'ArrowLeft'){ e.preventDefault(); activate(tabs[i === 0 ? last : i - 1], true); }
        else if(e.key === 'Home'){ e.preventDefault(); activate(tabs[0], true); }
        else if(e.key === 'End'){ e.preventDefault(); activate(tabs[last], true); }
      });
    });
  })();

  // ============ Sector filter for recruiters ============
  (function(){
    const chips = document.querySelectorAll('#sectorFilter button');
    const items = document.querySelectorAll('#recruitersGrid .r');
    chips.forEach(c => c.addEventListener('click', () => {
      const s = c.dataset.sector;
      chips.forEach(x => x.classList.toggle('active', x === c));
      items.forEach(it => {
        it.classList.toggle('hidden', s !== 'all' && it.dataset.s !== s);
      });
    }));
  })();

  // ============ Contact form (mailto fallback — replace with Formspree/Getform for real) ============
  (function(){
    const form = document.getElementById('contactForm');
    if(!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const body = Array.from(fd.entries())
        .map(([k,v]) => `${k.toUpperCase()}: ${v}`).join('%0D%0A');
      const subject = encodeURIComponent('MBA Admissions Enquiry — ' + (fd.get('name') || ''));
      window.location.href = `mailto:admission@saveetha.ac.in?subject=${subject}&body=${body}`;
    });
  })();

  // ============ Creative header: scroll-shrink ============
  (function(){
    const nav = document.getElementById('mainNav');
    if(!nav) return;
    const onScroll = () => {
      if(window.scrollY > 10) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, {passive:true});
  })();

  // ============ Creative header: magic-ink sliding indicator ============
  (function(){
    const menuEl = document.getElementById('menu');
    if(!menuEl) return;
    if(window.matchMedia('(max-width:1180px)').matches) return; // hamburger breakpoint: no indicator in the drawer

    // Build the indicator element
    const indicator = document.createElement('span');
    indicator.className = 'menu-indicator';
    menuEl.prepend(indicator);

    const items = Array.from(menuEl.querySelectorAll(':scope > a, :scope > .has-submenu > .submenu-trigger'));
    if(!items.length) return;

    const place = (el) => {
      if(!el) return;
      const m = menuEl.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      indicator.style.left  = (r.left - m.left) + 'px';
      indicator.style.width = r.width + 'px';
      indicator.classList.add('show');
    };
    const reset = () => {
      const active = menuEl.querySelector(':scope > a.active, :scope > .has-submenu > .submenu-trigger.active');
      if(active) place(active);
      else indicator.classList.remove('show');
    };

    items.forEach(el => {
      el.addEventListener('mouseenter', () => place(el));
      el.addEventListener('focus',      () => place(el));
    });
    menuEl.addEventListener('mouseleave', reset);
    window.addEventListener('resize', reset);

    // Initial position on active item (if any) — placed without the slide-in,
    // so the pill doesn't sweep in from the left edge on first paint.
    requestAnimationFrame(() => {
      indicator.style.transition = 'none';
      reset();
      void indicator.offsetWidth;
      indicator.style.transition = '';
    });
  })();

  // ============ Highlight active nav link ============
  (function(){
    const current = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('#menu a').forEach(a => {
      const href = a.getAttribute('href');
      if(href === current || (current === 'index.html' && href === '/')) {
        a.classList.add('active');
      }
    });
    // If the active page is inside a submenu, also highlight its parent trigger
    document.querySelectorAll('.has-submenu').forEach(sm => {
      if(sm.querySelector('.submenu a.active')){
        const trig = sm.querySelector('.submenu-trigger');
        if(trig) trig.classList.add('active');
      }
    });
  })();

  // ============ Magnetic buttons (cursor-follow on primary CTAs) ============
  (function(){
    if(window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    if(window.matchMedia('(hover:none)').matches) return; // skip on touch devices
    const RANGE = 10;    // max translation in px
    const DAMP  = 0.35;  // how strongly the button is pulled toward cursor
    const targets = document.querySelectorAll('.btn-primary, .btn-dark, .btn-apply');
    targets.forEach(btn => {
      btn.classList.add('magnetic');
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        let dx = (e.clientX - cx) * DAMP;
        let dy = (e.clientY - cy) * DAMP;
        dx = Math.max(-RANGE, Math.min(RANGE, dx));
        dy = Math.max(-RANGE, Math.min(RANGE, dy));
        btn.style.setProperty('--mx', dx + 'px');
        btn.style.setProperty('--my', dy + 'px');
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.setProperty('--mx', '0px');
        btn.style.setProperty('--my', '0px');
      });
    });
  })();

  // Hero scroll parallax disabled per user request — background stays static on scroll.

  // ============ Stat counter animation (page-header rail) ============
  (function(){
    const els = document.querySelectorAll('[data-animate="count"]');
    if(!els.length) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const format = (n, decimals) => {
      const fixed = n.toFixed(decimals);
      const [whole, frac] = fixed.split('.');
      const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return frac ? withCommas + '.' + frac : withCommas;
    };
    const parse = (text) => {
      // Capture [prefix][number][suffix] — number may include , and .
      const m = text.trim().match(/^([^\d\-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/);
      if(!m) return null;
      const prefix = m[1] || '';
      const numStr = m[2].replace(/,/g,'');
      const suffix = m[3] || '';
      const target = parseFloat(numStr);
      if(isNaN(target)) return null;
      const decimals = (numStr.split('.')[1] || '').length;
      return {prefix, target, suffix, decimals};
    };
    const run = (el) => {
      const parsed = parse(el.textContent);
      if(!parsed) return;
      if(prefersReduced){ return; } // keep original text
      const {prefix, target, suffix, decimals} = parsed;
      const duration = 1400;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        const v = target * eased;
        el.textContent = prefix + format(v, decimals) + suffix;
        if(t < 1) requestAnimationFrame(tick);
        else el.textContent = prefix + format(target, decimals) + suffix;
      };
      requestAnimationFrame(tick);
    };
    if('IntersectionObserver' in window){
      const io = new IntersectionObserver((entries)=>{
        entries.forEach(e => {
          if(e.isIntersecting){
            run(e.target);
            io.unobserve(e.target);
          }
        });
      }, {threshold: 0.35});
      els.forEach(el => io.observe(el));
    } else {
      els.forEach(run);
    }
  })();

  // ============ Page-header animated scene — scroll parallax + cursor drift ============
  (function(){
    const scene = document.querySelector('.ph-scene');
    if(!scene) return;
    const layers = scene.querySelectorAll('[data-parallax]');
    if(!layers.length) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(prefersReduced) return;

    const RANGE = 125; // total scroll translation range per layer (px)
    let ticking = false;
    let mouseNX = 0, mouseNY = 0; // normalized -1..1

    const update = () => {
      const rect = scene.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // Progress from -1 (scene below viewport) through 0 (centered) to 1 (above viewport)
      const center = rect.top + rect.height / 2;
      const progress = ((vh / 2) - center) / (vh / 2 + rect.height / 2);
      layers.forEach(layer => {
        const depth = parseFloat(layer.dataset.parallax) || 0.3;
        const py = progress * RANGE * depth;
        // subtle cursor drift — farther layers move more
        const cx = mouseNX * 10 * depth;
        const cy = mouseNY *  8 * depth;
        layer.style.setProperty('--py', (py + cy).toFixed(2) + 'px');
        layer.style.setProperty('--px', cx.toFixed(2) + 'px');
      });
      ticking = false;
    };

    const requestTick = () => {
      if(!ticking){ requestAnimationFrame(update); ticking = true; }
    };

    window.addEventListener('scroll', requestTick, {passive:true});
    window.addEventListener('resize', requestTick);
    // cursor drift within the page-header
    const header = scene.closest('.page-header');
    if(header){
      header.addEventListener('mousemove', (e) => {
        const r = header.getBoundingClientRect();
        mouseNX = ((e.clientX - r.left) / r.width  - 0.5) * 2;
        mouseNY = ((e.clientY - r.top)  / r.height - 0.5) * 2;
        requestTick();
      });
      header.addEventListener('mouseleave', () => {
        mouseNX = 0; mouseNY = 0; requestTick();
      });
    }
    update();
  })();

  // ============ Page-header 3D cube — cursor parallax tilt ============
  (function(){
    const scenes = document.querySelectorAll('.cube-scene');
    if(!scenes.length) return;
    const MAX = 14; // max tilt degrees
    scenes.forEach(scene => {
      const tilt = scene.querySelector('.cube-tilt');
      if(!tilt) return;
      let raf = 0;
      const apply = (nx, ny) => {
        if(raf) return;
        raf = requestAnimationFrame(() => {
          tilt.style.setProperty('--tilt-x', (ny * -MAX).toFixed(2) + 'deg');
          tilt.style.setProperty('--tilt-y', (nx *  MAX).toFixed(2) + 'deg');
          raf = 0;
        });
      };
      const reset = () => {
        tilt.style.setProperty('--tilt-x','0deg');
        tilt.style.setProperty('--tilt-y','0deg');
      };
      scene.addEventListener('mousemove', (e) => {
        const r = scene.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width  - 0.5) * 2;
        const ny = ((e.clientY - r.top)  / r.height - 0.5) * 2;
        apply(nx, ny);
      });
      scene.addEventListener('mouseleave', reset);
      scene.addEventListener('touchmove', (e) => {
        if(!e.touches.length) return;
        const t = e.touches[0];
        const r = scene.getBoundingClientRect();
        const nx = ((t.clientX - r.left) / r.width  - 0.5) * 2;
        const ny = ((t.clientY - r.top)  / r.height - 0.5) * 2;
        apply(nx, ny);
      }, {passive:true});
      scene.addEventListener('touchend', reset);
      // Keyboard: space/enter pauses, reset on blur
      scene.addEventListener('keydown', (e) => {
        if(e.key === ' ' || e.key === 'Enter'){
          e.preventDefault();
          scene.classList.toggle('is-paused');
          const spin = scene.querySelector('.cube-spin');
          if(spin) spin.style.animationPlayState = scene.classList.contains('is-paused') ? 'paused' : '';
        }
      });
    });
  })();

  /* =========================================================
     INTERACTIVE ANIMATION LAYER — added 2026-04-20
     Site-wide polish: scroll progress, tilt, ripples, letter-reveal,
     back-to-top, CTA spotlight, auto-reveal hookup.
     ========================================================= */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const isTouch = window.matchMedia('(hover:none)').matches;

  // ============ Scroll progress bar (top of page) ============
  (function(){
    if(document.querySelector('.scroll-progress')) return;
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden','true');
    document.body.appendChild(bar);
    let ticking = false;
    const update = () => {
      const h = document.documentElement;
      const scrollable = h.scrollHeight - h.clientHeight;
      const pct = scrollable > 0 ? (h.scrollTop / scrollable) * 100 : 0;
      bar.style.width = pct.toFixed(2) + '%';
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if(!ticking){ requestAnimationFrame(update); ticking = true; }
    }, {passive:true});
    update();
  })();

  // ============ Back-to-top floating button ============
  (function(){
    if(document.querySelector('.to-top')) return;
    const btn = document.createElement('button');
    btn.className = 'to-top';
    btn.type = 'button';
    btn.setAttribute('aria-label','Back to top');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg>';
    document.body.appendChild(btn);
    const onScroll = () => {
      if(window.scrollY > 400) btn.classList.add('show');
      else btn.classList.remove('show');
    };
    window.addEventListener('scroll', onScroll, {passive:true});
    btn.addEventListener('click', () => {
      window.scrollTo({top:0, behavior: reducedMotion ? 'auto' : 'smooth'});
    });
    onScroll();
  })();

  // ============ Auto-apply tilt to primary card elements ============
  (function(){
    if(reducedMotion || isTouch) return;
    const tiltables = document.querySelectorAll(
      '.infra-card, .fac-card, .coe-tile, .pl-prior-card, .t-card, ' +
      '.ifc, .f-card, .ib-card, .tlc, .sle, .ap-body, .teaser, .cr, ' +
      '.tilt'
    );
    const MAX = 6; // degrees
    tiltables.forEach(el => {
      el.classList.add('tilt');
      let raf = 0;
      const apply = (rx, ry) => {
        if(raf) return;
        raf = requestAnimationFrame(() => {
          el.style.setProperty('--rx', rx.toFixed(2) + 'deg');
          el.style.setProperty('--ry', ry.toFixed(2) + 'deg');
          raf = 0;
        });
      };
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width  - 0.5) * 2;
        const ny = ((e.clientY - r.top)  / r.height - 0.5) * 2;
        el.classList.add('is-tilting');
        apply(ny * -MAX, nx * MAX);
      });
      el.addEventListener('mouseleave', () => {
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx','0deg');
        el.style.setProperty('--ry','0deg');
      });
    });
  })();

  // ============ Button click ripple ============
  (function(){
    if(reducedMotion) return;
    const selector = '.btn-primary, .btn-dark, .btn-apply, .btn.btn-dark, .btn-ripple, button.sp-btn, .btn-outline';
    document.querySelectorAll(selector).forEach(btn => {
      btn.classList.add('btn-ripple');
      btn.addEventListener('click', (e) => {
        const r = btn.getBoundingClientRect();
        const size = Math.max(r.width, r.height);
        const rip = document.createElement('span');
        rip.className = 'ripple';
        rip.style.width = rip.style.height = size + 'px';
        rip.style.left = (e.clientX - r.left - size/2) + 'px';
        rip.style.top  = (e.clientY - r.top  - size/2) + 'px';
        btn.appendChild(rip);
        setTimeout(() => rip.remove(), 650);
      });
    });
  })();

  // ============ CTA banner cursor spotlight ============
  (function(){
    if(reducedMotion || isTouch) return;
    document.querySelectorAll('.cta-banner').forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--sx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        el.style.setProperty('--sy', ((e.clientY - r.top)  / r.height * 100).toFixed(1) + '%');
      });
    });
  })();

  // ============ Page-header H1 letter reveal ============
  (function(){
    if(reducedMotion) return;
    const h1 = document.querySelector('.page-header h1, .ph-content h1');
    if(!h1 || h1.dataset.split === '1') return;
    if(h1.querySelector('.lr')) return; // already processed
    const text = h1.textContent;
    if(!text || text.length > 80) return; // skip very long titles
    const frag = document.createDocumentFragment();
    let idx = 0;
    // split by words so spaces wrap cleanly
    text.split(/(\s+)/).forEach(piece => {
      if(/^\s+$/.test(piece)){
        frag.appendChild(document.createTextNode(piece));
      } else {
        const word = document.createElement('span');
        word.style.display = 'inline-block';
        word.style.whiteSpace = 'nowrap';
        for (const ch of piece){
          const span = document.createElement('span');
          span.className = 'lr';
          span.style.setProperty('--li', idx++);
          span.textContent = ch;
          word.appendChild(span);
        }
        frag.appendChild(word);
      }
    });
    h1.textContent = '';
    h1.appendChild(frag);
    h1.dataset.split = '1';
  })();

  // ============ Enhance .reveal: auto-add to likely content blocks ============
  (function(){
    if(reducedMotion) return;
    // Heuristic: pick content sections that don't already use reveal
    const candidates = document.querySelectorAll(
      '.section-head, .section > .container > h2, ' +
      '.news-card, .event-card, .news-item, .evt-card, ' +
      '.stat-item, .p-stat, .coe-stat-item, .pl-hero-stat'
    );
    candidates.forEach(el => {
      if(!el.classList.contains('reveal')) el.classList.add('reveal');
    });
    // Re-observe newly added reveals (the original IO in this file
    // captured only initial DOM). Attach a second observer.
    if(!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('show');
          io.unobserve(entry.target);
        }
      });
    }, {threshold:0.1, rootMargin:'0px 0px -40px 0px'});
    candidates.forEach(el => { if(!el.classList.contains('show')) io.observe(el); });
  })();

  // ============ Smooth in-page anchor scroll (with header offset) ============
  (function(){
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      const href = a.getAttribute('href');
      if(!href || href === '#' || href.length < 2) return;
      a.addEventListener('click', (e) => {
        const target = document.querySelector(href);
        if(!target) return;
        e.preventDefault();
        const nav = document.getElementById('mainNav');
        const offset = nav ? nav.getBoundingClientRect().height + 12 : 16;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({top, behavior: reducedMotion ? 'auto' : 'smooth'});
      });
    });
  })();

  // ============ Image zoom wrapper (auto-wrap likely content images) ============
  (function(){
    // For content images inside cards, add subtle zoom — skip logos & icons.
    const imgs = document.querySelectorAll(
      '.infra-card img, .news-card img, .event-card img, .evt-card img, ' +
      '.pl-prior-card img, .ib-card img, .tlc img, .sle img, ' +
      '.img-zoom img'
    );
    imgs.forEach(img => {
      const parent = img.parentElement;
      if(!parent) return;
      if(parent.classList.contains('img-zoom')) return;
      // Only wrap when parent is a safe container (not a flex row)
      if(img.naturalWidth > 0 && img.naturalWidth < 80) return;
      parent.classList.add('img-zoom');
    });
  })();

  /* =========================================================
     CHANCELLOR MESSAGE — INTERACTIVE ANIMATION BEHAVIOR
     Updated 2026-04-20:
       - Removed photo parallax tilt (per user request)
       - Swapped word-by-word quote reveal for a TYPEWRITER animation
       - Reveal on intersection (adds .is-revealed to the section)
       - Whole-section cursor-tracking warm glow retained
     ========================================================= */
  (function(){
    const hod = document.querySelector('.hod');
    if(!hod) return;
    const quote = hod.querySelector('.hod-quote');
    const creds = hod.querySelectorAll('.hod-creds .cred');

    // --- 1. Typewriter setup: measure full height, then empty --
    //        (keeps layout stable as characters are typed in)
    let fullText = '';
    let typedSpan = null;
    let caret = null;
    if(quote && quote.dataset.typesetup !== '1'){
      fullText = (quote.textContent || '').trim().replace(/\s+/g, ' ');
      // Measure final height before clearing content so the paragraph
      // reserves its final size. (Layout is settled at DOMContentLoaded.)
      const fullH = quote.offsetHeight;
      if(fullH > 0){ quote.style.minHeight = fullH + 'px'; }
      quote.innerHTML = '';
      typedSpan = document.createElement('span');
      typedSpan.className = 'qtyped';
      caret = document.createElement('span');
      caret.className = 'qcaret';
      caret.setAttribute('aria-hidden', 'true');
      quote.appendChild(typedSpan);
      quote.appendChild(caret);
      quote.dataset.typesetup = '1';
    }

    // --- 2. Index the creds so CSS can stagger ------------
    creds.forEach((c, k) => c.style.setProperty('--ci', k));

    // --- 3. Typewriter runner (fires once when section reveals) --
    function startTyping(){
      if(!typedSpan || !fullText || hod.dataset.typed === '1') return;
      hod.dataset.typed = '1';
      if(reducedMotion){
        typedSpan.textContent = fullText;
        if(caret) caret.style.display = 'none';
        return;
      }
      let i = 0;
      // Slightly faster for very long quotes so the whole effect
      // completes in a comfortable ~6–8 seconds regardless of length.
      const speed = fullText.length > 320 ? 16 : 22; // ms per char
      const tick = () => {
        if(i <= fullText.length){
          typedSpan.textContent = fullText.slice(0, i);
          i++;
          setTimeout(tick, speed);
        }
      };
      // Small lead-in so the eyebrow + quote-mark settle first.
      setTimeout(tick, 500);
    }

    // --- 4. IntersectionObserver drives .is-revealed ------
    if('IntersectionObserver' in window){
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if(e.isIntersecting){
            hod.classList.add('is-revealed');
            startTyping();
            io.unobserve(hod);
          }
        });
      }, { threshold: 0.25 });
      io.observe(hod);
    } else {
      hod.classList.add('is-revealed');
      startTyping();
    }

    // --- 5. Cursor-follow glow on the section --------------
    if(!reducedMotion && !isTouch){
      let raf = 0, nx = 50, ny = 50;
      const apply = () => {
        raf = 0;
        hod.style.setProperty('--gx', nx.toFixed(1) + '%');
        hod.style.setProperty('--gy', ny.toFixed(1) + '%');
      };
      hod.addEventListener('mousemove', (e) => {
        const r = hod.getBoundingClientRect();
        nx = ((e.clientX - r.left) / r.width) * 100;
        ny = ((e.clientY - r.top)  / r.height) * 100;
        hod.classList.add('hod-hover');
        if(!raf) raf = requestAnimationFrame(apply);
      });
      hod.addEventListener('mouseleave', () => {
        hod.classList.remove('hod-hover');
      });
    }

    // --- 6. (Photo parallax tilt intentionally removed) ---
  })();

})();


/* =========================================================
   PDF DOWNLOADS INSIDE THE CLAUDE ARTIFACT VIEWER
   The claude.ai viewer blocks plain download links. When the site is
   shown there, hand PDF links (brochure, CVs) to the viewer's
   "downloads" capability instead. On any normal web server
   window.claude does not exist, so links behave exactly as before.
   ========================================================= */
(function(){
  'use strict';
  if (!window.claude || typeof window.claude.use !== 'function') return;

  let downloads = null;
  let busy = false;
  window.claude.use('downloads').then(d => { downloads = d; }).catch(() => {});

  function pdfLink(el){
    const a = el && el.closest ? el.closest('a[href]') : null;
    if (!a) return null;
    const href = a.getAttribute('href') || '';
    return /\.pdf(?:[?#].*)?$/i.test(href) ? a : null;
  }

  function fileName(a){
    const named = a.getAttribute('download');
    if (named) return named;
    const path = new URL(a.href, location.href).pathname;
    return decodeURIComponent(path.split('/').pop()) || 'document.pdf';
  }

  document.addEventListener('click', async (e) => {
    const a = pdfLink(e.target);
    if (!a || !downloads) return;   // capability not ready: keep default link behaviour
    e.preventDefault();
    if (busy) return;
    busy = true;
    a.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch(a.href);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      await downloads.save({ filename: fileName(a), data: blob });
    } catch (err) {
      // "declined" means the viewer said no; anything else, tell them quietly
      if (!err || err.code !== 'declined') {
        console.warn('PDF download failed:', err);
        alert('Sorry, this file could not be downloaded here.');
      }
    } finally {
      busy = false;
      a.removeAttribute('aria-busy');
    }
  }, true);
})();
