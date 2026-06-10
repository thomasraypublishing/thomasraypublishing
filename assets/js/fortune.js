/* ========================================================================
   fortune.js — The Device's hero-card divination, elevated.
   Tap the pyramid: the starfield pulses outward from the tap point and
   the fortune types itself in, character by character.
   ======================================================================== */

const FORTUNES = [
  "The moon is waxing. Return the call you've been avoiding.",
  "A small fluffy ally arrives within 48 hours.",
  "Do not sign the thing on Tuesday.",
  "Your second-best idea this week is actually the best one.",
  "A stranger will laugh at your joke. Accept the omen.",
  "The east-facing window knows something. Sit by it.",
  "Buy the book with the blue spine.",
  "You are closer than you think. Keep your grip loose.",
  "Venus is cooperative. Send the message before noon.",
  "Forgive the small thing — it's older than it looks.",
];

export function initFortune({ atmosphere, motion }) {
  const specimen = document.getElementById('device-specimen');
  const fortuneEl = document.getElementById('fortune-text');
  if (!specimen || !fortuneEl) return;

  let lastIdx = -1;
  let typing = null;

  specimen.addEventListener('click', (e) => {
    e.preventDefault();

    let idx;
    do { idx = Math.floor(Math.random() * FORTUNES.length); } while (idx === lastIdx);
    lastIdx = idx;
    const text = FORTUNES[idx];

    atmosphere?.pulse(e.clientX, e.clientY, 1);

    fortuneEl.classList.add('show');
    if (typing) typing.kill();

    if (motion && window.gsap) {
      fortuneEl.textContent = '';
      const chars = text.split('');
      const obj = { n: 0 };
      typing = gsap.to(obj, {
        n: chars.length,
        duration: Math.min(1.6, chars.length * 0.028),
        ease: 'none',
        onUpdate: () => { fortuneEl.textContent = chars.slice(0, Math.round(obj.n)).join(''); },
      });
    } else {
      fortuneEl.textContent = text;
    }
  });
}
