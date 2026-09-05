---
phase: live
ship_ready: false
needs_decision: true
last_updated: 2026-09-05
---

# thomasraypublishing.com — Status

The studio's marketing site: hand-authored static HTML/CSS/JS on GitHub Pages,
custom domain, and self-hosted marketing assets. Password recovery connects
to Supabase. There is no production framework or build pipeline in this checkout.

`ship_ready: false` records that the 2026-09-05 defect fixes are committed
locally and unpushed, and that three review tickets still need Sean's wording
or design rulings. The existing production site remains live.

## Where it stands

- **Live at `13b1d0e`** (Pages build verified 2026-09-05). Home page plus
  standalone pages for Trade RC, Pomagotchi, The Device, and Hush Hush Snap
  Snap, each with its own design system; Coming Next page; support, privacy,
  and reset-password pages; per-app legal pages.
- **Defect track shipped locally 2026-09-05 (eight commits, unpushed).**
  Sean approved starting it ahead of the home-direction decision. Fixed and
  verified: W01 reset diagnostics no longer render URL/token material; W02
  navigation works with Three.js, ScrollTrigger or GSAP blocked and without
  JavaScript; W03 the mobile menu is a focus-contained dialog with native
  anchors, plus skip links on every shared page; W04 no public route widens
  at 320 or 375 px, tables scroll in labelled regions; W08 one opt-in motion
  policy across the site (`html[data-motion]`), settled under `?static=1`,
  no-JS, Reduce Motion (live), and the visitor's pause; W09 the Device game
  restart is deterministic; W12 reset decoding, no-SDK/no-JS states, and the
  terms/accessibility heading order and aside labels. The **Pause motion**
  control (Sean's call: top-bar text toggle) closes the WCAG 2.2.2 gap.
- **Verification (local, 2026-09-05):** Playwright probes against the
  installed Chrome (`Research/reviews/2026-09-05/scripts/`): all 19 routes
  0 px overflow at 375 and 320, 0 running animations under `?static=1` and
  no-JS, gate/live/paused states asserted; reset page against a stubbed SDK
  (11 scenarios) and the real SDK with network blocked; axe 0 violations on
  every CI route and changed page; Lighthouse 0.97–1.00 on home, HHSS,
  privacy, Device. Not established: physical iPhone/iPad/Mac Safari,
  VoiceOver, real password recovery.
- **HHSS page** describes v1.4.0 (in App Store review) by Sean's ruling;
  photographs are Sean's own, credited, never presented as app captures.

## Working agreements

- Every page keeps the `?static=1` deterministic-render contract — the CI
  checks use it. Motion is opt-in on `html[data-motion="full"]`; a new page
  or effect must key its ambient motion off that attribute.
- App-page copy never exceeds what the shipped app builds actually do — or,
  by Sean's explicit ruling (HHSS, 2026-09-03), what a submitted build does
  during its review window.

## Open items

- **Needs Sean — push.** Review the eight local commits (`git log 30e7e9e..`)
  and approve the push; Pages deploys from `main`. Punch list for a phone:
  the Pause motion toggle's feel, and the HHSS / Device mastheads now wrap
  to two rows below ~430 px to keep the 44 pt toggle (`[design-call]`).
- **Needs Sean — wording (W06, W07).** Root privacy vs Trade RC privacy
  scope; two Pomagotchi terms versions linked from different pages; the
  homepage HHSS tier line vs the HHSS page; `accessibility.html` claims
  Pa11y runs (it does not). No copy changed without rulings.
- **Needs Sean — design (W05, home direction).** Demo mechanics for
  keyboard/VoiceOver parity; refined dark vs warm editorial home; compact
  POM signature as sections and anchors, not routes. Atlas stays shelved.
- **W13** (CI covers 8 of 19 routes; tools unpinned; loose CTA check) is
  next in the technical spine; the 2026-09-05 probes are its seed.
- **New, recorded 2026-09-05 (W14):** in normal mode the home's scroll
  reveals keep every chapter heading and link at `visibility: hidden` until
  scrolled into view, so assistive tech sees h1 → footer h3 on load (axe
  heading-order in normal mode only; CI's static render cannot see it).
  Fix belongs with W05's reveal/demo accessibility pass.
- HHSS: strike the "arrive with version 1.4.0" plans note and re-check the
  seven prices against App Store Connect once Apple approves 1.4.0; the
  "Made with Hush Hush Snap Snap" gallery still waits on six or more real
  app captures; privacy v1.11 / terms v1.4 source documents unverified.
- Enlarged-text stress (root font doubled at 320 px, beyond the WCAG reflow
  condition): home, HHSS, Pomagotchi, Device and every shared page 0 px;
  residuals remain on Trade RC (103 px) and the Pomagotchi privacy/terms
  table headers (120 / 89 px), which keep whole words by design.
- App pages want a few bespoke art assets (see `TRP-Assets` wishlist).
- Trade RC section swaps its TestFlight framing for App Store links at launch.
- POM portal prototype at `prototypes/pom-portal.html` awaits its design gate.
