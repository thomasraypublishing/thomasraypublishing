/* ========================================================================
   legal-toc.js — progressive enhancement for the legal pages' static
   "Contents" list (details.legal-toc). With this script absent everything
   still works: the list is plain HTML anchors. The script only
     - marks the section you are reading with aria-current in the list,
     - keeps the list open on wide screens (where it is a sticky side
       column) and closed on small ones, and
     - closes the small-screen list after a link is chosen.
   ======================================================================== */
(function () {
  'use strict';
  /* Printing shows external link URLs; skip those the text already spells out. */
  document.querySelectorAll('main a[href^="http"]').forEach(function (a) {
    var h = a.getAttribute('href').replace(/\/+$/, '').replace(/^https?:\/\//, '');
    if (a.textContent.replace(/\s+/g, '').indexOf(h) !== -1) a.setAttribute('data-print-url', 'skip');
  });

  var toc = document.querySelector('details.legal-toc');
  if (!toc) return;

  var wide = window.matchMedia('(min-width: 1100px)');
  function syncOpen() { toc.open = wide.matches; }
  syncOpen();
  if (wide.addEventListener) wide.addEventListener('change', syncOpen);
  else if (wide.addListener) wide.addListener(syncOpen);

  /* Choosing a link on a small screen: get the list out of the way. */
  toc.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (a && !wide.matches) toc.open = false;
  });

  /* Current-section marker. */
  var links = {};
  var heads = [];
  toc.querySelectorAll('a[href^="#"]').forEach(function (a) {
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    var el = document.getElementById(id);
    if (el) { links[id] = a; heads.push(el); }
  });
  if (!heads.length || !('IntersectionObserver' in window)) return;

  var current = null;
  function mark(id) {
    if (id === current) return;
    if (current && links[current]) links[current].removeAttribute('aria-current');
    current = id;
    if (id && links[id]) {
      links[id].setAttribute('aria-current', 'true');
      /* Keep the marked item visible inside the scrolling side list. */
      var box = links[id].closest('.legal-toc__nav');
      if (box && wide.matches && box.scrollHeight > box.clientHeight) {
        var r = links[id].getBoundingClientRect(), b = box.getBoundingClientRect();
        if (r.top < b.top || r.bottom > b.bottom) {
          box.scrollTop += r.top - b.top - box.clientHeight / 3;
        }
      }
    }
  }

  /* The current section is the last heading that has crossed a line a
     little below the top of the viewport. An IntersectionObserver wakes the
     check when a heading enters or leaves the reading area; a throttled
     scroll listener covers long jumps that skip past headings entirely. */
  function line() {
    var bar = document.querySelector('nav.top');
    return (bar ? bar.getBoundingClientRect().height : 0) + 32;
  }
  function update() {
    var y = line(), last = null;
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top <= y) last = heads[i].id; else break;
    }
    mark(last);
  }
  var io = new IntersectionObserver(update, { threshold: [0, 1] });
  heads.forEach(function (h) { io.observe(h); });
  var queued = false;
  window.addEventListener('scroll', function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; update(); });
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
