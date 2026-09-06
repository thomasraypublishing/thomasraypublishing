'use strict';
/* modules.test.js — every first-party ES module actually parses as one.
   `node --check` treats a bare .js file as CommonJS, so it can't catch an
   ES-module syntax error (a stray top-level `await`, a broken `import`);
   this uses vm.SourceTextModule instead, which parses the file as the
   module goal it really is. Ported from
   Research/reviews/2026-09-05/scripts/check-esm.cjs — no server, no
   browser, just a syntax check on disk.

   Must run with --experimental-vm-modules (wired into "test" and
   "test:modules" in package.json); see the guard test below. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

// Every first-party ES module the site ships, listed explicitly rather than
// discovered by globbing — a stray non-module .js file should never be
// silently parsed as one, and adding a real module here should be a
// deliberate, reviewable line. This list starts from check-esm.cjs's own
// list and adds assets/js/quiet.js (the "Pause motion" control shipped in
// d92e05d): main.js, pomagotchi.js, thedevice.js, trade-rc.js and hhss.js
// all `import` it, so it is first-party and load-bearing, and check-esm.cjs
// had missed it.
const MODULES = [
  'assets/js/main.js',
  'assets/js/nav.js',
  'assets/js/motion.js',
  'assets/js/quiet.js',
  'assets/js/atmosphere.js',
  'assets/js/chapters.js',
  'assets/js/reveals.js',
  'assets/js/fortune.js',
  'assets/js/specimen.js',
  'assets/js/cameo.js',
  'assets/js/prose.js',
  'pomagotchi/pomagotchi.js',
  'thedevice/thedevice.js',
  'trade-rc/trade-rc.js',
  'hush-hush-snap-snap/hhss.js',
];

const hasVmModules = typeof vm.SourceTextModule === 'function';
const skipReason = hasVmModules
  ? false
  : 'requires --experimental-vm-modules — run via `npm test` or `npm run test:modules`, not a bare `node --test`';

test('vm.SourceTextModule is available in this process', () => {
  assert.ok(
    hasVmModules,
    'vm.SourceTextModule is undefined. This file must run with --experimental-vm-modules ' +
      '(package.json "test" and "test:modules" both already pass it — run through npm, not `node --test` directly).',
  );
});

for (const relPath of MODULES) {
  test(`parses as an ES module: ${relPath}`, { skip: skipReason }, () => {
    const abs = path.join(ROOT, relPath);
    let source;
    try {
      source = fs.readFileSync(abs, 'utf8');
    } catch (err) {
      assert.fail(`could not read ${relPath}: ${err.message}`);
    }
    assert.doesNotThrow(
      () => new vm.SourceTextModule(source, { identifier: relPath }),
      undefined,
      `${relPath} failed to parse as an ES module`,
    );
  });
}
