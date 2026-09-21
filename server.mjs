import http from 'node:http';
import { createReadStream } from 'node:fs';
import { appendFile, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, extname, join, resolve, sep } from 'node:path';

const execFileAsync = promisify(execFile);
const requestedPort = Number(process.env.PORT || 3000);
const port = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65535 ? requestedPort : 3000;
const root = resolve(process.cwd(), 'dist');
const dataDir = process.env.DATA_DIR || join(process.cwd(), 'data');
const contactMessagesFile = process.env.CONTACT_MESSAGES_FILE || join(dataDir, 'contact-messages.jsonl');
const feedbackMessagesFile = process.env.FEEDBACK_MESSAGES_FILE || join(dataDir, 'feedback-messages.jsonl');
const satisfactionResponsesFile = process.env.SATISFACTION_RESPONSES_FILE || join(dataDir, 'satisfaction-responses.jsonl');
const participationRequestsFile = process.env.PARTICIPATION_REQUESTS_FILE || join(dataDir, 'participation-requests.jsonl');
const participationUpdatesFile = process.env.PARTICIPATION_UPDATES_FILE || join(dataDir, 'participation-updates.jsonl');
const persistedSiteFile = process.env.SITE_CONFIG_STORE || join(dataDir, 'site.json');
const adminPassword = process.env.ADMIN_PASSWORD || '';
const adminSecret = process.env.ADMIN_SECRET || adminPassword;
const SESSION_COOKIE = 'hedayat_admin';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

const types = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.pdf':'application/pdf',
  '.mp4':'video/mp4', '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf', '.otf':'font/otf',
  '.txt':'text/plain; charset=utf-8', '.xml':'application/xml; charset=utf-8'
};

const rateBuckets = new Map();
const feedbackRateBuckets = new Map();
const satisfactionRateBuckets = new Map();
const participationRateBuckets = new Map();
const participationStatusRateBuckets = new Map();
const adminLoginBuckets = new Map();
let adminSaveInProgress = false;

const BASE_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin'
};

const HTML_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'"
].join('; ');

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const realIp = String(req.headers['x-real-ip'] || '').trim();
  return forwarded || realIp || req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(bucket, key, windowMs, max) {
  const now = Date.now();
  const recent = (bucket.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    bucket.set(key, recent);
    return true;
  }
  recent.push(now);
  bucket.set(key, recent);

  // Avoid an unbounded in-memory map if many one-off addresses hit the service.
  if (bucket.size > 5000) {
    for (const [candidate, values] of bucket) {
      const live = values.filter((t) => now - t < windowMs);
      if (live.length) bucket.set(candidate, live);
      else bucket.delete(candidate);
    }
    if (bucket.size > 5000) bucket.clear();
  }
  return false;
}

function rateLimited(req) {
  return checkRateLimit(rateBuckets, clientIp(req), 15 * 60 * 1000, 5);
}

function feedbackRateLimited(req) {
  return checkRateLimit(feedbackRateBuckets, clientIp(req), 60 * 60 * 1000, 12);
}

function satisfactionRateLimited(req) {
  return checkRateLimit(satisfactionRateBuckets, clientIp(req), 60 * 60 * 1000, 12);
}

function participationRateLimited(req) {
  return checkRateLimit(participationRateBuckets, clientIp(req), 60 * 60 * 1000, 8);
}

function participationStatusRateLimited(req) {
  return checkRateLimit(participationStatusRateBuckets, clientIp(req), 15 * 60 * 1000, 60);
}

function adminLoginRateLimited(req) {
  const key = clientIp(req);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const recent = (adminLoginBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length) adminLoginBuckets.set(key, recent);
  else adminLoginBuckets.delete(key);
  return recent.length >= 8;
}

function recordAdminLoginFailure(req) {
  const key = clientIp(req);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const recent = (adminLoginBuckets.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  adminLoginBuckets.set(key, recent);
  if (adminLoginBuckets.size > 5000) {
    for (const [candidate, values] of adminLoginBuckets) {
      if (!values.some((t) => now - t < windowMs)) adminLoginBuckets.delete(candidate);
    }
    if (adminLoginBuckets.size > 5000) adminLoginBuckets.clear();
  }
}

function clearAdminLoginFailures(req) {
  adminLoginBuckets.delete(clientIp(req));
}

function securityHeadersFor(contentType = '') {
  return contentType.startsWith('text/html')
    ? { ...BASE_SECURITY_HEADERS, 'Content-Security-Policy': HTML_CSP }
    : BASE_SECURITY_HEADERS;
}

function json(res, status, payload, headers = {}) {
  res.writeHead(status, {
    ...BASE_SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function requestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function readBody(req, maxBytes = 64 * 1024) {
  const announcedLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(announcedLength) && announcedLength > maxBytes) {
    throw requestError('body too large', 413);
  }

  return await new Promise((resolveBody, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    req.on('data', (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        settled = true;
        chunks.length = 0;
        reject(requestError('body too large', 413));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!settled) resolveBody(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (error) => {
      if (!settled) reject(error);
    });
  });
}

function parseRequestBody(req, text) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('application/json')) return JSON.parse(text || '{}');
  if (contentType.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text));
  throw new Error('unsupported content type');
}

function cleanText(value, max) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email) && email.length <= 254;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value, max = 10000) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function validateSiteConfig(site) {
  const errors = [];
  const needObject = (value, name) => { if (!isPlainObject(value)) errors.push(`${name} must be an object`); };
  const needString = (value, name, max = 1000) => { if (!nonEmptyString(value, max)) errors.push(`${name} must be a non-empty string`); };
  const needArray = (value, name) => { if (!Array.isArray(value)) errors.push(`${name} must be an array`); };
  const allowedFragments = new Set(['home','about','vision-item','mission-item','goals','values','programs','partners','contact']);
  const allowedRoutes = new Set(['/','/board/','/governance/','/transparency/','/accessibility/','/participation/','/en/','/en/videos/','/en/participation/','/videos/','/reports/','/privacy/','/thank/']);
  const validHref = (value, name, { externalOnly = false } = {}) => {
    if (!nonEmptyString(value, 1000)) { errors.push(`${name} must be a non-empty link`); return; }
    if (externalOnly) {
      try {
        const u = new URL(value);
        if (!['http:','https:'].includes(u.protocol)) errors.push(`${name} must use http/https`);
      } catch { errors.push(`${name} must be a valid absolute URL`); }
      return;
    }
    if (value.startsWith('#')) {
      if (!allowedFragments.has(value.slice(1))) errors.push(`${name} points to an unknown page section`);
      return;
    }
    if (value.startsWith('/#')) {
      if (!allowedFragments.has(value.slice(2))) errors.push(`${name} points to an unknown page section`);
      return;
    }
    if (value.startsWith('/')) {
      const route = value.split(/[?#]/, 1)[0];
      if (!allowedRoutes.has(route) && !/\.[a-z0-9]{2,8}$/i.test(route)) errors.push(`${name} points to an unknown local route`);
      if (value.includes('..') || value.includes('\\')) errors.push(`${name} contains an unsafe path`);
      return;
    }
    try {
      const u = new URL(value);
      if (!['http:','https:'].includes(u.protocol)) errors.push(`${name} uses an unsupported protocol`);
    } catch { errors.push(`${name} is not a valid link`); }
  };

  needObject(site, 'site');
  if (!isPlainObject(site)) return errors;
  for (const key of ['meta','assets','institution','hero','about','vision','goals','values','docs','contact','footer','programs','partners']) needObject(site[key], key);
  if (errors.length) return errors;

  needString(site.meta.title, 'meta.title', 180);
  needString(site.meta.description, 'meta.description', 500);
  needString(site.meta.url, 'meta.url', 500);
  try {
    const u = new URL(site.meta.url);
    if (!['http:','https:'].includes(u.protocol)) errors.push('meta.url must use http/https');
  } catch { errors.push('meta.url must be a valid absolute URL'); }
  needString(site.meta.ogImage, 'meta.ogImage', 500);
  if (site.meta.siteName !== undefined) needString(site.meta.siteName, 'meta.siteName', 180);

  for (const key of ['logoNav','logoHero','heroBackground','nationalCenterLogo','trusteesBoard']) needString(site.assets[key], `assets.${key}`, 500);

  needString(site.institution.type, 'institution.type', 180);
  needString(site.institution.licenseNumber, 'institution.licenseNumber', 80);
  needString(site.institution.unifiedNationalNumber, 'institution.unifiedNationalNumber', 80);
  needString(site.institution.supervision, 'institution.supervision', 180);
  needString(site.institution.licenseValidUntil, 'institution.licenseValidUntil', 120);
  validHref(site.institution.verifyUrl, 'institution.verifyUrl', { externalOnly: true });

  needArray(site.nav, 'nav');
  if (Array.isArray(site.nav)) {
    site.nav.forEach((item, index) => {
      if (!isPlainObject(item)) { errors.push(`nav[${index}] must be an object`); return; }
      needString(item.label, `nav[${index}].label`, 120);
      if (Array.isArray(item.children) && item.children.length) {
        item.children.forEach((child, childIndex) => {
          if (!isPlainObject(child)) { errors.push(`nav[${index}].children[${childIndex}] must be an object`); return; }
          needString(child.label, `nav[${index}].children[${childIndex}].label`, 120);
          validHref(child.href, `nav[${index}].children[${childIndex}].href`);
        });
      } else {
        validHref(item.href, `nav[${index}].href`);
      }
    });
  }

  needString(site.hero.headline, 'hero.headline', 240);
  needString(site.hero.lead, 'hero.lead', 1000);
  needArray(site.hero.cta, 'hero.cta');
  if (Array.isArray(site.hero.cta)) site.hero.cta.forEach((item, index) => {
    if (!isPlainObject(item)) { errors.push(`hero.cta[${index}] must be an object`); return; }
    needString(item.label, `hero.cta[${index}].label`, 120);
    validHref(item.href, `hero.cta[${index}].href`);
  });

  for (const key of ['title','subtitle','cardTitle','cardText','textTitle','p1','p2']) needString(site.about[key], `about.${key}`, 2000);

  const validateFeatureGroup = (group, name) => {
    needString(group.title, `${name}.title`, 180);
    needString(group.subtitle, `${name}.subtitle`, 500);
    needArray(group.items, `${name}.items`);
    if (Array.isArray(group.items)) group.items.forEach((item, index) => {
      if (!isPlainObject(item)) { errors.push(`${name}.items[${index}] must be an object`); return; }
      needString(item.title, `${name}.items[${index}].title`, 180);
      needString(item.text, `${name}.items[${index}].text`, 1200);
      needString(item.icon, `${name}.items[${index}].icon`, 120);
    });
  };
  validateFeatureGroup(site.vision, 'vision');
  validateFeatureGroup(site.goals, 'goals');
  validateFeatureGroup(site.values, 'values');

  for (const [name, group] of [['programs', site.programs], ['partners', site.partners]]) {
    for (const key of ['title','subtitle','cardTitle','cardText','ctaLabel']) needString(group[key], `${name}.${key}`, 1500);
    validHref(group.ctaHref, `${name}.ctaHref`);
  }

  needString(site.contact.title, 'contact.title', 180);
  needString(site.contact.subtitle, 'contact.subtitle', 1000);
  needString(site.contact.email, 'contact.email', 254);
  if (!isValidEmail(String(site.contact.email || ''))) errors.push('contact.email is invalid');
  needString(site.contact.phone, 'contact.phone', 80);
  needString(site.contact.address, 'contact.address', 500);
  if (site.contact.locationUrl) validHref(site.contact.locationUrl, 'contact.locationUrl', { externalOnly: true });
  if (site.contact.linktreeUrl) validHref(site.contact.linktreeUrl, 'contact.linktreeUrl', { externalOnly: true });
  needArray(site.contact.social, 'contact.social');
  if (Array.isArray(site.contact.social)) site.contact.social.forEach((account, index) => {
    if (!isPlainObject(account)) { errors.push(`contact.social[${index}] must be an object`); return; }
    needString(account.name, `contact.social[${index}].name`, 80);
    needString(account.label, `contact.social[${index}].label`, 80);
    if (account.name !== 'X') needString(account.icon, `contact.social[${index}].icon`, 120);
    validHref(account.url, `contact.social[${index}].url`, { externalOnly: true });
  });

  needString(site.footer.licenseText, 'footer.licenseText', 500);
  needString(site.footer.copyrightText, 'footer.copyrightText', 500);

  needObject(site.docs.governance, 'docs.governance');
  needObject(site.docs.trustees, 'docs.trustees');
  needObject(site.docs.reports, 'docs.reports');
  if (isPlainObject(site.docs.governance)) {
    needString(site.docs.governance.title, 'docs.governance.title', 180);
    needString(site.docs.governance.subtitle, 'docs.governance.subtitle', 1000);
    needArray(site.docs.governance.official, 'docs.governance.official');
    needArray(site.docs.governance.policies, 'docs.governance.policies');
    for (const [groupName, items] of [['official', site.docs.governance.official], ['policies', site.docs.governance.policies]]) {
      if (!Array.isArray(items)) continue;
      items.forEach((doc, index) => {
        if (!isPlainObject(doc)) { errors.push(`docs.governance.${groupName}[${index}] must be an object`); return; }
        for (const key of ['title','description','fileHref','previewHref','meta']) needString(doc[key], `docs.governance.${groupName}[${index}].${key}`, 1000);
        for (const key of ['category','status','updated','version','approvalDate']) {
          if (doc[key] !== undefined && doc[key] !== '') needString(doc[key], `docs.governance.${groupName}[${index}].${key}`, 300);
        }
      });
    }
    if (site.docs.governance.planned !== undefined) {
      needArray(site.docs.governance.planned, 'docs.governance.planned');
      if (Array.isArray(site.docs.governance.planned)) site.docs.governance.planned.forEach((item, index) => {
        if (!isPlainObject(item)) { errors.push(`docs.governance.planned[${index}] must be an object`); return; }
        for (const key of ['title','category','status','message']) needString(item[key], `docs.governance.planned[${index}].${key}`, 500);
      });
    }
  }
  if (isPlainObject(site.docs.trustees)) {
    needString(site.docs.trustees.title, 'docs.trustees.title', 180);
    if (site.docs.trustees.subtitle !== undefined && site.docs.trustees.subtitle !== '') needString(site.docs.trustees.subtitle, 'docs.trustees.subtitle', 500);
    needString(site.docs.trustees.imageHref, 'docs.trustees.imageHref', 500);
  }
  if (isPlainObject(site.docs.reports)) {
    needString(site.docs.reports.title, 'docs.reports.title', 180);
    needString(site.docs.reports.subtitle, 'docs.reports.subtitle', 1000);
    needArray(site.docs.reports.items, 'docs.reports.items');
  }

  return errors;
}

function localConfigAssetRefs(site) {
  const refs = [];
  if (isPlainObject(site.assets)) refs.push(...Object.values(site.assets));
  if (isPlainObject(site.meta)) refs.push(site.meta.ogImage);
  if (isPlainObject(site.docs?.trustees)) refs.push(site.docs.trustees.imageHref);
  const governance = site.docs?.governance;
  for (const group of [governance?.official, governance?.policies]) {
    if (!Array.isArray(group)) continue;
    for (const doc of group) refs.push(doc?.fileHref, doc?.previewHref);
  }
  return refs.filter((value) => typeof value === 'string' && value && !/^https?:\/\//i.test(value));
}

async function missingConfigAssets(site) {
  const missing = [];
  const cwd = resolve(process.cwd());
  for (const ref of localConfigAssetRefs(site)) {
    const clean = ref.split(/[?#]/, 1)[0];
    const relative = clean.replace(/^\/+/, '');
    const candidate = resolve(cwd, relative);
    if (candidate !== cwd && !candidate.startsWith(`${cwd}${sep}`)) { missing.push(ref); continue; }
    try {
      const info = await stat(candidate);
      if (!info.isFile()) missing.push(ref);
    } catch { missing.push(ref); }
  }
  return [...new Set(missing)];
}

function sameOriginAllowed(req) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (req.socket.encrypted ? 'https' : 'http');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) return false;
  try { return new URL(origin).origin === `${proto}://${host}`; } catch { return false; }
}

async function optionalEmailDelivery(message) {
  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey) return { attempted: false, delivered: false };

  let to = process.env.CONTACT_TO_EMAIL || '';
  if (!to) {
    try {
      const site = JSON.parse(await readFile(join(process.cwd(), 'site.json'), 'utf8'));
      to = site?.contact?.email || '';
    } catch {}
  }
  const from = process.env.CONTACT_FROM_EMAIL || '';
  if (!to || !from) return { attempted: false, delivered: false };

  const subject = `رسالة من موقع هدايات${message.subject ? ` — ${message.subject}` : ''}`;
  const body = [
    `الاسم: ${message.name}`,
    `البريد الإلكتروني: ${message.email}`,
    `الموضوع: ${message.subject || '—'}`,
    '',
    message.message
  ].join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: [to], reply_to: message.email, subject, text: body }),
      signal: AbortSignal.timeout(10000)
    });
    return { attempted: true, delivered: response.ok };
  } catch {
    return { attempted: true, delivered: false };
  }
}

async function handleFeedback(req, res) {
  if (!sameOriginAllowed(req)) {
    json(res, 403, { ok: false, message: 'تم رفض الطلب لأنه صادر من مصدر غير موثوق.' });
    return;
  }

  if (feedbackRateLimited(req)) {
    json(res, 429, { ok: false, message: 'تم استلام عدة تقييمات مؤخرًا. يرجى المحاولة لاحقًا.' }, { 'Retry-After': '3600' });
    return;
  }

  let body;
  try {
    body = parseRequestBody(req, await readBody(req, 8 * 1024));
  } catch (error) {
    if (error?.statusCode === 413) json(res, 413, { ok: false, message: 'حجم التقييم أكبر من المسموح.' });
    else json(res, 400, { ok: false, message: 'تعذر قراءة التقييم.' });
    return;
  }

  const requestLang = cleanText(body.lang, 10).toLowerCase() === 'en' ? 'en' : 'ar';
  const text = requestLang === 'en' ? {
    invalid: 'Please choose an answer before submitting your feedback.',
    storage: 'Your feedback could not be saved right now. Please try again.',
    success: 'Thank you. Your feedback has been recorded.'
  } : {
    invalid: 'اختاري تقييمًا قبل إرسال رأيك.',
    storage: 'تعذر حفظ رأيك حاليًا. يرجى المحاولة مرة أخرى.',
    success: 'شكرًا لك. تم تسجيل رأيك بنجاح.'
  };

  // Honeypot: look successful to bots without storing anything.
  if (cleanText(body['bot-field'], 100)) {
    json(res, 201, { ok: true, message: text.success });
    return;
  }

  const choice = cleanText(body.choice, 20).toLowerCase();
  if (!['yes', 'somewhat', 'no'].includes(choice)) {
    json(res, 422, { ok: false, message: text.invalid });
    return;
  }

  let page = cleanText(body.page, 500) || '/';
  if (!page.startsWith('/') || page.startsWith('//') || page.includes('\\')) page = '/';

  const feedback = {
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
    lang: requestLang,
    choice,
    page,
    comment: cleanText(body.comment, 1200)
  };

  try {
    await mkdir(dirname(feedbackMessagesFile), { recursive: true });
    await appendFile(feedbackMessagesFile, `${JSON.stringify(feedback)}\n`, { encoding: 'utf8', mode: 0o600 });
  } catch (error) {
    console.error('feedback storage error:', error?.message || error);
    json(res, 500, { ok: false, message: text.storage });
    return;
  }

  json(res, 201, { ok: true, message: text.success });
}


function isTruthy(value) {
  return value === true || value === 1 || String(value ?? '').toLowerCase() === 'true' || String(value ?? '') === '1' || String(value ?? '').toLowerCase() === 'on';
}

function participationReference() {
  const token = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  return `HDY-${new Date().getFullYear()}-${token}`;
}

async function safeReadRecentJsonl(filePath, maxLines = 200, maxBytes = 2 * 1024 * 1024) {
  try { return await readRecentJsonl(filePath, maxLines, maxBytes); }
  catch (error) { if (error?.code === 'ENOENT') return []; throw error; }
}

async function mergedParticipationRows(limit = 500) {
  const [requests, updates] = await Promise.all([
    safeReadRecentJsonl(participationRequestsFile, Math.max(limit, 5000), 6 * 1024 * 1024),
    safeReadRecentJsonl(participationUpdatesFile, 5000, 4 * 1024 * 1024)
  ]);
  const latest = new Map();
  for (const update of updates) {
    const ref = cleanText(update?.reference, 80);
    if (ref && !latest.has(ref)) latest.set(ref, update);
  }
  return requests.slice(0, limit).map((item) => {
    const update = latest.get(item.reference);
    return {
      ...item,
      status: update?.status || item.status || 'received',
      statusUpdatedAt: update?.updatedAt || item.statusUpdatedAt || item.receivedAt
    };
  });
}

async function handleSatisfaction(req, res) {
  if (!sameOriginAllowed(req)) {
    json(res, 403, { ok: false, message: 'تم رفض الطلب لأنه صادر من مصدر غير موثوق.' });
    return;
  }
  if (satisfactionRateLimited(req)) {
    json(res, 429, { ok: false, message: 'تم استلام عدة تقييمات مؤخرًا. يرجى المحاولة لاحقًا.' }, { 'Retry-After': '3600' });
    return;
  }

  let body;
  try { body = parseRequestBody(req, await readBody(req, 12 * 1024)); }
  catch (error) {
    if (error?.statusCode === 413) json(res, 413, { ok: false, message: 'حجم التقييم أكبر من المسموح.' });
    else json(res, 400, { ok: false, message: 'تعذر قراءة التقييم.' });
    return;
  }

  const lang = cleanText(body.lang, 10).toLowerCase() === 'en' ? 'en' : 'ar';
  const t = lang === 'en' ? {
    invalid: 'Please select a satisfaction score from 1 to 5.',
    storage: 'We could not save your rating right now. Please try again.',
    success: 'Thank you. Your satisfaction rating has been recorded.'
  } : {
    invalid: 'يرجى اختيار مستوى الرضا من 1 إلى 5.',
    storage: 'تعذر حفظ تقييم الرضا حاليًا. يرجى المحاولة مرة أخرى.',
    success: 'شكرًا لك. تم تسجيل مستوى رضاك.'
  };
  if (cleanText(body['bot-field'], 100)) { json(res, 201, { ok: true, message: t.success }); return; }

  const score = Number(body.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    json(res, 422, { ok: false, message: t.invalid });
    return;
  }
  const allowedReasons = new Set(['overall','clarity','ease','content','accessibility','speed','other']);
  const reason = cleanText(body.reason, 40).toLowerCase();
  let page = cleanText(body.page, 500) || '/participation/';
  if (!page.startsWith('/') || page.startsWith('//') || page.includes('\\')) page = '/participation/';
  const entry = {
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
    lang,
    score,
    reason: allowedReasons.has(reason) ? reason : 'overall',
    page,
    comment: cleanText(body.comment, 1500)
  };
  try {
    await mkdir(dirname(satisfactionResponsesFile), { recursive: true });
    await appendFile(satisfactionResponsesFile, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
  } catch (error) {
    console.error('satisfaction storage error:', error?.message || error);
    json(res, 500, { ok: false, message: t.storage });
    return;
  }
  json(res, 201, { ok: true, message: t.success });
}

async function handleParticipationRequest(req, res) {
  if (!sameOriginAllowed(req)) {
    json(res, 403, { ok: false, message: 'تم رفض الطلب لأنه صادر من مصدر غير موثوق.' });
    return;
  }
  if (participationRateLimited(req)) {
    json(res, 429, { ok: false, message: 'تم إرسال عدة طلبات مؤخرًا. يرجى المحاولة لاحقًا.' }, { 'Retry-After': '3600' });
    return;
  }

  let body;
  try { body = parseRequestBody(req, await readBody(req, 24 * 1024)); }
  catch (error) {
    if (error?.statusCode === 413) json(res, 413, { ok: false, message: 'حجم الطلب أكبر من المسموح.' });
    else json(res, 400, { ok: false, message: 'تعذر قراءة بيانات الطلب.' });
    return;
  }

  const lang = cleanText(body.lang, 10).toLowerCase() === 'en' ? 'en' : 'ar';
  const t = lang === 'en' ? {
    invalid: 'Please complete the required fields and accept the privacy notice.',
    email: 'Please enter a valid email address if you would like a response.',
    storage: 'We could not save your request right now. Please try again.',
    success: 'Your request has been received.'
  } : {
    invalid: 'يرجى إكمال الحقول المطلوبة والموافقة على إشعار الخصوصية.',
    email: 'يرجى إدخال بريد إلكتروني صحيح إذا رغبت في الحصول على رد.',
    storage: 'تعذر حفظ طلبك حاليًا. يرجى المحاولة مرة أخرى.',
    success: 'تم استلام طلبك بنجاح.'
  };
  if (cleanText(body['bot-field'], 100)) {
    json(res, 201, { ok: true, reference: participationReference(), status: 'received', message: t.success });
    return;
  }

  const allowedTypes = new Set(['suggestion','complaint','inquiry','technical']);
  const allowedCategories = new Set(['programs','governance','website','accessibility','general']);
  const type = cleanText(body.type, 30).toLowerCase();
  const category = cleanText(body.category, 30).toLowerCase();
  const subject = cleanText(body.subject, 180);
  const details = cleanText(body.details, 4000);
  const privacyAccepted = isTruthy(body.privacyAccepted);
  const responseRequested = isTruthy(body.responseRequested);
  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 254).toLowerCase();

  if (!allowedTypes.has(type) || !allowedCategories.has(category) || subject.length < 3 || details.length < 10 || !privacyAccepted) {
    json(res, 422, { ok: false, message: t.invalid });
    return;
  }
  if ((responseRequested || email) && !isValidEmail(email)) {
    json(res, 422, { ok: false, message: t.email });
    return;
  }

  const now = new Date().toISOString();
  const request = {
    id: randomUUID(),
    reference: participationReference(),
    receivedAt: now,
    status: 'received',
    statusUpdatedAt: now,
    lang,
    type,
    category,
    subject,
    details,
    responseRequested,
    name: responseRequested ? name : '',
    email: responseRequested ? email : ''
  };
  try {
    await mkdir(dirname(participationRequestsFile), { recursive: true });
    await appendFile(participationRequestsFile, `${JSON.stringify(request)}\n`, { encoding: 'utf8', mode: 0o600 });
  } catch (error) {
    console.error('participation storage error:', error?.message || error);
    json(res, 500, { ok: false, message: t.storage });
    return;
  }
  json(res, 201, { ok: true, reference: request.reference, status: request.status, receivedAt: request.receivedAt, message: t.success });
}

async function handleParticipationStatus(req, res, url) {
  const lang = cleanText(url.searchParams.get('lang'), 10).toLowerCase() === 'en' ? 'en' : 'ar';
  const text = lang === 'en' ? {
    invalid: 'The reference number is not valid.',
    missing: 'No request was found with this reference number.',
    error: 'We could not check the request status right now.',
    limited: 'Too many status checks. Please try again later.'
  } : {
    invalid: 'رقم الطلب غير صالح.',
    missing: 'لم يتم العثور على طلب بهذا الرقم.',
    error: 'تعذر التحقق من حالة الطلب حاليًا.',
    limited: 'تم إجراء عدد كبير من عمليات التحقق. يرجى المحاولة لاحقًا.'
  };
  if (participationStatusRateLimited(req)) {
    json(res, 429, { ok: false, message: text.limited }, { 'Retry-After': '900' });
    return;
  }
  const reference = cleanText(url.searchParams.get('reference'), 80).toUpperCase();
  if (!/^HDY-\d{4}-[A-F0-9]{10}$/.test(reference)) {
    json(res, 422, { ok: false, message: text.invalid });
    return;
  }
  try {
    const rows = await mergedParticipationRows(5000);
    const match = rows.find((item) => item.reference === reference);
    if (!match) { json(res, 404, { ok: false, message: text.missing }); return; }
    json(res, 200, {
      ok: true,
      data: {
        reference: match.reference,
        status: match.status,
        receivedAt: match.receivedAt,
        statusUpdatedAt: match.statusUpdatedAt,
        type: match.type
      }
    });
  } catch (error) {
    console.error('participation status error:', error?.message || error);
    json(res, 500, { ok: false, message: text.error });
  }
}

async function handleContact(req, res) {
  if (!sameOriginAllowed(req)) {
    json(res, 403, { ok: false, message: 'تم رفض الطلب لأنه صادر من مصدر غير موثوق.' });
    return;
  }

  if (rateLimited(req)) {
    json(res, 429, { ok: false, message: 'تم تجاوز عدد المحاولات المسموح بها مؤقتًا. يرجى المحاولة لاحقًا.' }, { 'Retry-After': '900' });
    return;
  }

  let body;
  try {
    body = parseRequestBody(req, await readBody(req));
  } catch (error) {
    if (error?.statusCode === 413) json(res, 413, { ok: false, message: 'حجم بيانات النموذج أكبر من المسموح.' });
    else json(res, 400, { ok: false, message: 'تعذر قراءة بيانات النموذج.' });
    return;
  }

  const requestLang = cleanText(body.lang, 10).toLowerCase() === 'en' ? 'en' : 'ar';
  const contactText = requestLang === 'en' ? {
    rejected: 'This request could not be accepted from the current source.',
    limited: 'Too many attempts. Please try again later.',
    tooLarge: 'The submitted form is larger than allowed.',
    unreadable: 'The form data could not be read.',
    received: 'Your message has been received.',
    invalid: 'Please check your name, email address and message.',
    storage: 'Your message could not be saved right now. Please try again.',
    success: 'Your message has been received and recorded successfully.'
  } : {
    rejected: 'تم رفض الطلب لأنه صادر من مصدر غير موثوق.',
    limited: 'تم تجاوز عدد المحاولات المسموح بها مؤقتًا. يرجى المحاولة لاحقًا.',
    tooLarge: 'حجم بيانات النموذج أكبر من المسموح.',
    unreadable: 'تعذر قراءة بيانات النموذج.',
    received: 'تم استلام الرسالة.',
    invalid: 'يرجى التأكد من الاسم والبريد الإلكتروني ونص الرسالة.',
    storage: 'تعذر حفظ الرسالة حاليًا. يرجى المحاولة مرة أخرى.',
    success: 'تم استلام رسالتك وتسجيلها بنجاح.'
  };

  // Honeypot: return a normal-looking success response without recording spam.
  if (cleanText(body['bot-field'], 100)) {
    json(res, 200, { ok: true, message: contactText.received });
    return;
  }

  const message = {
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
    lang: requestLang,
    name: cleanText(body.name, 120),
    email: cleanText(body.email, 254).toLowerCase(),
    subject: cleanText(body.subject, 180),
    message: cleanText(body.message, 5000)
  };

  if (message.name.length < 2 || !isValidEmail(message.email) || message.message.length < 3) {
    json(res, 422, { ok: false, message: contactText.invalid });
    return;
  }

  try {
    await mkdir(dirname(contactMessagesFile), { recursive: true });
    await appendFile(contactMessagesFile, `${JSON.stringify(message)}\n`, { encoding: 'utf8', mode: 0o600 });
  } catch (error) {
    console.error('contact storage error:', error?.message || error);
    json(res, 500, { ok: false, message: contactText.storage });
    return;
  }

  const delivery = await optionalEmailDelivery(message);
  const acceptsJson = String(req.headers.accept || '').includes('application/json');
  if (!acceptsJson) {
    res.writeHead(303, { Location: requestLang === 'en' ? '/en/?sent=1#contact' : '/thank/', 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  json(res, 201, {
    ok: true,
    delivered: delivery.delivered,
    message: contactText.success
  });
}

function signSession(exp) {
  const payload = String(exp);
  const sig = createHmac('sha256', adminSecret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifySession(token) {
  if (!adminPassword || !adminSecret || !token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 2) return false;
  const [expText, sig] = parts;
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = createHmac('sha256', adminSecret).update(expText).digest('hex');
  try {
    return sig?.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => {
    const i = part.indexOf('=');
    if (i < 0) return ['', ''];
    const key = part.slice(0, i).trim();
    const raw = part.slice(i + 1).trim();
    try { return [key, decodeURIComponent(raw)]; } catch { return [key, raw]; }
  }).filter(([k]) => k));
}

function isAdmin(req) {
  return verifySession(cookies(req)[SESSION_COOKIE]);
}

function secureCookie(req) {
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https' || Boolean(req.socket.encrypted);
}

async function readRecentJsonl(filePath, maxLines = 200, maxBytes = 2 * 1024 * 1024) {
  const handle = await open(filePath, 'r');
  try {
    const info = await handle.stat();
    const length = Math.min(info.size, maxBytes);
    if (length <= 0) return [];
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, info.size - length);
    let raw = buffer.toString('utf8');
    if (info.size > length) {
      const firstNewline = raw.indexOf('\n');
      raw = firstNewline >= 0 ? raw.slice(firstNewline + 1) : '';
    }
    return raw.split('\n').filter(Boolean).slice(-maxLines).reverse().map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } finally {
    await handle.close();
  }
}

async function handleAdminApi(req, res, pathname) {
  if (pathname.startsWith('/api/admin/') && ['POST','PUT','PATCH','DELETE'].includes(req.method || '') && !sameOriginAllowed(req)) {
    json(res, 403, { ok: false, message: 'تم رفض الطلب لأنه صادر من مصدر غير موثوق.' });
    return true;
  }

  if (pathname === '/api/admin/login' && req.method === 'POST') {
    if (adminLoginRateLimited(req)) {
      json(res, 429, { ok: false, message: 'محاولات دخول كثيرة. يرجى الانتظار قليلًا ثم المحاولة من جديد.' }, { 'Retry-After': '900' });
      return true;
    }
    if (!adminPassword) {
      json(res, 503, { ok: false, message: 'لوحة التحكم غير مفعّلة. أضف ADMIN_PASSWORD في متغيرات Railway.' });
      return true;
    }
    let body;
    try { body = parseRequestBody(req, await readBody(req, 8 * 1024)); }
    catch { json(res, 400, { ok: false, message: 'طلب غير صالح.' }); return true; }
    const supplied = String(body.password || '');
    const a = createHash('sha256').update(supplied).digest();
    const b = createHash('sha256').update(adminPassword).digest();
    const ok = timingSafeEqual(a, b);
    if (!ok) { recordAdminLoginFailure(req); json(res, 401, { ok: false, message: 'كلمة المرور غير صحيحة.' }); return true; }
    clearAdminLoginFailures(req);
    const exp = Date.now() + SESSION_TTL_SECONDS * 1000;
    const cookie = `${SESSION_COOKIE}=${encodeURIComponent(signSession(exp))}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secureCookie(req) ? '; Secure' : ''}`;
    json(res, 200, { ok: true }, { 'Set-Cookie': cookie });
    return true;
  }

  if (pathname === '/api/admin/logout' && req.method === 'POST') {
    json(res, 200, { ok: true }, { 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookie(req) ? '; Secure' : ''}` });
    return true;
  }

  if (!pathname.startsWith('/api/admin/')) return false;
  if (!isAdmin(req)) { json(res, 401, { ok: false, message: 'يرجى تسجيل الدخول.' }); return true; }

  if (pathname === '/api/admin/site' && req.method === 'GET') {
    try {
      const data = JSON.parse(await readFile(join(process.cwd(), 'site.json'), 'utf8'));
      json(res, 200, { ok: true, data });
    } catch {
      json(res, 500, { ok: false, message: 'تعذر قراءة محتوى الموقع.' });
    }
    return true;
  }

  if (pathname === '/api/admin/site' && req.method === 'PUT') {
    if (adminSaveInProgress) {
      json(res, 409, { ok: false, message: 'يوجد حفظ آخر قيد التنفيذ. انتظر اكتماله ثم أعد المحاولة.' }, { 'Retry-After': '5' });
      return true;
    }

    let next;
    try { next = parseRequestBody(req, await readBody(req, 1024 * 1024)); }
    catch (error) {
      if (error?.statusCode === 413) json(res, 413, { ok: false, message: 'ملف المحتوى أكبر من الحد المسموح.' });
      else json(res, 400, { ok: false, message: 'ملف المحتوى غير صالح.' });
      return true;
    }

    const validationErrors = validateSiteConfig(next);
    if (validationErrors.length) {
      console.warn('admin content validation rejected:', validationErrors.join('; '));
      json(res, 422, { ok: false, message: 'بنية المحتوى غير مكتملة أو غير صالحة. لم يتم الحفظ.' });
      return true;
    }
    const missingAssets = await missingConfigAssets(next);
    if (missingAssets.length) {
      json(res, 422, { ok: false, message: `تعذر الحفظ لأن بعض الملفات المشار إليها غير موجودة: ${missingAssets.join(', ')}` });
      return true;
    }

    const sourceFile = join(process.cwd(), 'site.json');
    const tempPersistedFile = `${persistedSiteFile}.tmp-${process.pid}`;
    let previous = '';
    adminSaveInProgress = true;
    try {
      previous = await readFile(sourceFile, 'utf8');
      const serialized = `${JSON.stringify(next, null, 2)}\n`;

      // 1) Apply to the build source only.
      await writeFile(sourceFile, serialized, 'utf8');
      // 2) Validate the complete site by building it. Nothing persistent is changed before this succeeds.
      await execFileAsync('npm', ['run', 'build'], { cwd: process.cwd(), timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
      // 3) Commit the validated content atomically to the persistent volume.
      await mkdir(dirname(persistedSiteFile), { recursive: true });
      await writeFile(tempPersistedFile, serialized, { encoding: 'utf8', mode: 0o600 });
      await rename(tempPersistedFile, persistedSiteFile);

      json(res, 200, { ok: true, message: 'تم التحقق من التعديل وحفظ المحتوى وإعادة بناء الموقع بنجاح.' });
    } catch (error) {
      console.error('admin save/build error:', error?.message || error);
      await rm(tempPersistedFile, { force: true }).catch(() => {});
      if (previous) {
        try {
          await writeFile(sourceFile, previous, 'utf8');
          await execFileAsync('npm', ['run', 'build'], { cwd: process.cwd(), timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
        } catch (restoreError) {
          console.error('admin rollback build error:', restoreError?.message || restoreError);
        }
      }
      json(res, 500, { ok: false, message: 'تعذر تطبيق التعديل. لم تُحفظ النسخة غير الصالحة وتمت استعادة النسخة السابقة.' });
    } finally {
      adminSaveInProgress = false;
    }
    return true;
  }

  if (pathname === '/api/admin/messages' && req.method === 'GET') {
    try {
      const data = await readRecentJsonl(contactMessagesFile, 200);
      json(res, 200, { ok: true, data });
    } catch (error) {
      if (error?.code === 'ENOENT') json(res, 200, { ok: true, data: [] });
      else json(res, 500, { ok: false, message: 'تعذر قراءة الرسائل.' });
    }
    return true;
  }

  if (pathname === '/api/admin/feedback' && req.method === 'GET') {
    try {
      const data = await readRecentJsonl(feedbackMessagesFile, 500);
      json(res, 200, { ok: true, data });
    } catch (error) {
      if (error?.code === 'ENOENT') json(res, 200, { ok: true, data: [] });
      else json(res, 500, { ok: false, message: 'تعذر قراءة آراء الزوار.' });
    }
    return true;
  }

  if (pathname === '/api/admin/satisfaction' && req.method === 'GET') {
    try {
      const data = await safeReadRecentJsonl(satisfactionResponsesFile, 1000, 4 * 1024 * 1024);
      json(res, 200, { ok: true, data });
    } catch {
      json(res, 500, { ok: false, message: 'تعذر قراءة قياسات الرضا.' });
    }
    return true;
  }

  if (pathname === '/api/admin/participation' && req.method === 'GET') {
    try {
      const data = await mergedParticipationRows(1000);
      json(res, 200, { ok: true, data });
    } catch {
      json(res, 500, { ok: false, message: 'تعذر قراءة طلبات المستفيدين.' });
    }
    return true;
  }

  if (pathname === '/api/admin/participation/status' && req.method === 'PATCH') {
    let body;
    try { body = parseRequestBody(req, await readBody(req, 8 * 1024)); }
    catch { json(res, 400, { ok: false, message: 'طلب غير صالح.' }); return true; }
    const reference = cleanText(body.reference, 80).toUpperCase();
    const status = cleanText(body.status, 30).toLowerCase();
    if (!/^HDY-\d{4}-[A-F0-9]{10}$/.test(reference) || !['received','in_review','resolved','closed'].includes(status)) {
      json(res, 422, { ok: false, message: 'رقم الطلب أو الحالة غير صالح.' });
      return true;
    }
    const rows = await mergedParticipationRows(5000);
    if (!rows.some((item) => item.reference === reference)) {
      json(res, 404, { ok: false, message: 'لم يتم العثور على الطلب.' });
      return true;
    }
    const update = { reference, status, updatedAt: new Date().toISOString() };
    try {
      await mkdir(dirname(participationUpdatesFile), { recursive: true });
      await appendFile(participationUpdatesFile, `${JSON.stringify(update)}\n`, { encoding: 'utf8', mode: 0o600 });
      json(res, 200, { ok: true, message: 'تم تحديث حالة الطلب.', data: update });
    } catch {
      json(res, 500, { ok: false, message: 'تعذر تحديث حالة الطلب.' });
    }
    return true;
  }

  json(res, 404, { ok: false, message: 'المسار غير موجود.' });
  return true;
}

async function serveStatic(req, res, pathname) {
  let safePath;
  try { safePath = decodeURIComponent(pathname); }
  catch { throw requestError('bad path encoding', 400); }
  if (safePath === '/') safePath = '/index.html';
  let file = resolve(root, `.${safePath}`);
  if (file !== root && !file.startsWith(`${root}${sep}`)) throw new Error('bad path');

  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, 'index.html');
  } catch {
    if (!extname(file)) file = join(file, 'index.html');
  }

  const s = await stat(file);
  if (!s.isFile()) throw new Error('not a file');
  const ext = extname(file).toLowerCase();
  const contentType = types[ext] || 'application/octet-stream';
  const noCache = ext === '.html' || ext === '.css' || ext === '.js' || ext === '.mjs' || file.endsWith('hedayat-official-logo-v5.png') || file.endsWith('hedayat-official-logo-hero-v7.png');
  const commonHeaders = {
    ...securityHeadersFor(contentType),
    'Content-Type': contentType,
    'Cache-Control': noCache ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600',
    'Accept-Ranges': 'bytes'
  };

  const range = String(req.headers.range || '');
  if (range && /^bytes=\d*-\d*$/.test(range)) {
    const [startText, endText] = range.replace('bytes=', '').split('-');
    let start;
    let end;
    if (startText === '') {
      const suffix = Number(endText);
      start = Math.max(0, s.size - suffix);
      end = s.size - 1;
    } else {
      start = Number(startText);
      end = endText ? Number(endText) : s.size - 1;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= s.size) {
      res.writeHead(416, { ...commonHeaders, 'Content-Range': `bytes */${s.size}` });
      res.end();
      return;
    }
    end = Math.min(end, s.size - 1);
    res.writeHead(206, {
      ...commonHeaders,
      'Content-Range': `bytes ${start}-${end}/${s.size}`,
      'Content-Length': String(end - start + 1)
    });
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(file, { start, end });
    stream.on('error', (error) => {
      console.error('static range stream error:', error?.message || error);
      if (!res.destroyed) res.destroy(error);
    });
    stream.pipe(res);
    return;
  }

  res.writeHead(200, { ...commonHeaders, 'Content-Length': String(s.size) });
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = createReadStream(file);
  stream.on('error', (error) => {
    console.error('static stream error:', error?.message || error);
    if (!res.destroyed) res.destroy(error);
  });
  stream.pipe(res);
}

async function bootstrapPersistentSite() {
  try {
    const persisted = await readFile(persistedSiteFile, 'utf8');
    const parsed = JSON.parse(persisted);
    if (!parsed?.meta || !parsed?.contact) return;
    const sourceFile = join(process.cwd(), 'site.json');
    const current = await readFile(sourceFile, 'utf8').catch(() => '');
    if (current.trim() === persisted.trim()) return;

    await writeFile(sourceFile, persisted, 'utf8');
    try {
      await execFileAsync('npm', ['run', 'build'], { cwd: process.cwd(), timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
      console.log('Loaded persisted site content and rebuilt dist.');
    } catch (buildError) {
      // A bad persisted edit must never trap every future restart in the same failed build.
      console.error('persisted site build failed; restoring bundled content:', buildError?.message || buildError);
      if (current) {
        await writeFile(sourceFile, current, 'utf8');
        await execFileAsync('npm', ['run', 'build'], { cwd: process.cwd(), timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
        await mkdir(dirname(persistedSiteFile), { recursive: true });
        await writeFile(persistedSiteFile, current, { encoding: 'utf8', mode: 0o600 });
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') console.error('persistent site bootstrap skipped:', error?.message || error);
  }
}

await bootstrapPersistentSite();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (pathname === '/api/contact' && req.method === 'POST') {
      await handleContact(req, res);
      return;
    }

    if (pathname === '/api/feedback' && req.method === 'POST') {
      await handleFeedback(req, res);
      return;
    }

    if (pathname === '/api/satisfaction' && req.method === 'POST') {
      await handleSatisfaction(req, res);
      return;
    }

    if (pathname === '/api/participation' && req.method === 'POST') {
      await handleParticipationRequest(req, res);
      return;
    }

    if (pathname === '/api/participation/status' && req.method === 'GET') {
      await handleParticipationStatus(req, res, url);
      return;
    }

    if (await handleAdminApi(req, res, pathname)) return;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      json(res, 405, { ok: false, message: 'الطريقة غير مسموحة.' }, { Allow: 'GET, HEAD' });
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (error) {
    if (error?.statusCode === 400) {
      res.writeHead(400, { ...BASE_SECURITY_HEADERS, 'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'no-store' });
      res.end('Bad Request');
      return;
    }
    try {
      const notFoundFile = join(root, '404.html');
      const body = await readFile(notFoundFile);
      res.writeHead(404, {
        ...securityHeadersFor('text/html; charset=utf-8'),
        'Content-Type':'text/html; charset=utf-8',
        'Cache-Control':'no-cache, no-store, must-revalidate'
      });
      res.end(body);
    } catch {
      res.writeHead(404, { ...BASE_SECURITY_HEADERS, 'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'no-store' });
      res.end('Not Found');
    }
  }
});

server.requestTimeout = 300000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;
server.maxHeadersCount = 100;
server.listen(port, '0.0.0.0', () => console.log(`Hedayaat site on ${port}`));
