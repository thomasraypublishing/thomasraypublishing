/* paw-head.js — arrival half of the paw-print reveal; classic, parser-
   blocking <head> script. Rationale, placement, and the cover-size
   derivation live in paw-reveal.js's header — this file is just the code.
   Keep computeMotionState()/PAW_EXEMPT_PREFIXES in sync with motion.js and
   paw-reveal.js respectively. */
(function () {
    'use strict';
    var STORAGE_KEY = 'trp-motion';
    var ORIGIN_KEY = 'trp-paw-origin';
    var PAW_EXEMPT_PREFIXES = ['/hush-hush-snap-snap'];
    var params = new URLSearchParams(location.search);
    var root = document.documentElement;

    function isPawExempt(pathname) {
        for (var i = 0; i < PAW_EXEMPT_PREFIXES.length; i++) {
            var p = PAW_EXEMPT_PREFIXES[i];
            if (pathname === p || pathname.indexOf(p + '/') === 0) return true;
        }
        return false;
    }

    function computeMotionState() {
        var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        var paused = false;
        try { paused = localStorage.getItem(STORAGE_KEY) === 'paused'; } catch (err) { /* private mode */ }
        return reduced ? 'reduced' : params.has('static') ? 'static' : paused ? 'paused' : 'full';
    }
    root.dataset.motion = computeMotionState();

    var pawms = parseInt(params.get('pawms'), 10);
    if (isFinite(pawms) && pawms > 0) root.style.setProperty('--paw-duration', pawms + 'ms');

    window.addEventListener('pagereveal', function (e) {
        var raw = null;
        try {
            raw = sessionStorage.getItem(ORIGIN_KEY);
            sessionStorage.removeItem(ORIGIN_KEY);
        } catch (err) { /* private mode */ }
        root.style.removeProperty('--paw-x');
        root.style.removeProperty('--paw-y');
        root.style.removeProperty('--paw-cover');

        if (!e.viewTransition) return;
        e.viewTransition.ready.catch(function () { /* skipped/unsupported */ });

        var liveState = computeMotionState();
        root.dataset.motion = liveState;
        if (liveState !== 'full') {
            e.viewTransition.skipTransition();
            return;
        }
        if (isPawExempt(location.pathname)) return;
        if (!raw) return;

        var origin = null;
        try { origin = JSON.parse(raw); } catch (err) { /* corrupt: ignore */ }
        if (!origin || typeof origin.x !== 'number' || typeof origin.y !== 'number') origin = { x: 0.5, y: 0.5 };

        if (e.viewTransition.types) e.viewTransition.types.add('paw');

        var tapX = origin.x * innerWidth;
        var tapY = origin.y * innerHeight;
        root.style.setProperty('--paw-x', tapX + 'px');
        root.style.setProperty('--paw-y', tapY + 'px');

        var corners = [[0, 0], [innerWidth, 0], [0, innerHeight], [innerWidth, innerHeight]];
        var maxReach = 0;
        for (var i = 0; i < corners.length; i++) {
            var reach = Math.hypot((corners[i][0] - tapX) / 0.23, (corners[i][1] - tapY) / 0.20);
            if (reach > maxReach) maxReach = reach;
        }
        root.style.setProperty('--paw-cover', (1.04 * maxReach) + 'px');
    });
})();
