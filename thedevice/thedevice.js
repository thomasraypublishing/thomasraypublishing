/* ========================================================================
   thedevice.js — enhancement layer for The Device page.
   Contract: complete and readable with zero JavaScript; Reduce Motion or
   ?static=1 gets the settled page. The reading ritual and the memory demo
   are user-initiated and stay available in static mode (they are content,
   not decoration) — only their flourishes are toned down.

   Honesty rails (TD-227): readings are entertainment, never predictions;
   nothing here claims accuracy or evolution.
   ======================================================================== */

import { isStatic, onMotionChange, settleGsap } from '../assets/js/motion.js';
import { initQuietControl } from '../assets/js/quiet.js';

const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ========================================================================
   1. Starfield parallax — three fixed layers, transform-only.
   ======================================================================== */

function initStarfield() {
  if (isStatic()) return;
  const layers = Array.from(document.querySelectorAll('.starlayer'));
  if (!layers.length || !window.matchMedia('(pointer: fine)').matches) return;
  let raf = null;
  window.addEventListener('mousemove', (event) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      layers.forEach((layer, i) => {
        const depth = (i + 1) * 7;
        layer.style.transform = `translate(${(-x * depth).toFixed(1)}px, ${(-y * depth).toFixed(1)}px)`;
      });
    });
  });
}

/* ========================================================================
   2. The ritual — tap the pyramid, receive tonight's line.
      All inputs are computed client-side: real moon phase (synodic
      arithmetic), season, weekday, and the digit-sum of today's date.
      The oracle line is seeded by the date, so the whole day shares one
      reading — the page keeps no state and calls no network.
   ======================================================================== */

const PHASES = [
  'new moon', 'waxing crescent', 'first quarter', 'waxing gibbous',
  'full moon', 'waning gibbous', 'last quarter', 'waning crescent'
];

function moonPhase(date) {
  // Synodic month from the 2000-01-06 18:14 UTC new moon.
  const synodic = 29.53058867;
  const ref = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - ref) / 86400000;
  const age = ((days % synodic) + synodic) % synodic;
  const index = Math.floor(((age / synodic) * 8 + 0.5)) % 8;
  return PHASES[index];
}

function seasonFor(date) {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

function dayNumber(date) {
  let n = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  while (n > 9) {
    n = String(n).split('').reduce((a, d) => a + Number(d), 0);
  }
  return n;
}

/* Entertainment-register flavor lines. Never predictions of real events. */
const ORACLE = [
  'The %PHASE% favors unfinished lists. Leave one thing gloriously undone.',
  'Tonight the sky files no complaints. Neither should you.',
  'A %SEASON% evening, a %PHASE% — the cosmos suggests dessert first.',
  'The number %N% has been following you politely. Let it walk beside you.',
  'The stars are mostly hydrogen, and still they show up every night. Be the stars.',
  'Under a %PHASE%, lost objects prefer the second place you look.',
  'The cosmos has reviewed your week and found it charming.',
  'Some doors are pull. Tonight, the universe recommends checking.',
  'A message you were composing in your head is ready. The %PHASE% will hold your place.',
  'The %SEASON% sky keeps your secrets badly and your hopes well.',
  'Somewhere, a kettle is about to sing. The number %N% approves of tea.',
  'The pyramid has seen your browser tabs. It forgives you.'
];

function initRitual() {
  const btn = document.getElementById('pyramid-btn');
  const inputsEl = document.getElementById('reading-inputs');
  const lineEl = document.getElementById('oracle-line');
  const announceEl = document.getElementById('oracle-announce');
  if (!btn || !inputsEl || !lineEl) return;

  const now = new Date();
  const phase = moonPhase(now);
  const season = seasonFor(now);
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const n = dayNumber(now);

  let consulted = false;

  const announce = (text) => { if (announceEl) announceEl.textContent = text; };

  btn.addEventListener('click', async () => {
    if (consulted) {
      lineEl.textContent = 'One reading per visit. The app pours a fresh one every day.';
      announce('One reading per visit. The app pours a fresh one every day.');
      return;
    }
    consulted = true;

    if (!isStatic()) {
      btn.classList.add('consulting');
      btn.addEventListener('animationend', () => btn.classList.remove('consulting'), { once: true });
    }

    const sep = '<span class="sep" aria-hidden="true">·</span>';
    inputsEl.innerHTML =
      `<span>${phase}</span>${sep}<span>${weekday}</span>${sep}<span>${season}</span>${sep}<span>today's number: ${n}</span>`;

    const seed = now.getFullYear() * 366 + now.getMonth() * 31 + now.getDate();
    const raw = ORACLE[seed % ORACLE.length]
      .replaceAll('%PHASE%', phase)
      .replaceAll('%SEASON%', season)
      .replaceAll('%N%', String(n));

    // Screen readers get the whole line exactly once; the typewriter is visual.
    announce(`Tonight: ${phase}, ${weekday}, ${season}, number ${n}. ${raw}`);

    if (isStatic()) {
      lineEl.textContent = raw;
      return;
    }
    await wait(560);
    lineEl.textContent = '';
    for (let i = 0; i <= raw.length; i++) {
      lineEl.textContent = raw.slice(0, i);
      await wait(20);
    }
  });
}

/* ========================================================================
   3. The Daily Challenge demo — three rounds of the pyramid's memory
      game (the app climbs from 3 to 20). Fully keyboard accessible;
      status changes announce via the aria-live node.
   ======================================================================== */

function initChallenge() {
  const board = document.getElementById('challenge-board');
  const status = document.getElementById('challenge-status');
  const startBtn = document.getElementById('challenge-start');
  if (!board || !status || !startBtn) return;

  const bricks = Array.from(board.querySelectorAll('.brick'));
  const lengths = [3, 4, 5];
  let sequence = [];
  let inputIndex = 0;
  let round = 0;
  let accepting = false;
  // Every Start/Restart opens a new session. Async continuations carry the
  // session they started in and bail once it is stale, so a restart during
  // playback, the success delay, or the retry delay can never overlap a
  // new round (W09).
  let session = 0;
  const alive = (mine) => mine === session;

  const setBricksEnabled = (on) => bricks.forEach((b) => { b.disabled = !on; });
  const clearLit = () => bricks.forEach((b) => b.classList.remove('lit'));
  setBricksEnabled(false);

  const light = async (brick, ms, mine) => {
    brick.classList.add('lit');
    await wait(ms);
    if (!alive(mine)) return;
    brick.classList.remove('lit');
  };

  const playback = async (mine) => {
    accepting = false;
    setBricksEnabled(false);
    status.textContent = `Round ${round + 1} — watch the pyramid.`;
    await wait(700);
    if (!alive(mine)) return;
    for (const idx of sequence) {
      await light(bricks[idx], isStatic() ? 300 : 420, mine);
      if (!alive(mine)) return;
      await wait(isStatic() ? 120 : 170);
      if (!alive(mine)) return;
    }
    accepting = true;
    inputIndex = 0;
    setBricksEnabled(true);
    status.textContent = `Round ${round + 1} — your turn. ${sequence.length} stones.`;
  };

  const startRound = async (mine) => {
    const extra = [];
    while (extra.length < lengths[round]) {
      const pick = Math.floor(Math.random() * bricks.length);
      if (extra[extra.length - 1] !== pick) extra.push(pick);
    }
    sequence = extra;
    await playback(mine);
  };

  startBtn.addEventListener('click', () => {
    session += 1; // every pending continuation is now stale
    accepting = false;
    clearLit();
    board.classList.remove('shake');
    round = 0;
    startBtn.textContent = 'Restart';
    startRound(session);
  });

  bricks.forEach((brick, idx) => {
    brick.addEventListener('click', async () => {
      if (!accepting) return;
      const mine = session;
      if (idx === sequence[inputIndex]) {
        light(brick, 220, mine);
        inputIndex++;
        if (inputIndex === sequence.length) {
          accepting = false;
          setBricksEnabled(false);
          round++;
          if (round >= lengths.length) {
            status.textContent = 'Round 3 clear. In the app, the pyramid climbs to twenty — and the reading engine watches how you did.';
            startBtn.textContent = 'Play again';
          } else {
            status.textContent = 'The pyramid remembers. Next round.';
            await wait(900);
            if (!alive(mine)) return;
            startRound(mine);
          }
        }
      } else {
        accepting = false;
        setBricksEnabled(false);
        if (!isStatic()) {
          board.classList.add('shake');
          board.addEventListener('animationend', () => board.classList.remove('shake'), { once: true });
        }
        status.textContent = 'The pyramid forgives. Watch once more.';
        await wait(1000);
        if (!alive(mine)) return;
        playback(mine);
      }
    });
  });
}

/* ========================================================================
   4. Scroll reveals.
   ======================================================================== */

function initReveals() {
  if (!hasGsap || isStatic()) return;
  gsap.registerPlugin(ScrollTrigger);
  // Hidden means opacity 0, never visibility hidden: the section stays in
  // the accessibility tree before it scrolls into view, and focus arriving
  // inside it (a keyboard user tabbing to a link) reveals it at once (W14).
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    gsap.set(el, { opacity: 0, y: 20 });
    let trigger = null;
    const reveal = () => {
      if (trigger) trigger.kill();
      gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' });
    };
    trigger = ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: reveal });
    el.addEventListener('focusin', () => {
      if (trigger) trigger.kill();
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: 'opacity,transform' });
    }, { once: true });
  });
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

/* ========================================================================
   boot
   ======================================================================== */

initQuietControl();
initStarfield();
initRitual();
initChallenge();
initReveals();


/* ========================================================================
   The star chart — a constellation of sections. Native anchors; hidden
   without JS; scrolling untouched.
   ======================================================================== */

function initStarChart() {
  const nav = document.getElementById('starchart');
  if (!nav) return;
  const links = Array.from(nav.querySelectorAll('a'));
  const sections = links
    .map((a) => ({ a, el: document.querySelector(a.getAttribute('href')) }))
    .filter((x) => x.el);
  if (sections.length < 2) return;

  nav.hidden = false;

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        sections.forEach((x) => {
          const on = x.el === entry.target;
          if (on) x.a.setAttribute('aria-current', 'true');
          else x.a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-30% 0px -55% 0px' });
    sections.forEach((x) => io.observe(x.el));
  }
}

initStarChart();

/* A live policy change (Reduce Motion toggled mid-session, or the visitor's
   pause) settles the scroll choreography without a reload; the CSS gate
   stills the ambient animation and user-triggered flourishes read
   isStatic() when they fire. */
onMotionChange((state) => {
  if (state !== 'full' && hasGsap) settleGsap({ clear: ['[data-reveal]'] });
});
