'use strict';
/* links.test.js — every internal href/src/srcset on every public page
   resolves to a tracked file, and every fragment (#id) exists on its
   target page. Pure filesystem + string parsing: no server, no browser,
   so it's fast and has nothing to do with rendering.

   Resolution mirrors what a browser does when it parses a relative URL
   against the page it's on (Node's URL class implements the same
   algorithm the DOM uses), PLUS one GitHub Pages rule verified straight
   from this repo's own hrefs: a path with no matching file or directory
   falls back to "<path>.html" — e.g. pomagotchi/terms.html links to
   "https://thomasraypublishing.com/pomagotchi/terms" (no extension), which
   is exactly how GitHub Pages serves that page in production. That
   fallback is a links.test.js resolution rule, not something
   tools/tests/lib/server.js emulates — nothing in this suite navigates a
   browser straight to an extensionless route, so the server only needs
   the two rules it's actually asked to serve (see its own comment). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { routes } = require('./routes.json');

const ROOT = path.resolve(__dirname, '..', '..');
const INTERNAL_HOST = 'trp-links-test.invalid';
const SELF_HOST = 'thomasraypublishing.com';

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** Pull out `<tag ...>` openings only — never text content or script bodies
    (so JSON-LD payloads and inline JS can't be mistaken for markup). */
function extractTags(html) {
  return html.match(/<[a-zA-Z][a-zA-Z0-9-]*\b[^>]*>/g) || [];
}

function extractAttr(tag, name) {
  const re = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const m = tag.match(re);
  if (!m) return null;
  return decodeEntities(m[1] !== undefined ? m[1] : m[2]);
}

function parseSrcset(value) {
  return value
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function fileExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}
function dirExists(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Resolve a repo-root-relative pathname (already url-decoded, leading
    slash stripped) to a tracked file, applying directory -> index.html and
    the GitHub Pages extensionless fallback. Returns the resolved relative
    path on success, or null if nothing on disk matches. */
function resolveToFile(rel) {
  if (rel === '') rel = 'index.html';
  const direct = path.join(ROOT, rel);
  if (fileExists(direct)) return rel;
  if (dirExists(direct)) {
    const withIndex = path.posix.join(rel, 'index.html');
    if (fileExists(path.join(ROOT, withIndex))) return withIndex;
    return null;
  }
  if (!rel.endsWith('/')) {
    const withHtml = `${rel}.html`;
    if (fileExists(path.join(ROOT, withHtml))) return withHtml;
  }
  return null;
}

const idCache = new Map();
function idsInFile(relPath) {
  if (idCache.has(relPath)) return idCache.get(relPath);
  const ids = new Set();
  try {
    const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    for (const m of html.matchAll(/\sid\s*=\s*"([^"]+)"/g)) ids.add(m[1]);
    for (const m of html.matchAll(/\sid\s*=\s*'([^']+)'/g)) ids.add(m[1]);
  } catch {
    /* missing file is reported as a broken link by the caller, not here */
  }
  idCache.set(relPath, ids);
  return ids;
}

/** Every candidate URL string found in a page's href/src/srcset attributes,
    each tagged with the raw attribute it came from (for failure messages). */
function collectCandidates(html) {
  const found = [];
  for (const tag of extractTags(html)) {
    const href = extractAttr(tag, 'href');
    const src = extractAttr(tag, 'src');
    const srcset = extractAttr(tag, 'srcset');
    if (href !== null) found.push({ raw: href, from: tag.slice(0, 80) });
    if (src !== null) found.push({ raw: src, from: tag.slice(0, 80) });
    if (srcset !== null) {
      for (const candidate of parseSrcset(srcset)) found.push({ raw: candidate, from: tag.slice(0, 80) });
    }
  }
  return found;
}

/** Classify a raw URL string found on `routePath`. Returns:
    - { kind: 'external' }                          — leave it to lychee
    - { kind: 'internal', pathname, hash, resolved } — resolved on disk (or null) */
function classify(raw, routePath) {
  const base = `http://${INTERNAL_HOST}/${routePath}`;
  let url;
  try {
    url = new URL(raw, base);
  } catch {
    return { kind: 'external' }; // unparseable (e.g. a bare "javascript:" fragment) — not ours to check
  }
  const isLocal = url.hostname === INTERNAL_HOST;
  const isSelf = url.hostname === SELF_HOST;
  if (!isLocal && !isSelf) return { kind: 'external' }; // apps.apple.com, a.co, mailto:, tel:, traderc://, data:, ...
  const rawPathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const resolved = resolveToFile(rawPathname);
  return { kind: 'internal', pathname: rawPathname, hash: url.hash.replace(/^#/, ''), resolved };
}

test('links: every internal href/src/srcset resolves, and every fragment exists on its target page', async (t) => {
  for (const route of routes) {
    const html = fs.readFileSync(path.join(ROOT, route.path), 'utf8');
    const candidates = collectCandidates(html);

    await t.test(route.path, () => {
      const broken = [];
      const badFragments = [];
      for (const { raw, from } of candidates) {
        const result = classify(raw, route.path);
        if (result.kind === 'external') continue;
        if (!result.resolved) {
          broken.push(`"${raw}" -> no file for "${result.pathname}" (in ${from}...>)`);
          continue;
        }
        if (result.hash && result.hash !== '') {
          const ids = idsInFile(result.resolved);
          if (!ids.has(result.hash)) {
            badFragments.push(`"${raw}" -> #${result.hash} not found in ${result.resolved} (in ${from}...>)`);
          }
        }
      }
      assert.deepEqual(broken, [], `broken internal link(s) on ${route.path}:\n  ${broken.join('\n  ')}`);
      assert.deepEqual(badFragments, [], `dangling fragment(s) on ${route.path}:\n  ${badFragments.join('\n  ')}`);
    });
  }
});
