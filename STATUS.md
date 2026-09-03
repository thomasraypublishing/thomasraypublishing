---
phase: live
ship_ready: true
needs_decision: false
last_updated: 2026-09-03
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
- **Hush Hush Snap Snap page rebuilt 2026-09-03** as "the quiet camera":
  black field, photography-first, nine sections, three-tier plans
  (Hushed Pro / Ultra Snapped / Lifetime) with US prices. It describes
  v1.4.0, which is in App Store review; Sean ruled to publish ahead of
  approval. Photographs are Sean's own (Fujifilm / Canon), credited as
  such, never presented as app captures.

## Working agreements

- Every page keeps the `?static=1` deterministic-render contract — the
  Lighthouse and axe CI jobs load pages through it, so removing it breaks CI.
- App-page copy never exceeds what the shipped app builds actually do —
  or, by Sean's explicit ruling (HHSS, 2026-09-03), what a submitted build
  does during its review window.

## Open items

- HHSS: strike the "arrive with version 1.4.0" plans note and re-check the
  seven prices against App Store Connect once Apple approves 1.4.0.
- HHSS: the Dark Ride photograph with a recognisable attraction in frame
  is held off the page pending Sean's call; a "Made with Hush Hush Snap
  Snap" gallery waits on six or more real app captures.
- App pages want a few bespoke art assets (see `TRP-Assets` wishlist) —
  waiting on new artwork.
- Trade RC section swaps its TestFlight framing for App Store links at
  launch.
- POM portal redesign chartered (P Play / O Originate / M Municipate;
  plan in `Research/TRP_POM_PORTAL_REDESIGN_PLAN.md`). Phase 1 WebGL
  letterpress prototype built and self-tested at `prototypes/pom-portal.html`
  — awaiting Sean's design gate before any live page changes.
