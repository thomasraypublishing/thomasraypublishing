# Site verification suite (W13)

A pinned, repo-tracked test suite for the static site at the repo root. It
never touches production files — it only reads them, serves them from a
throwaway local static server, and drives a real Chromium against that
local copy. Nothing here can change how any public page renders.

## Running it

```
npm install                              # once, or after pulling a devDependency change
npx playwright install chromium          # once, only if you don't have Google Chrome
npm test                                 # everything
```

**Browser choice.** Locally the suite drives your installed **Google
Chrome** by default (`channel: 'chrome'`), matching the
`Research/reviews/2026-09-05/scripts/` probes this suite was ported from.
Set `TRP_BROWSER=chromium` to use Playwright's own bundled Chromium instead
(after `npx playwright install chromium`) — useful if you don't have Chrome,
or want the exact browser build CI uses. In CI (`CI=true`, which GitHub
Actions sets automatically) it always uses the bundled Chromium, since CI
runners don't have Chrome installed.

**Individual files**, once you've run `npm install`:

```
npm run test:routes      # tools/tests/routes.test.js
npm run test:behavior    # tools/tests/behavior.test.js
npm run test:links       # tools/tests/links.test.js
npm run test:cta         # tools/tests/cta.test.js
npm run test:modules     # tools/tests/modules.test.js

# No dedicated npm script for these two — run them directly:
node --test tools/tests/reset.test.js
node --test tools/tests/game.test.js
```

**`npm run serve`** starts the same static server the tests use
(`tools/tests/lib/server.js`) on a free port, so you can poke at the site
by hand under the same MIME/routing rules the tests run under. Ctrl+C to
stop it.

## What each file asserts

- **`routes.test.js`** — for every route in `routes.json`, at 1280px and
  375px (loaded with `?static=1` for the routes flagged `static`, plain
  otherwise): no page or console error, no horizontal overflow
  (`document.documentElement.scrollWidth` at most 1px over the viewport —
  a fractional-device-scale rounding allowance, not real reflow slack), a
  settled motion state (0 running Web Animations), and an axe-core scan
  across `wcag2a`/`wcag2aa`/`wcag21aa`/`wcag22aa`/`best-practice` with 0
  violations at *any* impact level — the current tree is clean, so nothing
  here is grandfathered in. It also runs a JS-disabled pass at 375px for
  every `sharedNav` route, asserting the primary nav links
  (`nav.top .navlinks a`) are visible and `#menu-btn` is not (that's
  `assets/nojs.css`'s job — no JS, nothing should be pretending to be a
  disclosure button). Finally, a coverage test walks `git ls-files
  '*.html'` (falling back to a filesystem walk if git isn't available) and
  fails the build if any tracked `*.html` file besides `tools/og-card.html`
  is missing from `routes.json` — a new page can't ship uncovered.

  This absorbs and generalizes probe.cjs's `static`, `nojs`, and part of
  its `reflow` sections. It deliberately does **not** port the 320px /
  doubled-root-font stress variant of `reflow`: that check currently fails
  against two residual overflows (Trade RC, the Pomagotchi privacy/terms
  table headers) that STATUS.md records as accepted by design ("keep whole
  words by design"), so porting it verbatim would make every CI run red
  for a decision that's already been made, not a regression. If that
  decision changes, that stress test belongs back in this file.

- **`behavior.test.js`** — the interactive and motion-policy assertions,
  ported from probe.cjs's `blocked`, `menu`, `gate`, `live`, `paused`, and
  `quiet` sections:
  - *blocked*: the mobile menu still opens (and nothing throws) with
    `three.module.min.js`, `ScrollTrigger.min.js`, or `gsap.min.js`
    aborted.
  - *menu*: on `index.html`, Tab focus never leaves the open dialog's own
    controls, `role="dialog"`/`aria-modal="true"` are set, background
    content is marked `inert` while open and un-marked on close, Escape
    closes it and returns focus to `#menu-btn`, and choosing the Books
    link sets `location.hash` to `#books`.
    **Note:** this checks the invariant (a focus trap that never leaks
    focus outside the dialog), not a hardcoded element-by-element Tab
    sequence. `assets/js/nav.js` grew a dedicated in-dialog Close button
    partway through this suite's own build (a real, concurrent
    accessibility improvement, not something this ticket asked for) —
    the invariant-based check is correct before and after a change like
    that; a hardcoded sequence would not have been.
  - *gate*: on the Hush Hush Snap Snap page, the ring/capture/hero
    animations and `scroll-behavior` only run when
    `html[data-motion="full"]` — every other value (absent, `static`,
    `reduced`, `paused`) settles.
  - *live*: emulating `prefers-reduced-motion: reduce` on each of the five
    landings (without a reload) lands on `data-motion="reduced"` and 0
    running animations.
  - *paused*: seeding `localStorage.trp-motion=paused` before first paint
    (on `index.html`, the Hush Hush Snap Snap page, and The Device) settles
    the page before any content ever moves.
  - *quiet*: the "Pause motion" / "Play motion" control — present and
    labeled correctly, pauses and resumes site-wide, survives a reload,
    hides under `?static=1` and under Reduce Motion (nothing left to
    pause), and meets the 44×44px minimum target at 375 and 320px.

- **`reset.test.js`** — `reset-password.html` never leaks a recovery code
  or access token, however the link is shaped or however its Supabase call
  turns out. Ported from `reset-mock.cjs`'s 11 stubbed-SDK scenarios plus
  the real-SDK/network-blocked cases from probe.cjs's `reset` section.
  **Read the comment at the top of this file before touching it** — its
  expectations were re-derived empirically against the current page, not
  copied from the seed scripts verbatim, because `reset-password.html` was
  substantially rewritten (in this same working tree, by a concurrent
  session) while this suite was being built. The short version: a
  "retryable" outcome (currently: the sign-in service being unreachable, or
  a missing SDK) shows a Try Again button and deliberately leaves the
  code/token in the URL so retrying can reuse it; every other outcome
  scrubs it. What never changes, and what every scenario in this file
  checks: the raw code/token/description text is never rendered into the
  DOM or written to the console, under any outcome.

- **`game.test.js`** — ported from `game-race.cjs`. Restarting The Device's
  memory challenge (mid-playback, inside the 900ms success delay, inside
  the 1000ms retry delay, or five rapid clicks) always yields exactly one
  "watch" and one "your turn" announcement, exactly 3 lit stones, nothing
  stuck lit, and every stone re-enabled. Runs in both `?static=1` and
  normal timing.

- **`links.test.js`** — every internal `href`/`src`/`srcset` on every
  route in `routes.json` resolves to a real, tracked file, and every
  same-page or cross-page `#fragment` exists on its target page. Pure
  filesystem + string parsing (no server, no browser). Resolution mirrors
  what a browser does when it resolves a relative URL against the page
  it's on, plus one rule specific to this site's production host: a path
  with no matching file or directory falls back to `<path>.html` — e.g.
  `pomagotchi/terms.html` links to
  `https://thomasraypublishing.com/pomagotchi/terms` (no extension), which
  is exactly how GitHub Pages serves that page live. That fallback is a
  resolution rule in this file only — `tools/tests/lib/server.js`
  deliberately does not implement it, because nothing in this suite ever
  navigates a browser straight to an extensionless route.
  Excluded, by design: external URLs, `mailto:`, `tel:`, and `traderc://`.

- **`cta.test.js`** — every App Store call-to-action points at the right
  product. On each page `products.json` names, every apps.apple.com link
  inside that product's listed CSS container(s) must equal its canonical
  URL exactly. Sitewide, every tracked `*.html` file is scanned as text for
  any `apps.apple.com/.../<slug>/id...` URL whose slug is one of the three
  products' slugs, wherever it appears (an `href`, a JSON-LD `installUrl`
  string) — it must match that product's canonical URL exactly, catching a
  wrong id or a country/locale drift anywhere on the site. Out of scope on
  purpose: the five iMessage sticker packs on `index.html` (different Apple
  apps entirely) and Apple's own generic destinations
  (`apps.apple.com/redeem`, `apps.apple.com/account/subscriptions`) — see
  the comment at the top of `products.json`.

- **`modules.test.js`** — every first-party ES module (listed explicitly —
  see the file) parses as one, using `vm.SourceTextModule` under
  `--experimental-vm-modules` (`node --check` treats a bare `.js` file as
  CommonJS, so it can't catch an ES-module-only syntax error). Ported from
  `check-esm.cjs`, plus `assets/js/quiet.js` — the "Pause motion" module,
  which `main.js`/`pomagotchi.js`/`thedevice.js`/`trade-rc.js`/`hhss.js`
  all `import`, and which that seed script's hand-written file list had
  missed.

## Adding a route or a product

- **New page:** add an entry to `routes.json` (`path`, and the `static` /
  `sharedNav` / `motion` flags for whatever the page actually has —
  see the comment at the top of the file for what each flag means). If you
  don't, `routes.test.js`'s coverage test fails the build the next time
  `npm test` runs, naming the missing path.
- **New product / App Store listing:** add an entry to `products.json`
  with its `slug` (the path segment right before `/id...` in its App Store
  URL), `appStoreId`, `canonicalUrl`, and the CSS container selector(s) on
  each page that carries its CTA. `cta.test.js` picks it up automatically —
  both the per-page container check and the sitewide slug-based scan.
- **New first-party ES module:** add its repo-relative path to the
  `MODULES` array at the top of `modules.test.js`.

## The rule this suite follows

Everything under `tools/tests/`, plus `package.json`, `package-lock.json`,
the `node_modules/` line in `.gitignore`, `.github/workflows/ci.yml`, and
`lighthouserc.json`, is the full set of files this suite is allowed to
touch. It never edits any HTML/CSS/JS under the repo root or the app
folders — if a test run turns up a real defect in the site itself, that's
a finding to report and fix as its own change, not something to patch from
inside this suite.
