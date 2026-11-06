// Saudi occasions on the home-page lighthouse: the beam, sky and greeting change by themselves
// on national days (Gregorian) and on Ramadan / Eid (Umm al-Qura Hijri calendar), then return to normal.
// Preview any theme with ?occasion=national|founding|flag|ramadan|eid  (or ?occasion=off).
(() => {
  const layer = document.querySelector('[data-occasion-layer]');
  if (!layer) return;
  const root = document.documentElement;
  const lang = root.lang === 'en' ? 'en' : 'ar';
  const cfg = layer.dataset;
  if (cfg.enabled === 'false') return;

  const tz = 'Asia/Riyadh';
  const now = new Date();
  const part = (fmt, type) => Number(fmt.formatToParts(now).find((p) => p.type === type)?.value);
  const g = new Intl.DateTimeFormat('en-u-ca-gregory', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' });
  const gy = part(g, 'year'), gm = part(g, 'month'), gd = part(g, 'day');
  let hm = 0, hd = 0;
  try {
    const h = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { timeZone: tz, month: 'numeric', day: 'numeric' });
    hm = part(h, 'month'); hd = part(h, 'day');
  } catch {}

  const OCCASIONS = [
    { id: 'eid', test: () => (hm === 10 && hd <= 4) || (hm === 12 && hd >= 9 && hd <= 13) },
    { id: 'national', test: () => gm === 9 && gd >= 21 && gd <= 25 },
    { id: 'founding', test: () => gm === 2 && gd >= 20 && gd <= 23 },
    { id: 'flag', test: () => gm === 3 && gd >= 10 && gd <= 12 },
    { id: 'ramadan', test: () => hm === 9 }
  ];
  const forced = new URLSearchParams(location.search).get('occasion') || cfg.force || '';
  if (forced === 'off') return;
  const occ = forced ? OCCASIONS.find((o) => o.id === forced) : OCCASIONS.find((o) => o.test());
  if (!occ) return;

  const nationalNo = gy - 1930;
  const GREET = {
    ar: { national: `اليوم الوطني ${nationalNo} · دام عزك يا وطن`, founding: 'يوم التأسيس · يوم بدينا', flag: 'يوم العلم السعودي', ramadan: 'رمضان كريم · تقبّل الله منا ومنكم', eid: 'عيدكم مبارك · وكل عام وأنتم بخير' },
    en: { national: `Saudi National Day ${nationalNo}`, founding: 'Happy Saudi Founding Day', flag: 'Saudi Flag Day', ramadan: 'Ramadan Kareem', eid: 'Eid Mubarak' }
  };
  const ICON = { national: 'bi-flag-fill', founding: 'bi-stars', flag: 'bi-flag-fill', ramadan: 'bi-moon-stars-fill', eid: 'bi-stars' };

  // Geometry of the illustration (viewBox 1000 x 560, same crop as the background image).
  const BEAM = '108,126 1000,0 1000,392 108,146';
  const beam = (c1, c2, op = 0.62) => `
    <defs>
      <linearGradient id="occBeam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c1}" stop-opacity=".95"/><stop offset=".55" stop-color="${c2}" stop-opacity=".55"/><stop offset="1" stop-color="${c2}" stop-opacity=".18"/></linearGradient>
      <filter id="occSoft" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <polygon class="occ-beam" points="${BEAM}" fill="url(#occBeam)" filter="url(#occSoft)" style="--o:${op}"/>`;
  const flag = (x = 93, y = 108, s = 1) => `
    <g class="occ-flag" transform="translate(${x} ${y}) scale(${s})">
      <line x1="0" y1="0" x2="0" y2="-40" stroke="#5b5b5b" stroke-width="2.4" stroke-linecap="round"/>
      <g transform="translate(0 18)"><g class="occ-flag-cloth">
        <path d="M1 -58 C 14 -62, 26 -54, 44 -58 L 44 -30 C 26 -26, 14 -34, 1 -30 Z" fill="#006C35"/>
        <path d="M9 -50 q4 -3 8 0 t8 0 t8 0" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        <path d="M9 -44 q4 -3 8 0 t8 0 t8 0" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        <path d="M10 -37 L 36 -37 M 33 -39 L 36 -37 L 33 -35" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g></g>
    </g>`;
  const sadu = () => {
    let tri = '';
    for (let x = 0; x < 1000; x += 28) tri += `<path d="M${x} 22 L${x + 14} 6 L${x + 28} 22 Z" fill="${(x / 28) % 2 ? '#B3412E' : '#8B5A2B'}"/><rect x="${x + 11}" y="15" width="6" height="6" transform="rotate(45 ${x + 14} 18)" fill="#F3E7C9"/>`;
    return `<g class="occ-sadu" opacity=".55" transform="translate(0 60)"><rect x="0" y="0" width="1000" height="26" fill="#5E3A1E" opacity=".25"/>${tri}<rect x="0" y="24" width="1000" height="3" fill="#8B5A2B"/></g>`;
  };
  const lantern = (x, len, d) => `
    <g class="occ-lantern" style="--d:${d}s" transform="translate(${x} 0)">
      <line x1="0" y1="0" x2="0" y2="${len}" stroke="#9C8E45" stroke-width="1.4"/>
      <g transform="translate(0 ${len})">
        <path d="M-7 0 L7 0 L5 5 L-5 5 Z" fill="#9C8E45"/>
        <path d="M-10 5 Q -13 22 -8 34 L 8 34 Q 13 22 10 5 Z" fill="#F7D98B" stroke="#9C8E45" stroke-width="1.6"/>
        <path d="M0 5 L0 34 M-5 6 Q -7 20 -4 33 M5 6 Q 7 20 4 33" stroke="#C9A44C" stroke-width="1" fill="none"/>
        <ellipse cx="0" cy="20" rx="9" ry="12" fill="#FFE7A3" opacity=".65" class="occ-glow"/>
        <path d="M-8 34 L8 34 L5 39 L-5 39 Z" fill="#9C8E45"/>
        <circle cx="0" cy="42" r="2" fill="#9C8E45"/>
      </g>
    </g>`;
  const crescent = (cx, cy, r) => `
    <g class="occ-moon"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#E8C766"/><circle cx="${cx + r * 0.42}" cy="${cy - r * 0.22}" r="${r * 0.86}" fill="#F6F1E3" class="occ-moon-cut"/></g>`;
  const stars = (pts) => pts.map(([x, y, s, d]) => `<path class="occ-star" style="--d:${d}s" transform="translate(${x} ${y}) scale(${s})" d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill="#D9B954"/>`).join('');
  const burst = (x, y, color, d, r = 34) => {
    let rays = '';
    for (let i = 0; i < 14; i += 1) { const a = (i / 14) * Math.PI * 2; rays += `<line x1="${Math.cos(a) * r * 0.3}" y1="${Math.sin(a) * r * 0.3}" x2="${Math.cos(a) * r}" y2="${Math.sin(a) * r}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/><circle cx="${Math.cos(a) * r * 1.12}" cy="${Math.sin(a) * r * 1.12}" r="1.8" fill="${color}"/>`; }
    return `<g transform="translate(${x} ${y})"><g class="occ-burst" style="--d:${d}s">${rays}</g></g>`;
  };

  const SCENES = {
    national: () => beam('#2FA163', '#1F8A4C') + flag(),
    flag: () => beam('#4DB27A', '#2E8B57', 0.5) + flag(92, 100, 1.2),
    founding: () => beam('#C98B3A', '#A8742F', 0.58) + sadu(),
    ramadan: () => beam('#F2C36B', '#E2A84B', 0.45) + crescent(905, 100, 26) + stars([[860, 80, 0.9, 0], [950, 160, 0.8, 0.7], [560, 100, 0.7, 1.3], [270, 170, 0.8, 1.9]]) + lantern(330, 92, 0) + lantern(410, 128, 0.6) + lantern(490, 84, 1.2),
    eid: () => beam('#F2C36B', '#E2A84B', 0.4) + burst(340, 110, '#BEAE59', 0) + burst(470, 84, '#2B8FA3', 1.1, 26) + burst(930, 120, '#E07A5F', 2.0, 26) + burst(400, 210, '#BEAE59', 2.7, 20) + stars([[905, 230, 0.8, 0.4], [520, 150, 0.6, 1.6]])
  };

  layer.innerHTML = `<svg viewBox="0 0 1000 560" preserveAspectRatio="xMinYMid slice" focusable="false">${SCENES[occ.id]()}</svg>`;
  layer.hidden = false;
  root.dataset.occasion = occ.id;

  const greet = document.querySelector('[data-occasion-greeting]');
  if (greet) {
    greet.innerHTML = `<i class="bi ${ICON[occ.id]}" aria-hidden="true"></i> <span></span>`;
    greet.querySelector('span').textContent = GREET[lang][occ.id];
    greet.hidden = false;
  }
})();
