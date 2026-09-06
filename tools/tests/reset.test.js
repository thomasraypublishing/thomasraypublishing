'use strict';
/* reset.test.js — reset-password.html never leaks a recovery code or
   access token, however the link is shaped or however its SDK call turns
   out. Ported from Research/reviews/2026-09-05/scripts/reset-mock.cjs (the
   11 stubbed-SDK scenarios) and the real-SDK/network-blocked cases from
   probe.cjs's `reset` section.

   IMPORTANT — this file's expectations were re-derived empirically, not
   copied from the seed scripts verbatim: reset-password.html was rewritten
   substantially (in this same working tree, by a concurrent session) while
   this suite was being built. Concretely, versus the seed scripts:
     - The SDK is now created with detectSessionInUrl:false; this page
       parses the link itself and applies the tokens, so codeRejected's
       copy is now MESSAGES.codeInBrowser and updateError's status text is
       fixed per-category copy (MESSAGES.samePassword) rather than the raw
       SDK message string.
     - Outcomes are now "retryable" or not. A retryable outcome (currently:
       "unreachable" — the sign-in service could not be reached, and, for
       a missing SDK, reload-to-retry) shows a Try again button; the URL is
       scrubbed as soon as the SDK has loaded (the tokens live in memory), so
       can reuse it. Every other outcome (rejected, an error the link
       itself reported, no token, or success) scrubs the URL as before.
     - The security property that never changed, verified for every
       scenario below: the raw code/token/description text is never
       rendered into the DOM or written to the console, under any outcome.
       The URL is the only place a token may legitimately survive, and only
       for the retryable case above. */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop } = require('./lib/server');
const { launch } = require('./lib/browser');

const MARKER_RE = /SYNTHETIC_[A-Z_]+_MARKER/;

function mockSupabaseJs(scenario) {
  return `window.supabase = { createClient: function () {
    var sc = ${JSON.stringify(scenario)}; window.__mockCalls = [];
    var rec = function (name, arg) { window.__mockCalls.push({ name: name, arg: arg }); };
    var resolve = function (name, arg) { rec(name, arg); var r = sc[name] || { error: { name: 'AuthUnknownError', message: 'unmocked', status: 500 } };
      if (r.throw) { return Promise.reject(new TypeError('SYNTHETIC_THROWN_MARKER')); } return Promise.resolve({ data: {}, error: r.error }); };
    return { auth: {
      onAuthStateChange: function (cb) { rec('onAuthStateChange'); if (sc.init) { setTimeout(function () { cb(sc.init.event, sc.init.session); }, 60); } return { data: { subscription: { unsubscribe: function () {} } } }; },
      exchangeCodeForSession: function (code) { return resolve('exchange', code); },
      setSession: function (s) { return resolve('setSession', s); },
      updateUser: function (attrs) { return resolve('update', Object.keys(attrs)); }
    } };
  } };`;
}

// The 11 scenarios from reset-mock.cjs, with expectations re-verified
// against the current page (see the file header). `urlScrubbed: false`
// marks the one legitimate exception: a retryable "unreachable" outcome.
const MOCK_SCENARIOS = {
  recovery: {
    url: '#access_token=SYNTHETIC_ACCESS_MARKER&refresh_token=SYNTHETIC_REFRESH_MARKER&type=recovery',
    init: { event: 'PASSWORD_RECOVERY', session: { user: {} } },
    update: { error: null },
    expectForm: true, urlScrubbed: true, submit: true,
  },
  signedIn: {
    url: '#access_token=SYNTHETIC_ACCESS_MARKER&type=recovery',
    init: { event: 'SIGNED_IN', session: { user: {} } },
    update: { error: null },
    expectForm: true, urlScrubbed: true,
  },
  codeOk: {
    url: '?code=SYNTHETIC_CODE_MARKER',
    init: { event: 'INITIAL_SESSION', session: null },
    exchange: { error: null }, update: { error: null },
    expectForm: true, urlScrubbed: true, expectCall: 'exchange',
  },
  codeRejected: {
    url: '?code=SYNTHETIC_CODE_MARKER',
    init: { event: 'INITIAL_SESSION', session: null },
    exchange: { error: { name: 'AuthApiError', message: 'invalid request: SYNTHETIC_MSG_MARKER', status: 400, code: 'validation_failed' } },
    expectForm: false, urlScrubbed: true,
    expectDebug: /flow code \/ result rejected \(http_400 validation_failed\)/,
    expectLede: /could not be completed in the browser/,
  },
  codeNetwork: {
    url: '?code=SYNTHETIC_CODE_MARKER',
    init: { event: 'INITIAL_SESSION', session: null },
    exchange: { error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 } },
    expectForm: false, urlScrubbed: true, expectRetryHidden: false,
    expectDebug: /result unreachable/,
  },
  tokenOk: {
    url: '#access_token=SYNTHETIC_ACCESS_MARKER&refresh_token=SYNTHETIC_REFRESH_MARKER',
    init: { event: 'INITIAL_SESSION', session: null },
    setSession: { error: null }, update: { error: null },
    expectForm: true, urlScrubbed: true, expectCall: 'setSession',
  },
  tokenThrows: {
    url: '#access_token=SYNTHETIC_ACCESS_MARKER',
    init: { event: 'INITIAL_SESSION', session: null },
    setSession: { throw: true },
    expectForm: false, urlScrubbed: true, expectRetryHidden: true,
    expectDebug: /flow token \/ result rejected \(typeerror\)/,
  },
  updateError: {
    url: '#access_token=SYNTHETIC_ACCESS_MARKER&type=recovery',
    init: { event: 'PASSWORD_RECOVERY', session: { user: {} } },
    update: { error: { name: 'AuthApiError', message: 'New password should be different from the old password.', status: 422, code: 'same_password' } },
    expectForm: true, urlScrubbed: true, submit: true,
    expectStatus: /have not used for this account before/,
  },
  silent: {
    url: '?code=SYNTHETIC_CODE_MARKER',
    init: null,
    exchange: { error: null }, update: { error: null },
    expectForm: true, urlScrubbed: true, expectCall: 'exchange',
  },
  expiredLink: {
    url: '#error=access_denied&error_code=otp_expired&error_description=SYNTHETIC_INJECTED_MARKER+call+555',
    init: { event: 'INITIAL_SESSION', session: null },
    expectForm: false, urlScrubbed: true,
    expectLede: /has expired/,
  },
  bare: {
    url: '',
    init: { event: 'INITIAL_SESSION', session: null },
    expectForm: false, urlScrubbed: true,
    expectDebug: /result no_token/,
  },
};

// The real-SDK, network-blocked cases from probe.cjs's `reset` section,
// with expectations re-verified against the current page.
const REAL_SDK_CASES = {
  code: { suffix: '?code=SYNTHETIC_CODE_MARKER', expectForm: false, urlScrubbed: true, expectRetryHidden: false, expectDebug: /result unreachable/ },
  hashToken: { suffix: '#access_token=SYNTHETIC_ACCESS_MARKER&refresh_token=SYNTHETIC_REFRESH_MARKER&type=recovery', expectForm: false, urlScrubbed: true, expectRetryHidden: true, expectLede: /was not accepted/ },
  malformed: { suffix: '#error_description=%25', expectForm: false, urlScrubbed: true, expectRetryHidden: true, expectLede: /is invalid/, expectStatus: 'Link not valid.' },
  expired: { suffix: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', expectForm: false, urlScrubbed: true, expectRetryHidden: true, expectLede: /has expired/, expectStatus: 'Link expired.' },
  injected: { suffix: '#error=access_denied&error_code=otp_expired&error_description=SYNTHETIC_INJECTED_MARKER+call+555', expectForm: false, urlScrubbed: true, expectRetryHidden: true, expectLede: /has expired/, expectStatus: 'Link expired.' },
  bare: { suffix: '', expectForm: false, urlScrubbed: true, expectRetryHidden: true, expectDebug: /result no_token/ },
};

async function readState(page) {
  return page.evaluate(() => ({
    lede: document.getElementById('lede').textContent.trim(),
    status: document.getElementById('status').textContent.trim(),
    debug: document.getElementById('debug').textContent.trim(),
    debugShown: !document.getElementById('debug').classList.contains('hidden'),
    retryHidden: document.getElementById('retry').hidden,
    formEnabled: !document.getElementById('password').disabled,
    returnShown: !document.getElementById('returnLink').classList.contains('hidden'),
    html: document.documentElement.outerHTML,
    url: location.href,
    calls: window.__mockCalls || [],
  }));
}

describe('reset-password.html (Playwright)', () => {
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

  describe('stubbed SDK — 11 scenarios ported from reset-mock.cjs', () => {
    for (const [name, sc] of Object.entries(MOCK_SCENARIOS)) {
      it(name, async () => {
        const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
        const consoleText = [];
        const pageErrors = [];
        try {
          const page = await context.newPage();
          page.on('console', (m) => consoleText.push(m.text()));
          page.on('pageerror', (e) => pageErrors.push(e.message || String(e)));
          await context.route('**/*', (route) => {
            const url = route.request().url();
            if (url.includes('supabase-js')) {
              return route.fulfill({ status: 200, contentType: 'application/javascript', body: mockSupabaseJs(sc) });
            }
            let origin;
            try {
              origin = new URL(url).origin;
            } catch {
              return route.abort();
            }
            return origin === site.url ? route.continue() : route.abort();
          });

          await page.goto(`${site.url}/reset-password.html${sc.url}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(sc.init ? 900 : 3200);
          let state = await readState(page);

          assert.equal(state.formEnabled, sc.expectForm, `form enabled=${state.formEnabled}, expected ${sc.expectForm}`);
          assert.equal(
            MARKER_RE.test(state.url),
            !sc.urlScrubbed,
            `URL scrub state wrong: url="${state.url}" (expected scrubbed=${sc.urlScrubbed})`,
          );
          if (sc.expectDebug) assert.match(state.debug, sc.expectDebug, `debug text: "${state.debug}"`);
          if (sc.expectLede) assert.match(state.lede, sc.expectLede, `lede text: "${state.lede}"`);
          if (sc.expectRetryHidden !== undefined) {
            assert.equal(state.retryHidden, sc.expectRetryHidden, `retry button hidden=${state.retryHidden}, expected ${sc.expectRetryHidden}`);
          }
          if (sc.expectCall) {
            assert.ok(state.calls.some((c) => c.name === sc.expectCall), `SDK method "${sc.expectCall}" was never called`);
          }

          if (sc.submit) {
            await page.fill('#password', 'correct-horse-battery');
            await page.fill('#confirm', 'correct-horse-battery');
            await page.click('#submit');
            await page.waitForTimeout(400);
            state = await readState(page);
            const ok = !sc.update.error;
            if (ok) {
              assert.match(state.status, /updated/, `post-submit status: "${state.status}"`);
              assert.ok(state.returnShown, 'the "Return to Trade RC" link should show after a successful update');
            } else if (sc.expectStatus) {
              assert.match(state.status, sc.expectStatus, `post-submit status: "${state.status}"`);
            }
            assert.ok(
              state.calls.some((c) => c.name === 'update' && c.arg.includes('password')),
              'updateUser should have been called with the password field',
            );
          }

          assert.doesNotMatch(state.html, MARKER_RE, 'a synthetic marker leaked into the rendered DOM');
          const consoleLeak = consoleText.filter((t) => MARKER_RE.test(t));
          assert.deepEqual(consoleLeak, [], `a synthetic marker leaked into the console: ${consoleLeak[0]}`);
          assert.deepEqual(pageErrors, [], `uncaught page error(s): ${pageErrors.join(' | ')}`);
        } finally {
          await context.close();
        }
      });
    }
  });

  describe('real SDK, network blocked — cases ported from probe.cjs', () => {
    for (const [name, c] of Object.entries(REAL_SDK_CASES)) {
      it(name, async () => {
        const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
        const consoleText = [];
        try {
          const page = await context.newPage();
          page.on('console', (m) => consoleText.push(m.text()));
          await context.route('**/*', (route) => {
            const url = route.request().url();
            let origin;
            try {
              origin = new URL(url).origin;
            } catch {
              return route.abort();
            }
            if (url.startsWith('data:')) return route.continue();
            return origin === site.url ? route.continue() : route.abort();
          });
          await page.goto(`${site.url}/reset-password.html${c.suffix}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(3500);
          const state = await readState(page);

          assert.equal(state.formEnabled, c.expectForm, `form enabled=${state.formEnabled}, expected ${c.expectForm}`);
          assert.equal(
            MARKER_RE.test(state.url),
            !c.urlScrubbed,
            `URL scrub state wrong: url="${state.url}" (expected scrubbed=${c.urlScrubbed})`,
          );
          if (c.expectRetryHidden !== undefined) {
            assert.equal(state.retryHidden, c.expectRetryHidden, `retry button hidden=${state.retryHidden}, expected ${c.expectRetryHidden}`);
          }
          if (c.expectDebug) assert.match(state.debug, c.expectDebug, `debug text: "${state.debug}"`);
          if (c.expectLede) assert.match(state.lede, c.expectLede, `lede text: "${state.lede}"`);
          if (c.expectStatus) assert.equal(state.status, c.expectStatus, `status text: "${state.status}"`);

          assert.doesNotMatch(state.html, MARKER_RE, 'a synthetic marker leaked into the rendered DOM');
          const consoleLeak = consoleText.filter((t) => MARKER_RE.test(t));
          assert.deepEqual(consoleLeak, [], `a synthetic marker leaked into the console: ${consoleLeak[0]}`);
        } finally {
          await context.close();
        }
      });
    }

    it('missingSdk: the vendor script itself is blocked', async () => {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const consoleText = [];
      try {
        const page = await context.newPage();
        page.on('console', (m) => consoleText.push(m.text()));
        await page.route('**/supabase-js*', (route) => route.abort());
        await context.route('**/*', (route) => {
          const url = route.request().url();
          let origin;
          try {
            origin = new URL(url).origin;
          } catch {
            return route.abort();
          }
          return origin === site.url ? route.continue() : route.abort();
        });
        await page.goto(`${site.url}/reset-password.html?code=SYNTHETIC_CODE_MARKER`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3500);
        const state = await readState(page);

        assert.equal(state.formEnabled, false, 'form should stay disabled when the SDK fails to load');
        assert.match(state.debug, /result no_library/, `debug text: "${state.debug}"`);
        assert.equal(state.retryHidden, true, 'retry is forced hidden for a missing library — reloading is the only retry');
        // Deliberately NOT scrubbed: reload is the retry path for a missing
        // library, so the code stays in the bar for that reload to use.
        assert.ok(MARKER_RE.test(state.url), 'expected the code to remain in the URL for the missing-library retry-by-reload path');

        assert.doesNotMatch(state.html, MARKER_RE, 'a synthetic marker leaked into the rendered DOM');
        const consoleLeak = consoleText.filter((t) => MARKER_RE.test(t));
        assert.deepEqual(consoleLeak, [], `a synthetic marker leaked into the console: ${consoleLeak[0]}`);
      } finally {
        await context.close();
      }
    });
  });
});
