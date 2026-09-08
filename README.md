# موقع مؤسسة هدايات التعليمية

موقع تعريفي عربي لمؤسسة هدايات التعليمية، مبني كتطبيق **Astro Static Site**، ومجهز للنشر على Netlify وإدارة المحتوى عبر Decap CMS.

## البنية المطلوبة

- Astro 5.16.16
- HTML / Astro Components
- CSS مخصص: `public/styles/site.css`
- Bootstrap 5.3.3 + Bootstrap Icons
- Google Fonts: Cairo وAmiri كخطوط ويب احتياطية
- أسماء خطوط الهوية `OYMandisa` و`The Year of Handicrafts` معرفة في CSS كأولوية عند توفر الخطوط المرخصة على جهاز/بيئة المؤسسة
- Decap CMS: `/admin`
- Netlify Forms لنموذج التواصل
- GitHub + Netlify للنشر التلقائي

## التشغيل محليًا

```bash
npm install
npm run dev
```

## فحص البناء

```bash
npm run build
```

ينتج الموقع داخل مجلد `dist`.

## إعداد Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Base directory: يترك فارغًا إذا كان `package.json` في جذر المستودع
- Branch: `main`

ملف `netlify.toml` موجود ويحتوي إعدادات البناء وتحويل `/admin`.

## نموذج التواصل - Netlify Forms

النموذج موجود في HTML الناتج، ويحتوي على:

- `name="contact"`
- `method="POST"`
- `data-netlify="true"`
- `data-netlify-honeypot="bot-field"`
- `action="/thank"`
- hidden input باسم `form-name` وقيمته `contact`
- honeypot باسم `bot-field`
- أسماء واضحة لكل الحقول: `fullName`, `email`, `subject`, `message`

بعد أول Deploy يجب التأكد من ظهور نموذج `contact` في Netlify Dashboard > Forms، ثم تفعيل إشعار البريد من Form notifications.

## لوحة الإدارة - Decap CMS

المسار: `/admin`

الإعداد الحالي:

```yml
backend:
  name: git-gateway
  branch: main

media_folder: "public/uploads"
public_folder: "/uploads"
```

لتعمل اللوحة على حساب المؤسسة يجب تفعيل **Netlify Identity** و **Git Gateway** ثم دعوة المستخدمين المصرح لهم.

## المحتوى

كل نصوص وروابط وصور الصفحة الرئيسية مرتبطة بملف:

`src/content/site.json`

ويمكن تعديلها من `/admin` بعد تفعيل Decap CMS.

## بيانات تحتاج اعتماد المؤسسة

القيم التالية متروكة فارغة عمدًا حتى لا يظهر أي Placeholder أو رابط مكسور:

- `meta.url`: ضع رابط Netlify النهائي أو الدومين الرسمي.
- `contact.iban`: ضع الآيبان الرسمي فقط بعد اعتماده.
- روابط Snapchat / YouTube / Instagram / X: ضع الروابط الرسمية فقط.
- ملف مجلس الإدارة: ارفعه من لوحة الإدارة ثم فعّل خيار `منشور`.
- التقارير: ارفع ملفات PDF الحقيقية ثم فعّل خيار `منشور` لكل تقرير.

إذا بقيت هذه القيم فارغة فلن يعرض الموقع روابط وهمية أو بيانات غير معتمدة.

## الهوية البصرية

لوحة الألوان المستخدمة مطابقة لملف هوية هدايات:

- Olive `#647551`
- Gold `#BFAF5A`
- Peach `#E79E75`
- Salmon `#E1675A`
- Dusty Blue `#94BCBB`
- Deep Blue `#226180`

الموقع RTL ومتجاوب مع الجوال، ويحتوي على labels وalt text وحالات focus وتقليل الحركة عند تفعيل `prefers-reduced-motion`.

## Visual identity compliance

This build follows the supplied Hedayaat identity guide for the parts that apply to the current website:

- Hedayaat official logo assets are used in the navigation and hero.
- Brand palette is centralized in `public/styles/site.css` using the six identity colors.
- The supplied identity decorative geometry is included as `public/identity-corner.png` and `public/identity-grid.png` and used only as supporting decoration.
- Identity font family names are declared first (`OYMandisa`, `The Year of Handicrafts`). Cairo/Amiri remain fallbacks because the supplied PDF does not include installable font files.
- The sub-program lockup rule in the identity guide should be applied when an actual sub-program logo/name is introduced; the current site scope does not contain a sub-program section.

## Railway deployment (flat-upload safe)
هذه النسخة مصممة خصيصًا لتجنب مشكلة رفع المجلدات في GitHub. كل الملفات المهمة موجودة في الجذر، و`prepare-structure.mjs` يعيد إنشاء بنية `src/` و`public/` تلقائيًا أثناء البناء.

Railway:
- Build Command: `npm run build`
- Start Command: `npm start`

لا تستخدم `astro preview` على Railway في هذه النسخة. الخادم `server.mjs` يخدم مجلد `dist` مباشرة على `0.0.0.0:$PORT`، لذلك لا توجد مشكلة `Blocked request / allowedHosts`.
