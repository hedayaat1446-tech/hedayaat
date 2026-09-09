# Hedayaat — final website package

هذه النسخة تجمع بين:
- تصميم الموقع كما يظهر في تقرير موقع هدايات: Hero بصورة المنارة، خلفية خضراء داكنة، Navbar هادئ، بطاقات فاتحة، وأقسام الرؤية والأهداف والقيم والوثائق والتواصل.
- ألوان هوية هدايات الرسمية الستة داخل عناصر الواجهة والزخارف، بدون عرض لوحة الألوان كجزء من الصفحة.
- Astro 5.16.16 + Decap CMS + Netlify Forms وفق التقرير.
- دعم Railway للإتاحة الحالية للموقع.

## طريقة الرفع
جميع الملفات في هذا ZIP موجودة مباشرة بدون مجلد خارجي. ارفعها إلى جذر GitHub repository.

## Railway
Build Command:
`npm run build`

Start Command:
`npm start`

## Netlify (المطابق للتقرير)
Build Command:
`npm run build`

Publish directory:
`dist`

لوحة الإدارة:
`/admin`

لتشغيل Decap CMS بالكامل على Netlify يجب تفعيل Identity و Git Gateway من حساب المؤسسة.

## ملاحظات المحتوى
- روابط السوشيال غير المعتمدة مخفية حتى إضافة الروابط الرسمية.
- الآيبان مخفي حتى إدخال الآيبان الرسمي.
- ملفات مجلس الإدارة والتقارير تظهر كـ "قريبًا" حتى رفع ملفات PDF الرسمية.


## Hedayaat identity update
- Official palette applied: #637450, #BEAE59, #E69D74, #E06659, #93BBBA, #21607F.
- Main/program headings use OYMandisa when available.
- Subheadings/body use The Year of Handicrafts when available.
- Cairo/Amiri remain fallback web fonts because the identity PDF does not include distributable web-font files.


## Visual identity correction
- Website typography follows the report: **Amiri** for major headings and **Cairo** for body/UI.
- Identity swatches are exact samples from the supplied guide: #647551, #BFAF5A, #E79E75, #E1675A, #94BCBB, #226180.
- The report's near-black green background, beige navigation, and cream cards are preserved; identity colors are used as controlled accents rather than replacing the whole site background.


## Visual baseline
This build restores the exact website-report typography/layout baseline (Amiri + Cairo; #101713 dark background; #E9E5DD cards) and applies the supplied Hedayaat six-color identity palette only as accents. CSS/HTML caching is disabled on Railway to prevent stale design after deploy.
