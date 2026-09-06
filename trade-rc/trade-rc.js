/* ========================================================================
   trade-rc.js — enhancement layer for the Trade RC landing page.
   Gating philosophy (same contract as the parent site's main.js): the
   page is complete, readable, and navigable with zero JavaScript. Every
   effect below is additive, and Reduce Motion gets the settled page.
   ======================================================================== */

import { isStatic, onMotionChange, settleGsap } from '../assets/js/motion.js';
import { initQuietControl } from '../assets/js/quiet.js';

const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

/* ---------- helpers ---------- */

function srvLine(text, cls) {
  const p = document.createElement('p');
  p.className = 'ln ' + (cls || 'ln-srv');
  p.textContent = text;
  return p;
}

function sessionGet(key) {
  try { return window.sessionStorage.getItem(key); } catch { return null; }
}
function sessionSet(key, value) {
  try { window.sessionStorage.setItem(key, value); } catch { /* private mode */ }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ========================================================================
   1. Connect sequence — first visit only, skippable, never under
      Reduce Motion, never when arriving at a deep link (#beta etc.).
   ======================================================================== */

async function bootSequence() {
  if (isStatic() || window.location.hash || sessionGet('trc-booted')) return;
  sessionSet('trc-booted', '1');

  const boot = document.createElement('div');
  boot.className = 'boot';
  boot.setAttribute('aria-hidden', 'true');
  const inner = document.createElement('div');
  inner.className = 'boot-inner';
  boot.appendChild(inner);
  document.body.appendChild(boot);
  document.body.style.overflow = 'hidden';

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    boot.classList.add('boot-done');
    document.body.style.overflow = '';
    setTimeout(() => boot.remove(), 500);
  };
  boot.addEventListener('click', finish);
  window.addEventListener('keydown', finish, { once: true });
  onMotionChange((state) => { if (state !== 'full') finish(); });

  const lines = [
    { text: '* Connecting to irc.thomasraypublishing.com on port 6697…', cls: 'ln-sys' },
    { text: '* TLS handshake ok — this connection is encrypted', cls: 'ln-sys' },
    { text: '* Looking up your hostmask… you@somewhere-nice', cls: 'ln-sys' }
  ];

  await wait(120);
  for (const line of lines) {
    if (finished) return;
    inner.appendChild(srvLine(line.text, line.cls));
    await wait(420);
  }

  if (finished) return;
  const wel = srvLine('', 'ln-wel');
  inner.appendChild(wel);
  const welText = '*** Welcome to Trade RC — talk first, match later.';
  for (let i = 0; i <= welText.length; i += 2) {
    if (finished) return;
    wel.textContent = welText.slice(0, i);
    await wait(16);
  }
  wel.textContent = welText;

  const skip = document.createElement('p');
  skip.className = 'boot-skip';
  skip.textContent = 'click anywhere to skip';
  inner.appendChild(skip);

  await wait(420);
  finish();
}

/* ========================================================================
   2. Scroll reveals + the query-pane scrub (transform-only, no pin).
   ======================================================================== */

function initReveals() {
  if (!hasGsap || isStatic()) return;
  gsap.registerPlugin(ScrollTrigger);

  // Hidden means opacity 0, never visibility hidden: the section stays in
  // the accessibility tree before it scrolls into view, and focus arriving
  // inside it (a keyboard user tabbing to a link) reveals it at once (W14).
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    // Skip anything already in view (deep links) — never hide visible content.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    gsap.set(el, { opacity: 0, y: 18 });
    let trigger = null;
    const reveal = () => {
      if (trigger) trigger.kill();
      gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', overwrite: true });
    };
    trigger = ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: reveal });
    el.addEventListener('focusin', () => {
      if (trigger) trigger.kill();
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: 'opacity,transform' });
    }, { once: true });
  });

  // The /msg moment: the query pane slides in beside the room as you scroll.
  const dm = document.querySelector('#query-scene .q-dm');
  if (dm && window.matchMedia('(min-width: 881px)').matches &&
      dm.getBoundingClientRect().top > window.innerHeight) {
    gsap.set(dm, { opacity: 0, x: 44 });
    const slide = gsap.to(dm, {
      opacity: 1,
      x: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: '#query-scene',
        start: 'top 82%',
        end: 'top 40%',
        scrub: 0.4
      }
    });
    dm.addEventListener('focusin', () => {
      if (slide.scrollTrigger) slide.scrollTrigger.kill();
      slide.kill();
      gsap.set(dm, { clearProps: 'all' });
    }, { once: true });
  }

  window.addEventListener('load', () => ScrollTrigger.refresh());
}

/* ========================================================================
   3. Self-typing transcript in the #chat-rooms demo pane.
   ======================================================================== */

function initTyper() {
  if (isStatic() || !('IntersectionObserver' in window)) return;
  const pane = document.querySelector('[data-typer]');
  if (!pane) return;
  // Deep-linked past it already? Leave the static transcript alone.
  if (pane.getBoundingClientRect().top < window.innerHeight) return;

  const lines = Array.from(pane.querySelectorAll('.ln'));
  const scripts = lines.map((ln) => {
    const last = ln.lastChild;
    const isText = last && last.nodeType === Node.TEXT_NODE;
    return { ln, node: isText ? last : null, text: isText ? last.nodeValue : '' };
  });
  lines.forEach((ln) => { ln.style.visibility = 'hidden'; });
  scripts.forEach((s) => { if (s.node) s.node.nodeValue = ''; });

  // The whole transcript, at once: the settled state, and where a pause
  // arriving mid-typing lands (the typing auto-starts and runs past five
  // seconds, so it is the site's motion policy's business).
  const showAll = () => {
    lines.forEach((ln) => { ln.style.visibility = ''; });
    scripts.forEach((s) => { if (s.node) s.node.nodeValue = s.text; });
  };

  const play = async () => {
    for (const s of scripts) {
      if (isStatic()) { showAll(); return; }
      s.ln.style.visibility = '';
      if (s.node) {
        for (let i = 0; i <= s.text.length; i++) {
          if (isStatic()) { showAll(); return; }
          s.node.nodeValue = s.text.slice(0, i);
          await wait(24);
        }
      }
      await wait(s.node ? 380 : 520);
    }
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      if (isStatic()) showAll(); else play();
    });
  }, { threshold: 0.4 });
  io.observe(pane);
  onMotionChange((state) => { if (state !== 'full') showAll(); });
}

/* ========================================================================
   4. Dither-resolve portrait — the pixel art assembles from Bayer noise.
      Runs at 1/4 resolution with pixelated upscaling (it IS the look).
   ======================================================================== */

const BAYER8 = [
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21
];

function initDither() {
  if (isStatic() || !('IntersectionObserver' in window)) return;
  const img = document.getElementById('portrait-img');
  if (!img) return;

  const start = () => {
    try {
      const w = 200;
      const h = Math.round(w * (img.naturalHeight / img.naturalWidth));
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const octx = off.getContext('2d');
      octx.drawImage(img, 0, 0, w, h);
      const src = octx.getImageData(0, 0, w, h);

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;';
      const frame = img.closest('.frame');
      frame.style.position = 'relative';
      frame.appendChild(canvas);
      const ctx = canvas.getContext('2d');

      const out = ctx.createImageData(w, h);
      const dur = 1100;
      let t0 = null;

      const step = (ts) => {
        if (t0 === null) t0 = ts;
        const p = Math.min((ts - t0) / dur, 1);
        const cut = p * 64;
        const s = src.data, o = out.data;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if (BAYER8[(y % 8) * 8 + (x % 8)] <= cut) {
              o[i] = s[i]; o[i + 1] = s[i + 1]; o[i + 2] = s[i + 2]; o[i + 3] = s[i + 3];
            } else {
              // unresolved pixels read as the plum surface
              o[i] = 31; o[i + 1] = 10; o[i + 2] = 40; o[i + 3] = 255;
            }
          }
        }
        ctx.putImageData(out, 0, 0);
        if (p < 1) {
          requestAnimationFrame(step);
        } else {
          canvas.style.transition = 'opacity 0.3s ease';
          canvas.style.opacity = '0';
          setTimeout(() => canvas.remove(), 350);
        }
      };
      requestAnimationFrame(step);
    } catch {
      /* any failure: the plain <img> is already showing */
    }
  };

  const arm = () => {
    if (img.getBoundingClientRect().top < window.innerHeight) return; // already visible
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        start();
      });
    }, { threshold: 0.35 });
    io.observe(img);
  };

  if (img.complete && img.naturalWidth) arm();
  else img.addEventListener('load', arm, { once: true });
}

/* ========================================================================
   5. The prompt — a real input line that speaks slash commands.
   ======================================================================== */

const SECTIONS = {
  'chat-rooms': 'chat-rooms',
  'rooms': 'chat-rooms',
  'daily-matches': 'daily-matches',
  'matches': 'daily-matches',
  'profiles': 'profiles',
  'privacy': 'privacy-safety',
  'safety': 'privacy-safety',
  'tiers': 'tiers',
  'premium': 'tiers',
  'plus': 'tiers',
  'beta': 'beta'
};

function initPrompt() {
  const bar = document.getElementById('promptbar');
  const form = document.getElementById('prompt-form');
  const input = document.getElementById('prompt-input');
  const out = document.getElementById('prompt-out');
  const log = document.getElementById('prompt-log');
  if (!bar || !form || !input || !out || !log) return;

  bar.hidden = false;

  const say = (text) => {
    log.appendChild(srvLine(text));
    while (log.children.length > 30) log.removeChild(log.firstChild);
    out.hidden = false;
    out.scrollTop = out.scrollHeight;
  };

  const closeOut = () => { out.hidden = true; };

  const goTo = (id) => {
    const target = document.getElementById(id);
    if (!target) return false;
    target.scrollIntoView({ behavior: isStatic() ? 'auto' : 'smooth', block: 'start' });
    const heading = target.querySelector('h1, h2') || target;
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    return true;
  };

  const commands = {
    help() {
      say('*** commands: /join #chat-rooms | #daily-matches | #profiles | #privacy | #tiers | #beta');
      say('*** also: /whois traderc · /mode · /beta · /privacy · /terms · /support · /slap · /clear');
    },
    join(arg) {
      const key = (arg || '').replace(/^#/, '').toLowerCase();
      const id = SECTIONS[key];
      if (!id) { say('*** /join needs a channel. try /join #chat-rooms'); return; }
      say('*** Now talking in #' + key);
      closeOut();
      goTo(id);
    },
    whois() {
      say('*** traderc is Trade RC — a dating & chat app for gay and queer adults, 18+');
      say('*** registered to Thomas Ray Publishing LLC · status: TestFlight beta');
      say('*** on channels: #chat-rooms #daily-matches #profiles');
    },
    mode() {
      say('*** server modes: +privacy +safety +a11y — all three enforced, none optional');
      closeOut();
      goTo('privacy-safety');
    },
    beta() {
      say('*** Now accepting testers — the TestFlight link is below');
      closeOut();
      goTo('beta');
    },
    privacy() { window.location.href = 'privacy.html'; },
    terms() { window.location.href = 'terms.html'; },
    support() { window.location.href = 'support.html'; },
    slap() {
      say('* You slap the algorithm around a bit with a large trout');
      say('*** the algorithm has been slapped. your matches are unaffected.');
    },
    clear() {
      log.textContent = '';
      closeOut();
    }
  };

  const runCommand = () => {
    const raw = input.value.trim();
    input.value = '';
    if (!raw) return;
    if (!raw.startsWith('/')) {
      say('*** this demo prompt only speaks slash commands. try /help');
      return;
    }
    const [name, ...rest] = raw.slice(1).split(/\s+/);
    const cmd = commands[name.toLowerCase()];
    if (cmd) cmd(rest.join(' '));
    else say('*** /' + name + ': unknown command. try /help');
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runCommand();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      // explicit handler: some embedded webviews skip implicit form submission
      event.preventDefault();
      runCommand();
    } else if (event.key === 'Escape') {
      closeOut();
      input.blur();
    }
  });

  // IRC muscle memory: "/" anywhere focuses the prompt.
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) return;
    event.preventDefault();
    input.focus();
    input.value = '/';
  });

  document.addEventListener('click', (event) => {
    if (!out.hidden && !bar.contains(event.target)) closeOut();
  });
}

/* ========================================================================
   6. Tab-blur title flip.
   ======================================================================== */

function initTitleFlip() {
  const original = document.title;
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden
      ? "(1) #trade-rc — they're still talking"
      : original;
  });
}

/* ========================================================================
   boot order
   ======================================================================== */

initQuietControl();
bootSequence();
initReveals();
initTyper();
initDither();
initPrompt();
initTitleFlip();

/* A live policy change (Reduce Motion toggled mid-session, or the visitor's
   pause) settles the scroll choreography without a reload; the CSS gate
   stills the ambient animation and user-triggered flourishes read
   isStatic() when they fire. */
onMotionChange((state) => {
  if (state !== 'full' && hasGsap) settleGsap({ clear: ['[data-reveal]', '#query-scene .q-dm'] });
});
