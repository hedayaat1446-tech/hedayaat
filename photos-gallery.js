// Public photo gallery: loads photos published from the admin panel (/api/photos) and shows them with a lightbox.
(function () {
  var root = document.querySelector('[data-photo-gallery]');
  if (!root) return;
  var en = document.documentElement.lang === 'en';
  var grid = root.querySelector('[data-photo-grid]');
  var empty = document.querySelector('[data-photo-empty]');
  var T = en
    ? { open: 'Open photo', close: 'Close', prev: 'Previous photo', next: 'Next photo', of: ' of ' }
    : { open: 'عرض الصورة', close: 'إغلاق', prev: 'الصورة السابقة', next: 'الصورة التالية', of: ' من ' };
  var photos = [];
  var current = 0;
  var lastFocus = null;

  function captionOf(p) { return (en ? (p.captionEn || p.caption) : (p.caption || p.captionEn)) || ''; }
  function fmtDate(d) {
    if (!d) return '';
    try {
      return new Intl.DateTimeFormat(en ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d + 'T12:00:00'));
    } catch (e) { return d; }
  }

  // Lightbox
  var box = document.createElement('div');
  box.className = 'pg-lightbox';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML =
    '<button type="button" class="pg-lb-btn pg-lb-close" aria-label="' + T.close + '"><i class="bi bi-x-lg" aria-hidden="true"></i></button>' +
    '<button type="button" class="pg-lb-btn pg-lb-prev" aria-label="' + T.prev + '"><i class="bi bi-chevron-' + (en ? 'left' : 'right') + '" aria-hidden="true"></i></button>' +
    '<figure class="pg-lb-figure"><img alt="" /><figcaption><span class="pg-lb-cap"></span><span class="pg-lb-meta"></span></figcaption></figure>' +
    '<button type="button" class="pg-lb-btn pg-lb-next" aria-label="' + T.next + '"><i class="bi bi-chevron-' + (en ? 'right' : 'left') + '" aria-hidden="true"></i></button>';
  document.body.appendChild(box);
  var lbImg = box.querySelector('img');
  var lbCap = box.querySelector('.pg-lb-cap');
  var lbMeta = box.querySelector('.pg-lb-meta');

  function show(i) {
    current = (i + photos.length) % photos.length;
    var p = photos[current];
    lbImg.src = p.src;
    lbImg.alt = captionOf(p);
    lbCap.textContent = captionOf(p);
    lbMeta.textContent = [fmtDate(p.date), (current + 1) + T.of + photos.length].filter(Boolean).join(' · ');
    box.querySelector('.pg-lb-prev').hidden = box.querySelector('.pg-lb-next').hidden = photos.length < 2;
  }
  function open(i) {
    lastFocus = document.activeElement;
    show(i);
    box.hidden = false;
    document.documentElement.classList.add('pg-locked');
    box.querySelector('.pg-lb-close').focus();
  }
  function close() {
    box.hidden = true;
    lbImg.removeAttribute('src');
    document.documentElement.classList.remove('pg-locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  box.querySelector('.pg-lb-close').addEventListener('click', close);
  box.querySelector('.pg-lb-prev').addEventListener('click', function () { show(current - 1); });
  box.querySelector('.pg-lb-next').addEventListener('click', function () { show(current + 1); });
  box.addEventListener('click', function (e) { if (e.target === box) close(); });
  document.addEventListener('keydown', function (e) {
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(current + (en ? -1 : 1));
    else if (e.key === 'ArrowRight') show(current + (en ? 1 : -1));
    else if (e.key === 'Tab') {
      var f = Array.prototype.filter.call(box.querySelectorAll('button'), function (b) { return !b.hidden; });
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  var touchX = null;
  box.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) show(current + ((dx < 0) === en ? 1 : -1));
  });

  fetch('/api/photos', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) {
      photos = (res && res.data) || [];
      if (!photos.length) return;
      grid.innerHTML = '';
      photos.forEach(function (p, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pg-item';
        b.setAttribute('aria-label', T.open + (captionOf(p) ? ': ' + captionOf(p) : ''));
        var img = document.createElement('img');
        img.src = p.thumb;
        img.alt = captionOf(p);
        img.loading = 'lazy';
        img.decoding = 'async';
        if (p.width && p.height) { img.width = 640; img.height = Math.round(640 * p.height / p.width); }
        b.appendChild(img);
        if (captionOf(p) || p.date) {
          var cap = document.createElement('span');
          cap.className = 'pg-cap';
          cap.innerHTML = '<strong></strong><small></small>';
          cap.firstChild.textContent = captionOf(p);
          cap.lastChild.textContent = fmtDate(p.date);
          b.appendChild(cap);
        }
        b.addEventListener('click', function () { open(i); });
        grid.appendChild(b);
      });
      root.hidden = false;
      if (empty) empty.hidden = true;
    })
    .catch(function () {});
})();
