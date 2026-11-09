// Public news page: loads news published from the admin panel (/api/news).
// The list shows cards; ?n=<id> opens one article in the same page (shareable link).
(function () {
  var root = document.querySelector('[data-news-feed]');
  if (!root) return;
  var en = document.documentElement.lang === 'en';
  var listEl = root.querySelector('[data-news-list]');
  var articleEl = root.querySelector('[data-news-article]');
  var empty = document.querySelector('[data-news-empty]');
  var baseTitle = document.title;
  var T = en
    ? { more: 'Read more', back: 'Back to all news', share: 'Share', copied: 'Link copied', notFound: 'This news item is no longer available.' }
    : { more: 'اقرأ المزيد', back: 'العودة لكل الأخبار', share: 'مشاركة', copied: 'تم نسخ الرابط', notFound: 'هذا الخبر لم يعد متاحًا.' };
  var items = [];

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function linkify(html) { return html.replace(/(https?:\/\/[^\s<]+[^\s<.,،:;"')\]])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'); }
  // Pick the page language; fall back to Arabic text (marked rtl) when no English version exists.
  function pick(n) {
    var useAr = !en || !n.titleEn;
    return { title: useAr ? n.title : n.titleEn, body: useAr ? n.body : (n.bodyEn || n.body), ar: useAr && en };
  }
  function fmtDate(d) {
    if (!d) return '';
    try { return new Intl.DateTimeFormat(en ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d + 'T12:00:00')); }
    catch (e) { return d; }
  }
  function excerpt(t, max) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, '') + '…' : t; }
  function langAttr(p) { return p.ar ? ' lang="ar" dir="rtl"' : ''; }
  function url(id) { return location.pathname + (id ? '?n=' + encodeURIComponent(id) : ''); }

  function renderList() {
    listEl.innerHTML = items.map(function (n, i) {
      var p = pick(n);
      return '<article class="nw-card' + (i === 0 ? ' nw-card--lead' : '') + '"' + langAttr(p) + '>' +
        '<a class="nw-card-link" href="' + url(n.id) + '" data-id="' + esc(n.id) + '">' +
        (n.thumb ? '<span class="nw-card-media"><img src="' + esc(i === 0 && n.image ? n.image : n.thumb) + '" alt="" loading="' + (i < 3 ? 'eager' : 'lazy') + '" decoding="async" /></span>'
                 : '<span class="nw-card-media nw-card-media--empty" aria-hidden="true"><i class="bi bi-newspaper"></i></span>') +
        '<span class="nw-card-body"><time datetime="' + esc(n.date) + '">' + esc(fmtDate(n.date)) + '</time>' +
        '<h2>' + esc(p.title) + '</h2><p>' + esc(excerpt(p.body, i === 0 ? 260 : 150)) + '</p>' +
        '<span class="nw-more">' + T.more + ' <i class="bi bi-arrow-' + (en ? 'right' : 'left') + '" aria-hidden="true"></i></span></span></a></article>';
    }).join('');
  }

  function renderArticle(id) {
    var n = items.filter(function (x) { return x.id === id; })[0];
    if (!n) {
      articleEl.innerHTML = '<div class="nw-article"><p>' + T.notFound + '</p><a class="nw-back" href="' + url('') + '" data-back><i class="bi bi-arrow-' + (en ? 'left' : 'right') + '" aria-hidden="true"></i> ' + T.back + '</a></div>';
    } else {
      var p = pick(n);
      var paras = String(p.body || '').split(/\n\s*\n/).map(function (para) { return '<p>' + linkify(esc(para.trim())).replace(/\n/g, '<br />') + '</p>'; }).join('');
      articleEl.innerHTML = '<article class="nw-article"' + langAttr(p) + '>' +
        '<a class="nw-back" href="' + url('') + '" data-back><i class="bi bi-arrow-' + (en ? 'left' : 'right') + '" aria-hidden="true"></i> ' + T.back + '</a>' +
        '<time datetime="' + esc(n.date) + '">' + esc(fmtDate(n.date)) + '</time>' +
        '<h2 tabindex="-1">' + esc(p.title) + '</h2>' +
        (n.image ? '<figure class="nw-article-media"><img src="' + esc(n.image) + '" alt="' + esc(p.title) + '"' + (n.width ? ' width="' + n.width + '" height="' + n.height + '"' : '') + ' /></figure>' : '') +
        '<div class="nw-article-body">' + paras + '</div>' +
        '<div class="nw-article-foot"><button type="button" class="nw-share" data-share><i class="bi bi-share" aria-hidden="true"></i> <span>' + T.share + '</span></button></div></article>';
      document.title = p.title + ' | ' + baseTitle;
    }
    listEl.hidden = true;
    articleEl.hidden = false;
  }

  function route(scroll) {
    var id = new URLSearchParams(location.search).get('n');
    if (id) renderArticle(id);
    else { articleEl.hidden = true; articleEl.innerHTML = ''; listEl.hidden = false; document.title = baseTitle; }
    if (scroll) {
      var top = root.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      var h = articleEl.hidden ? null : articleEl.querySelector('h2');
      if (h) h.focus({ preventScroll: true });
    }
  }

  root.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-id], a[data-back]');
    if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      history.pushState(null, '', a.hasAttribute('data-back') ? url('') : url(a.getAttribute('data-id')));
      route(true);
      return;
    }
    var s = e.target.closest('[data-share]');
    if (s) {
      var link = location.href;
      if (navigator.share) { navigator.share({ title: document.title, url: link }).catch(function () {}); }
      else if (navigator.clipboard) { navigator.clipboard.writeText(link).then(function () { s.querySelector('span').textContent = T.copied; setTimeout(function () { s.querySelector('span').textContent = T.share; }, 2200); }); }
    }
  });
  window.addEventListener('popstate', function () { route(true); });

  fetch('/api/news', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) {
      items = (res && res.data) || [];
      if (!items.length) return;
      renderList();
      root.hidden = false;
      if (empty) empty.hidden = true;
      route(Boolean(new URLSearchParams(location.search).get('n')));
    })
    .catch(function () {});
})();
