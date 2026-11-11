/**
 * Serves _site/ as GitHub Pages would, to look at it before a push.
 *
 *   npm run serve            http://localhost:4173
 *   npm run serve -- 8080    another port
 *
 * A path ending in `/` is its `index.html`; a missing file is `404.html` with
 * status 404. Nothing is written or cached.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { ROOT } from './lib/site.mjs';

const SITE = path.join(ROOT, '_site');
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.wasm': 'application/wasm',
};

function resolve(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const file = path.join(SITE, pathname);
  if (!file.startsWith(SITE)) return undefined;
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith('/')) return { redirect: `${pathname}/` };
    return { file: path.join(file, 'index.html') };
  }
  return { file };
}

createServer((request, response) => {
  const found = resolve(request.url ?? '/');
  if (found?.redirect) {
    response.writeHead(301, { location: found.redirect });
    response.end();
    return;
  }
  const ok = found !== undefined && existsSync(found.file) && statSync(found.file).isFile();
  const file = ok ? found.file : path.join(SITE, '404.html');
  response.writeHead(ok ? 200 : 404, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
}).listen(port, () => {
  process.stdout.write(`serving _site/ at http://localhost:${port}/` + String.fromCharCode(10));
});
