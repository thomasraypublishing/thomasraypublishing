/* ========================================================================
   nav.js — mobile overlay menu + nav condense on scroll.
   While open, the overlay is a modal dialog: focus cycles between the
   Menu button and the overlay's links, everything else on the page is
   inert, Escape closes it, and closing returns focus to the button. The
   links are native anchors, so the fragment, history, and the browser's
   own focus handling are untouched (the sticky bar's offset comes from
   scroll-padding-top in styles.css). Works with or without GSAP; under
   Reduce Motion the overlay toggles instantly.
   ======================================================================== */

export function initNav({ motion }) {
  const btn = document.getElementById('menu-btn');
  const overlay = document.getElementById('menu-overlay');
  const bar = btn ? btn.closest('nav.top') : null;
  const links = overlay ? Array.from(overlay.querySelectorAll('a')) : [];
  const motionOn = () => (typeof motion === 'function' ? motion() : Boolean(motion));
  let open = false;
  let inerted = [];

  function setInert(on) {
    if (on) {
      // Everything outside the bar and the overlay, plus the bar's own brand
      // and desktop links: Tab then cycles Menu → overlay links → Menu.
      const skip = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'TEMPLATE']);
      inerted = Array.from(document.body.children).filter((el) => el !== overlay && el !== bar && !el.inert && !skip.has(el.tagName));
      if (bar) inerted.push(...Array.from(bar.querySelectorAll('.brand, .navlinks')).filter((el) => !el.inert));
      inerted.forEach((el) => { el.inert = true; });
    } else {
      inerted.forEach((el) => { el.inert = false; });
      inerted = [];
    }
  }

  function show() {
    overlay.style.display = 'flex';
    if (motionOn() && window.gsap) {
      gsap.timeline()
        .to(overlay, { autoAlpha: 1, duration: 0.3, ease: 'power2.out' })
        .fromTo(links, { autoAlpha: 0, y: 26 },
          { autoAlpha: 1, y: 0, stagger: 0.06, duration: 0.45, ease: 'power3.out' }, 0.08);
    } else {
      overlay.style.opacity = '1';
      overlay.style.visibility = 'visible';
      links.forEach((a) => { a.style.opacity = ''; a.style.visibility = ''; a.style.transform = ''; });
    }
  }

  function hide() {
    if (motionOn() && window.gsap) {
      gsap.to(overlay, {
        autoAlpha: 0, duration: 0.25, ease: 'power2.in',
        onComplete: () => { if (!open) overlay.style.display = 'none'; },
      });
    } else {
      overlay.style.display = 'none';
      overlay.style.opacity = '0';
      overlay.style.visibility = 'hidden';
    }
  }

  function setOpen(next, { restoreFocus = true } = {}) {
    if (next === open) return;
    open = next;
    btn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
    if (open) {
      show();
      setInert(true);
      if (links[0]) links[0].focus();
    } else {
      setInert(false);
      hide();
      if (restoreFocus) btn.focus();
    }
  }

  function onKeydown(e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    if (e.key !== 'Tab') return;
    const cycle = [btn, ...links];
    const first = cycle[0];
    const last = cycle[cycle.length - 1];
    const active = document.activeElement;
    const inside = cycle.includes(active);
    if (e.shiftKey && (active === first || !inside)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !inside)) { e.preventDefault(); first.focus(); }
  }

  if (btn && overlay) {
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    if (!overlay.hasAttribute('aria-label')) overlay.setAttribute('aria-label', 'Site menu');
    overlay.removeAttribute('aria-hidden');
    btn.addEventListener('click', () => setOpen(!open));
    document.addEventListener('keydown', onKeydown);
    // A chosen link closes the menu and then navigates natively; focus is
    // left to the browser so it lands at the destination, not on the button.
    links.forEach((a) => a.addEventListener('click', () => setOpen(false, { restoreFocus: false })));
  }

  // Condense the bar once the reader is into the page.
  const nav = document.querySelector('nav.top');
  if (nav) {
    let last = false;
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY > 24;
      if (scrolled !== last) { last = scrolled; nav.classList.toggle('condensed', scrolled); }
    }, { passive: true });
  }
}
