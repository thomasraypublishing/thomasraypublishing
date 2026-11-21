'use strict';
/* cta.test.js — every App Store call-to-action actually points at the
   product it's on. Two checks:
     1. On each page a product names in products.json, every apps.apple.com
        link inside that product's listed CSS container(s) equals its
        canonical URL exactly (no wrong id, no country/locale drift).
     2. Sitewide: every tracked *.html file is scanned as plain text for any
        https://apps.apple.com/.../<slug>/id... URL whose <slug> is one of
        our three products' slugs; wherever found, it must equal that
        product's canonical URL exactly, wherever on the site it appears
        (an href, a JSON-LD "installUrl" string, anything).

   Out of scope on purpose: apps.apple.com links whose slug isn't one of
   ours (the five iMessage sticker packs on index.html — different Apple
   apps entirely) and Apple's own generic destinations (apps.apple.com/redeem,
   apps.apple.com/account/subscriptions). Those are a different Apple
   destination by design, not a drifted product link — see products.json. */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { start, stop } = require('./lib/server');
const { launch, newPage } = require('./lib/browser');
const { products } = require('./products.json');

const ROOT = path.resolve(__dirname, '..', '..');
const APPLE_URL_RE = /https:\/\/apps\.apple\.com\/[^\s"'<>)]*/g;

function trackedHtmlFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '*.html'], { cwd: ROOT, encoding: 'utf8' });
    return out.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    const results = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(abs);
        else if (entry.isFile() && entry.name.endsWith('.html')) results.push(path.relative(ROOT, abs).split(path.sep).join('/'));
      }
    })(ROOT);
    return results;
  }
}

describe('cta.test.js — App Store links match their product', () => {
  describe('container CTAs (Playwright)', () => {
    let site;
    let browser;

    before(async () => {
      site = await start();
      browser = await launch();
    });

    after(async () => {
      await browser.close();
      await stop(site);
    });

    for (const product of products) {
      for (const [pagePath, selectors] of Object.entries(product.ctaContainers)) {
        it(`${product.name} on ${pagePath}`, async () => {
          const { context, page, errors } = await newPage(browser, site.url, { viewport: { width: 1280, height: 900 } });
          try {
            await page.goto(`${site.url}/${pagePath}`, { waitUntil: 'networkidle' });
            for (const selector of selectors) {
              const hrefs = await page.evaluate((sel) => {
                const container = document.querySelector(sel);
                if (!container) return null;
                return Array.from(container.querySelectorAll('a[href*="apps.apple.com"]')).map((a) => a.getAttribute('href'));
              }, selector);
              assert.notEqual(hrefs, null, `container "${selector}" not found on ${pagePath}`);
              assert.ok(hrefs.length > 0, `container "${selector}" on ${pagePath} has no apps.apple.com link`);
              for (const href of hrefs) {
                assert.equal(
                  href,
                  product.canonicalUrl,
                  `${pagePath} "${selector}": App Store link "${href}" does not exactly match ${product.name}'s canonical URL`,
                );
              }
            }
            assert.deepEqual(errors, [], `page/console error(s) on ${pagePath}:\n  ${errors.join('\n  ')}`);
          } finally {
            await context.close();
          }
        });
      }
    }
  });

  /* W20: the "scan with your iPhone" QR code beside each final App Store
     link. tools/qr/build.swift writes the SVGs, reads each back with Vision
     to prove it decodes to the product's canonical URL, and records the URL
     and SHA-256 in tools/qr/manifest.json. No QR decoder runs here (CI is
     Linux); instead the committed file must still be the one that build
     verified, and the URL it verified must still be the canonical one. A
     changed store URL or a hand-edited SVG fails until build.swift is rerun. */
  describe('QR codes (W20)', () => {
    const { codes } = require('../qr/manifest.json');
    const crypto = require('node:crypto');

    it('every product has one code, built from its canonical URL, unchanged since it was verified', () => {
      assert.deepEqual(codes.map((c) => c.id).sort(), products.map((p) => p.id).sort(), 'manifest and products.json list different products');
      for (const product of products) {
        const code = codes.find((c) => c.id === product.id);
        assert.equal(code.url, product.canonicalUrl, `${product.id}: QR code was built from "${code.url}" — rerun: swift tools/qr/build.swift`);
        const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, code.file))).digest('hex');
        assert.equal(sha, code.sha256, `${code.file} is not the file build.swift verified — rerun: swift tools/qr/build.swift`);
      }
    });

    describe('on the page (Playwright)', () => {
      let site;
      let browser;
      before(async () => { site = await start(); browser = await launch(); });
      after(async () => { await browser.close(); await stop(site); });

      for (const product of products) {
        const code = codes.find((c) => c.id === product.id);
        const pagePath = `${code.file.split('/')[0]}/index.html`;
        const read = (page) => page.evaluate(() => {
          const img = document.querySelector('.qr-handoff img');
          if (!img) return null;
          const box = img.getBoundingClientRect();
          return { src: img.getAttribute('src'), alt: img.alt, shown: box.width > 0 && box.height > 0, loaded: img.complete && img.naturalWidth > 0 };
        });

        it(`${product.name}: shown and loaded at 1280px, sits with the final App Store link`, async () => {
          const { context, page } = await newPage(browser, site.url, { viewport: { width: 1280, height: 900 } });
          try {
            await page.goto(`${site.url}/${pagePath}?static=1`, { waitUntil: 'networkidle' });
            await page.locator('.qr-handoff').scrollIntoViewIfNeeded();
            await page.waitForFunction(() => { const i = document.querySelector('.qr-handoff img'); return i && i.complete; });
            const state = await read(page);
            assert.notEqual(state, null, `${pagePath} has no .qr-handoff image`);
            assert.equal(`${pagePath.split('/')[0]}/${state.src}`, code.file, `${pagePath}: QR image src is not this product's code`);
            assert.ok(state.shown && state.loaded, `${pagePath}: QR code is not visible and loaded at 1280px`);
            assert.ok(state.alt.includes(product.name), `${pagePath}: QR alt text does not name ${product.name}`);
            const besideLink = await page.evaluate((url) => {
              const block = document.querySelector('.qr-handoff').parentElement;
              return Array.from(block.querySelectorAll('a')).some((a) => a.getAttribute('href') === url);
            }, product.canonicalUrl);
            assert.ok(besideLink, `${pagePath}: QR code is not in the same block as the App Store link`);
          } finally {
            await context.close();
          }
        });

        it(`${product.name}: not rendered at 375px`, async () => {
          const { context, page } = await newPage(browser, site.url, { viewport: { width: 375, height: 812 } });
          try {
            await page.goto(`${site.url}/${pagePath}?static=1`, { waitUntil: 'networkidle' });
            const state = await read(page);
            assert.notEqual(state, null, `${pagePath} has no .qr-handoff image`);
            assert.equal(state.shown, false, `${pagePath}: QR code takes space at phone width`);
          } finally {
            await context.close();
          }
        });
      }
    });
  });

  describe('sitewide scan (filesystem)', () => {
    it('every apps.apple.com/.../<product-slug>/id... URL on the site matches its canonical URL exactly', () => {
      const bySlug = new Map(products.map((p) => [p.slug, p]));
      const mismatches = [];
      for (const relPath of trackedHtmlFiles()) {
        const text = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
        for (const match of text.match(APPLE_URL_RE) || []) {
          const product = [...bySlug.values()].find((p) => match.includes(`/app/${p.slug}/`));
          if (!product) continue; // a different app, or a generic Apple URL — out of scope, see file header
          if (match !== product.canonicalUrl) {
            mismatches.push(`${relPath}: found "${match}", expected "${product.canonicalUrl}" (${product.name})`);
          }
        }
      }
      assert.deepEqual(mismatches, [], `App Store link drift found:\n  ${mismatches.join('\n  ')}`);
    });

    it('products.json names a real, distinct canonical URL and slug for each product', () => {
      assert.equal(products.length, 3, 'expected exactly the three shipping products');
      const urls = new Set();
      for (const p of products) {
        assert.match(p.canonicalUrl, /^https:\/\/apps\.apple\.com\/us\/app\/[a-z0-9-]+\/id\d+$/, `${p.id}: malformed canonicalUrl`);
        assert.ok(p.canonicalUrl.includes(`/app/${p.slug}/`), `${p.id}: slug "${p.slug}" does not appear in its own canonicalUrl`);
        assert.ok(p.canonicalUrl.includes(`id${p.appStoreId}`), `${p.id}: appStoreId "${p.appStoreId}" does not appear in its own canonicalUrl`);
        assert.ok(!urls.has(p.canonicalUrl), `${p.id}: canonicalUrl is a duplicate of another product's`);
        urls.add(p.canonicalUrl);
      }
    });
  });
});
