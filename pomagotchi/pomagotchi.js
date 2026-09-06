/* ========================================================================
   pomagotchi.js — enhancement layer for the Pomagotchi page.
   Contract (same as the site's other standalone pages): the page is
   complete and readable with zero JavaScript. Reduce Motion or ?static=1
   gets the settled page. The time-of-day engine still runs in static
   mode — it changes colors, not motion.
   ======================================================================== */

import { isStatic, onMotionChange, settleGsap } from '../assets/js/motion.js';
import { initQuietControl } from '../assets/js/quiet.js';

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
    document.dispatchEvent(new CustomEvent('trp:tod', { detail: tod }));
  };

  // Deterministic in static mode (Lighthouse), live otherwise.
  apply(isStatic() ? 'afternoon' : todForHour(new Date().getHours()), true);

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
  speak: ['boof. (that’s hello.)', 'BOOF.', 'ahem. boof.'],
  coat: ['reporting for duty.', 'new fluff, who dis— boof.', 'a fresh coat. literally.'],
  sleepy: ['(she is extremely asleep)', 'zzz. boof. zzz.']
};

const COAT_NAMES = {
  sable: 'sable',
  classicOrange: 'classic orange',
  creamWhite: 'cream white',
  redRust: 'red rust',
  chocolateBrown: 'chocolate brown',
  black: 'black'
};

function initPom() {
  const stage = document.querySelector('.stage-pom');
  const view = document.getElementById('stage-view');
  const pom = document.getElementById('pom');
  const speech = document.getElementById('pom-speech');
  const status = document.getElementById('pom-status');
  if (!stage || !view || !pom) return;

  let coat = 'sable';
  let moodTimer = null;

  const idleMood = () =>
    document.body.getAttribute('data-tod') === 'night' ? 'exhausted' : 'content';

  const setSprite = (mood) => {
    pom.src = `images/pom/${coat}_${mood}.webp`;
    pom.alt = `Your Pomeranian — the ${COAT_NAMES[coat]} coat, as she appears in the game — standing in the backyard`;
  };

  // Show a mood briefly, then settle back to the idle mood.
  const flashMood = (mood, holdMs) => {
    clearTimeout(moodTimer);
    setSprite(mood);
    moodTimer = setTimeout(() => setSprite(idleMood()), holdMs || 1500);
  };

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
    if (isStatic()) return;
    pom.classList.remove('wiggle', 'bounce', 'sit', 'spin');
    void pom.getBoundingClientRect(); // restart animation
    pom.classList.add(cls);
    pom.addEventListener('animationend', () => pom.classList.remove(cls), { once: true });
  };

  const spawnHeart = (x, y) => {
    if (isStatic()) return;
    if (view.querySelectorAll('.heart').length >= 6) return;
    const h = document.createElement('span');
    h.className = 'heart';
    h.setAttribute('aria-hidden', 'true');
    h.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21c-4.8-3.8-9-7-9-11.2C3 6.5 5.4 4 8.4 4c1.5 0 2.8.7 3.6 1.8C12.8 4.7 14.1 4 15.6 4 18.6 4 21 6.5 21 9.8 21 14 16.8 17.2 12 21z"/></svg>';
    const r = view.getBoundingClientRect();
    h.style.left = (x - r.left - 9) + 'px';
    h.style.top = (y - r.top - 9) + 'px';
    view.appendChild(h);
    h.addEventListener('animationend', () => h.remove());
  };

  // Warm the four moods of a coat so sprite swaps never flash.
  const preloadCoat = (c) => {
    ['content', 'happy', 'ecstatic', 'exhausted'].forEach((m) => {
      const img = new Image();
      img.src = `images/pom/${c}_${m}.webp`;
    });
  };
  preloadCoat(coat);

  // Petting: press-and-move over her fluff.
  let petting = false;
  let lastHeart = 0;
  pom.addEventListener('pointerdown', (event) => {
    petting = true;
    animate('wiggle');
    spawnHeart(event.clientX, event.clientY);
    flashMood('happy');
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
      flashMood('happy');
    }
  });

  // Coat picker — choose which Pom performs.
  document.querySelectorAll('.coat-row .coat').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.coat;
      if (!COAT_NAMES[next] || next === coat) return;
      coat = next;
      preloadCoat(coat);
      document.querySelectorAll('.coat-row .coat').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      clearTimeout(moodTimer);
      setSprite(idleMood());
      animate('bounce');
      say(BARKS.coat);
    });
  });

  // Trick buttons.
  document.querySelectorAll('.trick-row .trick').forEach((btn) => {
    btn.addEventListener('click', () => {
      const trick = btn.dataset.trick;
      if (trick === 'sit') { animate('sit'); flashMood('happy'); say(BARKS.sit); }
      else if (trick === 'spin') { animate('spin'); flashMood('ecstatic'); say(BARKS.spin); }
      else { animate('bounce'); flashMood('ecstatic'); say(BARKS.speak); }
    });
  });

  // Night makes her sleepy; day wakes her up.
  document.addEventListener('trp:tod', () => {
    clearTimeout(moodTimer);
    setSprite(idleMood());
    if (idleMood() === 'exhausted') say(BARKS.sleepy);
  });
}

/* ========================================================================
   3. Scroll reveals + the Paper Pom letter unfold.
   ======================================================================== */

function initReveals() {
  if (!hasGsap || isStatic()) return;
  gsap.registerPlugin(ScrollTrigger);

  // Hidden means opacity 0, never visibility hidden: the section stays in
  // the accessibility tree before it scrolls into view, and focus arriving
  // inside it (a keyboard user tabbing to a link) reveals it at once (W14).
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    gsap.set(el, { opacity: 0, y: 20 });
    let trigger = null;
    const reveal = () => {
      if (trigger) trigger.kill();
      gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' });
    };
    trigger = ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: reveal });
    el.addEventListener('focusin', () => {
      if (trigger) trigger.kill();
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: 'opacity,transform' });
    }, { once: true });
  });

  const letter = document.querySelector('.letter');
  if (letter && letter.getBoundingClientRect().top > window.innerHeight) {
    gsap.set(letter, { rotationX: -62, opacity: 0.35 });
    const unfold = gsap.to(letter, {
      rotationX: 0,
      opacity: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: '.letter-scene',
        start: 'top 88%',
        end: 'top 44%',
        scrub: 0.4
      }
    });
    letter.addEventListener('focusin', () => {
      if (unfold.scrollTrigger) unfold.scrollTrigger.kill();
      unfold.kill();
      gsap.set(letter, { clearProps: 'all' });
    }, { once: true });
  }

  window.addEventListener('load', () => ScrollTrigger.refresh());
}

/* ========================================================================
   boot
   ======================================================================== */

initQuietControl();
initTimeOfDay();
initPom();
initReveals();


/* ========================================================================
   The bookmark — chapter ribbon. Scrolling untouched; links are native
   anchors. Hidden without JS.
   ======================================================================== */

function initBookmark() {
  const nav = document.getElementById('bookmark');
  const fill = document.getElementById('bm-fill');
  if (!nav) return;
  const links = Array.from(nav.querySelectorAll('a'));
  const sections = links
    .map((a) => ({ a, el: document.querySelector(a.getAttribute('href')) }))
    .filter((x) => x.el);
  if (sections.length < 2) return;

  nav.hidden = false;

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        sections.forEach((x) => {
          const on = x.el === entry.target;
          if (on) x.a.setAttribute('aria-current', 'true');
          else x.a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    sections.forEach((x) => io.observe(x.el));
  }

  let raf = null;
  window.addEventListener('scroll', () => {
    if (raf || !fill) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? (window.scrollY / max) * 100 : 0;
      nav.style.setProperty('--bm-progress', p.toFixed(1) + '%');
    });
  }, { passive: true });
}

initBookmark();

/* A live policy change (Reduce Motion toggled mid-session, or the visitor's
   pause) settles the scroll choreography without a reload; the CSS gate
   stills the ambient animation and user-triggered flourishes read
   isStatic() when they fire. */
onMotionChange((state) => {
  if (state !== 'full' && hasGsap) settleGsap({ clear: ['[data-reveal]', '.letter'] });
});
