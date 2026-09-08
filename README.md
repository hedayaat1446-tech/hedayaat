# Hedayaat - هدايات

نسخة الموقع المطابقة بصريًا لملف هوية هدايات، والمجهزة تقنيًا وفق تقرير الموقع.

## مهم: لماذا الملفات كلها في الجذر؟
هذه النسخة **Flat** لتسهيل رفعها على GitHub كما طلب المستخدم. عند `npm run build` يقوم `prepare-structure.mjs` تلقائيًا بإنشاء البنية المطلوبة في التقرير:

- `src/layouts/BaseLayout.astro`
- `src/pages/index.astro`
- `src/pages/thank.astro`
- `src/content/site.json`
- `public/styles/site.css`
- `public/admin/config.yml`
- `public/admin/index.html`
- بقية الصور والملفات العامة داخل `public/`

لا ترفع مجلدات `src` أو `public` يدويًا؛ يتم توليدها أثناء البناء.

## التقنية
- Astro 5.16.16 - Static Site
- Bootstrap 5.3.3 + Bootstrap Icons
- Cairo + Amiri كخطوط ويب بديلة، مع أولوية أسماء خطوط الهوية في CSS عند توفرها
- Decap CMS في `/admin`
- Netlify Forms لنموذج التواصل
- SEO + Open Graph + canonical
- RTL + Responsive + Accessibility

## التشغيل محليًا
```bash
npm ci
npm run dev
```

## البناء
```bash
npm run build
```
الناتج في `dist/`.

## Railway
الإعدادات موجودة في `railway.json`:
- Build: `npm run build`
- Start: `npm start`

الموقع العام يعمل على Railway. **لكن Netlify Forms وNetlify Identity/Git Gateway خصائص Netlify ولا تعمل كخدمة كاملة على Railway.**

## Netlify - المطابقة الكاملة للتقرير
ملف `netlify.toml` مضبوط على:
- Build command: `npm run build`
- Publish directory: `dist`
- `/admin` -> `/admin/index.html`

بعد ربط المشروع بحساب المؤسسة في Netlify:
1. فعّل Identity.
2. فعّل Git Gateway.
3. ادعُ مستخدمي المؤسسة المسموح لهم بالتعديل.
4. افتح `/admin` وسجّل الدخول.
5. اختبر تعديلًا بسيطًا وتأكد من إنشاء commit وإعادة deploy تلقائيًا.
6. من Forms تأكد أن نموذج `contact` ظهر، ثم فعّل Email notifications إذا رغبت المؤسسة.

## لوحة الإدارة مع النسخة Flat
Decap CMS يعدّل `site.json` في جذر المستودع مباشرة. عند البناء يُنسخ تلقائيًا إلى `src/content/site.json`، لذلك تبقى تجربة GitHub بسيطة وتظل بنية Astro الناتجة مطابقة.

الملفات والصور التي ترفع من CMS تحفظ في `uploads/` ثم تُنسخ أثناء البناء إلى `public/uploads/`.

## بيانات ما زالت تحتاج اعتماد المؤسسة
- ملف مجلس الإدارة PDF.
- ملفات التقارير PDF.
- الآيبان الرسمي.
- روابط Snapchat / YouTube / Instagram / X الرسمية.
- الدومين الرسمي إذا تم اعتماده لاحقًا.

لن تظهر الروابط أو البيانات غير المعتمدة للمستخدم حتى تتم إضافتها من لوحة الإدارة.
