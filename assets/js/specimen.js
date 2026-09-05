/* ========================================================================
   specimen.js — Specimen 03: the silent capture.
   Tap the Hush Hush Snap Snap viewfinder and a photograph slides out as
   a small polaroid — one of the publisher's own Pomeranians, captured
   the way the app intends: without a sound. A shuffle bag guarantees no
   repeats until the whole roll has been seen.
   ======================================================================== */

const ROLL = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10', 'p11', 'p12'];

const CAPTIONS = [
  'not a single click',
  'no one heard a thing',
  'the shutter stayed quiet',
  'zero decibels',
  'perfectly silent',
  'they never noticed',
];

export function initCaptureSpecimen({ motion }) {
  const motionOn = () => (typeof motion === 'function' ? motion() : Boolean(motion));
  const specimen = document.getElementById('hhss-specimen');
  const tray = document.getElementById('hhss-polaroids');
  const status = document.getElementById('hhss-status');
  if (!specimen || !tray) return;

  // Shuffle bag: refill and reshuffle once the roll is exhausted.
  let bag = [];
  function nextShot() {
    if (bag.length === 0) {
      bag = [...ROLL];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function srcFor(name) { return `images/photos/opt/${name}.webp`; }

  // Keep the upcoming shot warm so the first tap develops instantly.
  let upcoming = nextShot();
  const warm = new Image();
  warm.src = srcFor(upcoming);

  let count = 0;

  specimen.addEventListener('click', (e) => {
    if (!e.target.closest('#hhss-stage')) return;
    e.preventDefault();

    // Leaf-shutter blink: a brief dim, never a flash. Silent cameras don't shout.
    const stage = specimen.querySelector('.stage');
    stage.classList.add('shuttering');
    setTimeout(() => stage.classList.remove('shuttering'), 140);

    const shot = upcoming;
    upcoming = nextShot();
    new Image().src = srcFor(upcoming); // preload the next one

    count += 1;
    const caption = CAPTIONS[(count - 1) % CAPTIONS.length];

    const card = document.createElement('figure');
    card.className = 'polaroid';
    card.style.setProperty('--tilt', `${(Math.random() * 10 - 5).toFixed(1)}deg`);
    const img = document.createElement('img');
    img.src = srcFor(shot);
    img.alt = `A Pomeranian, photographed silently — shot ${count}`;
    const cap = document.createElement('figcaption');
    cap.textContent = `№ ${String(count).padStart(3, '0')} · ${caption}`;
    card.append(img, cap);
    tray.appendChild(card);

    // Keep the tray to three prints; the oldest slides away.
    while (tray.children.length > 3) tray.removeChild(tray.firstChild);

    if (motionOn() && window.gsap) {
      gsap.from(card, { y: 26, autoAlpha: 0, rotation: 0, duration: 0.55, ease: 'power3.out' });
    }

    if (status) status.textContent = `Captured silently — ${caption}.`;
  });
}
