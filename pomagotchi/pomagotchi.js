/* ========================================================================
   pomagotchi.js — enhancement layer for the Pomagotchi page.
   Contract (same as the site's other standalone pages): the page is
   complete and readable with zero JavaScript. Reduce Motion or ?static=1
   gets the settled page. The time-of-day engine still runs in static
   mode — it changes colors, not motion.
   ======================================================================== */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = reduceMotion || new URLSearchParams(window.location.search).has('static');
const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

/* ========================================================================
   1. Time-of-day engine — the page runs on the visitor's clock.
      Manual dial overrides; JS-off falls back to the CSS default
      (afternoon), which is also the ?static=1 baseline for Lighthouse.
   ======================================================================== */

const TODS = ['morning', 'afternoon', 'evening', 'night'];

function todForHour(h) {
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function initTimeOfDay() {
  const dial = document.getElementById('tod-dial');
  const note = document.getElementById('tod-note');

  const apply = (tod, isAuto) => {
    document.body.setAttribute('data-tod', tod);
    if (dial) {
      dial.querySelectorAll('button').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.tod === tod));
      });
    }
    if (note) {
      note.textContent = isAuto
        ? 'Matched to your clock — tap to see her other hours.'
        : 'Your Pom keeps your hours in the app.';
    }
  };

  // Deterministic in static mode (Lighthouse), live otherwise.
  apply(staticMode ? 'afternoon' : todForHour(new Date().getHours()), true);

  if (dial) {
    dial.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-tod]');
      if (!btn || !TODS.includes(btn.dataset.tod)) return;
      apply(btn.dataset.tod, false);
    });
  }
}

/* ========================================================================
   2. The Pom — pettable, trickable, watching the room.
   ======================================================================== */

const BARKS = {
  pet: ['boof.', 'yes. more of this.', 'fluff status: maximal', 'you may continue.'],
  sit: ['sitting. professionally.', 'a very good sit.'],
  spin: ['wheee.', 'the room moved.'],
  speak: ['boof. (that’s hello.)', 'BOOF.', 'ahem. boof.']
};

function initPom() {
  const stage = document.querySelector('.stage-pom');
  const pom = document.getElementById('pom');
  const speech = document.getElementById('pom-speech');
  const status = document.getElementById('pom-status');
  if (!stage || !pom) return;

  let speechTimer = null;
  const say = (lines) => {
    const line = lines[Math.floor(Math.random() * lines.length)];
    if (speech) {
      speech.textContent = line;
      speech.classList.add('show');
      clearTimeout(speechTimer);
      speechTimer = setTimeout(() => speech.classList.remove('show'), 1700);
    }
    if (status) status.textContent = 'Pom says: ' + line;
  };

  const animate = (cls) => {
    if (staticMode) return;
    pom.classList.remove('wiggle', 'bounce', 'sit', 'spin');
    void pom.getBBox && pom.getBoundingClientRect(); // restart animation
    pom.classList.add(cls);
    pom.addEventListener('animationend', () => pom.classList.remove(cls), { once: true });
  };

  const spawnHeart = (x, y) => {
    if (staticMode) return;
    if (stage.querySelectorAll('.heart').length >= 6) return;
    const h = document.createElement('span');
    h.className = 'heart';
    h.setAttribute('aria-hidden', 'true');
    h.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21c-4.8-3.8-9-7-9-11.2C3 6.5 5.4 4 8.4 4c1.5 0 2.8.7 3.6 1.8C12.8 4.7 14.1 4 15.6 4 18.6 4 21 6.5 21 9.8 21 14 16.8 17.2 12 21z"/></svg>';
    const r = stage.getBoundingClientRect();
    h.style.left = (x - r.left - 9) + 'px';
    h.style.top = (y - r.top - 9) + 'px';
    stage.appendChild(h);
    h.addEventListener('animationend', () => h.remove());
  };

  // Petting: press-and-move over her fluff.
  let petting = false;
  let lastHeart = 0;
  pom.addEventListener('pointerdown', (event) => {
    petting = true;
    animate('wiggle');
    spawnHeart(event.clientX, event.clientY);
    say(BARKS.pet);
  });
  window.addEventListener('pointerup', () => { petting = false; });
  pom.addEventListener('pointermove', (event) => {
    if (!petting) return;
    const now = performance.now();
    if (now - lastHeart > 260) {
      lastHeart = now;
      animate('wiggle');
      spawnHeart(event.clientX, event.clientY);
    }
  });

  // Eyes follow the cursor (fine pointers only, never in static mode).
  const pupils = pom.querySelectorAll('.pupil');
  if (!staticMode && pupils.length && window.matchMedia('(pointer: fine)').matches) {
    let raf = null;
    stage.addEventListener('mousemove', (event) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const r = stage.getBoundingClientRect();
        const dx = ((event.clientX - r.left) / r.width - 0.5) * 6;
        const dy = ((event.clientY - r.top) / r.height - 0.5) * 4;
        pupils.forEach((p) => { p.setAttribute('transform', `translate(${dx.toFixed(1)} ${dy.toFixed(1)})`); });
      });
    });
    stage.addEventListener('mouseleave', () => {
      pupils.forEach((p) => p.setAttribute('transform', 'translate(0 0)'));
    });
  }

  // Trick buttons.
  document.querySelectorAll('.trick-row .trick').forEach((btn) => {
    btn.addEventListener('click', () => {
      const trick = btn.dataset.trick;
      if (trick === 'sit') { animate('sit'); say(BARKS.sit); }
      else if (trick === 'spin') { animate('spin'); say(BARKS.spin); }
      else { animate('bounce'); say(BARKS.speak); }
    });
  });
}

/* ========================================================================
   3. Scroll reveals + the Paper Pom letter unfold.
   ======================================================================== */

function initReveals() {
  if (!hasGsap || staticMode) return;
  gsap.registerPlugin(ScrollTrigger);

  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    gsap.set(el, { autoAlpha: 0, y: 20 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' })
    });
  });

  const letter = document.querySelector('.letter');
  if (letter && letter.getBoundingClientRect().top > window.innerHeight) {
    gsap.set(letter, { rotationX: -62, autoAlpha: 0.35 });
    gsap.to(letter, {
      rotationX: 0,
      autoAlpha: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: '.letter-scene',
        start: 'top 88%',
        end: 'top 44%',
        scrub: 0.4
      }
    });
  }

  window.addEventListener('load', () => ScrollTrigger.refresh());
}

/* ========================================================================
   boot
   ======================================================================== */

initTimeOfDay();
initPom();
initReveals();
