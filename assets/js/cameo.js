/* ========================================================================
   cameo.js — Captain Henry Gingersnaps makes an appearance.
   Once per visit, after the reader has settled in, Henry's profile rises
   quietly from the bottom corner — a dog peeking over the counter — holds
   for a moment, and sinks back down. Typing "henry" summons him anytime.
   Decorative only: aria-hidden, pointer-events none, skipped entirely
   under Reduce Motion (except the typed summon, which appears statically).
   ======================================================================== */

const HOLD_SECONDS = 3.2;
const FIRST_VISIT_DELAY_MS = 32_000;

export function initCameo({ motion }) {
  const motionOn = () => (typeof motion === 'function' ? motion() : Boolean(motion));
  let el = null;
  let busy = false;

  function ensureEl() {
    if (el) return el;
    el = document.createElement('img');
    el.src = 'images/opt/henry-cameo.webp';
    el.alt = '';
    el.setAttribute('aria-hidden', 'true');
    el.className = 'henry-cameo';
    document.body.appendChild(el);
    return el;
  }

  function peek() {
    if (busy) return;
    busy = true;
    const henry = ensureEl();

    if (motionOn() && window.gsap) {
      gsap.timeline({ onComplete: () => { busy = false; } })
        .set(henry, { y: 0, yPercent: 100, autoAlpha: 1, rotation: 4 })
        .to(henry, { yPercent: 8, rotation: 0, duration: 1.1, ease: 'power3.out' })
        .to(henry, { yPercent: 4, duration: HOLD_SECONDS, ease: 'sine.inOut' })
        .to(henry, { yPercent: 100, rotation: 3, duration: 0.8, ease: 'power2.in' });
    } else {
      // Reduce Motion: a still appearance, no travel.
      henry.style.transform = 'translateY(16%)';
      henry.style.opacity = '1';
      setTimeout(() => {
        henry.style.opacity = '0';
        busy = false;
      }, HOLD_SECONDS * 1000);
    }
  }

  // The scheduled visit — motion users only; he shouldn't startle anyone.
  // The scheduled visit checks the policy when it fires, not when it was booked.
  if (motionOn()) setTimeout(() => { if (motionOn()) peek(); }, FIRST_VISIT_DELAY_MS);

  // The summons: type his name anywhere.
  let buffer = '';
  document.addEventListener('keydown', (e) => {
    if (e.key.length !== 1) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-5);
    if (buffer === 'henry') peek();
  });
}
