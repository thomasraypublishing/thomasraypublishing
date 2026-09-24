/* ========================================================================
   paw-reveal.js — old-page half of the paw-print reveal (from paw.js,
   QA'd Chromium 153 + WebKit 26.6). The arriving page's half — the side
   that actually has to add 'paw', since a type added only here isn't
   guaranteed to carry — lives in classic parser-blocking paw-head.js (a
   module here would race `pagereveal` and could lose). That arrival-side
   check is also the only gate a page needing its own arrival effect (Hush
   Hush Snap Snap) needs: without it adding 'paw', reveals.css never matches.

   1. `click` (capture): remember the tap origin in memory only, so a
      same-page anchor or motion-off can't leave a stale one behind.
   2. `pageswap`: decide whether this nav gets 'paw', then persist the
      origin for paw-head.js to read.
   ======================================================================== */

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
        // Back/Forward: no paw (a design call, flagged for Sean, not a technical requirement).
        event.viewTransition.skipTransition();
        return;
    }

    // Re-checked now, not trusted from click time: ?static=1/Pause can change in between.
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
