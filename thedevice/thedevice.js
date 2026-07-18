/* ========================================================================
   thedevice.js — enhancement layer for The Device page.
   Contract: complete and readable with zero JavaScript; Reduce Motion or
   ?static=1 gets the settled page. The reading ritual and the memory demo
   are user-initiated and stay available in static mode (they are content,
   not decoration) — only their flourishes are toned down.

   Honesty rails (TD-227): readings are entertainment, never predictions;
   nothing here claims accuracy or evolution.
   ======================================================================== */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = reduceMotion || new URLSearchParams(window.location.search).has('static');
const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ========================================================================
   1. Starfield parallax — three fixed layers, transform-only.
   ======================================================================== */

function initStarfield() {
  if (staticMode) return;
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

    if (!staticMode) {
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

    if (staticMode) {
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
  let playing = false;

  const setBricksEnabled = (on) => bricks.forEach((b) => { b.disabled = !on; });
  setBricksEnabled(false);

  const light = async (brick, ms) => {
    brick.classList.add('lit');
    await wait(ms);
    brick.classList.remove('lit');
  };

  const playback = async () => {
    playing = true;
    accepting = false;
    setBricksEnabled(false);
    status.textContent = `Round ${round + 1} — watch the pyramid.`;
    await wait(700);
    for (const idx of sequence) {
      await light(bricks[idx], staticMode ? 300 : 420);
      await wait(staticMode ? 120 : 170);
    }
    playing = false;
    accepting = true;
    inputIndex = 0;
    setBricksEnabled(true);
    status.textContent = `Round ${round + 1} — your turn. ${sequence.length} stones.`;
  };

  const startRound = async () => {
    const extra = [];
    while (extra.length < lengths[round]) {
      const pick = Math.floor(Math.random() * bricks.length);
      if (extra[extra.length - 1] !== pick) extra.push(pick);
    }
    sequence = extra;
    await playback();
  };

  startBtn.addEventListener('click', () => {
    if (playing) return;
    round = 0;
    startBtn.textContent = 'Restart';
    startRound();
  });

  bricks.forEach((brick, idx) => {
    brick.addEventListener('click', async () => {
      if (!accepting) return;
      if (idx === sequence[inputIndex]) {
        light(brick, 220);
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
            startRound();
          }
        }
      } else {
        accepting = false;
        setBricksEnabled(false);
        if (!staticMode) {
          board.classList.add('shake');
          board.addEventListener('animationend', () => board.classList.remove('shake'), { once: true });
        }
        status.textContent = 'The pyramid forgives. Watch once more.';
        await wait(1000);
        playback();
      }
    });
  });
}

/* ========================================================================
   4. Scroll reveals.
   ======================================================================== */

function initReveals() {
  if (!hasGsap || staticMode) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    gsap.set(el, { autoAlpha: 0, y: 20 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' })
    });
  });
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

/* ========================================================================
   boot
   ======================================================================== */

initStarfield();
initRitual();
initChallenge();
initReveals();
