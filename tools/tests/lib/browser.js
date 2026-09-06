'use strict';
/* browser.js — launch helper shared by every test file.

   Browser choice: CI has no Google Chrome install, so it uses Playwright's
   own bundled Chromium (downloaded in the workflow via
   `npx playwright install --with-deps chromium`). Locally this repo's
   convention is the installed Google Chrome (channel: 'chrome'), matching
   the probe scripts this suite was ported from; set TRP_BROWSER=chromium
   to use the bundled Chromium locally instead (after
   `npx playwright install chromium`).

   Network policy: every context built with newContext() aborts any request
   whose origin isn't the local static server, except data: URLs. This is
   the same policy the seed probes used — no page here ever needs the
   public internet, and it keeps a broken relative link or a real Supabase
   call from silently "working" in a test run. */

const { chromium } = require('playwright');

function usesBundledChromium() {
  return Boolean(process.env.CI) || process.env.TRP_BROWSER === 'chromium';
}

/** Launch the browser this environment should use. */
function launch(options = {}) {
  const launchOptions = { headless: true, ...options };
  if (!usesBundledChromium()) launchOptions.channel = 'chrome';
  return chromium.launch(launchOptions);
}

/**
 * Create a context + page wired for this suite's network policy, and
 * collect page errors and console errors as they happen. `baseUrl` is the
 * local server's origin (e.g. http://127.0.0.1:54321) — the only origin
 * requests are allowed to reach.
 */
async function newPage(browser, baseUrl, contextOptions = {}) {
  const context = await browser.newContext(contextOptions);
  const errors = [];
  const pageErrors = [];
  const consoleErrors = [];

  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('data:')) return route.continue();
    let origin;
    try {
      origin = new URL(url).origin;
    } catch {
      return route.abort();
    }
    if (origin === baseUrl) return route.continue();
    return route.abort();
  });

  const page = await context.newPage();
  page.on('pageerror', (err) => {
    const message = err && err.message ? err.message : String(err);
    pageErrors.push(message);
    errors.push(message);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    consoleErrors.push(text);
    errors.push(text);
  });

  return { context, page, errors, pageErrors, consoleErrors };
}

/** Inject the pinned local axe-core build into the page. */
async function injectAxe(page) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
}

/**
 * Run axe against the given tag set and return the raw result. Assumes
 * injectAxe(page) has already run.
 */
function runAxe(page, tags) {
  return page.evaluate(
    (runTags) => window.axe.run(document, { runOnly: { type: 'tag', values: runTags } }),
    tags,
  );
}

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'];

/**
 * Wait until no CSS animation or transition is running, or give up after
 * `timeout` ms and let the caller's assertion report what is still running.
 * Polled on requestAnimationFrame, which also forces the renderer to produce
 * frames: on a loaded CI runner a headless page can go hundreds of
 * milliseconds without painting, and Reduce Motion's 0.01 ms transitions
 * then still read as "running" after any fixed sleep (first CI flake: 19
 * reveal sections x 2 transitioned properties = 38 "running" after 700 ms).
 */
async function settleAnimations(page, timeout = 4000) {
  try {
    await page.waitForFunction(
      () => document.getAnimations().filter((a) => a.playState === 'running').length === 0,
      null,
      { timeout, polling: 'raf' },
    );
  } catch {
    /* the caller's count decides */
  }
}

module.exports = { launch, newPage, injectAxe, runAxe, settleAnimations, AXE_TAGS };
