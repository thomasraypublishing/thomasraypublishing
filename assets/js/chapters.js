/* ========================================================================
   chapters.js — chapter palette state machine.
   Sections carry data-world="hero|pom|device|hhss|editorial". As each
   enters the viewport center, the page's CSS custom properties tween to
   that chapter's undertone and the WebGL atmosphere is told to morph.
   Also drives the desktop progress rail.
   ======================================================================== */

/* Subtle undertone shifts on the cosmic base — ink stays cream so body
   text contrast never drops below AA. */
const PALETTES = {
  hero:      { '--paper': '#0F0C1F', '--paper-2': '#17122B', '--cream-hi': '#1B1632', '--chapter-accent': '#F5B07A' },
  pom:       { '--paper': '#181023', '--paper-2': '#201631', '--cream-hi': '#251A38', '--chapter-accent': '#F5B07A' },
  device:    { '--paper': '#0C0A26', '--paper-2': '#141133', '--cream-hi': '#1A163C', '--chapter-accent': '#8478D8' },
  hhss:      { '--paper': '#170D17', '--paper-2': '#211421', '--cream-hi': '#281A28', '--chapter-accent': '#E8869A' },
  editorial: { '--paper': '#0F0C1F', '--paper-2': '#17122B', '--cream-hi': '#1B1632', '--chapter-accent': '#F5B07A' },
};

export function initChapters({ atmosphere, motion }) {
  // Palettes go on <body>: the cosmic theme defines its custom properties
  // there, so body-level values are what the cascade actually uses.
  const root = document.body;
  const sections = Array.from(
    document.querySelectorAll('header[data-world], article[data-world], section[data-world], footer[data-world]'));
  let current = 'hero';

  function enter(world) {
    if (world === current || !PALETTES[world]) return;
    current = world;
    atmosphere?.setWorld(world);
    gsap.to(root, {
      ...PALETTES[world],
      duration: motion ? 1.4 : 0,
      ease: 'power2.out',
      overwrite: 'auto',
    });
    syncRail(world);
  }

  sections.forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 55%',
      end: 'bottom 55%',
      onEnter: () => enter(el.dataset.world),
      onEnterBack: () => enter(el.dataset.world),
    });
  });

  // Feed raw scroll position to the canvas for parallax.
  if (atmosphere) {
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => atmosphere.setScroll(self.scroll()),
    });
  }

  // ---- progress rail (desktop only, decorative) ---------------------------
  const rail = document.getElementById('chapter-rail');
  function syncRail(world) {
    if (!rail) return;
    rail.querySelectorAll('a').forEach((a) =>
      a.classList.toggle('active', a.dataset.world === world));
  }
  syncRail('hero');
}
