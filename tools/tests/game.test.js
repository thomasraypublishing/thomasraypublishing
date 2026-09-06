'use strict';
/* game.test.js — W09: restarting The Device's memory challenge always
   yields exactly one active sequence, never two racing ones. Ported from
   Research/reviews/2026-09-05/scripts/game-race.cjs. Runs in both
   ?static=1 (deterministic timings) and normal mode. */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop } = require('./lib/server');
const { launch, newPage } = require('./lib/browser');

const MODES = ['?static=1', ''];

describe('game.test.js — The Device restart race (Playwright)', () => {
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

  for (const mode of MODES) {
    describe(`mode: ${mode || 'normal'}`, () => {
      let context;
      let page;
      let errors;

      before(async () => {
        ({ context, page, errors } = await newPage(browser, site.url, { viewport: { width: 1280, height: 900 } }));
        await page.goto(`${site.url}/thedevice/index.html${mode}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => {
          window.__probe = { lit: [], status: [] };
          const bricks = [...document.querySelectorAll('#challenge-board .brick')];
          new MutationObserver((ms) =>
            ms.forEach((m) => {
              if (m.attributeName === 'class' && m.target.classList.contains('lit')) {
                window.__probe.lit.push(bricks.indexOf(m.target));
              }
            }),
          ).observe(document.getElementById('challenge-board'), { attributes: true, subtree: true, attributeFilter: ['class'] });
          new MutationObserver(() => window.__probe.status.push(document.getElementById('challenge-status').textContent)).observe(
            document.getElementById('challenge-status'),
            { childList: true, characterData: true, subtree: true },
          );
        });
        await page.evaluate(() => document.getElementById('challenge-start').scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(1200);
      });

      after(async () => {
        await context.close();
      });

      const reset = () => page.evaluate(() => { window.__probe.lit = []; window.__probe.status = []; });
      const read = () =>
        page.evaluate(() => ({
          lit: window.__probe.lit,
          watch: window.__probe.status.filter((s) => /watch/.test(s)).length,
          turn: window.__probe.status.filter((s) => /your turn/.test(s)).length,
          litStuck: [...document.querySelectorAll('#challenge-board .brick.lit')].length,
          enabled: [...document.querySelectorAll('#challenge-board .brick')].filter((b) => !b.disabled).length,
          total: document.querySelectorAll('#challenge-board .brick').length,
        }));
      const playFull = 700 + 3 * (mode ? 420 : 720) + 400; // generous

      function assertClean(label, r, expectLit) {
        assert.equal(r.watch, 1, `${label}: expected exactly 1 "watch" announcement, got ${r.watch}`);
        assert.equal(r.turn, 1, `${label}: expected exactly 1 "your turn" announcement, got ${r.turn}`);
        assert.equal(r.lit.length, expectLit, `${label}: expected ${expectLit} lit stone(s), got ${r.lit.length}`);
        assert.equal(r.litStuck, 0, `${label}: ${r.litStuck} stone(s) stuck lit after the round settled`);
        assert.equal(r.enabled, r.total, `${label}: only ${r.enabled}/${r.total} stones are enabled after the round settled`);
      }

      it('restart mid-playback (after the first stone lights)', async () => {
        await page.click('#challenge-start');
        await page.waitForTimeout(1000);
        await reset();
        await page.click('#challenge-start');
        await page.waitForTimeout(playFull);
        assertClean('restart mid-playback', await read(), 3);
      });

      it('solve round 1, restart inside the 900ms success delay', async () => {
        const seq = await page.evaluate(() => window.__probe.lit.slice(0, 3));
        for (const i of seq) {
          await page.locator('#challenge-board .brick').nth(i).click();
          await page.waitForTimeout(40);
        }
        await page.waitForTimeout(250);
        await reset();
        await page.click('#challenge-start');
        await page.waitForTimeout(playFull);
        assertClean('restart in success delay', await read(), 3);
      });

      it('wrong answer, restart inside the 1000ms retry delay', async () => {
        const seq = await page.evaluate(() => window.__probe.lit.slice(0, 3));
        const wrong = [...Array(20).keys()].find((i) => i !== seq[0]);
        await page.locator('#challenge-board .brick').nth(wrong).click();
        await page.waitForTimeout(300);
        await reset();
        await page.click('#challenge-start');
        await page.waitForTimeout(playFull);
        assertClean('restart in retry delay', await read(), 3);
      });

      it('five rapid restarts collapse to exactly one active session', async () => {
        await reset();
        for (let i = 0; i < 5; i++) {
          await page.click('#challenge-start');
          await page.waitForTimeout(60);
        }
        await page.waitForTimeout(playFull);
        const r = await read();
        // Five sessions each announce "watch" synchronously; only the last
        // may reach "your turn" and light stones.
        assert.equal(r.turn, 1, `expected exactly 1 "your turn" announcement, got ${r.turn}`);
        assert.equal(r.lit.length, 3, `expected 3 lit stone(s), got ${r.lit.length}`);
        assert.equal(r.litStuck, 0, `${r.litStuck} stone(s) stuck lit after five rapid restarts`);
        assert.equal(r.enabled, r.total, `only ${r.enabled}/${r.total} stones enabled after five rapid restarts`);
      });

      it('no page errors occurred during this mode', () => {
        assert.deepEqual(errors, [], `page/console error(s) in mode ${mode || 'normal'}:\n  ${errors.join('\n  ')}`);
      });
    });
  }
});
