'use strict';
/* behavior.test.js — the interactive/motion assertions ported from
   Research/reviews/2026-09-05/scripts/probe.cjs's `blocked`, `menu`,
   `gate`, `live`, `paused`, and `quiet` sections.

   Note on `menu`: probe.cjs asserted an exact Tab sequence (Menu button,
   then each overlay link). assets/js/nav.js has since grown a dedicated
   in-dialog Close button (the focus cycle is now Close -> links -> Close,
   not Menu-button -> links), which is a real, deliberate accessibility
   improvement landing in this same working tree while this suite was
   built — not something this ticket's tests should freeze against the
   older shape. So this file asserts the invariant probe.cjs actually cared
   about (a focus trap that never leaks tab focus outside the dialog, plus
   role=dialog, inert, Escape, and the #books hash) rather than a literal
   element-by-element sequence, which stays true across that kind of
   internal refactor by construction. */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop } = require('./lib/server');
const { launch, newPage } = require('./lib/browser');

const LANDINGS = [
  'index.html',
  'hush-hush-snap-snap/index.html',
  'pomagotchi/index.html',
  'thedevice/index.html',
  'trade-rc/index.html',
];

describe('behavior (Playwright)', () => {
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

  describe('blocked: the menu works independently of Three.js, ScrollTrigger, and GSAP', () => {
    const cases = [
      ['three', '**/three.module.min.js'],
      ['scrolltrigger', '**/ScrollTrigger.min.js'],
      ['gsap', '**/gsap.min.js'],
    ];
    for (const [name, pattern] of cases) {
      it(`menu still opens with ${name} aborted`, async () => {
        // pageErrors only, not the combined `errors`: deliberately aborting
        // a resource makes Chromium log its own "Failed to load resource"
        // console message, which is an expected side effect of this test's
        // own abort, not a sign that the site's code broke. An uncaught JS
        // exception (a real "gsap is not defined" failure) would show up as
        // a pageerror regardless.
        const { context, page, pageErrors } = await newPage(browser, site.url, {
          viewport: { width: 375, height: 812 },
        });
        try {
          await page.route(pattern, (route) => route.abort());
          await page.goto(`${site.url}/index.html`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(600);
          await page.locator('#menu-btn').click();
          await page.waitForTimeout(400);
          const expanded = await page.locator('#menu-btn').getAttribute('aria-expanded');
          const overlayVisible = await page.locator('#menu-overlay').isVisible();
          assert.deepEqual(pageErrors, [], `uncaught page error(s) with ${name} blocked:\n  ${pageErrors.join('\n  ')}`);
          assert.equal(expanded, 'true', `#menu-btn aria-expanded should be "true" with ${name} blocked`);
          assert.ok(overlayVisible, `#menu-overlay should be visible with ${name} blocked`);
        } finally {
          await context.close();
        }
      });
    }
  });

  describe('menu: focus-contained dialog on index.html', () => {
    it('never leaks Tab focus outside the dialog, applies/clears inert, Escape closes, #books sets the hash', async () => {
      const { context, page, errors } = await newPage(browser, site.url, {
        viewport: { width: 375, height: 812 },
      });
      try {
        await page.goto(`${site.url}/index.html?static=1`, { waitUntil: 'networkidle' });
        await page.locator('#menu-btn').click();
        await page.waitForTimeout(300);

        const overlayAttrs = await page.evaluate(() => {
          const o = document.getElementById('menu-overlay');
          return { role: o.getAttribute('role'), modal: o.getAttribute('aria-modal'), label: o.getAttribute('aria-label') };
        });
        assert.equal(overlayAttrs.role, 'dialog');
        assert.equal(overlayAttrs.modal, 'true');
        assert.ok(overlayAttrs.label, 'menu-overlay should have an aria-label');

        const inertCountWhileOpen = await page.evaluate(() => document.querySelectorAll('[inert]').length);
        assert.ok(inertCountWhileOpen > 0, 'opening the menu should mark background content inert');

        // Tab around generously; at every step, focus must stay inside the
        // dialog's own controls (its Close button, if any, plus its links)
        // — never escape to the Menu button, the page body, or nowhere.
        const escapes = [];
        for (let i = 0; i < 16; i++) {
          const snap = await page.evaluate(() => {
            const overlay = document.getElementById('menu-overlay');
            const a = document.activeElement;
            const insideDialog = overlay.contains(a) && a !== overlay;
            return { insideDialog, tag: a.tagName, id: a.id || null, text: (a.textContent || '').trim().slice(0, 24) };
          });
          if (!snap.insideDialog) escapes.push(`step ${i}: ${snap.tag}#${snap.id} "${snap.text}"`);
          await page.keyboard.press('Tab');
        }
        assert.deepEqual(escapes, [], `Tab focus escaped the dialog:\n  ${escapes.join('\n  ')}`);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        const afterEsc = await page.evaluate(() => ({
          activeIsMenuBtn: document.activeElement === document.getElementById('menu-btn'),
          expanded: document.getElementById('menu-btn').getAttribute('aria-expanded'),
          overlayShown: getComputedStyle(document.getElementById('menu-overlay')).display !== 'none',
          inertLeft: document.querySelectorAll('[inert]').length,
        }));
        assert.equal(afterEsc.expanded, 'false', 'Escape should set aria-expanded="false"');
        assert.equal(afterEsc.overlayShown, false, 'Escape should hide the overlay');
        assert.equal(afterEsc.inertLeft, 0, 'Escape should clear every [inert] left over from the open dialog');
        assert.ok(afterEsc.activeIsMenuBtn, 'Escape should return focus to #menu-btn');

        await page.locator('#menu-btn').click();
        await page.waitForTimeout(300);
        await page.locator('#menu-overlay a[href="#books"]').click();
        await page.waitForTimeout(1200);
        const afterLink = await page.evaluate(() => ({
          hash: location.hash,
          expanded: document.getElementById('menu-btn').getAttribute('aria-expanded'),
          inertLeft: document.querySelectorAll('[inert]').length,
        }));
        assert.equal(afterLink.hash, '#books', 'choosing the Books link should set the URL hash to #books');
        assert.equal(afterLink.expanded, 'false', 'choosing a link should close the menu');
        assert.equal(afterLink.inertLeft, 0, 'choosing a link should leave no [inert] behind');

        assert.deepEqual(errors, [], `page/console error(s) during the menu sequence:\n  ${errors.join('\n  ')}`);
      } finally {
        await context.close();
      }
    });
  });

  describe('gate: Hush Hush Snap Snap only animates in html[data-motion="full"]', () => {
    it('ring/capture/hero animations and scroll-behavior key off data-motion', async () => {
      const { context, page, errors } = await newPage(browser, site.url, {
        viewport: { width: 1280, height: 900 },
      });
      try {
        await page.goto(`${site.url}/hush-hush-snap-snap/index.html`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(800);
        for (const state of ['(absent)', 'static', 'reduced', 'paused', 'full']) {
          const result = await page.evaluate((st) => {
            if (st === '(absent)') delete document.documentElement.dataset.motion;
            else document.documentElement.dataset.motion = st;
            const ring = document.querySelector('.dot-field .ring.r1');
            const cap = document.querySelector('img.capture');
            const hero = document.querySelector('.hero-photo img');
            return {
              ring: getComputedStyle(ring).animationName,
              capture: getComputedStyle(cap).animationName,
              hero: getComputedStyle(hero).animationName,
              scroll: getComputedStyle(document.documentElement).scrollBehavior,
            };
          }, state);
          if (state === 'full') {
            assert.notEqual(result.ring, 'none', `ring should animate when data-motion="full"`);
            assert.notEqual(result.capture, 'none', `img.capture should animate when data-motion="full"`);
            assert.notEqual(result.hero, 'none', `hero photo should animate when data-motion="full"`);
            assert.equal(result.scroll, 'smooth', `scroll-behavior should be smooth when data-motion="full"`);
          } else {
            assert.equal(result.ring, 'none', `ring should be settled when data-motion=${JSON.stringify(state)}`);
            assert.equal(result.capture, 'none', `img.capture should be settled when data-motion=${JSON.stringify(state)}`);
            assert.equal(result.hero, 'none', `hero photo should be settled when data-motion=${JSON.stringify(state)}`);
            assert.equal(result.scroll, 'auto', `scroll-behavior should be auto when data-motion=${JSON.stringify(state)}`);
          }
        }
        assert.deepEqual(errors, [], `page/console error(s) during the gate sequence:\n  ${errors.join('\n  ')}`);
      } finally {
        await context.close();
      }
    });
  });

  describe('live: prefers-reduced-motion settles every landing without a reload', () => {
    for (const route of LANDINGS) {
      it(route, async () => {
        const { context, page, errors } = await newPage(browser, site.url, {
          viewport: { width: 1280, height: 900 },
        });
        try {
          await page.goto(`${site.url}/${route}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(1500);
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.waitForTimeout(700);
          const after = await page.evaluate(() => ({
            motion: document.documentElement.dataset.motion || null,
            animations: document.getAnimations().filter((a) => a.playState === 'running').length,
          }));
          assert.deepEqual(errors, [], `page/console error(s) on ${route}:\n  ${errors.join('\n  ')}`);
          assert.equal(after.motion, 'reduced', `${route}: data-motion should read "reduced" under prefers-reduced-motion`);
          assert.equal(after.animations, 0, `${route}: ${after.animations} running animation(s) after switching to Reduce Motion`);
        } finally {
          await context.close();
        }
      });
    }
  });

  describe('paused: a stored pause from localStorage applies before first paint', () => {
    for (const route of ['index.html', 'hush-hush-snap-snap/index.html', 'thedevice/index.html']) {
      it(route, async () => {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const errors = [];
        try {
          await context.addInitScript(() => {
            try {
              window.localStorage.setItem('trp-motion', 'paused');
            } catch {
              /* private mode: nothing to seed, the assertion below will just fail loudly */
            }
          });
          await context.route('**/*', (route_) => {
            const url = route_.request().url();
            if (url.startsWith('data:')) return route_.continue();
            let origin;
            try {
              origin = new URL(url).origin;
            } catch {
              return route_.abort();
            }
            return origin === site.url ? route_.continue() : route_.abort();
          });
          const page = await context.newPage();
          page.on('pageerror', (err) => errors.push(err.message || String(err)));
          page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
          });
          await page.goto(`${site.url}/${route}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(1500);
          const state = await page.evaluate(() => ({
            motion: document.documentElement.dataset.motion || null,
            animations: document.getAnimations().filter((a) => a.playState === 'running').length,
          }));
          assert.deepEqual(errors, [], `page/console error(s) on ${route}:\n  ${errors.join('\n  ')}`);
          assert.equal(state.motion, 'paused', `${route}: data-motion should read "paused" from the stored preference`);
          assert.equal(state.animations, 0, `${route}: ${state.animations} running animation(s) despite the stored pause`);
        } finally {
          await context.close();
        }
      });
    }
  });

  describe('quiet: the "Pause motion" / "Play motion" control', () => {
    for (const route of LANDINGS) {
      it(route, async () => {
        const { context, page, errors } = await newPage(browser, site.url, {
          viewport: { width: 1280, height: 900 },
        });
        try {
          await page.goto(`${site.url}/${route}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(1200);

          const snap = () =>
            page.evaluate(() => {
              const b = document.querySelector('[data-motion-toggle]');
              const st = document.querySelector('[role="status"]');
              return {
                present: Boolean(b),
                hidden: b ? b.hidden : null,
                label: b ? b.querySelector('.lbl')?.textContent : null,
                animations: document.getAnimations().filter((a) => a.playState === 'running').length,
                status: st ? st.textContent : null,
                stored: (() => {
                  try {
                    return window.localStorage.getItem('trp-motion');
                  } catch {
                    return 'n/a';
                  }
                })(),
              };
            });

          const normal = await snap();
          assert.ok(normal.present, `${route}: [data-motion-toggle] not found`);
          assert.equal(normal.hidden, false, `${route}: toggle should be visible under full motion`);
          assert.equal(normal.label, 'Pause motion', `${route}: toggle should read "Pause motion" before it's clicked`);

          await page.click('[data-motion-toggle]');
          await page.waitForTimeout(500);
          const afterPause = await snap();
          assert.equal(afterPause.label, 'Play motion', `${route}: label should flip to "Play motion" once paused`);
          assert.equal(afterPause.animations, 0, `${route}: ${afterPause.animations} running animation(s) after pausing`);
          assert.equal(afterPause.stored, 'paused', `${route}: the pause should be remembered in localStorage`);
          assert.ok(afterPause.status && afterPause.status.length > 0, `${route}: the live status region should announce the change`);

          await page.reload({ waitUntil: 'networkidle' });
          await page.waitForTimeout(1200);
          const afterReload = await snap();
          assert.equal(afterReload.label, 'Play motion', `${route}: the pause should survive a reload`);
          assert.equal(afterReload.animations, 0, `${route}: ${afterReload.animations} running animation(s) after reload while paused`);

          await page.click('[data-motion-toggle]');
          await page.waitForTimeout(500);
          const afterResume = await snap();
          assert.equal(afterResume.label, 'Pause motion', `${route}: label should flip back after resuming`);
          assert.equal(afterResume.stored, null, `${route}: resuming should clear the stored preference`);

          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.waitForTimeout(300);
          const underReduce = await snap();
          assert.equal(underReduce.hidden, true, `${route}: toggle should hide under Reduce Motion — nothing left to pause`);

          assert.deepEqual(errors, [], `page/console error(s) on ${route}:\n  ${errors.join('\n  ')}`);
        } finally {
          await context.close();
        }
      });
    }

    it('hides under ?static=1, and meets the 44x44 minimum target at 375 and 320', async () => {
      for (const route of LANDINGS) {
        {
          const { context, page } = await newPage(browser, site.url, { viewport: { width: 375, height: 812 } });
          try {
            await page.goto(`${site.url}/${route}?static=1`, { waitUntil: 'networkidle' });
            await page.waitForTimeout(500);
            const hidden = await page.evaluate(() => document.querySelector('[data-motion-toggle]')?.hidden ?? null);
            assert.equal(hidden, true, `${route}: toggle should be hidden under ?static=1`);
          } finally {
            await context.close();
          }
        }
        for (const width of [375, 320]) {
          const { context, page } = await newPage(browser, site.url, { viewport: { width, height: 812 } });
          try {
            await page.goto(`${site.url}/${route}`, { waitUntil: 'networkidle' });
            await page.waitForTimeout(800);
            const size = await page.evaluate(() => {
              const b = document.querySelector('[data-motion-toggle]');
              const r = b.getBoundingClientRect();
              return { width: r.width, height: r.height };
            });
            assert.ok(size.width >= 44, `${route}@${width}: toggle width ${size.width}px is under the 44px minimum`);
            assert.ok(size.height >= 44, `${route}@${width}: toggle height ${size.height}px is under the 44px minimum`);
          } finally {
            await context.close();
          }
        }
      }
    });
  });
});
