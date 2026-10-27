// Builds dist/search-index.json from the generated HTML pages (+ the PDF documents listed in site.json).
// Runs after `astro build`, so search always reflects exactly what is published.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const dist = new URL('./dist/', import.meta.url).pathname;
const skip = new Set(['404.html', 'en/404.html', 'thank/index.html', 'en/thank/index.html', 'offline.html']);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'admin' && e.name !== '_astro') out.push(...await walk(p)); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const strip = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const entries = [];
for (const file of await walk(dist)) {
  const rel = relative(dist, file).split(sep).join('/');
  if (skip.has(rel)) continue;
  const html = await readFile(file, 'utf8');
  if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) continue;
  const lang = /<html[^>]+lang="en"/i.test(html) ? 'en' : 'ar';
  let url = '/' + rel.replace(/index\.html$/, '');
  const title = strip((html.match(/<title>([\s\S]*?)<\/title>/i) || [, ''])[1]).replace(/\s*[|–—-]\s*(مؤسسة هدايات التعليمية|Hedayat Educational Foundation)\s*$/, '') || url;
  let main = (html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
  main = main.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<(form|dialog|svg|nav)[\s\S]*?<\/\1>/gi, ' ');
  // Index each home-page section separately so results jump straight to the right place.
  const sections = [...main.matchAll(/<section[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)(?=<section[^>]*\bid="|<\/main>|$)/gi)];
  const pageHeadings = [...main.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => strip(m[1])).filter(Boolean);
  const isHome = url === '/' || url === '/en/';
  if (isHome && sections.length) {
    for (const [, id, body] of sections) {
      const hs = [...body.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => strip(m[1])).filter(Boolean);
      const text = strip(body);
      if (!text) continue;
      entries.push({ lang, url: `${url}#${id}`, title: hs[0] || title, headings: hs.slice(1, 14), text: text.slice(0, 1600), section: lang === 'en' ? 'Home' : 'الرئيسية', type: 'page' });
    }
  } else {
    entries.push({ lang, url, title: pageHeadings[0] && pageHeadings[0].length < 90 ? pageHeadings[0] : title, headings: pageHeadings.slice(1, 20), text: strip(main).slice(0, 2400), section: lang === 'en' ? 'Page' : 'صفحة', type: 'page' });
  }
  // PDF documents linked from this page.
  for (const m of html.matchAll(/<a[^>]+href="(\/[^"#?]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    if (entries.some((e) => e.url === href && e.lang === lang)) continue;
    const ctx = html.slice(Math.max(0, m.index - 900), m.index);
    const heads = [...ctx.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi)].map((x) => strip(x[1])).filter(Boolean);
    const docTitle = heads.at(-1) || strip(m[2]) || href.split('/').pop();
    entries.push({ lang, url: href, title: docTitle, headings: [], text: `${docTitle} ${lang === 'en' ? 'PDF document' : 'وثيقة PDF'}`, section: lang === 'en' ? 'Document (PDF)' : 'وثيقة (PDF)', type: 'pdf' });
  }
}
await writeFile(join(dist, 'search-index.json'), JSON.stringify(entries));
console.log(`search index: ${entries.length} entries`);
