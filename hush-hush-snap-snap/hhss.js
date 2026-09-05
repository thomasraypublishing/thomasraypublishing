/* ========================================================================
   hhss.js — enhancement layer for the Hush Hush Snap Snap page.
   Contract: complete and readable with zero JavaScript; Reduce Motion or
   ?static=1 gets the settled page. The countdown demo is user-initiated
   and works in static mode without the flash. Motion itself — the
   cross-document hero morph and the scroll-driven lights-down/aperture
   reveals — lives entirely in hhss.css; this file only reports capability.

   Diagnostics (on-device, zero network): sets html[data-motion] to
   'full' | 'reduced' | 'static' and html[data-scroll-timeline] to 'yes' |
   'no', which the CSS keys off of. window.__hhssMotion (frozen) mirrors
   both, plus View Transition support, for QA tooling. ?debug=1 prints one
   console.debug line with that object; nothing else logs, ever.

   The page itself never plays audio — by design. The audio cue toggle
   describes what the app does; this page stays at 0 dB.
   ======================================================================== */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = reduceMotion || new URLSearchParams(window.location.search).has('static');

/* Diagnostics only — CSS drives the motion; see the header comment. */
const supportsScrollTimeline = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()');
const motion = reduceMotion ? 'reduced' : (staticMode ? 'static' : 'full');
document.documentElement.dataset.motion = motion;
document.documentElement.dataset.scrollTimeline = supportsScrollTimeline ? 'yes' : 'no';
window.__hhssMotion = Object.freeze({ motion, scrollTimeline: supportsScrollTimeline,
  sameDocumentVT: 'startViewTransition' in document,
  crossDocumentVT: typeof CSS !== 'undefined' && CSS.supports('view-transition-name: hero-work') });
if (new URLSearchParams(location.search).has('debug')) console.debug('[hhss] motion', window.__hhssMotion);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ========================================================================
   1. The countdown demo — three independent cues, exactly like the app.
   ======================================================================== */

/* Real captures — shot by Sean, dropped into the demo's photo pool. */
const POLAROIDS = ['capture-01', 'capture-02', 'capture-03'];

function initDemo() {
  const demo = document.getElementById('demo');
  if (!demo) return;

  const switches = Array.from(demo.querySelectorAll('.switch'));
  const startBtn = document.getElementById('demo-start');
  const countEl = document.getElementById('demo-count');
  const progressEl = document.getElementById('demo-progress');
  const captionEl = document.getElementById('demo-caption');
  const statusEl = document.getElementById('demo-status');
  const caught = document.getElementById('caught');
  const flash = document.getElementById('flash');
  if (!startBtn || !countEl || !progressEl) return;

  const cueState = { visual: true, audio: false, haptic: true };

  switches.forEach((sw) => {
    sw.addEventListener('click', () => {
      const cue = sw.dataset.cue;
      cueState[cue] = !cueState[cue];
      sw.setAttribute('aria-checked', String(cueState[cue]));
      if (cue === 'visual') countEl.classList.toggle('dark', !cueState.visual);
      updateCaption('idle');
    });
  });

  function updateCaption(mode) {
    if (!captionEl) return;
    if (mode === 'running') {
      const bits = [];
      if (cueState.audio) bits.push('the app would speak the count');
      if (cueState.haptic) bits.push('your wrist would tap along');
      if (!cueState.visual) bits.push('screen cues off, the room stays dark');
      captionEl.textContent = bits.length ? bits.join(' / ') : 'every cue off, perfectly invisible';
    } else {
      captionEl.textContent = '';
    }
  }

  let running = false;
  let shots = 0;

  startBtn.addEventListener('click', async () => {
    if (running) return;
    running = true;
    startBtn.disabled = true;
    updateCaption('running');
    if (statusEl) statusEl.textContent = 'Timer started. Three seconds.';

    const total = 3000;
    const t0 = performance.now();
    let raf = null;
    const tick = () => {
      const p = Math.min((performance.now() - t0) / total, 1);
      progressEl.style.width = (p * 100).toFixed(1) + '%';
      const remaining = Math.max(3 - Math.floor(p * 3), 1);
      countEl.textContent = String(remaining);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    if (staticMode) {
      // No animation: step through the states instantly but legibly.
      for (const n of [3, 2, 1]) {
        countEl.textContent = String(n);
        progressEl.style.width = ((4 - n) / 3 * 100).toFixed(0) + '%';
        await wait(340);
      }
    } else {
      countEl.textContent = '3';
      raf = requestAnimationFrame(tick);
      await wait(total);
      if (raf) cancelAnimationFrame(raf);
    }

    progressEl.style.width = '100%';
    countEl.textContent = '';

    if (!staticMode && flash && cueState.visual) {
      // The flash is a visual cue too — visual off means the room stays dark.
      flash.classList.add('fire');
      flash.addEventListener('animationend', () => flash.classList.remove('fire'), { once: true });
    }

    if (caught && shots < 3) {
      const name = POLAROIDS[(shots + Math.floor(Math.random() * 2)) % POLAROIDS.length];
      const shot = document.createElement('div');
      shot.className = 'shot';
      shot.style.setProperty('--tilt', ((Math.random() * 8) - 4).toFixed(1) + 'deg');
      const img = document.createElement('img');
      img.src = 'images/' + name + '.webp';
      img.alt = 'A photo caught by the demo timer';
      img.width = 96; img.height = 96;
      shot.appendChild(img);
      caught.appendChild(shot);
      shots++;
    }

    if (statusEl) statusEl.textContent = 'Captured, silently. The photo joined the row below the demo.';
    updateCaption('idle');
    progressEl.style.width = '0%';
    countEl.textContent = '3';
    startBtn.disabled = false;
    running = false;
  });
}

initDemo();

/* ========================================================================
   2. Frame counter — the page as a contact sheet. Optional enhancement:
   scrolling is untouched; Left/Right arrows and the pill buttons step
   between sections. Hidden entirely without JS.
   ======================================================================== */

function initFrameCounter() {
  var bar = document.getElementById('frame-counter');
  var label = document.getElementById('frame-label');
  var status = document.getElementById('frame-status');
  var prev = document.getElementById('frame-prev');
  var next = document.getElementById('frame-next');
  if (!bar || !label) { return; }

  var frames = [
    { id: 'hero-h', name: 'Top' },
    { id: 'quiet', name: 'Quiet when it matters' },
    { id: 'camera', name: 'The camera underneath' },
    { id: 'handsoff', name: 'Be in the picture' },
    { id: 'everyone', name: 'Made for everyone' },
    { id: 'deep-cuts', name: 'Deep cuts' },
    { id: 'snappy-kit', name: 'The Snappy Kit' },
    { id: 'private', name: 'Private by design' },
    { id: 'plans', name: 'Plans' }
  ].map(function (f) { return { el: document.getElementById(f.id), name: f.name }; })
   .filter(function (f) { return f.el; });
  if (frames.length < 2) { return; }

  bar.hidden = false;
  var current = 0;

  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var render = function () {
    label.textContent = 'frame ' + pad(current + 1) + ' / ' + pad(frames.length);
  };

  var step = function (dir) {
    var target = Math.min(frames.length - 1, Math.max(0, current + dir));
    if (target === current) { return; }
    current = target;
    frames[current].el.scrollIntoView({ behavior: staticMode ? 'auto' : 'smooth', block: 'start' });
    render();
    if (status) {
      status.textContent = 'Frame ' + (current + 1) + ' of ' + frames.length + ': ' + frames[current].name;
    }
  };

  prev.addEventListener('click', function () { step(-1); });
  next.addEventListener('click', function () { step(1); });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') { return; }
    if (event.metaKey || event.ctrlKey || event.altKey) { return; }
    var active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.getAttribute('role') === 'switch' || active.isContentEditable)) { return; }
    event.preventDefault();
    step(event.key === 'ArrowRight' ? 1 : -1);
  });

  // Scrollspy keeps the counter honest; silent on scroll (no announcements).
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var idx = frames.findIndex(function (f) { return f.el === entry.target; });
        if (idx !== -1) { current = idx; render(); }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    frames.forEach(function (f) { io.observe(f.el); });
  }

  render();
}

initFrameCounter();
