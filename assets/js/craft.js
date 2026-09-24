/* ========================================================================
   craft.js — the craft pass's two runtime jobs. Everything else (press
   feedback, focus ease, edge theming, typography grace) is CSS-only.

   1. Image reveal: any <img> not yet complete() when this module runs
      gets .craft-fade (opacity/blur set in each page's own CSS, keyed to
      that page's own background token); on load/decode it gets
      .craft-loaded, which the CSS transitions under
      html[data-motion="full"] and snaps instantly everywhere else.
      Already-complete/cached images are left alone — never faded.

   2. Card sheen: a rAF-throttled, passive pointermove sets --mx/--my (as
      percentages) on whichever card the pointer is over, so the radial
      sheen in each page's CSS can follow it. Only bound while motion is
      "full" AND the device actually has a fine-pointer hover (a touch
      screen has no hover to chase) — re-evaluated live on every
      motion-policy change and on that media query changing.

   No dependencies. Root-relative import so this resolves the same from
   the site root and from a one-level-down app page. No-op safely if the
   page has none of the elements below.
   ======================================================================== */

import { isStatic, onMotionChange } from '/assets/js/motion.js';

// Cards the pointer-tracked sheen runs on, across every page's own CSS.
const CARD_SELECTOR = '.specimen, .stk, .book .cover, .instrument, .plan, .card, .tier';

// Never fade an image that is itself (or sits inside) a cross-document
// view-transition morph target, or one HHSS's own scroll-driven aperture
// reveal already owns.
const SKIP_SELECTOR = '.stage, .stage-view, .stage-pom, .dot-field, .pyramid-btn, figure.photo, figure.bleed, img.capture';

// The sheen follows a real pointer; a touch device has no hover to chase,
// so binding the listener there is pure overhead (and --mx/--my would just
// sit wherever the last touch happened). Re-evaluated live: a Bluetooth
// mouse paired mid-session, or a 2-in-1 switching to tablet mode, changes
// this query without a reload.
const HOVER_CAPABLE = window.matchMedia('(hover: hover) and (pointer: fine)');

let sheenBound = false;
let rafPending = false;
let lastEvent = null;

function onPointerMove(event) {
  lastEvent = event;
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    if (!lastEvent) return;
    const target = lastEvent.target.closest?.(CARD_SELECTOR);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const mx = ((lastEvent.clientX - rect.left) / rect.width) * 100;
    const my = ((lastEvent.clientY - rect.top) / rect.height) * 100;
    target.style.setProperty('--mx', `${mx}%`);
    target.style.setProperty('--my', `${my}%`);
  });
}

function bindSheen() {
  if (sheenBound) return;
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  sheenBound = true;
}

function unbindSheen() {
  if (!sheenBound) return;
  document.removeEventListener('pointermove', onPointerMove);
  sheenBound = false;
  lastEvent = null;
}

function applyMotionState() {
  if (isStatic() || !HOVER_CAPABLE.matches) unbindSheen();
  else bindSheen();
}

function markImage(img) {
  if (img.dataset.craftMarked !== undefined) return;
  if (img.closest(SKIP_SELECTOR)) return;
  if (img.complete && img.naturalWidth > 0) return; // already loaded/cached — never fade
  img.dataset.craftMarked = '';
  // A lazy image isn't complete() yet at bind time even on a cached reload
  // — the browser doesn't check its cache until the image nears the
  // viewport — but a cache hit then decodes within a frame or two. Waiting
  // one frame before committing to the fade skips it for that case
  // (nothing was visibly blocked either way in that single frame), instead
  // of running the full 360ms fade-in for an image that was already there.
  requestAnimationFrame(() => {
    if (img.complete && img.naturalWidth > 0) return; // decoded within a frame — a cache hit, not worth fading
    img.classList.add('craft-fade');
    const reveal = () => {
      img.classList.add('craft-loaded');
      settleFade(img);
    };
    img.addEventListener('load', reveal, { once: true });
    img.addEventListener('error', reveal, { once: true });
  });
}

// .craft-fade/.craft-loaded only ever hold a temporary starting state
// (see the CSS's @layer craft-fade) — once the fade-in has visually
// finished, both classes are dropped so the page's own opacity/filter
// rules for that element (e.g. The Device's .webb-glow ambient glow) take
// over permanently instead of being shadowed forever.
function settleFade(img) {
  const clear = () => img.classList.remove('craft-fade', 'craft-loaded');
  if (isStatic()) { clear(); return; } // no transition ran; nothing to wait for
  const duration = parseFloat(getComputedStyle(img).transitionDuration) * 1000 || 0;
  if (duration <= 0) { clear(); return; }
  let settled = false;
  const finish = () => { if (settled) return; settled = true; clear(); };
  img.addEventListener('transitionend', (event) => {
    if (event.target === img && (event.propertyName === 'opacity' || event.propertyName === 'filter')) finish();
  }, { once: true });
  setTimeout(finish, duration + 100); // safety net if transitionend never fires
}

function markImages(root = document) {
  root.querySelectorAll?.('img').forEach(markImage);
}

markImages();
applyMotionState();
onMotionChange(applyMotionState);
HOVER_CAPABLE.addEventListener('change', applyMotionState);

// Content inserted after boot (lazy sections, JS-rendered cards) still
// gets the same fade-in treatment.
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.tagName === 'IMG') markImage(node);
      else if (node.querySelector?.('img')) markImages(node);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });
