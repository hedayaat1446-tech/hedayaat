import { mkdir, copyFile, rm, access, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const root = new URL('./', import.meta.url);

const maps = [
  ['BaseLayout.astro', 'src/layouts/BaseLayout.astro'],

  ['index.astro', 'src/pages/index.astro'],
  ['thank.astro', 'src/pages/thank.astro'],
  ['privacy.astro', 'src/pages/privacy.astro'],
  ['404.astro', 'src/pages/404.astro'],
  ['videos.astro', 'src/pages/videos.astro'],
  ['news.astro', 'src/pages/news.astro'],
  ['photos.astro', 'src/pages/photos.astro'],
  ['board.astro', 'src/pages/board.astro'],
  ['reports.astro', 'src/pages/reports.astro'],
  ['governance.astro', 'src/pages/governance.astro'],
  ['transparency.astro', 'src/pages/transparency.astro'],
  ['accessibility.astro', 'src/pages/accessibility.astro'],
  ['participation.astro', 'src/pages/participation.astro'],

  ['en.astro', 'src/pages/en/index.astro'],
  ['en-videos.astro', 'src/pages/en/videos.astro'],
  ['en-participation.astro', 'src/pages/en/participation.astro'],
  ['en-board.astro', 'src/pages/en/board.astro'],
  ['en-governance.astro', 'src/pages/en/governance.astro'],
  ['en-transparency.astro', 'src/pages/en/transparency.astro'],
  ['en-accessibility.astro', 'src/pages/en/accessibility.astro'],
  ['en-privacy.astro', 'src/pages/en/privacy.astro'],
  ['en-reports.astro', 'src/pages/en/reports.astro'],
  ['en-news.astro', 'src/pages/en/news.astro'],
  ['en-photos.astro', 'src/pages/en/photos.astro'],
  ['en-thank.astro', 'src/pages/en/thank.astro'],
  ['en-404.astro', 'src/pages/en/404.astro'],

  ['sitemap.xml.js', 'src/pages/sitemap.xml.js'],
  ['robots.txt.js', 'src/pages/robots.txt.js'],

  ['site.json', 'src/content/site.json'],
  ['site-en.json', 'src/content/site-en.json'],

  ['site.css', 'public/styles/site.css'],
  ['bootstrap.min.css', 'public/vendor/bootstrap.min.css'],
  ['bootstrap.bundle.min.js', 'public/vendor/bootstrap.bundle.min.js'],
  ['bootstrap-icons.min.css', 'public/vendor/bootstrap-icons.min.css'],

  ['index.html', 'public/admin/index.html'],

  ['hedayat-new-logo.png', 'public/hedayat-new-logo.png'],
  ['hedayat-official-logo-v5.png', 'public/hedayat-official-logo-v5.png'],
  ['hedayat-official-logo-hero-v7.png', 'public/hedayat-official-logo-hero-v7.png'],
  ['hero_image1.jpeg', 'public/hero_image1.jpeg'],
  ['favicon.ico', 'public/favicon.ico'],
  ['social-preview.jpg', 'public/social-preview.jpg'],
  ['hero-lighthouse.svg', 'public/hero-lighthouse.svg'],
  ['hero-lighthouse-photo.jpg', 'public/hero-lighthouse-photo.jpg'],
  ['hero-lighthouse-photo.webp', 'public/hero-lighthouse-photo.webp'],
  ['hedayat-logo-gold.png', 'public/hedayat-logo-gold.png'],
  ['hedayat-logo-gold-light.png', 'public/hedayat-logo-gold-light.png'],
  ['national-center-logo.png', 'public/national-center-logo.png'],

  ['OYMandisa.ttf', 'public/fonts/OYMandisa.ttf'],
  ['OYMandisa.woff2', 'public/fonts/OYMandisa.woff2'],
  ['TheYearofHandicrafts-Regular.otf', 'public/fonts/TheYearofHandicrafts-Regular.otf'],
  ['TheYearofHandicrafts-Regular.woff2', 'public/fonts/TheYearofHandicrafts-Regular.woff2'],
  ['TheYearofHandicrafts-Medium.otf', 'public/fonts/TheYearofHandicrafts-Medium.otf'],
  ['TheYearofHandicrafts-Medium.woff2', 'public/fonts/TheYearofHandicrafts-Medium.woff2'],
  ['TheYearofHandicrafts-SemiBold.otf', 'public/fonts/TheYearofHandicrafts-SemiBold.otf'],
  ['TheYearofHandicrafts-SemiBold.woff2', 'public/fonts/TheYearofHandicrafts-SemiBold.woff2'],
  ['TheYearofHandicrafts-Bold.otf', 'public/fonts/TheYearofHandicrafts-Bold.otf'],
  ['TheYearofHandicrafts-Bold.woff2', 'public/fonts/TheYearofHandicrafts-Bold.woff2'],
  ['TheYearofHandicrafts-Black.otf', 'public/fonts/TheYearofHandicrafts-Black.otf'],
  ['TheYearofHandicrafts-Black.woff2', 'public/fonts/TheYearofHandicrafts-Black.woff2'],

  ['organization-license.pdf', 'public/organization-license.pdf'],
  ['basic-regulation.pdf', 'public/basic-regulation.pdf'],
  ['privacy-data-policy.pdf', 'public/privacy-data-policy.pdf'],
  ['disclosure-transparency-policy.pdf', 'public/disclosure-transparency-policy.pdf'],
  ['records-retention-disposal-policy.pdf', 'public/records-retention-disposal-policy.pdf'],
  ['financial-report.pdf', 'public/financial-report.pdf'],
  ['board-info.pdf', 'public/board-info.pdf'],

  ['organization-license-preview.jpg', 'public/organization-license-preview.jpg'],
  ['basic-regulation-preview.jpg', 'public/basic-regulation-preview.jpg'],
  ['privacy-data-policy-preview.jpg', 'public/privacy-data-policy-preview.jpg'],
  ['disclosure-transparency-policy-preview.jpg', 'public/disclosure-transparency-policy-preview.jpg'],
  ['records-retention-disposal-policy-preview.jpg', 'public/records-retention-disposal-policy-preview.jpg'],

  ['brand-watermark.svg', 'public/brand-watermark.svg'],
  ['brand-ribbon.svg', 'public/brand-ribbon.svg'],

  ['identity-grid.png', 'public/identity-grid.png'],
  ['identity-corner.png', 'public/identity-corner.png'],
  ['trustees-board.png', 'public/trustees-board.png'],
  ['org-structure.jpg', 'public/org-structure.jpg'],

  ['media-center-video-01.mp4', 'public/media/media-center-video-01.mp4'],
  ['media-center-video-01-poster.jpg', 'public/media/media-center-video-01-poster.jpg']
];

// تأكد من وجود كل الملفات المطلوبة قبل حذف src و public
const missing = [];

for (const [from] of maps) {
  const src = new URL(from, root);

  try {
    await access(src, constants.R_OK);
  } catch {
    missing.push(from);
  }
}

if (missing.length) {
  throw new Error(
    `Missing required build files: ${missing.join(', ')}`
  );
}

// إعادة بناء مجلدات Astro من الملفات الموجودة في الجذر
await rm(new URL('src/', root), {
  recursive: true,
  force: true
});

await rm(new URL('public/', root), {
  recursive: true,
  force: true
});

for (const [from, to] of maps) {
  const src = new URL(from, root);
  const dst = new URL(to, root);
  const parent = new URL('./', dst);

  await mkdir(parent, {
    recursive: true
  });

  await copyFile(src, dst);
}

// تصحيح مسارات imports تلقائيًا بعد نقل الصفحات
// العربي داخل src/pages/* يحتاج ../
// الإنجليزي داخل src/pages/en/* يحتاج ../../
for (const [, to] of maps) {
  if (
    !to.startsWith('src/pages/') ||
    !to.endsWith('.astro')
  ) {
    continue;
  }

  const pageUrl = new URL(to, root);

  let pageText = await readFile(
    pageUrl,
    'utf8'
  );

  const isEnglish =
    to.startsWith('src/pages/en/');

  const prefix = isEnglish
    ? '../../'
    : '../';

  pageText = pageText
    .replace(
      /import\s+BaseLayout\s+from\s+["'][^"']*layouts\/BaseLayout\.astro["'];?/g,
      `import BaseLayout from "${prefix}layouts/BaseLayout.astro";`
    )
    .replace(
      /import\s+site\s+from\s+["'][^"']*content\/site(?:-en)?\.json["'];?/g,
      `import site from "${prefix}content/${isEnglish ? 'site-en.json' : 'site.json'}";`
    );

  await writeFile(
    pageUrl,
    pageText,
    'utf8'
  );
}

// Astro 5: أي script من public يحتاج is:inline
const generatedLayout =
  new URL(
    'src/layouts/BaseLayout.astro',
    root
  );

let layoutText = await readFile(
  generatedLayout,
  'utf8'
);

const publicScriptPattern =
  /<script(?![^>]*\bis:inline\b)([^>]*\bsrc=["']\/(?:vendor|media|styles|fonts|uploads)\/[^"']+["'][^>]*)><\/script>/gi;

const hardenedLayoutText =
  layoutText.replace(
    publicScriptPattern,
    '<script is:inline$1></script>'
  );

if (hardenedLayoutText !== layoutText) {
  await writeFile(
    generatedLayout,
    hardenedLayoutText,
    'utf8'
  );

  layoutText = hardenedLayoutText;
}

// فحص أن Bootstrap يستخدم is:inline
if (
  !/<script\s+is:inline\s+src=["']\/vendor\/bootstrap\.bundle\.min\.js\?v=536["']><\/script>/.test(layoutText)
) {
  throw new Error(
    'BaseLayout.astro Bootstrap script must use is:inline because it is served from public/vendor.'
  );
}

console.log('Prepared exact report structure.');
