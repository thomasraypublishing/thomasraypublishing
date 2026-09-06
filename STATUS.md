---
phase: live
ship_ready: false
needs_decision: true
last_updated: 2026-09-06
---

# thomasraypublishing.com — Status

The studio's marketing site: hand-authored static HTML/CSS/JS on GitHub Pages,
custom domain, and self-hosted marketing assets. Password recovery connects
to Supabase. There is no production framework or build pipeline in this checkout.

`ship_ready: false` records that five review-driven fix commits are local and
unpushed while their defects are on the live site, and that three review
tickets still need Sean's wording or design rulings.

## Where it stands

- **Live at `c754c6a`** (Sean pushed the defect track 2026-09-06 04:02 UTC;
  Site CI green: a11y, store links, Lighthouse). Home page plus standalone
  pages for Trade RC, Pomagotchi, The Device, and Hush Hush Snap Snap, each
  with its own design system; Coming Next page; support, privacy, and
  reset-password pages; per-app legal pages.
- **Defect track shipped 2026-09-05, live 2026-09-06.** Sean approved
  starting it ahead of the home-direction decision. Fixed and verified: W01 reset diagnostics no longer render URL/token material; W02
  navigation works with Three.js, ScrollTrigger or GSAP blocked and without
  JavaScript; W03 the mobile menu is a focus-contained dialog with native
  anchors, plus skip links on every shared page; W04 no public route widens
  at 320 or 375 px, tables scroll in labelled regions; W08 one opt-in motion
  policy across the site (`html[data-motion]`), settled under `?static=1`,
  no-JS, Reduce Motion (live), and the visitor's pause; W09 the Device game
  restart is deterministic; W12 reset decoding, no-SDK/no-JS states, and the
  terms/accessibility heading order and aside labels. The **Pause motion**
  control (Sean's call: top-bar text toggle) closes the WCAG 2.2.2 gap.
- **Review pass 2026-09-05/06 (five commits, local, unpushed).** Opus code
  review and a Fable adversarial pass of the shipped track, each with a
  second pass on the fixes, found and reproduced real defects that are now
  live at `c754c6a`: one click of "Pause motion" breaks the home's About
  quote to one word per line; the mobile menu becomes unclosable if the
  viewport crosses 720 px while open; the Pause button renders under Reduce
  Motion, `?static=1` and with JavaScript off (an author `display` beat the
  UA `[hidden]` rule); the reset page's failsafe could spend a one-time link
  and the SDK's own URL cleanup left the tokens in history. All fixed, plus
  W14 (scroll reveals kept headings and links out of the accessibility tree
  until scrolled) and W13 (`tools/tests/`: 143 pinned Playwright + axe tests,
  `npm test`, wired into CI as the `verify` job). Record:
  `Research/reviews/2026-09-05/VERIFICATION_REPORT.md`.
- **Verification (local):** every one of the 19 routes 0 px overflow at 375
  and 320, 0 running animations under `?static=1` and no-JS, gate/live/
  paused/cross-tab states asserted; reset page against a stubbed SDK (18
  scenarios) and the real SDK with the network blocked, with a console-leak
  check; axe 0 violations on all 19 routes at two widths; Lighthouse
  0.97–1.00 on the CI render, and a normal-mode mobile baseline recorded
  (home 0.73, Pomagotchi 0.78: byte weight, not script). Not established:
  physical iPhone/iPad/Mac Safari, VoiceOver, real password recovery.
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

- **Needs Sean — push the five fix commits** (`git log c754c6a..`): they
  correct defects that are live now (above). Punch list for a phone after
  that: the Pause motion toggle's feel; the new Close button inside the
  menu; the HHSS / Device mastheads wrap to two rows below ~430 px to keep
  the 44 pt toggle (`[design-call]`).
- **Needs Sean — wording (W06, W07).** `Research/CLAIM_REGISTER_2026-09-05.md`
  logs 19 claims with file:line evidence and 13 precise rulings. Highest
  impact: the Pomagotchi terms page says the liability cap is the "greater"
  of $100 or the amount paid while the app's canonical terms of the same
  version say "lesser"; the root privacy page says no backend holds user
  data while Trade RC's own policy documents its Supabase and Stream.io
  backend; `accessibility.html` claims Pa11y runs (it does not; after W13 it
  should name the real suite). No copy changed without rulings.
- **Needs Sean — design (W05, home direction).** Demo mechanics for
  keyboard/VoiceOver parity; refined dark vs warm editorial home; compact
  POM signature as sections and anchors, not routes. Atlas stays shelved.
- **W13 done, W14 done** (both in the unpushed commits). CI will run the
  new `verify` job on the first push; its first run is the proof.
- **Performance candidates (recorded, not changed):** the home ships seven
  font faces (468 KB) and a 182 KB JPEG favicon; Three.js is 166 KB gzip
  with most of it unused; Pomagotchi's yard backgrounds are 147 + 132 KB.
  Asset and build decisions for a later pass.
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
