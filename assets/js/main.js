/* ========================================================================
   main.js — entry point.
   Gating philosophy: the page is complete, readable, and navigable with
   zero JavaScript. Everything here is enhancement, layered in by
   capability: Reduce Motion gets a calm static page; no-WebGL gets the
   CSS atmosphere; touch devices skip pointer-tilt; desktops get it all.
   Order matters for resilience: essential navigation binds first and
   depends on nothing; the WebGL sky (Three.js, the one heavy optional
   module) is imported last and lazily, so a blocked or failed fetch
   leaves the CSS sky in place instead of taking the menu down.
   ======================================================================== */

import { initChapters } from './chapters.js';
import { initReveals, initTilt } from './reveals.js';
import { initNav } from './nav.js';
import { initFortune } from './fortune.js';
import { initCaptureSpecimen } from './specimen.js';
import { initCameo } from './cameo.js';

// ?static=1 forces the settled page for CI (Lighthouse/axe) — the same
// deterministic-render contract every app page carries.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  || new URLSearchParams(window.location.search).has('static');
const finePointer = window.matchMedia('(pointer: fine)').matches;
const mobile = window.matchMedia('(max-width: 820px)').matches || !finePointer;

// GSAP and its plugins are classic deferred scripts; any one of them can be
// missing (blocked, failed, or not cached yet) without breaking the page.
// Register only what actually arrived and gate each effect on what it needs.
const hasGsap = typeof window.gsap !== 'undefined';
const hasScrollTrigger = hasGsap && typeof window.ScrollTrigger !== 'undefined';
const hasSplitText = hasGsap && typeof window.SplitText !== 'undefined';
if (hasGsap) {
  gsap.registerPlugin(...[window.ScrollTrigger, window.SplitText].filter(Boolean));
}

/* CSS-particle fallback (the original atmosphere) — used when WebGL is
   unavailable or motion is reduced. With Reduce Motion the stylesheet
   freezes these via the existing media query, leaving a quiet static sky. */
function seedCssAtmo() {
  const atmo = document.getElementById('atmo');
  if (!atmo) return;
  atmo.innerHTML = '';
  const w = window.innerWidth;
  const h = Math.max(window.innerHeight * 2, 1600);
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    s.style.left = Math.random() * w + 'px';
    s.style.top = Math.random() * h + 'px';
    s.style.animationDelay = Math.random() * 6 + 's';
    atmo.appendChild(s);
  }
  for (let i = 0; i < 8; i++) {
    const f = document.createElement('div');
    f.className = 'fluff';
    const size = 120 + Math.random() * 220;
    f.style.width = size + 'px';
    f.style.height = size + 'px';
    f.style.left = Math.random() * w + 'px';
    f.style.top = Math.random() * h + 'px';
    f.style.animationDelay = Math.random() * 30 + 's';
    f.style.animationDuration = 28 + Math.random() * 22 + 's';
    atmo.appendChild(f);
  }
}

// The sky arrives later (or never); everything that talks to it goes
// through this forwarding handle so nothing has to wait for Three.js.
const sky = { current: null };
const atmosphere = {
  setWorld: (name) => sky.current?.setWorld(name),
  setScroll: (px) => sky.current?.setScroll(px),
  pulse: (x, y, strength) => sky.current?.pulse(x, y, strength),
  pause: () => sky.current?.pause(),
  play: () => sky.current?.play(),
};

// 1. Essential navigation — first, and independent of every decoration.
initNav({ motion: !reduceMotion });

// 2. Interactive specimens (content, not decoration: they work in static mode too).
initFortune({ atmosphere, motion: !reduceMotion });
initCaptureSpecimen({ motion: !reduceMotion });
initCameo({ motion: !reduceMotion });

// 3. Scroll choreography — needs GSAP + ScrollTrigger (+ SplitText for the reveals).
let chapters = null;
if (!reduceMotion && hasScrollTrigger) {
  chapters = initChapters({ atmosphere, motion: true });
}
if (!reduceMotion && hasScrollTrigger && hasSplitText) {
  initReveals();
  if (finePointer && !mobile) initTilt();
}

// 4. The WebGL sky — lazy, optional, last. Any failure keeps the CSS sky.
async function loadSky() {
  const canvas = document.getElementById('atmo-canvas');
  if (reduceMotion || !canvas) return null;
  try {
    const { createAtmosphere } = await import('./atmosphere.js');
    return createAtmosphere(canvas, { mobile });
  } catch {
    return null;
  }
}

loadSky().then((instance) => {
  if (instance) {
    sky.current = instance;
    document.getElementById('atmo')?.remove();
    // Catch up with wherever the reader has scrolled to meanwhile.
    if (chapters) instance.setWorld(chapters.getWorld());
  } else {
    document.getElementById('atmo-canvas')?.remove();
    seedCssAtmo();
  }
});
