/* ========================================================================
   reveals.js — scroll choreography.
   Every initial "hidden" state is set HERE in JS, never in CSS, so the
   page is fully readable with JS disabled or Reduce Motion on.
   Hidden means opacity 0, never visibility hidden: the content stays in
   the accessibility tree, so headings and links exist for assistive tech
   before they scroll into view (W14). A keyboard user who tabs into a
   section that has not revealed yet gets it revealed at once.
   ======================================================================== */

/* element -> the tween or timeline that still owns its opacity */
const pending = new Map();

function track(targets, owner) {
  const list = typeof targets === 'string'
    ? Array.from(document.querySelectorAll(targets))
    : (targets.length !== undefined ? Array.from(targets) : [targets]);
  const entry = { owner, list };
  list.forEach((el) => pending.set(el, entry));
  owner.eventCallback('onComplete', () => list.forEach((el) => pending.delete(el)));
  return owner;
}

/* Focus arriving inside an unrevealed element finishes its reveal now. */
function revealOnFocus(e) {
  let node = e.target;
  while (node && node !== document.body) {
    const entry = pending.get(node);
    if (entry) {
      entry.list.forEach((el) => pending.delete(el));
      entry.owner.progress(1);
      return;
    }
    node = node.parentElement;
  }
}

export function initReveals() {
  document.addEventListener('focusin', revealOnFocus);

  // ---- hero: masked line reveal -------------------------------------------
  const h1 = document.querySelector('.hero h1');
  if (h1) {
    const split = new SplitText(h1, { type: 'lines', linesClass: 'split-line' });
    gsap.set(split.lines, { overflow: 'hidden', display: 'block' });
    const inner = split.lines.map((line) => {
      const span = document.createElement('span');
      span.style.display = 'block';
      while (line.firstChild) span.appendChild(line.firstChild);
      line.appendChild(span);
      return span;
    });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from(inner, { yPercent: 110, duration: 1.0, stagger: 0.09 }, 0.1)
      .from('.hero .eyebrow .line', { scaleX: 0, transformOrigin: 'left', duration: 0.7 }, 0.1)
      .from('.hero .eyebrow .mono', { opacity: 0, x: -8, duration: 0.6 }, 0.3)
      .from('.hero p.lede', { opacity: 0, y: 18, duration: 0.8 }, 0.55)
      .from('.hero-meta-row .item', { opacity: 0, y: 12, stagger: 0.07, duration: 0.5 }, 0.7)
      .from('.specimens .specimen', { opacity: 0, y: 36, stagger: 0.12, duration: 0.9 }, 0.8);
    track('.hero .eyebrow .mono, .hero p.lede, .hero-meta-row .item, .specimens .specimen', tl);
  }

  // ---- chapter heads -------------------------------------------------------
  document.querySelectorAll('.chapter-head').forEach((head) => {
    track(head.children, gsap.from(head.children, {
      scrollTrigger: { trigger: head, start: 'top 78%' },
      opacity: 0, y: 28, stagger: 0.12, duration: 0.9, ease: 'power3.out',
    }));
  });

  // ---- app cards: copy column + screen -------------------------------------
  document.querySelectorAll('.app-card').forEach((card) => {
    const copyKids = card.querySelectorAll('.copy > *');
    const screen = card.querySelector('.screen');
    const tl = gsap.timeline({
      scrollTrigger: { trigger: card, start: 'top 70%' },
      defaults: { ease: 'power3.out' },
    });
    tl.from(copyKids, { opacity: 0, y: 24, stagger: 0.08, duration: 0.7 }, 0)
      .from(screen, { opacity: 0, y: 40, duration: 1.0 }, 0.15);
    track([...copyKids, ...(screen ? [screen] : [])], tl);

    // The HHSS card gets its shutter-line wipe.
    if (card.classList.contains('hhss')) {
      const line = card.querySelector('.shutter-line');
      if (line) tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left', duration: 1.1, ease: 'power2.inOut' }, 0.2);
    }

    // Screenshot micro-parallax while the card crosses the viewport.
    if (screen) {
      gsap.fromTo(screen.querySelector('.frame'), { y: 26 }, {
        y: -26, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      });
    }
  });

  // ---- books ---------------------------------------------------------------
  if (document.querySelector('.catalog .book')) {
    track('.catalog .book', gsap.from('.catalog .book', {
      scrollTrigger: { trigger: '.catalog', start: 'top 75%' },
      opacity: 0, y: 36, stagger: 0.1, duration: 0.85, ease: 'power3.out',
    }));
  }

  // ---- stickers: springy pop ------------------------------------------------
  if (document.querySelector('.stickers .stk')) {
    track('.stickers .stk', gsap.from('.stickers .stk', {
      scrollTrigger: { trigger: '.stickers', start: 'top 78%' },
      opacity: 0, scale: 0.82, y: 20, stagger: 0.07, duration: 0.7,
      ease: 'back.out(1.7)',
    }));
  }

  // ---- about: quote + stats count-up ----------------------------------------
  const quote = document.querySelector('.about-text .big-quote');
  if (quote) {
    const words = new SplitText(quote, { type: 'words' });
    // SplitText mirrors the text into aria-label, but naming is prohibited
    // on blockquote's role — the split spans remain readable as-is.
    quote.removeAttribute('aria-label');
    track(words.words, gsap.from(words.words, {
      scrollTrigger: { trigger: quote, start: 'top 78%' },
      opacity: 0, y: 14, stagger: 0.03, duration: 0.6, ease: 'power2.out',
    }));
  }
  document.querySelectorAll('.about-stats .stat .n').forEach((el) => {
    const end = parseInt(el.dataset.count ?? el.textContent, 10);
    if (Number.isNaN(end)) return;
    const pad = (el.dataset.count ?? el.textContent.trim()).length;
    const obj = { v: 0 };
    gsap.to(obj, {
      v: end, duration: 1.4, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%' },
      onUpdate: () => { el.textContent = String(Math.round(obj.v)).padStart(pad, '0'); },
    });
  });

  // ---- collage drift --------------------------------------------------------
  document.querySelectorAll('.about-collage .card').forEach((card, i) => {
    track(card, gsap.from(card, {
      scrollTrigger: { trigger: '.about-collage', start: 'top 80%' },
      opacity: 0, y: 30, rotation: 0, duration: 0.9, delay: i * 0.12, ease: 'power3.out',
    }));
  });
}

/* Pointer tilt on device frames — desktop fine-pointer only, called
   separately so touch devices never pay for the listeners. */
export function initTilt() {
  document.querySelectorAll('.app-card .screen').forEach((screen) => {
    const frame = screen.querySelector('.frame');
    if (!frame) return;
    const qx = gsap.quickTo(frame, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    const qy = gsap.quickTo(frame, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    gsap.set(frame, { transformPerspective: 900 });
    screen.addEventListener('pointermove', (e) => {
      const r = screen.getBoundingClientRect();
      qx(((e.clientX - r.left) / r.width - 0.5) * 7);
      qy(-((e.clientY - r.top) / r.height - 0.5) * 5);
    });
    screen.addEventListener('pointerleave', () => { qx(0); qy(0); });
  });
}
