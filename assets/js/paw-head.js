/* ========================================================================
   paw-head.js — arrival half of the paw-print reveal (from paw-a.html's
   inline <head> script, QA'd Chromium 153 + WebKit 26.6). Classic script
   (no type="module"/async/defer), right after charset/CSP metas, before
   any stylesheet — parser-blocking so `pagereveal` attaches in time.
   Duplicates (can't import) motion.js's policy logic; keep in sync.

   'paw' MUST be added HERE: added only in paw-reveal.js's pageswap isn't
   guaranteed to carry to this page's :active-view-transition-type(paw).
   Also the only file checking PAW_EXEMPT_PREFIXES — without this side
   adding the type, none of reveals.css's paw rules can match.
   ======================================================================== */
(function () {
    'use strict';
    var STORAGE_KEY = 'trp-motion';
    var ORIGIN_KEY = 'trp-paw-origin';
    var PAW_EXEMPT_PREFIXES = ['/hush-hush-snap-snap']; // owns its own arrival effect (hhss.css)
    var params = new URLSearchParams(location.search);
    var root = document.documentElement;

    function isPawExempt(pathname) {
        for (var i = 0; i < PAW_EXEMPT_PREFIXES.length; i++) {
            var p = PAW_EXEMPT_PREFIXES[i];
            if (pathname === p || pathname.indexOf(p + '/') === 0) return true;
        }
        return false;
    }

    // Mirrors motion.js's motionState(); re-run inside pagereveal (bfcache/prerender can refire it).
    function computeMotionState() {
        var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        var paused = false;
        try { paused = localStorage.getItem(STORAGE_KEY) === 'paused'; } catch (err) { /* private mode */ }
        return reduced ? 'reduced' : params.has('static') ? 'static' : paused ? 'paused' : 'full';
    }
    root.dataset.motion = computeMotionState();

    var pawms = parseInt(params.get('pawms'), 10); // overrides --paw-duration (reveals.css default 1100ms)
    if (isFinite(pawms) && pawms > 0) root.style.setProperty('--paw-duration', pawms + 'ms');


    window.addEventListener('pagereveal', function (e) {
        // Clear FIRST, unconditionally (bfcache/prerender can carry stale state).
        var raw = null;
        try {
            raw = sessionStorage.getItem(ORIGIN_KEY);
            sessionStorage.removeItem(ORIGIN_KEY);
        } catch (err) { /* private mode: nothing to clear */ }
        root.style.removeProperty('--paw-x');
        root.style.removeProperty('--paw-y');
        root.style.removeProperty('--paw-cover');

        if (!e.viewTransition) return;
        e.viewTransition.ready.catch(function () { /* skipped/unsupported */ });

        var liveState = computeMotionState();
        root.dataset.motion = liveState;
        if (liveState !== 'full') { // ?static=1/pause are JS-only (Reduce Motion is a CSS gate)
            e.viewTransition.skipTransition();
            return;
        }
        if (isPawExempt(location.pathname)) return;
        if (!raw) return; // direct load, storage failure, or old page chose not to persist

        var origin = null;
        try { origin = JSON.parse(raw); } catch (err) { /* corrupt: ignore */ }
        if (!origin || typeof origin.x !== 'number' || typeof origin.y !== 'number') origin = { x: 0.5, y: 0.5 };

        if (e.viewTransition.types) e.viewTransition.types.add('paw');

        var tapX = origin.x * innerWidth;
        var tapY = origin.y * innerHeight;
        root.style.setProperty('--paw-x', tapX + 'px');
        root.style.setProperty('--paw-y', tapY + 'px');

        // Cover (S): smallest mask (+4%) whose heel-pad ellipse (0.23/0.20 semi-axes) reaches every corner.
        var corners = [[0, 0], [innerWidth, 0], [0, innerHeight], [innerWidth, innerHeight]];
        var maxReach = 0;
        for (var i = 0; i < corners.length; i++) {
            var reach = Math.hypot((corners[i][0] - tapX) / 0.23, (corners[i][1] - tapY) / 0.20);
            if (reach > maxReach) maxReach = reach;
        }
        root.style.setProperty('--paw-cover', (1.04 * maxReach) + 'px');
    });
})();
