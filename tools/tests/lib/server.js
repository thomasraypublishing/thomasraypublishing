'use strict';
/* server.js — dependency-free static file server for the repo root.
   Every test file starts its own instance (start()) and stops it (stop())
   when done; nothing here is shared module state, so test files stay
   independent whether node:test runs them in one process or several.

   Mirrors exactly two GitHub Pages behaviors the site depends on:
     - a directory request serves that directory's index.html
     - anything unmatched serves 404.html with a real 404 status
   It deliberately does NOT emulate GitHub Pages' extensionless "clean URL"
   fallback (e.g. /pomagotchi/privacy -> pomagotchi/privacy.html) — nothing
   in this suite ever navigates a browser straight to an extensionless
   route, so that resolution rule lives only in links.test.js's filesystem
   check, where the site's own self-referential hrefs actually use it. */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// tools/tests/lib -> tools/tests -> tools -> repo root
const ROOT = path.resolve(__dirname, '..', '..', '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};
const DEFAULT_MIME = 'application/octet-stream';

/** Join a request path onto ROOT without ever escaping it via `..`. */
function safeJoin(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    decoded = urlPath;
  }
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  return path.join(ROOT, normalized);
}

/** Resolve a request path to a file on disk, following directory -> index.html. */
function resolveFile(urlPath) {
  let filePath = safeJoin(urlPath);
  let stat = statOrNull(filePath);
  if (stat && stat.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
    stat = statOrNull(filePath);
  }
  return stat && stat.isFile() ? filePath : null;
}

function statOrNull(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

function send(res, status, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const body = fs.readFileSync(filePath);
  res.writeHead(status, {
    'Content-Type': MIME[ext] || DEFAULT_MIME,
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function handleRequest(req, res) {
  try {
    const parsed = new URL(req.url, 'http://internal');
    const found = resolveFile(parsed.pathname);
    if (found) {
      send(res, 200, found);
      return;
    }
    const notFoundPage = path.join(ROOT, '404.html');
    if (statOrNull(notFoundPage)) {
      send(res, 404, notFoundPage);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('500 Internal Server Error: ' + (err && err.message ? err.message : String(err)));
  }
}

/** Start the server on a free port. Resolves to { url, port, server }. */
function start() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handleRequest);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, port: address.port, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

/** Stop a server instance returned by start(). Safe to call more than once. */
function stop(instance) {
  if (!instance || !instance.server || !instance.server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    instance.server.close((err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { start, stop, ROOT };
