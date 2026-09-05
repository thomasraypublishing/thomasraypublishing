/* ========================================================================
   motion.js — the site's one motion policy, shared by every page.
   Motion is OPT-IN on html[data-motion="full"], an attribute only this
   module sets. So the settled page is what you get with no JavaScript,
   before this module runs (first paint), under ?static=1 (the CI render),
   under Reduce Motion, and when the visitor has paused motion on the site.
   Stylesheets key their ambient animations off the attribute; scripts read
   isStatic() at use time, so a live preference change takes effect without
   a reload and onMotionChange() lets running systems settle themselves.

   Values: 'full' | 'reduced' (OS preference) | 'static' (?static=1) |
           'paused' (the visitor's own choice, remembered in localStorage).

   Diagnostics are on-device only, zero network: window.__trpMotion (live
   getters) and ?debug=1 for a single console.debug line.
   ======================================================================== */

const STORAGE_KEY = 'trp-motion';
const params = new URLSearchParams(window.location.search);
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const staticParam = params.has('static');
const listeners = new Set();

function readPaused() {
  try { return window.localStorage.getItem(STORAGE_KEY) === 'paused'; } catch { return false; }
}
function writePaused(on) {
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, 'paused');
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch { /* private mode: the choice lasts for this page only */ }
}

let paused = readPaused();

/** The current policy value: 'full' means motion may run. */
export function motionState() {
  if (reduceQuery.matches) return 'reduced';
  if (staticParam) return 'static';
  if (paused) return 'paused';
  return 'full';
}

/** True whenever the page should be settled. Read this at use time. */
export const isStatic = () => motionState() !== 'full';

/** The visitor can only pause what the OS and CI have not already stilled. */
export const canPause = () => !reduceQuery.matches && !staticParam;
export const isPaused = () => paused;

/** The visitor's own pause/resume, site-wide and remembered. */
export function setPaused(on) {
  paused = Boolean(on);
  writePaused(paused);
  apply();
}

/** Subscribe to policy changes; the callback receives the new state. */
export function onMotionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Finish and drop GSAP scroll choreography so the page shows its settled
    state at once. `keep` names ScrollTrigger ids to leave running (e.g. the
    home page's chapter palette, which is a colour change, not motion), and
    `clear` lists selectors whose inline tween styles should be removed. */
export function settleGsap({ keep = () => false, clear = [] } = {}) {
  const g = window.gsap;
  if (!g) return;
  if (window.ScrollTrigger) {
    window.ScrollTrigger.getAll().forEach((t) => { if (!keep(t.vars.id || '')) t.kill(); });
  }
  g.globalTimeline.getChildren(true, true, true).forEach((t) => {
    if (t.scrollTrigger && keep(t.scrollTrigger.vars.id || '')) return;
    t.progress(1);
    t.kill();
  });
  if (clear.length) g.set(clear.join(', '), { clearProps: 'all' });
}

function apply() {
  const state = motionState();
  document.documentElement.dataset.motion = state;
  listeners.forEach((fn) => { try { fn(state); } catch { /* one listener must not break the rest */ } });
}

apply();
reduceQuery.addEventListener('change', apply);
// A choice made in another tab of the site applies here too.
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY || e.key === null) { paused = readPaused(); apply(); }
});

window.__trpMotion = Object.freeze({
  get motion() { return document.documentElement.dataset.motion; },
  get paused() { return paused; },
  get reduced() { return reduceQuery.matches; },
  static: staticParam,
});
if (params.has('debug')) console.debug('[trp] motion', { motion: motionState(), paused, reduced: reduceQuery.matches, static: staticParam });
