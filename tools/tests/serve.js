'use strict';
/* serve.js — `npm run serve`. Starts the same dependency-free static
   server the test suite uses (tools/tests/lib/server.js) so you can poke
   at the site by hand in a real browser, on the same footing the tests
   run under (correct MIME types, directory -> index.html, 404 -> 404.html
   with a real 404 status). Runs until you Ctrl+C it. */

const { start, stop, ROOT } = require('./lib/server');

(async () => {
  const site = await start();
  console.log(`Serving ${ROOT}`);
  console.log(`  ${site.url}`);
  console.log('Press Ctrl+C to stop.');

  const shutdown = async () => {
    console.log('\nStopping…');
    await stop(site);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
