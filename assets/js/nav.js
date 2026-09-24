/* ========================================================================
   nav.js — mobile overlay menu (circular cat-reveal) + nav condense on
   scroll. Modal dialog while open: own Close button, Close→links→Close
   focus cycle, background inert, Escape closes, resize-while-open closes.

   Open/close: a WAAPI clip-path circle centred on #menu-btn + a leading
   ginger ring + content fade, ported from prototypes/transitions/cat-menu.js
   (QA'd Chromium 153 + WebKit 26.6), replacing the old GSAP fade. Timing in
   reveals.css (--cat-reveal-ms/--cat-close-ms/--cat-reveal-ease); ?catms=NNN
   overrides. Content wrapper + ring aren't in markup — built here at init.
   Motion off: open/close are instant, no WAAPI animation runs.
   ======================================================================== */

import { onMotionChange } from './motion.js';

function parseCssMs(raw, fallback) {
  const m = /^(-?[\d.]+)(ms|s)?$/.exec((raw || '').trim());
  if (!m) return fallback;
  const val = parseFloat(m[1]);
  return m[2] === 's' ? val * 1000 : val;
}

/** Read live, not cached: tokens zero out under Reduce Motion. */
function readTiming(direction) {
  const params = new URLSearchParams(window.location.search);
  const overrideMs = parseFloat(params.get('catms'));
  const cs = getComputedStyle(document.documentElement);
  const easing = cs.getPropertyValue('--cat-reveal-ease').trim() || 'cubic-bezier(0.65, 0, 0.35, 1)';
  if (!Number.isNaN(overrideMs) && overrideMs > 0) {
    return { duration: direction === 'open' ? overrideMs : overrideMs * 0.75, easing };
  }
  const openMs = parseCssMs(cs.getPropertyValue('--cat-reveal-ms'), 600);
  const closeMs = parseCssMs(cs.getPropertyValue('--cat-close-ms'), 450);
  return { duration: direction === 'open' ? openMs : closeMs, easing };
}

/** Circle origin at the button's centre; radius reaches the farthest corner. */
function clipOrigin(btn) {
  const rect = btn.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const corners = [[0, 0], [window.innerWidth, 0], [0, window.innerHeight], [window.innerWidth, window.innerHeight]];
  const r = Math.max(...corners.map(([cx, cy]) => Math.hypot(cx - x, cy - y)));
  return { x, y, r };
}

/** [a, b] for 'open', [b, a] for 'close' — every reveal keyframe pair is one of these. */
const flip = (direction, a, b) => (direction === 'open' ? [a, b] : [b, a]);

function buildClipKeyframes(direction, x, y, r) {
  return flip(direction, { clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${r}px at ${x}px ${y}px)` });
}

export function initNav({ motion }) {
  const btn = document.getElementById('menu-btn');
  const overlay = document.getElementById('menu-overlay');
  const bar = btn ? btn.closest('nav.top') : null;
  const links = overlay ? Array.from(overlay.querySelectorAll('a')) : [];
  const motionOn = () => (typeof motion === 'function' ? motion() : Boolean(motion));
  const narrow = window.matchMedia('(max-width: 720px)');
  let open = false;
  let inerted = [];
  let closeBtn = null;
  let contentWrap = null;
  let ring = null;
  let clipAnim = null;
  let contentAnim = null;
  let ringAnim = null;
  let ringFadeAnim = null;

  function setInert(on) {
    if (on) {
      // Nothing but the dialog stays reachable.
      const skip = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'TEMPLATE']);
      inerted = Array.from(document.body.children).filter((el) => el !== overlay && el !== bar && el !== ring && !el.inert && !skip.has(el.tagName));
      if (bar) inerted.push(...Array.from(bar.querySelectorAll('.brand, .navlinks, .motion-toggle')).filter((el) => !el.inert));
      inerted.forEach((el) => { el.inert = true; });
    } else {
      inerted.forEach((el) => { el.inert = false; });
      inerted = [];
    }
  }

  /** Same (x, y, r) as the clip-path; only transform: scale() animates. */
  function positionRing(x, y, r) {
    if (!ring) return;
    ring.style.left = `${x - r}px`;
    ring.style.top = `${y - r}px`;
    ring.style.width = `${2 * r}px`;
    ring.style.height = `${2 * r}px`;
  }

  // fill:'forwards'/'both' keeps compositing until cancelled.
  function cancelAnims() {
    [clipAnim, contentAnim, ringAnim, ringFadeAnim].forEach((a) => a && a.cancel());
    clipAnim = contentAnim = ringAnim = ringFadeAnim = null;
  }

  function showShell() {
    // clip-path reveal never touches opacity; .menu-overlay's resting opacity:0 must be lifted here.
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
  }
  function hideShell() {
    cancelAnims();
    overlay.style.display = 'none';
    overlay.style.opacity = '0';
    overlay.style.clipPath = '';
    if (contentWrap) contentWrap.style.opacity = '';
    if (ring) { ring.style.opacity = '0'; ring.style.transform = 'scale(0)'; }
  }

  /** Clip + content fade + ring, sharing duration/easing so they move in
      lockstep; reverse()-ing a running one keeps re-activation smooth. */
  function runReveal(direction) {
    if (clipAnim && clipAnim.playState === 'running') {
      [clipAnim, contentAnim, ringAnim, ringFadeAnim].forEach((a) => { try { a && a.reverse(); } catch { /* may already be idle */ } });
      return clipAnim.finished.catch(() => {});
    }
    cancelAnims();

    const { x, y, r } = clipOrigin(btn);
    const { duration, easing } = readTiming(direction);
    const keyframes = buildClipKeyframes(direction, x, y, r);
    overlay.style.clipPath = keyframes[0].clipPath;
    clipAnim = overlay.animate(keyframes, { duration, easing, fill: 'forwards' });

    if (contentWrap) {
      // Fade starts at 35% so a keyboard user sees focus sooner, behind the ring's 80-100% fade-out.
      const fadeDur = duration * (direction === 'open' ? 0.5 : 0.4);
      const fadeDelay = direction === 'open' ? duration * 0.35 : 0;
      const fadeKeyframes = flip(direction, { opacity: 0 }, { opacity: 1 });
      contentWrap.style.opacity = fadeKeyframes[0].opacity;
      contentAnim = contentWrap.animate(fadeKeyframes, {
        duration: fadeDur,
        delay: fadeDelay,
        easing: direction === 'open' ? 'ease-out' : 'ease-in',
        fill: 'forwards',
      });
    }

    if (ring) {
      positionRing(x, y, r);
      // Same duration/easing as the clip -> genuinely in lockstep.
      const scaleKeyframes = flip(direction, { transform: 'scale(0)' }, { transform: 'scale(1)' });
      ring.style.transform = scaleKeyframes[0].transform;
      ringAnim = ring.animate(scaleKeyframes, { duration, easing, fill: 'both' });

      // Fades out over the reveal's last 20%; in over the close's first 20%.
      const ringFadeDur = duration * 0.2;
      const ringFadeDelay = direction === 'open' ? duration * 0.8 : 0;
      const ringFadeKeyframes = flip(direction, { opacity: 1 }, { opacity: 0 });
      ring.style.opacity = ringFadeKeyframes[0].opacity;
      ringFadeAnim = ring.animate(ringFadeKeyframes, {
        duration: ringFadeDur,
        delay: ringFadeDelay,
        easing: 'linear',
        fill: 'both',
      });
    }
    return clipAnim.finished.catch(() => { /* cancelled by a later reveal */ });
  }

  /** Fully visible, resize-safe: clip-path:'none' has no geometry to go stale. */
  function settleFullyOpen() {
    cancelAnims();
    overlay.style.clipPath = 'none';
    if (contentWrap) contentWrap.style.opacity = '1';
    if (ring) { ring.style.opacity = '0'; ring.style.transform = 'scale(0)'; }
  }

  async function setOpen(next, { restoreFocus = true } = {}) {
    if (next === open) return;
    open = next;
    btn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
    if (open) {
      showShell();
      setInert(true);
      if (links[0]) links[0].focus(); // doesn't wait for the reveal to finish
      if (!motionOn()) { settleFullyOpen(); return; }
      await runReveal('open');
      if (open) settleFullyOpen(); // skip if a close overtook this and already ran hideShell()
    } else {
      setInert(false);
      if (restoreFocus && btn.offsetParent !== null) btn.focus();
      if (!motionOn()) { hideShell(); return; }
      await runReveal('close');
      if (!open) hideShell();
    }
  }

  function onKeydown(e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    if (e.key !== 'Tab') return;
    // Driven from the cycle: WebKit's Shift+Tab from a focused link went to body, not Close.
    const cycle = [closeBtn, ...links].filter(Boolean);
    const idx = cycle.indexOf(document.activeElement);
    const step = e.shiftKey ? -1 : 1;
    const next = idx === -1 ? (e.shiftKey ? cycle.length - 1 : 0) : (idx + step + cycle.length) % cycle.length;
    e.preventDefault();
    cycle[next].focus();
  }

  if (btn && overlay) {
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    if (!overlay.hasAttribute('aria-label')) overlay.setAttribute('aria-label', 'Site menu');
    overlay.removeAttribute('aria-hidden');

    // Own close control, replacing the decorative "Esc to close" hint.
    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'menu-close';
    closeBtn.setAttribute('aria-label', 'Close menu');
    closeBtn.textContent = 'Close';
    const hint = overlay.querySelector('.close-hint');
    if (hint) hint.remove();

    // Wraps everything but Close so open/close fades one element; not in markup.
    contentWrap = document.createElement('div');
    contentWrap.className = 'menu-content';
    Array.from(overlay.children).forEach((el) => contentWrap.appendChild(el));
    overlay.appendChild(contentWrap);
    overlay.prepend(closeBtn);
    closeBtn.addEventListener('click', () => setOpen(false));

    ring = document.createElement('div'); // leading ring: also not in markup
    ring.className = 'cat-reveal-ring';
    ring.setAttribute('aria-hidden', 'true');
    overlay.insertAdjacentElement('afterend', ring);

    btn.addEventListener('click', () => setOpen(!open));
    document.addEventListener('keydown', onKeydown);
    // A chosen link closes then navigates natively; focus is left to the browser.
    links.forEach((a) => a.addEventListener('click', () => setOpen(false, { restoreFocus: false })));
    narrow.addEventListener('change', (e) => {
      if (e.matches || !open) return;
      setOpen(false, { restoreFocus: false });
      const first = bar ? bar.querySelector('.navlinks a') : null;
      if (first && first.offsetParent !== null) first.focus();
    });

    // Motion off mid-reveal: finish() snaps each running Animation to its
    // end, resolving the `finished` promise setOpen() awaits.
    onMotionChange((state) => {
      if (state === 'full') return;
      [clipAnim, contentAnim, ringAnim, ringFadeAnim].forEach((a) => {
        if (!a) return;
        try { a.finish(); } catch { /* already finished/cancelled */ }
      });
    });
  }

  // Condense on scroll; publish height so anchors land under the bar.
  const nav = document.querySelector('nav.top');
  if (nav) {
    let last = false;
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY > 24;
      if (scrolled !== last) { last = scrolled; nav.classList.toggle('condensed', scrolled); }
    }, { passive: true });
    const publish = () => document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px');
    publish();
    if ('ResizeObserver' in window) new ResizeObserver(publish).observe(nav);
    else window.addEventListener('resize', publish);
  }
}
