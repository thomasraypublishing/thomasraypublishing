'use strict';
/* lib/paw.js — shared helpers for the cross-document paw-print reveal
   tests (assets/js/paw-head.js + assets/js/paw-reveal.js), used by both:
     - behavior.test.js's "paw" describe block: the four negative-gating
       cases (?static=1, Reduce Motion, a stored pause, a back/forward
       traverse), which are reliably single-attempt since "no transition
       granted at all" is itself a valid pass for each of them.
     - paw-positive.solo.test.js: the one case that needs a real, live
       cross-document view-transition grant from the browser (a push
       navigation under full motion actually arming 'paw') — split into
       its own file and its own `node --test` invocation in package.json's
       "test" script, run AFTER the main concurrent batch. See that file's
       header comment for why.

   Every navigation here is a push from FROM_PAGE to a real, visible
   footer link (not a scripted location.href — Playwright's click() is
   the well-behaved way to drive a navigation mid-test) to privacy.html;
   any two non-exempt pages would do, hush-hush-snap-snap owns its own
   arrival effect and is excluded by paw-head.js's own exemption list. */

const FROM_PAGE = 'index.html';
const LINK_SELECTOR = 'footer a[href="privacy.html"]';
const TO_GLOB = '**/privacy.html*';
const FROM_GLOB = `**/${FROM_PAGE}*`;

// Chromium logs "Transition was aborted because of invalid state.
// ViewTransition opt-in disabled" whenever it declines to grant a
// cross-document transition for reasons outside the page's control —
// observed on a sizeable share of same-origin navigations in this
// headless environment, including ones where our own JS deliberately
// calls skipTransition(). It is a browser diagnostic, not a page bug, so
// it's filtered out of the "no console errors" assertions rather than
// failing a test on an expected, harmless line.
const BENIGN_VT_ABORT = 'Transition was aborted because of invalid state. ViewTransition opt-in disabled';
const realErrors = (errs) => errs.filter((e) => !e.includes(BENIGN_VT_ABORT));

// Does NOT use lib/browser.js's newPage(): its context.route('**/*')
// interception (needed elsewhere to keep tests off the public internet)
// measurably increases how often Chromium logs the abort above. Every
// navigation here is same-origin against the local fixture server
// regardless, so the network policy isn't needed for correctness here.
async function newLocalPage(browser, contextOptions = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...contextOptions });
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(err.message || String(err)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return { context, page, errors };
}

/** Registers a `pagereveal` listener before any page script runs, and
    reads event.viewTransition.types only AFTER event.viewTransition.ready
    settles — not synchronously, and not just after a microtask. Reading
    it too early races paw-head.js's own (later-registered) listener,
    which calls `.types.add('paw')` synchronously but apparently doesn't
    make it durably visible to an earlier reader until the transition has
    reached `ready`; confirmed empirically that a synchronous or
    microtask-only read intermittently observes an empty set even when
    paw-head.js's add() call ran and threw nothing. Gating on `ready`
    removes that race. */
async function withCaptureInstalled(context) {
  await context.addInitScript(() => {
    window.__pawCap = { hasVT: false, types: [] };
    window.addEventListener('pagereveal', (event) => {
      const vt = event.viewTransition;
      window.__pawCap = { hasVT: Boolean(vt), types: [] };
      if (vt) {
        vt.ready.catch(() => {}).finally(() => {
          window.__pawCap.types = vt.types ? Array.from(vt.types) : [];
        });
      }
    });
  });
}

async function loadFromPage(site, page, suffix = '') {
  await page.goto(`${site.url}/${FROM_PAGE}${suffix}`, { waitUntil: 'networkidle' });
}

async function snapshot(page) {
  await page.waitForTimeout(150); // let the ready-gated capture settle
  return page.evaluate(() => ({
    cap: window.__pawCap,
    pawOrigin: (() => {
      try {
        return sessionStorage.getItem('trp-paw-origin');
      } catch {
        return null;
      }
    })(),
  }));
}

async function clickToPrivacy(page) {
  await Promise.all([page.waitForURL(TO_GLOB), page.click(LINK_SELECTOR)]);
  return snapshot(page);
}

/** Chromium only grants the cross-document view-transition opt-in on a
    minority of same-origin navigations when run concurrently with the
    rest of this suite (node:test runs separate *.test.js files in
    parallel by default, and every other file here is Playwright-heavy
    too — measured reliable in isolation: 9/10 and 10/10 across runs
    against both this repo's no-store server and a plain server, so the
    feature itself is fine; the low grant rate under `npm test` is
    contention from sibling files, not a gating defect). maxAttempts is
    deliberately kept low (5, not dozens): a case that still can't get a
    single real transition in 5 fresh-page attempts is a signal worth
    seeing, not something to paper over with more retries. That's exactly
    why the positive case lives in its own file, run outside the
    concurrent batch — see paw-positive.solo.test.js. */
async function pushToPrivacyRetrying(site, context, { fromSuffix = '', maxAttempts = 5 } = {}) {
  let last = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const page = await context.newPage();
    try {
      await loadFromPage(site, page, fromSuffix);
      last = await clickToPrivacy(page);
      if (last.cap.hasVT && last.cap.types.includes('paw')) return last;
    } finally {
      await page.close();
    }
  }
  return last;
}

module.exports = {
  FROM_PAGE,
  LINK_SELECTOR,
  TO_GLOB,
  FROM_GLOB,
  BENIGN_VT_ABORT,
  realErrors,
  newLocalPage,
  withCaptureInstalled,
  loadFromPage,
  snapshot,
  clickToPrivacy,
  pushToPrivacyRetrying,
};
