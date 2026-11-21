/* ========================================================================
   hhss.js — enhancement layer for the Hush Hush Snap Snap page.
   Contract: complete and readable with zero JavaScript; Reduce Motion or
   ?static=1 gets the settled page. The countdown demo is user-initiated
   and works in static mode without the flash. Motion itself — the
   cross-document hero morph and the scroll-driven lights-down/aperture
   reveals — lives entirely in hhss.css; this file only reports capability.

   Diagnostics (on-device, zero network): the shared policy sets
   html[data-motion]; this file adds html[data-scroll-timeline] ('yes' |
   'no'), which the CSS keys off of. window.__hhssMotion (frozen) mirrors
   both, plus View Transition support, for QA tooling. ?debug=1 prints one
   console.debug line with that object; nothing else logs, ever.

   The page itself never plays audio — by design. The audio cue toggle
   describes what the app does; this page stays at 0 dB.
   ======================================================================== */

/* The motion gate is the site-wide policy in assets/js/motion.js: it sets
   html[data-motion] ('full' | 'reduced' | 'static' | 'paused'), the CSS
   motion here is opt-in on 'full', and a live change flips the attribute
   without a reload. isStatic() is read at use time by the demo and the
   frame counter for the same reason. This file adds the page's own
   capability diagnostics. */
import { isStatic, onMotionChange } from '../assets/js/motion.js';
import { initQuietControl } from '../assets/js/quiet.js';

const params = new URLSearchParams(window.location.search);
const supportsScrollTimeline = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()');
document.documentElement.dataset.scrollTimeline = supportsScrollTimeline ? 'yes' : 'no';
window.__hhssMotion = Object.freeze({
  get motion() { return document.documentElement.dataset.motion; },
  scrollTimeline: supportsScrollTimeline,
  sameDocumentVT: 'startViewTransition' in document,
  crossDocumentVT: 'CSSViewTransitionRule' in window
});
if (params.has('debug')) console.debug('[hhss] motion', { ...window.__hhssMotion });

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

    if (isStatic()) {
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

    if (!isStatic() && flash && cueState.visual) {
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

/* ------------------------------------------------------------------------
   Transfer Hush, from this page (W24). The card plays real Transfer Hush
   codes carrying one photograph, so a visitor with the app can receive it
   by pointing an iPhone at the screen. The frames were rendered by the
   app's own encoder and are only played here; nothing is encoded in the
   browser (tools/transfer-hush/manifest.json records what they are).

   Rules, all of them deliberate:
   - Nothing moves until the visitor presses the button, and the frame data
     is not fetched until then.
   - Unavailable whenever motion is not 'full' (Reduce Motion, the visitor's
     Pause, ?static=1): the still code and a sentence remain. A change of
     that state while sending stops it.
   - Desktop widths with a mouse or trackpad only; a phone cannot scan its
     own screen. Narrowing the window while sending stops it.
   - Stops when the tab is hidden, and by itself after three loops, so a
     changing pattern is never left running unattended.
   - Two codes a second (the app sends three) at 80% contrast.
   ------------------------------------------------------------------------ */
function initTransferHush() {
  const root = document.getElementById('th-demo');
  if (!root) return;
  const still = document.getElementById('th-still');
  const canvas = document.getElementById('th-canvas');
  const button = document.getElementById('th-toggle');
  const off = document.getElementById('th-off');
  const status = document.getElementById('th-status');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const MODULES = 117, QUIET = 4, SCALE = 3;
  const BYTES_PER_FRAME = Math.ceil(MODULES * MODULES / 8);
  const CODES_PER_SECOND = 2, MAX_LOOPS = 3;
  const DARK = 'rgb(94, 94, 94)'; // Michelson contrast 0.8 against white
  const FRAMES_URL = 'images/transfer-hush/frames.bin';
  const START_LABEL = button.textContent;
  const desktop = window.matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)');

  let frames = null, count = 0, index = 0, shown = 0, timer = null, loading = false;

  function draw(i) {
    const side = (MODULES + QUIET * 2) * SCALE;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, side, side);
    ctx.fillStyle = DARK;
    const base = i * BYTES_PER_FRAME;
    for (let y = 0; y < MODULES; y++) {
      let run = -1;
      for (let x = 0; x <= MODULES; x++) {
        const bit = y * MODULES + x;
        const dark = x < MODULES && ((frames[base + (bit >> 3)] >> (7 - (bit & 7))) & 1) === 1;
        if (dark && run < 0) run = x;
        if (!dark && run >= 0) {
          ctx.fillRect((run + QUIET) * SCALE, (y + QUIET) * SCALE, (x - run) * SCALE, SCALE);
          run = -1;
        }
      }
    }
    root.dataset.frame = String(i);
  }

  function setState(state, message) {
    root.dataset.state = state;
    const sending = state === 'sending';
    still.hidden = sending;
    canvas.hidden = !sending;
    button.textContent = sending ? 'Stop sending' : START_LABEL;
    if (message !== undefined) status.textContent = message;
  }

  function stop(message) {
    if (timer) { window.clearInterval(timer); timer = null; }
    setState('idle', message);
  }

  function play() {
    index = 0; shown = 1;
    draw(0);
    setState('sending', 'Sending. Point your iPhone at the code.');
    timer = window.setInterval(() => {
      if (shown >= count * MAX_LOOPS) {
        stop('Stopped after three loops. Press the button to send again.');
        return;
      }
      index = (index + 1) % count;
      shown += 1;
      draw(index);
    }, 1000 / CODES_PER_SECOND);
  }

  async function start() {
    if (loading || timer || isStatic() || !desktop.matches) return;
    if (!frames) {
      loading = true;
      setState('loading', 'Loading the codes.');
      try {
        const response = await fetch(FRAMES_URL);
        if (!response.ok) throw new Error(String(response.status));
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length === 0 || bytes.length % BYTES_PER_FRAME !== 0) throw new Error('size');
        frames = bytes;
        count = bytes.length / BYTES_PER_FRAME;
      } catch {
        loading = false;
        stop('The codes could not be loaded. Check your connection and try again.');
        return;
      }
      loading = false;
      // The page may have been stilled, narrowed or hidden while loading.
      if (isStatic() || !desktop.matches || document.hidden) { stop(''); return; }
    }
    play();
  }

  function sync() {
    const available = !isStatic();
    root.hidden = false;
    button.hidden = !available;
    off.hidden = available;
    if (!available && timer) stop('Stopped, because motion is off on this page.');
    else if (available && !timer && !loading) status.textContent = '';
  }

  button.addEventListener('click', () => { if (timer) stop('Stopped.'); else start(); });
  onMotionChange(sync);
  desktop.addEventListener('change', () => { if (!desktop.matches && timer) stop(''); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && timer) stop('Stopped while this tab was hidden.'); });
  window.addEventListener('pagehide', () => { if (timer) stop(''); });
  sync();
}

initQuietControl();
initDemo();
initTransferHush();

/* ========================================================================
   2. Aperture settle — a jump must not park a photograph half-open.
   The reveal is scroll-driven, so a programmatic jump (a frame-counter
   step, a hash landing) can stop a photograph mid-aperture and hold it
   there for as long as the reader stays put. Once the jump has settled,
   any reveal caught in flight is pinned at the value it reached, handed to
   the transition in .settled, and left to finish on its own; it re-arms
   when the photograph leaves the viewport, so scrolling back replays it.
   Ordinary scrolling is untouched: the reader is in control there.
   No-JS, ?static=1 and Reduce Motion never reach this — the CSS gate has
   already settled the page and there is nothing in flight to catch.
   ======================================================================== */

function initApertureSettle() {
  var noop = function () {};
  var captures = Array.prototype.slice.call(document.querySelectorAll('img.capture'));
  if (!captures.length || typeof captures[0].getAnimations !== 'function') { return noop; }

  var apertureOf = function (img) {
    var running = img.getAnimations();
    for (var i = 0; i < running.length; i++) {
      // CSSTransition objects have no animationName, so they fall through.
      if (running[i].animationName === 'aperture') { return running[i]; }
    }
    return null;
  };

  var inFlight = function (img) {
    var anim = apertureOf(img);
    if (!anim || !anim.effect) { return false; }
    var progress = anim.effect.getComputedTiming().progress;
    return typeof progress === 'number' && progress > 0.001 && progress < 0.999;
  };

  var onScreen = function (img) {
    var box = img.getBoundingClientRect();
    return box.bottom > 0 && box.top < window.innerHeight;
  };

  var settle = function (img) {
    var computed = window.getComputedStyle(img);
    // Pin the value the scroll left it at, so the transition in .settled has
    // somewhere to travel from; without this, dropping the animation would
    // snap straight to the open state.
    img.style.clipPath = computed.clipPath;
    img.style.transform = computed.transform;
    img.classList.add('settled');
    void img.getBoundingClientRect();
    img.style.clipPath = '';
    img.style.transform = '';
  };

  // Re-arm: a photograph that has left the viewport goes back to the
  // scroll-driven reveal, so the effect is not spent for the rest of the visit.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting && entry.target.classList.contains('settled')) {
          entry.target.classList.remove('settled');
          entry.target.style.clipPath = '';
          entry.target.style.transform = '';
        }
      });
    });
    captures.forEach(function (img) { io.observe(img); });
  }

  /* Wait for the page to stop moving: a smooth jump takes a moment, and a
     jump to where we already are produces no scroll events at all. Single
     flight, so holding down the arrow key cannot stack up listeners. */
  var idle = null;
  var ceiling = null;
  var pending = false;

  var sweep = function () {
    clearTimeout(idle);
    clearTimeout(ceiling);
    window.removeEventListener('scroll', bump);
    pending = false;
    captures.forEach(function (img) {
      if (!img.classList.contains('settled') && onScreen(img) && inFlight(img)) { settle(img); }
    });
  };

  var bump = function () { clearTimeout(idle); idle = setTimeout(sweep, 140); };

  var settleAfterJump = function () {
    clearTimeout(idle);
    idle = setTimeout(sweep, 400);
    if (pending) { return; }
    pending = true;
    window.addEventListener('scroll', bump, { passive: true });
    ceiling = setTimeout(sweep, 2000);
  };

  // A deep link lands the same way a frame-counter step does.
  if (window.location.hash) { settleAfterJump(); }
  window.addEventListener('hashchange', settleAfterJump);

  return settleAfterJump;
}

var settleAfterJump = initApertureSettle();

/* ========================================================================
   3. Frame counter — the page as a contact sheet. Optional enhancement:
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

  /* Visibility: the pill appears once the hero has left the viewport, so it
     never covers the first screen (the Japan/Korea note, the hero lede). On
     phones it also steps aside while scrolling down and returns on scroll up.
     data-shown is the single switch; CSS turns it into visibility (out of the
     tab order and assistive tech when hidden) and, under full motion only, a
     crossfade. */
  var hero = document.querySelector('.hero');
  var heroGone = !hero || !('IntersectionObserver' in window);
  var scrollHidden = false;
  var stepping = false;
  var steppingTimer = null;
  var phone = window.matchMedia('(max-width: 767px)');
  var applyShown = function () { bar.dataset.shown = String(heroGone && !scrollHidden); };

  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { heroGone = !entry.isIntersecting; });
      applyShown();
    }).observe(hero);
  }

  // A programmatic step scrolls down on purpose: keep the pill up until that
  // scroll has settled, so "next" can be tapped again straight away.
  var holdForStep = function (ms) {
    stepping = true;
    scrollHidden = false;
    clearTimeout(steppingTimer);
    steppingTimer = setTimeout(function () { stepping = false; }, ms);
  };

  var lastY = window.scrollY;
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    var dy = y - lastY;
    if (stepping) { holdForStep(160); lastY = y; return; }
    if (Math.abs(dy) < 8) { return; }
    lastY = y;
    scrollHidden = phone.matches && dy > 0 && y > 0;
    applyShown();
  }, { passive: true });
  bar.addEventListener('focusin', function () { scrollHidden = false; applyShown(); });
  var onPhoneChange = function () { scrollHidden = false; applyShown(); };
  if (phone.addEventListener) { phone.addEventListener('change', onPhoneChange); }
  applyShown();

  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var render = function () {
    label.textContent = 'frame ' + pad(current + 1) + ' / ' + pad(frames.length);
  };

  var step = function (dir) {
    var target = Math.min(frames.length - 1, Math.max(0, current + dir));
    if (target === current) { return; }
    current = target;
    holdForStep(700);
    frames[current].el.scrollIntoView({ behavior: isStatic() ? 'auto' : 'smooth', block: 'start' });
    settleAfterJump();
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
