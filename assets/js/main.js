/* ========================================================================
   main.js — entry point.
   Gating philosophy: the page is complete, readable, and navigable with
   zero JavaScript. Everything here is enhancement, layered in by
   capability: Reduce Motion gets a calm static page; no-WebGL gets the
   CSS atmosphere; touch devices skip pointer-tilt; desktops get it all.
   ======================================================================== */

import { createAtmosphere } from './atmosphere.js';
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

if (window.gsap) {
  gsap.registerPlugin(ScrollTrigger, SplitText);
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

let atmosphere = null;

if (!reduceMotion) {
  const canvas = document.getElementById('atmo-canvas');
  if (canvas) atmosphere = createAtmosphere(canvas, { mobile });
}

if (atmosphere) {
  document.getElementById('atmo')?.remove();
} else {
  document.getElementById('atmo-canvas')?.remove();
  seedCssAtmo();
}

// Interactive specimens bind before nav so their preventDefault wins.
initFortune({ atmosphere, motion: !reduceMotion });

let chapters = null;
if (!reduceMotion && window.gsap) {
  chapters = initChapters({ atmosphere, motion: true });
}

initCaptureSpecimen({ motion: !reduceMotion });
initNav({ motion: !reduceMotion });
initCameo({ motion: !reduceMotion });

if (!reduceMotion && window.gsap) {
  initReveals();
  if (finePointer && !mobile) initTilt();
}
