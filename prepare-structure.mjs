import { mkdir, copyFile, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const root = new URL('./', import.meta.url);
const maps = [
  ['BaseLayout.astro', 'src/layouts/BaseLayout.astro'],
  ['index.astro', 'src/pages/index.astro'],
  ['thank.astro', 'src/pages/thank.astro'],
  ['privacy.astro', 'src/pages/privacy.astro'],
  ['404.astro', 'src/pages/404.astro'],
  ['news.astro', 'src/pages/news.astro'],
  ['photos.astro', 'src/pages/photos.astro'],
  ['videos.astro', 'src/pages/videos.astro'],
  ['board.astro', 'src/pages/board.astro'],
  ['reports.astro', 'src/pages/reports.astro'],
  ['governance.astro', 'src/pages/governance.astro'],
  ['site.json', 'src/content/site.json'],
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
  ['national-center-logo.png', 'public/national-center-logo.png'],
  ['OYMandisa.ttf', 'public/fonts/OYMandisa.ttf'],
  ['TheYearofHandicrafts-Regular.otf', 'public/fonts/TheYearofHandicrafts-Regular.otf'],
  ['TheYearofHandicrafts-Medium.otf', 'public/fonts/TheYearofHandicrafts-Medium.otf'],
  ['TheYearofHandicrafts-SemiBold.otf', 'public/fonts/TheYearofHandicrafts-SemiBold.otf'],
  ['TheYearofHandicrafts-Bold.otf', 'public/fonts/TheYearofHandicrafts-Bold.otf'],
  ['TheYearofHandicrafts-Black.otf', 'public/fonts/TheYearofHandicrafts-Black.otf'],
  ['organization-license.pdf', 'public/organization-license.pdf'],
  ['basic-regulation.pdf', 'public/basic-regulation.pdf'],
  ['privacy-data-policy.pdf', 'public/privacy-data-policy.pdf'],
  ['disclosure-transparency-policy.pdf', 'public/disclosure-transparency-policy.pdf'],
  ['records-retention-disposal-policy.pdf', 'public/records-retention-disposal-policy.pdf'],
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
  ['media-center-video-01.mp4', 'public/media/media-center-video-01.mp4'],
  ['media-center-video-01-poster.jpg', 'public/media/media-center-video-01-poster.jpg']
];

// Validate every required source before deleting generated folders.
// This prevents a single missing asset from leaving src/public half-destroyed during a runtime rebuild.
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
  throw new Error(`Missing required build files: ${missing.join(', ')}`);
}

// Always rebuild src/public from the flat root files so stale generated folders cannot override the intended design.
await rm(new URL('src/', root), { recursive: true, force: true });
await rm(new URL('public/', root), { recursive: true, force: true });

for (const [from, to] of maps) {
  const src = new URL(from, root);
  const dst = new URL(to, root);
  const parent = new URL('./', dst);
  await mkdir(parent, { recursive: true });
  await copyFile(src, dst);
}

console.log('Prepared exact report structure.');
