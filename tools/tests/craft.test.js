'use strict';
/* craft.test.js — regression coverage for the craft-pass fixes from the
   2026-09-23 QA round 2 (see Research/reviews/2026-09-23-craft-pass/
   qa-round2/REPORT.md): the GSAP-vs-CSS-transition conflict that left the
   home specimens and books/stickers stuck mid-reveal (HIGH-1/MEDIUM-1),
   the craft-fade cleanup contract, paw/hero-work exclusivity after a
   bfcache restore (LOW-2), and the per-page asset budget (LOW-1).

   A new file, not a section added to behavior.test.js: another lane is
   editing that file concurrently, and `npm test`'s `tools/tests/*.test.js`
   glob picks this one up automatically without any wiring. */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { webkit } = require('playwright');
const { start, stop, ROOT } = require('./lib/server');
const { launch, newPage } = require('./lib/browser.js');

const VIEWPORT = { width: 1280, height: 900 };

/** Identity, however the engine renders a `transform` that never moved. */
function isIdentity(transform) {
  return transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)';
}

describe('craft (Playwright)', () => {
  let site;
  let chromiumBrowser;
  let webkitBrowser;

  before(async () => {
    site = await start();
    chromiumBrowser = await launch();
    // lib/browser.js's launch() is Chromium-only (this repo's convention);
    // HIGH-1/MEDIUM-1 were engine-specific bugs, so WebKit needs its own
    // instance from the same pinned `playwright` package.
    webkitBrowser = await webkit.launch({ headless: true });
  });

  after(async () => {
    await chromiumBrowser.close();
    await webkitBrowser.close();
    await stop(site);
  });

  describe('full motion: GSAP reveals settle to identity instead of fighting the craft press/lift transitions', () => {
    async function assertSettled(browser, { scrollTo, selector, waitMs }) {
      const { context, page, errors } = await newPage(browser, site.url, { viewport: VIEWPORT });
      try {
        await page.goto(`${site.url}/index.html`, { waitUntil: 'networkidle' });
        if (scrollTo) {
          await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' }), scrollTo);
        }
        await page.waitForTimeout(waitMs);
        const results = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => ({
          transform: getComputedStyle(el).transform,
          opacity: getComputedStyle(el).opacity,
        })), selector);
        assert.ok(results.length > 0, `expected at least one ${selector} on index.html`);
        for (const [i, r] of results.entries()) {
          assert.ok(isIdentity(r.transform), `${selector} ${i}: expected identity transform, got ${r.transform}`);
          assert.equal(r.opacity, '1', `${selector} ${i}: expected opacity 1, got ${r.opacity}`);
        }
        assert.deepEqual(errors, [], `page/console error(s):\n  ${errors.join('\n  ')}`);
      } finally {
        await context.close();
      }
    }

    it('home .specimen cards settle within 3s — Chromium', async () => {
      await assertSettled(chromiumBrowser, { selector: '.specimens .specimen', waitMs: 3000 });
    });

    it('home .specimen cards settle within 3s — WebKit', async () => {
      await assertSettled(webkitBrowser, { selector: '.specimens .specimen', waitMs: 3000 });
    });

    it('catalog books settle after their reveal — Chromium', async () => {
      await assertSettled(chromiumBrowser, { scrollTo: '.catalog', selector: '.catalog .book', waitMs: 3000 });
    });

    it('catalog books settle after their reveal — WebKit', async () => {
      await assertSettled(webkitBrowser, { scrollTo: '.catalog', selector: '.catalog .book', waitMs: 3000 });
    });

    it('stickers settle after their reveal — Chromium', async () => {
      await assertSettled(chromiumBrowser, { scrollTo: '.stickers', selector: '.stickers .stk', waitMs: 3000 });
    });

    it('stickers settle after their reveal — WebKit', async () => {
      await assertSettled(webkitBrowser, { scrollTo: '.stickers', selector: '.stickers .stk', waitMs: 3000 });
    });
  });

  describe('craft-fade cleans up after itself', () => {
    it('no image keeps .craft-fade or a non-transparent background-color after load', async () => {
      const { context, page, errors } = await newPage(chromiumBrowser, site.url, { viewport: VIEWPORT });
      try {
        await page.goto(`${site.url}/index.html`, { waitUntil: 'networkidle' });
        // Force every loading="lazy" image into the viewport so it actually
        // starts loading — otherwise a far-below-the-fold image legitimately
        // never fires `load` and would fail this assertion for the wrong
        // reason (its craft-fade is correctly still pending, not stuck).
        await page.evaluate(async () => {
          const step = window.innerHeight * 0.8;
          for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((r) => requestAnimationFrame(r));
          }
        });
        await page.waitForFunction(
          () => [...document.querySelectorAll('img')].every((img) => img.complete),
          null,
          { timeout: 10000 },
        );
        await page.waitForTimeout(1500); // craft.js's fade-in duration plus its settle margin
        const results = await page.evaluate(() => [...document.querySelectorAll('img')].map((img) => ({
          src: img.currentSrc || img.src,
          craftFade: img.classList.contains('craft-fade'),
          craftLoaded: img.classList.contains('craft-loaded'),
          backgroundColor: getComputedStyle(img).backgroundColor,
        })));
        assert.ok(results.length > 0, 'expected at least one img on index.html');
        for (const r of results) {
          assert.ok(!r.craftFade && !r.craftLoaded, `${r.src}: expected craft-fade/craft-loaded to be cleared, got fade=${r.craftFade} loaded=${r.craftLoaded}`);
          assert.ok(
            r.backgroundColor === 'rgba(0, 0, 0, 0)' || r.backgroundColor === 'transparent',
            `${r.src}: expected a transparent background-color (a non-transparent one paints a visible square behind transparent art), got ${r.backgroundColor}`,
          );
        }
        assert.deepEqual(errors, [], `page/console error(s):\n  ${errors.join('\n  ')}`);
      } finally {
        await context.close();
      }
    });
  });

  describe('paw vs hero-work exclusivity', () => {
    // Reuses paw.js's max-age=600 server and helpers (Chrome only grants a
    // cross-document view-transition opt-in on that Cache-Control — see
    // that file's header) but adds its own pagereveal capture, since this
    // test also needs each animation's pseudo-element, not just the type set.
    const { newLocalPage, loadFromPage } = require('./lib/paw.js');

    let pawSite;

    before(async () => {
      pawSite = await start({ cacheControl: 'max-age=600' });
    });

    after(async () => {
      await stop(pawSite);
    });

    it('a stale hero-work name left by a bfcache restore does not suppress the paw or leave a stray hero-work morph', async () => {
      const { context, page, errors } = await newLocalPage(chromiumBrowser);
      try {
        await context.addInitScript(() => {
          window.addEventListener('pagereveal', (e) => {
            window.__vt = { has: Boolean(e.viewTransition) };
            if (!e.viewTransition) return;
            e.viewTransition.ready.then(() => {
              window.__vt.types = [...e.viewTransition.types];
              window.__vt.pseudos = [...new Set(
                document.getAnimations().map((a) => a.effect && a.effect.pseudoElement).filter(Boolean),
              )];
            }).catch(() => {});
          });
        });
        await loadFromPage(pawSite, page);
        // What a bfcache restore leaves behind: an earlier specimen click
        // named its stage, and the navigation that followed never cleared
        // it (the transition it named played out on the way OUT).
        await page.evaluate(() => {
          document.querySelector('#pom-stage').style.viewTransitionName = 'hero-work';
        });
        await Promise.all([
          page.waitForURL('**/privacy.html*'),
          page.click('footer a[href="privacy.html"]'),
        ]);
        await page.waitForFunction(() => window.__vt && window.__vt.types, null, { timeout: 5000 });
        const vt = await page.evaluate(() => window.__vt);
        assert.ok(vt.types.includes('paw'), `expected 'paw' in viewTransition.types despite the stale name, got ${JSON.stringify(vt)}`);
        assert.ok(
          !vt.pseudos.some((p) => p.includes('hero-work')),
          `expected no animation pseudo-element to target hero-work, got ${JSON.stringify(vt.pseudos)}`,
        );
        assert.deepEqual(errors, [], `page/console error(s):\n  ${errors.join('\n  ')}`);
      } finally {
        await context.close();
      }
    });
  });

  describe('craft asset budget (regression tripwire)', () => {
    it('paw-head.js + paw-reveal.js + craft.js + reveals.css combined gz stays under budget', () => {
      const files = [
        'assets/js/paw-head.js',
        'assets/js/paw-reveal.js',
        'assets/js/craft.js',
        'assets/css/reveals.css',
      ];
      const total = files.reduce(
        (sum, f) => sum + zlib.gzipSync(fs.readFileSync(path.join(ROOT, f)), { level: 9 }).length,
        0,
      );
      // Measured 7,184 B on 2026-09-24, after this session's comment trim
      // (qa-round2/budget.mjs has the full per-page picture — the real
      // product requirement is its 12 KB/page budget, which spans every
      // craft-authored byte on a page, not just these four files). 7,900
      // is measured + ~10%: a tripwire against these specific files
      // re-bloating, not a limit to design against.
      assert.ok(total <= 7900, `craft files' combined gz grew to ${total} B (budget 7,900 B, measured 7,184 B + ~10%)`);
    });
  });
});
