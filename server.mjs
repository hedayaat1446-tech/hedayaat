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
  const clean = decodeURIComponent(String(urlPath || '/').split('?')[0]).replace(/\\/g, '/');
  const normalized = path.posix.normalize(clean).replace(/^\.\.(\/|$)/g, '');
  return normalized.startsWith('/') ? normalized.slice(1) : normalized;
}

async function resolveFile(reqPath) {
  const rel = safePath(reqPath);
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
    const distRoot = path.resolve(dist);
    if (full !== distRoot && !full.startsWith(distRoot + path.sep)) continue;
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
    // Netlify processes form submissions when deployed there. On Railway, a POST to /thank
    // still lands on the thank-you page, but no submission is stored by Railway.
    const file = await resolveFile(req.url || '/');
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const body = await readFile(file);
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Cache-Control': ['.html','.css','.js','.mjs','.json'].includes(ext) ? 'no-store, no-cache, must-revalidate, max-age=0' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
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
