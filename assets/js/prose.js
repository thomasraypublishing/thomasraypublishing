/* ========================================================================
   prose.js — entry point for the calm pages (privacy, terms, support,
   accessibility, per-app policies, 404). Mobile menu and anchor offsets
   only: no GSAP, no WebGL, no scroll choreography. nav.js degrades to
   instant transitions when gsap is absent.
   ======================================================================== */

import { isStatic } from './motion.js'; // sets html[data-motion]; smooth scrolling keys off it
import { initNav } from './nav.js';

initNav({ motion: () => !isStatic() });
