/* paw-reveal.js — old-page half of the paw-print reveal (from paw.js,
   QA'd Chromium 153 + WebKit 26.6). Rationale for both this file and its
   arrival-side counterpart, assets/js/paw-head.js, lives here — paw-head.js
   is render-blocking on every page, so it carries no more than a pointer
   back to this header.

   Split: this file is a type="module" script; a module's deferred timing
   isn't guaranteed to win the race against `pagereveal` firing on first
   render of the NEW document, so the side that actually drives the reveal
   has to be a classic, parser-blocking <head> script instead (paw-head.js,
   placed right after the charset/CSP metas, before any stylesheet). CSP
   already allows inline scripts, but it stays an external file — one copy
   to edit for 19 pages instead of 19 inline duplicates.

   Why 'paw' is added on BOTH sides: this file's pageswap handler adds it
   too (belt-and-braces for engines that honor it), but a type added only
   in pageswap on the OLD document is not guaranteed to carry into the NEW
   document's own :active-view-transition-type(paw) match — paw-head.js's
   own addition, on arrival, is the one that actually matters. That arrival
   check is also the only gate a page needing its own arrival effect (Hush
   Hush Snap Snap) needs: without paw-head.js adding 'paw' there, none of
   reveals.css's paw-scoped rules can ever match, so this file doesn't
   carry its own copy of the exemption list.

   paw-head.js duplicates (can't import) motion.js's motionState() — same
   deferred-module-timing reason as the split above — and, in its
   `pagereveal` handler, clears any stored origin and the --paw-* custom
   properties FIRST and unconditionally, before deciding anything: a
   bfcache-restored or prerendered document can fire `pagereveal` again
   carrying stale state from a previous activation of that same instance.

   Cover size (S), computed in paw-head.js: the smallest mask size (+4%
   margin) whose heel-pad ellipse — semi-axes 0.23/0.20 of the mask box,
   matching art/paw.svg's rx=46/ry=40 of its 200-unit viewBox — reaches
   every viewport corner from the tap point. A point (dx, dy) from the tap
   sits on or outside that ellipse once size >= hypot(dx/0.23, dy/0.20);
   the max of that over all four corners is the smallest size covering all
   of them.

   This file's own two jobs, on the OLD document:
   1. `click` (capture): remember the tap origin in memory, so a same-page
      anchor or motion-off can't leave a stale one behind.
   2. `pageswap`: decide whether this nav gets 'paw', then persist the
      origin for paw-head.js to read. */

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
