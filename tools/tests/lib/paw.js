'use strict';
/* lib/paw.js — shared helpers for the cross-document paw-print reveal
   tests (assets/js/paw-head.js + assets/js/paw-reveal.js), used by every
   test in behavior.test.js's "paw" describe block: the one case that
   proves the gate isn't vacuous (a push navigation under full motion
   actually arms 'paw') sits alongside the four negative-gating cases
   (?static=1, Reduce Motion, a stored pause, a back/forward traverse).

   Root cause of an earlier flake in these tests, measured (installed
   Google Chrome, channel 'chrome', 153.0.8010.53): Chrome does not grant
   a cross-document view-transition opt-in for a document served
   `Cache-Control: no-store` or `no-cache` — no-store 1/8, no-cache 0/8,
   max-age=600 8/8 (fresh context each attempt, index.html to the footer
   privacy link, types read after `ready`). This repo's default test
   server (lib/server.js) sends `no-store`, which every OTHER test in
   this suite wants (nothing here should ever be served stale mid-run).
   The live site sends `max-age=600` (curl -I
   https://thomasraypublishing.com/privacy.html), so real visitors get
   the paw reveal; the test server just wasn't matching that header. Every
   paw test — positive and negative alike — therefore runs against its
   own server started with `{ cacheControl: 'max-age=600' }`, not the
   file's shared no-store one. (This also means the four negative cases
   were previously passing vacuously: with no-store, Chrome rarely
   offered a transition to skip in the first place, so "no paw type"
   proved nothing. The positive/control case below is what makes a
   vacuous pass impossible.)

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
// ViewTransition opt-in disabled" when it declines to grant a
// cross-document transition for reasons outside the page's control — the
// same no-store/no-cache cause documented above. Every paw test now runs
// against the max-age=600 server, so this shouldn't fire for these
// navigations in practice; kept as a defensive filter (not a page bug)
// rather than removed, so a real, unrelated console error still fails
// the test.
const BENIGN_VT_ABORT = 'Transition was aborted because of invalid state. ViewTransition opt-in disabled';
const realErrors = (errs) => errs.filter((e) => !e.includes(BENIGN_VT_ABORT));

// Does NOT use lib/browser.js's newPage(): its context.route('**/*')
// interception (needed elsewhere to keep tests off the public internet)
// isn't needed here — every navigation in this file is same-origin
// against the local fixture server regardless.
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
          window.__pawCap.settled = true;
        });
      }
    });
  });
}

async function loadFromPage(site, page, suffix = '') {
  await page.goto(`${site.url}/${FROM_PAGE}${suffix}`, { waitUntil: 'networkidle' });
}

async function snapshot(page) {
  // Wait for the ready-gated capture itself, not a fixed delay: `ready`
  // can settle after the load event, and a fixed 150 ms after load read
  // an empty type set on a real paw navigation (measured 40/40 paw
  // transitions both engines when reading after `ready`).
  await page.waitForFunction(
    () => window.__pawCap && (!window.__pawCap.hasVT || window.__pawCap.settled),
    null,
    { timeout: 5000 },
  );
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

/** Single navigation attempt: push from FROM_PAGE to privacy.html and
    return the captured pagereveal state. No retry — against the
    max-age=600 server this should be reliable (measured 8/8; see this
    file's header comment). If a single attempt proves flaky under the
    full concurrent `npm test`, that's real signal to report with
    numbers, not something to paper over by adding retries back. */
async function pushToPrivacy(site, page) {
  await loadFromPage(site, page);
  return clickToPrivacy(page);
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
  pushToPrivacy,
};
