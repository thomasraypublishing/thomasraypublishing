'use strict';
/* routes.test.js — every public route, at 1280 and 375, renders cleanly:
   no page/console errors, no horizontal overflow, a settled motion state,
   and 0 axe violations across wcag2a/wcag2aa/wcag21aa/wcag22aa/best-practice.
   Also a JS-disabled pass for the shared-nav pages, and the coverage guard
   that keeps a new route from ever shipping outside this manifest.

   This absorbs and generalizes the `static`, `nojs`, and part of the
   `reflow` sections of Research/reviews/2026-09-05/scripts/probe.cjs — see
   tools/tests/README.md for exactly what did and didn't carry over (the
   320px / doubled-root-font stress variant of `reflow` did not: it
   currently fails against two residual, by-design overflows recorded in
   STATUS.md, so porting it verbatim would make this suite red for a
   decision that's already been made, not a regression). */

const { test, describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { start, stop } = require('./lib/server');
const { launch, newPage, injectAxe, runAxe, AXE_TAGS, settleAnimations } = require('./lib/browser.js');
const { routes } = require('./routes.json');

const ROOT = path.resolve(__dirname, '..', '..');
const WIDTHS = [1280, 375];
// Sub-pixel layout rounding (a fraction of a px from a fractional device
// scale factor) is not the W04 reflow bug this guards against.
const OVERFLOW_TOLERANCE = 1;

/** Every tracked *.html file, repo-root-relative with forward slashes. */
function trackedHtmlFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '*.html'], { cwd: ROOT, encoding: 'utf8' });
    return out.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    // Not a git checkout (or git unavailable) — fall back to a filesystem walk.
    const results = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(abs);
        else if (entry.isFile() && entry.name.endsWith('.html')) {
          results.push(path.relative(ROOT, abs).split(path.sep).join('/'));
        }
      }
    })(ROOT);
    return results;
  }
}

test('routes.json covers every public route (tracked *.html, except tools/og-card.html)', () => {
  const tracked = trackedHtmlFiles()
    .filter((p) => p !== 'tools/og-card.html')
    .sort();
  const manifest = routes.map((r) => r.path).sort();
  const trackedOnly = tracked.filter((p) => !manifest.includes(p));
  const manifestOnly = manifest.filter((p) => !tracked.includes(p));
  assert.deepEqual(
    { trackedOnly, manifestOnly },
    { trackedOnly: [], manifestOnly: [] },
    'tools/tests/routes.json is out of sync with the tracked HTML files — a new public route must be added ' +
      'to the manifest before it can ship covered by this suite.',
  );
});

describe('route rendering (Playwright)', () => {
  let site;
  let browser;

  before(async () => {
    site = await start();
    browser = await launch();
  });

  after(async () => {
    await browser.close();
    await stop(site);
  });

  it('renders cleanly at 1280 and 375: no errors, no overflow, settled motion, 0 axe violations', async (t) => {
    for (const route of routes) {
      for (const width of WIDTHS) {
        await t.test(`${route.path} @ ${width}px`, async () => {
          const url = `${site.url}/${route.path}${route.static ? '?static=1' : ''}`;
          const { context, page, errors } = await newPage(browser, site.url, {
            viewport: { width, height: 900 },
          });
          try {
            await page.goto(url, { waitUntil: 'networkidle' });
            // Let a settling transition (e.g. the nav condense check, any
            // load-time class toggle) finish before reading final state.
            await page.waitForTimeout(400);
            await settleAnimations(page);
            await injectAxe(page);
            const [state, axeResults] = await Promise.all([
              page.evaluate(() => ({
                scrollWidth: document.documentElement.scrollWidth,
                motion: document.documentElement.dataset.motion || null,
                animations: document.getAnimations().filter((a) => a.playState === 'running').length,
              })),
              runAxe(page, AXE_TAGS),
            ]);

            assert.deepEqual(errors, [], `page/console error(s):\n  ${errors.join('\n  ')}`);

            const overflow = state.scrollWidth - width;
            assert.ok(
              overflow <= OVERFLOW_TOLERANCE,
              `overflows by ${overflow}px (scrollWidth=${state.scrollWidth}, viewport=${width}, motion=${state.motion})`,
            );

            assert.equal(
              state.animations,
              0,
              `${state.animations} running animation(s) in what should be a settled state (motion=${state.motion})`,
            );

            if (axeResults.violations.length) {
              const report = axeResults.violations
                .map((v) => {
                  const targets = v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ');
                  return `  [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node(s): ${targets})`;
                })
                .join('\n');
              assert.fail(`${axeResults.violations.length} axe violation(s):\n${report}`);
            }
          } finally {
            await context.close();
          }
        });
      }
    }
  });

  it('JS disabled: shared-nav routes show the primary links, not the Menu button (375px)', async (t) => {
    const navRoutes = routes.filter((r) => r.sharedNav);
    assert.ok(navRoutes.length > 0, 'no sharedNav routes found in routes.json — manifest looks wrong');

    for (const route of navRoutes) {
      await t.test(route.path, async () => {
        const { context, page, errors } = await newPage(browser, site.url, {
          viewport: { width: 375, height: 812 },
          javaScriptEnabled: false,
        });
        try {
          await page.goto(`${site.url}/${route.path}`, { waitUntil: 'networkidle' });
          const result = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('nav.top .navlinks a'));
            const menuBtn = document.getElementById('menu-btn');
            return {
              linkCount: links.length,
              linksVisible: links.length > 0 && links.every((a) => a.getClientRects().length > 0),
              menuBtnVisible: Boolean(menuBtn) && menuBtn.getClientRects().length > 0,
            };
          });
          assert.deepEqual(errors, [], `page/console error(s) with JS disabled:\n  ${errors.join('\n  ')}`);
          assert.ok(result.linkCount > 0, 'no primary nav links (nav.top .navlinks a) found with JS disabled');
          assert.ok(result.linksVisible, 'not every primary nav link is visible with JS disabled');
          assert.equal(result.menuBtnVisible, false, '#menu-btn is visible with JS disabled (nojs.css should hide it)');
        } finally {
          await context.close();
        }
      });
    }
  });
});
