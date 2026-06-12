/* ========================================================================
   specimen.js — Specimen 03: the silent capture.
   Tap the Hush Hush Snap Snap viewfinder and it photographs the live
   atmosphere — the actual particle sky at that instant — and slides the
   shot out as a small polaroid. No flash, no sound. Naturally.
   ======================================================================== */

const CAPTIONS = {
  hero: 'the sky over the catalog',
  pom: 'a warm patch of fluff',
  device: 'starlight, archived',
  hhss: 'almost perfect stillness',
  editorial: 'quiet weather',
};

export function initCaptureSpecimen({ atmosphere, motion, currentWorld }) {
  const specimen = document.getElementById('hhss-specimen');
  const tray = document.getElementById('hhss-polaroids');
  const status = document.getElementById('hhss-status');
  if (!specimen || !tray) return;

  // Without a live sky there is nothing to photograph — let the card
  // behave as a plain link to the HHSS chapter instead.
  if (!atmosphere) {
    specimen.querySelector('.click-hint')?.remove();
    return;
  }

  let count = 0;

  specimen.addEventListener('click', (e) => {
    e.preventDefault();

    // Leaf-shutter blink: a brief dim, never a flash. Silent cameras don't shout.
    const stage = specimen.querySelector('.stage');
    stage.classList.add('shuttering');
    setTimeout(() => stage.classList.remove('shuttering'), 140);

    const dataUrl = atmosphere.capture(360, 270);
    count += 1;

    const world = (typeof currentWorld === 'function' ? currentWorld() : 'hero') || 'hero';
    const caption = CAPTIONS[world] ?? CAPTIONS.hero;

    const card = document.createElement('figure');
    card.className = 'polaroid';
    card.style.setProperty('--tilt', `${(Math.random() * 10 - 5).toFixed(1)}deg`);
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = `Silent capture number ${count}: ${caption}`;
    const cap = document.createElement('figcaption');
    cap.textContent = `№ ${String(count).padStart(3, '0')} · ${caption}`;
    card.append(img, cap);
    tray.appendChild(card);

    // Keep the tray to three shots; the oldest slides away.
    while (tray.children.length > 3) tray.removeChild(tray.firstChild);

    if (motion && window.gsap) {
      gsap.from(card, { y: 26, autoAlpha: 0, rotation: 0, duration: 0.55, ease: 'power3.out' });
    }

    if (status) status.textContent = `Captured silently — ${caption}.`;
  });
}
