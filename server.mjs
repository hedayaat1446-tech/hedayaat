import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, 'dist');
const port = Number(process.env.PORT || 3000);
const host = '0.0.0.0';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\\/g, '/');
  const normalized = path.posix.normalize(clean).replace(/^\.\.(\/|$)/g, '');
  return normalized.startsWith('/') ? normalized.slice(1) : normalized;
}

async function resolveFile(reqPath) {
  const rel = safePath(reqPath || '/');
  const candidates = [];
  if (!rel) candidates.push('index.html');
  else {
    candidates.push(rel);
    if (!path.extname(rel)) {
      candidates.push(`${rel}.html`);
      candidates.push(path.join(rel, 'index.html'));
    }
  }

  for (const candidate of candidates) {
    const full = path.resolve(dist, candidate);
    if (!full.startsWith(path.resolve(dist) + path.sep) && full !== path.resolve(dist, 'index.html')) continue;
    try {
      const info = await stat(full);
      if (info.isFile()) return full;
      if (info.isDirectory()) {
        const index = path.join(full, 'index.html');
        const indexInfo = await stat(index);
        if (indexInfo.isFile()) return index;
      }
    } catch {}
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  try {
    const file = await resolveFile(req.url || '/');
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(body);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

server.listen(port, host, () => {
  console.log(`Hedayaat is running on http://${host}:${port}`);
});
