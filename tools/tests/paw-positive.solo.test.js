'use strict';
/* paw-positive.solo.test.js — the one paw-reveal assertion that needs a
   real, live cross-document view-transition grant from the browser: that
   a push navigation under full motion actually arms 'paw'. Split out of
   behavior.test.js's "paw" describe block (where the four negative-gating
   cases still live — they're reliably single-attempt, since "no
   transition granted at all" is itself a valid pass there) and given its
   own `node --test` invocation in package.json's "test" script, run AFTER
   the main concurrent batch rather than inside it.

   Why: node:test runs separate *.test.js files concurrently by default,
   and every file in this suite is Playwright-heavy. Chromium only
   actually grants a cross-document view-transition opt-in on a minority
   of same-origin navigations under that concurrent load — measured
   reliable in isolation (9/10 and 10/10 across runs against both this
   repo's no-store server and a plain server), so the feature itself is
   not flaky; contention from sibling test files is. lib/paw.js's bounded
   retry (5 fresh-page attempts) absorbs ordinary variance, but running
   this file on its own — not concurrently with behavior/cta/game/links/
   modules/reset/routes — removes the contention that made even 5 retries
   insufficient in roughly half of a small sample of full `npm test` runs
   during development.

   Everything else about this test (why a `pagereveal` capture listener
   must read event.viewTransition.types only after event.viewTransition.
   ready, why no context.route() network policy, the benign
   "ViewTransition opt-in disabled" console line) is documented once in
   lib/paw.js, shared with behavior.test.js's negative cases. */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop } = require('./lib/server');
const { launch } = require('./lib/browser.js');
const { newLocalPage, withCaptureInstalled, pushToPrivacyRetrying, realErrors } = require('./lib/paw.js');

describe('paw (isolated, run after the concurrent batch): push nav, motion full', () => {
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

  it('arriving page gets the paw type; origin key is cleared', async () => {
    const { context, errors } = await newLocalPage(browser);
    try {
      await withCaptureInstalled(context);
      const { cap, pawOrigin } = await pushToPrivacyRetrying(site, context);
      assert.ok(cap.hasVT, 'expected a cross-document viewTransition on arrival under full motion (after retries)');
      assert.ok(cap.types.includes('paw'), `expected 'paw' in viewTransition.types, got ${JSON.stringify(cap.types)}`);
      assert.equal(pawOrigin, null, 'trp-paw-origin should be cleared after arrival');
      assert.deepEqual(realErrors(errors), [], `page/console error(s):\n  ${realErrors(errors).join('\n  ')}`);
    } finally {
      await context.close();
    }
  });
});
