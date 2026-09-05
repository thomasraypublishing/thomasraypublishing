/* ========================================================================
   quiet.js — the visible half of the motion policy: a "Pause motion" /
   "Play motion" button in the top bar of every page with ambient motion
   (WCAG 2.2.2). It flips the site-wide 'paused' state in motion.js, which
   is remembered and applies to every page. The button stays hidden when
   the OS or ?static=1 has already stilled the page: there is nothing to
   pause. Without JavaScript nothing moves, so the button never shows.
   ======================================================================== */

import { canPause, isPaused, setPaused, onMotionChange } from './motion.js';

export function initQuietControl() {
  const buttons = Array.from(document.querySelectorAll('[data-motion-toggle]'));
  if (!buttons.length) return;

  // A polite live region confirms the change for screen-reader users; the
  // button's own name describes the next action, as a pause/play control should.
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;';
  buttons[0].insertAdjacentElement('afterend', status);

  function render() {
    const paused = isPaused();
    buttons.forEach((btn) => {
      btn.hidden = !canPause();
      btn.dataset.state = paused ? 'paused' : 'playing';
      const label = btn.querySelector('.lbl');
      if (label) label.textContent = paused ? 'Play motion' : 'Pause motion';
      btn.setAttribute('title', paused ? 'Resume the page’s ambient motion' : 'Stop the page’s ambient motion');
    });
  }

  buttons.forEach((btn) => btn.addEventListener('click', () => {
    const next = !isPaused();
    setPaused(next);
    status.textContent = next ? 'Motion paused across the site.' : 'Motion resumed.';
  }));

  onMotionChange(render);
  render();
}
