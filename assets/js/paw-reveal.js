/* paw-reveal.js — old-page half of the paw-print reveal; paw-head.js is
   its render-blocking arrival counterpart in <head>. Split because this
   deferred module can't reliably beat `pagereveal` on the NEW document,
   so paw-head.js drives the reveal itself and duplicates motionState()
   and this file's exemption list rather than importing them.

   'paw' is added on both sides: this file's add is belt-and-braces, but
   only paw-head.js's own addition on arrival reliably matches
   :active-view-transition-type(paw) — the only gate an arrival effect
   (Hush Hush Snap Snap) needs.

   Cover size (paw-head.js): the smallest mask (+4% margin) whose heel-pad
   ellipse (semi-axes 0.23/0.20, matching paw.svg's rx=46/ry=40 of 200)
   reaches every corner from the tap point — size >= hypot(dx/0.23,
   dy/0.20) per corner, maxed over all four.

   This file's own jobs, on the OLD document:
   1. `click` (capture): remember the tap origin.
   2. `pageswap`: decide whether this nav gets 'paw', then persist the
      origin (sessionStorage) for paw-head.js. */

import { motionState } from './motion.js';

const ORIGIN_KEY = 'trp-paw-origin';

let pendingOrigin = null;

document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor || anchor.target === '_blank') return;
    try {
        if (new URL(anchor.href, window.location.href).origin !== window.location.origin) return;
    } catch {
        return;
    }

    // Keyboard activation dispatches clientX/clientY 0,0 — use the link's own on-screen center instead.
    let originX;
    let originY;
    if (event.clientX === 0 && event.clientY === 0) {
        const rect = anchor.getBoundingClientRect();
        originX = rect.left + rect.width / 2;
        originY = rect.top + rect.height / 2;
    } else {
        originX = event.clientX;
        originY = event.clientY;
    }
    pendingOrigin = { x: originX / window.innerWidth, y: originY / window.innerHeight };
}, true);

window.addEventListener('pageswap', (event) => {
    if (!event.viewTransition) return;

    const navigationType = event.activation && event.activation.navigationType;
    if (navigationType === 'traverse') {
        // Back/Forward: no paw (Sean's design call, not a technical requirement).
        event.viewTransition.skipTransition();
        return;
    }

    // Re-checked now, not trusted from click time: ?static=1/pause can change in between.
    if (motionState() !== 'full') {
        event.viewTransition.skipTransition();
        return;
    }

    // hero-work click script names the clicked specimen for its own morph;
    // if in flight, don't add 'paw' (falls through to the default crossfade).
    if (document.querySelector('[style*="view-transition-name"]')) return;

    event.viewTransition.types.add('paw');
    try {
        sessionStorage.setItem(ORIGIN_KEY, JSON.stringify(pendingOrigin || { x: 0.5, y: 0.5 }));
    } catch {
        /* private browsing: paw-head.js finds nothing, falls back to centered default */
    }
});
