/* ========================================================================
   nav.js — mobile overlay menu + nav condense on scroll.
   The menu works with or without motion; under Reduce Motion the overlay
   simply toggles instantly.
   ======================================================================== */

export function initNav({ motion }) {
  const btn = document.getElementById('menu-btn');
  const overlay = document.getElementById('menu-overlay');
  const links = overlay ? overlay.querySelectorAll('a') : [];
  let open = false;

  function setOpen(next) {
    open = next;
    btn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);

    if (motion && window.gsap) {
      if (open) {
        overlay.style.display = 'flex';
        gsap.timeline()
          .to(overlay, { autoAlpha: 1, duration: 0.3, ease: 'power2.out' })
          .fromTo(links, { autoAlpha: 0, y: 26 },
            { autoAlpha: 1, y: 0, stagger: 0.06, duration: 0.45, ease: 'power3.out' }, 0.08);
      } else {
        gsap.to(overlay, {
          autoAlpha: 0, duration: 0.25, ease: 'power2.in',
          onComplete: () => { overlay.style.display = 'none'; },
        });
      }
    } else {
      overlay.style.display = open ? 'flex' : 'none';
      overlay.style.opacity = open ? '1' : '0';
      overlay.style.visibility = open ? 'visible' : 'hidden';
    }

    if (open) links[0]?.focus();
    else btn.focus();
  }

  if (btn && overlay) {
    btn.addEventListener('click', () => setOpen(!open));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); });
    links.forEach((a) => a.addEventListener('click', () => setOpen(false)));
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

  // Smooth anchor offset for the sticky bar.
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.defaultPrevented) return; // another handler (e.g. the fortune) owns this click
      const id = a.getAttribute('href').slice(1);
      const el = id && document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      const top = el.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top, behavior: motion ? 'smooth' : 'auto' });
    });
  });
}
