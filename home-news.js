// Homepage "Latest news": shows the 3 newest items published from the admin panel.
// The whole section stays hidden when nothing is published.
(function () {
  var section = document.querySelector('[data-home-news]');
  if (!section) return;
  var grid = section.querySelector('[data-home-news-grid]');
  var en = document.documentElement.lang === 'en';
  var base = en ? '/en/news/' : '/news/';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtDate(d) {
    if (!d) return '';
    try { return new Intl.DateTimeFormat(en ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d + 'T12:00:00')); }
    catch (e) { return d; }
  }
  function excerpt(t, max) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, '') + '…' : t; }
  fetch('/api/news', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) {
      var items = ((res && res.data) || []).slice(0, 3);
      if (!items.length) return;
      grid.innerHTML = items.map(function (n) {
        var useAr = !en || !n.titleEn;
        var title = useAr ? n.title : n.titleEn;
        var body = useAr ? n.body : (n.bodyEn || n.body);
        var attr = useAr && en ? ' lang="ar" dir="rtl"' : '';
        return '<article class="nw-card"' + attr + '><a class="nw-card-link" href="' + base + '?n=' + encodeURIComponent(n.id) + '">' +
          (n.thumb ? '<span class="nw-card-media"><img src="' + esc(n.thumb) + '" alt="" loading="lazy" decoding="async" /></span>'
                   : '<span class="nw-card-media nw-card-media--empty" aria-hidden="true"><i class="bi bi-newspaper"></i></span>') +
          '<span class="nw-card-body"><time datetime="' + esc(n.date) + '">' + esc(fmtDate(n.date)) + '</time><h3>' + esc(title) + '</h3>' +
          '<p>' + esc(excerpt(body, 120)) + '</p></span></a></article>';
      }).join('');
      grid.setAttribute('data-count', String(items.length));
      section.hidden = false;
    })
    .catch(function () {});
})();
