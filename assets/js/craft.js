/* craft.js — the craft pass's runtime jobs (everything else is CSS-only):
   1. Image reveal: an <img> not yet complete() gets .craft-fade until
      load/decode, then .craft-loaded (CSS transitions it under
      html[data-motion="full"], snaps elsewhere). Cached images: untouched.
   2. Card sheen: rAF-throttled pointermove sets --mx/--my on the hovered
      card, bound only while motion is full and the pointer has hover.
   Root-relative import; no deps; no-op if the page has none of this. */

import { isStatic, onMotionChange } from '/assets/js/motion.js';

// Cards the pointer-tracked sheen runs on, across every page's own CSS.
const CARD_SELECTOR = '.specimen, .stk, .book .cover, .instrument, .plan, .card, .tier';

// Never fade an image already owned by another reveal: a cross-document
// morph target, HHSS's own aperture reveal, or a GSAP scroll reveal
// (data-reveal — closest() also catches an img nested inside one).
const SKIP_SELECTOR = '.stage, .stage-view, .stage-pom, .dot-field, .pyramid-btn, figure.photo, figure.bleed, img.capture, [data-reveal]';

// No hover to chase on touch; re-evaluated live for a mouse paired or a
// 2-in-1 switched mid-session.
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
  // A cached lazy image isn't complete() yet at bind time (the browser
  // doesn't check until it nears the viewport) but decodes within a
  // frame; wait one frame so that case skips the fade.
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

// .craft-fade/.craft-loaded are temporary; drop both once settled so the
// page's own permanent rules (e.g. The Device's .webb-glow) take over.
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
