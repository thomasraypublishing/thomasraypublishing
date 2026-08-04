---
phase: live
ship_ready: true
needs_decision: false
last_updated: 2026-07-18
---

# thomasraypublishing.com — Status

The studio's marketing site: hand-authored static HTML/CSS/JS on GitHub Pages,
custom domain, strict same-origin CSP, no third-party runtime requests.

## Where it stands

- **Live.** Home page plus standalone pages for Trade RC, Pomagotchi,
  The Device, and Hush Hush Snap Snap, each with its own design system;
  Coming Next page; support, privacy, and reset-password pages;
  per-app legal pages.
- **CI green** — store-link integrity, Lighthouse (warn-level budgets),
  axe-core accessibility scan across all pages, and a scheduled/PR link
  check.
- Cross-document view transitions, prerendering, and per-page navigation
  instruments shipped 2026-07-18; all motion is suppressed under
  Reduce Motion, and every page renders complete with JavaScript off.

## Working agreements

- Every page keeps the `?static=1` deterministic-render contract — the
  Lighthouse and axe CI jobs load pages through it, so removing it breaks CI.
- App-page copy never exceeds what the shipped app builds actually do.

## Open items

- App pages want a few bespoke art assets (see `TRP-Assets` wishlist) —
  waiting on new artwork.
- Trade RC section swaps its TestFlight framing for App Store links at
  launch.
- POM portal redesign chartered (P Play / O Orbit-provisional / M Municipate;
  plan in `Research/TRP_POM_PORTAL_REDESIGN_PLAN.md`). Phase 1 WebGL
  letterpress prototype built and self-tested at `prototypes/pom-portal.html`
  — awaiting Sean's design gate before any live page changes.
