// Generates public/styles/dark-theme.css from the site's own light styles.
// Every light colour in site.css and in the pages' <style> blocks is mapped to the
// matching tone of the brand's dark palette (deep petrol surfaces, cream text, gold accents),
// so the dark mode always covers every page — including pages added later — without manual upkeep.
// If postcss cannot be loaded, the previously generated file is kept unchanged.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';

const root = dirname(new URL(import.meta.url).pathname);
const outFile = join(root, existsSync(join(root, 'public')) ? 'public/styles/dark-theme.css' : 'dark-theme.css');
const flatOut = join(root, 'dark-theme.css');
let postcss;
try { postcss = createRequire(import.meta.url)('postcss'); } catch {
  console.log('dark theme: postcss not available, keeping the existing dark-theme.css');
  process.exit(0);
}

// ---------- colour helpers ----------
const NAMED = { white: [255, 255, 255, 1], black: [0, 0, 0, 1], transparent: null, currentcolor: null };
function parseColor(tok) {
  tok = tok.trim().toLowerCase();
  if (tok in NAMED) return NAMED[tok];
  let m = tok.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  m = tok.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map((x, i) => (x.endsWith('%') ? parseFloat(x) * (i < 3 ? 2.55 : 0.01) : parseFloat(x)));
    return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
  }
  return null;
}
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
const hslStr = (h, s, l, a = 1) => (a < 1 ? `hsla(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${+a.toFixed(3)})` : `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`);
const isPetrol = (h, s) => h >= 175 && h <= 215 && s >= 0.2;
const isGold = (h, s) => h >= 38 && h <= 62 && s >= 0.25;

// Brand dark palette
const D = {
  page: '#0E1F26', tint: '#122830', card: '#17333D', card2: '#1C3D48', raised: '#214552',
  text: '#E4E0D4', head: '#F1EAD0', muted: '#A9B8B4', link: '#93CBCB', gold: '#D7C77B',
  primary: '#2B6577', line: 'rgba(255,255,255,0.10)'
};

function mapColor(c, ctx) {
  if (!c) return null;
  const [r, g, b, a] = c; const Y = lum(c); const [h, s] = hsl(c);
  if (ctx === 'bg') {
    if (a < 0.6) {
      if (Y > 0.8) return `rgba(14, 31, 38, ${+Math.min(0.9, a + 0.1).toFixed(3)})`; // white glass -> dark glass
      if (Y < 0.2) return `rgba(255, 255, 255, ${+Math.min(0.14, a * 1.4).toFixed(3)})`; // dark tint on light -> light tint on dark
      if (isGold(h, s)) return null;
      return `rgba(255, 255, 255, ${+Math.min(0.12, a).toFixed(3)})`;
    }
    if (Y >= 0.985) return D.card;
    if (Y >= 0.86) return s < 0.25 || (h > 30 && h < 70) ? D.tint : hslStr(h, Math.min(s, 0.3), 0.16);
    if (Y >= 0.5) return hslStr(h, Math.min(s, 0.3), 0.22);
    if (Y < 0.14 && isPetrol(h, s)) return D.primary;
    if (Y < 0.06) return D.raised;
    return null; // saturated mid tones (gold, coral, sage accents) stay as they are
  }
  if (ctx === 'text') {
    if (Y > 0.75) return null; // already light
    if (isGold(h, s)) return D.gold;
    if (isPetrol(h, s)) return hsl(c)[2] < 0.3 ? D.head : D.link;
    if (Y < 0.09) return D.text;
    if (Y < 0.5) return D.muted;
    return null;
  }
  if (ctx === 'border') {
    if (isGold(h, s)) return null;
    if (a < 0.6) return Y < 0.4 ? `rgba(255, 255, 255, ${+Math.min(0.22, Math.max(0.08, a * 1.5)).toFixed(3)})` : null;
    if (Y > 0.55) return D.line;
    if (isPetrol(h, s) && Y < 0.14) return 'rgba(147, 203, 203, 0.45)';
    return null;
  }
  return null;
}

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/g;
function mapValue(value, ctx, vars) {
  if (/url\(/i.test(value) && !/gradient/i.test(value)) return null;
  // Only global tokens are resolved; local custom properties (e.g. --p for progress rings) stay live.
  let v = value.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g, (m, name) => (vars[name] ?? m));
  let changed = false;
  const out = v.replace(COLOR_RE, (tok) => {
    const mapped = mapColor(parseColor(tok), ctx);
    if (mapped && mapped.toLowerCase() !== tok.toLowerCase()) { changed = true; return mapped; }
    return tok;
  });
  return changed ? out : null;
}
const CTX = (prop) => {
  if (/^background(-color|-image)?$/.test(prop)) return 'bg';
  if (prop === 'color' || prop === 'fill' || prop === 'caret-color' || prop === 'text-decoration-color' || prop === '-webkit-text-fill-color') return 'text';
  if (/^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?$/.test(prop) || prop === 'outline-color' || prop === 'stroke' || prop === 'column-rule-color') return 'border';
  return null;
};

const DARK = 'html[data-theme="dark"]:not(#_)';
function darkSelector(sel) {
  return sel.split(',').map((part) => {
    const s = part.trim();
    if (!s || s.includes('data-theme')) return null;
    // :not(#_) lifts the rules above the pages' scoped (data-astro-cid) selectors without changing their order.
    if (/^:root\b/.test(s)) return s.replace(/^:root/, DARK);
    if (/^html\b/.test(s)) return s.replace(/^html/, DARK);
    return `${DARK} ${s}`;
  }).filter(Boolean).join(',\n');
}

// ---------- collect sources ----------
const sources = [];
const flat = (await readdir(root, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name);
const cssFile = existsSync(join(root, 'src/styles/site.css')) ? join(root, 'src/styles/site.css') : existsSync(join(root, 'public/styles/site.css')) ? join(root, 'public/styles/site.css') : join(root, 'site.css');
sources.push(await readFile(cssFile, 'utf8'));
for (const f of flat.filter((f) => f.endsWith('.astro')).sort()) {
  const text = await readFile(join(root, f), 'utf8');
  for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) sources.push(m[1]);
}

const vars = {};
const roots = sources.map((s) => postcss.parse(s));
for (const r of roots) r.walkDecls(/^--/, (d) => { if (d.parent.type === 'rule' && /^:root$|^html$/.test(d.parent.selector.trim())) vars[d.prop] = d.value; });
// Resolve nested custom properties.
for (let i = 0; i < 4; i += 1) for (const k of Object.keys(vars)) vars[k] = vars[k].replace(/var\((--[\w-]+)\)/g, (m, n) => vars[n] ?? m);

const out = postcss.root();
let rules = 0;
for (const r of roots) {
  r.walkRules((rule) => {
    if (rule.parent.type === 'atrule' && /keyframes/i.test(rule.parent.name)) return;
    if (rule.selector.includes('data-theme')) return;
    const decls = [];
    rule.each((d) => {
      if (d.type !== 'decl' || d.prop.startsWith('--')) return;
      const ctx = CTX(d.prop); if (!ctx) return;
      const v = mapValue(d.value, ctx, vars);
      if (v) decls.push(postcss.decl({ prop: d.prop, value: v, important: d.important }));
    });
    if (!decls.length) return;
    const sel = darkSelector(rule.selector); if (!sel) return;
    const nr = postcss.rule({ selector: sel }); decls.forEach((d) => nr.append(d)); rules += 1;
    // Rebuild the @media/@supports chain around the rule.
    let target = nr, p = rule.parent; const chain = [];
    while (p && p.type === 'atrule') { chain.unshift(p); p = p.parent; }
    for (let i = chain.length - 1; i >= 0; i -= 1) { const at = postcss.atRule({ name: chain[i].name, params: chain[i].params }); at.append(target); target = at; }
    out.append(target);
  });
}

const header = `/* Generated by build-dark-theme.mjs — do not edit by hand. */\n`;
const base = `
html[data-theme="dark"] { color-scheme: dark; background: ${D.page}; }
html[data-theme="dark"] body { background: ${D.page}; color: ${D.text}; }
html[data-theme="dark"] ::selection { background: rgba(215, 199, 123, 0.35); color: #fff; }
`;
const css = header + out.toString() + '\n' + base;
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, css);
if (outFile !== flatOut) await writeFile(flatOut, css).catch(() => {});
console.log(`dark theme: ${rules} rules -> ${outFile.replace(root + '/', '')}`);
