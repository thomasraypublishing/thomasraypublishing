'use strict';
/* craft.test.js — regression coverage for the craft-pass fixes from the
   2026-09-23 QA rounds 2 and 3 (see Research/reviews/2026-09-23-craft-pass/
   qa-round2/REPORT.md and qa-round3/REPORT.md): the GSAP-vs-CSS-transition
   conflict that left the home specimens and books/stickers stuck
   mid-reveal (HIGH-1/MEDIUM-1, round 2), the craft-fade cleanup contract,
   paw/hero-work exclusivity after a bfcache restore (LOW-2), the per-page
   asset budget (LOW-1, round 2), and the round-3 MEDIUM-1/MEDIUM-2 fix:
   every full-motion `transition` shorthand that used to replace an
   element's whole pre-existing transition list now carries the union of
   that list and the craft additions instead.

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

/** The live transition timing for every property a `transition` shorthand
    actually eases right now, keyed by property name — every entry whose
    paired duration is > 0 (a 0s entry is present in the list but inert).
    Duration/timing-function/delay are included, not just the property
    name: a name-only check would still pass if a duration silently
    shrank from 1.2s to 0.01s, which is exactly the QA round-4 LOW-3
    finding this replaces. */
async function liveTransitionDetails(page, selector) {
  return page.evaluate((sel) => {
    // Split each computed-style list on top-level commas only —
    // transitionTimingFunction's own values are function calls
    // (`cubic-bezier(0.2, 0.7, 0.2, 1)`) whose internal commas a plain
    // split(',') would wrongly treat as separators between properties.
    // Defined inline (not shared with a Node-side helper) because
    // page.evaluate serializes this callback to run inside the browser,
    // which can't close over a function defined in this process.
    const splitTopLevel = (s) => {
      const out = []; let depth = 0; let cur = '';
      for (const ch of s) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      out.push(cur.trim());
      return out;
    };
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const props = splitTopLevel(cs.transitionProperty);
    const durations = splitTopLevel(cs.transitionDuration);
    const timingFunctions = splitTopLevel(cs.transitionTimingFunction);
    const delays = splitTopLevel(cs.transitionDelay);
    const out = {};
    props.forEach((prop, i) => {
      const duration = durations[i % durations.length];
      if (parseFloat(duration) > 0) {
        out[prop] = {
          duration,
          timingFunction: timingFunctions[i % timingFunctions.length],
          delay: delays[i % delays.length],
        };
      }
    });
    return out;
  }, selector);
}

/** Do two timing triples match exactly? */
function timingMatches(live, baseline) {
  return live
    && live.duration === baseline.duration
    && live.timingFunction === baseline.timingFunction
    && live.delay === baseline.delay;
}

/** Does `live` (a map of property -> {duration, timingFunction, delay})
    still hold a baseline property's exact timing? A bare name match with
    identical timing counts, as does the `all` keyword covering every
    value.
    `.book .cover`'s `transform` baseline is the one deliberate, lead-
    approved exception: the craft pass splits a hover/press `transform`
    into independent `translate` + `rotate` properties so a GSAP-driven
    `transform` reveal on the same element can't fight the transition
    (see reveals.js's `clearProps` comment). That split is satisfied only
    when BOTH `translate` and `rotate` are live and BOTH carry the exact
    timing the pre-craft `transform` baseline recorded — the split must
    preserve the original motion, not merely exist. */
function satisfiesBaseline(live, baselineProp, baselineTiming) {
  if (!live) return false;
  if (live.all && timingMatches(live.all, baselineTiming)) return true;
  if (live[baselineProp] && timingMatches(live[baselineProp], baselineTiming)) return true;
  if (
    baselineProp === 'transform'
    && timingMatches(live.translate, baselineTiming)
    && timingMatches(live.rotate, baselineTiming)
  ) {
    return true;
  }
  return false;
}

/** trade-rc/index.html's `<script type="speculationrules">` prefetch hint
    is Chromium-only; WebKit logs a console error trying to parse it
    against this test server's plain http://127.0.0.1 origin ("URL must be
    secure (HTTPS)"). Pre-existing on the live site too (an http-vs-https
    engine limitation, not something any fix in this file touches), so
    it's the one console message these tests ignore rather than folding
    into every future WebKit run's noise. */
function isBenignSpeculationRulesWarning(msg) {
  return msg === 'Prefetch request denied: URL must be secure (HTTPS)';
}
function realErrorsOnly(errors) {
  return errors.filter((e) => !isBenignSpeculationRulesWarning(e));
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
    // Close whatever launched, and always stop the server: a failed launch in
    // before() must not leave the server holding the event loop open (that
    // hung CI for six hours when WebKit wasn't installed on the runner).
    try {
      await Promise.allSettled([chromiumBrowser?.close(), webkitBrowser?.close()]);
    } finally {
      await stop(site);
    }
  });

  describe('full motion: GSAP reveals settle to identity instead of fighting the craft press/lift transitions', () => {
    async function assertSettled(browser, { scrollTo, selector, waitMs }) {
      const { context, page, errors } = await newPage(browser, site.url, { viewport: VIEWPORT });
      try {
        await page.goto(`${site.url}/index.html`, { waitUntil: 'networkidle' });
        if (scrollTo) {
          await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' }), scrollTo);
        }
        // Poll for rest rather than sleeping a fixed time: slower CI runners
        // can still be mid-tween at waitMs (seen: a sticker at scale 1.0079,
        // y -0.88 on ubuntu WebKit). The regression this guards left elements
        // stuck forever, so a generous deadline still catches it.
        await page.waitForTimeout(waitMs);
        await page.waitForFunction((sel) => [...document.querySelectorAll(sel)].every((el) => {
          const cs = getComputedStyle(el);
          return (cs.transform === 'none' || cs.transform === 'matrix(1, 0, 0, 1, 0, 0)') && cs.opacity === '1';
        }), selector, { timeout: 7000, polling: 100 }).catch(() => { /* fall through to the precise assertions below */ });
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

  describe('press feedback and hover-lift are real, not just present in the CSS (QA round 3 LOW-1: the prior version of this test passed even with the clearProps fix reverted, since it only checked that a GSAP reveal settles to an identity transform, never that press/hover actually still moves anything)', () => {
    const cases = [
      { path: 'index.html', selector: '.specimens .specimen' },
      { path: 'index.html', selector: '.catalog .book', liftSelector: '.catalog .book .cover', scrollTo: '.catalog' },
      { path: 'index.html', selector: '.stickers .stk', scrollTo: '.stickers' },
      { path: 'pomagotchi/index.html', selector: '.card', scrollTo: '.card' },
      { path: 'thedevice/index.html', selector: '.instrument', scrollTo: '.instrument' },
      { path: 'thedevice/index.html', selector: '.plan', scrollTo: '.plan' },
      { path: 'trade-rc/index.html', selector: '.tier', scrollTo: '.tier' },
    ];

    async function assertPressAndLift(browser, { path: route, selector, liftSelector, scrollTo }) {
      const { context, page, errors } = await newPage(browser, site.url, { viewport: VIEWPORT });
      try {
        await page.goto(`${site.url}/${route}`, { waitUntil: 'networkidle' });
        if (scrollTo) {
          await page.evaluate(
            (sel) => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' }),
            scrollTo,
          );
        }
        await page.waitForTimeout(2500); // the per-card reveal + its clearProps settle in this window

        // GSAP's clearProps hands the inline scale/translate/rotate it drove
        // back to the stylesheet once the reveal finishes — if a future edit
        // drops `clearProps` (or narrows it), a stale inline value would pin
        // the property and every check below would still pass for the wrong
        // reason (an inline value always wins over a CSS one), so this has
        // to be checked on its own.
        const inline = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return { translate: el.style.translate, scale: el.style.scale, rotate: el.style.rotate };
        }, selector);
        assert.equal(inline.translate, '', `${route} ${selector}: expected no inline translate left by GSAP, got "${inline.translate}"`);
        assert.equal(inline.scale, '', `${route} ${selector}: expected no inline scale left by GSAP, got "${inline.scale}"`);
        assert.equal(inline.rotate, '', `${route} ${selector}: expected no inline rotate left by GSAP, got "${inline.rotate}"`);

        // Hover actually lifts (computed `translate` changes).
        const lift = liftSelector || selector;
        const restTranslate = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).translate, lift);
        const box = await page.locator(selector).first().boundingBox();
        await page.mouse.move(2, 2);
        await page.waitForTimeout(100);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(500);
        const hoverTranslate = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).translate, lift);
        assert.notEqual(
          hoverTranslate, restTranslate,
          `${route} ${lift}: expected computed translate to change on hover (stayed ${restTranslate})`,
        );

        // Pressing actually presses (computed `scale` changes on :active).
        const restScale = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).scale, selector);
        await page.mouse.down();
        await page.waitForTimeout(150);
        const pressedScale = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).scale, selector);
        await page.mouse.up();
        assert.notEqual(
          pressedScale, restScale,
          `${route} ${selector}: expected computed scale to change on :active (stayed ${restScale})`,
        );

        const realErrors = realErrorsOnly(errors);
        assert.deepEqual(realErrors, [], `page/console error(s):\n  ${realErrors.join('\n  ')}`);
      } finally {
        await context.close();
      }
    }

    for (const c of cases) {
      it(`${c.path} ${c.selector}: settles clean, lifts on hover, presses on :active — Chromium`, async () => {
        await assertPressAndLift(chromiumBrowser, c);
      });
      it(`${c.path} ${c.selector}: settles clean, lifts on hover, presses on :active — WebKit`, async () => {
        await assertPressAndLift(webkitBrowser, c);
      });
    }
  });

  describe('transition preservation (QA round 3 MEDIUM-1/MEDIUM-2 regression tripwire)', () => {
    // fixtures/transitions-baseline.json maps route -> stable element
    // selector -> { property: { duration, timingFunction, delay } } for
    // every property that element transitioned (any duration > 0) on the
    // pre-craft site (commit 0218f30, full motion, 1280 viewport). Timing
    // is recorded, not just the property name (QA round-4 LOW-3: a
    // name-only fixture still passed when a duration silently shrank from
    // 1.2s to 0.01s). Regenerate it only by recording fresh from that
    // commit if the pre-craft site's own behavior changes — never hand-edit
    // it to make a fix look complete, and never regenerate it from the
    // current tree (that would launder away exactly the kind of regression
    // this test exists to catch). A `transform` baseline entry is also
    // satisfied by `translate` + `rotate` together, each carrying that same
    // timing — see satisfiesBaseline above for why that split is
    // intentional, not a loss.
    const fixturePath = path.join(__dirname, 'fixtures', 'transitions-baseline.json');
    const baseline = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    async function assertRouteHoldsBaseline(browser, route, entries) {
      const { context, page, errors } = await newPage(browser, site.url, { viewport: VIEWPORT });
      try {
        await page.goto(`${site.url}/${route}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
        for (const [selector, props] of Object.entries(entries)) {
          const live = await liveTransitionDetails(page, selector);
          assert.ok(live !== null, `${route} ${selector}: element no longer found on the page`);
          for (const [prop, timing] of Object.entries(props)) {
            assert.ok(
              satisfiesBaseline(live, prop, timing),
              `${route} ${selector}: expected '${prop}' (${JSON.stringify(timing)}) to still transition under full motion (pre-craft baseline), got ${JSON.stringify(live)}`,
            );
          }
        }
        const realErrors = realErrorsOnly(errors);
        assert.deepEqual(realErrors, [], `page/console error(s):\n  ${realErrors.join('\n  ')}`);
      } finally {
        await context.close();
      }
    }

    for (const [route, entries] of Object.entries(baseline)) {
      if (Object.keys(entries).length === 0) continue;
      it(`${route}: every pre-craft transitioned property still transitions under full motion — Chromium`, async () => {
        await assertRouteHoldsBaseline(chromiumBrowser, route, entries);
      });
      it(`${route}: every pre-craft transitioned property still transitions under full motion — WebKit`, async () => {
        await assertRouteHoldsBaseline(webkitBrowser, route, entries);
      });
    }
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
