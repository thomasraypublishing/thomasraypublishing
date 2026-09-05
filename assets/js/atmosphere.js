/* ========================================================================
   atmosphere.js — the one canvas, four worlds.
   A single persistent THREE.Points field behind the page whose character
   morphs per chapter: warm fluff (Pomagotchi) → starfield (The Device) →
   near-stillness (Hush Hush Snap Snap) → quiet editorial dust.
   All motion params live in a "world state" lerped toward chapter targets
   each frame, so transitions are continuous no matter how fast you scroll.
   ======================================================================== */

import * as THREE from 'three';

/* Per-world shader parameter targets.
   speed     — global animation speed multiplier
   driftX/Y  — base drift direction (Y positive = upward)
   density   — fraction of particles visible (0–1)
   twinkle   — star-style brightness flicker amount
   softness  — particle edge falloff (1 = fluffy, 0 = pinpoint)
   scale     — particle size multiplier
   colorA/B  — color ramp endpoints (mixed per-particle by seed)
*/
const WORLDS = {
  hero: {
    speed: 1.0, driftX: 0.012, driftY: 0.018, density: 0.55, twinkle: 0.35,
    softness: 0.75, scale: 1.0,
    colorA: new THREE.Color('#b7aceb'), colorB: new THREE.Color('#f5b07a'),
  },
  pom: {
    speed: 1.0, driftX: 0.02, driftY: 0.03, density: 0.6, twinkle: 0.1,
    softness: 1.0, scale: 1.5,
    colorA: new THREE.Color('#f5b07a'), colorB: new THREE.Color('#f7e3c8'),
  },
  device: {
    speed: 0.85, driftX: -0.004, driftY: -0.01, density: 1.0, twinkle: 1.0,
    softness: 0.12, scale: 0.62,
    colorA: new THREE.Color('#cfc6ff'), colorB: new THREE.Color('#ffffff'),
  },
  hhss: {
    speed: 0.12, driftX: 0.002, driftY: 0.004, density: 0.18, twinkle: 0.06,
    softness: 0.85, scale: 0.8,
    colorA: new THREE.Color('#e8869a'), colorB: new THREE.Color('#9a6a78'),
  },
  editorial: {
    speed: 0.5, driftX: 0.008, driftY: 0.012, density: 0.35, twinkle: 0.2,
    softness: 0.7, scale: 0.85,
    colorA: new THREE.Color('#938aa7'), colorB: new THREE.Color('#d7cfb8'),
  },
};

const VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aDepth;       // 0 near … 1 far, drives parallax + size
  uniform float uTime;
  uniform float uScroll;        // page scroll in world units
  uniform vec2  uDrift;
  uniform float uSpeed;
  uniform float uScale;
  uniform float uDensity;
  uniform float uPixelRatio;
  uniform vec3  uPulse;         // x, y center (world units), z strength 0–1
  varying float vSeed;
  varying float vAlive;

  void main() {
    vSeed = aSeed;
    // Particles beyond the density cut simply collapse to zero size.
    vAlive = step(aSeed, uDensity);

    vec3 p = position;
    float t = uTime * uSpeed;

    // Organic wander, unique per particle.
    p.x += sin(t * 0.31 + aSeed * 17.0) * 0.5 + uDrift.x * t;
    p.y += cos(t * 0.23 + aSeed * 23.0) * 0.4 + uDrift.y * t;

    // Wrap into a tall column so drift never runs out.
    p.x = mod(p.x + 12.0, 24.0) - 12.0;
    p.y = mod(p.y + 8.0, 16.0) - 8.0;

    // Scroll parallax — far particles move less.
    p.y += uScroll * mix(0.55, 0.12, aDepth);

    // Fortune pulse: radial push with falloff, decays via uPulse.z.
    vec2 toP = p.xy - uPulse.xy;
    float d = length(toP);
    p.xy += normalize(toP + 0.0001) * uPulse.z * 1.6 * exp(-d * 1.1);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = mix(26.0, 9.0, aDepth) * uScale * (0.6 + aSeed * 0.8);
    gl_PointSize = size * uPixelRatio * vAlive * (1.0 / -mv.z);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uTime;
  uniform float uTwinkle;
  uniform float uSoftness;
  varying float vSeed;
  varying float vAlive;

  void main() {
    if (vAlive < 0.5) discard;
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    // softness 1 → wide gaussian puff; 0 → tight star core
    float edge = mix(0.05, 0.9, uSoftness);
    float a = 1.0 - smoothstep(1.0 - edge, 1.0, r);
    a *= mix(0.9, 0.28, uSoftness);

    float tw = 1.0 - uTwinkle * 0.5 * (1.0 + sin(uTime * (1.5 + vSeed * 3.0) + vSeed * 40.0));
    vec3 col = mix(uColorA, uColorB, fract(vSeed * 7.31));
    gl_FragColor = vec4(col, a * tw);
  }
`;

export function createAtmosphere(canvas, { mobile = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: false, powerPreference: 'low-power',
    });
  } catch {
    return null; // caller keeps the CSS .atmo fallback
  }

  const dprCap = mobile ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
  camera.position.z = 10;

  const COUNT = mobile ? 900 : 2400;
  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  const depth = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3 + 0] = (Math.random() - 0.5) * 24;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 2] = -Math.random() * 6;
    seed[i] = Math.random();
    depth[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));

  const start = WORLDS.hero;
  const uniforms = {
    uTime:       { value: 0 },
    uScroll:     { value: 0 },
    uDrift:      { value: new THREE.Vector2(start.driftX, start.driftY) },
    uSpeed:      { value: start.speed },
    uScale:      { value: start.scale },
    uDensity:    { value: start.density },
    uTwinkle:    { value: start.twinkle },
    uSoftness:   { value: start.softness },
    uColorA:     { value: start.colorA.clone() },
    uColorB:     { value: start.colorB.clone() },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uPulse:      { value: new THREE.Vector3(0, 0, 0) },
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(geo, mat));

  // ---- world-state lerping ------------------------------------------------
  let target = { ...start, colorA: start.colorA.clone(), colorB: start.colorB.clone() };
  const LERP = 0.045;

  function setWorld(name) {
    const w = WORLDS[name];
    if (w) target = w;
  }

  // ---- sizing -------------------------------------------------------------
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  let rzT;
  window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(resize, 150); });

  // ---- render loop --------------------------------------------------------
  let raf = null;
  let scrollTarget = 0;
  const clock = new THREE.Clock();

  function frame() {
    raf = requestAnimationFrame(frame);
    const u = uniforms;
    u.uTime.value = clock.getElapsedTime();

    u.uSpeed.value    += (target.speed    - u.uSpeed.value)    * LERP;
    u.uScale.value    += (target.scale    - u.uScale.value)    * LERP;
    u.uDensity.value  += (target.density  - u.uDensity.value)  * LERP;
    u.uTwinkle.value  += (target.twinkle  - u.uTwinkle.value)  * LERP;
    u.uSoftness.value += (target.softness - u.uSoftness.value) * LERP;
    u.uDrift.value.x  += (target.driftX   - u.uDrift.value.x)  * LERP;
    u.uDrift.value.y  += (target.driftY   - u.uDrift.value.y)  * LERP;
    u.uColorA.value.lerp(target.colorA, LERP);
    u.uColorB.value.lerp(target.colorB, LERP);
    u.uScroll.value   += (scrollTarget    - u.uScroll.value)   * 0.08;
    u.uPulse.value.z  *= 0.94; // pulse decay

    renderer.render(scene, camera);
  }

  // Two reasons to stop: the tab is hidden, or the motion policy (Reduce
  // Motion arriving mid-session, or the visitor's pause) says so. Only the
  // policy is remembered, so a hidden tab never resumes a paused sky.
  let wanted = true;
  function startLoop() { if (!raf) { clock.start(); frame(); } }
  function stopLoop()  { if (raf)  { cancelAnimationFrame(raf); raf = null; } }
  function sync()      { (wanted && !document.hidden) ? startLoop() : stopLoop(); }
  function play()  { wanted = true; sync(); }
  function pause() { wanted = false; sync(); }

  document.addEventListener('visibilitychange', sync);

  sync();

  return {
    setWorld,
    setScroll(px) { scrollTarget = px * 0.004; },
    /* Pulse outward from a viewport point (e.g. the fortune pyramid). */
    pulse(clientX, clientY, strength = 1) {
      const ndcX = (clientX / window.innerWidth) * 2 - 1;
      const ndcY = -((clientY / window.innerHeight) * 2 - 1);
      const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
      uniforms.uPulse.value.set(ndcX * halfH * camera.aspect, ndcY * halfH, strength);
    },
    pause, play,
    get running() { return raf !== null; },
  };
}
