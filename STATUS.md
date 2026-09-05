---
phase: live_with_review_findings
ship_ready: false
needs_decision: true
last_updated: 2026-09-04
---

# thomasraypublishing.com — Status

The studio's marketing site: hand-authored static HTML/CSS/JS on GitHub Pages,
custom domain, and self-hosted marketing assets. Password recovery connects
to Supabase. There is no production framework or build pipeline in this checkout.

`ship_ready: false` records unresolved findings for the next release; the
existing production site remains live.

## Where it stands

- **Live.** Home page plus standalone pages for Trade RC, Pomagotchi,
  The Device, and Hush Hush Snap Snap, each with its own design system;
  Coming Next page; support, privacy, and reset-password pages;
  per-app legal pages.
- **Latest inspected CI passed at `188bece` (2026-09-03).** Store-link
  checks assert three homepage URL literals; Lighthouse has warn-level
  desktop budgets; axe covers eight routes. Scheduled/PR link checks and
  uptime/certificate monitoring also exist. This is not all-page or
  complete behavioral verification.
- Cross-document view transitions, prerendering, and per-page navigation
  instruments exist. Review found incomplete `?static=1` motion
  suppression, no-JavaScript navigation/failure states, keyboard focus,
  and mobile reflow. Safari/VoiceOver/physical-device closure remains open.
- **Hush Hush Snap Snap page rebuilt 2026-09-03** as "the quiet camera":
  black field, photography-first, nine sections, three-tier plans
  (Hushed Pro / Ultra Snapped / Lifetime) with US prices. It describes
  v1.4.0, which is in App Store review; Sean ruled to publish ahead of
  approval. Photographs are Sean's own (Fujifilm / Canon), credited as
  such, never presented as app captures.
- **HHSS lights-down/aperture motion is local at `256abb3`.** Existing
  uncommitted work was preserved as the review baseline. The latest
  verified Pages deployment is `188bece`; this review did not push.
- **Website review completed 2026-09-04.** All 259 baseline project files
  were inventoried (219 tracked); 19 public routes received 38 local
  Chrome/axe scans, with additional failure, keyboard, reflow, and
  synthetic reset/game checks. Critical findings include credential-bearing
  reset diagnostics, navigation dependency/focus defects, inaccessible
  demo behavior, and contradictory public claims. See the local report.

## Working agreements

- Every page keeps the `?static=1` deterministic-render contract — the
  landing-page CI checks use it. Repair the remaining CSS/random-state
  gaps and test normal mode as well; static scans alone cannot prove delivery.
- App-page copy never exceeds what the shipped app builds actually do —
  or, by Sean's explicit ruling (HHSS, 2026-09-03), what a submitted build
  does during its review window.

## Open items

- Recommended continuation and implementation plan:
  `Research/WEBSITE_REVIEW_AND_CONTINUATION_PLAN_2026-09-04.md`.
  Evidence and complete baseline inventory:
  `Research/reviews/2026-09-04/EVIDENCE.md`.
  These are Git-ignored local artifacts; attach the report when handing
  work to an agent outside this checkout.
- Triage review tickets W01–W13. Approve any new UI/game behavior before
  implementation, preserve existing design decisions, and verify product
  claims against authoritative app/legal sources. No redesign or deployment
  is authorized by the review itself.
- HHSS: strike the "arrive with version 1.4.0" plans note and re-check the
  seven prices against App Store Connect once Apple approves 1.4.0.
- HHSS: the Dark Ride photograph is already present in source and live
  HTML; the former hold note was stale. A "Made with Hush Hush Snap
  Snap" gallery still waits on six or more real app captures and its design gate.
- HHSS: verify approved privacy v1.11 / terms v1.4 source documents before
  updating current v1.10 / v1.3 pages. Verify motion on Safari and with
  preference changes; film-advance stepping remains held.
- App pages want a few bespoke art assets (see `TRP-Assets` wishlist) —
  waiting on new artwork.
- Trade RC section swaps its TestFlight framing for App Store links at
  launch.
- POM portal redesign chartered (P Play / O Originate / M Municipate;
  plan in `Research/TRP_POM_PORTAL_REDESIGN_PLAN.md`). Phase 1 WebGL
  letterpress prototype built and self-tested at `prototypes/pom-portal.html`
  — awaiting Sean's design gate before any live page changes.
- POM: the new review recommends a compact signature with direct product
  discovery. This is proposed. Naming decisions remain Play / Originate /
  Municipate; exact category routes and live layout need approval. Build
  complete destinations and verification before promoting the homepage.
